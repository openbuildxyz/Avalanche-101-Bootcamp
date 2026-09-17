# Task 5 — Avalanche RWA Token 合约实战（XRIR 星海广场租金收益权）

> **免责声明**：本作业为技术学习与业务模拟，不涉及真实资产募集、投资建议或金融产品发行。
> 合约与文档中的资产信息均为模拟数据。

> **配套文档**
> - [`操作手册.md`](./操作手册.md) —— **从零到部署完成的中文操作指南**（目录结构详解 / 环境准备 / 部署步骤 / FAQ）。**建议先看这份。**
> - [`DEPLOYMENT.md`](./DEPLOYMENT.md) —— 部署过程详解（含踩坑记录与报错排查表）
> - [`screenshots/README.md`](./screenshots/README.md) —— 截图采集清单

---

## 一、学员信息

| 项目 | 内容 |
| --- | --- |
| GitHub 用户名 | `XLeranC` |
| 作业仓库地址 | `https://github.com/XLeranC/Avalanche-101-Bootcamp` |
| 作业目录 | `learn/XLeranC/task5/` |

---

## 二、项目说明

### 2.1 选择的 RWA 业务场景

**房地产租金收益权（Real Estate Rental Income Right）**

### 2.2 现实资产 / 资产权益介绍

链上 Token 对应的现实资产（模拟）为：

> 上海市浦东新区 **"星海广场 A 座 12 层"** 商业办公物业，
> 在 **2026-01-01 至 2026-12-31** 期间的**租金收益权**，
> 年度租金总额 **12,000,000 CNY**。

该权益属于**收益权**而非所有权：投资者持有的是"未来租金现金流的分配请求权"，而不是物业本身的产权。这也是现实中商业地产证券化（类 REITs / ABS）常见结构。

### 2.3 作业要求说明的四个问题

#### (1) 该 Token 对应的现实资产是什么？

星海广场 A 座 12 层商业办公物业未来 12 个月的**租金收益权**（租金债权 + 收益分配请求权），基础现金流来自租户按租赁合同支付的月/季租金。

#### (2) 谁负责资产托管或提供资产证明？

- **SPV（特殊目的载体）**：「星海资产一号专项计划」持有并托管该物业的收益权，实现破产隔离。
- **资产管理人（管理人）**：负责签署租赁合同、收取租金、出具评估报告，并在链下向投资者分配租金收益。
- **链上角色**：管理人控制的地址被设为合约的 **owner（授权账户）**，是唯一可以写入 `assetDocument` 的角色。
- **资产证明内容**：租赁合同摘要、资产评估报告哈希、线下登记编号，统一封装为一个 URI 写入链上。
- **信任假设（重要）**：链上**无法自证**链下资产真实存在，`assetDocument` 只是"可追溯的存证入口"。真实项目还需要第三方审计、银行资金监管、法律确权等链下机制配合。

#### (3) 一个 Token 对应多少现实资产或收益权？

**1 XRIR = 1 CNY 的租金收益权**

- 精度：`18` 位小数（ERC-20 标准），因此 `1 XRIR = 1 * 10^18` 最小单位。
- 总规模：`12,000,000 XRIR` 恰好对应 **1,200 万元**年度租金，即 `MAX_SUPPLY = 12_000_000 ether`。
- 该设计使 Token 数量与法币现金流一一对应，便于投资者理解与审计核对。

#### (4) 发行、转让、销毁分别代表什么业务行为？

| 链上操作 | 对应业务行为 | 业务含义 |
| --- | --- | --- |
| **发行 `mint`** | 收益权份额上链发行 | 首次发行（Primary Offering）或资产池新增份额；**只有授权账户（owner）可以执行**，且不得超过 `MAX_SUPPLY` 上限，对应"不得超募"。 |
| **转让 `transfer`** | 二级市场转让 | 投资者之间转让收益权份额，发生所有权变更，**总供应量不变**。 |
| **销毁 `burn`** | 到期兑付注销 / 提前赎回 | 收益权到期兑付完毕后注销对应份额，或投资者提前赎回退出；**总供应量减少**。 |
| **强制销毁 `forceBurn`** | 合规强制注销 | 授权账户针对到期未赎回、司法冻结或违反合规要求的份额进行强制注销。 |

