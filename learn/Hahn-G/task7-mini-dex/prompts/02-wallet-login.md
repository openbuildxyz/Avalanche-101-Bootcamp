# Prompt 02 · MetaMask 连接 + EIP-712 登录（第 3 章演示 2）

## 后端（server）

在 server 里加登录模块 auth.ts：
- GET /auth/nonce?address=0x.. 返回 {nonce}（随机 hex，5 分钟有效、一次性）。
- POST /auth/login {address, nonce, signature}：用 viem 的 verifyTypedData 校验，domain {name:"MiniDex", version:"1", chainId(从 env)}，types {Login:[{address,address},{nonce,string},{statement,string}]}，message {address, nonce, statement:"Sign in to MiniDex"}；通过后用 jose 签 HS256 JWT（24h）。
- 一个 Bearer 中间件把 address 注入到 context。
- 所有地址统一转小写存储和比较（我们线上因为大小写不一致出过查不到用户的事故）。
先写测试：用 viem 的 privateKeyToAccount 生成账号、本地 signTypedData，再走一遍 nonce → login，断言能拿到 token；再测"同一 nonce 用两次要失败"。

## 前端（web）

用 wagmi v2 + injected 连接器做 Header 组件：
- Connect 按钮 → 显示缩略地址；
- 从 GET /config 读 chainId，和钱包当前链比较，不一致显示 "Switch to Fuji" 按钮，用 useSwitchChain（wagmi 会自动 wallet_addEthereumChain）；**不要把 chainId 硬编码在前端**。
- Sign in：GET nonce → useSignTypedData（domain/types/message 和后端完全一致，primaryType "Login"）→ POST login → token 存 localStorage，key 用 `minidex:jwt:<chainId>:<address>`。
- 状态 pill：未连接 / 链错误 / 已连接未登录 / 已登录。
监听 accountsChanged：换账号就清掉 token。
