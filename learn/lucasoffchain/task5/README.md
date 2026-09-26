# Avalanche RWA Token：农产品仓单

> 本项目仅用于技术学习和业务模拟，不代表真实资产，不构成募集、投资建议或金融产品发行。

## 学员信息

- GitHub 用户名：`lucasoffchain`
- 作业项目仓库：<https://github.com/lucasoffchain/ava-rwa>

## 业务场景

`Agricultural Warehouse Token`（`AWT`）模拟优质咖啡豆电子仓单：

- 现实资产：由指定仓库保管并经质检合格的 Grade A 咖啡豆。
- 托管与证明：现实项目中由持牌仓储机构负责实物托管，独立检验机构出具数量、等级和定期盘点报告；本作业以 IPFS URI 模拟报告索引。
- 映射比例：`1 AWT = 1 千克咖啡豆仓单权益`。合约 `decimals()` 为 `0`，不允许拆分为不足一千克的单位。
- 发行：托管方确认咖啡豆入库后，授权发行账户按实际入库千克数铸造 AWT。
- 转让：Token 转账代表对应仓单权益在账户之间转移。
- 销毁：持有人提取实物或完成线下赎回时销毁对应 AWT，避免同一资产重复流通。

资产证明信息只保存报告的 URI 或哈希索引，不把大文件写入链上。更新后的链上事件可供审计方追踪报告版本，但合约本身无法验证线下报告真实性。

## 合约设计

主合约：[src/AgriculturalWarehouseToken.sol](src/AgriculturalWarehouseToken.sol)

- 基于 OpenZeppelin `ERC20`、`ERC20Burnable` 和 `AccessControl`。
- `mint`：仅 `MINTER_ROLE` 可调用。
- `burn` / `burnFrom`：持有人可销毁自己的 Token，或使用 ERC-20 授权额度代为销毁。
- `transfer` / `balanceOf` / `totalSupply`：由标准 ERC-20 实现。
- `updateAssetDocument`：仅 `ASSET_MANAGER_ROLE` 可更新，拒绝空值及重复值。
- 部署者指定的管理员初始拥有管理、发行和资产文档更新权限，并可通过 `grantRole`/`revokeRole` 分离职责。
- 自定义事件：`TokensIssued`、`TokensRedeemed`、`AssetDocumentUpdated`；标准转账、发行、销毁同时产生 ERC-20 `Transfer` 事件。

## 本地测试

环境要求：[Foundry](https://book.getfoundry.sh/getting-started/installation)

```bash
forge install
forge test -vv
```

测试位于 [test/AgriculturalWarehouseToken.t.sol](test/AgriculturalWarehouseToken.t.sol)，覆盖：

- 部署及初始 Token 信息
- 授权/非授权发行
- 转账、销毁、余额及总供应量变化
- 授权/非授权资产证明更新
- 独立发行人授权
- 超余额销毁、空文档、重复文档、无效管理员等错误操作

## Avalanche Fuji 部署

- 网络：Avalanche Fuji C-Chain
- Chain ID：`43113`
- RPC：`https://api.avax-test.network/ext/bc/C/rpc`
- 浏览器：<https://testnet.snowtrace.io/>

复制环境变量模板并填入专门用于测试网的账户。不要使用主网私钥，也不要提交 `.env`：

```bash
cp .env.example .env
source .env
cast balance "$(cast wallet address --private-key "$PRIVATE_KEY")" --rpc-url fuji
forge script script/DeployAgriculturalWarehouseToken.s.sol \
  --rpc-url fuji --broadcast
```

部署后填写 `TOKEN_ADDRESS` 和接收账户，再发送四笔独立交互交易：

```bash
source .env
forge script script/InteractAgriculturalWarehouseToken.s.sol \
  --rpc-url fuji --broadcast
```

### 部署记录

- 网络：Avalanche Fuji C-Chain
- Chain ID：`43113`
- 部署账户：`0x192d138B24F9E35D3CFa0e19B56C1c1Ca1584DeE`
- 合约地址：[`0x714B8555bFAB794addf988336068f1dd51E1a594`](https://testnet.snowtrace.io/address/0x714B8555bFAB794addf988336068f1dd51E1a594)
- 部署交易：[`0x7b68ac4034c7e71013f76c47ad8f444bd8c0fe57325c7dbef83cd229d38db22d`](https://testnet.snowtrace.io/tx/0x7b68ac4034c7e71013f76c47ad8f444bd8c0fe57325c7dbef83cd229d38db22d)
- Routescan 合约页：<https://43113.testnet.routescan.io/address/0x714B8555bFAB794addf988336068f1dd51E1a594>

### 交互记录

| 操作 | 交易哈希 | 浏览器 |
| --- | --- | --- |
| 发行 `mint(1000)` | `0x8e5bd386942cb455e41ffe75da308766fef2409d6dea8d3b764db1bef962eda9` | [Snowtrace](https://testnet.snowtrace.io/tx/0x8e5bd386942cb455e41ffe75da308766fef2409d6dea8d3b764db1bef962eda9) |
| 转账 `transfer(100)` | `0x4763dc4af336754e12b7efe3a9d73d42a1b3eda5957cc0e993d634d07310e069` | [Snowtrace](https://testnet.snowtrace.io/tx/0x4763dc4af336754e12b7efe3a9d73d42a1b3eda5957cc0e993d634d07310e069) |
| 销毁 `burn(50)` | `0xc2affc08b8ac4250f01315aa99f38732392c1703c98187920cd2015f8c0aa1bc` | [Snowtrace](https://testnet.snowtrace.io/tx/0xc2affc08b8ac4250f01315aa99f38732392c1703c98187920cd2015f8c0aa1bc) |
| 更新资产证明 | `0x6f2a2a452863b07ab377c9b36e169accf4aeff0383a585493b16666938765b48` | [Snowtrace](https://testnet.snowtrace.io/tx/0x6f2a2a452863b07ab377c9b36e169accf4aeff0383a585493b16666938765b48) |

链上校验结果（部署与交互后）：

- `name`：`Agricultural Warehouse Token`
- `symbol`：`AWT`
- `totalSupply`：`950`
- 部署者余额：`850`
- 接收方 `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` 余额：`100`
- `assetDocument`：`ipfs://bafy-example-coffee-custody-report-v2`

## 截图材料

截图目录：[docs/screenshots/](docs/screenshots/)

- [x] 合约部署成功：`task5-lucasoffchain-deployment.png`
- [x] 浏览器中的合约或部署交易：`task5-lucasoffchain-explorer.png`
- [x] Token 发行交易：`task5-lucasoffchain-mint.png`
- [x] Token 转账交易：`task5-lucasoffchain-transfer.png`
- [x] Token 销毁交易：`task5-lucasoffchain-burn.png`

截图应隐藏私钥、助记词和其他敏感信息。

## 风险边界

- 合约不验证咖啡豆是否真实存在、质量是否达标，也不能阻止托管方出具虚假或过期报告。
- Token 不自动产生收益，也不保证可按任何价格出售或赎回。
- 管理员可增减授权账户；真实项目应采用多签、时间锁、发行上限、暂停机制和职责分离。
- 资产丢失、重复质押、法律权属、赎回执行、地区监管和预言机故障均属于链下风险。
- 正式发行前必须完成法律意见、安全审计、托管对账、KYC/AML 和持续信息披露。
