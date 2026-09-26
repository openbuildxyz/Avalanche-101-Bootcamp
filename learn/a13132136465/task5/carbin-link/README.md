# Task 5：Avalanche 碳减排 RWA Token

> 本项目仅用于技术学习和业务模拟，不代表真实碳信用，不涉及资产募集、投资建议或金融产品发行。

## 学员与提交信息

以下内容请在提交 PR 前填写：

| 项目 | 内容 |
| --- | --- |
| GitHub 用户名 | a13132136465 |
| 作业仓库地址 | https://github.com/a13132136465/carbin-link.git |
| 合约代码目录 | `learn/a13132136465/carbin-link` |

## 业务设计

本项目选择“碳积分 / 碳排放额度”场景。`Verified Carbon Credit`（`VCC`）将经过核证的碳减排权益映射为 ERC-20 Token：

- 现实资产：由具体减排项目产生、经核证机构确认的温室气体减排量。
- 托管/资产证明方：业务模拟中由项目运营方保管底层登记记录，由独立核证机构出具报告；链上授权的资产证明更新账户负责登记报告 URI 或哈希。
- 资产单位：`1 VCC`（即 `1e18` 个最小单位）代表 `1` 公吨经核证的二氧化碳当量（tCO2e）。
- 发行（mint）：核证完成且底层登记记录已锁定后，授权发行账户按数量铸造 VCC。
- 转让（transfer）：持有人之间转移对应碳减排权益的链上记账。
- 销毁（burn）：持有人声明使用/注销相应碳减排权益，Token 退出流通，总供应量同步减少。

`assetDocument` 保存的是证明材料的链下定位信息，例如 IPFS URI、报告哈希或登记编号。它方便审计者把链上供应量与链下报告对应起来，但 URI 本身不等于真实性证明；真实项目仍需核证、托管、法律文件及防止重复发行/重复注销的流程。

## 合约信息

| 项目 | 值 |
| --- | --- |
| 合约 | `src/CarbonCreditToken.sol` |
| 名称 | `Verified Carbon Credit` |
| 符号 | `VCC` |
| 精度 | `18` |
| 初始供应量 | `0` |
| Solidity | `0.8.24` |
| OpenZeppelin Contracts | `v5.6.1`（固定提交 `5fd1781`） |
| 网络 | Avalanche Fuji C-Chain |
| Chain ID | `43113`（十六进制 `0xA869`） |
| 原生 Gas Token | 测试 AVAX |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| 浏览器 | `https://testnet.snowtrace.io/` |

### 部署结果（部署后填写）

| 项目 | 内容 |
| --- | --- |
| 合约地址 | `0x835ce0b6f6f2c6331483b48fb67465f35f756bd9` |
| 部署交易哈希 | `0x540e5e114d8753bd8e5fd40ec8643c22d2e31a9e5a591f75cdbff66f40908030` |
| 部署交易链接 | `https://testnet.snowtrace.io/tx/0x540e5e114d8753bd8e5fd40ec8643c22d2e31a9e5a591f75cdbff66f40908030` |
| 合约浏览器链接 | `https://testnet.snowtrace.io/address/0x835ce0b6f6f2c6331483b48fb67465f35f756bd9` |
| 代码仓库地址 | `https://github.com/a13132136465/carbin-link.git` |

## 功能与权限

- 标准 ERC-20 查询和操作：`name`、`symbol`、`decimals`、`totalSupply`、`balanceOf`、`allowance`、`transfer`、`approve`、`transferFrom`。
- `mint(to, amount)`：仅 `isMinter(account) == true` 的账户可调用。
- `burn(amount)`：持有人只能销毁自己的 Token。
- `updateAssetDocument(document)`：仅获授权的证明更新账户可调用，且不接受空文档。
- `setMinter` 与 `setAssetDocumentUpdater`：仅 `DEFAULT_ADMIN_ROLE` 管理员可授予或撤销相应权限。
- OpenZeppelin `AccessControl` 同时提供标准的 `grantRole`、`revokeRole`、`renounceRole` 和角色查询接口。
- 关键事件：ERC-20 `Transfer` / `Approval`、OpenZeppelin `RoleGranted` / `RoleRevoked`，以及发行权限、文档权限和资产证明更新事件。
- OpenZeppelin 标准错误与项目自定义错误共同拒绝未授权调用、零地址、空证明、余额不足和授权额度不足等错误操作。

