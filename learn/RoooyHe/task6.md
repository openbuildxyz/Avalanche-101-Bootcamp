# Task6：探索 AI Agent 支付新范式——以 Kite AI 为例

> 对应课程：第六章
> 提交人：RoooyHe

## 基础层任务（必做）✅ 已完成

### 1. 注册并登录

访问 https://passport-web.dev.gokite.ai/ 注册账号（roooyhe@163.com），完成邮箱验证并登录，创建 Passkey。

![注册登录成功](./task6register.png)

### 2. 领取测试 USDC

- Overview 页面 Receive → 复制钱包地址：`0xD0E0a181617Aa6beb518f0A818E693B8A66CD6dE`

![Receive 地址](./Task6Address.png)

- Circle Faucet（https://faucet.circle.com/）选择 USDC / Arc Testnet，领取 20 testnet USDC 成功：

![Faucet 领取成功](./Task6faucet.png)

### 3. Playground 完整交互

在 Playground 中与 **Recruiting Agent (SDK)**（Simulated Data Provider）完成一次完整 Buyer-Seller 交互：

1. **发起交互 / 提案阶段**：选择 Agent，双方签署合同（Contract signed by both agents）
2. **Buyer 出资**：`FUND 1.00 USDC IN ESCROW`（Powered by Kite Escrow）→ Buyer funded
3. **Seller 交付**：Delivery landed → `VERIFIED DELIVERY`（443 bytes · hash checked，哈希校验通过）
4. **Buyer 确认接受并释放资金**：Partial settlement — 3 records accepted, 2 refunded；Buyer 评分 6/10 完成闭环（"that's the whole loop"）

![Playground 完整交互](./Task6Playground.png)

### 合格标准对照

- ✅ 完成注册、Passkey 创建
- ✅ Circle Faucet 领取测试 USDC
- ✅ Playground 真实走完一次完整交互（提案 → 出资 → 交付 → 确认 → 释放资金），关键节点截图齐全

## 进阶层任务（选做，加分项）进行中

- ✅ Kite CLI 安装成功（kpass 6.7.0 / kagent 6.7.0，Windows 下手动安装并补齐 skills 包）
- ✅ `kpass login` 登录 Kite Passport 成功（OTP 验证）
- ✅ Buyer Agent 初始化成功：runtime key 生成，地址 `0x6c2a78DBc42B3D18DE49Cf978346Ca512BAEc3C5`，绑定 `did:kite:ind-roooyhe:roooyhe-buyer`（active）
- ✅ 目录检索：找到 Recruiting seller agent `did:kite:ind-yusuke:denny`（Talent-recruiting intake agent，offering `recruiting-intake`，2.5 USDC/次，workflow `recruiting/v1`）
- ✅ 发起 agreement proposal：`8b9c7e74-a8cb-4077-a0a6-166d1c04c954`（状态 PROPOSED，agreement 共签已 relay）
- ⏳ 等待 Seller runtime 接受提案并交付（Devnet seller 响应较慢）

## 截止时间

9月27日 24:00:00 (UTC+8)
