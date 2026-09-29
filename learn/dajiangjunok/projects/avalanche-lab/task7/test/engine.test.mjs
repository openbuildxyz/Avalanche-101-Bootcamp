import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MatchingEngine } from '../engine.mjs';
const A = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const B = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const C = '0xcccccccccccccccccccccccccccccccccccccccc';
const order = (id, trader, side, price = 100n, amount = 10n, tif = 'GTC') => ({ id, trader, side, price, amount, tif });
test('price priority and maker execution price', () => {
  const e = new MatchingEngine(); e.submit(order('expensive', A, 'sell', 105n)); e.submit(order('cheap', B, 'sell', 100n));
  const { fills } = e.submit(order('buy', C, 'buy', 110n, 15n));
  assert.deepEqual(fills.map(f => [f.makerId, f.price, f.amount]), [['cheap', 100n, 10n], ['expensive', 105n, 5n]]);
});
test('time priority: equal price executes arrival order, independent of ID', () => {
  const e = new MatchingEngine(); e.submit(order('z-first', A, 'sell')); e.submit(order('a-second', B, 'sell'));
  const { fills } = e.submit(order('buy', C, 'buy', 100n, 15n));
  assert.deepEqual(fills.map(f => [f.makerId, f.amount]), [['z-first', 10n], ['a-second', 5n]]);
});
test('highest bid first when incoming order is a sell', () => {
  const e = new MatchingEngine(); e.submit(order('low', A, 'buy', 99n)); e.submit(order('high', B, 'buy', 102n));
  assert.equal(e.submit(order('sell', C, 'sell', 98n)).fills[0].makerId, 'high');
});
test('self-trade rejected even with mixed-case addresses', () => {
  const e = new MatchingEngine(); e.submit(order('sell', A, 'sell'));
  const before = e.orders;
  assert.throws(() => e.submit(order('buy', '0x' + A.slice(2).toUpperCase(), 'buy')), /self-trade/);
  assert.deepEqual(e.orders, before);
});
test('late self-trade rejection rolls back earlier potential fills', () => {
  const e = new MatchingEngine(); e.submit(order('other', B, 'sell', 90n)); e.submit(order('own', A, 'sell', 100n));
  const before = e.orders;
  assert.throws(() => e.submit(order('buy', A, 'buy', 100n, 15n)), /self-trade/);
  assert.deepEqual(e.orders, before);
});
test('partial fill preserves maker time priority', () => {
  const e = new MatchingEngine(); e.submit(order('first', A, 'sell')); e.submit(order('second', B, 'sell'));
  e.submit(order('buy1', C, 'buy', 100n, 2n));
  assert.equal(e.submit(order('buy2', C, 'buy', 100n, 8n)).fills[0].makerId, 'first');
});
test('noncrossing orders stay open', () => {
  const e = new MatchingEngine(); e.submit(order('sell', A, 'sell', 101n));
  assert.equal(e.submit(order('buy', B, 'buy', 100n)).fills.length, 0); assert.equal(e.orders.length, 2);
});
test('IOC fills available quantity then cancels remainder', () => {
  const e = new MatchingEngine(); e.submit(order('sell', A, 'sell', 100n, 3n));
  const r = e.submit(order('buy', B, 'buy', 100n, 10n, 'IOC'));
  assert.equal(r.remaining, 7n); assert.equal(r.status, 'cancelled'); assert.equal(e.orders.length, 0);
});
test('FOK fails atomically without sufficient liquidity', () => {
  const e = new MatchingEngine(); e.submit(order('sell', A, 'sell', 100n, 3n)); const before = e.orders;
  assert.throws(() => e.submit(order('buy', B, 'buy', 100n, 10n, 'FOK')), /FOK/); assert.deepEqual(e.orders, before);
});
test('FOK fills across multiple makers', () => {
  const e = new MatchingEngine(); e.submit(order('s1', A, 'sell', 99n, 3n)); e.submit(order('s2', B, 'sell', 100n, 7n));
  assert.equal(e.submit(order('buy', C, 'buy', 100n, 10n, 'FOK')).status, 'filled'); assert.equal(e.orders.length, 0);
});
test('cancel enforces ownership', () => {
  const e = new MatchingEngine(); e.submit(order('s', A, 'sell'));
  assert.throws(() => e.cancel('s', B), /owner/); e.cancel('s', A); assert.equal(e.orders.length, 0);
});
test('duplicate IDs, floating point amounts, zero price and invalid addresses are rejected', () => {
  const e = new MatchingEngine(); e.submit(order('s', A, 'sell'));
  for (const o of [order('s', B, 'buy'), order('f', B, 'buy', 100n, 0.1), order('z', B, 'buy', 0n), order('a', 'alice', 'buy')])
    assert.throws(() => e.submit(o));
});
test('BigInt preserves values above Number.MAX_SAFE_INTEGER', () => {
  const e = new MatchingEngine(); const price = 9007199254740993n;
  e.submit(order('s', A, 'sell', price)); assert.equal(e.submit(order('b', B, 'buy', price)).fills[0].price, price);
});
test('expired orders do not match', () => {
  let now = 10; const e = new MatchingEngine(() => now);
  e.submit({ ...order('s', A, 'sell'), deadline: 11 }); now = 12;
  assert.equal(e.submit(order('b', B, 'buy')).fills.length, 0);
  assert.throws(() => e.submit({ ...order('old', C, 'sell'), deadline: 11 }), /expired/);
});
test('returned order snapshots cannot mutate internal book', () => {
  const e = new MatchingEngine(); e.submit(order('s', A, 'sell')); e.orders[0].remaining = 999n;
  assert.equal(e.orders[0].remaining, 10n);
});
