# Task 3：使用 DEX 获取代币价格

> 学员：wyman1634
>
> 网络：Avalanche Fuji C-Chain（Chain ID `43113`）
>
> 完整源码：[wyman1634/avalanche-erc20-dapp](https://github.com/wyman1634/avalanche-erc20-dapp/tree/92e57be85043a40b78413b8d89a0463f3cb77954)

## 1. DEX、代币与交易对

本作业使用 **LFJ V1（原 Trader Joe，Uniswap V2 型 AMM）**。Router、Factory 和 WAVAX 地址均取自 [LFJ 官方 Fuji 部署文档](https://developers.lfj.gg/deployment-addresses/fuji)。

| 项目 | 地址 |
| --- | --- |
| LFJ V1 Factory | `0xF5c7d9733e5f53abCC1695820c4818C59B457C2C` |
| LFJ V1 Router | `0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901` |
| Token A：Avalanche Bootcamp Token V2（ABTv2，18 decimals） | [`0x9DFbC832E8036e794F33dD80612f7d12E44B39f2`](https://testnet.routescan.io/address/0x9DFbC832E8036e794F33dD80612f7d12E44B39f2?chainid=43113) |
| Token B：Wrapped AVAX（WAVAX，18 decimals） | [`0xd00ae08403B9bbb9124bB305C09058E32C39A48c`](https://testnet.routescan.io/address/0xd00ae08403B9bbb9124bB305C09058E32C39A48c?chainid=43113) |
| ABTv2 / WAVAX Pair | [`0xb337Bc4A330bF4736162E668AdF2fb2179452cE7`](https://testnet.routescan.io/address/0xb337Bc4A330bF4736162E668AdF2fb2179452cE7?chainid=43113) |

初始流动性为 `10,000 ABTv2 + 0.05 AVAX`。创建 Pair 并添加流动性的交易：

- [Routescan 交易详情](https://testnet.routescan.io/tx/0x05263c8f5318dcab265603d182a1428c70a6dd487a428dccd9442321625680c8?chainid=43113)
- Tx：`0x05263c8f5318dcab265603d182a1428c70a6dd487a428dccd9442321625680c8`
- Block：`58,329,675`
- Receipt status：`1`

## 2. 从 DEX 获取 Swap 报价

合约首先检查 Factory 返回的 Pair、Pair 中的两个 Token 和非零储备，再调用 LFJ Router 的 `getAmountsOut` 获取 `WAVAX → ABTv2` 实时报价。价格没有写死，也不能由 owner 手工设置。

```solidity
function quoteTokensForAvax(uint256 avaxAmount) public view returns (uint256 tokenAmount) {
    if (avaxAmount == 0) revert ZeroAmount();
    getDexReserves();

    address[] memory path = new address[](2);
    path[0] = wavax;
    path[1] = address(this);

    uint256[] memory amounts = IJoeRouter(dexRouter).getAmountsOut(avaxAmount, path);
    return amounts[1];
}
```

完整实现：[AvalancheBootcampTokenV2.sol](https://github.com/wyman1634/avalanche-erc20-dapp/blob/92e57be85043a40b78413b8d89a0463f3cb77954/packages/hardhat/contracts/AvalancheBootcampTokenV2.sol)

## 3. 在真实业务中使用 DEX 价格

`buyWithAvax` 把 Router 报价直接作为用户购买数量。用户发送 AVAX，合约按实时 DEX 报价从销售库存中发放 ABTv2，并用 `minTokenOut` 做滑点保护。

```solidity
function buyWithAvax(uint256 minTokenOut) external payable nonReentrant returns (uint256 tokenAmount) {
    if (msg.value == 0) revert ZeroAmount();

    tokenAmount = quoteTokensForAvax(msg.value);
    if (tokenAmount < minTokenOut) revert SlippageExceeded(minTokenOut, tokenAmount);

    uint256 inventory = balanceOf(address(this));
    if (inventory < tokenAmount) revert InsufficientSaleInventory(inventory, tokenAmount);

    _transfer(address(this), msg.sender, tokenAmount);
    emit TokensPurchased(msg.sender, msg.value, tokenAmount);
}
```

Fuji 实际购买结果：

- [购买交易](https://testnet.routescan.io/tx/0x4d18d943f34a9642b38e20470ba09218ca341e22adf37d38f9c81559dc3f17f7?chainid=43113)
- Tx：`0x4d18d943f34a9642b38e20470ba09218ca341e22adf37d38f9c81559dc3f17f7`
- Block：`58,329,679`
- 支付：`0.001 AVAX`
- `TokensPurchased` 事件记录获得：`195.50169617820656117 ABTv2`
- 合约金库收到：`0.001 AVAX`
- Receipt status：`1`

该输出与 LFJ V1 池的 `10,000 ABTv2 / 0.05 WAVAX` 储备和 AMM 报价一致，证明业务发放数量由 DEX 报价决定。

## 4. Fuji 部署与可复现证据

- V2 合约：[Routescan](https://testnet.routescan.io/address/0x9DFbC832E8036e794F33dD80612f7d12E44B39f2?chainid=43113)
- 部署交易：[Routescan](https://testnet.routescan.io/tx/0x90a19fe9a191dee3b5fb88e74e99ae696530f4773da3e12390f37627134e0738?chainid=43113)
- 部署 Tx：`0x90a19fe9a191dee3b5fb88e74e99ae696530f4773da3e12390f37627134e0738`
- 部署 Block：`58,329,665`
- Pair 配置 Tx：`0x1530fe24c2f6b2e9181b1c9a8b8cdd378472fd79e4d0d011c88b0d97f27464f8`
- 销售库存注入 Tx：`0x6a4d5865379f893ee4c557c85f38b0a5809e223c5a7c7dadce883b00d996ada3`

只读验证脚本：[inspectTask3Fuji.ts](https://github.com/wyman1634/avalanche-erc20-dapp/blob/92e57be85043a40b78413b8d89a0463f3cb77954/packages/hardhat/scripts/inspectTask3Fuji.ts)

```text
network: Avalanche Fuji (43113)
pair: 0xb337Bc4A330bF4736162E668AdF2fb2179452cE7
configuredPair: 0xb337Bc4A330bF4736162E668AdF2fb2179452cE7
tokenReserve: 10000.0 ABTv2
wavaxReserve: 0.05 WAVAX
saleInventory: 99804.49830382179343883 ABTv2
treasuryBalance: 0.001 AVAX
latestPurchase: 0.001 AVAX -> 195.50169617820656117 ABTv2
```

## 5. 测试与安全边界

本地执行 `yarn test`：Task 2 与 Task 3 共 **10 tests passing**。Task 3 的 6 个测试覆盖：

- 只接受 Factory 返回且有真实储备的 Pair
- 修改 DEX 报价会改变实际购买所得数量
- 滑点保护与销售库存不足
- 零金额拒绝
- owner-only AVAX 提现

测试源码：[AvalancheBootcampTokenV2.ts](https://github.com/wyman1634/avalanche-erc20-dapp/blob/92e57be85043a40b78413b8d89a0463f3cb77954/packages/hardhat/test/AvalancheBootcampTokenV2.ts)

本作业使用的是即时 AMM spot quote，适合测试网学习和演示，但浅流动性池价格可被操纵。生产系统应使用 TWAP 或可靠外部 Oracle，并增加价格偏差、流动性深度和过期检查。
