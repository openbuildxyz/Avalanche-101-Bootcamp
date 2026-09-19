# Task 5 Avalanche RWA Token 合约实战

## 作业目标

结合本节课所学内容，选择一个现实世界资产或资产权益场景，在 Avalanche 测试网上发行一个简单的 RWA Token，完成从业务设计、合约编写到部署验证的完整流程。

本作业旨在帮助学员理解：

- 现实资产如何映射为链上 Token
- Token 的发行、转账和销毁
- 智能合约权限控制
- Avalanche 测试网部署流程
- RWA 项目中的资产证明和风险边界

**本作业仅用于技术学习和业务模拟，不涉及真实资产募集、投资建议或金融产品发行。**

---

## 任务要求

### 1. 选择一个 RWA 业务场景

> 学员可以从以下方向中任选一个，也可以自行设计：
> - 房地产租金收益权
> - 黄金或贵金属凭证
> - 碳积分或碳排放额度
> - 应收账款
> - 艺术品份额
> - **农产品仓单**
> - 设备租赁收益权
> - 社区能源收益权
> - 其他现实资产或资产权益

**✅ 我的选择：农产品仓单 —— 具体为「新疆棉花标准仓单」（Cotton Warehouse Receipt）**

选择理由：棉花是国内少数具备「监管库 + 公证检验 + 标准仓单」完整制度链的大宗品类，链上凭证有真实出处；同时「同一批货开具多张仓单」是大宗贸易中的真实风险点，链上唯一账本与质押锁定机制恰好对症，比单纯的资产映射更能体现 RWA 的价值。

#### 需要在作业文档中说明：

**① 该 Token 对应的现实资产是什么？**

存放于第三方监管仓库、并已完成**公证检验**的皮棉（细绒棉，符合 GB 1103.1 国家标准）。Token 代表的是该批皮棉的仓单提取权与处分权。

**② 谁负责资产托管或提供资产证明？**

| 角色 | 职责 |
| --- | --- |
| 第三方专业监管仓库 | 货物保管、仓号与垛位登记、温湿度管理（对应合约中的 `MINTER_ROLE`） |
| 专业纤维检验机构 | 逐包出具公检证书：上半部平均长度、马克隆值、断裂比强度、长度整齐度指数、反射率、黄色深度、轧工质量（对应 `DOCUMENT_ROLE`） |
| 登记运营方 | 仓单登记、质押标记与损耗核销（对应 `REGISTRAR_ROLE` 与 `DEFAULT_ADMIN_ROLE`） |

**③ 一个 Token 对应多少现实资产或收益权？**

**1 Token = 1 公斤净重皮棉**（`decimals = 18`，即 1e18 最小单位 = 1 公斤）。

示例批次：一批 100 包、净重合计 22,000 公斤 → 22,000e18 额度；发行上限 22,700 公斤（含在库待公检部分）。

**④ Token 的发行、转让、销毁分别代表什么业务行为？**

| 链上行为 | 业务行为 |
| --- | --- |
| 发行 `mint` | 皮棉入库、完成公证检验后，监管库按入库净重签发仓单额度 |
| 转让 `transfer` | 仓单在轧花厂 → 贸易商 → 纱厂之间流转（质押锁定的部分不可转让） |
| 销毁 `burn` | 提货出库或交割注销，实物离开监管库 |
| 损耗核销 `burnLoss` | 仓储自然损耗、受潮降等、火灾等损失，实物已灭失，链上同步核销 |
| 质押锁定 `pledge` | 标记权利受限额度，阻止已锁定部分的后续转让与销毁；对"抢跑转移"仅弱防护（见自审计报告 M-01） |

---

### 2. 编写 Token 合约

> 使用 Solidity 编写一个基于 ERC-20 标准的 Token 合约。
>
> 最低要求：
> - 设置 Token 名称和符号
> - 实现 Token 发行
> - 实现 Token 销毁
> - 支持 Token 转账
> - 支持余额查询
> - 支持总供应量查询
> - 限制只有授权账户可以发行 Token
> - 限制只有授权账户可以修改资产证明信息
> - 为关键操作添加事件
> 建议使用 OpenZeppelin 合约库。
>
> 建议实现的功能包括：
> ```bash
> mint(address to, uint256 amount)
> burn(uint256 amount)
> updateAssetDocument(string calldata document)
> assetDocument()
> ```

**✅ 已完成**

