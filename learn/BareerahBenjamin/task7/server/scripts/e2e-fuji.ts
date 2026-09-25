// Fuji 双地址成交证明：主测试钱包挂买单，运行时生成的第二钱包挂卖单。
// 第二钱包私钥只存在于当前进程内，日志只输出公开地址和交易哈希。
//
// 用法：
//   PRIMARY_KEY=0x... CHAIN_ID=43113 RPC_URL=... VAULT_ADDRESS=... \
//   USDC_ADDRESS=... WAVAX_ADDRESS=... npm run e2e:fuji
import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  formatEther,
  getAddress,
  http,
  parseAbi,
  parseEther,
  type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { avalancheFuji } from "viem/chains";

const BASE = process.env.SERVER_URL ?? "http://localhost:8787";
const CHAIN_ID = Number(process.env.CHAIN_ID);
const RPC = process.env.RPC_URL!;
const VAULT = getAddress(process.env.VAULT_ADDRESS!);
const WAVAX = getAddress(process.env.WAVAX_ADDRESS!);
const primary = privateKeyToAccount(process.env.PRIMARY_KEY as Hex);
const counterparty = privateKeyToAccount(generatePrivateKey());
const pub = createPublicClient({ chain: avalancheFuji, transport: http(RPC) });
const primaryWallet = createWalletClient({ account: primary, chain: avalancheFuji, transport: http(RPC) });
const counterpartyWallet = createWalletClient({ account: counterparty, chain: avalancheFuji, transport: http(RPC) });
const tokenAbi = parseAbi([
  "function mint(address to,uint256 amount)",
  "function approve(address spender,uint256 amount) returns (bool)",
]);
const vaultAbi = parseAbi(["function deposit(address token,uint256 amount)"]);

async function api<T = any>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

async function tx(hash: Hex, label: string) {
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`  ${label}: ${receipt.status} https://testnet.snowtrace.io/tx/${hash}`);
  if (receipt.status !== "success") throw new Error(`${label} reverted`);
  return hash;
}

async function login(account: typeof primary) {
  const { nonce } = await api<{ nonce: string }>(`/auth/nonce?address=${account.address}`);
  const signature = await account.signTypedData({
    domain: { name: "MiniDex", version: "1", chainId: CHAIN_ID },
    types: {
      Login: [
        { name: "address", type: "address" },
        { name: "nonce", type: "string" },
        { name: "statement", type: "string" },
      ],
    },
    primaryType: "Login",
    message: { address: account.address, nonce, statement: "Sign in to MiniDex" },
  });
  return (await api<{ token: string }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ address: account.address, nonce, signature }),
  })).token;
}

async function waitForWavax(token: string, minimum: number, timeoutMs = 90_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const balances = await api<any>("/balances", { token });
    if (Number(balances.WAVAX.available) >= minimum) return balances;
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }
  throw new Error("等待第二地址 WAVAX 入账超时");
}

async function main() {
  const config = await api<any>("/config");
  if (config.mode !== "chain" || config.chainId !== 43113) throw new Error("后端未连接 Avalanche Fuji");

  console.log("双地址:");
  console.log(`  买方 ${primary.address}`);
  console.log(`  卖方 ${counterparty.address}`);

  await tx(
    await primaryWallet.sendTransaction({ to: counterparty.address, value: parseEther("0.02") }),
    "给卖方发送 0.02 Fuji AVAX gas",
  );
  console.log(`  卖方 gas 余额: ${formatEther(await pub.getBalance({ address: counterparty.address }))} AVAX`);

  const depositAmount = 2n * 10n ** 18n;
  await tx(
    await counterpartyWallet.writeContract({ address: WAVAX, abi: tokenAbi, functionName: "mint", args: [counterparty.address, depositAmount] }),
    "卖方 mint 2 WAVAX",
  );
  await tx(
    await counterpartyWallet.writeContract({ address: WAVAX, abi: tokenAbi, functionName: "approve", args: [VAULT, depositAmount] }),
    "卖方 approve 2 WAVAX",
  );
  const depositHash = await tx(
    await counterpartyWallet.writeContract({ address: VAULT, abi: vaultAbi, functionName: "deposit", args: [WAVAX, depositAmount] }),
    "卖方 deposit 2 WAVAX",
  );

  const [buyerToken, sellerToken] = await Promise.all([login(primary), login(counterparty)]);
  await waitForWavax(sellerToken, 2);

  const buy = await api<any>("/orders", {
    method: "POST",
    token: buyerToken,
    body: JSON.stringify({ side: "buy", type: "limit", price: "10", qty: "1" }),
  });
  if (buy.fills.length !== 0) throw new Error("买单应先进入订单簿");

  const sell = await api<any>("/orders", {
    method: "POST",
    token: sellerToken,
    body: JSON.stringify({ side: "sell", type: "limit", price: "10", qty: "1" }),
  });
  const fill = sell.fills[0];
  if (!fill || fill.maker.toLowerCase() !== primary.address.toLowerCase() || fill.taker.toLowerCase() !== counterparty.address.toLowerCase()) {
    throw new Error(`双地址成交校验失败: ${JSON.stringify(sell)}`);
  }

  const [buyerBalances, sellerBalances] = await Promise.all([
    api<any>("/balances", { token: buyerToken }),
    api<any>("/balances", { token: sellerToken }),
  ]);
  console.log("成交:", JSON.stringify(fill));
  console.log("买方余额:", JSON.stringify(buyerBalances));
  console.log("卖方余额:", JSON.stringify(sellerBalances));
  console.log("卖方 deposit tx:", depositHash);
  console.log("FUJI TWO-ADDRESS TRADE OK");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
