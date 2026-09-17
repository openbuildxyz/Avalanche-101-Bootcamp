# 部署过程详解 — Avalanche Fuji Testnet 部署与验证 Runbook

本文档记录 **XRIR（星海广场租金收益权 Token）** 从零到完成 Avalanche Fuji 测试网部署的**完整可复现过程**，包括环境准备、钱包创建、领取测试币、部署、交互验证、合约验证与截图采集。

> 目标网络：**Avalanche Fuji Testnet (C-Chain)**
> Chain ID：**43113**（`0xA869`）
> 浏览器：https://testnet.snowtrace.io

---

## 目录

- [0. 前置条件](#0-前置条件)
- [1. 项目初始化（Foundry + OpenZeppelin）](#1-项目初始化foundry--openzeppelin)
- [2. 编写合约与测试](#2-编写合约与测试)
- [3. 准备部署钱包](#3-准备部署钱包)
- [4. 领取测试网 AVAX](#4-领取测试网-avax)
- [5. 配置环境变量](#5-配置环境变量)
- [6. 部署前的本地预检](#6-部署前的本地预检)
- [7. 模拟部署（不消耗 gas，不广播）](#7-模拟部署不消耗-gas不广播)
- [8. 正式部署到 Fuji](#8-正式部署到-fuji)
- [9. 部署后交互验证](#9-部署后交互验证)
- [10. 合约源码验证](#10-合约源码验证)
- [11. 截图采集清单](#11-截图采集清单)
- [12. 常见问题排查](#12-常见问题排查)

---

## 0. 前置条件

| 工具 | 版本要求 | 校验命令 | 本次实测 |
| --- | --- | --- | --- |
| Foundry (`forge`/`cast`/`anvil`) | >= 1.0 | `forge --version` | `forge 1.8.1` |
| Git | 任意 | `git --version` | `2.49.0` |
| 操作系统 | Windows / macOS / Linux | — | Windows (PowerShell 5.1) |

安装 Foundry（若未安装）：

```bash
# Windows (PowerShell)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 校验
forge --version
cast --version
```

---

## 1. 项目初始化（Foundry + OpenZeppelin）

```bash
# 1.1 初始化 Foundry 项目（--no-git 表示先不建子模块仓库）
forge init task5 --no-git --no-commit
cd task5

# 1.2 初始化 git 仓库（forge install 依赖 git submodule）
git init

# 1.3 安装 OpenZeppelin Contracts（本次锁定 v5.7.0）
forge install OpenZeppelin/openzeppelin-contracts --no-commit

# 1.4 删除模板占位文件
rm src/Counter.sol test/Counter.t.sol script/Counter.s.sol
```

### 1.5 配置 `foundry.toml`

关键点：`solc = "0.8.24"`（OpenZeppelin v5 要求 `^0.8.20`）、`evm_version = "shanghai"`（保证在所有 EVM 链上兼容，不使用 Cancun 新操作码）、并注册 Fuji RPC 与浏览器配置。

```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc = "0.8.24"
evm_version = "shanghai"
optimizer = true
optimizer_runs = 200
fs_permissions = [{ access = "read", path = "./" }]
remappings = [
    "@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/",
    "forge-std/=lib/forge-std/src/",
]

[rpc_endpoints]
fuji = "${FUJI_RPC_URL}"
avalanche = "https://api.avax.network/ext/bc/C/rpc"

[etherscan]
fuji = { key = "${SNOWTRACE_API_KEY}", chain = 43113, url = "https://api.snowtrace.io/api" }
```

### 1.6 配置 `remappings.txt`

```
@openzeppelin/contracts/=lib/openzeppelin-contracts/contracts/
forge-std/=lib/forge-std/src/
```

> **踩坑记录**：`forge init` 会自动创建 `lib/forge-std`；`forge install OpenZeppelin/...` 要求当前目录是 git 仓库，否则会报错。因此顺序必须是 `git init` → `forge install`。

---

## 2. 编写合约与测试

本步骤产出三个文件：

| 文件 | 作用 |
| --- | --- |
| `src/RentalIncomeRightToken.sol` | RWA Token 合约（ERC-20 + Ownable + Pausable + 资产证明） |
| `test/RentalIncomeRightToken.t.sol` | 45 个测试（含 2 个 Fuzz 测试） |
| `script/DeployRentalIncomeRightToken.s.sol` | 部署脚本 |
| `script/TokenActions.s.sol` | 部署后交互脚本（发行/转账/销毁/更新资产证明/查询） |

编译与测试：

```bash
forge build
forge test -vv
```

**预期结果**：

```
Ran 45 tests for test/RentalIncomeRightToken.t.sol:RentalIncomeRightTokenTest
Suite result: ok. 45 passed; 0 failed; 0 skipped
```

> **踩坑记录 1**：`console2.log("Max supply:", 12_000_000 ether)` 会编译失败：
> `Member "log" not unique after argument-dependent lookup`。
> 原因是 `12_000_000 ether` 是**有理数字面量**，既能隐式转成 `uint256` 也能转成 `int256`，导致重载解析歧义。
> **修复**：显式类型转换 `console2.log("Max supply:", uint256(12_000_000 ether))`。
>
> **踩坑记录 2**：覆盖 `ERC20Burnable.burn` 时必须写 `override`（v5 中 `burn` 只由 `ERC20Burnable` 声明），并在 `_update` 上叠加 `whenNotPaused` 实现暂停熔断。

---

## 3. 准备部署钱包

> ⚠️ **安全铁律**：**绝对不要**使用持有真实资产的主网私钥。请使用一次性测试网钱包。
> `.env` 已在 `.gitignore` 中，永不入库。

### 方式 A：用 Foundry 生成全新钱包（推荐）

```bash
cast wallet new
```

输出示例：

```
Address:     0x....  （示例地址，仅用于领取测试币）
Private key: 0x....  （示例私钥，仅写入 .env，切勿提交或外泄）
```

> ⚠️ **私钥只应存在于 `.env` 中，绝不要粘贴进任何会被提交的文件（包括本文档）。**
> 不要把真实私钥写进 README / 截图 / 聊天记录。

把 **Private key** 记下来（只写入 `.env`），**Address** 用于领取测试币。

### 方式 B：使用已有的测试网钱包

如果你已有 Fuji 测试网钱包，直接使用其私钥即可。

### 方式 C：用助记词派生（可选）

```bash
# 从助记词派生第一个账户
cast wallet derive --mnemonic "<your mnemonic>" 0
```

---

## 4. 领取测试网 AVAX

Fuji 的 gas 代币是测试 AVAX，需要从水龙头领取。

| 水龙头 | 地址 | 说明 |
| --- | --- | --- |
| Avalanche 官方 Faucet | https://faucet.avax.network/ | 选择 **Fuji (C-Chain)**，粘贴地址 |
| Core Faucet | https://core.app/tools/testnet-faucet/ | 需要登录 Core 钱包 |
| Chainlink Faucet | https://faucets.chain.link/fuji | 需 GitHub 登录 |

领取后校验余额：

```bash
cast balance 0x4589215F79884067593a6E52a9cffe344050fEAd \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc
```

**预期**：返回大于 `0` 的 wei 值（例如 `2000000000000000000` = 2 AVAX）。

> 若返回 `0`，说明还没到账，等待 30 秒后重试。部署一个合约约需 `0.0001` AVAX 级别的手续费（Fuji 基础费极低），2 AVAX 足够部署 + 后续所有交互操作。

---

## 5. 配置环境变量

复制模板并填入私钥：

```bash
cp .env.example .env
```

`.env` 内容：

```dotenv
FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
SNOWTRACE_API_KEY=
PRIVATE_KEY=0x<你的测试网私钥>
```

> **注意**：`TOKEN_OWNER` 与 `ASSET_DOCUMENT` 是可选变量。
> **若你不打算设置它们，请把这两行完全删除或注释掉**——不要留成空值。
> 因为部署脚本使用 `vm.envOr("TOKEN_OWNER", deployer)`，空字符串会被当成"已设置"，导致地址解析失败。

### 校验 `.env` 确实被忽略

```bash
git check-ignore -v .env
```

**预期输出**（证明已被忽略，不会误提交）：

```
.gitignore:12:.env	.env
```

### 校验链接与网络

```bash
cast chain-id --rpc-url $FUJI_RPC_URL     # 预期：43113
cast block-number --rpc-url $FUJI_RPC_URL # 预期：返回当前区块高度
```

---

## 6. 部署前的本地预检

在花测试币之前，先确认编译与字节码正常：

```bash
forge build
forge test -vv

# 查看将要部署的字节码大小（EIP-170 运行时代码上限 24576 字节）
forge build --sizes | grep RentalIncomeRightToken
```

**本次实测**：

```
| Contract               | Runtime Size (B) | Initcode Size (B) | Runtime Margin (B) | Initcode Margin (B) |
| RentalIncomeRightToken | 3,924            | 4,908             | 20,652             | 44,244              |
```

（运行时代码 3,924 字节，距离 24,576 字节的 EIP-170 上限还有 20,652 字节余量。）

---

## 7. 模拟部署（不消耗 gas，不广播）

这是**最关键的一步预检**：把部署交易在真实的 Fuji 链状态上做一次本地模拟。它不会发送任何交易、不消耗任何 gas，但能提前暴露链不兼容、余额不足、合约构造回滚等问题。

```bash
forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
  --rpc-url $FUJI_RPC_URL
```

**本次实测输出**：

```
Script ran successfully.
== Return ==
token: contract RentalIncomeRightToken 0x<模拟地址，已省略>
== Logs ==
  === RentalIncomeRightToken (XRIR) deployment ===
  Chain ID      : 43113
  Deployer      : <你的部署地址>
  Initial owner : <你的部署地址>
  Asset document: ipfs://bafybeigd7yqkqkzv3hq2s5kz2m5tq3xg2c4m3f6kz4q2w7n5c3t2example/rental-rights-prospectus.json
  Max supply    : 12000000000000000000000000
  --------------------------------------------------
  RentalIncomeRightToken deployed at: 0x<模拟地址，已省略>
  --------------------------------------------------
Estimated total gas used for script: 1516347
SIMULATION COMPLETE. To broadcast these transactions, add --broadcast ...
```

**判读要点**：

| 观察项 | 正常表现 | 异常处理 |
| --- | --- | --- |
| `Chain ID` | `43113` | 若不是，说明 RPC 配错或用错了网络 |
| `Deployer` | 你的地址 | 不是你的地址说明 `PRIVATE_KEY` 配错 |
| `deployed at` | 一个合约地址 | 出现 `Revert` 说明构造函数回滚 |
| `SIMULATION COMPLETE` | 出现 | 出现 `Error` 需按 [第 12 节](#12-常见问题排查) 排查 |

> 注意：模拟阶段显示的合约地址**不等于**最终部署地址。最终地址由部署者的 **nonce** 决定，会在真正广播后确定。

---

## 8. 正式部署到 Fuji

确认第 4 步余额充足、第 7 步模拟通过后，加上 `--broadcast` 真正上链。

### 方式 A：一键脚本（推荐，Windows / PowerShell）

仓库根目录的 `deploy-fuji.ps1` 封装了第 8–9 节的全部命令：

```powershell
.\deploy-fuji.ps1              # 部署 + 演示 mint/transfer/burn + 更新资产证明
.\deploy-fuji.ps1 -UpdateDocs  # 同上，并自动回填 README.md / DEPLOYMENT.md 中的占位符
```

脚本执行流程：

1. 读取 `.env` 的 `PRIVATE_KEY`，校验格式并推导部署地址
2. 校验 Chain ID 必须为 `43113`（防止误在主网执行）
3. 查询余额；**余额为 0 时打印水龙头指引并以退出码 1 退出**（不会发送任何交易）
4. `forge build` + `forge test`，存在失败测试则终止
5. `--broadcast` 部署，并从输出中解析合约地址
6. 从 `broadcast/.../43113/run-latest.json` 解析交易 hash，再取区块号与 gasUsed
7. 依次执行 mint(1000 XRIR) → transfer(400) → burn(250) → updateAssetDocument
8. 打印最终链上状态，以及可直接粘贴的"回填材料"摘要表

> `-UpdateDocs` 会替换 8 个占位符：`<CONTRACT_ADDRESS>`、`<DEPLOY_TX_HASH>`、`<DEPLOY_TX_URL>`、`<CONTRACT_URL>`、
> `<DEPLOYER_ADDRESS>`、`<OWNER_ADDRESS>`、`<BLOCK_NUMBER>`、`<GAS_USED>`。
> 它**不会**替换 `<GITHUB_USERNAME>` 与 `<REPO_URL>`，这两个需要你手动填写。
>
> ⚠️ 注意：由于本作业已使用 `-UpdateDocs` 完成回填，上述占位符在本文档与 `README.md` 中**均已不存在**（已被真实值取代），因此**不要再运行该脚本**，否则会重新部署一个新合约并产生第二个地址，导致证据链混淆。

### 方式 B：手动执行

```bash
forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
  --rpc-url $FUJI_RPC_URL \
  --broadcast \
  --private-key $PRIVATE_KEY
```

**预期输出**：

```
ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
Transactions saved to: broadcast/DeployRentalIncomeRightToken.s.sol/43113/run-latest.json
```

**关键产物**：

1. **合约地址** —— 控制台打印的 `deployed at: 0x...`
2. **交易 Hash** —— 在 `broadcast/DeployRentalIncomeRightToken.s.sol/43113/run-latest.json` 中：

```json
{
  "transactionHash": "0x0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b",
  "contractAddress": "0x0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E"
}
```

用命令直接提取：

```bash
# 合约地址
cast parse-json "$(cat broadcast/DeployRentalIncomeRightToken.s.sol/43113/run-latest.json | tr -d '\r')" \
  ".returns.token.value" 2>/dev/null || grep -o '"contractAddress":"0x[0-9a-fA-F]*"' \
  broadcast/DeployRentalIncomeRightToken.s.sol/43113/run-latest.json

# 交易 hash
grep -o '"transactionHash":"0x[0-9a-fA-F]*"' \
  broadcast/DeployRentalIncomeRightToken.s.sol/43113/run-latest.json | head -1
```

### 8.1 立刻核验部署结果

```bash
export TOKEN=<上一步的合约地址>

# 链上确认合约存在
cast code $TOKEN --rpc-url $FUJI_RPC_URL | head -c 60   # 应返回非 0x 的字节码

# 读取合约元信息
cast call $TOKEN "name()(string)"            --rpc-url $FUJI_RPC_URL
cast call $TOKEN "symbol()(string)"          --rpc-url $FUJI_RPC_URL
cast call $TOKEN "totalSupply()(uint256)"    --rpc-url $FUJI_RPC_URL
cast call $TOKEN "MAX_SUPPLY()(uint256)"     --rpc-url $FUJI_RPC_URL
cast call $TOKEN "owner()(address)"          --rpc-url $FUJI_RPC_URL
cast call $TOKEN "assetDocument()(string)"   --rpc-url $FUJI_RPC_URL
```

**预期**：

| 调用 | 预期结果 |
| --- | --- |
| `name()` | `Xinghai Plaza Rental Income Right` |
| `symbol()` | `XRIR` |
| `totalSupply()` | `0` |
| `MAX_SUPPLY()` | `12000000000000000000000000`（= 12,000,000 × 10^18） |
| `owner()` | 部署者地址 |
| `assetDocument()` | 部署时写入的 IPFS URI |

### 8.2 记录浏览器链接

- **合约地址页**：`https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E`
- **部署交易页**：`https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b`

> Snowtrace 索引有 5–30 秒延迟，若刚部署完打不开，稍等再刷新。

---

## 9. 部署后交互验证

使用 `script/TokenActions.s.sol` 完成发行 → 转账 → 销毁 → 更新资产证明的完整业务闭环，**每一步都是一条独立命令、独立交易**，便于单独截图。

### 9.1 准备两个角色

为了演示"投资者之间转让"，建议准备两个地址：

| 角色 | 说明 | 权限 |
| --- | --- | --- |
| **owner** | 部署者，拥有发行/强销毁/更新资产证明/暂停权限 | 全部 |
| **investor** | 普通投资者 | 转账、销毁自己的份额 |
| **receiver** | 接收转账的第三方地址 | 只读 |

如果只有一个钱包，也可以用另一个地址作为 `investor`（但转账/销毁必须由 `investor` 私钥签名）。最简做法：再用 `cast wallet new` 生成一个 investor 钱包，从 owner 转一点 AVAX 给它作为 gas（§9.7）。

### 9.2 查询初始状态（只读，无需私钥）

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runRead(address)" $TOKEN \
  --rpc-url $FUJI_RPC_URL
```

### 9.3 发行 Token（mint）— 必须由 owner 签名

```bash
export INVESTOR=<投资者地址>

forge script script/TokenActions.s.sol:TokenActions \
  --sig "runMint(address,address,uint256)" $TOKEN $INVESTOR 1000000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
```

**参数说明**：`1000000000000000000000` = `1000 * 10^18` = **1000 XRIR**。

**预期输出**：

```
=== mint (issuance) ===
Token : 0x...
To    : 0x...  (investor)
Amount: 1000000000000000000000
recipient balance: 1000000000000000000000
totalSupply      : 1000000000000000000000
ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.
```

### 9.4 转账（transfer）— 由 investor 签名

```bash
export RECEIVER=<接收方地址>
export INVESTOR_KEY=<investor 私钥>

forge script script/TokenActions.s.sol:TokenActions \
  --sig "runTransfer(address,address,address,uint256)" \
  $TOKEN $INVESTOR $RECEIVER 400000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
```

**参数说明**：转账 **400 XRIR**。

**预期输出**（总供应量不变，这是转账的关键验证点）：

```
sender balance  : 600000000000000000000
receiver balance: 400000000000000000000
totalSupply     : 1000000000000000000000
```

### 9.5 销毁（burn）— 由 investor 签名

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runBurn(address,address,uint256)" $TOKEN $INVESTOR 250000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
```

**参数说明**：销毁 **250 XRIR**。

**预期输出**（总供应量减少，这是销毁的关键验证点）：

```
holder balance: 350000000000000000000
totalSupply   : 750000000000000000000
```

### 9.6 更新资产证明（updateAssetDocument）— 必须由 owner 签名

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runUpdateDocument(address,string)" $TOKEN \
  "ipfs://bafybeih2x9k4m2v7q3s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l/asset-report-2026Q1.json" \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
```

**预期输出**：

```
assetDocument is now: ipfs://bafybei.../asset-report-2026Q1.json
updatedAt           : <时间戳>
```

### 9.7 权限边界验证（负面测试）

这一步证明"非授权账户不能发行 Token"，是作业要求的场景 4：

```bash
# 用 investor 私钥去 mint —— 预期失败
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runMint(address,address,uint256)" $TOKEN $RECEIVER 1000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
```

**预期输出**（交易回滚，合约正确拒绝）：

```
│   └─ ← [Revert] OwnableUnauthorizedAccount(0x7099...)
Error: script failed: OwnableUnauthorizedAccount(0x...)
```

> 这个"失败"是**期望结果**，截图时请标注为"权限校验通过：非授权账户被拒绝"。

### 9.8 给 investor 补充 gas（可选）

若 investor 没有 AVAX 无法发交易：

```bash
cast send $INVESTOR --value 0.5ether \
  --rpc-url $FUJI_RPC_URL --private-key $PRIVATE_KEY
```

### 9.9 用 cast 快速核对最终状态

```bash
cast call $TOKEN "totalSupply()(uint256)"          --rpc-url $FUJI_RPC_URL
cast call $TOKEN "balanceOf(address)(uint256)" $INVESTOR --rpc-url $FUJI_RPC_URL
cast call $TOKEN "balanceOf(address)(uint256)" $RECEIVER --rpc-url $FUJI_RPC_URL
cast call $TOKEN "assetDocument()(string)"         --rpc-url $FUJI_RPC_URL
```

**本次实测的完整状态演进（本地 anvil 等价流程）**：

| 步骤 | 操作 | investor 余额 | receiver 余额 | totalSupply |
| --- | --- | ---: | ---: | ---: |
| 初始 | 部署完成 | 0 | 0 | 0 |
| ① 发行 | owner mint 1000 XRIR → investor | 1000 | 0 | 1000 |
| ② 转账 | investor → receiver 400 XRIR | 600 | 400 | **1000（不变）** |
| ③ 销毁 | investor burn 250 XRIR | 350 | 400 | **750（减少）** |

---

## 10. 合约源码验证

在 Snowtrace 上让合约源码公开可读（作业加分项，也便于助教审核）。

### 10.1 申请 API Key

到 https://testnet.snowtrace.io/ → 登录 → `API Keys` → 创建 key，写入 `.env` 的 `SNOWTRACE_API_KEY`。

### 10.2 执行验证

```bash
forge verify-contract $TOKEN src/RentalIncomeRightToken.sol:RentalIncomeRightToken \
  --chain 43113 \
  --etherscan-api-key $SNOWTRACE_API_KEY \
  --verifier-url https://api.snowtrace.io/api \
  --watch
```

> 若 Snowtrace 自动验证失败，也可在浏览器合约页点击 **Verify & Publish** 手动提交。
> Foundry 部署的合约，构造函数参数是 `(address initialOwner, string initialAssetDocument)`，手动验证时需填入：
> `initialOwner` = 部署者地址，`initialAssetDocument` = 部署时的 IPFS URI。

**预期输出**：

```
Successfully verified contract RentalIncomeRightToken on the block explorer.
https://testnet.snowtrace.io/address/0x.../contract/43113/code
```

---

## 11. 截图采集清单

作业要求**至少** 5 张截图，建议按下表采集（放在 `screenshots/` 目录）：

| # | 截图内容 | 来源 | 建议文件名 |
| --- | --- | --- | --- |
| 1 | **合约部署成功** | 第 8 步 `ONCHAIN EXECUTION COMPLETE & SUCCESSFUL.` 终端输出 | `01-deploy.jpg` |
| 2 | **区块浏览器中的合约/交易** | `https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E` 页面（显示 Contract、Balance、Transactions） | `02-snowtrace-contract.jpg` |
| 3 | **Token 发行截图** | 第 9.3 步 mint 终端输出，或 Snowtrace 上的 mint 交易详情 | `03-mint.jpg` |
| 4 | **Token 转账截图** | 第 9.4 步 transfer 终端输出，或 Snowtrace 的 transfer 交易详情 | `04-transfer.jpg` |
| 5 | **Token 销毁截图** | 第 9.5 步 burn 终端输出，或 Snowtrace 的 burn 交易详情 | `05-burn.jpg` |
| 6 | 测试全部通过 | `forge test -vv` 输出（`45 passed; 0 failed`） | `06-tests.jpg` |
| 7 | 更新资产证明 | 第 9.6 步终端输出 | `07-asset-document.jpg` |

**截图要求**：

- 终端截图需**包含完整命令**和输出，能看清合约地址。
- 浏览器截图需**包含 URL 栏**（含 `testnet.snowtrace.io` 域名）和合约地址，避免被质疑截图来源。
- 建议在截图文件名中体现日期。

---

## 12. 常见问题排查

| 现象 | 原因 | 解决方案 |
| --- | --- | --- |
| `insufficient funds for gas * price + value` | 部署账户没有测试 AVAX | 回到第 4 步领取测试币，用 `cast balance` 确认到账 |
| `vm.envUint: environment variable "PRIVATE_KEY" not found` | 部署脚本读不到 `PRIVATE_KEY` | 确认 `.env` 已填、或用 `$env:PRIVATE_KEY=...`（PowerShell）/ `export PRIVATE_KEY=...`（bash）导出。注意 **`--private-key` 参数不会自动设置环境变量** |
| `invalid address` / `hex string of odd length` | `TOKEN_OWNER` 被设为空字符串 | 删除或注释 `.env` 中的 `TOKEN_OWNER`、`ASSET_DOCUMENT` 行 |
| `Member "log" not unique after argument-dependent lookup` | `console2.log` 传入未转型的 `ether` 字面量 | 显式转型：`uint256(12_000_000 ether)` |
| `OwnableUnauthorizedAccount(0x...)` | 用非 owner 私钥调用了受限函数 | 这是**预期行为**；改用 owner 私钥签名 |
| `MaxSupplyExceeded(...)` | 发行后总量超过 12,000,000 XRIR | 减小发行数量，或先 burn 释放额度 |
| `EnforcedPause()` | 合约处于暂停状态 | 由 owner 执行 `unpause()` |
| Snowtrace 显示 `Contract creation` 但源码为空 | 还没做源码验证 | 执行第 10 节 `forge verify-contract` |
| Snowtrace 打不开 / 404 | 索引延迟 | 等待 5–30 秒后刷新 |
| `nonce too low` | 有未确认交易占用了 nonce | 等待上一笔确认，或 `cast nonce 0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E --rpc-url $FUJI_RPC_URL` 检查 |
| `forge install` 报 `not a git repository` | 未先 `git init` | 先 `git init` 再 `forge install` |

---

## 附录：本次部署的实测记录

### A. 本地 anvil 全流程验证（部署前）

在真实 Fuji 部署前，先在本地 anvil（chainId 31337）跑通完整链路，确认脚本无误：

| 步骤 | 命令 | 实测结果 |
| --- | --- | --- |
| 部署 | `forge script ...DeployRentalIncomeRightToken --broadcast` | ✅ 成功，gas 1,516,347 |
| 查询 | `--sig "runRead(address)"` | ✅ name/symbol/decimals/totalSupply/owner 全部正确 |
| 发行 | `--sig "runMint(...)"` 1000 XRIR | ✅ `totalSupply = 1000e18` |
| 转账 | `--sig "runTransfer(...)"` 400 XRIR | ✅ sender 600 / receiver 400 / totalSupply 1000（不变） |
| 销毁 | `--sig "runBurn(...)"` 250 XRIR | ✅ holder 350 / totalSupply 750（减少） |
| 更新证明 | `--sig "runUpdateDocument(...)"` | ✅ `assetDocument` 与 `assetDocumentUpdatedAt` 同步更新 |
| 权限拒绝 | 非 owner 调 `runMint` | ✅ 回滚 `OwnableUnauthorizedAccount(0x7099...)` |

### B. Fuji 预检（模拟部署，未广播）

| 检查项 | 实测值 |
| --- | --- |
| RPC 连通性 | ✅ `cast chain-id` → `43113` |
| 模拟部署 | ✅ `SIMULATION COMPLETE` |
| 预估 gas | `1,516,347` |
| 合约字节码大小 | Runtime 3,924 B / Initcode 4,908 B（上限 24,576 B） |
| 测试套件 | ✅ `45 passed; 0 failed; 0 skipped` |

### C. 正式部署结果（已完成）

| 项目 | 值 |
| --- | --- |
| 合约地址 | `0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E` |
| 部署交易 Hash | `0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b` |
| 部署交易链接 | `https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b` |
| 浏览器合约链接 | `https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E` |
| 部署者 / owner | `0x4589215F79884067593a6E52a9cffe344050fEAd` |
| 部署区块号 | `58434848` |
| 实际消耗 gas | `1166421` |

**上链确认证据**（用于排除"只是模拟没真上链"的可能）：

| 核验项 | 结果 |
| --- | --- |
| 链上字节码 | 非空（约 7,850 字符），`cast code <合约地址>` 有返回 |
| 部署者 nonce | `0` → `1` |
| 交易回执 `status` | `1 (success)` |
| 回执 `contractAddress` | `0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E`（与预期一致） |
| 日志 `OwnershipTransferred` | `0x0 → 0x4589...fEAd`，证明构造函数以正确 owner 执行 |
| 部署后余额 | 减少约 0.00000000052 AVAX（gas 支出） |

### D. 部署后业务动作交易记录

| # | 动作 | 交易 Hash | 结果 |
| --- | --- | --- | --- |
| 1 | mint 1000 XRIR | `0x71532c943406b9c24960ee49a89c394066f818fb96b857410abb299813d00844` | totalSupply 0 → 1000 |
| 2 | transfer 400 XRIR | `0x2e2e4a74cb74022978018f9091b345abac07f316baf1f513b7c93af678153c2d` | owner 600 / receiver 400，总量不变 |
| 3 | burn 250 XRIR | `0x8c1b44efbda411e85fd97741ade45d268fd13d2121cdd4346a498271d5740cac` | owner 350，totalSupply → 750 |
| 4 | updateAssetDocument | `0x0a1ea5bacf35c9c96a3006ed13908daeb726e8867c1fe9a6341896cd40781b56` | assetDocument 已更新 |

最终链上状态（`cast` 独立读取）：`totalSupply = 750000000000000000000`，`balanceOf(owner) = 350e18`，`balanceOf(receiver) = 400e18`，满足 `350 + 400 = 750`。
