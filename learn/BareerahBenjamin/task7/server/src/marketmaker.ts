// 做市模块：把 Binance 的盘口"镜像"到本所订单簿，让订单簿有真实流动性、用户下单能真的成交。
//
// 每个 tick：拉 Binance 深度 → 取前 N 档并按比例缩小 → 和做市账户现有挂单做增量对比
//   （价格不在目标里的撤、部分成交偏差大的撤掉重挂、缺的补挂）→ 按可用余额裁剪 → 挂单 → 广播一次订单簿。
// 做市账户就是账本里的一个普通地址：离线模式靠 MM_SEED_* 虚拟注资；链上模式也可以给它真实 deposit。
// 教学说明：真实交易所的做市商是独立的外部程序，通过 API 下单；这里为了简单直接跑在后端进程里。

import { ONE, mulFixed, parseFixed } from "./fixed.js";
import type { Order, Side } from "./engine/orderbook.js";
import type { Ledger } from "./ledger.js";

export type Level = [price: string, qty: string];
export interface Depth { bids: Level[]; asks: Level[] }
export interface Quote { side: Side; price: bigint; qty: bigint }
export interface Plan { cancel: Order[]; place: Quote[] }

// 和前端同一套主机顺序：*.binance.vision 是官方公共行情域名，stream/api.binance.com 在部分地区返回 451
export const REST_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"];

