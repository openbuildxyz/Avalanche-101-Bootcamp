# Task 5 · Avalanche RWA Token 合约实战 —— 新疆棉花标准仓单（CWRT）

> 本作业仅用于技术学习和业务模拟，不涉及真实资产募集、投资建议或金融产品发行。

---

## 1. 学员信息

- **GitHub 用户名**：emptytouch
- **作业提交仓库地址**：https://github.com/emptytouch/Avalanche-101-Bootcamp （分支 `task5`，目录 `learn/emptytouch/task5/`）
- **合约代码仓库地址**：https://github.com/emptytouch/cwrt-cotton-rwa

## 2. 项目说明

### 2.1 RWA 业务场景

**新疆棉花标准仓单**（Cotton Warehouse Receipt）。皮棉在第三方监管库存放，出库前由专业纤维检验机构完成**公证检验**并逐包出具检验证书；本合约把"一包棉花一份凭证"的仓单关系映射到链上，用于仓单的签发、流转、权利受限标记与提货核销。

### 2.2 现实资产与资产权益介绍

| 项目 | 说明 |
| --- | --- |
| 现实资产 | 存放于第三方监管仓库、已完成公证检验的皮棉（细绒棉，符合 GB 1103.1 国家标准） |
| 资产权益 | 该批皮棉对应的仓单提取权与处分权 |
| 计量单位 | **1 Token = 1 公斤净重皮棉**（decimals 18，即 1e18 最小单位 = 1 公斤） |
| 示例批次 | 一批 100 包、净重合计 22,000 公斤，对应 22,000e18 额度；发行上限 22,700 公斤 |
| 批次标识 | `XJ-2025-A07/C3-D12`（产地-年度-轧花厂批次码/仓号-垛位） |

**选择该场景的理由**：棉花是国内少数具备"监管库 + 公证检验 + 标准仓单"完整制度链的大宗品类，链上凭证因此有真实出处，而不是凭空编造的资产证明；同时"同一批货开具多张仓单"是大宗贸易中的真实风险点，链上唯一账本与质押锁定恰好对症。

### 2.3 资产托管与资产证明

- **资产托管方**：第三方专业监管仓库，负责货物保管、仓号与垛位登记、温湿度管理。
- **资产证明提供方**：专业纤维检验机构出具的公检证书，逐包记录上半部平均长度、马克隆值、断裂比强度、长度整齐度指数、反射率、黄色深度、轧工质量等指标。
- **上链方式**：公检证书样张（PDF）**已实际上传至 IPFS**，其 CID 作为 URI 存入 `assetDocument`；
  证书文件的 `keccak256` 存入 `assetDocumentHash`。
- **为什么需要哈希**：只存 URI 无法防止内容被替换。URI + 内容哈希同时上链，任何人都能重新计算哈希来验证拿到的证书是否就是签发时的那一份。公检指标直接决定棉花的升贴水定价，因此"证书不可篡改"在这个场景里是真实的业务需求。

#### 资产证明详情（可独立核验）

| 项 | 值 |
| --- | --- |
| IPFS CID | `bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4` |
| 链上 `assetDocument` | `ipfs://bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4` |
| 链上 `assetDocumentHash` | `0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0` |
| 证明文件 | `asset/cotton-certificate-XJ-2025-A07.pdf`（40,747 bytes，公证检验证书样张） |
| 文件 sha2-256 | `6631fdbf38f67eb3aacd70cec79fc6a9fe1f35a15e7fdaf749ee089b3dfd4b3f` |
| 可取网关 | `https://ipfs.filebase.io/ipfs/<CID>`（实测 HTTP 200，40,747 bytes） |

**核验步骤**（任何人可复现）：

```bash
# 1) 从 IPFS 网关下载证明文件
curl -o cert.pdf https://ipfs.filebase.io/ipfs/bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4

# 2) 复算 keccak256（EVM 口径，与链上 assetDocumentHash 比对）
cat cert.pdf | cast keccak
# 期望：0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0
```

