/** Pure matching engine. Matching results are proposals, NOT proof of on-chain settlement.
 * Quantities are whole BASE; prices are raw quote units. Never use floating point for money.
 */
export class MatchingEngine {
  #orders = [];
  #ids = new Set();
  #sequence = 0;
  #now;
  constructor(now = () => Math.floor(Date.now() / 1000)) { this.#now = now; }
  get orders() { return this.#orders.filter(o => o.deadline >= this.#now()).map(o => ({ ...o })); }
  submit(input) {
    const o = { ...input, tif: input.tif ?? 'GTC', deadline: input.deadline ?? Number.MAX_SAFE_INTEGER };
    if (typeof o.id !== 'string' || !o.id || this.#ids.has(o.id)) throw Error('duplicate or invalid id');
    if (!/^0x[\da-f]{40}$/i.test(o.trader)) throw Error('invalid trader');
    o.trader = o.trader.toLowerCase();
    if (!['buy', 'sell'].includes(o.side) || !['GTC', 'IOC', 'FOK'].includes(o.tif)) throw Error('invalid order type');
    if (typeof o.price !== 'bigint' || typeof o.amount !== 'bigint' || o.price <= 0n || o.amount <= 0n) throw Error('invalid amount or price');
    if (!Number.isSafeInteger(o.deadline) || o.deadline < this.#now()) throw Error('expired order');
    const live = this.#orders.filter(m => m.deadline >= this.#now());
    const candidates = live.filter(m => m.side !== o.side && (o.side === 'buy' ? m.price <= o.price : m.price >= o.price))
      .sort((a, b) => a.price === b.price ? a.sequence - b.sequence :
        (o.side === 'buy' ? (a.price < b.price ? -1 : 1) : (a.price > b.price ? -1 : 1)));
    // Preflight the full execution path. Reject atomically even if self-trade appears after a valid fill.
    let remaining = o.amount;
    const fills = [];
    for (const maker of candidates) {
      if (remaining === 0n) break;
      if (maker.trader === o.trader) throw Error('self-trade rejected');
      const amount = remaining < maker.remaining ? remaining : maker.remaining;
      fills.push({ makerId: maker.id, takerId: o.id, buyer: o.side === 'buy' ? o.trader : maker.trader,
        seller: o.side === 'sell' ? o.trader : maker.trader, price: maker.price, amount });
      remaining -= amount;
    }
    if (o.tif === 'FOK' && remaining !== 0n) throw Error('FOK insufficient liquidity');
    const next = live.map(m => ({ ...m }));
    for (const fill of fills) next.find(m => m.id === fill.makerId).remaining -= fill.amount;
    this.#orders = next.filter(m => m.remaining > 0n);
    this.#ids.add(o.id);
    o.sequence = this.#sequence++;
    if (remaining > 0n && o.tif === 'GTC') this.#orders.push({ ...o, remaining });
    return { fills, remaining, status: remaining === 0n ? 'filled' : o.tif === 'GTC' ? 'open' : 'cancelled' };
  }
  cancel(id, trader) {
    const order = this.#orders.find(o => o.id === id);
    if (!order || order.trader !== trader.toLowerCase()) throw Error('not order owner');
    this.#orders = this.#orders.filter(o => o.id !== id);
  }
}
