# Prompt 00 · 项目总 spec（课上第一条 prompt）

> 用法：新建空目录后，把下面整段发给 AI。目的不是让它一次写完，而是让它**先复述理解、列出计划**，你确认后再分模块推进。

我要做一个教学用的迷你订单簿交易所 mini-dex，请先不要写代码，先用 10 行以内复述你对需求的理解并列出实现顺序，等我确认。

范围：
- 现货交易对 WAVAX/USDC，价格-时间优先的撮合引擎，跑在链下（Node + TypeScript）。
- 资金托管在 Avalanche Fuji 测试网的 Vault 合约里（Solidity + Foundry）；两个测试代币 MockUSDC(6 位小数) / MockWAVAX(18 位小数) 都有公开 mint 水龙头。
- 用户用 MetaMask 连接、切到 Fuji、用 EIP-712 签名登录换 JWT；充值 = approve + deposit；提现 = 后端 EIP-712 签授权 → 用户自己调 Vault.withdraw。
- 前端 Vite + React + wagmi：订单簿、下单、最近成交、余额、充提。
- 不做：永续/杠杆/清算、数据库持久化、多交易对。

目录：contracts/（Foundry）、server/（Hono + ws + viem + jose + vitest）、web/（Vite + React + wagmi）。

接口约定（后面每个模块都要遵守）：
- 金额在后端内部用 bigint、8 位小数定点；API 用十进制字符串。
- Vault：deposit(token, amount)、withdraw(token, amount, nonce, deadline, signature)，事件 Deposit(user, token, amount)、Withdraw(user, token, amount, nonce)，EIP-712 domain name="MiniDexVault" version="1"。
- 登录：GET /auth/nonce?address → POST /auth/login {address, nonce, signature} → {token}；typed data domain {name:"MiniDex", version:"1", chainId}，types Login[address, nonce(string), statement(string)]。
- 下单：POST /orders {side, type, price?, qty} → {order, fills}；GET /orderbook；GET /trades；DELETE /orders/:id；POST /withdraw {token, amount} → {nonce, deadline, signature, ...}。
- WS：ws://host/ws 推 {type:"orderbook"|"trade"|"balance"}。

工作方式：每个模块先写测试再写实现；每写完一个模块就运行测试并把结果贴给我；不要一次生成超过 5 个文件。
