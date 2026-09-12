# Task 3：使用 DEX Oracle 获取代币价格

> 对应课程：第三章 Solidity 合约实战

## 使用的 DEX

**LFJ (Trader Joe) V1**（Uniswap V2 兼容）

| 合约 | 地址 |
| --- | --- |
| Factory | `0xF5c7d9733e5f53abCC1695820c4818C59B457C2C` |
| Router | `0xd7f655E3376cE2D7A2b08fF01Eb3B1023191A901` |

## Token A / Token B

| Token | 名称 | Symbol | 合约地址 |
| --- | --- | --- | --- |
| Token A | Task3 Mock USDT | tUSDT | [`0x1040765a1B98D3AEFdc07b2D6Ecc7B8DDb937144`](https://testnet.snowtrace.io/address/0x1040765a1B98D3AEFdc07b2D6Ecc7B8DDb937144) |
| Token B | DappLink Tokn | DLK | [`0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764`](https://testnet.snowtrace.io/address/0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764) |

> 两个代币均为 **6 decimals**。流动性初始比例：100,000 tUSDT / 1,000,000 DLK。

## 交易对地址

[`0xcA951F8F9144347354Ef7E794ec88E6aa8aAd760`](https://testnet.snowtrace.io/address/0xcA951F8F9144347354Ef7E794ec88E6aa8aAd760)

链上储备（部署后实测）：

```text
reserve0 = 100000000000   # 100,000 * 1e6
reserve1 = 1000000000000  # 1,000,000 * 1e6
```

## 添加流动性 / 创建交易对

部署脚本在 Fuji 上完成：创建 tUSDT → 部署 DLK 代理 → `initialize` 内通过 Factory 创建 pair → `addLiquidity` 注入流动性 → `updateChoPrice` 写入 DEX 快照价。

关键交易：

| 步骤 | Tx |
| --- | --- |
| 部署 tUSDT | [`0x4de6ee12...`](https://testnet.snowtrace.io/tx/0x4de6ee12a9dc598b5fcf8d3f305face45894eedd95a126bd4572c812038a6c80) |
| 部署 DLK implementation | [`0x55fce2c8...`](https://testnet.snowtrace.io/tx/0x55fce2c843c588bbd81c27906cb2a3eedc74365d173657f9d45ad14a9194b48a) |
| 部署 DLK proxy + initialize（创建 pair） | [`0x737e778c...`](https://testnet.snowtrace.io/tx/0x737e778c46abaaf09fc14b538743c5168e786d163cfb7530714852d76c38b2f3) |
| addLiquidity | [`0x8fd5ea86...`](https://testnet.snowtrace.io/tx/0x8fd5ea868e8c5a832aed36b83b6f169f66510183d8f3ef90e27b6355c545a868) |
| updateChoPrice | [`0x7f9ed156...`](https://testnet.snowtrace.io/tx/0x7f9ed1565d716a9601e81735b300fc9345951f2f38fab4782748d46f5a75d398) |


## 获取 Swap / Oracle 价格的核心代码

从 `mainPair` 读取储备，再调用 LFJ V1 Router 的 `getAmountOut`：

```solidity
function quote(uint256 amount) public view returns (uint256) {
    (uint256 rOther, uint256 rThis,,) = getReserves(mainPair, address(this));
    return IPancakeRouter01(v2Router).getAmountOut(amount, rThis, rOther);
}

function quoteThis(uint256 amount) public view returns (uint256) {
    (uint256 rOther, uint256 rThis,,) = getReserves(mainPair, address(this));
    return IPancakeRouter01(v2Router).getAmountOut(amount, rOther, rThis);
}

function updateChoPrice() external onlyCaller {
    (uint256 rOther, uint256 rThis,,) = getReserves(mainPair, address(this));
    latestchoPrice = IPancakeRouter01(v2Router).getAmountOut(1000000, rThis, rOther);
    emit UpdateChoPrice(block.timestamp, block.number, latestchoPrice);
}
```

## 使用价格的合约核心代码

`buyWithUsdt` 用 DEX 即期报价计算可买数量，并作为成交定价依据：

```solidity
function buyWithUsdt(uint256 usdtAmount, uint256 minTokenAmount) external returns (uint256 tokenAmount) {
    require(usdtAmount > 0, "DappLinkToken: zero payment");
    tokenAmount = quoteThis(usdtAmount);
    require(tokenAmount >= minTokenAmount, "DappLinkToken: price changed");
    require(balanceOf(address(this)) >= tokenAmount, "DappLinkToken: insufficient sale inventory");

    IERC20(usdt).safeTransferFrom(msg.sender, treasureAddress, usdtAmount);
    super._update(address(this), msg.sender, tokenAmount);

    emit PurchasedWithDexPrice(msg.sender, usdtAmount, tokenAmount, tokenAmount);
}
```

下跌税同样依赖 DEX 报价：`getDeclineTaxRate` 内用 `quote(1000000)` 与 `latestchoPrice` 比较跌幅。

## 部署后的合约地址

| 合约 | 地址 |
| --- | --- |
| DappLinkToken（proxy） | `0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764` |
| DappLinkToken（implementation） | `0xD889c5f83AC81D4e3F8D850E307eA07F743F2587` |
| Task3MockUSDT | `0x1040765a1B98D3AEFdc07b2D6Ecc7B8DDb937144` |
| LFJ V1 Pair (tUSDT/DLK) | `0xcA951F8F9144347354Ef7E794ec88E6aa8aAd760` |

## 区块浏览器链接

- Token：[https://testnet.snowtrace.io/address/0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764](https://testnet.snowtrace.io/address/0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764)
- Pair：[https://testnet.snowtrace.io/address/0xcA951F8F9144347354Ef7E794ec88E6aa8aAd760](https://testnet.snowtrace.io/address/0xcA951F8F9144347354Ef7E794ec88E6aa8aAd760)
- addLiquidity Tx：[https://testnet.snowtrace.io/tx/0x8fd5ea868e8c5a832aed36b83b6f169f66510183d8f3ef90e27b6355c545a868](https://testnet.snowtrace.io/tx/0x8fd5ea868e8c5a832aed36b83b6f169f66510183d8f3ef90e27b6355c545a868)

## 成功读取 / 使用价格

部署后在 Fuji 实测：

```bash
cast call 0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764 \
  "quote(uint256)(uint256)" 1000000 \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
# => 99699   (1 DLK ≈ 0.099699 tUSDT，含 V2 手续费)

cast call 0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764 \
  "quoteThis(uint256)(uint256)" 1000000 \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
# => 9969900 (1 tUSDT ≈ 9.9699 DLK)

cast call 0x84BDEBF23D0d4Ba0a82eB05D49d05da73106D764 \
  "latestchoPrice()(uint256)" \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
# => 99699   (与 quote(1e6) 一致，来自 updateChoPrice)
```

业务调用证明：`buyWithUsdt(100 tUSDT)` 按当时 `quoteThis` 成交，得到 `996006981` 个最小单位 DLK（与报价完全一致）。

- Tx：[`0xb7178258e3a34ad9f1d0208b130bf5b6c1d830225ab130d640ac17018f70f739`](https://testnet.snowtrace.io/tx/0xb7178258e3a34ad9f1d0208b130bf5b6c1d830225ab130d640ac17018f70f739)
- 事件：`PurchasedWithDexPrice`

## 实现过程简要说明

1. 选择 Fuji 上已部署的 **LFJ V1 Factory/Router**（与合约已有的 Pancake V2 接口兼容）。
2. 部署自有 `Task3MockUSDT` + 可升级 `DappLinkToken`；`initialize` 时 `createPair(tUSDT, DLK)`。
3. 通过 Router `addLiquidity` 注入真实流动性，使 `getReserves` / `getAmountOut` 可用。
4. 去掉写死价格依赖：用 Pair 储备 + Router `getAmountOut` 作为 oracle；`buyWithUsdt` 按 `quoteThis` 计算购买数量；`updateChoPrice` / 下跌税同步使用同一报价源。
5. 全部部署并验证在 Avalanche Fuji（chainId `43113`）。