部署者在构造时自动获得 `DEFAULT_ADMIN_ROLE`、`MINTER_ROLE` 和 `ASSET_DOCUMENT_ROLE`。生产系统应将管理员角色交给多签，并把发行和证明更新权限分配给不同账户；本作业没有实现冻结、合规白名单、供应上限、暂停、多签、预言机或链下登记系统，因此不能直接用于真实资产发行。

ERC-20 余额、转账、授权和供应量逻辑来自 OpenZeppelin `ERC20`；销毁逻辑来自 `ERC20Burnable`；权限管理来自 `AccessControl`。业务合约仅增加 RWA 所需的发行入口、资产证明和角色封装。

## 项目结构

```text
task5/
├── .gitmodules
├── .env.example
├── foundry.toml
├── README.md
├── lib/
│   └── openzeppelin-contracts/   # OpenZeppelin v5.6.1
├── script/
│   └── DeployCarbonCreditToken.s.sol
├── screenshots/
│   └── .gitkeep
├── src/
│   └── CarbonCreditToken.sol
└── test/
    └── CarbonCreditToken.t.sol
```

项目使用官方 OpenZeppelin Contracts v5.6.1，并将依赖固定为 Git submodule。测试和部署脚本直接声明所需的 Foundry cheatcode 接口，因此不依赖 `forge-std`。

首次克隆含子模块的仓库后执行：

```bash
git submodule update --init --recursive
```

如果课程仓库没有保留子模块，也可以在项目目录重新安装固定版本：

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.6.1 --no-commit
```

## 编译与测试

先安装 [Foundry](https://getfoundry.sh/introduction/installation/)，进入本目录后执行：

```bash
forge fmt --check
forge build
forge test -vv
```

测试文件完整覆盖 Task 5 要求：部署、初始信息、授权 mint、非授权 mint 拒绝、transfer、burn、余额与总供应量变化、授权/非授权资产证明更新和余额不足、零地址、空文档、越权管理等错误操作；另覆盖 OpenZeppelin `approve` / `transferFrom`。

## 部署到 Avalanche Fuji

### 1. 准备环境

复制环境变量模板：

```bash
cp .env.example .env
```

Windows PowerShell 可执行：



然后编辑 `.env`：

- `PRIVATE_KEY`：只使用专门的 Fuji 测试钱包私钥，绝不要使用主网资金钱包。
- `INITIAL_ASSET_DOCUMENT`：填写模拟核证报告的 IPFS URI、哈希或登记编号。
- 确保部署地址有少量 Fuji 测试 AVAX 支付 Gas。

提交前确认 `.env` 没有进入 Git；本项目已在 `.gitignore` 中排除它。

### 2. 先模拟，再广播

```bash
forge script script/DeployCarbonCreditToken.s.sol:DeployCarbonCreditToken \
  --rpc-url fuji -vvvv
```

确认模拟成功后执行真实测试网部署：

```bash
forge script script/DeployCarbonCreditToken.s.sol:DeployCarbonCreditToken \
  --rpc-url fuji --broadcast -vvvv
