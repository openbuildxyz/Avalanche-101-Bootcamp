// 冒烟脚本：对着一个已经跑起来的（离线模式）server 走一遍完整流程。
// 两个随机钱包：seller 挂 sell limit，buyer 打 buy market，看成交、余额、订单簿。
// 用法：npm run smoke   （可用 SERVER_URL 改地址，默认 http://localhost:8787）
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const BASE = process.env.SERVER_URL ?? "http://localhost:8787";

async function api<T = any>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${JSON.stringify(body)}`);
  return body as T;
}

/** nonce -> 钱包签 EIP-712 -> login -> JWT */
async function login(chainId: number) {
  const account = privateKeyToAccount(generatePrivateKey());
  const { nonce } = await api<{ nonce: string }>(`/auth/nonce?address=${account.address}`);
  const signature = await account.signTypedData({
    domain: { name: "MiniDex", version: "1", chainId },
    types: { Login: [{ name: "address", type: "address" }, { name: "nonce", type: "string" }, { name: "statement", type: "string" }] },
    primaryType: "Login",
    message: { address: account.address, nonce, statement: "Sign in to MiniDex" },
  });
  const { token } = await api<{ token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ address: account.address, nonce, signature }) });
  return { address: account.address, token };
}

async function main() {
  const config = await api<{ chainId: number; mode: string }>("/config");
  console.log("config:", config);
  if (config.mode !== "offline") console.warn("提示：不是离线模式，/dev/faucet 不可用，下面会失败");

  const seller = await login(config.chainId);
  const buyer = await login(config.chainId);
  console.log("seller:", seller.address);
  console.log("buyer :", buyer.address);
  console.log("me    :", await api("/me", { token: seller.token }));

  await api("/dev/faucet", { method: "POST", token: seller.token });
  await api("/dev/faucet", { method: "POST", token: buyer.token });

  console.log("\n1) seller 挂 sell limit 2 WAVAX @ 25");
  const sell = await api("/orders", { method: "POST", token: seller.token, body: JSON.stringify({ side: "sell", type: "limit", price: "25", qty: "2" }) });
  console.log("   resting:", sell.order.id, "remaining", sell.order.remaining);
  console.log("   orderbook:", await api("/orderbook?depth=5"));

  console.log("\n2) buyer 打 buy market 1.5 WAVAX");
  const buy = await api("/orders", { method: "POST", token: buyer.token, body: JSON.stringify({ side: "buy", type: "market", qty: "1.5" }) });
  console.log("   fills:", buy.fills.map((f: any) => `${f.qty} @ ${f.price} (maker ${f.maker.slice(0, 8)}…)`));

  const sb = await api("/balances", { token: seller.token });
  const bb = await api("/balances", { token: buyer.token });
  console.log("\n3) balances");
  console.log("   seller:", sb);
  console.log("   buyer :", bb);
  console.log("   orderbook:", await api("/orderbook?depth=5"));
  console.log("   trades:", await api("/trades?limit=5"));
  console.log("   seller open orders:", await api("/orders", { token: seller.token }));

  // 断言：seller USDC 应该多了 1.5*25 = 37.5；buyer WAVAX 多了 1.5
  const ok = buy.fills.length >= 1 && sb.USDC.available === "10037.5" && bb.WAVAX.available === "101.5" && sb.WAVAX.locked === "0.5" && bb.USDC.available === "9962.5";
  console.log(ok ? "\nSMOKE OK" : "\nSMOKE FAILED: 余额和预期不符");
  if (!ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
