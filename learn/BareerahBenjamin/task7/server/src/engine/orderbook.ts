// 撮合引擎（纯内存、零依赖）。
// 规则：价格优先、时间优先（同价 FIFO）；成交价 = maker（挂单方）的价格。
// 数据结构：每边一个 Map<价格, Level> + 一个有序价格数组（bids 降序 / asks 升序）。
// 初学者能读懂 > 极致性能；生产引擎（如 Primit 的 Rust 引擎）会用更高效的结构。

export type Side = "buy" | "sell";
export type OrderType = "limit" | "market";

export interface Order {
  id: string;
  owner: string;       // 钱包地址（小写）
  side: Side;
  type: OrderType;
  price: bigint;       // 8 位定点；market 单为 0n
  qty: bigint;         // 原始数量
  remaining: bigint;   // 还没成交的数量
  ts: number;          // 提交时间（毫秒）
  seq: number;         // 提交序号，用于时间优先
}

export interface Fill {
  takerOrderId: string;
  makerOrderId: string;
  taker: string;
  maker: string;
  price: bigint;       // = maker 的挂单价
  qty: bigint;
  side: Side;          // taker 的方向
  ts: number;
}

/** 新订单会与同一账户的挂单成交时，整单拒绝。 */
export class SelfTradeError extends Error {
  constructor() {
    super("拒绝 self-trade: 新订单会与自己的挂单成交");
    this.name = "SelfTradeError";
  }
}

/** 一个价格档位：同价的挂单按先来后到排队 */
interface Level {
  price: bigint;
  orders: Order[];     // FIFO
}

export class OrderBook {
  private bids = new Map<bigint, Level>();
  private asks = new Map<bigint, Level>();
  private bidPrices: bigint[] = []; // 降序：最高买价在前
  private askPrices: bigint[] = []; // 升序：最低卖价在前
  private byId = new Map<string, Order>();
  private seq = 0;

  /** 提交订单：先吃对手盘，limit 剩余挂单，market 剩余丢弃 */
  submit(input: Omit<Order, "remaining" | "seq" | "ts"> & Partial<Pick<Order, "ts">>): { fills: Fill[]; resting: Order | null } {
    this.assertNoSelfTrade(input);
    const order: Order = { ...input, remaining: input.qty, seq: ++this.seq, ts: input.ts ?? Date.now() };
    const fills = this.match(order);

    if (order.type === "limit" && order.remaining > 0n) {
      this.rest(order);
      return { fills, resting: order };
    }
    return { fills, resting: null }; // market 单不挂；或者 limit 单已全部成交
  }

  /** 撤单：只能撤自己的；返回被撤的订单（找不到返回 null） */
  cancel(id: string, owner: string): Order | null {
    const order = this.byId.get(id);
    if (!order || order.owner !== owner) return null;
    const { book, prices } = this.sideOf(order.side);
    const level = book.get(order.price)!;
    level.orders = level.orders.filter((o) => o.id !== id);
    if (level.orders.length === 0) {
      book.delete(order.price);
      prices.splice(prices.indexOf(order.price), 1);
    }
    this.byId.delete(id);
    return order;
  }

  /** 按价格聚合的深度快照：[[price, qty], ...] */
  snapshot(depth = 10): { bids: [bigint, bigint][]; asks: [bigint, bigint][] } {
    const agg = (prices: bigint[], book: Map<bigint, Level>): [bigint, bigint][] =>
      prices.slice(0, depth).map((p) => {
        const total = book.get(p)!.orders.reduce((s, o) => s + o.remaining, 0n);
        return [p, total];
      });
    return { bids: agg(this.bidPrices, this.bids), asks: agg(this.askPrices, this.asks) };
  }

  bestBid(): bigint | null { return this.bidPrices[0] ?? null; }
  bestAsk(): bigint | null { return this.askPrices[0] ?? null; }

  /** 按 id 查还在簿上的挂单（已成交/已撤的查不到） */
  get(id: string): Order | undefined {
    return this.byId.get(id);
  }

  /** 某个用户所有还在簿上的挂单 */
  ordersOf(owner: string): Order[] {
    return [...this.byId.values()].filter((o) => o.owner === owner);
  }

  /**
   * 按真实撮合顺序预演新订单；只有其数量确实会碰到自己的 maker 单时才拒绝。
   * 该检查不修改订单簿，可在冻结资金前安全调用。
   */
  assertNoSelfTrade(input: Pick<Order, "owner" | "side" | "type" | "price" | "qty">): void {
    const opposite = this.sideOf(input.side === "buy" ? "sell" : "buy");
    const owner = input.owner.toLowerCase();
    let remaining = input.qty;

    for (const makerPrice of opposite.prices) {
      if (input.type === "limit" && !this.crosses(input.side, input.price, makerPrice)) break;
      const level = opposite.book.get(makerPrice)!;
      for (const maker of level.orders) {
        if (remaining === 0n) return;
        if (maker.owner.toLowerCase() === owner) throw new SelfTradeError();
        remaining -= remaining < maker.remaining ? remaining : maker.remaining;
      }
    }
  }

  // ---------- 内部实现 ----------

  /** 撮合：买单看 asks（从低到高），卖单看 bids（从高到低） */
  private match(taker: Order): Fill[] {
    const fills: Fill[] = [];
    const opposite = this.sideOf(taker.side === "buy" ? "sell" : "buy");

    while (taker.remaining > 0n && opposite.prices.length > 0) {
      const bestPrice = opposite.prices[0]!;
      // limit 单只在价格能对上时成交；market 单不看价
      if (taker.type === "limit" && !this.crosses(taker.side, taker.price, bestPrice)) break;

      const level = opposite.book.get(bestPrice)!;
      while (taker.remaining > 0n && level.orders.length > 0) {
        const maker = level.orders[0]!;
        const qty = taker.remaining < maker.remaining ? taker.remaining : maker.remaining;
        taker.remaining -= qty;
        maker.remaining -= qty;
        fills.push({
          takerOrderId: taker.id, makerOrderId: maker.id,
          taker: taker.owner, maker: maker.owner,
          price: maker.price, qty, side: taker.side, ts: taker.ts,
        });
        if (maker.remaining === 0n) {
          level.orders.shift();
          this.byId.delete(maker.id);
        }
      }
      if (level.orders.length === 0) {
        opposite.book.delete(bestPrice);
        opposite.prices.shift();
      }
    }
    return fills;
  }

  /** 买单价 >= 卖一 / 卖单价 <= 买一 才能成交 */
  private crosses(side: Side, takerPrice: bigint, makerPrice: bigint): boolean {
    return side === "buy" ? takerPrice >= makerPrice : takerPrice <= makerPrice;
  }

  /** 把剩余部分挂到簿上，保持价格数组有序 */
  private rest(order: Order): void {
    const { book, prices } = this.sideOf(order.side);
    let level = book.get(order.price);
    if (!level) {
      level = { price: order.price, orders: [] };
      book.set(order.price, level);
      // 插入到正确位置：bids 降序 / asks 升序
      const better = (a: bigint, b: bigint) => (order.side === "buy" ? a > b : a < b);
      let i = 0;
      while (i < prices.length && better(prices[i]!, order.price)) i++;
      prices.splice(i, 0, order.price);
    }
    level.orders.push(order);
    this.byId.set(order.id, order);
  }

  private sideOf(side: Side): { book: Map<bigint, Level>; prices: bigint[] } {
    return side === "buy" ? { book: this.bids, prices: this.bidPrices } : { book: this.asks, prices: this.askPrices };
  }
}