- Token 名称 / 符号：`Cotton Warehouse Receipt Token` / `CWRT`（decimals 18）
- 合约名：`CottonWarehouseReceipt`
- 源码位置：仓库 `https://github.com/emptytouch/cwrt-cotton-rwa` 下的 `src/CottonWarehouseReceipt.sol`
- 技术栈：Foundry + solc 0.8.28 + OpenZeppelin Contracts v5.7.0

最低要求逐条对应：

| 要求 | 实现 |
| --- | --- |
| 设置 Token 名称和符号 | 构造函数传入，`ERC20(name_, symbol_)` |
| 实现 Token 发行 | `mint(address to, uint256 amount)`，仅 `MINTER_ROLE` |
| 实现 Token 销毁 | `burn(uint256 amount)`（ERC20Burnable 覆写并加事件） |
| 支持 Token 转账 | ERC-20 标准 `transfer` / `transferFrom` |
| 支持余额查询 | `balanceOf(address)`，附加 `freeBalanceOf(address)` 查询可用额度 |
| 支持总供应量查询 | `totalSupply()`，附加 `maxSupply()` 查询托管上限 |
| 限制授权账户发行 | `AccessControl` 的 `MINTER_ROLE` |
| 限制授权账户修改资产证明 | `DOCUMENT_ROLE` |
| 关键操作添加事件 | `TokensMinted`、`TokensBurned`、`LossWrittenOff`、`AssetDocumentUpdated`、`AssetBatchIdUpdated`、`MaxSupplyUpdated`、`PledgeRecorded`、`PledgeReleased` |

建议功能的实现签名：

```solidity
function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) whenNotPaused;
function burn(uint256 amount) public override;
function burnLoss(address holder, uint256 amount, string calldata reason) external onlyRole(REGISTRAR_ROLE) whenNotPaused;
function updateAssetDocument(string calldata documentURI, bytes32 documentHash) external onlyRole(DOCUMENT_ROLE);
function updateAssetDocument(string calldata document) external onlyRole(DOCUMENT_ROLE);   // 与作业建议签名一致（兼容重载）
function assetDocument() external view returns (string memory);   // public 变量自动 getter
function assetDocumentHash() external view returns (bytes32);
function documentVersion() external view returns (uint64);
function pledge(address holder, uint256 amount) external onlyRole(REGISTRAR_ROLE) whenNotPaused;
function unpledge(address holder, uint256 amount) external onlyRole(REGISTRAR_ROLE);
function pledgedOf(address account) external view returns (uint256);
function setMaxSupply(uint256 newMaxSupply) external onlyRole(DEFAULT_ADMIN_ROLE);
function pause() external onlyRole(PAUSER_ROLE);
function unpause() external onlyRole(PAUSER_ROLE);
```

**关于 `updateAssetDocument` 的两个入口**（作业建议签名已完整提供）：

| 入口 | 选择器 | 语义 |
| --- | --- | --- |
| `updateAssetDocument(string uri, bytes32 hash)` | `0xb96750e0` | **首选**：URI 与内容哈希同版本绑定，是唯一能证明"证明文件未被替换"的方式 |
| `updateAssetDocument(string document)` | `0x8761e51a` | **兼容重载**：仅更新 URI，并把 `assetDocumentHash` 置零，明确表示该版本未提供内容校验，用于"扫描件先上传、盖章版证书后补"的过渡场景 |

两个入口共用同一个私有实现 `_setAssetDocument`，因此权限校验、空值校验、版本递增、事件与时间戳行为完全一致，不存在两套语义分叉。选择"哈希置零"而非"保留旧哈希"，是为了避免出现「哈希声称校验 A 文件、URI 已指向 B 文件」的误导状态。

超出最低要求的业务机制（体现真实 RWA 的业务规则）：

1. **质押锁定**：覆写 OpenZeppelin v5 的 `_update` 钩子（铸造 / 转账 / 销毁的共同入口），校验「转出后余额 ≥ 质押额度」。

```solidity
function _update(address from, address to, uint256 value) internal override whenNotPaused {
    if (from != address(0)) {                          // 铸造免除校验
        uint256 pledgedAmount = _pledged[from];
        if (pledgedAmount != 0) {
            uint256 free = _freeBalance(from);         // 下溢安全：pledged > balance 时不锁死账户
            if (value > free) revert InsufficientFreeBalance(from, value, free);
        }
    }
    super._update(from, to, value);
}
```

