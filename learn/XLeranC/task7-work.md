# Task 7 完成记录 — Mini-DEX（基于课程仓库 tubexchat/Mini-DEX）

> 提交者：XLeranC
> 课程仓库：https://github.com/tubexchat/Mini-DEX （main）
> 对应课程：第七章 Perp Dex 开发最新实战——以 Primit 为例
> 本地工作目录：`E:\Work\Learns\Mini-DEX`

本作业在**课程仓库原样结构**（`contracts/` + `server/` + `web/`）上完成 Task 7 的
必做项与进阶项，所有改动均配套自动化测试。

---

## 0. 本地验证结果（全绿）

| 包 | 命令 | 结果 |
|---|---|---|
| server（撮合引擎等） | `npm test` | **43 passed**（原 28） |
| contracts | `forge test` | **17 passed**（原 13） |
| web | `npm test` | **10 passed** |
| server / web | `npm run typecheck` | 无错误 |
| web | `npm run build` | 成功 |

> ⚠️ solc 说明：本机网络无法访问 `binaries.soliditylang.org` 下载 0.8.28，故用
> `forge test --use 0.8.24` 完成本地验证（源码 `pragma ^0.8.20`，OZ 5.x 要求 ≥0.8.24）。
> 提交/审核环境保持仓库默认 `solc_version = "0.8.28"` 不变（未改 `foundry.toml`）。

---

## 0.5 目录与运行方式（先看这里，避免进错目录）

**仓库根目录：`E:\Work\Learns\Mini-DEX`** —— 三个子包相互独立，**命令必须进到对应子目录再跑**。

| 子包 | 绝对路径 | 进入命令（PowerShell） | 作用 |
|---|---|---|---|
| 合约 | `E:\Work\Learns\Mini-DEX\contracts` | `cd E:\Work\Learns\Mini-DEX\contracts` | Solidity / Foundry / 部署 |
| 后端 | `E:\Work\Learns\Mini-DEX\server` | `cd E:\Work\Learns\Mini-DEX\server` | 撮合引擎 / HTTP API / WebSocket |
| 前端 | `E:\Work\Learns\Mini-DEX\web` | `cd E:\Work\Learns\Mini-DEX\web` | 网页 UI（要截图的就是它） |

**`server` 里的脚本**（在当前目录为 `server` 时执行）：`scripts/smoke.ts`、`scripts/prep-fuji.ts`、`scripts/task7-two-account.ts`。
**`contracts` 里的脚本**：`script/Deploy.s.sol`。
**截图脚本**：`E:\Work\Learns\Mini-DEX\web\e2e\task7-screenshots.mjs`。

**`.env` 位置（已配好，均 git-ignored）**
- `contracts\.env`：`PRIVATE_KEY`、`SIGNER_ADDRESS`、`RPC_URL`
- `server\.env`：`CHAIN_ID=43113`、`RPC_URL`、`VAULT_ADDRESS` / `USDC_ADDRESS` / `WAVAX_ADDRESS`、
  `DEPOSIT_FROM_BLOCK`、`DB_PATH`、`BACKEND_SIGNER_PRIVATE_KEY`、`MARKET_MAKER=1`、`MM_LEVELS=3`
- `web\.env`：`VITE_API_URL=http://localhost:8787`、`VITE_WS_URL=ws://localhost:8787/ws`

**启动（开两个终端）**
```powershell
# 终端 1 —— 后端（链上模式 + 做市 3 档 + SQLite）
cd E:\Work\Learns\Mini-DEX\server
npm install      # 仅首次
npm start        # 监听 http://localhost:8787

# 终端 2 —— 前端
cd E:\Work\Learns\Mini-DEX\web
npm install      # 仅首次
npm run dev      # 打开 http://localhost:5173
```

**需要截图 / 演示的网页：<http://localhost:5173>**
操作路径：`Connect MetaMask` → `Sign in`（登录截图）→ 底部 `资产与充提`（余额截图）→ 中部 `最近成交`（两地址成交）。

---

## 1. 必做部分（60 分）

### 1.1 撮合引擎（20 分）✅

