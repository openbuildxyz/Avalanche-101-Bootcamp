// 全链路联调脚本（anvil 模式）：合约 ↔ server ↔ 账本 ↔ 撮合 ↔ 提现签名 ↔ Vault.withdraw。
// 前置：anvil 在跑、合约已部署、server 以链上模式启动（VAULT_ADDRESS 等已填）。
// 用法：npm run e2e   （由 ../scripts/e2e-anvil.sh 一键编排）
import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbi, getAddress, defineChain, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const BASE = process.env.SERVER_URL ?? "http://localhost:8787";
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8545";
const CHAIN_ID = Number(process.env.CHAIN_ID ?? 31337);
const VAULT = getAddress(process.env.VAULT_ADDRESS!);
const USDC = getAddress(process.env.USDC_ADDRESS!);
const WAVAX = getAddress(process.env.WAVAX_ADDRESS!);

// anvil 公开测试账户 #2 / #3（只能用于本地链）
const KEYS: Hex[] = [
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
];

const chain = defineChain({ id: CHAIN_ID, name: "local", nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const pub = createPublicClient({ chain, transport: http(RPC) });
const erc20 = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);
const vaultAbi = parseAbi([
  "function deposit(address token, uint256 amount)",
  "function withdraw(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes signature)",
  "event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce)",
]);

async function api<T = any>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) } });
  const body = await res.json();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

function assert(cond: unknown, msg: string) { if (!cond) { console.error("ASSERT FAILED:", msg); process.exit(1); } console.log("  ✔", msg); }

async function makeUser(key: Hex) {
  const account = privateKeyToAccount(key);
  const wallet = createWalletClient({ account, chain, transport: http(RPC) });
  const tx = async (hash: Hex) => { const r = await pub.waitForTransactionReceipt({ hash }); if (r.status !== "success") throw new Error("tx reverted " + hash); return r; };
  // 登录
  const { nonce } = await api<{ nonce: string }>(`/auth/nonce?address=${account.address}`);
  const signature = await account.signTypedData({
    domain: { name: "MiniDex", version: "1", chainId: CHAIN_ID },
    types: { Login: [{ name: "address", type: "address" }, { name: "nonce", type: "string" }, { name: "statement", type: "string" }] },
    primaryType: "Login", message: { address: account.address, nonce, statement: "Sign in to MiniDex" },
  });
  const { token } = await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ address: account.address, nonce, signature }) });
  return { account, wallet, tx, token, address: account.address };
}

async function waitBalance(token: string, asset: "USDC" | "WAVAX", expect: string, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const b = await api(`/balances`, { token });
    if (b[asset].available === expect) return b;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`等待 ${asset} available == ${expect} 超时`);
}

async function main() {
  const cfg = await api("/config");
  console.log("config:", cfg);
  assert(cfg.mode === "chain" && cfg.vault.toLowerCase() === VAULT.toLowerCase(), "server 处于链上模式且 vault 地址一致");

  const alice = await makeUser(KEYS[0]);
  const bob = await makeUser(KEYS[1]);
  console.log("alice", alice.address, "\nbob  ", bob.address);

  console.log("\n[1] 水龙头 mint + approve + deposit（alice: 500 USDC + 5 WAVAX；bob: 1000 USDC）");
  for (const [u, tokenAddr, mintAmt, depAmt] of [
    [alice, USDC, 1000n * 10n ** 6n, 500n * 10n ** 6n],
    [alice, WAVAX, 10n * 10n ** 18n, 5n * 10n ** 18n],
    [bob, USDC, 1000n * 10n ** 6n, 1000n * 10n ** 6n],
  ] as const) {
    await u.tx(await u.wallet.writeContract({ address: tokenAddr, abi: erc20, functionName: "mint", args: [u.address, mintAmt] }));
    await u.tx(await u.wallet.writeContract({ address: tokenAddr, abi: erc20, functionName: "approve", args: [VAULT, depAmt] }));
    await u.tx(await u.wallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "deposit", args: [tokenAddr, depAmt] }));
  }
  await waitBalance(alice.token, "USDC", "500");
  await waitBalance(alice.token, "WAVAX", "5");
  await waitBalance(bob.token, "USDC", "1000");
  assert(true, "后端监听 Deposit 事件并入账：alice 500 USDC / 5 WAVAX，bob 1000 USDC");

  console.log("\n[2] alice 挂 sell limit 1 WAVAX @ 20；bob buy market 0.5");
  const sell = await api("/orders", { method: "POST", token: alice.token, body: JSON.stringify({ side: "sell", type: "limit", price: "20", qty: "1" }) });
  assert(sell.resting || sell.order, "卖单挂入");
  const buy = await api("/orders", { method: "POST", token: bob.token, body: JSON.stringify({ side: "buy", type: "market", qty: "0.5" }) });
  assert(buy.fills.length === 1 && buy.fills[0].price === "20" && buy.fills[0].qty === "0.5", "成交 0.5 @ 20（maker 价）");
  const ab = await api("/balances", { token: alice.token });
  const bb = await api("/balances", { token: bob.token });
  assert(ab.USDC.available === "510" && ab.WAVAX.locked === "0.5", `alice USDC 510 / WAVAX locked 0.5 (${JSON.stringify(ab)})`);
  assert(bb.USDC.available === "990" && bb.WAVAX.available === "0.5", `bob USDC 990 / WAVAX 0.5 (${JSON.stringify(bb)})`);

  console.log("\n[3] alice 提现 100 USDC：后端签 → 链上 withdraw");
  const before = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.address] });
  const w = await api("/withdraw", { method: "POST", token: alice.token, body: JSON.stringify({ token: "USDC", amount: "100" }) });
  console.log("  签名返回:", { nonce: w.nonce, deadline: w.deadline, amount: w.amount, sig: w.signature.slice(0, 18) + "…" });
  const rc = await alice.tx(await alice.wallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "withdraw", args: [getAddress(w.tokenAddress), BigInt(w.amount), BigInt(w.nonce), BigInt(w.deadline), w.signature] }));
  const after = await pub.readContract({ address: USDC, abi: erc20, functionName: "balanceOf", args: [alice.address] });
  assert(after - before === 100n * 10n ** 6n, "链上 USDC 余额 +100（Vault 验签通过）");
  const ab2 = await api("/balances", { token: alice.token });
  assert(ab2.USDC.available === "410", "链下 USDC available 410");
  const logs = await pub.getContractEvents({ address: VAULT, abi: vaultAbi, eventName: "Withdraw", fromBlock: rc.blockNumber, toBlock: rc.blockNumber });
  assert(logs.length === 1 && logs[0].args.nonce === BigInt(w.nonce), "Withdraw 事件 nonce 一致");

  console.log("\n[4] 同一签名重放必须失败");
  let replayed = false;
  try {
    await alice.wallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "withdraw", args: [getAddress(w.tokenAddress), BigInt(w.amount), BigInt(w.nonce), BigInt(w.deadline), w.signature] });
    replayed = true;
  } catch { /* expected revert */ }
  assert(!replayed, "重放被合约拒绝（usedNonces）");

  console.log("\nE2E OK");
}
main().catch((e) => { console.error(e); process.exit(1); });
