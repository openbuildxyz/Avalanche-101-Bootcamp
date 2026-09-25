# Task7 - Perp DEX 实战

## 代码仓库

- Repository: https://github.com/kKassidy/Mini-DEX
- Matching Engine commit: `a65345a`
- Fuji Deployment commit: `4d1d43c`

---

## 1. 撮合引擎

已完成撮合引擎测试，并补充：

- 时间优先（FIFO / Price-Time Priority）测试
- Self-trade（自成交）拒绝测试

测试结果：

```text
Test Files  5 passed (5)
Tests       48 passed (48)


```

Self-trade protection 在订单真正进入撮合流程前进行检查，拒绝会实际与同一 owner 的挂单发生撮合的 incoming order，并保持订单簿和账户状态不被部分修改。

---

## 2. 合约部署到 Avalanche Fuji

### Forge 测试

```text
Ran 13 tests for test/Vault.t.sol:VaultTest
Suite result: ok. 13 passed; 0 failed; 0 skipped
```

### Fuji 合约地址

- Vault: `0xa2b6d2fCC478343c476B24F02200742359E419bb`
- USDC: `0xb5941598c52f45f4EC74CE1024071b25215094aC`
- WAVAX: `0xE264Ba0984957f1aa80e7a536Dae61A9EF1F6ca6`

Network: Avalanche Fuji (Chain ID `43113`)

### Deposit

完成一笔真实 Fuji 链上 deposit：

- Token: WAVAX
- Amount: `2 WAVAX`
- Transaction Hash: `0xac2a2b6620fb6ff05031e453f4e459b05916f2282b58711f7febe508eccf5cfa`
- Block: `58711655`

---

## 3. 端到端演示

### 登录成功

钱包连接 Avalanche Fuji，并通过签名完成登录：

![登录成功](./images/Task7「登录成功」.png)

### 余额显示

Deposit 后前端能够正确显示链上钱包余额及交易所可用余额：

![余额显示](./images/余额截图.png)

### 两个不同地址完成成交

本次成交使用两个不同的钱包地址：

- Seller / Maker: `0x51b682f07424b124992C0a42600dCa15c4383aFE`
- Buyer / Taker: `0x0342ed8eaC11a52C247C9428c450A7288b72f484`
- Trade: `0.5 WAVAX @ 10 USDC`
- Quote Amount: `5 USDC`

卖方挂单：

![卖方挂单](./images/account1的0.5.png)

买方成交：

![买方成交](./images/account2买方成交.png)

卖方成交后的余额 / 成交记录：

![卖方成交记录](./images/account1成交记录.png)

成交后的余额变化与交易一致：

- Seller: `2 WAVAX → 1.5 WAVAX`，获得 `5 USDC`
- Buyer: `100 USDC → 95 USDC`，获得 `0.5 WAVAX`

### Withdraw

完成一笔真实 Fuji 链上 withdraw：

- Token: USDC
- Amount: `1 USDC`
- Transaction Hash: `0xea0d9ab9f7142191db60ddefa5054882e71273d886c5fdf3dfd8be8c00edb599`
- Block: `58713546`

Withdraw 后链上 USDC 钱包余额为 `1001 USDC`。

---

## 基础任务完成情况

- [x] `npm test` 全部通过
- [x] 时间优先测试
- [x] Self-trade 拒绝测试
- [x] `forge test` 全部通过
- [x] 3 个 Fuji 合约地址
- [x] 真实 Deposit + tx hash
- [x] 登录成功截图
- [x] 余额显示截图
- [x] 两个不同地址完成成交
- [x] 真实 Withdraw + tx hash