> **哈希口径说明**：IPFS 的 CID 基于 **sha2-256**（见上表"文件 sha2-256"），而链上存的是 **keccak256**，
> 二者不是同一个哈希值。CID 用于取文件，keccak256 用于与链上数据比对——真实 RWA 项目通常两者都存。
> 该 PDF 由仓库内的确定性生成器产出（`asset/generate_certificate.py`），重复生成字节一致，
> 因此这个哈希是可复现、可验证的，而不是手抄的字符串。
>
> ⚠️ 合规声明：该样张为课程作业模拟件，含"模拟样张"水印与页脚声明，机构名称标注为"XX 纤维检验中心（模拟）"，
> 不包含任何真实机构、企业或个人名称。

### 2.4 Token 业务行为映射

| 链上行为 | 对应的业务动作 |
| --- | --- |
| **发行 `mint`** | 皮棉入库、完成公证检验后，监管库按入库净重签发仓单额度 |
| **转让 `transfer`** | 仓单在轧花厂 → 贸易商 → 纱厂之间流转；质押部分禁止转让 |
| **销毁 `burn`** | 提货出库或交割注销，仓单对应的实物离开监管库 |
| **损耗核销 `burnLoss`** | 仓储自然损耗、受潮降等、火灾等损失，实物已灭失，链上同步核销 |
| **质押锁定 `pledge`** | 标记权利受限额度，阻止已锁定部分的后续转让与销毁；链上唯一账本可解决"重复开单"，但对"抢跑转移"仅弱防护（见安全审计 M-01） |

### 2.5 风险边界（业务诚实声明）

- 链上凭证**不等同于完整法律意义上的货权转移**，真实项目需监管库、检验机构与登记平台共同背书；
- 公检结果的可信度仍取决于链下机构，链上只能保证"证书未被篡改"；
- 火灾、受潮霉变、异性纤维（"三丝"）污染可能导致降等，属于实物风险，需通过 `burnLoss` 与 `pause` 机制处置；
- 链上总量与库内实物需定期人工对账，合约无法自行感知链下库存变化。

## 3. 合约信息

| 项 | 值 |
| --- | --- |
| 合约名称 | `CottonWarehouseReceipt` |
| Token 名称 / 符号 | Cotton Warehouse Receipt Token / `CWRT` |
| 标准 | ERC-20（基于 OpenZeppelin Contracts v5.7.0） |
| 合约源码 | `src/CottonWarehouseReceipt.sol`（仓库：https://github.com/emptytouch/cwrt-cotton-rwa ） |
| 编译环境 | Foundry + solc 0.8.28（evm_version = shanghai） |
| 合约部署地址 | **`0xc5460791f4a9A890331496dF088091335CF9226e`** |
| 部署交易哈希 | `0xbadcf524646349b8c08cf79bc4a20cc54b66903177dceaf68ab841e8987e6958` |
| 部署交易链接 | https://testnet.snowtrace.io/tx/0xbadcf524646349b8c08cf79bc4a20cc54b66903177dceaf68ab841e8987e6958 |
| 区块浏览器链接 | https://testnet.snowtrace.io/address/0xc5460791f4a9A890331496dF088091335CF9226e |
| 部署区块 | 58444158（gasUsed 1,969,046，effectiveGasPrice 160 wei） |
| 实际部署成本 | ≈ 3.15 × 10⁻¹⁰ AVAX |

### 3.1 测试网信息

| 项 | 值 |
| --- | --- |
| 网络名称 | Avalanche Fuji Testnet |
| Chain ID | **43113** |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| 区块浏览器 | https://testnet.snowtrace.io |

### 3.2 Fuji 链上交互记录（真实交易）

