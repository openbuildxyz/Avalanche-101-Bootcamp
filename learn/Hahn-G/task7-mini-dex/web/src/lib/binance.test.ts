// Binance 行情源的纯函数单测：REST/WS 两种 K 线格式的解析、K 线合并、REST 主机故障切换。
import { describe, expect, it, vi } from "vitest";
import {
  fetchKlines,
  fetchTicker24h,
  parseRestKline,
  parseWsKline,
  upsertCandle,
  type Candle,
} from "./binance";

const restRow = [
  1787395380000, // open time (ms)
  "7.52000000",
  "7.52600000",
  "7.52000000",
  "7.52600000",
  "213.61000000", // volume
  1787395439999,
  "1606.47931000",
  36,
  "20.44000000",
  "153.79063000",
  "0",
];

describe("parseRestKline", () => {
  it("把 REST 数组行转成秒级时间戳 + 数字 OHLCV", () => {
    expect(parseRestKline(restRow)).toEqual({
      time: 1787395380,
      open: 7.52,
      high: 7.526,
      low: 7.52,
      close: 7.526,
      volume: 213.61,
      closed: true,
    });
  });
});

describe("parseWsKline", () => {
  it("解析 kline 推送，x 字段表示这根 K 线是否已收盘", () => {
    const msg = {
      e: "kline",
      s: "AVAXUSDT",
      k: { t: 1787395440000, o: "7.52", h: "7.53", l: "7.51", c: "7.525", v: "10.5", x: false },
    };
    expect(parseWsKline(msg)).toEqual({
      time: 1787395440,
      open: 7.52,
      high: 7.53,
      low: 7.51,
      close: 7.525,
      volume: 10.5,
      closed: false,
    });
  });

  it("不是 kline 事件返回 null", () => {
    expect(parseWsKline({ e: "trade" })).toBeNull();
    expect(parseWsKline(null)).toBeNull();
  });
});

describe("upsertCandle", () => {
  const c = (time: number, close = 1): Candle => ({ time, open: 1, high: 1, low: 1, close, volume: 0, closed: false });

  it("同一根 K 线（time 相同）原地替换", () => {
    const out = upsertCandle([c(10), c(20, 1)], c(20, 2));
    expect(out.map((x) => [x.time, x.close])).toEqual([
      [10, 1],
      [20, 2],
    ]);
  });

  it("更新的 K 线追加到末尾，并按 max 截断前面的", () => {
    const out = upsertCandle([c(10), c(20)], c(30), 2);
    expect(out.map((x) => x.time)).toEqual([20, 30]);
  });

  it("比最后一根还旧的 K 线直接忽略（乱序推送）", () => {
    const list = [c(10), c(20)];
    expect(upsertCandle(list, c(15))).toBe(list);
  });

  it("空列表直接放进去", () => {
    expect(upsertCandle([], c(10))).toEqual([c(10)]);
  });
});

describe("fetchKlines 主机故障切换", () => {
  it("第一个主机失败时换下一个，并带上 symbol/interval/limit", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("blocked"))
      .mockResolvedValueOnce({ ok: true, json: async () => [restRow] });

    const out = await fetchKlines("AVAXUSDT", "1m", 1, { hosts: ["https://a", "https://b"], fetchFn });

    expect(out).toHaveLength(1);
    expect(out[0].time).toBe(1787395380);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(String(fetchFn.mock.calls[1][0])).toBe("https://b/api/v3/klines?symbol=AVAXUSDT&interval=1m&limit=1");
  });

  it("非 2xx 也算失败，全部失败抛最后一个错误", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 451, json: async () => ({}) });
    await expect(fetchKlines("AVAXUSDT", "1m", 1, { hosts: ["https://a", "https://b"], fetchFn })).rejects.toThrow(/451/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});

describe("fetchTicker24h", () => {
  it("把字符串字段转成数字", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        lastPrice: "7.527",
        priceChange: "-0.04",
        priceChangePercent: "-0.529",
        highPrice: "8.317",
        lowPrice: "7.0",
        volume: "7302059.27",
        quoteVolume: "56173000.1",
      }),
    });
    const t = await fetchTicker24h("AVAXUSDT", { hosts: ["https://a"], fetchFn });
    expect(t).toEqual({
      last: 7.527,
      change: -0.04,
      changePct: -0.529,
      high: 8.317,
      low: 7,
      volume: 7302059.27,
      quoteVolume: 56173000.1,
    });
    expect(String(fetchFn.mock.calls[0][0])).toBe("https://a/api/v3/ticker/24hr?symbol=AVAXUSDT");
  });
});
