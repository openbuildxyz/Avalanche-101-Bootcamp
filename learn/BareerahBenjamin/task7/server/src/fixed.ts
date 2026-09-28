// 8 位小数定点数工具。
// 内部所有价格/数量都是 bigint，单位 = 1e-8（和 Primit 的 PriceLevel(i64) = price×1e8 一样）。
// API 对外一律用十进制字符串，如 "100.5" <-> 10050000000n。
// 为什么不用 number？因为 0.1 + 0.2 !== 0.3，做账本不能有浮点误差。

export const DECIMALS = 8;
export const ONE = 10n ** BigInt(DECIMALS); // 1e8

/** "100.5" -> 10050000000n；多余小数位直接截断 */
export function parseFixed(s: string): bigint {
  const str = String(s).trim();
  if (!/^\d+(\.\d+)?$/.test(str)) throw new Error(`非法数字: ${s}`);
  const [intPart, fracPart = ""] = str.split(".");
  const frac = (fracPart + "0".repeat(DECIMALS)).slice(0, DECIMALS);
  return BigInt(intPart) * ONE + BigInt(frac);
}

/** 10050000000n -> "100.5"（去掉末尾多余的 0） */
export function formatFixed(v: bigint): string {
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const intPart = abs / ONE;
  const frac = (abs % ONE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return (neg ? "-" : "") + intPart.toString() + (frac ? "." + frac : "");
}

/** 定点数相乘：price × qty -> 金额（都是 1e8 精度，所以要除一次 ONE） */
export function mulFixed(a: bigint, b: bigint): bigint {
  return (a * b) / ONE;
}

/** 8 位定点 -> 代币最小单位（USDC 6 位 / WAVAX 18 位） */
export function fixedToWei(v: bigint, tokenDecimals: number): bigint {
  if (tokenDecimals >= DECIMALS) return v * 10n ** BigInt(tokenDecimals - DECIMALS);
  return v / 10n ** BigInt(DECIMALS - tokenDecimals);
}

/** 代币最小单位 -> 8 位定点 */
export function weiToFixed(v: bigint, tokenDecimals: number): bigint {
  if (tokenDecimals >= DECIMALS) return v / 10n ** BigInt(tokenDecimals - DECIMALS);
  return v * 10n ** BigInt(DECIMALS - tokenDecimals);
}