---

## 三、合约信息

### 3.1 合约文件

| 项目 | 内容 |
| --- | --- |
| 合约名称 | `RentalIncomeRightToken` |
| Token 名称 | Xinghai Plaza Rental Income Right |
| Token 符号 | `XRIR` |
| 精度 | 18 |
| 总供应上限 | 12,000,000 XRIR |
| 标准 | ERC-20（OpenZeppelin Contracts v5.7.0） |
| 源码路径 | [`src/RentalIncomeRightToken.sol`](./src/RentalIncomeRightToken.sol) |
| 依赖 | OpenZeppelin `ERC20` / `ERC20Burnable` / `Ownable` / `Pausable` |
| Solidity 版本 | `0.8.24` |
| 智能合约代码仓库地址 | `https://github.com/XLeranC/Avalanche-101-Bootcamp` |

### 3.2 部署信息（Avalanche Fuji Testnet）

| 项目 | 内容 |
| --- | --- |
| 测试网网络名称 | **Avalanche Fuji Testnet**（Avalanche C-Chain Testnet） |
| Chain ID | **43113**（`0xA869`） |
| 原生代币 | AVAX（测试币） |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| 区块浏览器 | https://testnet.snowtrace.io |
| 合约部署地址 | `0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E` |
| 部署交易 Hash | `0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b` |
| 部署交易链接 | `https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b` |
| 浏览器合约链接 | `https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E` |
| 部署者地址 | `0x4589215F79884067593a6E52a9cffe344050fEAd` |
| 授权账户 (owner) | `0x4589215F79884067593a6E52a9cffe344050fEAd` |
| 部署区块号 | `58434848` |
| 部署实际消耗 gas | `1166421` |

