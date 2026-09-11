# Task 3：使用 DEX Oracle 获取代币价格

## 1. 使用的 DEX

本任务使用 **Pangolin V2 DEX**，部署网络为 **Avalanche Fuji C-Chain**。

- Network：Avalanche Fuji C-Chain
- Chain ID：43113
- Pangolin Router：`0x2D99ABD9008Dc933ff5c0CD271B88309593aB921`
- Pangolin Factory：`0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd`

本任务通过 Pangolin Router 创建 FOLT/WAVAX 交易对并添加真实测试网流动性，再通过 Pair 合约的 `getReserves()` 获取实时储备比例作为价格来源。

---

## 2. Token A 和 Token B

### Token A：Fuji Oracle Learning Token（FOLT）

- Solidity 合约：`Task3Token`
- Token Name：Fuji Oracle Learning Token
- Symbol：FOLT
- Decimals：18
- 初始发行量：1,000,000 FOLT
- 合约地址：

`0x2542eC3E53d8De4D16c3Fff63c6C49A5FF33c87a`

Fuji Explorer：

https://testnet.snowtrace.io/address/0x2542eC3E53d8De4D16c3Fff63c6C49A5FF33c87a

### Token B：Wrapped AVAX（WAVAX）

- Token Name：Wrapped AVAX
- Symbol：WAVAX
- Decimals：18
- 合约地址：

`0xd00ae08403B9bbb9124bB305C09058E32C39A48c`

Fuji Explorer：

https://testnet.snowtrace.io/address/0xd00ae08403B9bbb9124bB305C09058E32C39A48c

---

## 3. 交易对地址

创建的交易对为：

**FOLT / WAVAX**

Pair Address：

`0xC30F3Ec74a251452D5DC9d27463c1f14244cC096`

Fuji Explorer：

https://testnet.snowtrace.io/address/0xC30F3Ec74a251452D5DC9d27463c1f14244cC096

部署过程中首先通过 Factory 的 `getPair()` 查询交易对。由于交易对原本不存在，返回零地址，随后通过 Pangolin Factory 创建新的 FOLT/WAVAX Pair。

---

## 4. 添加流动性

通过 Pangolin Router 的 `addLiquidityAVAX()` 添加初始流动性：

```text
100,000 FOLT
+
1 AVAX
```

AVAX 由 Router 包装为 WAVAX 后进入 Pair。

添加完成后的 Pair 储备为：

```text
FOLT Reserve  = 100,000 FOLT
WAVAX Reserve = 1 WAVAX
```

因此该 Pair 的初始 Spot Price 为：

```text
1 FOLT = 0.00001 AVAX
```

等价于：

```text
1 AVAX = 100,000 FOLT
```

添加流动性交易：

`0xe9f6776160ab9500ca7e5124f5c88d335f636de8834ad4be50d411101dd774ac`

Fuji Explorer：

https://testnet.snowtrace.io/tx/0xe9f6776160ab9500ca7e5124f5c88d335f636de8834ad4be50d411101dd774ac

### 添加流动性截图

<img width="1405" height="874" alt="image" src="https://github.com/user-attachments/assets/c68aa9b5-c795-436c-846f-424442df5262" />

---

## 5. 获取 DEX 价格的核心代码

价格读取逻辑位于 `DexOracleTokenSale.sol`。

合约不保存人工设置的固定价格，而是通过 Pangolin Pair 的 `getReserves()` 动态获取 FOLT 和 WAVAX 的实时储备。

核心代码：

```solidity
function _reserves()
    internal
    view
    returns (uint112 wavaxReserve, uint112 tokenReserve)
{
    (uint112 reserve0, uint112 reserve1,) =
        pricePair.getReserves();

    if (reserve0 == 0 || reserve1 == 0)
        revert NoLiquidity();

    if (pricePair.token0() == wavax) {
        return (reserve0, reserve1);
    }

    return (reserve1, reserve0);
}
```

由于 Pangolin V2 Pair 中 `token0`、`token1` 的排列顺序由 Token 地址决定，因此通过：

```solidity
pricePair.token0()
```

判断 WAVAX 对应哪一个 reserve，避免因为 Token 顺序不同导致价格计算错误。

随后通过储备比例计算一个完整 FOLT 对应的 AVAX 价格：

```solidity
function avaxPerWholeTokenX18()
    public
    view
    returns (uint256)
{
    (
        uint112 wavaxReserve,
        uint112 tokenReserve
    ) = _reserves();

    uint256 paymentScale =
        10 ** uint256(IERC20(wavax).decimals());

    uint256 tokenScale =
        10 ** uint256(saleToken.decimals());

    return
        uint256(wavaxReserve)
        * 1e18
        * tokenScale
        / (
            uint256(tokenReserve)
            * paymentScale
        );
}
```

本次 Pair 储备为：

```text
wavaxReserve
= 1,000,000,000,000,000,000
= 1 WAVAX

tokenReserve
= 100,000,000,000,000,000,000,000
= 100,000 FOLT
```