type FetchLike = (input: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;
export interface RestOptions { hosts?: string[]; fetchFn?: FetchLike }

export async function fetchDepth(symbol: string, limit = 20, opts: RestOptions = {}): Promise<Depth> {
  const hosts = opts.hosts ?? REST_HOSTS;
  const fetchFn: FetchLike = opts.fetchFn ?? ((u) => fetch(u));
  let lastErr: unknown = new Error("no hosts");
  for (const host of hosts) {
    try {
      const res = await fetchFn(`${host}/api/v3/depth?symbol=${symbol}&limit=${limit}`);
      if (!res.ok) throw new Error(`HTTP ${res.status ?? "?"} from ${host}`);
      const d = (await res.json()) as { bids: Level[]; asks: Level[] };
      return { bids: d.bids, asks: d.asks };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export interface ScaleOptions { levels: number; scale: number; minQty: number; maxQty: number }

/** Binance 深度 → 本所目标档位：取前 levels 档，数量 × scale 后夹在 [minQty, maxQty]，价格 / 数量保留 4 位小数 */
export function scaleDepth(levels: Level[], o: ScaleOptions): Level[] {
  return levels.slice(0, o.levels).map(([p, q]) => {
    const qty = Math.min(o.maxQty, Math.max(o.minQty, Number(q) * o.scale));
    return [trim4(Number(p)), trim4(qty)];
  });
}

function trim4(n: number): string {
  return n.toFixed(4).replace(/\.?0+$/, "");
}

export function toQuotes(side: Side, levels: Level[]): Quote[] {
  return levels.map(([p, q]) => ({ side, price: parseFixed(p), qty: parseFixed(q) }));
}

/** 增量计划：已有单按 (side, price) 和目标匹配；不在目标里 → 撤；剩余量偏差超过 tolerance → 撤并重挂；同价重复只留一张 */
export function planQuotes(targets: Quote[], existing: Order[], tolerance = 0.2): Plan {
  const key = (side: Side, price: bigint) => `${side}:${price}`;
  const want = new Map(targets.map((t) => [key(t.side, t.price), t]));
  const matched = new Set<string>();
  const cancel: Order[] = [];

  for (const o of existing) {
    const k = key(o.side, o.price);
    const t = want.get(k);
    if (!t || matched.has(k)) {
      cancel.push(o); // 目标里没有这个价，或同价已有一张
      continue;
    }
    const diff = o.remaining > t.qty ? o.remaining - t.qty : t.qty - o.remaining;
    if (Number(diff) > Number(t.qty) * tolerance) {
      cancel.push(o); // 部分成交太多，撤掉重挂补足
      continue;
    }
    matched.add(k);
  }

  const place = targets.filter((t) => !matched.has(key(t.side, t.price)));
  return { cancel, place };
}

/** 按可用余额裁剪：买单从最优价往外累计 USDC 成本，卖单累计 WAVAX 数量；不够的截断，太小的丢弃 */
export function capByBalance(quotes: Quote[], avail: { USDC: bigint; WAVAX: bigint }, minQty: bigint): Quote[] {
  let usdc = avail.USDC;
  let wavax = avail.WAVAX;
  const out: Quote[] = [];
  for (const q of quotes) {
    if (q.side === "buy") {
      const cost = mulFixed(q.price, q.qty);
      let qty = q.qty;
      if (cost > usdc) qty = floor4((usdc * ONE) / q.price); // 买得起多少就挂多少
      if (qty < minQty || qty <= 0n) continue;
      usdc -= mulFixed(q.price, qty);
      out.push({ ...q, qty });
    } else {
      const qty = q.qty > wavax ? wavax : q.qty;
      if (qty < minQty || qty <= 0n) continue;
      wavax -= qty;
      out.push({ ...q, qty });
    }
  }
  return out;
}

// 定点数截到 4 位小数（8 位定点 → 去掉低 4 位）
function floor4(v: bigint): bigint {
  const unit = 10n ** 4n;
  return (v / unit) * unit;
}

export interface MarketMakerConfig {
  address: string;
  symbol: string;
  levels: number;
  scale: number;
  intervalMs: number;
  minQty: number;
  maxQty: number;
}

export interface MarketMakerDeps {
  ledger: Ledger;
  ordersOf(owner: string): Order[];
  placeOrder(owner: string, q: { side: Side; type: "limit"; price: bigint; qty: bigint }, opts: { broadcastBook: boolean }): unknown;
  cancelOrder(owner: string, id: string, opts: { broadcastBook: boolean }): unknown;
  broadcastBook(): void;
  fetchDepth?: typeof fetchDepth;
  log?: (msg: string) => void;
}

/** 启动做市循环，返回停止函数 */
export function startMarketMaker(cfg: MarketMakerConfig, deps: MarketMakerDeps): () => void {
  const log = deps.log ?? ((m: string) => console.log(`[mm] ${m}`));
  const getDepth = deps.fetchDepth ?? fetchDepth;
  const mm = cfg.address.toLowerCase();
  const minQtyFixed = parseFixed(String(cfg.minQty));
  let running = false;
  let failures = 0;
  let ticks = 0;

  async function tick() {
    if (running) return; // 上一个 tick 还没跑完（网络慢）就跳过这一轮
    running = true;
    try {
      const depth = await getDepth(cfg.symbol, Math.max(cfg.levels, 5));
      const scaleOpts = { levels: cfg.levels, scale: cfg.scale, minQty: cfg.minQty, maxQty: cfg.maxQty };
      const targets = [...toQuotes("buy", scaleDepth(depth.bids, scaleOpts)), ...toQuotes("sell", scaleDepth(depth.asks, scaleOpts))];

      const plan = planQuotes(targets, deps.ordersOf(mm));
      for (const o of plan.cancel) deps.cancelOrder(mm, o.id, { broadcastBook: false });

      const b = deps.ledger.get(mm);
      const toPlace = capByBalance(plan.place, { USDC: b.USDC.available, WAVAX: b.WAVAX.available }, minQtyFixed);
      let placed = 0;
      for (const q of toPlace) {
        try {
          deps.placeOrder(mm, { side: q.side, type: "limit", price: q.price, qty: q.qty }, { broadcastBook: false });
          placed += 1;
        } catch (e) {
          log(`挂单失败 ${q.side} ${q.price}: ${(e as Error).message}`);
        }
      }
      if (plan.cancel.length || placed) deps.broadcastBook();

      ticks += 1;
      if (failures > 0) log(`行情恢复，继续做市`);
      failures = 0;
      if (ticks === 1 || ticks % 150 === 0) {
        const s = deps.ordersOf(mm);
        log(`tick#${ticks} 簿上 ${s.filter((o) => o.side === "buy").length} 买 / ${s.filter((o) => o.side === "sell").length} 卖，本轮撤 ${plan.cancel.length} 挂 ${placed}`);
      }
    } catch (e) {
      failures += 1;
      if (failures === 1 || failures % 30 === 0) log(`拉取 Binance 深度失败（连续 ${failures} 次）：${(e as Error).message}`);
    } finally {
      running = false;
    }
  }

  log(`启动：账户 ${mm}，镜像 Binance ${cfg.symbol} 前 ${cfg.levels} 档 × ${cfg.scale}，每 ${cfg.intervalMs}ms 刷新`);
  void tick();
  const timer = setInterval(() => void tick(), cfg.intervalMs);
  return () => clearInterval(timer);
}
