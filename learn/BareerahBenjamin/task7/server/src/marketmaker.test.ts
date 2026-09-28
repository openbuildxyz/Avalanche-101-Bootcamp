// 做市模块的纯函数单测：深度缩放、增量挂撤计划、按余额裁剪、REST 主机故障切换。
import { describe, expect, it, vi } from "vitest";
import { capByBalance, fetchDepth, planQuotes, scaleDepth, type Quote } from "./marketmaker.js";
import { parseFixed } from "./fixed.js";
import type { Order } from "./engine/orderbook.js";

const P = parseFixed;

describe("scaleDepth", () => {
  it("取前 N 档、数量乘 scale、夹在 [minQty, maxQty]，价格保留 4 位小数", () => {
    const out = scaleDepth(
      [
        ["7.52700000", "336.99000000"],
        ["7.52600000", "1.00000000"],
        ["7.52500000", "100000.00000000"],
        ["7.52400000", "50.00000000"],
      ],
      { levels: 3, scale: 0.1, minQty: 0.5, maxQty: 200 },
    );
    expect(out).toEqual([
      ["7.527", "33.699"],
      ["7.526", "0.5"], // 0.1 < minQty → 抬到 minQty
      ["7.525", "200"], // 10000 > maxQty → 压到 maxQty
    ]);
  });

  it("空深度返回空", () => {
    expect(scaleDepth([], { levels: 5, scale: 1, minQty: 0, maxQty: 1 })).toEqual([]);
  });
});

function order(partial: Partial<Order> & { side: Order["side"]; price: bigint; remaining: bigint }): Order {
  return { id: partial.id ?? `${partial.side}-${partial.price}`, owner: "mm", type: "limit", qty: partial.remaining, ts: 0, seq: 0, ...partial };
}

describe("planQuotes", () => {
  const targets: Quote[] = [
    { side: "buy", price: P("7.5"), qty: P("10") },
    { side: "buy", price: P("7.49"), qty: P("20") },
    { side: "sell", price: P("7.51"), qty: P("10") },
  ];

  it("空簿 → 全部新挂", () => {
    const plan = planQuotes(targets, []);
    expect(plan.cancel).toEqual([]);
    expect(plan.place).toEqual(targets);
  });

  it("价格、数量都对上的单保留；不在目标里的撤掉；缺的补挂", () => {
    const keep = order({ side: "buy", price: P("7.5"), remaining: P("10") });
    const stale = order({ side: "sell", price: P("7.6"), remaining: P("5") });
    const plan = planQuotes(targets, [keep, stale]);
    expect(plan.cancel).toEqual([stale]);
    expect(plan.place).toEqual([targets[1], targets[2]]);
  });

  it("同价但剩余量偏差超过 tolerance（部分成交）→ 撤掉重挂", () => {
    const partly = order({ side: "sell", price: P("7.51"), remaining: P("3") }); // 目标 10，剩 3
    const plan = planQuotes([targets[2]], [partly], 0.2);
    expect(plan.cancel).toEqual([partly]);
    expect(plan.place).toEqual([targets[2]]);
  });

  it("偏差在 tolerance 内不动", () => {
    const near = order({ side: "sell", price: P("7.51"), remaining: P("9") }); // 10% 偏差
    const plan = planQuotes([targets[2]], [near], 0.2);
    expect(plan.cancel).toEqual([]);
    expect(plan.place).toEqual([]);
  });

  it("同价重复挂单只留一张", () => {
    const a = order({ id: "a", side: "buy", price: P("7.5"), remaining: P("10") });
    const b = order({ id: "b", side: "buy", price: P("7.5"), remaining: P("10") });
    const plan = planQuotes([targets[0]], [a, b]);
    expect(plan.cancel).toEqual([b]);
    expect(plan.place).toEqual([]);
  });
});

describe("capByBalance", () => {
  it("买单按 USDC 累计成本截断，卖单按 WAVAX 累计数量截断，太小的丢弃", () => {
    const quotes: Quote[] = [
      { side: "buy", price: P("10"), qty: P("5") }, // 50 USDC
      { side: "buy", price: P("9"), qty: P("10") }, // 90 USDC → 只剩 40 → 4.4444 → 截成 4.4444
      { side: "buy", price: P("8"), qty: P("1") }, // 没钱了 → 丢
      { side: "sell", price: P("11"), qty: P("3") },
      { side: "sell", price: P("12"), qty: P("3") }, // 只剩 0.5 → 0.5 ≥ minQty 保留
      { side: "sell", price: P("13"), qty: P("3") }, // 丢
    ];
    const out = capByBalance(quotes, { USDC: P("90"), WAVAX: P("3.5") }, P("0.1"));
    expect(out.map((q) => [q.side, q.price.toString(), q.qty.toString()])).toEqual([
      ["buy", P("10").toString(), P("5").toString()],
      ["buy", P("9").toString(), P("4.4444").toString()],
      ["sell", P("11").toString(), P("3").toString()],
      ["sell", P("12").toString(), P("0.5").toString()],
    ]);
  });
});

describe("fetchDepth", () => {
  it("第一个主机失败换下一个，解析 bids/asks", async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("451"))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ bids: [["7.5", "1"]], asks: [["7.6", "2"]] }) });
    const d = await fetchDepth("AVAXUSDT", 5, { hosts: ["https://a", "https://b"], fetchFn });
    expect(d).toEqual({ bids: [["7.5", "1"]], asks: [["7.6", "2"]] });
    expect(String(fetchFn.mock.calls[1][0])).toBe("https://b/api/v3/depth?symbol=AVAXUSDT&limit=5");
  });
});