因此：

```text
1 FOLT = 1 / 100,000 AVAX
       = 0.00001 AVAX
```

合约以 1e18 精度返回：

```text
avaxPerWholeTokenX18
= 10,000,000,000,000
= 1e13
```

即：

```text
1 FOLT = 0.00001 AVAX
```

---

## 6. 使用 DEX 价格的合约核心代码

DEX 获取的价格实际应用于 Token 购买业务，而不是仅用于前端显示。

首先通过 `quoteTokenAmount()` 根据 DEX Pair 储备计算支付一定 AVAX 可以获得多少 FOLT：

```solidity
function quoteTokenAmount(uint256 avaxIn)
    public
    view
    returns (uint256)
{
    if (avaxIn == 0)
        revert ZeroPayment();

    (
        uint112 wavaxReserve,
        uint112 tokenReserve
    ) = _reserves();

    uint256 paymentScale =
        10 ** uint256(IERC20(wavax).decimals());

    return
        avaxIn
        * uint256(tokenReserve)
        * paymentScale
        / (
            uint256(wavaxReserve)
            * (10 ** NATIVE_DECIMALS)
        );
}
```

实际购买函数：

```solidity
function buyWithAvax()
    external
    payable
    returns (uint256 tokensBought)
{
    tokensBought =
        quoteTokenAmount(msg.value);

    uint256 inventory =
        saleToken.balanceOf(address(this));

    if (inventory < tokensBought)
        revert InsufficientInventory(
            inventory,
            tokensBought
        );

    (
        uint112 wavaxReserve,
        uint112 tokenReserve
    ) = _reserves();

    if (
        !saleToken.transfer(
            msg.sender,
            tokensBought
        )
    ) revert TransferFailed();

    emit PriceUsedForPurchase(
        msg.sender,
        address(pricePair),
        msg.value,
        tokensBought,
        avaxPerWholeTokenX18(),
        wavaxReserve,
        tokenReserve
    );
}
```

其中：

```solidity
tokensBought = quoteTokenAmount(msg.value);
```

意味着实际发送给购买者的 FOLT 数量直接由 DEX Pair 当前储备比例决定，而不是由管理员设置的固定价格决定。

---

## 7. 实际业务测试

部署完成后，脚本实际调用了一次：

```solidity
buyWithAvax()
```

支付金额：

```text
0.01 AVAX
```

当时 Pair 储备：

```text
100,000 FOLT : 1 WAVAX
```

因此当前 DEX 价格：

```text
1 FOLT = 0.00001 AVAX
```

购买数量：

```text
0.01 AVAX / 0.00001 AVAX
= 1,000 FOLT
```

链上执行结果：

```text
tokensBought
= 1,000,000,000,000,000,000,000
= 1,000 FOLT
```

随后合约成功向购买者转账 1,000 FOLT。

测试购买交易 Hash：

`0xe129b003490f724bf1b818237331dd11df08dd84d0aca62a3501c15cf63a6008`

Fuji Explorer：

https://testnet.snowtrace.io/tx/0xe129b003490f724bf1b818237331dd11df08dd84d0aca62a3501c15cf63a6008

---

## 8. DEX 价格实际使用证明

为了提供链上可验证的价格使用证据，`DexOracleTokenSale` 定义了：

```solidity
event PriceUsedForPurchase(
    address indexed buyer,
    address indexed pair,
    uint256 avaxPaid,
    uint256 tokensBought,
    uint256 avaxPerWholeTokenX18,
    uint112 wavaxReserve,
    uint112 tokenReserve
);
```

本次购买触发事件时的数据为：

```text
buyer:
0x10e0E8930bE146edD1214324915646b5ab095f87

pair:
0xC30F3Ec74a251452D5DC9d27463c1f14244cC096

avaxPaid:
10000000000000000
= 0.01 AVAX

tokensBought:
1000000000000000000000
= 1000 FOLT

avaxPerWholeTokenX18:
10000000000000
= 0.00001 AVAX / FOLT

wavaxReserve:
1000000000000000000
= 1 WAVAX

tokenReserve:
100000000000000000000000
= 100,000 FOLT
```

因此可以得到完整的链上业务流程：

```text
Pangolin Pair
      ↓
getReserves()
      ↓
读取 FOLT / WAVAX 储备
      ↓
计算 DEX Spot Price
      ↓
quoteTokenAmount(msg.value)
      ↓
计算 tokensBought
      ↓
transfer FOLT 给购买者
      ↓
PriceUsedForPurchase 记录使用结果
```

这证明价格来自真实 DEX Pair，并实际参与了智能合约业务逻辑。

### 成功读取/使用价格截图

<img width="1348" height="685" alt="image" src="https://github.com/user-attachments/assets/b931f61a-44ea-46be-ad32-772898dc2684" />
<img width="1396" height="878" alt="image" src="https://github.com/user-attachments/assets/b5a8f573-b085-4749-8ba8-041d0ecf0c0c" />