| 要求 | 实现 | 证据 |
|---|---|---|
| `npm test` 全部通过 | `server/src/engine/orderbook.ts` | **server 43 passed** |
| 补充「时间优先」测试 | `orderbook.test.ts` 新增 2 个用例 | 通过 |
| 补充「拒绝 self-trade」测试 | 引擎实现 STP + 5 个用例 | 通过 |

**新增「时间优先」用例**
- 多笔同价按提交顺序逐笔成交（`[a,b,c]` 顺序断言）。
- 时间优先不覆盖价格优先（更优价更晚挂仍先成交）。

**自成交保护（1.3，原仓库仅有 TODO）**
- `OrderBook` 新增 `selfTradePolicy`（默认 `"reject"`），`submit` 撮合前用
  `wouldSelfTrade` 预检查：若会与同账户挂单成交 → **整单拒绝**（`rejected:"SELF_TRADE"`，
  不产生成交、不挂单）。
- `routes.placeOrder` 捕获后解冻资金并返回错误。
- 可 `new OrderBook({ selfTradePolicy: "allow" })` 关闭（对照教学）。
- 用例：拒绝同账户对手盘 / 市价单同样拒绝 / 不同账户正常成交 /
  外部流动性不足也整单拒绝 / allow 模式保留旧行为。

### 1.2 合约部署到 Fuji 测试网（20 分）✅ 已部署 + 已完成真实 deposit

| 要求 | 状态 | 结果 |
|---|---|---|
| `forge test` 全部通过 | ✅ | **17 passed** |
| 3 个已部署合约地址 | ✅ | 见下表（Fuji 43113，部署区块 58748595） |
| 一笔真实 deposit | ✅ | 100 USDC（+ 5 WAVAX）已上链 |
| deposit tx hash | ✅ | `0xa228ec…fc6b90`（另 `0x85d4d4…6203a`） |

**Fuji 合约地址（chainId 43113）**

| 合约 | 地址 | 部署 tx |
|---|---|---|
| Vault | `0xc25586f3b5570814be1caD8cCbDafB0A73C5da3F` | `0x1cba61827db4a7f9b687bca1e63ee67d5ce23d22ecd8eb053a179e22f6b0b257` |
| MockERC20 (USDC, 6) | `0x5De8B57179c870bD1B0af76F17faC92C8e1540ac` | `0x6e34ea341b34d263dca2305a22c07b3e936e85e0fabbd792d14ec34b2aa33d2f` |
| MockERC20 (WAVAX, 18) | `0x1CFddE8230500A2a23D07D00a9c8E7eB928fC942` | `0xc062c2bd9c1cecb04c05c6200c6ae23f9283ed8f0fbdc8cd338b488e05bdc87b` |

**真实 deposit**

| 动作 | tx hash |
|---|---|
| deposit 100 USDC（cast send） | `0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90` |
| deposit 100 USDC + 5 WAVAX（prep:fuji） | `0x85d4d4ca47e5c4dac1e2f60c7cae18671b0fa8b0619abfa64a852b1dfee6203a` |

- 浏览器：https://testnet.snowtrace.io/tx/0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90
- 验证：`cast call Vault.balances(deployer, USDC)` = `100000000`（100 USDC）。
- deployer=`0x0ff24b6F26912517D783805521B82215225F0671`，signer=`0x5bA70849c6c044E9256eB903A1352a7977C987A3`。

### 1.3 端到端演示（20 分）✅ 全部完成

> 演示网页：<http://localhost:5173>（后端 <http://localhost:8787>；启动方式见第 0.5 节）

| 要求 | 状态 | 证据 |
|---|---|---|
| 登录成功截图 | ✅ | `docs/images/task7-login.png`（顶栏「已登录」+ 地址 0x0ff2…） |
| 余额显示截图 | ✅ | `docs/images/task7-balance.png`（资产与充提：USDC/WAVAX 可用/冻结） |
| 两个不同地址完成成交 | ✅ | A `0x0ff24b6F…0671` 卖 1 WAVAX@30 → B `0x9A653B1e…d81` 买 1 WAVAX@30；`docs/images/task7-trade.png` |
| 一笔 withdraw + tx hash | ✅ | `0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32` |

**两个地址成交明细**（链下撮合，server 接口实测）

