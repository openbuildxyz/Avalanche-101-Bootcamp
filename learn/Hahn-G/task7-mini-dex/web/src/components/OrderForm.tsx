// 下单表单：buy/sell、limit/market、价格、数量 → POST /orders，显示成交笔数。
// 显示可用余额，25/50/75/100% 按可用余额快速填数量；价格为空时给出 Binance 参考价。
// 没登录时整个表单禁用。
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Balances, type OrderType, type PlaceOrderBody, type Side } from "../lib/api";
import { errorMessage, fmtFixed, fmtNum, pricePrecision } from "../lib/format";

const PCTS = [25, 50, 75, 100];

interface Props {
  token: string | null;
  pickedPrice: string;
  balances: Balances | null;
  refPrice: number | null; // Binance 最新价
}

export function OrderForm({ token, pickedPrice, balances, refPrice }: Props) {
  const queryClient = useQueryClient();
  const [side, setSide] = useState<Side>("buy");
  const [type, setType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [qty, setQty] = useState("");

  // 订单簿上点了价格 → 填进来
  useEffect(() => {
    if (pickedPrice) setPrice(pickedPrice);
  }, [pickedPrice]);

  const place = useMutation({
    mutationFn: (body: PlaceOrderBody) => api.placeOrder(token!, body),
    onSuccess: () => {
      // 下单后我的挂单和余额都会变，让 react-query 重新拉
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["balances"] });
    },
  });

  const availUsdc = Number(balances?.USDC?.available ?? 0);
  const availWavax = Number(balances?.WAVAX?.available ?? 0);
  // 市价买单没有价格，用 Binance 参考价估算能买多少
  const effPrice = type === "limit" ? Number(price) : (refPrice ?? 0);

  function fillPct(pct: number) {
    if (side === "sell") {
      setQty(trim(availWavax * (pct / 100)));
    } else if (effPrice > 0) {
      setQty(trim((availUsdc * (pct / 100)) / effPrice));
    }
  }

  const priceOk = type === "market" || Number(price) > 0;
  const qtyOk = Number(qty) > 0;
  const disabled = !token || !priceOk || !qtyOk || place.isPending;

  function submit() {
    const body: PlaceOrderBody = { side, type, qty };
    if (type === "limit") body.price = price;
    place.mutate(body);
  }

  const result = place.data;
  const cost = effPrice * Number(qty);

  return (
    <div className="panel form-panel">
      <div className="seg tabs">
        <button className={`seg-btn buy ${side === "buy" ? "on" : ""}`} onClick={() => setSide("buy")}>
          买入
        </button>
        <button className={`seg-btn sell ${side === "sell" ? "on" : ""}`} onClick={() => setSide("sell")}>
          卖出
        </button>
      </div>

      <div className="form-body">
        <div className="row between">
          <div className="seg small inline">
            <button className={`seg-btn ${type === "limit" ? "on" : ""}`} onClick={() => setType("limit")}>
              限价
            </button>
            <button className={`seg-btn ${type === "market" ? "on" : ""}`} onClick={() => setType("market")}>
              市价
            </button>
          </div>
          <span className="muted small">
            可用 {side === "buy" ? `${fmtNum(availUsdc, 2)} USDC` : `${fmtNum(availWavax, 4)} WAVAX`}
          </span>
        </div>

        <label className="field">
          <span className="row between">
            价格 (USDC)
            {type === "limit" && refPrice !== null && (
              <button className="link" onClick={(e) => { e.preventDefault(); setPrice(String(refPrice)); }}>
                参考价 {fmtFixed(refPrice, pricePrecision(refPrice))}
              </button>
            )}
          </span>
          <input
            className="input"
            placeholder={type === "market" ? "市价单按簿上最优价成交" : refPrice !== null ? String(refPrice) : "0.00"}
            value={type === "market" ? "" : price}
            disabled={type === "market"}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>

        <label className="field">
          <span>数量 (WAVAX)</span>
          <input className="input" placeholder="0.00" value={qty} onChange={(e) => setQty(e.target.value)} />
        </label>

        <div className="pct-row">
          {PCTS.map((p) => (
            <button key={p} className="pct" disabled={!token} onClick={() => fillPct(p)}>
              {p}%
            </button>
          ))}
        </div>

        <div className="row between muted small">
          <span>{type === "market" && side === "buy" ? "预估总额（按参考价）" : side === "buy" ? "冻结总额" : "预计成交额"}</span>
          <span>{cost > 0 ? `${fmtNum(cost, 2)} USDC` : "—"}</span>
        </div>

        <button className={`btn block ${side}`} disabled={disabled} onClick={submit}>
          {!token ? "请先登录" : place.isPending ? "提交中…" : side === "buy" ? "买入 WAVAX" : "卖出 WAVAX"}
        </button>

        {result && (
          <div className="msg ok">
            成交 {result.fills.length} 笔
            {result.fills.length > 0 && <>，均价 {fmtNum(avgPrice(result.fills), 4)}</>}
            {Number(result.order.remaining) > 0 && result.order.type === "limit" && (
              <>；剩余 {fmtNum(result.order.remaining, 4)} 已挂单</>
            )}
            {result.fills.length === 0 && result.order.type === "market" && <>（簿上没有流动性）</>}
          </div>
        )}
        {place.error && <div className="msg err">{errorMessage(place.error)}</div>}
      </div>
    </div>
  );
}

// 数量最多留 4 位小数，去掉尾随 0
function trim(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  return String(Math.floor(n * 1e4) / 1e4);
}

function avgPrice(fills: { price: string; qty: string }[]): number {
  let notional = 0;
  let qty = 0;
  for (const f of fills) {
    notional += Number(f.price) * Number(f.qty);
    qty += Number(f.qty);
  }
  return qty > 0 ? notional / qty : 0;
}
