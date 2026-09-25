// WebSocket 广播：和 HTTP 共用同一个端口，路径 /ws。
// 服务端推三种消息：orderbook（全员）/ trade（全员）/ balance（只推给发过 {type:"auth", token} 的连接）。
// 新连接一进来就先发一份订单簿快照，前端不用再额外 GET。
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "node:http";

export interface WsHub {
  broadcast(type: "orderbook" | "trade", data: unknown): void;
  sendBalance(address: string, data: unknown): void;
}

export function createWs(opts: {
  server: Server;
  verifyToken: (token: string) => Promise<string | null>;
  getSnapshot: () => unknown;
}): WsHub {
  const wss = new WebSocketServer({ server: opts.server, path: "/ws" });
  const authed = new Map<WebSocket, string>(); // socket -> 小写地址

  wss.on("connection", (ws) => {
    send(ws, { type: "orderbook", data: opts.getSnapshot() });

    ws.on("message", async (raw) => {
      let msg: { type?: string; token?: string };
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      if (msg.type === "auth" && typeof msg.token === "string") {
        const address = await opts.verifyToken(msg.token);
        if (address) authed.set(ws, address);
        send(ws, { type: "auth", ok: !!address, address });
      }
    });
    ws.on("close", () => authed.delete(ws));
  });

  function send(ws: WebSocket, msg: unknown) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  return {
    broadcast(type, data) {
      for (const ws of wss.clients) send(ws, { type, data });
    },
    sendBalance(address, data) {
      for (const [ws, addr] of authed) {
        if (addr === address) send(ws, { type: "balance", address, data });
      }
    },
  };
}
