// 定点数工具的测试：确保 "100.5" 这种字符串和 bigint 之间来回转换不丢精度。
import { describe, it, expect } from "vitest";
import { parseFixed, formatFixed, mulFixed, fixedToWei, weiToFixed } from "./fixed.js";

describe("fixed", () => {
  it("parse / format 往返", () => {
    expect(parseFixed("100.5")).toBe(10050000000n);
    expect(parseFixed("0.00000001")).toBe(1n);
    expect(parseFixed("7")).toBe(700000000n);
    expect(formatFixed(10050000000n)).toBe("100.5");
    expect(formatFixed(0n)).toBe("0");
    expect(formatFixed(1n)).toBe("0.00000001");
    expect(parseFixed("1.123456789")).toBe(112345678n); // 第 9 位截断
  });
  it("非法输入抛错", () => {
    expect(() => parseFixed("-1")).toThrow();
    expect(() => parseFixed("abc")).toThrow();
    expect(() => parseFixed("")).toThrow();
  });
  it("mulFixed：price × qty", () => {
    expect(mulFixed(parseFixed("100"), parseFixed("2.5"))).toBe(parseFixed("250"));
  });
  it("wei 换算：USDC 6 位 / WAVAX 18 位", () => {
    expect(fixedToWei(parseFixed("1"), 6)).toBe(1_000_000n);
    expect(fixedToWei(parseFixed("1"), 18)).toBe(10n ** 18n);
    expect(weiToFixed(1_500_000n, 6)).toBe(parseFixed("1.5"));
    expect(weiToFixed(10n ** 18n, 18)).toBe(parseFixed("1"));
  });
});