2. **发行上限 = 托管量**：`maxSupply` 对应已入库并完成公检的净重，超额签发直接 revert，杜绝「凭空开单」。
3. **损耗核销保持账实一致**：`burnLoss` 在核销实物的同时同步下调质押额度，维持 `pledged ≤ balanceOf` 不变式。
4. **不做可升级代理**：凭证类 RWA 的信任基础是规则不可变，避免管理员事后改写规则。
5. 自定义错误（比 require 字符串省 gas 且可携带参数）、全量事件、完整 NatSpec 注释。

---

### 3. 增加资产证明信息

> 合约中需要保存一项模拟的资产证明信息，例如：
> - IPFS 文件链接
> - 资产说明文档 URI
> - 资产报告哈希
> - 线下凭证编号
> - 资产登记信息摘要
>
> 该信息不要求连接真实资产系统，但需要说明它在真实 RWA 项目中可能承担的作用。

**✅ 已完成**

| 链上字段 | 内容 |
| --- | --- |
| `assetDocument`（string） | 公检证书样张的 IPFS URI：`ipfs://bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4` |
| `assetDocumentHash`（bytes32） | 证书文件内容的 `keccak256`：`0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0` |
| `assetBatchId`（string） | 批次标识：`XJ-2025-A07/C3-D12`（产地-年度-轧花厂批次码/仓号-垛位） |
| `documentVersion` + `documentUpdatedAt` | 证明版本号与最近更新时间，每次更新递增，形成审计轨迹 |

**证明文件已真实上传 IPFS 并完成端到端核验**：

| 项 | 值 |
| --- | --- |
| IPFS CID | `bafkreidggh636ohwp2z2vtlqz3dz7rvj7yptlik6p7npospobcnt37klh4`（CIDv1 / raw codec / sha2-256） |
| 证明文件 | `asset/cotton-certificate-XJ-2025-A07.pdf`（40,747 bytes，公证检验证书样张） |
| 文件 sha2-256 | `6631fdbf38f67eb3aacd70cec79fc6a9fe1f35a15e7fdaf749ee089b3dfd4b3f` |
| 文件 keccak256 | `0x55521d31b7dd9c9c88a809568702b0fdec29f79ff2fbc9e28241a6b2f351ccb0` |
| 可取网关 | `https://ipfs.filebase.io/ipfs/<CID>`（实测 HTTP 200）｜`https://trustless-gateway.link/ipfs/<CID>?format=raw` |

核验过程：① 由本地 PDF 重算 CID 与 sha2-256，与给定 CID 的 digest 完全一致；② 从本机 IPFS 网关与公共网关
各取回一次，均与本地文件**逐字节一致**；③ 部署脚本支持由文件自动计算 keccak256（`COTTON_DOC_FILE`），
避免手抄哈希出错。

> 哈希口径：IPFS 的 CID 基于 sha2-256，链上存的是 keccak256，二者不同；CID 用于取文件，keccak256 用于与链上比对。
> 该样张为模拟件（含"模拟样张"水印），不含任何真实机构、企业或个人名称。

**它在真实 RWA 项目中承担的作用：**

1. **可信性锚点**：只存 URI 无法防止指向的内容被替换。URI + 内容哈希同时上链后，任何人都能重新计算哈希，验证拿到的证书就是签发时的那一份。
2. **审计追溯**：版本号让每一次证书更新都留痕，监管方与出资方能还原"某个时点的仓单对应哪一版检验结果"。
3. **兑付与定价依据**：公检指标（长度、马克隆值、断裂比强度等）直接决定棉花的升贴水定价，证书不可篡改是链上凭证能被下游纱厂接受的前提。
4. **对账依据**：`maxSupply` 与证明中的入库净重相互印证，构成"链上总量 ≤ 链下托管量"的可核对关系。

---

### 4. 部署到 Avalanche 测试网

> 将合约部署到 Avalanche Fuji Testnet，并提供：
> - 合约地址
> - 部署交易链接
> - 区块浏览器链接
> - 合约交互或测试截图
> - 测试网网络名称和 Chain ID

**✅ 已完成**

| 项 | 值 |
| --- | --- |
| 测试网网络名称 | Avalanche Fuji Testnet |
| Chain ID | **43113** |
| RPC URL | `https://api.avax-test.network/ext/bc/C/rpc` |
| 合约地址 | **`0xc5460791f4a9A890331496dF088091335CF9226e`** |
| 部署交易哈希 | `0xbadcf524646349b8c08cf79bc4a20cc54b66903177dceaf68ab841e8987e6958` |
| 部署交易链接 | https://testnet.snowtrace.io/tx/0xbadcf524646349b8c08cf79bc4a20cc54b66903177dceaf68ab841e8987e6958 |
| 区块浏览器合约链接 | https://testnet.snowtrace.io/address/0xc5460791f4a9A890331496dF088091335CF9226e |
| 部署区块 / gas | 区块 58444158，gasUsed 1,969,046，effectiveGasPrice 160 wei |

