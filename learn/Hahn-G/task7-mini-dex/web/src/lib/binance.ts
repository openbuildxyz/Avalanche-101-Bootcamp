// Binance 公共行情源：K 线历史（REST）+ 实时 K 线（WS，失败退化为 REST 轮询）+ 24h 行情。
// 只用公开接口，不需要 API key；公共接口带 Access-Control-Allow-Origin: *，浏览器可直连。
//
// 主机顺序有讲究：stream.binance.com 在部分地区返回 451，而官方的 *.binance.vision
// 是专门给行情数据用的公共域名，所以放在最前面。全部失败时改成每 2 秒 REST 轮询最后两根 K 线。

export type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export const INTERVALS: Interval[] = ["1m", "5m", "15m", "1h", "4h", "1d"];

export interface Candle {
  time: number; // 秒级 UTC 时间戳（lightweight-charts 的 UTCTimestamp）
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // 基础币成交量
  closed: boolean; // 这根 K 线是否已收盘
}

export interface Ticker24h {
  last: number;
  change: number;
  changePct: number;
  high: number;
  low: number;
  volume: number; // 基础币
  quoteVolume: number; // 计价币
}

// 实时源状态：loading（拉历史）→ ws（WS 推送）/ poll（REST 轮询兜底）/ error（都不行）
export type FeedStatus = "loading" | "ws" | "poll" | "error";

export const REST_HOSTS = ["https://data-api.binance.vision", "https://api.binance.com", "https://api1.binance.com"];
export const WS_HOSTS = ["wss://data-stream.binance.vision/ws", "wss://stream.binance.com:9443/ws", "wss://stream.binance.com:443/ws"];

type FetchLike = (input: string) => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>;

export interface RestOptions {
  hosts?: string[];
  fetchFn?: FetchLike;
}

// ---------- 解析 ----------

// REST /api/v3/klines 的一行：[openTime, open, high, low, close, volume, closeTime, ...]
export function parseRestKline(row: unknown[]): Candle {
  const r = row as [number, string, string, string, string, string, number];
  return {
    time: Math.floor(r[0] / 1000),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
    closed: true,
  };
}

// WS <symbol>@kline_<interval> 推送：{ e:"kline", k:{ t,o,h,l,c,v,x } }
export function parseWsKline(msg: unknown): Candle | null {
  if (!msg || typeof msg !== "object") return null;
  const m = msg as { e?: string; k?: { t: number; o: string; h: string; l: string; c: string; v: string; x: boolean } };
  if (m.e !== "kline" || !m.k) return null;
  const k = m.k;
  return {
    time: Math.floor(k.t / 1000),
    open: Number(k.o),
    high: Number(k.h),
    low: Number(k.l),
    close: Number(k.c),
    volume: Number(k.v),
    closed: !!k.x,
  };
}

// 把一根（可能还在更新中的）K 线合并进列表：同 time 替换、更新的追加、更旧的忽略。
export function upsertCandle(list: Candle[], c: Candle, max = 1500): Candle[] {
  const last = list[list.length - 1];
  if (!last) return [c];
  if (c.time === last.time) return [...list.slice(0, -1), c];
  if (c.time < last.time) return list;
  const out = [...list, c];
  return out.length > max ? out.slice(out.length - max) : out;
}

// ---------- REST ----------

async function getJson<T>(path: string, opts: RestOptions): Promise<T> {
  const hosts = opts.hosts ?? REST_HOSTS;
  const fetchFn: FetchLike = opts.fetchFn ?? ((u) => fetch(u));
  let lastErr: unknown = new Error("no hosts");
  for (const host of hosts) {
    try {
      const res = await fetchFn(`${host}${path}`);
      if (!res.ok) throw new Error(`HTTP ${res.status ?? "?"} from ${host}`);
      return (await res.json()) as T;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function fetchKlines(symbol: string, interval: Interval, limit = 500, opts: RestOptions = {}): Promise<Candle[]> {
  const rows = await getJson<unknown[][]>(`/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, opts);
  return rows.map(parseRestKline);
}

export async function fetchTicker24h(symbol: string, opts: RestOptions = {}): Promise<Ticker24h> {
  const t = await getJson<Record<string, string>>(`/api/v3/ticker/24hr?symbol=${symbol}`, opts);
  return {
    last: Number(t.lastPrice),
    change: Number(t.priceChange),
    changePct: Number(t.priceChangePercent),
    high: Number(t.highPrice),
    low: Number(t.lowPrice),
    volume: Number(t.volume),
    quoteVolume: Number(t.quoteVolume),
  };
}

// ---------- 实时 ----------

export interface SubscribeOptions {
  wsHosts?: string[];
  wsTimeoutMs?: number; // 连上后多久没收到第一条消息就换下一个主机
  pollMs?: number;
  rest?: RestOptions;
}

/** 订阅某个周期的实时 K 线。返回取消函数。
 *  策略：按 wsHosts 顺序尝试 WS；某个主机连上并收到过消息后断线 → 2s 后重连同一主机；
 *  某个主机一条消息都没收到就失败 → 换下一个；全部失败 → REST 轮询最近两根 K 线。 */
export function subscribeKline(
  symbol: string,
  interval: Interval,
  handlers: { onCandle: (c: Candle) => void; onStatus: (s: FeedStatus) => void },
  opts: SubscribeOptions = {},
): () => void {
  const wsHosts = opts.wsHosts ?? WS_HOSTS;
  const wsTimeoutMs = opts.wsTimeoutMs ?? 6000;
  const pollMs = opts.pollMs ?? 2000;

  let stopped = false;
  let sock: WebSocket | null = null;
  let hostIdx = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function tryWs() {
    if (stopped) return;
    if (hostIdx >= wsHosts.length || typeof WebSocket === "undefined") {
      startPoll();
      return;
    }
    const url = `${wsHosts[hostIdx]}/${symbol.toLowerCase()}@kline_${interval}`;
    let gotMessage = false;
    const ws = new WebSocket(url);
    sock = ws;
    const giveUp = setTimeout(() => {
      if (!gotMessage) ws.close();
    }, wsTimeoutMs);

    ws.onmessage = (ev) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      const c = parseWsKline(parsed);
      if (!c) return;
      if (!gotMessage) {
        gotMessage = true;
        clearTimeout(giveUp);
        handlers.onStatus("ws");
      }
      handlers.onCandle(c);
    };
    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearTimeout(giveUp);
      if (stopped) return;
      if (gotMessage) {
        timer = setTimeout(tryWs, 2000); // 之前能用，大概率是网络抖动，重连同一主机
      } else {
        hostIdx += 1; // 这个主机不行（451 / 超时），换下一个
        tryWs();
      }
    };
  }

  function startPoll() {
    handlers.onStatus("poll");
    const tick = async () => {
      if (stopped) return;
      try {
        const last2 = await fetchKlines(symbol, interval, 2, opts.rest);
        for (const c of last2) handlers.onCandle({ ...c, closed: c !== last2[last2.length - 1] });
        handlers.onStatus("poll");
      } catch {
        handlers.onStatus("error");
      }
      if (!stopped) timer = setTimeout(tick, pollMs);
    };
    tick();
  }

  tryWs();

  return () => {
    stopped = true;
    clearTimeout(timer);
    sock?.close();
  };
}