```

终端会给出部署交易；Foundry 也会把广播记录写入：

```text
broadcast/DeployCarbonCreditToken.s.sol/43113/run-latest.json
```


### 3. 验证合约

优先使用下面的 CLI 命令验证，它会按 Foundry 的 import 和 remapping 设置生成标准编译输入。也可以按照 Avalanche 官方流程，在 Fuji 浏览器打开合约地址，进入 **Contract → Verify & Publish**。如果浏览器只接受单文件，先执行 `forge flatten src/CarbonCreditToken.sol > CarbonCreditToken.flattened.sol`，仅保留第一条 SPDX 声明后上传；编译器选择 `v0.8.24`，优化开启，runs 为 `200`，EVM 版本为 `cancun`，构造参数为部署时的 `INITIAL_ASSET_DOCUMENT`。

也可尝试 Snowtrace 兼容 API（不同 Foundry 版本的 custom verifier 行为可能不同）：

```bash
forge verify-contract <CONTRACT_ADDRESS> \
  src/CarbonCreditToken.sol:CarbonCreditToken \
  --chain 43113 \
  --compiler-version v0.8.24 \
  --num-of-optimizations 200 \
  --constructor-args "$(cast abi-encode 'constructor(string)' "$INITIAL_ASSET_DOCUMENT")" \
  --verifier custom \
  --verifier-url "$SNOWTRACE_API_URL" \
  --verifier-api-key "$SNOWTRACE_API_KEY" \
  --watch
```

如果 CLI 验证失败，不要重新部署；改用浏览器手动验证即可。

## 部署后交互示例

下面的数量都使用最小单位。因为精度为 18，`1 VCC = 1000000000000000000`。

```bash
# 发行 10 VCC（调用者必须是授权 minter）
cast send <CONTRACT_ADDRESS> \
  "mint(address,uint256)" <RECIPIENT> 10000000000000000000 \
  --private-key "$PRIVATE_KEY" --rpc-url "$FUJI_RPC_URL"

# 查询余额
cast call <CONTRACT_ADDRESS> \
  "balanceOf(address)(uint256)" <HOLDER> --rpc-url "$FUJI_RPC_URL"

# 转让 2 VCC（使用持有人的私钥）
cast send <CONTRACT_ADDRESS> \
  "transfer(address,uint256)" <RECIPIENT> 2000000000000000000 \
  --private-key "$HOLDER_PRIVATE_KEY" --rpc-url "$FUJI_RPC_URL"

# 销毁 1 VCC（使用持有人的私钥）
cast send <CONTRACT_ADDRESS> \
  "burn(uint256)" 1000000000000000000 \
  --private-key "$HOLDER_PRIVATE_KEY" --rpc-url "$FUJI_RPC_URL"

# 更新资产证明（调用者必须是授权 updater）
cast send <CONTRACT_ADDRESS> \
  "updateAssetDocument(string)" "ipfs://NEW_REPORT_CID" \
  --private-key "$PRIVATE_KEY" --rpc-url "$FUJI_RPC_URL"
```


## 截图清单

- [x] `01-deploy-success.png`：部署命令成功输出，显示合约地址和交易哈希，但不显示私钥。
- [x] `02-explorer-contract.png`：Fuji 浏览器中的合约页面和已验证代码。
- [x] `03-mint.png`：mint 交易详情及 `Transfer(0x0, recipient, amount)` 事件。
- [x] `04-transfer.png`：transfer 交易详情和双方地址/数量。
- [x] `05-burn.png`：burn 交易详情及 `Transfer(holder, 0x0, amount)` 事件。
- [x] `06-tests.png`：`forge test -vv` 全部通过。


## 风险边界

- 链上合约只能保证授权、余额和事件规则，无法自行判断链下报告真假。
- `assetDocument` 可被授权账户更新，审计时应结合历史事件，不应只读取当前值。
- 未实现强制转移或冻结，无法满足所有司法管辖区的合规要求。
- 未设置供应上限，发行量依赖 minter 的业务控制；真实项目应使用多签、额度审批和链下登记核对。
- 销毁 Token 不会自动注销现实世界登记记录，实际业务必须建立链上 burn 与线下注销的原子化或人工复核流程。

## 参考资料

- [Avalanche 官方 Fuji 网络参数](https://build.avax.network/docs/primary-network)
- [Avalanche 官方合约验证说明](https://build.avax.network/docs/primary-network/verify-contract/snowtrace)
- [Foundry 官方部署与验证说明](https://getfoundry.sh/forge/deploying)
- [OpenZeppelin ERC-20 文档](https://docs.openzeppelin.com/contracts/5.x/erc20)
- [OpenZeppelin AccessControl 文档](https://docs.openzeppelin.com/contracts/5.x/access-control)