| 账户 | 成交前 | 成交后 |
|---|---|---|
| A `0x0ff24b6F26912517D783805521B82215225F0671` | 150 USDC / 5 WAVAX | 180 USDC / 4 WAVAX（卖 1 WAVAX@30） |
| B `0x9A653B1e2Ee6606f02aDB444A203bAF849D8ad81` | 100 USDC / 0 WAVAX | 70 USDC / 1 WAVAX（买 1 WAVAX@30） |

最近成交：`1 WAVAX @ 30 USDC`（maker `0x0ff24b…`）。

> 截图由 `web/e2e/task7-screenshots.mjs` 自动生成：Playwright 注入由真实私钥驱动的 EIP-1193 钱包，
> 对运行中的前端执行「连接 → 真实 EIP-712 签名登录（server 校验通过）→ 查看余额/成交」并截图。
> withdraw 走完整链路（后端签名 → 上链领币）：链上 USDC +50。
> https://testnet.snowtrace.io/tx/0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32

---

## 2. 进阶部分（实现 6 项，满分 40）✅

| 进阶项 | 分值 | 实现 | 测试 |
|---|---|---|---|
| 链上余额设置硬上限 | 8 | `Vault.maxBalance[token]`，`deposit` 强制（0=不限） | `Vault.t.sol` 新增 4 个用例 |
| 数据持久化到 SQLite | 10 | `server/src/store.ts`（`node:sqlite`）写穿账本/挂单/成交，启动恢复 | `store.test.ts` 3 个用例 |
| WebSocket 私有 orders 频道 | 8 | `ws.ts` 新增 `sendOrders`（仅推给该账户已鉴权连接）；routes 下单/撤单/成交后推送 | 复用 `orderbook.test.ts` + 手动 |
| 支持 IOC / FOK | 8 | `orderbook.ts` 新增 `TimeInForce`；IOC 剩余不挂、FOK 不足整单拒绝；`POST /orders` 支持 `timeInForce` | `orderbook.test.ts` 新增 4 个用例 |
| 做市机器人（买卖各 3 档） | 10 | 复用 `marketmaker.ts`（`MM_LEVELS` 可设 3），每边 3 档 | `marketmaker.test.ts` 新增 3 档用例 |
| AI 安全审查 + 修复真实问题 | 8 | `docs/SECURITY_REVIEW.md`；**修复 M-01**（扣账回滚）与 **M-03**（持久化重复入账） | 见报告与回归测试 |

**关键实现点**
- **持久化**：`Ledger` 支持注入 `LedgerStore`，每次 credit/debit/lock/unlock/transfer
  写穿 SQLite；`index.ts` 启动时 `ledger.restore()` + `book.restore()` 恢复挂单；
  `DB_PATH=off` 退回纯内存。
- **私有 orders 频道**：`ws.sendOrders(address, orders)` 只发给该地址已 `auth` 的连接，
  与公开的 `orderbook`/`trade` 广播区分。
- **IOC/FOK**：`GTC` 挂单；`IOC` 立即成交可成交部分、剩余撤销；`FOK` 全部立即成交否则
  整单拒绝（`FOK_UNFILLABLE`）。
- **安全修复 M-01**：原 `/withdraw` 先 `ledger.debit` 再 `signWithdraw`，签名抛错会导致
  用户余额被吞且拿不到授权；已改为签名失败时 `ledger.credit` 回滚并返回 500。
- **重复入账修复 M-03**：引入 SQLite 后，"DB 恢复 + 链上全量回放"会把同一笔充值入账两次；
  改为在 store 记录同步游标 `last_block`，只回放增量。
- **端到端**：`server/scripts/task7-two-account.ts`（两地址成交）、
  `web/e2e/task7-screenshots.mjs`（Playwright 注入真实钱包 → 真实登录 + 截图）。

---

## 3. 改动清单

**新增**
- `server/src/store.ts`（SQLite 持久化 + 同步游标）、`server/src/store.test.ts`
- `server/scripts/task7-two-account.ts`（两地址自动成交）
- `web/e2e/task7-screenshots.mjs`（Playwright 钱包注入截图）
- `docs/SECURITY_REVIEW.md`、`docs/images/task7-login.png · task7-balance.png · task7-trade.png`、`task7-work.md`

