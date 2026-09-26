// 行情条：交易对 + 最新价 + 24h 涨跌/高低/量，价格来自 Binance；右侧标注行情源状态。
import type { FeedStatus, Ticker24h } from "../lib/binance";
import type { Trade } from "../lib/api";
import { fmtCompact, fmtFixed, fmtPct, pricePrecision } from "../lib/format";
import { FEED_LABEL } from "./Chart";

interface Props {
  pair: string; // 本所交易对名，如 WAVAX/USDC
  chainLabel: string;
  symbol: string; // Binance 交易对
  lastPrice: number | null; // 最新一根 K 线的收盘价（比 24h ticker 更实时）
  ticker: Ticker24h | undefined;
  status: FeedStatus;
  dexLast: Trade | null; // 本所最近一笔成交
}

export function TickerBar({ pair, chainLabel, symbol, lastPrice, ticker, status, dexLast }: Props) {
  const price = lastPrice ?? ticker?.last ?? null;
  const precision = price ? pricePrecision(price) : 2;
  const dir = (ticker?.changePct ?? 0) >= 0 ? "up" : "down";
  const [base, quote] = pair.split("/");

  return (
    <div className="ticker">
      <div className="ticker-pair">
        <div className="ticker-name">
          <b>{pair}</b>
          <span className="muted">{chainLabel} · 永续合约</span>
        </div>
      </div>

      <div className="ticker-price">
        <div className={`ticker-last ${dir}`}>{price !== null ? fmtFixed(price, precision) : "—"}</div>
        <div className="muted small">≈ {price !== null ? fmtFixed(price, 2) : "—"} {quote}</div>
      </div>

      <Stat label="24h 涨跌" value={ticker ? `${fmtFixed(ticker.change, precision)} ${fmtPct(ticker.changePct)}` : "—"} cls={dir} />
      <Stat label="24h 最高" value={ticker ? fmtFixed(ticker.high, precision) : "—"} />
      <Stat label="24h 最低" value={ticker ? fmtFixed(ticker.low, precision) : "—"} />
      <Stat label={`24h 成交量 (${base === "WAVAX" ? "AVAX" : base})`} value={ticker ? fmtCompact(ticker.volume) : "—"} />
      <Stat label="24h 成交额 (USDT)" value={ticker ? fmtCompact(ticker.quoteVolume) : "—"} />
      <Stat label="本所最新成交" value={dexLast ? fmtFixed(dexLast.price, 4) : "—"} cls={dexLast ? dexLast.side : ""} />

      <div className="ticker-source">
        <span className={`chip feed ${status}`}>
          <i className="dot" /> 价格源 Binance {symbol} · {FEED_LABEL[status]}
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="ticker-stat">
      <span className="muted">{label}</span>
      <span className={cls}>{value}</span>
    </div>
  );
}