> 部署命令（详见 [第八节](#八本地运行与复现步骤)）：
>
> ```bash
> forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
>   --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
> ```

### 3.3 链上业务动作记录（真实交易，可在浏览器核验）

以下交易均已真实上链，点击链接可在 Snowtrace 上核验：

| # | 业务动作 | 交易 Hash | 浏览器链接 |
| --- | --- | --- | --- |
| 1 | **部署合约** | `0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b` | [查看](https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b) |
| 2 | **发行 1000 XRIR**（mint） | `0x71532c943406b9c24960ee49a89c394066f818fb96b857410abb299813d00844` | [查看](https://testnet.snowtrace.io/tx/0x71532c943406b9c24960ee49a89c394066f818fb96b857410abb299813d00844) |
| 3 | **转账 400 XRIR**（transfer） | `0x2e2e4a74cb74022978018f9091b345abac07f316baf1f513b7c93af678153c2d` | [查看](https://testnet.snowtrace.io/tx/0x2e2e4a74cb74022978018f9091b345abac07f316baf1f513b7c93af678153c2d) |
| 4 | **销毁 250 XRIR**（burn） | `0x8c1b44efbda411e85fd97741ade45d268fd13d2121cdd4346a498271d5740cac` | [查看](https://testnet.snowtrace.io/tx/0x8c1b44efbda411e85fd97741ade45d268fd13d2121cdd4346a498271d5740cac) |
| 5 | **更新资产证明**（updateAssetDocument） | `0x0a1ea5bacf35c9c96a3006ed13908daeb726e8867c1fe9a6341896cd40781b56` | [查看](https://testnet.snowtrace.io/tx/0x0a1ea5bacf35c9c96a3006ed13908daeb726e8867c1fe9a6341896cd40781b56) |

**演示角色**：

| 角色 | 地址 | 说明 |
| --- | --- | --- |
| owner / 持有者 | `0x4589215F79884067593a6E52a9cffe344050fEAd` | 部署者，拥有发行/强销毁/更新证明/暂停权限 |
| receiver / 受让方 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | 转账接收方 |

**链上最终状态**（用 `cast` 独立读取，非脚本输出）：

```bash
cast call 0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E "totalSupply()(uint256)" --rpc-url $FUJI_RPC_URL
# 750000000000000000000  -> 750 XRIR
```

| 查询 | 结果 |
| --- | --- |
| `name()` | `Xinghai Plaza Rental Income Right` |
| `symbol()` | `XRIR` |
| `decimals()` | `18` |
| `totalSupply()` | `750000000000000000000`（750 XRIR） |
| `MAX_SUPPLY()` | `12000000000000000000000000`（12,000,000 XRIR） |
| `owner()` | `0x4589215F79884067593a6E52a9cffe344050fEAd` |
| `paused()` | `false` |
| `assetDocument()` | `ipfs://bafybeih2x9k4m2v7q3s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l/asset-report-2026Q1.json` |
| `balanceOf(owner)` | `350000000000000000000`（350 XRIR） |
| `balanceOf(receiver)` | `400000000000000000000`（400 XRIR） |

**不变量校验**：`350 + 400 = 750 = totalSupply` ✅ 账目自洽。

**状态演进**（与本地 anvil 预演结果完全一致）：

| 步骤 | 操作 | owner | receiver | totalSupply |
| --- | --- | ---: | ---: | ---: |
| 初始 | 部署完成 | 0 | 0 | 0 |
| ① | mint 1000 XRIR | 1000 | 0 | 1000 |
| ② | transfer 400 XRIR | 600 | 400 | **1000（不变）** |
| ③ | burn 250 XRIR | **350** | 400 | **750（减少）** |

---

## 四、功能说明

### 4.1 已实现功能清单

| 功能 | 函数 | 权限 | 说明 |
| --- | --- | --- | --- |
| Token 名称/符号 | `name()` / `symbol()` | 任何人 | 返回 `Xinghai Plaza Rental Income Right` / `XRIR` |
| Token 发行 | `mint(address to, uint256 amount)` | **仅 owner** | 发行收益权份额，超过 `MAX_SUPPLY` 回滚 |
| Token 销毁（自持） | `burn(uint256 amount)` | 持币人 | 持有人赎回/到期注销自己的份额 |
| Token 销毁（授权额度） | `burnFrom(address account, uint256 amount)` | 授权额度持有者 | 继承自 `ERC20Burnable`，受 `allowance` 限制 |
| Token 强制销毁 | `forceBurn(address account, uint256 amount)` | **仅 owner** | 合规驱动的强制注销 |
| Token 转账 | `transfer(address to, uint256 amount)` | 持币人 | 二级转让 |
| 授权转账 | `approve()` / `transferFrom()` | 持币人 / 被授权者 | 标准 ERC-20 授权机制 |
| 余额查询 | `balanceOf(address account)` | 任何人 | 持仓查询 |
| 总供应量查询 | `totalSupply()` | 任何人 | 当前流通总量 |
| 发行上限查询 | `MAX_SUPPLY()` | 任何人 | 常量 `12_000_000 ether` |
| 资产证明更新 | `updateAssetDocument(string)` | **仅 owner** | 写入 IPFS URI / 文档摘要 / 线下凭证编号 |
| 资产证明查询 | `assetDocument()` | 任何人 | 返回当前资产证明信息 |
| 资产证明更新时间 | `assetDocumentUpdatedAt()` | 任何人 | 最后一次上链的时间戳 |
| 暂停 / 恢复 | `pause()` / `unpause()` | **仅 owner** | 风险事件下的紧急熔断 |
| 暂停状态查询 | `paused()` | 任何人 | 是否已暂停 |
| 权限转移 | `transferOwnership(address)` | **仅 owner** | 移交授权账户 |

### 4.2 权限矩阵

| 操作 | owner（授权账户） | 普通持币人 | 任何人 |
| --- | :---: | :---: | :---: |
| `mint` 发行 | ✅ | ❌ | ❌ |
| `forceBurn` 强制销毁 | ✅ | ❌ | ❌ |
| `updateAssetDocument` 更新资产证明 | ✅ | ❌ | ❌ |
| `pause` / `unpause` | ✅ | ❌ | ❌ |
| `transferOwnership` | ✅ | ❌ | ❌ |
| `transfer` / `approve` | ✅ | ✅ | ❌ |
| `burn` / `burnFrom` | ✅ | ✅ | ❌ |
| `balanceOf` / `totalSupply` / `assetDocument` | ✅ | ✅ | ✅（只读） |

### 4.3 事件（Event）

| 事件 | 触发时机 |
| --- | --- |
| `Transfer(address,address,uint256)` | ERC-20 标准事件；发行、转账、销毁时均触发 |
| `Approval(address,address,uint256)` | ERC-20 标准事件；授权时触发 |
| `TokensMinted(address indexed operator, address indexed to, uint256 amount)` | 授权账户发行新份额时 |
| `TokensBurned(address indexed operator, address indexed from, uint256 amount)` | 份额被销毁（自销毁/强销毁）时 |
| `AssetDocumentUpdated(address indexed operator, string previousDocument, string newDocument)` | 资产证明信息被更新时（含新旧值，可追溯） |
| `Paused(address)` / `Unpaused(address)` | 合约暂停/恢复时 |

### 4.4 自定义错误（Custom Errors）

| 错误 | 含义 |
| --- | --- |
| `MaxSupplyExceeded(uint256 maxSupply, uint256 attemptedTotalSupply)` | 发行后总量超过上限（防超募） |
| `EmptyAssetDocument()` | 资产证明信息为空 |
| `OwnableUnauthorizedAccount(address)` | 非授权账户调用受限函数（来自 OpenZeppelin `Ownable`） |
| `EnforcedPause()` / `ExpectedPause()` | 暂停状态下的非法操作 / 非暂停状态下的 `unpause`（来自 OpenZeppelin `Pausable`） |
| `ERC20InsufficientBalance` / `ERC20InsufficientAllowance` / `ERC20InvalidReceiver` | ERC-20 标准错误（来自 OpenZeppelin，符合 ERC-6093） |

---

## 五、资产证明信息（Asset Proof）说明

合约中用 `assetDocument` 保存一项模拟的资产证明信息，初始值为：

```
ipfs://bafybeigd7yqkqkzv3hq2s5kz2m5tq3xg2c4m3f6kz4q2w7n5c3t2example/rental-rights-prospectus.json
```

它对应一份链下文档，内容包括：

1. **租赁合同摘要** —— 租户、租期、租金金额与支付节奏（该文档的哈希上链）。
2. **资产评估报告哈希** —— 由第三方评估机构出具的物业估值报告摘要。
3. **线下登记编号** —— SPV 内部登记簿中的资产编号，用于链上链下对账。

### 在真实 RWA 项目中它承担的作用

- **存证与可追溯**：把"链下资产确实存在"的证据锚定到链上，任何时间点都能查询到"当时生效的那一版文件"。
- **审计入口**：审计方与投资者可通过 URI 找到原始文件并校验哈希，实现"链上引用 + 链下原文"的分离式存证（链上只存指针，避免大文件上链成本）。
- **变更留痕**：`AssetDocumentUpdated` 事件记录新旧文档，配合 `assetDocumentUpdatedAt` 时间戳，可还原资产证明的完整变更历史。
- **明确的边界**：该字段由中心化 owner 写入，**链上无法自证链下资产真实性**。真实项目必须叠加第三方托管、资金监管、法律确权和定期审计，才能构成完整信任链。

---

## 六、测试

### 6.1 运行测试

```bash
forge test -vv
```

实测结果：

```
Ran 45 tests for test/RentalIncomeRightToken.t.sol:RentalIncomeRightTokenTest
Suite result: ok. 45 passed; 0 failed; 0 skipped
```

### 6.2 作业要求场景覆盖对照表

| # | 作业要求场景 | 覆盖测试 |
| --- | --- | --- |
| 1 | 合约部署成功 | `test_Deployment_Succeeds`、`test_InitialAssetDocument_IsSetAtDeployment`、`test_Deploy_RevertsOnEmptyAssetDocument`、`test_Deploy_RevertsOnZeroOwner` |
| 2 | 初始 Token 信息正确 | `test_InitialTokenInfo_IsCorrect` |
| 3 | 授权账户可以发行 Token | `test_AuthorizedAccount_CanMint`、`test_AuthorizedAccount_CanMintToMultipleHolders`、`test_Mint_EmitsTokensMintedEvent`、`test_MaxSupply_CanBeMintedExactly` |
| 4 | 非授权账户不能发行 Token | `test_NonAuthorizedAccount_CannotMint`、`test_TransferOwnership_MovesMintRights` |
| 5 | 持有人可以转账 | `test_Holder_CanTransfer`、`test_Holder_CanApproveAndTransferFrom`、`test_TransferToZeroAddress_Reverts`、`test_TransferToSelf_KeepsBalanceAndSupply`、`test_TransferZeroAmount_SucceedsWithoutChange` |
| 6 | Token 可以被销毁 | `test_Tokens_CanBeBurned`、`test_Burn_EmitsTokensBurnedEvent`、`test_BurnFrom_RespectsAllowance`、`test_ForceBurn_ByOwner_Succeeds`、`test_ForceBurn_ByNonOwner_Reverts`、`test_BurnZeroAmount_SucceedsWithoutChange`、`test_ForceBurnMoreThanBalance_Reverts` |
| 7 | 总供应量和账户余额变化正确 | `test_TotalSupplyAndBalances_ChangeCorrectly`、`test_SelfBurnAndForceBurn_MatchTotalSupply`、`testFuzz_Transfer_PreservesTotalSupply`、`testFuzz_MintAndBurn_RoundTrip` |
| 8 | 非授权账户不能修改资产证明信息 | `test_NonAuthorizedAccount_CannotUpdateAssetDocument`、`test_UpdateAssetDocument_NonOwnerCannotChainDocuments`、`test_OwnerCanUpdateAssetDocument`、`test_UpdateAssetDocument_EmptyStringReverts`、`test_AssetDocument_RepeatedUpdatesCarryCorrectPreviousValue` |
| 9 | 错误操作能够被合约拒绝 | `test_InvalidOperations_AreRejected`、`test_TransferMoreThanBalance_Reverts`、`test_BurnMoreThanBalance_Reverts`、`test_TransferFromWithoutAllowance_Reverts`、`test_MintToZeroAddress_Reverts`、`test_MaxSupply_CannotBeExceeded`、`test_TransferOwnership_ToZeroAddress_Reverts` |

**附加测试（风险边界）**：`test_Pause_BlocksMintTransferAndBurn`、`test_Unpause_RestoresOperations`、`test_Pause_OnlyOwner`、`test_Unpause_OnlyOwner_AndRevertsWhenNotPaused`、`test_RepeatedPauseUnpause_CyclesCleanly`、`test_MintAllZeroAmount_IsAllowedButMeaningless`。

其中 2 个为模糊测试（Fuzz Test），每个自动生成 256 组随机输入。

### 6.3 测试有效性验证（变异测试 / Mutation Testing）

"测试通过"本身并不能证明测试有意义——一个永不断言的测试套件同样会"全部通过"。
为证明这些测试**确实具备判别能力**，我对合约注入了 11 处人为缺陷，逐一验证是否有测试将其捕获。

| # | 注入的缺陷 | 应当捕获它的测试 | 结果 |
| --- | --- | --- | --- |
| M1 | `mint` 移除 `onlyOwner` | `test_NonAuthorizedAccount_CannotMint` | ✅ 捕获 (KILLED) |
| M2 | 禁用 `MAX_SUPPLY` 上限校验 | `test_MaxSupply_CannotBeExceeded` | ✅ 捕获 |
| M3 | 上限判断 `>` 改为 `>=`（边界错位） | `test_MaxSupply_CanBeMintedExactly` | ✅ 捕获 |
| M4 | `updateAssetDocument` 移除 `onlyOwner` | `test_NonAuthorizedAccount_CannotUpdateAssetDocument` | ✅ 捕获 |
| M5 | `forceBurn` 移除 `onlyOwner` | `test_ForceBurn_ByNonOwner_Reverts` | ✅ 捕获 |
| M6 | `_update` 移除 `whenNotPaused`（暂停失效） | `test_Pause_BlocksMintTransferAndBurn` | ✅ 捕获 |
| M7 | `burn` 不再真正销毁余额 | `test_Tokens_CanBeBurned` | ✅ 捕获 |
| M8 | 空文档校验失效 | `test_UpdateAssetDocument_EmptyStringReverts` | ✅ 捕获 |
| M9 | `assetDocumentUpdatedAt` 不再更新 | `test_OwnerCanUpdateAssetDocument` | ✅ 捕获 |
| M10 | `TokensBurned` 事件 `operator` 篡改为 `address(0)` | `test_Burn_EmitsTokensBurnedEvent` | ✅ 捕获 |
| M11 | `TokensMinted` 事件 `to` 篡改为 `address(0)` | `test_Mint_EmitsTokensMintedEvent` | ✅ 捕获 |

**结论：11 / 11 全部被捕获（mutation score = 100%）**，说明测试套件对权限控制、上限边界、暂停机制、事件参数与状态变更均具备真实判别力，而非"走过场"。变异测试后合约已还原（文件哈希比对一致），最终 `forge test` 仍为 45 passed。

---

## 七、截图材料

> 截图文件放在本目录下的 `screenshots/` 文件夹中。
> **5 张必交截图全部可以在浏览器里完成**，各截图对应的真实 Snowtrace 链接见 [`screenshots/README.md`](./screenshots/README.md)。

| # | 截图内容 | 文件 | 打开哪个页面 |
| --- | --- | --- | --- |
| 1 | 合约部署成功 | `screenshots/01-deploy.jpg` | [部署交易](https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b) |
| 2 | 测试网区块浏览器中的合约 | `screenshots/02-snowtrace-contract.jpg` | [合约页](https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E) |
| 3 | Token 发行（mint） | `screenshots/03-mint.jpg` | [mint 交易](https://testnet.snowtrace.io/tx/0x71532c943406b9c24960ee49a89c394066f818fb96b857410abb299813d00844) |
| 4 | Token 转账（transfer） | `screenshots/04-transfer.jpg` | [transfer 交易](https://testnet.snowtrace.io/tx/0x2e2e4a74cb74022978018f9091b345abac07f316baf1f513b7c93af678153c2d) |
| 5 | Token 销毁（burn） | `screenshots/05-burn.jpg` | [burn 交易](https://testnet.snowtrace.io/tx/0x8c1b44efbda411e85fd97741ade45d268fd13d2121cdd4346a498271d5740cac) |
| 6 | 测试全部通过（`forge test`，45 passed） | `screenshots/06-tests.jpg` | 本地运行 `forge test` |
| 7 | 更新资产证明信息（`updateAssetDocument`） | `screenshots/07-asset-document.jpg` | [更新证明交易](https://testnet.snowtrace.io/tx/0x0a1ea5bacf35c9c96a3006ed13908daeb726e8867c1fe9a6341896cd40781b56) |

> **建议**：在每个交易页展开 **Logs**（日志）标签后再截图，可直接看到合约触发的 `TokensMinted` / `Transfer` / `TokensBurned` 事件，比只看 `Status: Success` 更能证明是合约行为。

---

## 八、本地运行与复现步骤

### 8.1 环境要求

- [Foundry](https://book.getfoundry.sh/getting-started/installation)（本项目使用 `forge 1.8.1`）
- Git（用于拉取 OpenZeppelin 子模块）

### 8.2 拉取代码与依赖

```bash
git clone https://github.com/XLeranC/Avalanche-101-Bootcamp
cd task5
git submodule update --init --recursive
forge build
```

### 8.3 运行测试

```bash
forge test -vv
```

### 8.4 配置环境变量

复制 `.env.example` 为 `.env`，填入部署者私钥：

```bash
cp .env.example .env
```

```dotenv
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
PRIVATE_KEY=<your_testnet_private_key>
# 可选：授权账户，默认 = 部署者
TOKEN_OWNER=
# 可选：初始资产证明信息
ASSET_DOCUMENT=
```

> ⚠️ **安全提示**：`PRIVATE_KEY` 仅用于测试网，请使用**专用的一次性测试网钱包**，绝不要使用持有真实资产的主网私钥。`.env` 已被 `.gitignore` 忽略，不会进入版本库。

领取测试网 AVAX（Faucet）：https://faucet.avax.network/ （选择 **Fuji (C-Chain)**）

### 8.5 部署到 Avalanche Fuji 测试网

**方式 A：一键脚本（推荐，Windows / PowerShell）**

```powershell
.\deploy-fuji.ps1              # 部署 + 演示 mint/transfer/burn + 更新资产证明
.\deploy-fuji.ps1 -UpdateDocs  # 同上，并自动回填本文档与 DEPLOYMENT.md 中的合约地址
```

脚本会自动完成：校验 `.env` 与余额（余额为 0 时给出水龙头指引并退出）→ 校验 Chain ID 必须是 43113 → 编译 + 跑测试 → 部署 → 解析合约地址/tx hash/区块号 → 执行 mint/transfer/burn/updateAssetDocument → 打印可直接粘贴的回填摘要。

**方式 B：手动执行**

```bash
forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
```

### 8.6 部署后交互（生成功能截图）

```bash
export TOKEN=<合约地址>
export OWNER_KEY=<owner 私钥>
export INVESTOR=<投资者地址>
export INVESTOR_KEY=<投资者私钥>
export RECEIVER=<收款地址>

# 只读查询合约状态
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runRead(address)" $TOKEN --rpc-url $FUJI_RPC_URL

# 发行 1000 XRIR
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runMint(address,address,uint256)" $TOKEN $INVESTOR 1000000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY

# 转账 400 XRIR
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runTransfer(address,address,address,uint256)" $TOKEN $INVESTOR $RECEIVER 400000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY

# 销毁 250 XRIR
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runBurn(address,address,uint256)" $TOKEN $INVESTOR 250000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY

# 更新资产证明（仅 owner 可执行）
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runUpdateDocument(address,string)" $TOKEN "ipfs://bafybei.../asset-report-2026Q1.json" \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY
```

### 8.7 用 cast 直接核验

```bash
cast call $TOKEN "name()(string)"              --rpc-url $FUJI_RPC_URL
cast call $TOKEN "symbol()(string)"            --rpc-url $FUJI_RPC_URL
cast call $TOKEN "totalSupply()(uint256)"      --rpc-url $FUJI_RPC_URL
cast call $TOKEN "MAX_SUPPLY()(uint256)"       --rpc-url $FUJI_RPC_URL
cast call $TOKEN "assetDocument()(string)"     --rpc-url $FUJI_RPC_URL
cast call $TOKEN "balanceOf(address)(uint256)" $INVESTOR --rpc-url $FUJI_RPC_URL
```

### 8.7 部署前模拟（不广播、不消耗 gas）

基于真实 Fuji 链状态做一次本地模拟，可提前发现链不兼容 / 余额不足 / 构造回滚：

```bash
forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
  --rpc-url $FUJI_RPC_URL
```

**本次实测**：模拟成功，`Chain ID = 43113`，预估 gas `1,516,347`，运行时代码 `3,924` 字节（EIP-170 上限 `24,576`）。

---

## 九、项目结构

```
task5/
├── src/
│   └── RentalIncomeRightToken.sol        # XRIR RWA Token 合约
├── test/
│   └── RentalIncomeRightToken.t.sol      # 45 个测试（含 2 个 Fuzz）
├── script/
│   ├── DeployRentalIncomeRightToken.s.sol # 部署脚本
│   └── TokenActions.s.sol                 # 发行/转账/销毁/查资产证明 交互脚本
├── screenshots/                           # 作业要求的截图材料（内含采集清单 README.md）
├── deploy-fuji.ps1                        # 一键部署 + 演示 + 回填文档（PowerShell）
├── lib/
│   ├── forge-std/                         # Foundry 标准库 v1.14.0（随仓库提交，无需初始化）
│   └── openzeppelin-contracts/            # OpenZeppelin v5.7.0（git submodule，需初始化）
├── foundry.toml                           # Foundry 配置（solc 0.8.24 / shanghai）
├── foundry.lock                           # 依赖版本锁定（OpenZeppelin v5.7.0 / cab19933）
├── remappings.txt                         # 依赖重映射
├── .env.example                           # 环境变量模板
├── DEPLOYMENT.md                          # 部署过程详解
├── 操作手册.md                             # 中文操作指南（目录结构 / 部署 / FAQ）
└── README.md
```

> **依赖说明**：`lib/openzeppelin-contracts` 以 git submodule 方式引入（版本锁定在 `foundry.lock`：tag `v5.7.0`，commit `cab19933`）。
> 克隆仓库后**必须**执行 `git submodule update --init --recursive`，否则编译会因缺少 OpenZeppelin 而失败。
> `lib/forge-std`（v1.14.0）则直接随仓库提交，克隆后立即可用。

---

## 十、风险边界与设计取舍

1. **中心化程度**：`owner` 集发行、强制销毁、更新资产证明、暂停四项权力于一身，是**中心化权限**。真实 RWA 项目应改为 `AccessControl` 多角色（发行人 / 托管人 / 合规官）或 `TimelockController` + 多签治理。
2. **链上不证明链下真实性**：`assetDocument` 只是存证指针，无法防止管理人写入虚假文档。需要法律结构与第三方审计兜底。
3. **无收益分配逻辑**：合约**不实现**任何分红、利息计算或现金流兑付。租金派发在链下由 SPV 完成，链上 Token 只是权益登记凭证。若要实现链上派息，需引入稳定币与 `Merkle` 空投或 `ERC-4626` 结构。
4. **无转账白名单/KYC**：当前任何人都可以持有和转让 Token。真实证券型 RWA 通常需要 KYC 白名单（如 `ERC-3643`/T-REX 标准）与转让限制。
5. **`MAX_SUPPLY` 硬上限**：以 `constant` 写死为 12,000,000，若资产池规模变化需要重新部署合约（换来的是"不可超募"的强保证）。
6. **暂停机制的范围**：`Pausable` 作用于 `_update`，因此暂停时**发行、转账、销毁全部冻结**。这是有意设计——风险事件下整体停止权益流转，但需注意暂停期间持有人也无法自行退出。
7. **授权账户丢失风险**：`Ownable` 是**单地址所有权**。若 owner 私钥丢失，或误将所有权转出到不可用地址（尤其是合约已处于暂停状态时），将无法再执行发行与恢复操作，合约进入**永久只读**状态。本合约测试覆盖了 `transferOwnership` 到零地址会被拒绝（`test_TransferOwnership_ToZeroAddress_Reverts`），但无法防住"转给错误但合法的地址"。真实 RWA 项目应改用多签（如 Safe）或 `AccessControl` 做角色分离（发行人 / 托管人 / 合规官），并配合 `TimelockController`。
8. **无重入攻击面**：合约内部**不发起任何外部调用**（不转 ETH、不调外部合约、无回调），`_update` 亦无外部调用，因此不存在重入路径，无需引入 `ReentrancyGuard`。
9. **`assetDocument` 无长度上限**：`string` 未限制长度，owner 理论上可写入超长字符串抬高 gas。但写入权限仅限 owner 且费用自付，不构成对第三方的 DoS，故列为信息级。
10. **本合约不解决"链下资产真实性"**：这是 RWA 的根本信任边界。链上代码无论多严谨，都无法自证链下租金合同与物业收益权真实存在——必须依靠法律确权、第三方托管/审计与资金监管共同兜底。

---

## 十一、提交清单自查

- [x] 选择并说明 RWA 业务场景（房地产租金收益权）
- [x] 说明 Token 对应的现实资产、托管方、单位映射、业务行为
- [x] Solidity + ERC-20 合约，使用 OpenZeppelin
- [x] Token 名称与符号
- [x] 实现发行 `mint`
- [x] 实现销毁 `burn`（含 `burnFrom` / `forceBurn`）
- [x] 支持转账 `transfer` / `transferFrom`
- [x] 支持余额查询 `balanceOf`
- [x] 支持总供应量查询 `totalSupply`
- [x] 限制只有授权账户可以发行 Token
- [x] 限制只有授权账户可以修改资产证明信息
- [x] 为关键操作添加事件（`TokensMinted` / `TokensBurned` / `AssetDocumentUpdated`）
- [x] 增加资产证明信息 `assetDocument` 并说明其真实作用
- [x] 部署到 Avalanche Fuji Testnet 并提供地址与交易链接
- [x] 编写测试并覆盖全部 9 个要求场景
- [x] 提供部署、浏览器、发行、转账、销毁截图