---

## 9. 部署后的合约地址

### Task3Token / FOLT

`0x2542eC3E53d8De4D16c3Fff63c6C49A5FF33c87a`

Explorer：

https://testnet.snowtrace.io/address/0x2542eC3E53d8De4D16c3Fff63c6C49A5FF33c87a

### FOLT / WAVAX Pair

`0xC30F3Ec74a251452D5DC9d27463c1f14244cC096`

Explorer：

https://testnet.snowtrace.io/address/0xC30F3Ec74a251452D5DC9d27463c1f14244cC096

### DexOracleTokenSale

`0x431cdA93D99193c419084cAc0b140060DbB9069B`

Explorer：

https://testnet.snowtrace.io/address/0x431cdA93D99193c419084cAc0b140060DbB9069B

部署账户：

`0x10e0E8930bE146edD1214324915646b5ab095f87`

---

## 10. 主要链上交易

### Task3Token 部署

Transaction Hash：

`0xe84cdef8843155c8d3b9a315a347b5f35b4d7182384a0a457f38e72921eee235`

Explorer：

https://testnet.snowtrace.io/tx/0xe84cdef8843155c8d3b9a315a347b5f35b4d7182384a0a457f38e72921eee235

### 创建交易对 / 添加流动性

Transaction Hash：

`0xe9f6776160ab9500ca7e5124f5c88d335f636de8834ad4be50d411101dd774ac`

Explorer：

https://testnet.snowtrace.io/tx/0xe9f6776160ab9500ca7e5124f5c88d335f636de8834ad4be50d411101dd774ac

### DexOracleTokenSale 部署

Transaction Hash：

`0x6717a08f8ed31e14dedb80a04da1a953adc7195c22ca388f6f7bbf848eb48610`

Explorer：

https://testnet.snowtrace.io/tx/0x6717a08f8ed31e14dedb80a04da1a953adc7195c22ca388f6f7bbf848eb48610

### DEX 定价购买测试

Transaction Hash：

`0xe129b003490f724bf1b818237331dd11df08dd84d0aca62a3501c15cf63a6008`

Explorer：

https://testnet.snowtrace.io/tx/0xe129b003490f724bf1b818237331dd11df08dd84d0aca62a3501c15cf63a6008

相关交易位于 Fuji C-Chain Block：

`58312769`

---

## 11. 截图材料

### Screenshot 1：创建交易对及添加流动性

<img width="1405" height="874" alt="image" src="https://github.com/user-attachments/assets/ed017ef4-44a6-4309-9555-2e8fec9d3c2f" />

### Screenshot 2：DEX Oracle Sale 合约部署成功

<img width="1414" height="877" alt="image" src="https://github.com/user-attachments/assets/79494cd5-e733-4f54-9186-a9b79bcdbdd6" />


### Screenshot 3：价格读取并用于购买

<img width="1395" height="877" alt="image" src="https://github.com/user-attachments/assets/4b997734-b626-41db-90b9-40a9d300ba27" />


---

## 12. 实现过程简要说明

本任务在 Avalanche Fuji 测试网上使用 Pangolin V2 DEX，实现了一个根据真实 DEX Pair 储备进行动态定价的 Token Sale 合约。

首先部署自定义 ERC-20 Token：

```text
Fuji Oracle Learning Token
Symbol: FOLT
```

初始发行量为 1,000,000 FOLT。

随后通过 Pangolin Router 创建 FOLT/WAVAX 交易对，并提供：

```text
100,000 FOLT
+
1 AVAX
```

作为初始流动性。

因此 Pair 初始储备比例为：

```text
100,000 FOLT : 1 WAVAX
```

对应 Spot Price：

```text
1 FOLT = 0.00001 AVAX
```

之后部署 `DexOracleTokenSale` 合约。

该合约没有使用手动设置或写死的 Token 价格，而是在报价和购买时调用 Pangolin Pair 的：

```solidity
getReserves()
```

动态读取 FOLT 和 WAVAX 储备。

合约同时判断 `token0()` 的地址，正确确定两个 Reserve 分别对应 FOLT 还是 WAVAX，并处理 Token decimals。

用户调用：

```solidity
buyWithAvax()
```

后，合约通过：

```solidity
quoteTokenAmount(msg.value)
```

按照当前 Pair 储备比例计算购买数量，并实际执行 ERC-20 Token Transfer。

本次测试支付：

```text
0.01 AVAX
```

DEX 当前价格：

```text
1 FOLT = 0.00001 AVAX
```

因此合约计算：

```text
0.01 / 0.00001
= 1000 FOLT
```

最终链上成功向购买者发送 1000 FOLT。

同时合约触发 `PriceUsedForPurchase` Event，将 Pair 地址、AVAX 支付金额、Token 购买数量、DEX 价格以及两个 Token 的 Reserve 写入链上日志，从而提供可验证证据，证明 DEX 获取的价格确实被合约实际业务逻辑使用。
