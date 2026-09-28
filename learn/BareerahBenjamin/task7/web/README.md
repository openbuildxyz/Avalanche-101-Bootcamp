# mini-dex · web

Vite + React 18 + TypeScript + wagmi v2 + viem v2 的单页前端，对应课程设计 §3.6。
只用 MetaMask（injected 连接器），UI 不用组件库；K 线用 TradingView 开源的 `lightweight-charts`。

## 安装 & 运行

```bash
cd mini-dex/web
npm install
cp .env.example .env        # 默认指向 http://localhost:8787
npm run dev                 # http://localhost:5173
```

其他脚本：`npm test`（vitest，行情源纯函数单测）、`npm run typecheck`（tsc）、`npm run build`（产物在 dist/）、`npm run preview`。

`.env` 三项：

```
VITE_API_URL=http://localhost:8787
VITE_WS_URL=ws://localhost:8787/ws
VITE_BINANCE_SYMBOL=AVAXUSDT     # K 线 / 行情条的价格源（Binance 交易对）
```

链 ID、Vault 地址、代币地址**不在前端写死**，全部来自后端 `GET /config`。
钱包连的链和后端要求的链不一致时，顶栏会出现 "Switch to …" 按钮，点一下 MetaMask 会自动切换（没有的链会自动添加）。

## 页面布局（仿现货交易所）

```
┌ 顶栏：MiniDex · 现货 │ 目标链 · Connect / Sign in · 状态 ───────────────────────┐
├ 行情条：WAVAX/USDC · 最新价 · 24h 涨跌/高/低/量/额 · 本所最新成交 · 价格源 Binance ┤
├──────────────┬──────────────────────────────────────┬──────────────────────────┤
│ 订单簿       │ K 线（Binance AVAXUSDT，1m…1d）        │ 最近成交（本所撮合）      │
│ 12 档 × 2    │ 蜡烛 + 成交量 + 十字光标 OHLC          ├──────────────────────────┤
│ 累计深度条   │                                      │ 下单：买/卖 · 限价/市价   │
│ 中间最新成交 │                                      │ 可用余额 · 25/50/75/100% │
├──────────────┴──────────────────────────────────────┴──────────────────────────┤
│ 底部 Tab：当前委托 ｜ 资产与充提（余额 / 水龙头 / 充值 / 提现）                   │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**两套数据源，别混淆：**

| 数据 | 来源 | 说明 |
|---|---|---|
| 订单簿 / 最近成交 / 余额 / 委托 | mini-dex 后端（REST 初始化 + WS 推送，WS 断了退回轮询） | 这是交易所本身 |
| K 线 / 行情条 24h 数据 / "参考价" | Binance 公共行情（`AVAXUSDT`） | 只做参考价，不参与撮合 |

## Binance 行情源（`src/lib/binance.ts`）

- 历史 K 线：REST `GET /api/v3/klines`，500 根；24h 行情：`GET /api/v3/ticker/24hr` 每 5 秒轮询。公共接口带 `Access-Control-Allow-Origin: *`，浏览器直连，不经过后端。
- 实时 K 线：WS `<symbol>@kline_<interval>`。主机按顺序尝试 `data-stream.binance.vision` → `stream.binance.com:9443` → `stream.binance.com:443`；
  某个主机连上但一条消息都没收到（例如 451 地区限制）就换下一个，**全部失败退化为每 2 秒 REST 轮询最后两根 K 线**。右上角 chip 会显示当前状态：实时 / 轮询 / 行情源不可用。
- REST 主机同样有故障切换：`data-api.binance.vision` → `api.binance.com` → `api1.binance.com`。
- 切周期时先订阅实时流再拉历史，实时推送先攒着，历史回来后合并，避免错位。

## 目录

```
src/
  main.tsx            WagmiProvider + QueryClientProvider
  App.tsx             交易所布局 + 数据源（mini-dex REST/WS；Binance K 线/行情）
  lib/
    api.ts            后端 HTTP 封装 + JWT 存取（key = minidex:jwt:<chainId>:<address>）
    ws.ts             useMiniDexSocket：订单簿 / 成交 / 余额推送，断线退避重连
    binance.ts        Binance 行情源：K 线解析/合并、REST 故障切换、WS → 轮询退化（纯函数有单测）
    useBinance.ts     useBinanceKlines / useBinanceTicker
    abi.ts            Vault / ERC20 ABI（parseAbi 人类可读格式）
    chains.ts         Fuji + anvil 链定义、wagmi config
    useAuth.ts        EIP-712 签名登录
    useConfig.ts      GET /config
    format.ts         格式化小工具（fmtNum / fmtFixed / fmtPct / fmtCompact / pricePrecision）
  components/
    Header.tsx        顶栏：连接 / 切链 / 登录 / 状态
    TickerBar.tsx     行情条（Binance 最新价 + 24h 数据 + 本所最新成交）
    Chart.tsx         K 线（lightweight-charts 蜡烛 + 成交量 + 周期切换 + OHLC 图例）
    OrderBook.tsx     12 档订单簿，累计深度条，中间最新成交价 + Binance 参考价
    Trades.tsx        最近成交
    OrderForm.tsx     下单（可用余额、百分比快捷键、参考价一键填入）
    BottomPanel.tsx   底部 Tab：当前委托 / 资产与充提
    MyOrders.tsx      我的挂单 + 撤单
    Wallet.tsx        余额、水龙头、充值(approve→deposit)、提现
    TxStatus.tsx      交易 hash / 确认状态
