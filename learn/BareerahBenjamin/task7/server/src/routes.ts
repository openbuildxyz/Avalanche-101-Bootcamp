// HTTP API（spec §3.4）。核心是"账本联动"：
//   下单前冻结 -> 撮合 -> 每笔成交在买卖双方之间划转 -> 没用完的解冻 -> WS 广播。
// buy limit 冻结 price*qty USDC；buy market 冻结全部可用 USDC；sell 冻结 qty WAVAX。
import { Hono } from "hono";
import { randomBytes, randomUUID } from "node:crypto";
import { OrderBook, type Fill, type Order, type OrderType, type Side } from "./engine/orderbook.js";
import { Ledger, type Asset, type Balances } from "./ledger.js";
import { parseFixed, formatFixed, mulFixed } from "./fixed.js";
import type { AuthEnv } from "./auth.js";
import type { Chain } from "./chain.js";
import type { WsHub } from "./ws.js";
import type { MiddlewareHandler } from "hono";

export interface Trade { id: string; price: string; qty: string; side: Side; ts: number }

export interface RoutesDeps {
  ledger: Ledger;
  book: OrderBook;
  chain: Chain;
  ws: WsHub;
  bearer: MiddlewareHandler<AuthEnv>;
  config: { chainId: number; wsUrl: string; vault: string; usdc: string; wavax: string; marketMaker?: { address: string; symbol: string; source: string } | null };
}

const MAX_TRADES = 200;

