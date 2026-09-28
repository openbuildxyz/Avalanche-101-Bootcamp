import { describe, expect, it, vi } from "vitest";
import { OrderBook } from "./engine/orderbook.js";
import { parseFixed as F } from "./fixed.js";
import { Ledger } from "./ledger.js";
import { createRoutes } from "./routes.js";
import type { Chain } from "./chain.js";

describe("placeOrder self-trade prevention", () => {
  it("在冻结资金前拒绝，账本与原挂单保持不变", () => {
    const ledger = new Ledger();
    const book = new OrderBook();
    const owner = "0xalice";
    ledger.credit(owner, "USDC", F("100"));
    ledger.credit(owner, "WAVAX", F("1"));

    const routes = createRoutes({
      ledger,
      book,
      chain: { offline: true } as Chain,
      ws: { broadcast: vi.fn(), sendBalance: vi.fn() },
      bearer: async (_c, next) => next(),
      config: { chainId: 31337, wsUrl: "ws://localhost", vault: "", usdc: "", wavax: "" },
    });

    const maker = routes.placeOrder(owner, { side: "sell", type: "limit", price: F("10"), qty: F("1") }).order;
    expect(() => routes.placeOrder(owner, { side: "buy", type: "limit", price: F("10"), qty: F("1") })).toThrow(/self-trade/);

    expect(book.get(maker.id)?.remaining).toBe(F("1"));
    expect(ledger.get(owner)).toEqual({
      USDC: { available: F("100"), locked: 0n },
      WAVAX: { available: 0n, locked: F("1") },
    });
  });
});