| 行为 | 业务含义 | 交易哈希（Snowtrace 可直接打开） |
| --- | --- | --- |
| 部署 | 合约部署到 Fuji | `0xbadcf524646349b8c08cf79bc4a20cc54b66903177dceaf68ab841e8987e6958` |
| `mint` 22,000 | 皮棉入库并完成公检，监管库签发仓单 | `0x4151ec8c76de94760e3ea2a2658f240f692c3847fcb25c336c434aca0d5d81ab` |
| `transfer` 5,000 | 仓单流转给下游纱厂 | `0xbd7a4078dedd39b06d32fefcc9b2ee01c86e9481aa46d0bbf93705f0a3ab8ae6` |
| `pledge` 10,000 | 监管方标记权利受限额度 | `0x5efbee0cf5ea155da987665a5e0aca4a9fa9ba09f5712e583ed660ebd68639b0` |
| `burn` 1,000 | 提货出库，注销对应仓单 | `0x24e8d9a5367efde810ba862eabc60b5f82b7244287fc50bb2b47746f4736e380` |

交互后的链上状态（可直接用区块浏览器 Read Contract 复核）：

| 查询项 | 值 |
| --- | --- |
| `totalSupply()` | 21,000 kg |
| `balanceOf(0xA0b760…3D63)` | 16,000 kg |
| `balanceOf(纱厂地址)` | 5,000 kg |
| `pledgedOf(0xA0b760…3D63)` | 10,000 kg |
| `freeBalanceOf(0xA0b760…3D63)` | 6,000 kg |
| `assetDocument()` | `ipfs://bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4` |
| `assetDocumentHash()` | `0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0` |
| `documentVersion()` | 1 |

## 4. 功能说明

| 功能 | 实现 | 说明 |
| --- | --- | --- |
| Token 发行 | `mint(address to, uint256 amount)` | 仅 `MINTER_ROLE`；总量不得超过 `maxSupply`（= 已托管净重） |
| Token 销毁 | `burn(uint256 amount)` | 持有人自助注销；发 `TokensBurned` 事件 |
| 损耗核销 | `burnLoss(address holder, uint256 amount, string reason)` | 仅 `REGISTRAR_ROLE`；同步下调质押额度，保持 `pledged ≤ balance` |
| Token 转账 | `transfer` / `transferFrom` | ERC-20 标准；质押锁定的额度不可转出 |
| 余额查询 | `balanceOf(address)` | ERC-20 标准 |
| 总供应量查询 | `totalSupply()` | ERC-20 标准 |
| 发行权限控制 | `AccessControl` 多角色 | `MINTER_ROLE` 发行、`DOCUMENT_ROLE` 维护证明、`REGISTRAR_ROLE` 质押与核销、`PAUSER_ROLE` 风控、`DEFAULT_ADMIN_ROLE` 管理 |
| 资产证明信息更新 | `updateAssetDocument(string uri, bytes32 hash)`（**首选**） | 仅 `DOCUMENT_ROLE`；URI 与内容哈希同版本绑定，版本号自动递增，可追溯历史证书 |
| 资产证明信息更新（兼容重载） | `updateAssetDocument(string document)` | 与作业建议签名完全一致；仅更新 URI 并把内容哈希置零（表示该版本未提供校验），用于"扫描件先上传、盖章版后补"的过渡场景 |
| 资产证明查询 | `assetDocument()` / `assetDocumentHash()` / `documentVersion()` / `documentUpdatedAt()` | 作业点名要求的 `assetDocument()` 接口 |
| 批次信息 | `setAssetBatchId(string)` / `assetBatchId()` | 记录仓号垛位等批次属性 |
| 发行上限管理 | `setMaxSupply(uint256)` | 仅管理员；不允许下调到低于当前已发行量 |
| 质押锁定 | `pledge` / `unpledge` / `pledgedOf` / `freeBalanceOf` | 覆写 OZ v5 `_update` 钩子实现，覆盖转账与销毁路径 |
| 紧急暂停 | `pause()` / `unpause()` | 仅 `PAUSER_ROLE`；风险事件时冻结发行与转让（解除质押不受限） |
| 事件 | `TokensMinted` / `TokensBurned` / `LossWrittenOff` / `AssetDocumentUpdated` / `AssetBatchIdUpdated` / `MaxSupplyUpdated` / `PledgeRecorded` / `PledgeReleased` | 全部状态变更均有事件 |

