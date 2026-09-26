// 最近成交（本所撮合）：最多 30 条，买方主动成交绿色、卖方主动成交红色。
import type { Trade } from "../lib/api";
import { fmtFixed, fmtNum, fmtTime } from "../lib/format";

export function Trades({ trades }: { trades: Trade[] }) {
  return (
    <div className="panel trades-panel">
      <div className="panel-bar">
        <span className="panel-title">最近成交</span>
      </div>
      <div className="ob-head">
        <span>价格 (USDC)</span>
        <span>数量 (WAVAX)</span>
        <span>时间</span>
      </div>
      <div className="trade-list">
        {trades.slice(0, 30).map((t) => (
          <div key={t.id} className={`trade-row ${t.side}`}>
            <span className="price">{fmtFixed(t.price, 4)}</span>
            <span>{fmtNum(t.qty, 4)}</span>
            <span className="muted">{fmtTime(t.ts)}</span>
          </div>
        ))}
        {trades.length === 0 && <div className="muted center">暂无成交</div>}
      </div>
    </div>
  );
}