**Fuji 链上交互记录（真实交易，均可打开验证）**：

| 行为 | 交易哈希 |
| --- | --- |
| `mint` 22,000 kg（皮棉入库、公检签发仓单） | `0x4151ec8c76de94760e3ea2a2658f240f692c3847fcb25c336c434aca0d5d81ab` |
| `transfer` 5,000 kg（仓单流转给下游纱厂） | `0xbd7a4078dedd39b06d32fefcc9b2ee01c86e9481aa46d0bbf93705f0a3ab8ae6` |
| `pledge` 10,000 kg（监管方标记权利受限） | `0x5efbee0cf5ea155da987665a5e0aca4a9fa9ba09f5712e583ed660ebd68639b0` |
| `burn` 1,000 kg（提货出库注销） | `0x24e8d9a5367efde810ba862eabc60b5f82b7244287fc50bb2b47746f4736e380` |

交互后链上状态：`totalSupply` 21,000 kg；持有人余额 16,000 kg；纱厂余额 5,000 kg；
`pledgedOf` 10,000 kg、`freeBalanceOf` 6,000 kg；`assetDocument` 为真实 IPFS CID；
`assetDocumentHash` = `0x55521d31…ccb0`（即样张 PDF 的真实 keccak256）。

**部署前已在本地链完成演练**：使用 Anvil（Chain ID 刻意设为 43113，与 Fuji 一致）部署并跑通全部业务流，
部署地址 `0x5FbDB2315678afecb367f032d93F642f64180aa3`，验证内容包括签发、越权拒绝、流转、注销、
质押锁定、损耗核销、资产证明版本递增、**兼容重载 `updateAssetDocument(string)` 调用**（哈希置零、版本递增）、
风控暂停与终态对账（余额之和 == 总供应量）。
复现命令：`anvil --chain-id 43113` → `bash script/local-demo.sh deploy` → `bash script/local-demo.sh`。

Fuji 部署与取证一键复现：将私钥填入 `.env` 后执行 `bash script/fuji-demo.sh all`
（`check` 仅检查、`deploy` 部署、`demo` 打印各笔交易哈希与浏览器链接）。

部署与交互命令（可复现）：

```bash
forge script script/DeployCottonWarehouseReceipt.s.sol:DeployCottonWarehouseReceipt \
  --rpc-url fuji --broadcast -vvv

# 读取资产证明
cast call $CONTRACT "assetDocument()(string)" --rpc-url fuji
cast call $CONTRACT "assetDocumentHash()(bytes32)" --rpc-url fuji
cast call $CONTRACT "totalSupply()(uint256)" --rpc-url fuji

# 交互：发行 / 转账 / 质押 / 销毁
cast send $CONTRACT "mint(address,uint256)" $HOLDER 22000e18 --rpc-url fuji --private-key $PRIVATE_KEY
cast send $CONTRACT "transfer(address,uint256)" $SPINNER 1000e18 --rpc-url fuji --private-key $PRIVATE_KEY
cast send $CONTRACT "pledge(address,uint256)" $HOLDER 5000e18 --rpc-url fuji --private-key $PRIVATE_KEY
cast send $CONTRACT "burn(uint256)" 500e18 --rpc-url fuji --private-key $PRIVATE_KEY
```

截图见 README 第 6 节。

---

### 5. 编写测试

> 至少测试以下场景：
> - 合约部署成功
> - 初始 Token 信息正确
> - 授权账户可以发行 Token
> - 非授权账户不能发行 Token
> - 持有人可以转账
> - Token 可以被销毁
> - 总供应量和账户余额变化正确
> - 非授权账户不能修改资产证明信息
> - 错误操作能够被合约拒绝

**✅ 已完成：43 项测试全部通过**（31 项单元测试 + 4 项不变量测试 + 8 项安全审计证据测试）

```
Ran 3 test suites in 985.98ms (1.65s CPU time): 43 tests passed, 0 failed, 0 skipped (43 total tests)
```