```

## MetaMask：本地 anvil 模式

1. 先启动 `anvil`，部署合约，把地址填进 `server/.env`，启动 server。
2. MetaMask → 设置 → 网络 → 添加网络（手动）：
   - 网络名称：`Anvil (local)`
   - RPC URL：`http://127.0.0.1:8545`
   - 链 ID：`31337`
   - 货币符号：`ETH`
3. 导入 anvil 默认账户 #0（MetaMask → 导入账户 → 私钥）：
   ```
   0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
   ```
   这是公开的测试私钥，只在本地用，**不要往里转真钱**。
4. anvil 重启后 nonce 会归零，MetaMask 会报 nonce 错误：设置 → 高级 → 清除活动和 nonce 数据。

## MetaMask：Avalanche Fuji 模式

- 网络名称：`Avalanche Fuji C-Chain`
- RPC URL：`https://api.avax-test.network/ext/bc/C/rpc`
- 链 ID：`43113`
- 货币符号：`AVAX`
- 区块浏览器：`https://testnet.snowtrace.io`
- 测试币水龙头（付 gas 用的 AVAX）：`https://core.app/tools/testnet-faucet/`

页面里的 "mint 1000 USDC / 10 WAVAX" 是合约自带的水龙头，领的是交易用的测试代币，和上面付 gas 的 AVAX 是两回事。

## 页面流程

1. Connect MetaMask → 如链不对先 Switch → Sign in（EIP-712 签名，不花 gas）。
2. 底部"资产与充提" Tab：mint 测试币 → 充值：第一次会先 `approve`，再 `deposit`；链上确认后等后端监听到 `Deposit` 事件入账（"等待后端入账…"）。
3. 点订单簿某一档价格（或"参考价"）→ 右侧填数量（或点 25%/50%…）→ 下单；成交笔数会显示在按钮下方。
4. 提现：后端签 EIP-712 授权并先扣可用余额，再由你自己调用 `Vault.withdraw` 上链。

后端是内存态，重启后交易所余额和挂单都会清零（链上余额不受影响）。

## 已知限制

- K 线是 Binance AVAXUSDT 的价格，不是本所撮合价；本所成交没有画到图上（课后可以加 markers）。
- 后端 CORS 只放行 `localhost:5173` / `127.0.0.1:5173`，换端口跑 `vite` 时 REST 会被浏览器拦（WS 不受影响）。
