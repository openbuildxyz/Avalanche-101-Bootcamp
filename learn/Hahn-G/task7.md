# Task 7：Mini-DEX 撮合、Fuji 部署与端到端验证

> 课程仓库：[tubexchat/Mini-DEX](https://github.com/tubexchat/Mini-DEX)  
> 作业代码：[`task7-mini-dex`](./task7-mini-dex/)

## 1. 撮合引擎（20 分）

撮合规则为价格优先、同价时间优先（FIFO），成交价采用 maker 价格。原仓库已有 FIFO 用例，但实现明确允许 self-trade。我在 [`orderbook.ts`](./task7-mini-dex/server/src/engine/orderbook.ts) 中加入撮合前原子检查：如果新订单会与同一 owner 的任一对手单交叉，整笔订单抛出 `OrderBook: self-trade rejected`，且不会先成交一部分或改变原订单簿。

[`orderbook.test.ts`](./task7-mini-dex/server/src/engine/orderbook.test.ts) 新增自成交拒绝测试，同时确认 maker 剩余数量、asks 和 bids 均保持不变。

```text
Test Files  4 passed (4)
Tests       29 passed (29)
TypeScript  tsc --noEmit passed
```

其中订单簿测试 13 项，包含“时间优先：同价 FIFO”和“拒绝 self-trade”。

## 2. Fuji 合约部署与真实资金操作（20 分）

网络：Avalanche Fuji C-Chain，Chain ID `43113`。

| 合约 | 地址 | 部署交易 |
| --- | --- | --- |
| Mock USDC | [`0x0925...E7bA`](https://testnet.snowtrace.io/address/0x0925646D3497B14462723FDc2Fd91b617fd1E7bA) | [`0x8637...cd67`](https://testnet.snowtrace.io/tx/0x8637601560fe739854a4f23218fc8e914b842c13f4da523a7b9a0bb7f5e7cd67) |
| Mock WAVAX | [`0xA903...9cC6`](https://testnet.snowtrace.io/address/0xA903E26BF56fB4e022Ffbb82e058DEa2B1C99cC6) | [`0xdeff...6537`](https://testnet.snowtrace.io/tx/0xdeff7fce0b7337623ba53e03d9366797ccd1d40c231fe90bfaa2e8dab3c36537) |
| Vault | [`0xBc89...8dff`](https://testnet.snowtrace.io/address/0xBc89A17E407A95b02b1DeE3347B6346dDF988dff) | [`0xcf81...2e5f`](https://testnet.snowtrace.io/tx/0xcf819e962d37a9bea63682248b7711a9778b24e1a66a43b3e01c838215182e5f) |

Foundry 测试结果：**13 passed, 0 failed**。

真实链上操作：

| 操作 | 数量 | 交易 |
| --- | ---: | --- |
| Approve | 100 USDC | [`0x7942...31cc`](https://testnet.snowtrace.io/tx/0x794226d51fd1d99001606a8ac9b5832e7cee9028dd67c6568622447e8cab31cc) |
| Deposit | 100 USDC | [`0xb199...1642`](https://testnet.snowtrace.io/tx/0xb19905a2e23e3ad8d33f2c439204f0767033bb70f2a1706a21a12cc8d2b41642) |
| Withdraw | 25 USDC | [`0x87d2...8074`](https://testnet.snowtrace.io/tx/0x87d263a7fc5d5178d5b80e97a7656e9637570c4fac84a61dfc89325f10268074) |

提现使用 Vault 的 EIP-712 签名、独立 nonce `2026092601` 和 deadline。操作后 Vault 实际持有 `75 USDC`，链上 `balances(user, USDC)` 同样为 `75 USDC`。

## 3. 端到端演示（20 分）

### Fuji 登录与余额回放

后端以 Fuji 链上模式启动，从 Vault 部署区块回放事件：

```text
[chain] 回放 58727581 → 58727778：Deposit 1 笔，Withdraw 1 笔
账户: 0x5bbD...0CDA | server: chain
当前交易所余额: {"USDC":{"available":"75","locked":"0"},"WAVAX":{"available":"0","locked":"0"}}
```

登录使用钱包对 EIP-712 nonce 签名，后端验签后签发 JWT；余额并非手填，而是由真实 `Deposit` / `Withdraw` 事件回放得到。

### 两个不同地址成交

使用 [`smoke.ts`](./task7-mini-dex/server/scripts/smoke.ts) 生成并登录两个不同钱包：

- Seller：`0x4Dc9...EdF9`
- Buyer：`0x82bF...f5c7`
- Seller 挂出 `2 WAVAX @ 25 USDC`
- Buyer 市价买入 `1.5 WAVAX`
- 成交：`1.5 WAVAX @ 25 USDC`，maker 为 Seller
- Seller 余额：`10037.5 USDC`，剩余挂单 `0.5 WAVAX`
- Buyer 余额：`9962.5 USDC + 101.5 WAVAX`
- 脚本最终输出：`SMOKE OK`

这证明登录、余额、下单、撮合和结算使用的是两个不同地址。

## 4. 进阶项

仓库已有做市机器人模块 [`marketmaker.ts`](./task7-mini-dex/server/src/marketmaker.ts)，可以镜像外部 AVAX/USDT 盘口，并维护买卖两侧多档流动性。本次测试包含 9 个做市相关用例；配置 `MARKET_MAKER=1`、`MM_LEVELS=3` 即可让两侧各维护 3 档。为避免作业演示依赖外部中心化 API，本次必做 E2E 使用确定性的本地资金与订单。

## 5. 复现命令

```bash
cd task7-mini-dex/server
npm ci
npm test
npm run typecheck
npm start
npm run smoke

cd ../contracts
forge test -vv
forge script script/DepositWithdraw.s.sol:DepositWithdraw --rpc-url fuji --broadcast --slow
```

私钥只存在被 `.gitignore` 排除的 `.env`，未写入源码、README 或广播目录。

