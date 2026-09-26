// 内存账本：每个地址两种资产（USDC / WAVAX），各有 available（可用）和 locked（下单冻结）。
// 重启即丢，生产要落库（Primit 用 TimescaleDB）。
// 教训来自 Primit：地址一律小写存取，否则同一个钱包大小写不同会变成"两个用户"。

import { formatFixed as f } from "./fixed.js";

export type Asset = "USDC" | "WAVAX";
export const ASSETS: Asset[] = ["USDC", "WAVAX"];

export interface AssetBalance { available: bigint; locked: bigint }
export type Balances = Record<Asset, AssetBalance>;

export class Ledger {
  private accounts = new Map<string, Balances>();

  /** 取账户（不存在就建一个全 0 的） */
  get(address: string): Balances {
    const key = norm(address);
    let b = this.accounts.get(key);
    if (!b) {
      b = { USDC: { available: 0n, locked: 0n }, WAVAX: { available: 0n, locked: 0n } };
      this.accounts.set(key, b);
    }
    return b;
  }

  /** 入金：充值事件 / 水龙头 */
  credit(address: string, asset: Asset, amount: bigint): void {
    assertPositive(amount);
    this.get(address)[asset].available += amount;
  }

  /** 出金：提现时直接从 available 扣 */
  debit(address: string, asset: Asset, amount: bigint): void {
    assertPositive(amount);
    const b = this.get(address)[asset];
    if (b.available < amount) throw new Error(`余额不足: ${asset} 可用 ${f(b.available)} < 需要 ${f(amount)}`);
    b.available -= amount;
  }

  /** 下单冻结：available -> locked */
  lock(address: string, asset: Asset, amount: bigint): void {
    if (amount === 0n) return;
    assertPositive(amount);
    const b = this.get(address)[asset];
    if (b.available < amount) throw new Error(`余额不足: ${asset} 可用 ${f(b.available)} < 需要 ${f(amount)}`);
    b.available -= amount;
    b.locked += amount;
  }

  /** 撤单/未用完解冻：locked -> available */
  unlock(address: string, asset: Asset, amount: bigint): void {
    if (amount === 0n) return;
    assertPositive(amount);
    const b = this.get(address)[asset];
    if (b.locked < amount) throw new Error(`冻结不足: ${asset} locked ${f(b.locked)} < ${f(amount)}`);
    b.locked -= amount;
    b.available += amount;
  }

  /** 成交划转：from 的 locked -> to 的 available */
  transferLocked(from: string, to: string, asset: Asset, amount: bigint): void {
    if (amount === 0n) return;
    assertPositive(amount);
    const src = this.get(from)[asset];
    if (src.locked < amount) throw new Error(`冻结不足: ${asset} locked ${f(src.locked)} < ${f(amount)}`);
    src.locked -= amount;
    this.get(to)[asset].available += amount;
  }
}

export function norm(address: string): string {
  return address.toLowerCase();
}

function assertPositive(amount: bigint): void {
  if (amount <= 0n) throw new Error(`金额必须 > 0: ${f(amount)}`);
}
