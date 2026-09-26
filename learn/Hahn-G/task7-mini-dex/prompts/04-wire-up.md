# Prompt 04 · 串起来：充值入账、提现签名、前端联动（第 5 章）

## server/chain.ts

用 viem createPublicClient(RPC_URL) 的 watchContractEvent 监听 Vault 的 Deposit(address indexed user,address indexed token,uint256 amount)：
- 按 env 里的 USDC_ADDRESS/WAVAX_ADDRESS 把 token 地址映射成 "USDC"/"WAVAX"，按 6/18 位小数换算成内部 8 位定点，credit 到账本，并通过 WS 推 {type:"balance"} 给该用户。
- 写一个 signWithdraw({user, token, amount, nonce, deadline})：用 BACKEND_SIGNER_PRIVATE_KEY 的账号 signTypedData，domain {name:"MiniDexVault", version:"1", chainId, verifyingContract: VAULT_ADDRESS}，types 和合约里的 Withdraw 完全一致。
- 如果 VAULT_ADDRESS 为空就进入"离线模式"：不监听链、开放 POST /dev/faucet 直接给账本加钱，方便没有链也能演示撮合。启动时清楚地打印当前模式。

## server/routes.ts 里的 /withdraw

POST /withdraw {token, amount}：从 available 扣掉 → 生成随机 uint64 nonce、deadline = now+10 分钟 → signWithdraw → 返回 {token, tokenAddress, amount(按 token 小数位的 wei 字符串), nonce, deadline, signature, vault}。
在注释里说明：生产环境要记录 in-flight 的提现签名（nonce 不能重复签出）、要监听链上 Withdraw 事件做对账——Primit 就出过同一 nonce 重复签出导致一笔事件刷两行的事故。

## web/Wallet.tsx

充值表单两步按钮：allowance 不够先 approve(vault, amount)，再 deposit(token, amount)；用 useWaitForTransactionReceipt 等回执；回执后显示"等待后端入账…"，余额靠 WS 推送刷新。
提现表单：POST /withdraw 拿到签名后 writeContract Vault.withdraw(token, amount, nonce, deadline, signature)。
水龙头按钮：mint 1000 USDC / 10 WAVAX 到当前地址。