| 作业要求场景 | 对应测试函数 | 结果 |
| --- | --- | --- |
| 合约部署成功 | `test_InitialState_TokenMetadataAndRoles` | PASS |
| 初始 Token 信息正确 | `test_InitialState_AssetDocument` | PASS |
| 授权账户可以发行 Token | `test_Mint_ByAuthorizedWarehouse` | PASS |
| 非授权账户不能发行 Token | `test_Mint_RevertsForUnauthorizedAccount` | PASS |
| 持有人可以转账 | `test_Transfer_ByHolder` | PASS |
| Token 可以被销毁 | `test_Burn_ReducesSupplyAndBalance` | PASS |
| 总供应量和账户余额变化正确 | `testFuzz_MintBurn_Conservation`（256 轮 fuzz） | PASS |
| 非授权账户不能修改资产证明信息 | `test_UpdateAssetDocument_RevertsForUnauthorizedAccount` | PASS |
| 错误操作能够被合约拒绝 | 12 项 revert 测试（超额发行、零值、超余额转账、超质押额度、空证明、暂停期间操作等） | PASS |

额外业务机制测试：`test_Pledge_BlocksTransferBeyondFreeBalance`、`test_Pledge_BlocksBurnOfPledgedAmount`、
`test_Unpledge_RestoresTransferability`、`test_BurnLoss_ByRegistrar_WritesOffMoistureDamage`、
`test_BurnLoss_AdjustsPledgeAndKeepsInvariant`、`test_Pause_BlocksTransferMintAndBurn`、
`test_SetMaxSupply_UpAndDownWithGuard`、`test_SetAssetBatchId_RequiresDocumentRole`、
`test_UpdateAssetDocument_URIOonly_ClearsHashAndBumpsVersion`（兼容重载：哈希置零、双参更新恢复哈希绑定）、
`test_UpdateAssetDocument_URIOonly_RevertsForUnauthorizedAccount`。

不变量测试（随机调用序列，64 runs × 2048 calls，0 reverts）：

- `invariant_TotalSupplyNeverExceedsMaxSupply`：链上总量永远不超过托管上限
- `invariant_PledgedNeverExceedsBalance`：质押额度永远不超过实际余额
- `invariant_SumOfBalancesEqualsTotalSupply`：全体余额之和恒等于总供应量
- `invariant_DocumentVersionMonotonic`：资产证明版本号单调递增，且"零哈希"只可能出现在更新之后（初版证明必定携带内容哈希）

---

## 提交方式

> 1. Fork 课程仓库并 Clone 到本地。
> 2. 在 learn/ 下创建自己的目录：`learn/YourGitHubName/`
> 3. 在自己的目录下创建：`learn/YourGitHubName/task5/`
> 4. 将 README.md、截图和其他必要材料放入 task5 文件夹。
> 5. 在 README 中提供自己的代码仓库地址和相关的合约地址。
> 6. 不要修改其他学员的目录或公共任务说明。
> 7. 提交 Pull Request。
> 8. 等待助教审核。

**✅ 提交信息**

- 作业提交仓库：https://github.com/emptytouch/Avalanche-101-Bootcamp （分支 `task5`）
- 提交目录：`learn/emptytouch/task5/`（`task5.md` + `README.md`）
- 合约代码仓库：https://github.com/emptytouch/cwrt-cotton-rwa
- 截图目录：`learn/emptytouch/task5/`（`task5.1` ~ `task5.7-emptytouch.png`，共 7 张）
- 未修改其他学员目录与公共任务说明

---

## README.md 必须包含的内容

> 1. 学员信息（GitHub 用户名、作业项目的仓库地址）
> 2. 项目说明（RWA 业务场景、现实资产或资产权益介绍）
> 3. 合约信息（智能合约代码仓库地址、合约部署地址）
> 4. 功能说明（Token 发行 / 销毁 / 转账 / 余额查询 / 总供应量查询 / 发行权限控制 / 资产证明信息更新）
> 5. 截图材料（合约部署成功、区块浏览器中的合约或交易、Token 发行、Token 转账、Token 销毁）

**✅ 已全部包含在 `learn/emptytouch/task5/README.md`**，各节与上述要求一一对应：

| 作业要求 | README 章节 |
| --- | --- |
| 学员信息 | 第 1 节 |
| 项目说明 | 第 2 节（含业务四问答案与风险边界） |
| 合约信息 | 第 3 节（代码仓库、部署地址、测试网参数） |
| 功能说明 | 第 4 节（逐条对照 + 核心技术点代码） |
| 截图材料 | 第 6 节（部署成功 / 浏览器 / 发行 / 转账 / 销毁 / 质押锁定 / 测试，共 7 张） |

---

## 截止时间

<9月20日> 24:00:00 (UTC+8)