export function createRoutes(d: RoutesDeps) {
  const { ledger, book, chain, ws } = d;
  const app = new Hono<AuthEnv>();
  const trades: Trade[] = [];                 // 最近成交（环形缓冲，只留 200 条）
  const locks = new Map<string, bigint>();    // orderId -> 当前为这张单冻结的金额（buy: USDC / sell: WAVAX）

  // ---------- 工具 ----------
  const fmtBalances = (b: Balances) => ({
    USDC: { available: formatFixed(b.USDC.available), locked: formatFixed(b.USDC.locked) },
    WAVAX: { available: formatFixed(b.WAVAX.available), locked: formatFixed(b.WAVAX.locked) },
  });
  const fmtOrder = (o: Order) => ({
    id: o.id, owner: o.owner, side: o.side, type: o.type,
    price: formatFixed(o.price), qty: formatFixed(o.qty), remaining: formatFixed(o.remaining), ts: o.ts,
  });
  const fmtFill = (f: Fill) => ({ ...f, price: formatFixed(f.price), qty: formatFixed(f.qty) });
  const snapshot = (depth: number) => {
    const s = book.snapshot(depth);
    const fmt = (rows: [bigint, bigint][]) => rows.map(([p, q]) => [formatFixed(p), formatFixed(q)]);
    return { bids: fmt(s.bids), asks: fmt(s.asks) };
  };
  const lockAsset = (side: Side): Asset => (side === "buy" ? "USDC" : "WAVAX");
  const pushBalance = (address: string) => ws.sendBalance(address, fmtBalances(ledger.get(address)));

  /** 一笔成交的结算：买方 locked USDC -> 卖方；卖方 locked WAVAX -> 买方 */
  function settle(f: Fill) {
    const quote = mulFixed(f.price, f.qty); // 成交额（USDC）
    const takerIsBuyer = f.side === "buy";
    const buyer = takerIsBuyer ? f.taker : f.maker;
    const seller = takerIsBuyer ? f.maker : f.taker;
    const buyOrderId = takerIsBuyer ? f.takerOrderId : f.makerOrderId;
    const sellOrderId = takerIsBuyer ? f.makerOrderId : f.takerOrderId;

    ledger.transferLocked(buyer, seller, "USDC", quote);
    ledger.transferLocked(seller, buyer, "WAVAX", f.qty);
    locks.set(buyOrderId, locks.get(buyOrderId)! - quote);
    locks.set(sellOrderId, locks.get(sellOrderId)! - f.qty);

    const t: Trade = { id: randomUUID(), price: formatFixed(f.price), qty: formatFixed(f.qty), side: f.side, ts: f.ts };
    trades.push(t);
    if (trades.length > MAX_TRADES) trades.shift();
    ws.broadcast("trade", t);
  }

  /** 订单已不在簿上（全部成交 / market 结束 / 撤单）-> 把它剩余冻结全部解冻 */
  function releaseLock(orderId: string, owner: string, side: Side) {
    const left = locks.get(orderId) ?? 0n;
    if (left > 0n) ledger.unlock(owner, lockAsset(side), left);
    locks.delete(orderId);
  }

  /** market buy 下单前先算一下要花多少 USDC（单线程，估算 = 实际） */
  function estimateBuyCost(qty: bigint): bigint {
    let cost = 0n, left = qty;
    for (const [price, levelQty] of book.snapshot(Number.MAX_SAFE_INTEGER).asks) {
      const take = left < levelQty ? left : levelQty;
      cost += mulFixed(price, take);
      left -= take;
      if (left === 0n) break;
    }
    return cost;
  }

  // ---------- 下单 / 撤单核心（HTTP 接口和做市模块共用） ----------
  const broadcastBook = () => ws.broadcast("orderbook", snapshot(10));

  /** 下单：冻结 -> 撮合 -> 结算 -> 解冻 -> 广播。余额不足等直接抛 Error。 */
  function placeOrder(
    owner: string,
    input: { side: Side; type: OrderType; price: bigint; qty: bigint },
    opts: { broadcastBook?: boolean } = {},
  ): { order: Order; fills: Fill[] } {
    const { side, type, price, qty } = input;
    const id = randomUUID();
    // 1. 先做无副作用的自成交预检，拒绝时不能留下冻结余额
    book.assertNoSelfTrade({ owner, side, type, price, qty });

    // 2. 冻结
    if (side === "sell") {
      ledger.lock(owner, "WAVAX", qty);
      locks.set(id, qty);
    } else if (type === "limit") {
      const cost = mulFixed(price, qty);
      ledger.lock(owner, "USDC", cost);
      locks.set(id, cost);
    } else {
      const available = ledger.get(owner).USDC.available;
      if (estimateBuyCost(qty) > available) throw new Error("余额不足: USDC 不够买这么多");
      ledger.lock(owner, "USDC", available); // market buy：先把全部可用 USDC 冻住，撮合完再退
      locks.set(id, available);
    }

    // 3. 撮合
    const { fills, resting } = book.submit({ id, owner, side, type, price, qty });

    // 4. 结算每笔成交
    for (const f of fills) settle(f);

    // 5. 对手方（maker）如果已经全部成交，把它可能剩的零头解冻
    const touched = new Set(fills.map((f) => f.makerOrderId));
    for (const f of fills) {
      if (touched.has(f.makerOrderId) && !book.get(f.makerOrderId)) {
        releaseLock(f.makerOrderId, f.maker, side === "buy" ? "sell" : "buy");
        touched.delete(f.makerOrderId);
      }
    }

    // 6. taker 自己：没挂单 -> 全部解冻；挂单了 -> 只留剩余部分需要的
    if (!resting) {
      releaseLock(id, owner, side);
    } else {
      const need = side === "buy" ? mulFixed(price, resting.remaining) : resting.remaining;
      const refund = locks.get(id)! - need; // limit buy 按比挂单价更低的 maker 价成交时的差价
      if (refund > 0n) ledger.unlock(owner, lockAsset(side), refund);
      locks.set(id, need);
    }

    // 7. 广播（做市模块一轮会挂很多单，它自己在最后广播一次）
    if (opts.broadcastBook !== false) broadcastBook();
    pushBalance(owner);
    for (const maker of new Set(fills.map((f) => f.maker))) if (maker !== owner) pushBalance(maker);

    const order: Order = resting ?? { id, owner, side, type, price, qty, remaining: qty - fills.reduce((s, f) => s + f.qty, 0n), ts: fills[0]?.ts ?? Date.now(), seq: 0 };
    return { order, fills };
  }

  /** 撤单：只能撤自己的；返回被撤的订单，找不到返回 null */
  function cancelOrder(owner: string, id: string, opts: { broadcastBook?: boolean } = {}): Order | null {
    const order = book.cancel(id, owner);
    if (!order) return null;
    releaseLock(order.id, owner, order.side);
    if (opts.broadcastBook !== false) broadcastBook();
    pushBalance(owner);
    return order;
  }

  // ---------- 公开接口 ----------
  app.get("/config", (c) =>
    c.json({
      chainId: d.config.chainId,
      vault: d.config.vault,
      tokens: { USDC: d.config.usdc, WAVAX: d.config.wavax },
      wsUrl: d.config.wsUrl,
      mode: chain.offline ? "offline" : "chain",
      marketMaker: d.config.marketMaker ?? null,
    }),
  );
  app.get("/orderbook", (c) => c.json(snapshot(Number(c.req.query("depth") ?? 10) || 10)));
  app.get("/trades", (c) => {
    const limit = Number(c.req.query("limit") ?? 50) || 50;
    return c.json(trades.slice(-limit).reverse()); // 最新的在前
  });

  // ---------- 需要登录 ----------
  app.get("/me", d.bearer, (c) => c.json({ address: c.get("address") }));
  app.get("/balances", d.bearer, (c) => c.json(fmtBalances(ledger.get(c.get("address")))));
  app.get("/orders", d.bearer, (c) => c.json(book.ordersOf(c.get("address")).map(fmtOrder)));

  app.post("/orders", d.bearer, async (c) => {
    const owner = c.get("address");
    const body = await c.req.json<{ side?: string; type?: string; price?: string; qty?: string }>().catch(() => ({}) as Record<string, string>);
    const { side, type } = body;
    if (side !== "buy" && side !== "sell") return c.json({ error: "side 必须是 buy / sell" }, 400);
    if (type !== "limit" && type !== "market") return c.json({ error: "type 必须是 limit / market" }, 400);

    let qty: bigint, price = 0n;
    try {
      qty = parseFixed(body.qty ?? "");
      if (type === "limit") price = parseFixed(body.price ?? "");
    } catch (e) { return c.json({ error: (e as Error).message }, 400); }
    if (qty <= 0n) return c.json({ error: "qty 必须 > 0" }, 400);
    if (type === "limit" && price <= 0n) return c.json({ error: "limit 单必须给 price" }, 400);

    try {
      const { order, fills } = placeOrder(owner, { side, type, price, qty });
      return c.json({ order: fmtOrder(order), fills: fills.map(fmtFill) });
    } catch (e) { return c.json({ error: (e as Error).message }, 400); }
  });

  app.delete("/orders/:id", d.bearer, (c) => {
    const owner = c.get("address");
    const order = cancelOrder(owner, c.req.param("id"));
    if (!order) return c.json({ error: "订单不存在或不是你的" }, 404);
    return c.json({ order: fmtOrder(order) });
  });

  app.post("/withdraw", d.bearer, async (c) => {
    const owner = c.get("address");
    if (chain.offline) return c.json({ error: "离线模式没有 Vault，无法提现" }, 400);
    const body = await c.req.json<{ token?: string; amount?: string }>().catch(() => ({}) as Record<string, string>);
    const asset = body.token;
    if (asset !== "USDC" && asset !== "WAVAX") return c.json({ error: "token 必须是 USDC / WAVAX" }, 400);
    let amount: bigint;
    try { amount = parseFixed(body.amount ?? ""); ledger.debit(owner, asset, amount); }
    catch (e) { return c.json({ error: (e as Error).message }, 400); }

    const nonce = BigInt("0x" + randomBytes(8).toString("hex"));          // 随机 uint64
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 10 * 60);    // 10 分钟内有效
    const { token, amountWei, signature } = await chain.signWithdraw({ user: owner, asset, amount, nonce, deadline });
    pushBalance(owner);
    return c.json({
      token: asset, tokenAddress: token, amount: amountWei.toString(),
      nonce: nonce.toString(), deadline: deadline.toString(), signature, vault: d.config.vault,
    });
  });

  // ---------- 离线模式专用：水龙头 ----------
  if (chain.offline) {
    app.post("/dev/faucet", d.bearer, (c) => {
      const owner = c.get("address");
      ledger.credit(owner, "USDC", parseFixed("10000"));
      ledger.credit(owner, "WAVAX", parseFixed("100"));
      pushBalance(owner);
      return c.json(fmtBalances(ledger.get(owner)));
    });
  }

  /** 给 chain.ts 的充值回调用 */
  function onDeposit(user: string, asset: Asset, amount: bigint) {
    ledger.credit(user, asset, amount);
    pushBalance(user.toLowerCase());
  }

  /** 启动回放历史 Withdraw 事件时扣账（实时提现在 /withdraw 签名时已经扣过，不会走这里） */
  function onWithdrawBackfill(user: string, asset: Asset, amount: bigint) {
    try { ledger.debit(user, asset, amount); }
    catch (e) { console.warn(`[ledger] 回放 Withdraw 扣账失败 ${user} ${asset} ${amount}: ${(e as Error).message}`); }
  }

  return { app, onDeposit, onWithdrawBackfill, snapshot, placeOrder, cancelOrder, broadcastBook, ordersOf: (owner: string) => book.ordersOf(owner) };
}
