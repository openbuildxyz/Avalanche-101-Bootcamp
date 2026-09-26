// 账本测试：冻结/解冻/划转 的守恒，以及余额不足要抛错。
import { describe, it, expect } from "vitest";
import { Ledger } from "./ledger.js";

describe("Ledger", () => {
  it("地址大小写视为同一账户", () => {
    const l = new Ledger();
    l.credit("0xABC", "USDC", 100n);
    expect(l.get("0xabc").USDC.available).toBe(100n);
  });
  it("lock / unlock / transferLocked 守恒", () => {
    const l = new Ledger();
    l.credit("a", "USDC", 100n);
    l.lock("a", "USDC", 60n);
    expect(l.get("a").USDC).toEqual({ available: 40n, locked: 60n });
    l.transferLocked("a", "b", "USDC", 50n);
    expect(l.get("a").USDC).toEqual({ available: 40n, locked: 10n });
    expect(l.get("b").USDC).toEqual({ available: 50n, locked: 0n });
    l.unlock("a", "USDC", 10n);
    expect(l.get("a").USDC).toEqual({ available: 50n, locked: 0n });
  });
  it("余额不足抛错", () => {
    const l = new Ledger();
    expect(() => l.lock("a", "WAVAX", 1n)).toThrow(/余额不足/);
    expect(() => l.unlock("a", "WAVAX", 1n)).toThrow(/冻结不足/);
    expect(() => l.debit("a", "WAVAX", 1n)).toThrow(/余额不足/);
    expect(() => l.credit("a", "WAVAX", 0n)).toThrow();
  });
});
