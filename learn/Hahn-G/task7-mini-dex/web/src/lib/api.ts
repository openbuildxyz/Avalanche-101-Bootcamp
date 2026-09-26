// 后端 HTTP 接口封装：所有 fetch 集中在这里，组件只调 api.xxx()。
// 金额一律是十进制字符串（"100.5"），和 spec §3.4 一致。
export const API_URL: string = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

export type Address = `0x${string}`;
export type TokenSymbol = "USDC" | "WAVAX";
export type Side = "buy" | "sell";
export type OrderType = "limit" | "market";

export interface Config {
  chainId: number;
  vault: Address | "";
  tokens: { USDC: Address; WAVAX: Address };
  wsUrl: string;
  mode?: "offline" | "chain";
  // 后端开启做市时返回：订单簿流动性镜像自哪个外部市场
  marketMaker?: { address: string; symbol: string; source: string } | null;
}

export interface TokenBalance {
  available: string;
  locked: string;
}
export type Balances = Record<TokenSymbol, TokenBalance>;

export type Level = [price: string, qty: string];
export interface OrderBookSnapshot {
  bids: Level[];
  asks: Level[];
}

export interface Trade {
  id: string;
  price: string;
  qty: string;
  side: Side;
  ts: number;
}

export interface Order {
  id: string;
  owner: string;
  side: Side;
  type: OrderType;
  price: string;
  qty: string;
  remaining: string;
  ts: number;
}

export interface Fill {
  takerOrderId: string;
  makerOrderId: string;
  taker: string;
  maker: string;
  price: string;
  qty: string;
  side: Side;
  ts: number;
}

export interface PlaceOrderBody {
  side: Side;
  type: OrderType;
  price?: string;
  qty: string;
}

// POST /withdraw 返回的"提现授权"，原样交给 Vault.withdraw
export interface WithdrawAuth {
  token: TokenSymbol;
  amount: string; // wei 字符串
  nonce: string;
  deadline: string;
  signature: Address;
  vault: Address;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  token?: string | null;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    throw new ApiError(res.status, extractError(data) ?? `${res.status} ${res.statusText}`);
  }
  return data as T;
}

// 错误响应一般是 {error:"..."}，也兼容纯文本
function extractError(data: unknown): string | null {
  if (typeof data === "string" && data) return data;
  if (data && typeof data === "object" && "error" in data) return String((data as { error: unknown }).error);
  return null;
}

// 后端可能返回 [] 也可能返回 {orders: []} 这种包一层的形式，这里统一成数组
function asArray<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as Record<string, unknown>)[key])) {
    return (data as Record<string, T[]>)[key];
  }
  return [];
}

export const api = {
  config: () => request<Config>("/config"),

  nonce: (address: string) => request<{ nonce: string }>(`/auth/nonce?address=${address}`),

  login: (body: { address: string; nonce: string; signature: string }) =>
    request<{ token: string }>("/auth/login", { method: "POST", body }),

  me: (token: string) => request<{ address: string }>("/me", { token }),

  balances: (token: string) => request<Balances>("/balances", { token }),

  orderbook: (depth = 10) => request<OrderBookSnapshot>(`/orderbook?depth=${depth}`),

  trades: async (limit = 30) => asArray<Trade>(await request("/trades?limit=" + limit), "trades"),

  orders: async (token: string) => asArray<Order>(await request("/orders", { token }), "orders"),

  placeOrder: (token: string, body: PlaceOrderBody) =>
    request<{ order: Order; fills: Fill[] }>("/orders", { method: "POST", body, token }),

  cancelOrder: (token: string, id: string) =>
    request<unknown>(`/orders/${id}`, { method: "DELETE", token }),

  withdraw: (token: string, body: { token: TokenSymbol; amount: string }) =>
    request<WithdrawAuth>("/withdraw", { method: "POST", body, token }),

  // 仅离线模式（/config 没有 vault 地址）：后端直接给账户加钱
  devFaucet: (token: string) => request<unknown>("/dev/faucet", { method: "POST", body: {}, token }),
};

// ---- JWT 存取 ----
// 教学点（来自 Primit 的教训）：token 必须按 chainId + address 分开存，
// 否则切链/切账号后会拿着别的链、别的地址的 token 去请求，后端直接 401。
export function jwtKey(chainId: number, address: string): string {
  return `minidex:jwt:${chainId}:${address.toLowerCase()}`;
}

export function loadJwt(chainId: number, address: string): string | null {
  try {
    return localStorage.getItem(jwtKey(chainId, address));
  } catch {
    return null;
  }
}

export function saveJwt(chainId: number, address: string, token: string): void {
  localStorage.setItem(jwtKey(chainId, address), token);
}

export function clearJwt(chainId: number, address: string): void {
  localStorage.removeItem(jwtKey(chainId, address));
}