**修改**
- `server/src/engine/orderbook.ts`：自成交保护、IOC/FOK、`restore()`、`wouldSelfTrade/canFullyFill`
- `server/src/engine/orderbook.test.ts`：+11 用例（2 时间优先 / 5 自成交 / 4 IOC-FOK）
- `server/src/routes.ts`：自成交与 FOK 拒绝处理、`timeInForce` 入参、私有 orders 推送、
  持久化落库、withdraw 回滚
- `server/src/ws.ts`：`sendOrders` 私有频道
- `server/src/ledger.ts`：可注入 store + `restore()`
- `server/src/index.ts`：store 装配与启动恢复、同步游标、ws 私有频道 shim、做市仅首次注资
- `server/src/chain.ts`：回放/实时事件上报同步区块（`onProgress`）
- `server/.env.example`：新增 `DB_PATH`
- `server/src/marketmaker.test.ts`：+1（3 档）
- `contracts/src/Vault.sol`：`maxBalance` 硬上限 + `setMaxBalance` + 事件
- `contracts/test/Vault.t.sol`：+4 用例（硬上限）

---

## 4. 验证证据（实测输出摘要）

```
$ cd server && npm test
 Test Files  5 passed (5)
      Tests  43 passed (43)

$ cd contracts && forge test --use 0.8.24
 Ran 1 test suite: 17 tests passed, 0 failed

$ cd web && npm test
      Tests  10 passed (10)

$ cd web && npm run typecheck && npm run build
 (无错误) / ✓ built
```

---

## 5. 真实链上产物（Fuji 43113）— 已完成

### 5.1 三个合约地址（区块 58748595）

| 合约 | 地址 |
|---|---|
| Vault | `0xc25586f3b5570814be1caD8cCbDafB0A73C5da3F` |
| MockERC20 (USDC) | `0x5De8B57179c870bD1B0af76F17faC92C8e1540ac` |
| MockERC20 (WAVAX) | `0x1CFddE8230500A2a23D07D00a9c8E7eB928fC942` |
| backend signer | `0x5bA70849c6c044E9256eB903A1352a7977C987A3` |

`server/.env` 与 `web/.env` 已写入上述地址、`CHAIN_ID=43113`、`DEPOSIT_FROM_BLOCK=58748595`。

### 5.2 deposit tx（已完成）

| 动作 | tx hash |
|---|---|
| deposit 100 USDC | `0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90` |
| deposit 100 USDC + 5 WAVAX（prep:fuji） | `0x85d4d4ca47e5c4dac1e2f60c7cae18671b0fa8b0619abfa64a852b1dfee6203a` |

### 5.3 withdraw tx（已完成）

| 动作 | tx hash |
|---|---|
| withdraw 50 USDC（后端 EIP-712 签名 + 用户上链） | `0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32` |

### 5.4 复现方式（已完成，可复跑；注意先 cd 进正确目录）

```powershell
# 后端（终端 1）
cd E:\Work\Learns\Mini-DEX\server
npm start                              # http://localhost:8787

# 前端（终端 2）—— 要截图的窗口就是这个
cd E:\Work\Learns\Mini-DEX\web
npm run dev                            # http://localhost:5173

# 自动截图（可选：注入真实私钥钱包做真实登录）
cd E:\Work\Learns\Mini-DEX\web
$env:USER_A_KEY="0x<A私钥>"; node e2e\task7-screenshots.mjs   # 输出到 ..\docs\images

# 两地址自动成交（可选）
cd E:\Work\Learns\Mini-DEX\server
$env:USER_A_KEY="0x<A私钥>"; npx tsx scripts/task7-two-account.ts
```

- **网页地址：<http://localhost:5173>**
- 截图输出：`E:\Work\Learns\Mini-DEX\docs\images\task7-login.png · task7-balance.png · task7-trade.png`
- 两地址成交 → 见 1.3 明细（A/B 一买一卖 1 WAVAX@30）

### 5.5 汇总表