### 4.1 合约核心技术点：质押锁定

OZ v5 把 `_beforeTokenTransfer` 拆分为 `_update`（铸造/转账/销毁的共同钩子），只需覆写一次即可覆盖全部资金流转路径：

```solidity
function _update(address from, address to, uint256 value) internal override whenNotPaused {
    if (from != address(0)) {                                  // 铸造免除校验
        uint256 pledgedAmount = _pledged[from];
        if (pledgedAmount != 0) {
            uint256 free = _freeBalance(from);                 // 下溢安全写法
            if (value > free) revert InsufficientFreeBalance(from, value, free);
        }
    }
    super._update(from, to, value);
}
```

一次覆写同时实现三件事：**质押部分不可转让**、**暂停时发行与转让一并冻结**、**铸造不被误伤**。

## 5. 测试说明

使用 Foundry 编写，共 **43 项测试全部通过**（31 项单元测试 + 4 项不变量测试 + 8 项安全审计证据测试）。

| 作业要求场景 | 对应测试 |
| --- | --- |
| 合约部署成功 | `test_InitialState_TokenMetadataAndRoles` |
| 初始 Token 信息正确 | `test_InitialState_AssetDocument`、`test_InitialState_TokenMetadataAndRoles` |
| 授权账户可以发行 Token | `test_Mint_ByAuthorizedWarehouse` |
| 非授权账户不能发行 Token | `test_Mint_RevertsForUnauthorizedAccount` |
| 持有人可以转账 | `test_Transfer_ByHolder` |
| Token 可以被销毁 | `test_Burn_ReducesSupplyAndBalance` |
| 总供应量和账户余额变化正确 | `testFuzz_MintBurn_Conservation`（256 轮 fuzz） |
| 非授权账户不能修改资产证明信息 | `test_UpdateAssetDocument_RevertsForUnauthorizedAccount` |
| 错误操作能够被合约拒绝 | 超额发行、零值、超余额转账、超质押额度、空证明、暂停期间操作等 12 项 revert 测试 |

额外覆盖（业务机制）：`test_Pledge_BlocksTransferBeyondFreeBalance`、`test_Unpledge_RestoresTransferability`、
`test_BurnLoss_ByRegistrar_WritesOffMoistureDamage`、`test_BurnLoss_AdjustsPledgeAndKeepsInvariant`、
`test_Pause_BlocksTransferMintAndBurn`、`test_SetMaxSupply_UpAndDownWithGuard`、
`test_UpdateAssetDocument_URIOonly_ClearsHashAndBumpsVersion`（兼容重载：哈希置零 + 双参更新恢复绑定）、
`test_UpdateAssetDocument_URIOonly_RevertsForUnauthorizedAccount`。

不变量测试（随机调用序列，64 runs × 2048 calls）：
`invariant_TotalSupplyNeverExceedsMaxSupply`、`invariant_PledgedNeverExceedsBalance`、
`invariant_SumOfBalancesEqualsTotalSupply`、`invariant_DocumentVersionMonotonic`（版本递增，且零哈希只可能出现在更新之后）。

### 5.1 安全自审计

合约已完成一轮自审计（完整报告 `SECURITY.md`，随代码仓库提交），**未发现 Critical / High 级漏洞**：
无任何外部调用（重入面为零）、发行受硬上限约束、权限由 OZ `AccessControl` 管理、不做代理升级。

发现的 4 项 Medium 均属**特权与信任假设**而非代码实现缺陷：质押可被抢跑规避、`REGISTRAR_ROLE`
可单方核销他人余额、发行上限无链下锚定、资产证明可被 `DOCUMENT_ROLE` 替换。全部 8 项发现已固化为
可执行测试 `test/AuditFindings.t.sol`（`forge test` 全通过），任何人可复现。

**因此本文档中"质押锁定可防止一货多单"的表述已按审计结论修正**：链上唯一账本解决的是"重复开单"，
而"抢跑转移后再质押"仍属弱防护边界，需通过地址白名单 / 多签 / 时间锁等治理手段弥补。

