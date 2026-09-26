// 订单簿：上半 asks（红，最低卖价贴着中间），中间最新成交价 + Binance 参考价，下半 bids（绿）。
// 深度条按"累计数量"铺，和真实交易所一致；点任一档价格填到下单表单。
import type { Level, OrderBookSnapshot, Trade } from "../lib/api";
import { fmtFixed, fmtNum, pricePrecision } from "../lib/format";

const DEPTH = 12;

interface Props {
  book: OrderBookSnapshot | null;
  lastTrade: Trade | null;
  prevTrade: Trade | null;
  refPrice: number | null; // Binance 最新价，作为参考
  liquidity?: string | null; // 流动性来源说明（后端开启做市时显示）
  onPickPrice: (price: string) => void;
}

interface Row {
  price: string;
  qty: string;
  cum: number; // 从中间往外累计的数量
}

export function OrderBook({ book, lastTrade, prevTrade, refPrice, liquidity, onPickPrice }: Props) {
  const asks = accumulate((book?.asks ?? []).slice(0, DEPTH));
  const bids = accumulate((book?.bids ?? []).slice(0, DEPTH));
  const maxCum = Math.max(1e-9, asks[asks.length - 1]?.cum ?? 0, bids[bids.length - 1]?.cum ?? 0);

  const bestAsk = asks[0] ? Number(asks[0].price) : null;
  const bestBid = bids[0] ? Number(bids[0].price) : null;
  const spread = bestAsk !== null && bestBid !== null ? bestAsk - bestBid : null;

  const last = lastTrade ? Number(lastTrade.price) : null;
  const prev = prevTrade ? Number(prevTrade.price) : null;
  const lastDir = last !== null && prev !== null ? (last > prev ? "up" : last < prev ? "down" : "") : "";

  return (
    <div className="panel ob-panel">
      <div className="panel-bar">
        <span className="panel-title">订单簿</span>
        {liquidity && (
          <span className="chip" title="做市账户持续把外部市场的盘口镜像到本所订单簿">
            <i className="dot" /> {liquidity}
          </span>
        )}
      </div>
      <div className="ob-head">
        <span>价格 (USDC)</span>
        <span>数量 (WAVAX)</span>
        <span>累计</span>
      </div>

      {/* asks 倒着画：最低卖价贴着中间 */}
      <div className="ob-side asks">
        {asks.length === 0 && <div className="muted center">无卖单</div>}
        {[...asks].reverse().map((r) => (
          <ObRow key={`a-${r.price}`} row={r} side="ask" maxCum={maxCum} onPick={onPickPrice} />
        ))}
      </div>

      <div className="ob-mid" onClick={() => last !== null && onPickPrice(String(last))} title="本所最新成交价，点击填入">
        <span className={`ob-last ${lastDir || (lastTrade?.side ?? "")}`}>
          {last !== null ? fmtFixed(last, 4) : "—"}
          {lastDir === "up" && " ▲"}
          {lastDir === "down" && " ▼"}
        </span>
        <span className="muted small">
          {refPrice !== null ? `≈ Binance ${fmtFixed(refPrice, pricePrecision(refPrice))}` : "Binance —"}
          {spread !== null && ` · 价差 ${fmtNum((spread / bestAsk!) * 100, 2)}%`}
        </span>
      </div>

      <div className="ob-side bids">
        {bids.map((r) => (
          <ObRow key={`b-${r.price}`} row={r} side="bid" maxCum={maxCum} onPick={onPickPrice} />
        ))}
        {bids.length === 0 && <div className="muted center">无买单</div>}
      </div>
    </div>
  );
}

function accumulate(levels: Level[]): Row[] {
  let cum = 0;
  return levels.map(([price, qty]) => {
    cum += Number(qty);
    return { price, qty, cum };
  });
}

function ObRow({ row, side, maxCum, onPick }: { row: Row; side: "ask" | "bid"; maxCum: number; onPick: (p: string) => void }) {
  const width = Math.min(100, (row.cum / maxCum) * 100);
  return (
    <div className={`ob-row ${side}`} onClick={() => onPick(row.price)} title="点击填入价格">
      <span className="ob-bar" style={{ width: `${width}%` }} />
      <span className="price">{fmtFixed(row.price, 4)}</span>
      <span>{fmtNum(row.qty, 4)}</span>
      <span className="muted">{fmtNum(row.cum, 4)}</span>
    </div>
  );
}
