// K 线图：lightweight-charts（TradingView 的开源图表库）画蜡烛 + 成交量，数据由 App 从 Binance 取来。
// 历史数据整体 setData；之后每次只 update 最后一根，避免重绘整张图。
import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type UTCTimestamp,
} from "lightweight-charts";
import { INTERVALS, type Candle, type FeedStatus, type Interval } from "../lib/binance";
import { fmtFixed, fmtNum, fmtPct, pricePrecision } from "../lib/format";

const UP = "#0ecb81";
const DOWN = "#f6465d";
const VISIBLE_BARS = 120; // 初次加载显示最近多少根

export const FEED_LABEL: Record<FeedStatus, string> = {
  loading: "加载中…",
  ws: "实时",
  poll: "轮询",
  error: "行情源不可用",
};

interface Props {
  symbol: string; // Binance 交易对，例如 AVAXUSDT
  candles: Candle[];
  status: FeedStatus;
  interval: Interval;
  onIntervalChange: (i: Interval) => void;
}

export function Chart({ symbol, candles, status, interval, onIntervalChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // 记录上一次喂给图表的数据形状，判断这次是整体重设还是只更新最后一根
  const fedRef = useRef({ key: "", len: 0, lastTime: 0 });
  const [hover, setHover] = useState<Candle | null>(null);

  // 建图：只做一次
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#848e9c", fontSize: 11 },
      grid: { vertLines: { color: "#1e2329" }, horzLines: { color: "#1e2329" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "#2b3139" },
      timeScale: { borderColor: "#2b3139", timeVisible: true, secondsVisible: false, rightOffset: 4 },
      localization: { locale: "zh-CN" },
    });
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
    });
    candle.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });
    // 成交量挂在一个独立的隐藏价格轴上，压在底部 20%
    const vol = chart.addSeries(HistogramSeries, { priceFormat: { type: "volume" }, priceScaleId: "" });
    vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const onMove = (p: MouseEventParams) => {
      const d = p.seriesData.get(candle) as CandlestickData<UTCTimestamp> | undefined;
      if (!p.time || !d) {
        setHover(null);
        return;
      }
      const v = p.seriesData.get(vol) as HistogramData<UTCTimestamp> | undefined;
      setHover({ time: p.time as number, open: d.open, high: d.high, low: d.low, close: d.close, volume: v?.value ?? 0, closed: true });
    };
    chart.subscribeCrosshairMove(onMove);

    chartRef.current = chart;
    candleRef.current = candle;
    volRef.current = vol;
    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volRef.current = null;
      fedRef.current = { key: "", len: 0, lastTime: 0 };
    };
  }, []);

  // 喂数据
  useEffect(() => {
    const chart = chartRef.current;
    const candle = candleRef.current;
    const vol = volRef.current;
    if (!chart || !candle || !vol) return;

    const key = `${symbol}:${interval}`;
    const fed = fedRef.current;
    const last = candles[candles.length - 1];

    if (!last) {
      if (fed.key !== key) {
        candle.setData([]);
        vol.setData([]);
        fedRef.current = { key, len: 0, lastTime: 0 };
      }
      return;
    }

    const incremental =
      fed.key === key && fed.len > 0 && candles.length <= fed.len + 1 && last.time >= fed.lastTime;

    if (incremental) {
      candle.update(toBar(last));
      vol.update(toVol(last));
    } else {
      const precision = pricePrecision(last.close);
      candle.applyOptions({ priceFormat: { type: "price", precision, minMove: 10 ** -precision } });
      candle.setData(candles.map(toBar));
      vol.setData(candles.map(toVol));
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, candles.length - VISIBLE_BARS), to: candles.length + 4 });
    }
    fedRef.current = { key, len: candles.length, lastTime: last.time };
  }, [candles, symbol, interval]);

  const shown = hover ?? candles[candles.length - 1] ?? null;
  const precision = shown ? pricePrecision(shown.close) : 2;
  const chg = shown ? (shown.close - shown.open) / shown.open : 0;
  const cls = chg >= 0 ? "up" : "down";

  return (
    <div className="panel chart-panel">
      <div className="panel-bar">
        <div className="chart-symbol">
          <b>{symbol}</b>
          <span className="muted">Binance · 永续合约</span>
        </div>
        <div className="seg inline">
          {INTERVALS.map((i) => (
            <button key={i} className={`seg-btn ${i === interval ? "on" : ""}`} onClick={() => onIntervalChange(i)}>
              {i}
            </button>
          ))}
        </div>
        <span className={`chip feed ${status}`}>
          <i className="dot" /> {FEED_LABEL[status]}
        </span>
      </div>

      <div className="chart-body">
        {shown && (
          <div className={`chart-legend ${cls}`}>
            <span>O <b>{fmtFixed(shown.open, precision)}</b></span>
            <span>H <b>{fmtFixed(shown.high, precision)}</b></span>
            <span>L <b>{fmtFixed(shown.low, precision)}</b></span>
            <span>C <b>{fmtFixed(shown.close, precision)}</b></span>
            <span className={cls}>{fmtPct(chg * 100)}</span>
            <span>Vol <b>{fmtNum(shown.volume, 2)}</b></span>
          </div>
        )}
        <div ref={containerRef} className="chart-canvas" />
        {status === "loading" && candles.length === 0 && <div className="chart-overlay muted">正在从 Binance 拉取 K 线…</div>}
        {status === "error" && candles.length === 0 && (
          <div className="chart-overlay err">连不上 Binance 行情（REST 和 WS 都失败，可能是网络限制）</div>
        )}
      </div>
    </div>
  );
}

function toBar(c: Candle): CandlestickData<UTCTimestamp> {
  return { time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close };
}

function toVol(c: Candle): HistogramData<UTCTimestamp> {
  return { time: c.time as UTCTimestamp, value: c.volume, color: c.close >= c.open ? "rgba(14,203,129,0.35)" : "rgba(246,70,93,0.35)" };
}
