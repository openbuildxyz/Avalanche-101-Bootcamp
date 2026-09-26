// WebSocket 订阅：一条连接拿到订单簿 / 成交 / 余额三种推送。
// 登录后发 {type:"auth", token}，服务端才会把余额推给这条连接。
// 断线按 1s → 2s → 4s … 最多 10s 的退避重连。
import { useEffect, useState } from "react";
import type { Balances, OrderBookSnapshot, Trade } from "./api";

export const WS_URL: string = import.meta.env.VITE_WS_URL ?? "ws://localhost:8787/ws";

const MAX_TRADES = 30;

type WsMessage =
  | { type: "orderbook"; data: OrderBookSnapshot }
  | { type: "trade"; data: Trade | Trade[] }
  | { type: "balance"; address: string; data: Balances };

export function useMiniDexSocket(token?: string | null) {
  const [orderbook, setOrderbook] = useState<OrderBookSnapshot | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [balances, setBalances] = useState<Balances | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false; // 组件卸载 / token 变化时置 true，不再重连
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // token 变了（登录/登出）就重新建连，余额先清空
    setBalances(null);

    function connect() {
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        retries = 0;
        setConnected(true);
        if (token) ws?.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (ev) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        switch (msg.type) {
          case "orderbook":
            setOrderbook(msg.data);
            break;
          case "trade": {
            const incoming = Array.isArray(msg.data) ? msg.data : [msg.data];
            setTrades((prev) => [...incoming.reverse(), ...prev].slice(0, MAX_TRADES));
            break;
          }
          case "balance":
            setBalances(msg.data);
            break;
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retries, 10_000);
        retries += 1;
        timer = setTimeout(connect, delay);
      };

      ws.onerror = () => ws?.close();
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      ws?.close();
    };
  }, [token]);

  return { orderbook, trades, balances, connected };
}
