// 页面骨架（仿现货交易所）：顶栏 → 行情条 → [订单簿 | K 线 | 最近成交 + 下单] → 底部 Tab（委托 / 资产）。
// 撮合数据（订单簿 / 成交 / 余额）来自 mini-dex 后端：REST 拉初始值，之后靠 WS 推送，WS 断了退回轮询。
// K 线和行情条的价格来自 Binance（AVAXUSDT），只做参考价，不参与撮合。
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_URL, api, type Trade } from "./lib/api";
import { useConfig } from "./lib/useConfig";
import { useAuth } from "./lib/useAuth";
import { useMiniDexSocket } from "./lib/ws";
import { BINANCE_SYMBOL, useBinanceKlines, useBinanceTicker } from "./lib/useBinance";
import type { Interval } from "./lib/binance";
import { chainName } from "./lib/chains";
import { NoticeBar } from "./components/NoticeBar";
import { Header } from "./components/Header";
import { TickerBar } from "./components/TickerBar";
import { Chart } from "./components/Chart";
import { OrderBook } from "./components/OrderBook";
import { Trades } from "./components/Trades";
import { OrderForm } from "./components/OrderForm";
import { BottomPanel } from "./components/BottomPanel";

const PAIR = "WAVAX/USDC";

export default function App() {
  const config = useConfig();
  const auth = useAuth(config.data?.chainId);
  const ws = useMiniDexSocket(auth.token);
  const [pickedPrice, setPickedPrice] = useState("");
  const [interval, setInterval] = useState<Interval>("1m");

  // ---- Binance 行情 ----
  const klines = useBinanceKlines(BINANCE_SYMBOL, interval);
  const ticker = useBinanceTicker(BINANCE_SYMBOL);
  const lastCandle = klines.candles[klines.candles.length - 1];
  const refPrice = lastCandle?.close ?? ticker.data?.last ?? null;

  // ---- mini-dex 撮合数据 ----
  const restBook = useQuery({
    queryKey: ["orderbook"],
    queryFn: () => api.orderbook(12),
    refetchInterval: ws.connected ? false : 3000,
  });

  const restTrades = useQuery({
    queryKey: ["trades"],
    queryFn: () => api.trades(30),
    refetchInterval: ws.connected ? false : 3000,
  });

  const restBalances = useQuery({
    queryKey: ["balances", auth.token],
    queryFn: () => api.balances(auth.token!),
    enabled: !!auth.token,
    refetchInterval: 10_000,
  });

  // WS 有值优先用 WS，否则用 REST
  const book = ws.orderbook ?? restBook.data ?? null;
  const balances = ws.balances ?? restBalances.data ?? null;
  const trades = useMemo(() => mergeTrades(ws.trades, restTrades.data ?? []), [ws.trades, restTrades.data]);

  return (
    <div className="app">
      <NoticeBar />
      <Header config={config.data} auth={auth} />

      {config.isError && (
        <div className="banner err">
          连不上后端 {API_URL}（GET /config 失败）。先启动 server，或检查 web/.env 的 VITE_API_URL。
        </div>
      )}
      {!ws.connected && !config.isError && <div className="banner">后端 WS 未连接，正在重试…（订单簿退回轮询）</div>}

      <TickerBar
        pair={PAIR}
        chainLabel={config.data ? chainName(config.data.chainId) : "…"}
        symbol={BINANCE_SYMBOL}
        lastPrice={lastCandle?.close ?? null}
        ticker={ticker.data}
        status={klines.status}
        dexLast={trades[0] ?? null}
      />

      <main className="terminal">
        <OrderBook
          book={book}
          lastTrade={trades[0] ?? null}
          prevTrade={trades[1] ?? null}
          refPrice={refPrice}
          liquidity={config.data?.marketMaker ? `流动性镜像 Binance ${config.data.marketMaker.symbol}` : null}
          onPickPrice={setPickedPrice}
        />

        <Chart symbol={BINANCE_SYMBOL} candles={klines.candles} status={klines.status} interval={interval} onIntervalChange={setInterval} />

        <div className="right-col">
          <Trades trades={trades} />
          <OrderForm token={auth.token} pickedPrice={pickedPrice} balances={balances} refPrice={refPrice} />
        </div>

        <BottomPanel config={config.data} token={auth.token} balances={balances} />
      </main>
    </div>
  );
}

// WS 推来的成交放前面，REST 的初始列表放后面，按 id 去重
function mergeTrades(live: Trade[], initial: Trade[]): Trade[] {
  const seen = new Set<string>();
  const out: Trade[] = [];
  for (const t of [...live, ...initial]) {
    if (seen.has(t.id)) continue;
    seen.add(t.id);
    out.push(t);
  }
  return out.slice(0, 30);
}