## 6. 截图材料

| 截图 | 内容 |
| --- | --- |
| 合约部署成功 | ![部署成功](/learn/emptytouch/task5/task5.1-emptytouch.png) |
| 区块浏览器合约 / 交易页 | ![浏览器](/learn/emptytouch/task5/task5.2-emptytouch.png) |
| Token 发行 | ![发行](/learn/emptytouch/task5/task5.3-emptytouch.png) |
| Token 转账 | ![转账](/learn/emptytouch/task5/task5.4-emptytouch.png) |
| Token 销毁 | ![销毁](/learn/emptytouch/task5/task5.5-emptytouch.png) |
| 质押锁定（`PledgeRecorded` 事件） | ![质押](/learn/emptytouch/task5/task5.6-emptytouch.png) |
| 测试全部通过（`forge test`） | ![测试](/learn/emptytouch/task5/task5.7-emptytouch.png) |


## 7. 复现步骤

```bash
git clone --recursive https://github.com/emptytouch/cwrt-cotton-rwa.git
cd cwrt-cotton-rwa
forge install
forge test                       # 43 tests passed

# 复算资产证明文件的 keccak256（应与链上 assetDocumentHash 一致）
COTTON_DOC_FILE=asset/cotton-certificate-XJ-2025-A07.pdf \
  forge script script/HashAssetDocument.s.sol:HashAssetDocument
# → 0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0

# 先在本地链排练整套流程（Anvil，Chain ID 刻意设为 43113 与 Fuji 一致）
anvil --chain-id 43113           # 另开终端
bash script/local-demo.sh deploy
bash script/local-demo.sh        # 10 个环节：签发/越权拒绝/流转/注销/质押/核销/证明更新/暂停/对账

# 再部署到 Fuji
cp .env.example .env             # 填入一次性测试钱包私钥
forge script script/DeployCottonWarehouseReceipt.s.sol:DeployCottonWarehouseReceipt \
  --rpc-url fuji --broadcast -vvv
```

### 7.1 本地部署验证结果

本地链（Anvil，Chain ID 43113）部署地址：`0x5FbDB2315678afecb367f032d93F642f64180aa3`

| 环节 | 操作 | 结果 |
| --- | --- | --- |
| 1 | 链上初始状态 | symbol `CWRT`、decimals 18、maxSupply 22700 kg、批次 `XJ-2025-A07/C3-D12`、证明版本 1 |
| 2 | 监管库签发 22000 公斤 | 持有人 22000 kg，totalSupply 22000 kg |
| 3 | 非授权账户自行签发 | 被拒 `AccessControlUnauthorizedAccount` |
| 4 | 转让 5000 公斤给下游纱厂 | 出让人 17000 kg / 受让人 5000 kg |
| 5 | 提货注销 1000 公斤 | totalSupply → 21000 kg |
| 6 | 质押锁定 15000 公斤 | 已质押 15000 kg，可用额度 1000 kg |
| 6.1 | 转出 2000 公斤（超可用额度） | 被拒 `InsufficientFreeBalance`；转 1000 公斤成功 |
| 7 | 损耗核销 200 公斤 | 质押同步下调至 14800 kg，维持 `pledged ≤ balance` |
| 8 | 更新资产证明 | 版本号递增至 2 |
| 8.1 | 走兼容重载 `updateAssetDocument(string)` | 调用成功（选择器 `0x8761e51a`），内容哈希置零表示未校验，版本递增至 3 |
| 9 | 风控暂停 | 暂停期间转账被冻结（`EnforcedPause`），解除后恢复 |
| 10 | 终态对账 | 余额之和 20800 kg == totalSupply 20800 kg |

## 8. 免责声明

本作业为 Avalanche 101 Bootcamp 课程练习，棉花仓单、监管库、公检证书、批次号等均为业务模拟，
合约仅部署在 Avalanche Fuji 测试网，不构成任何真实资产凭证、投资建议或金融产品。
