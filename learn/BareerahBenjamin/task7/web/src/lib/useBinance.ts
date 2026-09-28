// Binance 行情 hooks：useBinanceKlines（历史 + 实时合并）、useBinanceTicker（24h 行情轮询）。
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchKlines, fetchTicker24h, subscribeKline, upsertCandle, type Candle, type FeedStatus, type Interval } from "./binance";

// WAVAX/USDC 对应 Binance 的 AVAXUSDT；想换别的对就改 web/.env 的 VITE_BINANCE_SYMBOL
export const BINANCE_SYMBOL: string = import.meta.env.VITE_BINANCE_SYMBOL ?? "AVAXUSDT";

const HISTORY_LIMIT = 500;

export function useBinanceKlines(symbol: string, interval: Interval) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");

  useEffect(() => {
    let alive = true;
    let historyLoaded = false;
    const pending: Candle[] = []; // 历史还没回来时先攒着实时推送，回来后再合并，避免错位
    setCandles([]);
    setStatus("loading");

    const unsubscribe = subscribeKline(symbol, interval, {
      onCandle: (c) => {
        if (!alive) return;
        if (!historyLoaded) {
          pending.push(c);
          return;
        }
        setCandles((prev) => upsertCandle(prev, c));
      },
      onStatus: (s) => alive && setStatus(s),
    });

    fetchKlines(symbol, interval, HISTORY_LIMIT)
      .then((hist) => {
        if (!alive) return;
        let list = hist;
        for (const c of pending) list = upsertCandle(list, c);
        historyLoaded = true;
        setCandles(list);
      })
      .catch(() => alive && setStatus("error"));

    return () => {
      alive = false;
      unsubscribe();
    };
  }, [symbol, interval]);

  return { candles, status };
}

export function useBinanceTicker(symbol: string) {
  return useQuery({
    queryKey: ["binance-ticker", symbol],
    queryFn: () => fetchTicker24h(symbol),
    refetchInterval: 5000,
    retry: 1,
  });
}
