# Task 3：使用 DEX 实时价格完成链上业务

> 网络：Avalanche Fuji C-Chain（Chain ID `43113`）  
> 完成日期：2026-09-26

## 1. DEX 与交易对

本作业选择 **Pangolin V2**。它采用与 Uniswap V2 类似的常数乘积 AMM，Router 的 `getAmountsOut` 会把手续费与价格影响计入报价，适合作为本次业务合约的实时价格来源。

| 项目 | 地址 / 交易 |
| --- | --- |
| HAHN Token | [`0xEF55...5095`](https://testnet.snowtrace.io/address/0xef55c8d97a7e35ffabbd141bd5f8302b98175095) |
| WAVAX | [`0xd00a...A48c`](https://testnet.snowtrace.io/address/0xd00ae08403B9bbb9124bB305C09058E32C39A48c) |
| Pangolin V2 Factory | [`0xE4A5...84dd`](https://testnet.snowtrace.io/address/0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd) |
| Pangolin V2 Router | [`0x2D99...B921`](https://testnet.snowtrace.io/address/0x2D99ABD9008Dc933ff5c0CD271B88309593aB921) |
| HAHN/WAVAX Pair | [`0x52F6...5930`](https://testnet.snowtrace.io/address/0x52F6D763f93F762406BD7D74538E9fd1F62B5930) |
| HAHN 授权交易 | [`0x359d...a574`](https://testnet.snowtrace.io/tx/0x359d55db00739da295e0122f1f73969cb05a3e0bf3407d09ba8e4dc88f5da574) |
| 创建池并添加流动性 | [`0x3728...7315`](https://testnet.snowtrace.io/tx/0x37286e52d409c1b467793aac27d304abd83467dbe38c77c29d22a6e155007315) |

实际注入 `10,000 HAHN + 0.1 AVAX`，获得 `31.622776601683792319` 枚 LP Token。初始价格为 `1 HAHN = 0.00001 AVAX`。

## 2. 从 Pair 与 Router 读取价格

[`HahnDexPriceReader.sol`](./task3-contracts/src/HahnDexPriceReader.sol) 不保存固定价格，而是在每次调用时读取 Pair 储备或调用 Router：

```solidity
function getSpotPriceInAVAX() public view returns (uint256 avaxPerHahn) {
    (uint256 reserveHAHN, uint256 reserveWAVAX) = getReserves();
    return (reserveWAVAX * HAHN_UNIT) / reserveHAHN;
}

function quoteHAHNForAVAX(uint256 avaxIn) public view returns (uint256 hahnOut) {
    _requireLiquidity();
    address[] memory path = new address[](2);
    path[0] = WAVAX;
    path[1] = HAHN;
    return IPangolinRouter(PANGOLIN_ROUTER).getAmountsOut(avaxIn, path)[1];
}
```

建池后读取到的结果：

| 数据 | 链上值 |
| --- | ---: |
| HAHN 储备 | `10,000 HAHN` |
| WAVAX 储备 | `0.1 WAVAX` |
| 1 HAHN 现货价 | `0.00001 AVAX` |
| `0.01 AVAX → HAHN` | `906.610893880149131581 HAHN` |
| `100 HAHN → AVAX` | `0.000987158034397061 AVAX` |

报价低于简单储备比例，因为 Router 已计入 0.3% 手续费及本次交易造成的价格影响。HAHN 和 WAVAX 都是 18 decimals，合约仍在构造时从链上读取 decimals 并校验，避免依赖前端假设。

## 3. 将 DEX 价格接入真实业务

仅展示价格不算完成任务，因此我新增了 [`HahnDexSale.sol`](./task3-contracts/src/HahnDexSale.sol)。用户调用 `buyWithAVAX` 时，合约用本次 `msg.value` 向价格读取器请求 Pangolin 实时报价，再按该结果发放 HAHN；`minHahnOut` 提供滑点保护，库存不足或报价低于用户下限都会回滚。

```solidity
function buyWithAVAX(uint256 minHahnOut) external payable returns (uint256 hahnOut) {
    if (msg.value == 0) revert HahnDexSale__ZeroPayment();
    hahnOut = priceReader.quoteHAHNForAVAX(msg.value);
    if (hahnOut < minHahnOut) revert HahnDexSale__Slippage(hahnOut, minHahnOut);
    uint256 inventory = hahn.balanceOf(address(this));
    if (inventory < hahnOut) revert HahnDexSale__InsufficientInventory(inventory, hahnOut);
    if (!hahn.transfer(msg.sender, hahnOut)) revert HahnDexSale__TransferFailed();
    emit Purchased(msg.sender, msg.value, hahnOut);
}
```

| 项目 | 地址 / 交易 |
| --- | --- |
| Price Reader | [`0x6eC9...D975`](https://testnet.snowtrace.io/address/0x6eC9d8e9EAfc90D677096B94B9886992E58FD975) |
| Reader 部署交易 | [`0xc86f...2fcf`](https://testnet.snowtrace.io/tx/0xc86ffd66f026702e9b360c4d38756dbee3f4910e11ea37712e13512949bd2fcf) |
| DEX-priced Sale | [`0xE948...A250`](https://testnet.snowtrace.io/address/0xE948ac99e17f625D338F0082a21c53BcD643A250) |
| Sale 部署交易 | [`0x6209...2519`](https://testnet.snowtrace.io/tx/0x6209cb052ad30f66ca44c4c5b367b75da662c57685b78dd07c7c0e4583712519) |
| 转入 5,000 HAHN 库存 | [`0x3ab2...39d0`](https://testnet.snowtrace.io/tx/0x3ab26b498cf84a4a6d70a6b874eb4d59ff275f2bc605fefd0c9c55be769639d0) |
| 实际购买交易 | [`0xdbe8...2ff4`](https://testnet.snowtrace.io/tx/0xdbe85f33e36178c71f875f9e58a424ea9dbfd3e2b5cf1ea068912c183bd12ff4) |

实际购买支付 `0.005 AVAX`，合约按当时 Pangolin 报价发放 `474.829737581559270371 HAHN`。这证明价格已经影响链上 Token 发放数量，而不是只在前端展示。

## 4. 测试与复现

```bash
cd task3-contracts
forge test -vv
```

结果：**9 passed, 0 failed**。测试覆盖储备顺序、双向 Router 报价、无池/无流动性拒绝、实时价格购买、滑点拒绝和库存不足拒绝。

复现脚本：

- [`SetupHahnLiquidity.s.sol`](./task3-contracts/script/SetupHahnLiquidity.s.sol)：建池并添加流动性
- [`ReadHahnDexPrice.s.sol`](./task3-contracts/script/ReadHahnDexPrice.s.sol)：读取储备与双向报价
- [`DeployAndUseHahnDexSale.s.sol`](./task3-contracts/script/DeployAndUseHahnDexSale.s.sol)：部署业务合约并完成真实购买

## 5. 风险说明

本作业的薄流动性现货池容易被单笔交易操纵，只适合测试网演示。生产场景应采用足够深的流动性、TWAP 或 Chainlink 等抗操纵预言机，并设置最大价格偏离、暂停开关和更严格的滑点限制。

## 参考资料

- [Pangolin Avalanche V2 合约地址](https://docs.pangolin.exchange/developers/contracts-and-integration-reference/avalanche-v2)
- [Uniswap V2 白皮书](https://docs.uniswap.org/whitepaper.pdf)
- [Avalanche Fuji 网络信息](https://build.avax.network/docs/quick-start/networks/fuji-testnet)
