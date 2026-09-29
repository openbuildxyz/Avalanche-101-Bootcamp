// 小工具：地址缩写、数字/时间格式化、错误信息提取。
import { formatUnits, parseUnits } from "viem";
import type { TokenSymbol } from "./api";

// spec §3.1：USDC 6 位小数，WAVAX 18 位小数
export const TOKEN_DECIMALS: Record<TokenSymbol, number> = { USDC: 6, WAVAX: 18 };

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function fmtNum(value: string | number | undefined | null, maxDp = 4): string {
  if (value === undefined || value === null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: maxDp });
}

export function fmtWei(value: bigint | undefined, decimals: number, maxDp = 4): string {
  if (value === undefined) return "-";
  return fmtNum(formatUnits(value, decimals), maxDp);
}

// 十进制字符串 → wei；非法输入返回 null
export function toWei(value: string, decimals: number): bigint | null {
  if (!value || !/^\d*\.?\d*$/.test(value)) return null;
  try {
    const wei = parseUnits(value, decimals);
    return wei > 0n ? wei : null;
  } catch {
    return null;
  }
}

export function fmtTime(ts: number): string {
  const ms = ts < 1e12 ? ts * 1000 : ts; // 兼容秒 / 毫秒
  return new Date(ms).toLocaleTimeString("zh-CN", { hour12: false });
}

// viem 的错误有 shortMessage（比如"User rejected the request"），优先用它
export function errorMessage(e: unknown): string {
  if (e && typeof e === "object") {
    if ("shortMessage" in e && typeof e.shortMessage === "string") return e.shortMessage;
    if ("message" in e && typeof e.message === "string") return e.message;
  }
  return String(e);
}

// 带符号的百分比："+1.23%" / "-0.50%"
export function fmtPct(pct: number, dp = 2): string {
  if (!Number.isFinite(pct)) return "-";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(dp)}%`;
}

// 大数压缩：1234567 → "1.23M"
export function fmtCompact(n: number): string {
  if (!Number.isFinite(n)) return "-";
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  return n.toFixed(2);
}

// 按价格量级决定显示小数位：< 1 → 5 位，< 100 → 3 位，否则 2 位
export function pricePrecision(price: number): number {
  if (price < 1) return 5;
  if (price < 100) return 3;
  return 2;
}

// 固定小数位（价格展示用，不丢尾随 0）："7.000"
export function fmtFixed(value: string | number | undefined | null, dp: number): string {
  if (value === undefined || value === null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}
