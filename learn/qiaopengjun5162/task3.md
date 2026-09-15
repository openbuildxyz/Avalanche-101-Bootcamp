# Task 3：使用 DEX Oracle 获取代币价格

> 对应课程：第三章 Solidity 合约实战
> 作者：qiaopengjun5162
> 完成时间：2026-09-09（TR 修改版：2026-09-15）

## 一、方案概览

- **选择的 DEX**：**Trader Joe v2.1**（Avalanche Fuji 测试网官方部署的已存在 DEX）
- **交易对**：AVAX-USDC（官方 20bps bin step LBPair，⭐ 生态中已有的真实交易对）
- **价格获取方式**：通过 LBPair 的 `getReserves()` 读取 active bin 实时储备计算市价
- **使用价格的方式**：`JoePriceOracle` 合约，`buyWithAvax()` 按真实 DEX 实时报价兑换 JPT

## 二、Trader Joe v2.1 Fuji 官方合约地址

| 合约 | 地址 | 说明 |
|---|---|---|
| LBFactory V2.1 | `0x8e42f2F4101563bF679975178e880FD87d3eFd4e` | 交易对工厂 |
| LBRouter V2.1 | `0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30` | Router |
| LBQuoter V2.1 | `0xd76019A16606FDa4651f636D9751f500Ed776250` | 报价查询 |
| WAVAX (Fuji) | `0xd00ae08403B9bbb9124bB305C09058E32C39A48c` | 原生代币包装 |
| USDC (Fuji) | `0xB6076C93701D6a07266c31066B298AeC6dd65c2d` | 稳定币 |
| **AVAX-USDC LBPair** | **`0x099deb72844417148E8ee4aA6752d138BedE0c39`** | ⭐ **已存在的真实交易对（20bps bin step）** |

> 来源：https://github.com/lfj-gg/joe-docs/blob/main/versioned_docs/version-V2.1/deployment-addresses/fuji.md

## 三、链上查询真实 DEX 价格

直接在链上读取 Trader Joe v2.1 AVAX-USDC pair 的储备：

```
$ cast call 0x099deb...E0c39 "getTokenX()"
→ 0xd00ae08403B9bbb9124bB305C09058E32C39A48c (WAVAX)

$ cast call 0x099deb...E0c39 "getTokenY()"
→ 0xB6076C93701D6a07266c31066B298AeC6dd65c2d (USDC)

$ cast call 0x099deb...E0c39 "getReserves()"
→ (7.172 WAVAX, 953.61 USDC)   ← active bin 内当前储备

$ cast call 0x099deb...E0c39 "getBinStep()"
→ 20 (即 0.2%)

📊 实时价格：1 AVAX ≈ 953.61 / 7.172 ≈ 132.9570 USDC
```

**价格来源是真实的、已存在的 Trader Joe v2.1 DEX 交易对**，不是自建池或手动写入。

## 四、JoePriceOracle 合约核心代码

```solidity
// JoePriceOracle.sol —— 使用真实 DEX（Trader Joe v2.1）价格的代币销售合约

interface ILBPair {
    function getReserves() external view returns (uint128, uint128);
    function getTokenX() external view returns (address);
    function getTokenY() external view returns (address);
}

contract JoePriceOracle is ERC20, ReentrancyGuard {
    ILBPair public immutable dexPair;  // Trader Joe v2.1 AVAX-USDC LBPair

    /// @notice 从真实 DEX pair 读取 1 AVAX = ? USDC（价格来自链上储备，非写死）
    function getAvaxPriceInUsdc() public view returns (uint256) {
        (uint128 reserveX, uint128 reserveY) = dexPair.getReserves();
        if (reserveX == 0 || reserveY == 0) revert PriceUnavailable();
        return (uint256(reserveY) * 10 ** 18) / uint256(reserveX);
    }

    /// @notice 业务逻辑：按真实 DEX 价格用 AVAX 购买 JPT
    function buyWithAvax() external payable nonReentrant returns (uint256 tokenOut) {
        if (msg.value == 0) revert ZeroAmount();
        uint256 priceUsdcPerAvax = getAvaxPriceInUsdc();
        if (priceUsdcPerAvax == 0) revert PriceUnavailable();

        // 业务使用价格：1 AVAX → priceUsdcPerAvax JPT（6 decimals 对齐 USDC）
        tokenOut = (msg.value * priceUsdcPerAvax) / 10 ** 18;
        _transfer(owner, msg.sender, tokenOut);
        totalAvaxCollected += msg.value;
        emit Purchased(msg.sender, msg.value, tokenOut, priceUsdcPerAvax);
    }

    /// @notice 当前 1 AVAX = ? USDC（来自真实 DEX）
    function currentPrice() external view returns (uint256) {
        return getAvaxPriceInUsdc();
    }
}
```

## 五、合约地址与链上验证

| 合约/操作 | 地址/Tx | 说明 |
|---|---|---|
| JoePriceOracle | `0x9469d5A9Eb7BF6dd9471bDF65BBA34EC111fa4a0` | 使用真实 DEX 价格的代币销售合约 |
| 部署 tx | `0xc27172772b87c836af9746c703add81c7d97a19ed9b42c741768215e03041f78` | Fuji 测试网 |
| 购买 tx（0.05 AVAX） | `0x82173ee99c96d5b2634a4beb0dd27d87c6e4b72552d51a8da073e18290f33144` | 真实成交 |

链上验证：
```
currentPrice() = 132.9570 USDC/AVAX   ← 来自真实 Trader Joe pair
buyWithAvax(0.05 AVAX) → tokenOut = 6,647,850 JPT (= 0.05 × 132.957 ✓)
totalAvaxCollected = 0.05 AVAX ✓
```

## 六、验证截图

![Task 3 链上验证卡](task3-verify-card.png)

## 七、合格标准对照

- ✅ **测试网上存在真实交易对，且有可用流动性**：Trader Joe v2.1 AVAX-USDC LBPair（Fuji 官方部署，非自建）
- ✅ **价格来自 DEX 交易对，不是手动写入**：`getAvaxPriceInUsdc()` 读 `pair.getReserves()` 实时计算
- ✅ **获取到的价格被合约实际业务逻辑使用**：`buyWithAvax()` 按 DEX 实时价格决定成交数量
- ✅ **合约成功部署到 Avalanche Fuji 测试网**：JoePriceOracle 已部署（tx 可查）
- ✅ **提交了 DEX 地址、合约地址、代码、tx 哈希等可验证材料**

## 参考

- Trader Joe v2.1 Fuji 部署地址：https://github.com/lfj-gg/joe-docs/blob/main/versioned_docs/version-V2.1/deployment-addresses/fuji.md
- 合约源码：https://github.com/qiaopengjun5162/avalanche-amm-foundry/tree/main/packages/foundry/contracts/JoePriceOracle.sol
- 原 PR：#58（修改后使用真实 DEX Trader Joe v2.1）
