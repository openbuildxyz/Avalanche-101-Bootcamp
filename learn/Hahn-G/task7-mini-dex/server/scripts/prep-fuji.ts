// 录课前准备脚本（Fuji）：用课堂账户 A 做充值 / 登录 / 提现的真实链路验证。
// 用法：USER_KEY=0x... npx tsx scripts/prep-fuji.ts [deposit|check]
//   deposit：approve+deposit 100 USDC + 5 WAVAX → 等后端入账 → 提 50 USDC 上链
//   check  ：只登录查余额（用于 server 重启后验证回放）
import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbi, getAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const BASE = process.env.SERVER_URL ?? "http://localhost:8787";
const RPC = process.env.RPC_URL!; const CHAIN_ID = Number(process.env.CHAIN_ID);
const VAULT = getAddress(process.env.VAULT_ADDRESS!), USDC = getAddress(process.env.USDC_ADDRESS!), WAVAX = getAddress(process.env.WAVAX_ADDRESS!);
const mode = process.argv[2] ?? "check";
const account = privateKeyToAccount(process.env.USER_KEY as Hex);
const pub = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: avalancheFuji, transport: http(RPC) });
const erc20 = parseAbi(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)", "function allowance(address,address) view returns (uint256)"]);
const vaultAbi = parseAbi(["function deposit(address token, uint256 amount)", "function withdraw(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes signature)"]);

async function api<T = any>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) } });
  const body = await res.json(); if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`); return body as T;
}
const tx = async (hash: Hex, label: string) => { const r = await pub.waitForTransactionReceipt({ hash }); console.log(`  ${label}: ${r.status} https://testnet.snowtrace.io/tx/${hash}`); if (r.status !== "success") throw new Error(label + " reverted"); return r; };
async function login() {
  const { nonce } = await api<{ nonce: string }>(`/auth/nonce?address=${account.address}`);
  const signature = await account.signTypedData({ domain: { name: "MiniDex", version: "1", chainId: CHAIN_ID }, types: { Login: [{ name: "address", type: "address" }, { name: "nonce", type: "string" }, { name: "statement", type: "string" }] }, primaryType: "Login", message: { address: account.address, nonce, statement: "Sign in to MiniDex" } });
  return (await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ address: account.address, nonce, signature }) })).token;
}
async function waitBal(token: string, pred: (b: any) => boolean, ms = 90000) {
  const t0 = Date.now(); let b: any;
  while (Date.now() - t0 < ms) { b = await api("/balances", { token }); if (pred(b)) return b; await new Promise((r) => setTimeout(r, 2000)); }
  throw new Error("等待入账超时，最后余额 " + JSON.stringify(b));
}

async function main() {
  console.log("账户:", account.address, "| server:", await api("/config").then((c) => c.mode));
  const token = await login();
  if (mode === "deposit") {
    for (const [tokenAddr, amt, label] of [[USDC, 100n * 10n ** 6n, "100 USDC"], [WAVAX, 5n * 10n ** 18n, "5 WAVAX"]] as const) {
      const allowance = await pub.readContract({ address: tokenAddr, abi: erc20, functionName: "allowance", args: [account.address, VAULT] });
      if (allowance < amt) await tx(await wallet.writeContract({ address: tokenAddr, abi: erc20, functionName: "approve", args: [VAULT, amt], gas: 100000n }), `approve ${label}`);
      await tx(await wallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "deposit", args: [tokenAddr, amt], gas: 200000n }), `deposit ${label}`);
    }
    const b = await waitBal(token, (b) => Number(b.USDC.available) >= 100 && Number(b.WAVAX.available) >= 5);
    console.log("入账后交易所余额:", JSON.stringify(b));
    const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [account.address] });
    const w = await api("/withdraw", { method: "POST", token, body: JSON.stringify({ token: "USDC", amount: "50" }) });
    await tx(await wallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "withdraw", args: [getAddress(w.tokenAddress), BigInt(w.amount), BigInt(w.nonce), BigInt(w.deadline), w.signature], gas: 200000n }), "withdraw 50 USDC");
    const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [account.address] });
    console.log("链上 USDC 变化:", (after - before).toString(), "(期望 50000000)");
  }
  console.log("当前交易所余额:", JSON.stringify(await api("/balances", { token })));
}
main().catch((e) => { console.error(e); process.exit(1); });
