\# Task 4 - 从传统金融到 DeFi：金融逻辑没有消失，只是执行方式改变了



完成前面的 Token 部署、DEX Pair 和链上价格读取之后，我对 DeFi 有了一个更具体的理解：Web3 并没有重新发明金融。借贷、抵押、利率、做市、杠杆、期货、清算等概念，在传统金融体系中早已存在。DeFi 真正改变的，是这些金融活动背后的基础设施和执行方式。



从这个角度看，Swap 并不是一个孤立的功能，而是 DeFi 金融体系的起点之一。



\## 1. 从 Swap 和 AMM 开始理解 DeFi



在传统金融市场中，资产交易通常依赖交易所、券商和做市商。DeFi 则可以通过 DEX 和 AMM，让用户直接通过智能合约完成资产交换。



在 Task 3 中，我实际创建了一个 ABT/TUSD Pair，并向池中加入：



```text

100 ABT + 200 TUSD

```



通过读取 Pair 的 reserves，可以得到：



```text

1 ABT = 2 TUSD

```



这让我第一次比较直观地理解 AMM：价格不是由我在合约里手动填写一个 `2`，而是来自流动性池中两种资产的数量关系。



当用户发生 Swap 后，池中的资产比例发生变化，价格也会随之变化。



因此，DEX 不仅解决了“资产如何交换”的问题，还进一步提供了链上流动性和价格信息。



而有了资产、流动性和价格以后，就可以继续构建更复杂的金融业务。



\## 2. 从 DEX 到借贷，再到衍生品



如果把 DeFi 的发展简化来看，可以看到一条很自然的路径：



```text

Token

&#x20; ↓

DEX / Swap

&#x20; ↓

Liquidity \& Price

&#x20; ↓

Lending

&#x20; ↓

Leverage

&#x20; ↓

Derivatives / Perpetuals

```

在这个发展过程中，每个阶段也出现了具有代表性的 DeFi 协议：

- DEX / Swap：Uniswap、Trader Joe（LFJ）
  Uniswap 推动了 AMM 模式的普及，让用户不需要传统订单簿也可以通过流动性池完成链上交易。Trader Joe（现 LFJ）则是 Avalanche 生态中具有代表性的 DEX，我在 Task 3 中实际使用了它的流动性池，为 ABT/TUSD 创建交易对并获取链上价格。

- Lending：Aave
  Aave 将传统借贷中的资金池、抵押、利率和清算机制搬到智能合约中。用户可以向资金池存入资产获得收益，也可以通过超额抵押借出其他资产，协议通过 LTV、Health Factor 和清算机制控制风险。

- Derivatives / Perpetuals：GMX、dYdX
  GMX 和 dYdX 代表了 DeFi 从现货交易进一步发展到杠杆和衍生品交易。用户可以使用保证金建立多头或空头仓位，而协议需要通过 Oracle、保证金率、PnL、Funding Rate 和清算机制管理仓位风险。


DEX 解决的是资产交换和流动性问题。



借贷协议进一步解决资金使用效率的问题。资产持有人可以把 Token 存入 Lending Pool 获取收益，而需要资金的人可以抵押资产借出其他 Token。



再往后，永续合约等衍生品允许用户不一定真正买入某项资产，而是交易它未来价格变化带来的敞口，并通过保证金和杠杆放大头寸。



这和传统金融的发展逻辑其实非常相似。



传统金融中已经存在抵押贷款、证券融资、保证金交易、期货和各种衍生品。DeFi 更多是在尝试把其中部分规则变成公开的智能合约规则。



\## 3. DeFi 借贷：从“信用”更多转向“抵押物”



传统金融机构发放贷款时，通常需要评估借款人的收入、信用记录、负债、资产以及还款能力。



典型的 DeFi 借贷则有所不同。



智能合约可能并不知道借款人的真实身份，也不知道他的收入是多少。协议更关注：



```text

抵押了多少资产？

↓

抵押物现在值多少钱？

↓

借出了多少钱？

↓

当前 LTV 是否安全？

↓

是否达到清算条件？

```



例如延续 Task 3 的 ABT：



假设：



```text

1 ABT = 2 TUSD

```



用户抵押：



```text

100 ABT

```



那么抵押品价值为：



```text

100 × 2 = 200 TUSD

```



如果协议设置 Maximum LTV 为 70%，那么理论最大借款额度为：



```text

200 × 70% = 140 TUSD

```



这和传统金融中的“抵押物估值 → 抵押率 → 可融资金额”非常相似。



但如果 ABT 的市场价格下跌，抵押品价值也会下降。当 LTV 或 Health Factor 达到协议设定的危险水平后，就可能触发 Liquidation。



因此，一个借贷协议至少需要解决几个核心问题：



\- Collateral：用户抵押什么资产

\- Oracle：抵押品当前价值是多少

\- LTV：最多允许借多少钱

\- Interest Rate：借贷成本如何计算

