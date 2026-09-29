# Task 6：Kite AI Agent Passport 作业记录

## 当前状态

该任务要求真实注册 Kite Agent Passport、邮箱验证、创建设备 Passkey、从 Circle Faucet 领取 Arc Testnet USDC，并在 Playground 中由本人确认 Seller 交付和释放资金。这些步骤绑定个人邮箱、设备凭据和网页验证码，不能用虚构数据替代，也不能由作业代码模拟完成。

当前代码类任务（Task3/4/5/7）均可独立完成；Task6 已整理好以下本人操作清单。完成后把截图放入 `images/task6/` 并替换下方占位符即可提交。

## 基础层操作与证据清单

1. 打开 [Kite Agent Passport Devnet](https://passport-web.dev.gokite.ai/)，使用本人的邮箱注册并完成邮件验证。
2. 在浏览器/系统弹窗中创建 Passkey。
3. 在 Overview 选择 `Receive → Copy address`，记录钱包地址。
4. 打开 [Circle Faucet](https://faucet.circle.com/)，Token 选 `USDC`，Network 选 `Arc Testnet`，领取测试币。
5. 返回 Playground，选择第一个 `Recruiting Agent (SDK)`。
6. 发起招聘任务，等待 Seller 返回结果；确认交付内容后由本人点击接受并释放测试资金。

| 必需证据 | 文件占位 |
| --- | --- |
| 注册成功、邮箱验证、Passkey 创建 | `images/task6/01-passport.png` |
| 钱包地址与 Faucet 成功 | `images/task6/02-faucet.png` |
| 发起交互 / 提案 | `images/task6/03-proposal.png` |
| Seller 返回结果 | `images/task6/04-delivery.png` |
| Buyer 接受并释放资金 | `images/task6/05-released.png` |

## 进阶层（选做）

基础层完成后再安装 Kite CLI；安装脚本属于从网络下载并执行，应先核对官方来源。随后按顺序完成登录、初始化 Buyer Agent、搜索 Recruiting Seller、发起任务、接受交付和释放资金，并保存终端输出。

建议任务提示：

```text
使用我的 Kite Passport 账户登录
检查我的余额
注册一个 buyer agent
找一个提供猎头服务的 seller agent
使用这个猎头智能体，帮我寻找一位高级 AI 开发工程师，北上广深范围都可以
```

## 安全说明

- 不把邮箱验证码、Passkey、私钥、助记词或会话 Token 写入仓库。
- CAPTCHA、邮箱验证码和 Passkey 必须由本人完成。
- “释放资金”即使是测试币，也应在确认 Seller 交付内容后由本人操作。
