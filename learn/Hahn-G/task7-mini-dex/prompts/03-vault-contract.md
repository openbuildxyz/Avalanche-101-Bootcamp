# Prompt 03 · Vault 合约 + Foundry（第 4 章演示 3）

用 Foundry 在 contracts/ 写两个合约，先写测试再写实现：

MockERC20：OpenZeppelin ERC20，构造参数 name/symbol/decimals，任何人可调 mint(to, amount)（测试币水龙头）。

Vault（继承 OZ EIP712("MiniDexVault","1")、Ownable、ReentrancyGuard）：
- address signer（后端签名地址）；mapping allowedTokens；mapping balances[user][token]（链上记账，仅展示用）；mapping usedNonces。
- deposit(token, amount)：require allowed 且 amount>0，safeTransferFrom，balances 累加，emit Deposit(user, token, amount)。
- withdraw(token, amount, nonce, deadline, signature)：require block.timestamp<=deadline、!usedNonces[nonce]；用 EIP-712 typehash
  Withdraw(address user,address token,uint256 amount,uint256 nonce,uint256 deadline) 算 digest，ECDSA.recover 必须等于 signer，user 必须等于 msg.sender；标记 nonce 已用，safeTransfer，emit Withdraw(user, token, amount, nonce)。
- 提供 hashWithdraw(...) 公开 view 返回 digest，方便测试和后端对拍。
- setSigner / setAllowedToken 仅 owner。

测试（Vault.t.sol）：deposit 成功且发事件；未允许的 token 充值失败；用 vm.sign 给 signer 私钥签名后 withdraw 成功；同 nonce 重放失败；过期 deadline 失败；错误 signer 失败；msg.sender != user 失败。

部署脚本 Deploy.s.sol：部署 USDC(6)、WAVAX(18)、Vault(signer 从 env SIGNER_ADDRESS)，allow 两个 token，给部署者 mint 一百万 USDC + 一万 WAVAX，console.log 三个地址，格式要能直接粘进 .env。

写完跑 forge build && forge test -vvv 把结果贴给我。

## 课上追问

- "这个合约里提现金额没有用链上 balances 做上限，意味着什么？Primit 的 Vault 是怎么做的（amount <= _balances[user] 硬上限 + 每用户递增 nonce + 每日结算上限）？帮我加上链上余额硬上限并补测试。"