\- Health Factor：当前仓位是否安全

\- Liquidation：风险超过阈值后如何清算



这里我也意识到 Oracle 对 DeFi 的重要性。



Task 3 中直接读取 DEX Pair reserves 作为 spot price，可以很好地演示链上价格是如何产生和读取的。但真实借贷协议如果直接依赖一个容易被短期交易影响的 spot price，就可能产生价格操纵风险。



因此在生产环境中，需要考虑 TWAP、Chainlink 等更稳健的 Oracle 方案，而不能简单把一次 AMM spot price 当作绝对可靠的资产估值。



\## 4. 永续合约：传统金融逻辑的另一种链上实现



期货和衍生品同样不是 Web3 创造的新概念。



传统金融中的期货交易已经包含保证金、杠杆、PnL、维持保证金和强制平仓等机制。



DeFi 永续合约的核心逻辑依然类似：



```text

Collateral / Margin

&#x20;       ↓

Leverage

&#x20;       ↓

Long / Short Position

&#x20;       ↓

PnL

&#x20;       ↓

Maintenance Margin

&#x20;       ↓

Liquidation

```



例如用户用 100 TUSD 作为保证金，以 5 倍杠杆建立 ABT 多头仓位，那么实际价格敞口可以达到 500 TUSD。



如果 ABT 上涨，用户获得相应收益；如果价格向相反方向变化并使保证金不足，则仓位可能被清算。



永续合约还需要解决一个传统到期交割合约没有的问题：它没有固定到期日，因此通常需要 Funding Rate 等机制，使永续合约价格尽量跟随现货或指数价格。



所以无论是借贷还是永续合约，最终都会再次回到一个核心问题：



\*\*链上系统如何可靠地知道资产现在值多少钱？\*\*



这也让我理解了为什么 Oracle 会成为 DeFi 的重要基础设施。



\## 5. 如果把当前 DApp 从 Swap 扩展到 Lending



如果继续扩展目前的 ABT/TUSD DApp，我会先选择 Lending，而不是直接开发复杂的永续合约。



整体架构可以设计为：



```text

ABT / TUSD

&#x20;   ↓

DEX / Oracle

&#x20;   ↓

ABT Price

&#x20;   ↓

LendingPool

&#x20;   ↓

Deposit Collateral

&#x20;   ↓

Calculate LTV

&#x20;   ↓

Borrow TUSD

&#x20;   ↓

Monitor Health Factor

&#x20;   ↓

Liquidation

```



用户可以首先把 ABT 存入 LendingPool 作为 collateral。



合约通过 Oracle 获取 ABT 的价格，然后计算：



```text

Collateral Value

= ABT Amount × ABT Price

```



再根据协议设定的 LTV 判断用户最多能够借出多少 TUSD。



如果用户抵押 100 ABT，ABT 当前价格为 2 TUSD：



```text

Collateral Value = 200 TUSD

```



假设 Maximum LTV 为 70%：



```text

Maximum Borrow = 140 TUSD

```



之后，如果 ABT 跌到：



```text

1 ABT = 1.5 TUSD

```



抵押品价值就只剩：



```text

150 TUSD

```



此时协议重新计算用户的 LTV / Health Factor。如果超过清算阈值，就允许 Liquidator 偿还部分债务并获得相应抵押品。



从技术实现上，我会把系统拆成几个部分：



```text

Token

\+

DEX / Oracle

\+

LendingPool

\+

Interest Rate Logic

\+

Risk Parameters

\+

Liquidation Logic

```



Task 3 的 `DexPriceConsumer` 可以看作这个系统非常早期的 Price Module，但真正进入生产环境之前，需要替换或增强为抗操纵能力更强的 Oracle。



\## 6. 我的理解



从 Task 2 到 Task 4，我逐渐把几个原本分散的 Web3 概念串了起来。



Task 2 解决的是：



```text

如何创建链上资产？

```



Task 3 进一步解决：



```text

资产如何获得流动性？

如何形成和读取市场价格？

```



Task 4 则继续追问：



```text

有了资产、流动性和价格以后，

如何构建借贷、杠杆和衍生品？

```



如果从传统金融的视角来看，这些概念其实并不陌生。



抵押、LTV、保证金、杠杆、清算、期货和做市的金融逻辑依然存在。真正发生变化的是：一部分过去依赖银行、券商、交易所和清算机构执行的规则，现在可以通过 Smart Contract、Wallet、Liquidity Pool 和 Oracle 在链上自动执行。



所以我目前对 DeFi 的理解是：



> DeFi 并不是抛弃传统金融重新创造一套金融，而是在继承大量金融机制的基础上，用区块链重新设计资产、交易、结算和风险管理的执行方式。



理解传统金融机制，可以帮助理解 DeFi 为什么需要 LTV、Oracle、Liquidation 和 Funding Rate；而理解智能合约，又能进一步看到这些金融规则在无需传统中心化中介的环境下，可以如何被重新组合和执行。