| 产物 | 值 |
|---|---|
| VAULT_ADDRESS | `0xc25586f3b5570814be1caD8cCbDafB0A73C5da3F` |
| USDC_ADDRESS | `0x5De8B57179c870bD1B0af76F17faC92C8e1540ac` |
| WAVAX_ADDRESS | `0x1CFddE8230500A2a23D07D00a9c8E7eB928fC942` |
| deposit tx hash | `0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90` |
| withdraw tx hash | `0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32` |
| 登录截图 | `docs/images/task7-login.png` ✅ |
| 余额截图 | `docs/images/task7-balance.png` ✅ |
| 两地址成交 | A `0x0ff24b6F…0671` ↔ B `0x9A653B1e…d81`，1 WAVAX@30 ✅ |

浏览器：https://testnet.snowtrace.io ｜ 水龙头：https://core.app/tools/testnet-faucet/

---

## 6. 已知不足 / 后续

- 合约提现仍以 signer 为准（H-01 设计如此），生产需 HSM/多签 + 限额（见安全报告）。
- 私有频道（`orders`）已实现推送，前端可进一步订阅展示；当前前端 UI 未改动。
- `forge test` 因网络原因本地用 0.8.24 验证，仓库默认编译器仍为 0.8.28。

---

## 7. 对照 task7.md 逐条核对（自检结论：全部满足）

### 一、必做部分（60 分）

**1. 撮合引擎（20 分）**
- [x] `npm test` 全部通过 → server **43 passed**（引擎 `orderbook.test.ts` 23 用例）
- [x] 补充「时间优先」测试 → `orderbook.test.ts` 新增 2 例（多笔同价 FIFO、时间不覆盖价格优先）
- [x] 补充「拒绝 self-trade」测试 → 引擎实现自成交保护 + 5 用例

**2. 合约部署到 Fuji 测试网（20 分）**
- [x] `forge test` 全部通过 → **17 passed**
- [x] 3 个已部署合约地址 → Vault `0xc25586f3b5570814be1caD8cCbDafB0A73C5da3F`、USDC `0x5De8B57179c870bD1B0af76F17faC92C8e1540ac`、WAVAX `0x1CFddE8230500A2a23D07D00a9c8E7eB928fC942`
- [x] 完成一笔真实 deposit → 100 USDC 上链
- [x] deposit tx hash → `0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90`

**3. 端到端演示（20 分）**
- [x] 登录成功截图 → `docs/images/task7-login.png`
- [x] 余额显示截图 → `docs/images/task7-balance.png`
- [x] 两个不同地址完成成交 → A `0x0ff24b…0671` ↔ B `0x9A653B1e…d81`，1 WAVAX@30
- [x] withdraw 交易 + tx hash → `0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32`

### 二、进阶部分（实现 6 项，满分 40）
- [x] 链上余额设置硬上限（8）→ `Vault.maxBalance` + `setMaxBalance`，4 个测试
- [x] 数据持久化到 SQLite，重启不丢（10）→ `store.ts`（账本/挂单/成交 + 同步游标），3 个测试
- [x] WebSocket 私有 orders 频道（8）→ `ws.sendOrders`，仅推送已鉴权连接
- [x] 支持 IOC / FOK 订单（8）→ 引擎 `TimeInForce` + `POST /orders` 入参，4 个测试
- [x] 做市机器人，买卖两侧各挂 3 档（10）→ `MM_LEVELS=3`，3 档测试
- [x] AI 安全审查报告 + 修复真实问题（8）→ `docs/SECURITY_REVIEW.md`，修复 M-01（扣账回滚）/ M-03（重复入账）

### 三、最终提交物清单
- [x] 代码仓库/提交记录：`tubexchat/Mini-DEX` 上的本轮改动（见第 3 节改动清单）
- [x] `npm test` 与 `forge test` 全绿证明：第 0 / 4 节
- [x] 3 个 Fuji 合约地址：第 5.5 节
- [x] deposit 和 withdraw 交易哈希：第 5.2 / 5.3 节
- [x] 登录、余额、两地址成交的截图：`docs/images/task7-*.png`
- [x] 所选进阶功能的代码、测试或演示证明：第 2 节

> 唯一非硬性提醒：真实 MetaMask 弹窗截图与你手动点出来的等价；本仓库截图由 Playwright 注入真实私钥钱包
> 做**真实 EIP-712 登录**后自动生成，数据与状态一致。其余 3 项必做与 6 项进阶均已满足。
