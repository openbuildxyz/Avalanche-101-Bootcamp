# Mini-DEX AI 安全审查报告

审查范围：`contracts/src/Vault.sol`、`contracts/src/MockERC20.sol`、
`server/src/engine/orderbook.ts`、`server/src/ledger.ts`、`server/src/routes.ts`、
`server/src/ws.ts`、`server/src/store.ts`。

方法：人工审查 + 针对性的对抗性测试（`contracts/test/Vault.t.sol`、
`server/src/engine/orderbook.test.ts`、`server/src/store.test.ts`），并以
`forge test` / `server npm test` 全绿作为回归门槛。

---

## H-01 — signer 私钥即金库钥匙（提现不受链上余额约束）— 高 — 按设计，需运营加固

`Vault.withdraw` 只校验 EIP-712 签名，不校验链上 `balances`（见
`test_Withdraw_NotBoundByOnchainBalances_ClampsToZero`）。这是"链下撮合、链上托管"
的必然结果：真实余额在链下账本，signer 签多少就能取多少。

风险：`BACKEND_SIGNER_PRIVATE_KEY` 泄露 = 金库被清空。

处置（已加固 / 建议）：
- 本次新增**链上余额硬上限** `Vault.maxBalance[token]`（`deposit` 时强制），
  限制单账户可沉淀的链上余额（对应作业"进阶 A"）。
- 生产必须把 signer 放进 HSM / 多签，并加**单笔 / 日累计提现限额**与对账监控。

## M-01 — `/withdraw` 先扣账本再签名，签名失败吞掉用户余额 — 中 — **已修复**

原实现：
```ts
try { amount = parseFixed(...); ledger.debit(owner, asset, amount); } catch { 400 }
const { token, amountWei, signature } = await chain.signWithdraw({...}); // 抛错则不会回滚 debit
```
若 `signWithdraw` 抛错（如代币地址配置错误、签名器异常），`debit` 已经生效，
用户账本余额凭空消失、又拿不到提现授权。

修复（`server/src/routes.ts`）：签名失败时 `ledger.credit(owner, asset, amount)` 回滚，
并返回 500。

## M-02 — 允许自成交（wash trading）— 中 — **已修复**

原 `OrderBook.match` 会把自己的挂单和同账户的新单撮合（源码里写着
"TODO 生产环境需要 self-trade prevention"）。自成交没有经济意义，还会刷量、
误导行情。

修复（`server/src/engine/orderbook.ts`）：新增自成交保护
（`selfTradePolicy: "reject"` 默认）。`submit` 在撮合前做预检查
`wouldSelfTrade`，一旦会与同账户挂单成交即整单拒绝（`SELF_TRADE`，不产生任何成交、
不挂单）；`routes.placeOrder` 捕获后解冻并返回错误。可用
`new OrderBook({ selfTradePolicy: "allow" })` 关闭（便于对照教学）。

回归测试：`自成交：拒绝同账户对手盘`、`市场单同样被拒绝`、
`外部流动性不足以完全成交时也整单拒绝`、`allow 模式`。

## L-01 — 账本/挂单/成交仅存内存，重启即丢 — 低 — **已修复**

修复（`server/src/store.ts` + `ledger.ts` + `orderbook.ts` + `routes.ts`）：
新增 SQLite 写穿持久化（Node 内置 `node:sqlite`），账本余额、挂单、成交落库，
启动时 `ledger.restore()` / `book.restore()` 恢复。`DB_PATH=off` 可退回纯内存。

回归测试：`server/src/store.test.ts`（账本余额、挂单、成交、删除后不恢复）。

## L-02 — `MockERC20` 公开无上限 mint — 低 — 按设计（测试水龙头）

任何地址都能 mint 任意数量测试代币。仅用于测试网教学；生产应移除或加上限/权限。

## L-03 — `ws` 私有频道鉴权基于一次性 JWT — 信息

私有 `balance` / `orders` 频道仅在发过 `{type:"auth", token}` 且校验通过的连接上推送；
未鉴权连接只收到公开的 `orderbook` / `trade`。逻辑正确，注意 `JWT_SECRET` 上线必换。

## M-03 — 持久化与链上回放叠加导致余额重复入账 — 中 — **已修复**

引入 SQLite 持久化后，启动时既从 DB 恢复余额、又从 `DEPOSIT_FROM_BLOCK` 全量回放 Deposit 事件，
同一笔充值被入账两次（实测账户余额翻倍）。

修复（`server/src/store.ts` + `server/src/chain.ts` + `server/src/index.ts`）：
在 store 中记录**同步游标** `last_block`；启动时若已有游标则只回放 `last_block+1` 之后的事件，
并在回放/收取新事件后写回游标。`forge`/`server` 测试与实测（A=150 而非 300）确认不再重复。

## L-04 — 做市账户虚拟注资每次重启重复累加 — 低 — **已修复**

`MM_SEED_*` 在每个进程启动时无条件 `ledger.credit`，配合持久化会让做市账户余额不断膨胀。
修复（`server/src/index.ts`）：仅当该账户可用余额为 0 时才注入。

---

## 汇总

| ID   | 问题 | 等级 | 状态 |
|------|------|------|------|
| H-01 | signer 即金库钥匙，提现无链上约束 | 高 | 运营加固（已加链上硬上限）|
| M-01 | `/withdraw` 扣账无回滚 | 中 | **已修复** |
| M-02 | 允许自成交（wash trading）| 中 | **已修复** |
| M-03 | 持久化 + 回放重复入账 | 中 | **已修复**（同步游标）|
| L-01 | 内存态，重启丢挂单/成交 | 低 | **已修复**（SQLite）|
| L-02 | MockERC20 无上限 mint | 低 | 按设计 |
| L-03 | WS 私有频道鉴权 | 信息 | 正确 |
| L-04 | 做市虚拟注资重复累加 | 低 | **已修复** |

本次实际修复的真实问题：**M-01（扣账回滚）**、**M-03（重复入账）**，另有 M-02、L-01、L-04 的修复与
H-01 的链上硬上限加固。所有修复均有自动化测试锁定，`forge test` 与 `server npm test` 全绿。
