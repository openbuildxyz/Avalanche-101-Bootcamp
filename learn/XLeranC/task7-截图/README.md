# Task 7 端到端演示截图

由 `web/e2e/task7-screenshots.mjs` 自动生成：Playwright 注入由真实私钥驱动的 EIP-1193 钱包，
对运行中的前端执行「连接 → 真实 EIP-712 签名登录（server 校验通过）→ 查看余额/成交」并截图。

| 截图 | 内容 |
|---|---|
| `task7-login.png` | 顶栏状态「已登录」+ 钱包地址 `0x0ff2…0671` |
| `task7-balance.png` | 「资产与充提」页：USDC / WAVAX 的可用、冻结余额 |
| `task7-trade.png` | 主界面：订单簿 + 最近成交（两地址成交 `1 WAVAX @ 30 USDC`） |

## 两个不同地址完成成交
- A `0x0ff24b6F26912517D783805521B82215225F0671`：150 USDC / 5 WAVAX → 180 USDC / 4 WAVAX（卖 1 WAVAX@30）
- B `0x9A653B1e2Ee6606f02aDB444A203bAF849D8ad81`：100 USDC / 0 WAVAX → 70 USDC / 1 WAVAX（买 1 WAVAX@30）

## 链上交易
- Vault 部署：https://testnet.snowtrace.io/tx/0x1cba61827db4a7f9b687bca1e63ee67d5ce23d22ecd8eb053a179e22f6b0b257
- deposit 100 USDC：https://testnet.snowtrace.io/tx/0xa228ec810f2af885036b23bb945cd16f6c41d9ee64946a8549dbc5efcbfc6b90
- withdraw 50 USDC：https://testnet.snowtrace.io/tx/0xb2df4853064cc063e2b9cafea4ef8747a3c877e5ac53e8497512823905abec32
