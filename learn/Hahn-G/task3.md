# Task 3：使用 DEX 获取 HAHN 价格

> 对应课程：第三章 Solidity 合约实战  
> 当前进度：第一阶段（任务要求 1～3 的代码与链上执行准备）

## 1. 在 Avalanche 测试网选择一个 DEX

本任务选择 **Pangolin V2**，网络为 **Avalanche Fuji C-Chain**（Chain ID：`43113`）。

| 项目 | 地址 |
| --- | --- |
| Pangolin V2 Factory | [`0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd`](https://testnet.snowtrace.io/address/0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd) |
| Pangolin V2 Router | [`0x2D99ABD9008Dc933ff5c0CD271B88309593aB921`](https://testnet.snowtrace.io/address/0x2D99ABD9008Dc933ff5c0CD271B88309593aB921) |
| Fuji RPC | `https://api.avax-test.network/ext/bc/C/rpc` |

选择 Pangolin V2 的原因：它在 Fuji 有官方公布的 Factory 和 Router；V2 Pair 的储备量可以直接读取，同时 Router 的 `getAmountsOut` 可以返回包含 AMM 手续费和价格影响的实际 Swap 报价。

## 2. 创建 HAHN/WAVAX 交易对并添加流动性

### Token A 和 Token B

| Token | 名称 | 地址 | Decimals |
| --- | --- | --- | --- |
| Token A | Hahn Bootcamp Token（`HAHN`） | [`0xef55c8d97a7e35ffabbd141bd5f8302b98175095`](https://testnet.snowtrace.io/address/0xef55c8d97a7e35ffabbd141bd5f8302b98175095) | 18 |
| Token B | Wrapped AVAX（`WAVAX`） | [`0xd00ae08403B9bbb9124bB305C09058E32C39A48c`](https://testnet.snowtrace.io/address/0xd00ae08403B9bbb9124bB305C09058E32C39A48c) | 18 |

HAHN 是 Task 2 已部署的代币，链上总供应量为 `1,000,000 HAHN`。本阶段计划通过 Router 的 `addLiquidityAVAX` 注入：

- `10,000 HAHN`
- `0.1 AVAX`（Router 会自动包装成 WAVAX）
- 初始储备比对应 `1 HAHN = 0.00001 AVAX`

链上预检查（2026-09-14）：

- HAHN 合约、WAVAX、Pangolin Factory 和 Router 均存在合约代码。
- HAHN 部署钱包 `0x5bbd0cee4b3002c2797297bed4a781fe9bd10cda` 持有 `1,000,000 HAHN` 和约 `0.5 AVAX`。
- Factory 的 `getPair(HAHN, WAVAX)` 当前返回零地址，说明交易对尚未创建。

建池脚本位于 [`SetupHahnLiquidity.s.sol`](./task3-contracts/script/SetupHahnLiquidity.s.sol)。运行脚本时，Router 会在 Pair 不存在时创建 Pair，然后一次完成 HAHN 授权和流动性添加：

```bash
cd learn/Hahn-G/task3-contracts
cp .env.example .env
# 在 .env 中填入 Task 2 部署钱包的 PRIVATE_KEY；不要提交 .env

source .env
forge script script/SetupHahnLiquidity.s.sol:SetupHahnLiquidity \
  --rpc-url "$FUJI_RPC_URL" \
  --broadcast \
  --slow
```

Windows PowerShell 可直接设置当前终端的环境变量：

```powershell
Set-Location learn/Hahn-G/task3-contracts
$env:PRIVATE_KEY = "0x你的测试钱包私钥"
$env:FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
forge script script/SetupHahnLiquidity.s.sol:SetupHahnLiquidity `
  --rpc-url $env:FUJI_RPC_URL `
  --broadcast `
  --slow
```

> 当前没有在仓库中保存私钥，因此尚未广播建池交易。广播后需要把真实的 Pair 地址、交易哈希和添加流动性截图回填到这里，才算完成第 2 条的链上验收。

| 待回填项目 | 链上结果 |
| --- | --- |
| HAHN/WAVAX Pair | 待广播后回填 |
| 添加流动性交易哈希 | 待广播后回填 |
| 添加流动性截图 | 待广播后添加到 `images/` |

## 3. 通过 Pair 和 Router 获取 Swap 价格

核心实现位于 [`HahnDexPriceReader.sol`](./task3-contracts/src/HahnDexPriceReader.sol)，提供三种读取方式：

1. `getReserves()`：读取 Pair 的 HAHN/WAVAX 储备，并按 Token 顺序归一化。
2. `getSpotPriceInAVAX()`：根据 Pair 储备计算 1 HAHN 对应多少 AVAX，返回 18 位精度结果。
3. `quoteHAHNForAVAX()` / `quoteAVAXForHAHN()`：调用 Router `getAmountsOut` 获取真实 Swap 报价，结果包含 0.3% AMM 手续费及本次交易的价格影响。

```solidity
function getSpotPriceInAVAX() public view returns (uint256 avaxPerHahn) {
    (uint256 reserveHAHN, uint256 reserveWAVAX) = getReserves();
    return (reserveWAVAX * HAHN_UNIT) / reserveHAHN;
}

function quoteHAHNForAVAX(uint256 avaxIn) public view returns (uint256 hahnOut) {
    address[] memory path = new address[](2);
    path[0] = WAVAX;
    path[1] = HAHN;
    return IPangolinRouter(PANGOLIN_ROUTER).getAmountsOut(avaxIn, path)[1];
}

function quoteAVAXForHAHN(uint256 hahnIn) public view returns (uint256 avaxOut) {
    address[] memory path = new address[](2);
    path[0] = HAHN;
    path[1] = WAVAX;
    return IPangolinRouter(PANGOLIN_ROUTER).getAmountsOut(hahnIn, path)[1];
}
```

建池成功后可以运行只读脚本：

```bash
forge script script/ReadHahnDexPrice.s.sol:ReadHahnDexPrice \
  --rpc-url "$FUJI_RPC_URL"
```

该脚本会输出 Pair 地址、两侧储备、`1 HAHN` 的储备现货价、`0.01 AVAX -> HAHN` 和 `100 HAHN -> AVAX` 的 Router 报价。执行结果截图将在广播建池后补充。

若池子仍是初始储备且没有其他交易，预期输出约为：

- Pair 现货价：`1 HAHN = 0.00001 AVAX`
- Router 报价：`0.01 AVAX -> 906.610893880149131581 HAHN`
- Router 报价：`100 HAHN -> 0.000987158034397061 AVAX`

Router 报价低于简单储备比例，是因为报价已经计入 0.3% 手续费和价格影响。

## 注意事项符合性检查

| 注意事项 | 代码保证 | 当前状态 |
| --- | --- | --- |
| 不写死固定价格 | `getSpotPriceInAVAX()` 每次读取 Pair 储备；两个 Swap 报价函数每次调用 Router `getAmountsOut` | 已满足 |
| 不只在前端展示模拟价格 | 报价逻辑位于 Solidity 合约 `HahnDexPriceReader`，不是前端常量 | 第 3 条已满足；价格接入购买/兑换等业务属于下一阶段第 4～5 条，尚未冒充完成 |
| 正确处理 decimals | 构造函数在链上读取 HAHN/WAVAX 的 `decimals()`；当前均为 18，并保存 `HAHN_UNIT = 10 ** HAHN_DECIMALS` 用于价格换算；精度变化会拒绝部署 | 已满足 |
| 无流动性不能报价 | `getReserves()` 要求 Pair 非零且两侧储备均大于零；两个 Router 报价函数也先执行该检查 | 代码已满足；真实流动性仍待钱包广播 |
| DEX 可自由选择 | 本实现选择 Pangolin V2，并使用官方 Fuji Router/Factory | 已满足 |

需要特别说明：只有在下一阶段把 `quoteHAHNForAVAX()` 或 `quoteAVAXForHAHN()` 的返回值接入真实的购买、兑换、支付或铸造逻辑后，Task 3 的第 4～5 条才算完成。单独部署价格读取器不能替代这一步。

## 第一阶段源码

- [`README.md`](./task3-contracts/README.md)：安装、建池和读取价格步骤
- [`IPangolinV2.sol`](./task3-contracts/src/interfaces/IPangolinV2.sol)：最小化 DEX 接口
- [`HahnDexPriceReader.sol`](./task3-contracts/src/HahnDexPriceReader.sol)：Pair/Router 价格读取器
- [`SetupHahnLiquidity.s.sol`](./task3-contracts/script/SetupHahnLiquidity.s.sol)：创建交易对并添加流动性
- [`ReadHahnDexPrice.s.sol`](./task3-contracts/script/ReadHahnDexPrice.s.sol)：读取并打印链上价格
- [`HahnDexPriceReader.t.sol`](./task3-contracts/test/HahnDexPriceReader.t.sol)：储备顺序和 AMM 报价单元测试

## 参考资料

- [Pangolin Avalanche V2 合约地址](https://docs.pangolin.exchange/developers/contracts-and-integration-reference/avalanche-v2)
- [Avalanche Fuji 网络配置](https://build.avax.network/academy/blockchain/x402-payment-infrastructure/04-x402-on-avalanche/02-network-setup)
