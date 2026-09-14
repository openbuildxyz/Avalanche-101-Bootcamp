# Task 5：Avalanche RWA Token 合约实战

> 本项目仅用于技术学习和业务模拟，不涉及真实资产募集、投资建议或金融产品发行。所有咖啡库存、仓库和提货权益均为虚构。

## 1. 学员与项目

- GitHub 用户名：**BareerahBenjamin**
- [作业项目与完整代码仓库](https://github.com/BareerahBenjamin/Avalanche-101-Bootcamp/tree/task5-rwa-coffee/learn/BareerahBenjamin/task5)
- [Solidity 合约源码](https://github.com/BareerahBenjamin/Avalanche-101-Bootcamp/tree/task5-rwa-coffee/learn/BareerahBenjamin/task5/src/CoffeeWarehouseToken.sol)
- 提交目录：`learn/BareerahBenjamin/task5/`
- 场景：农产品仓单——模拟咖啡豆仓单 Token（FCWR）。

## 2. 业务设计

| 问题 | 本项目的设计 |
| --- | --- |
| Token 对应什么现实资产？ | 单一批次阿拉比卡生咖啡豆的模拟仓单提货权益，批次 `DEMO-COFFEE-FUJI-20260914`。 |
| 谁负责托管与证明？ | 虚构的 Fuji Demo Coffee Warehouse；本作业由学员扮演仓库管理员，并提供模拟 JSON 证明文件，没有真实仓库或第三方审计。 |
| 1 Token 对应多少资产？ | 1 FCWR = 1 千克模拟咖啡豆；`decimals = 3`，最小单位 0.001 FCWR = 1 克。 |
| 发行意味着什么？ | 管理员在模拟验收入库后向持有人发行仓单。一个批次累计最多发行 10,000 FCWR。 |
| 转让意味着什么？ | 持有人将模拟提货权益转给另一地址，不增加或减少库存或 Token 总供应量。 |
| 销毁意味着什么？ | 持有人销毁自己的仓单，产生提货申请记录，减少链上未偿仓单数量。链下交付需要另行核对，销毁本身不证明实物已交付。 |

本项目采用**单批次累计发行上限**：`totalIssued` 只增不减，`totalSupply` 随发行和销毁变化。销毁不恢复该批次的发行额度，新批次应另行建档和部署。上限不代表实际库存已经存在，也不能替代入库证明。

## 3. 合约与测试网

| 项目 | 值 |
| --- | --- |
| Network | Avalanche Fuji C-Chain Testnet |
| Chain ID | **43113**（`0xA869`） |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` |
| Gas Token | 测试 AVAX |
| 合约 | [`0xdCa267f03D04a8fc775f8161cfe52a63dAb4f73E`](https://testnet.snowtrace.io/address/0xdCa267f03D04a8fc775f8161cfe52a63dAb4f73E) |
| 名称 / 符号 | Fuji Coffee Warehouse Receipt / **FCWR** |
| 精度 | 3 |
| 初始供应量 | 0 FCWR |
| 累计发行上限 | 10,000 FCWR = 10,000,000 最小单位 |
| 部署与管理员地址 | `0x10e0E8930bE146edD1214324915646b5ab095f87` |
| 演示接收地址 | `0xE83B1DCF8F9F3765DAbd34555f39240a14f5AcE9`（学员档案中的钱包） |
| Solidity / EVM | 0.8.24 / Paris，优化器开启，200 runs |
| 合约库 | OpenZeppelin Contracts **5.0.2**，固定版本的必要源码随仓库附带 |

[Sourcify 源码验证结果](https://sourcify.dev/server/v2/verify/4097a2c3-2ca6-4dc6-9175-afac89e407a8)：**exact_match**。此外，读取 Fuji 的运行时字节码，与本地编译结果逐字节比对通过。源码验证不等于安全审计。

网络配置依据 [Avalanche 官方文档](https://build.avax.network/docs/rpcs/c-chain)。权限实现参考 [OpenZeppelin Access Control](https://docs.openzeppelin.com/contracts/5.x/access-control)。

## 4. 功能与权限

| 接口 | 权限 | 行为 / 事件 |
| --- | --- | --- |
| `mint(address to, uint256 amount)` | 仅 owner | 发行，检查非零数量和累计上限；`Transfer(0x0, to, amount)` 与 `TokensIssued`。 |
| `burn(uint256 amount)` | 任意持有人，仅销毁自己的余额 | 检查非零数量与余额；`Transfer(holder, 0x0, amount)` 与 `RedemptionRequested`。 |
| `transfer(address to, uint256 amount)` | 持有人 | 标准 ERC-20 转账，产生 `Transfer`。 |
| `approve` / `allowance` / `transferFrom` | 持有人 / 获授权 spender | 标准 ERC-20 授权与代扣转账。 |
| `balanceOf(address)` / `totalSupply()` | 公开只读 | 账户余额 / 当前未销毁供应量。 |
| `totalIssued()` / `MAX_BATCH_ISSUANCE()` | 公开只读 | 累计发行量 / 固定批次上限。 |
| `updateAssetDocument(string)` | 仅 owner | 非空证明摘要写入、版本加一；`AssetDocumentUpdated(version, previousDocument, newDocument)`。 |
| `assetDocument()` / `documentVersion()` | 公开只读 | 当前证明及版本。 |
| `transferOwnership` / `acceptOwnership` | 当前 / 待接任 owner | OpenZeppelin 两步交接，避免直接交错地址；新 owner 接受后才获得发行和证明更新权限。 |

参数 `amount` 均为最小单位，例如 `mint(to, 1000000)` 表示 **1,000 FCWR**，不是一百万个完整 Token。标准 ERC-20 的零数量转账仍被允许；零数量发行与销毁被本项目主动拒绝。

## 5. 资产证明与风险边界

证明文件为 [v1](docs/asset-proof-v1.json) 和 [v2](docs/asset-proof-v2.json)，链上保存原始文件字节的 `sha256:0x<64位十六进制摘要>`。v2 补充了销毁交易与线下提货申请逐笔对账的说明。

| 版本 | 链上摘要 |
| --- | --- |
| v1 | `sha256:0x46e103e060c966fe803f1b020e2b7890fc00990c06cc8fab29e0b8f68effc2f5` |
| v2 | `sha256:0xec0fe5c86b0db70e602d51ecce9215971b3913ca9d9dd49db362b0482190c2df` |

核对方式：`shasum -a 256 docs/asset-proof-v*.json`，将输出加上 `sha256:0x` 前缀与链上值比较。修改空格或换行也会改变摘要；Git 配置固定证明文件为 LF 换行。

在真实 RWA 系统中，这类摘要可用于锚定仓单、审计报告和托管材料的具体版本，配合签署人、批次、盘点记录和交付凭证核验。**哈希只能证明文件是否改变，不能证明文件内容真实，也不能保证链接可用、库存足额或持有人拥有法律权利。**

当前实现的边界：

- 没有真实库存连接、托管系统、预言机、KYC、转让白名单、争议处理或实物交付系统；所有地址均可接收与转让 Token。
- 管理员是信任中心，可以在上限内发行，也可以提交不真实的新证明；链上版本事件仅提供追踪能力。
- `Ownable2Step` 仍继承 `renounceOwnership()`；管理员主动放弃所有权后，发行和证明更新将永久失去管理员入口，持有人仍可转账与销毁。
- 一次 `burn` 仅产生模拟提货申请，不自动送货、不承诺兑付、不支付收益；实际业务还需要身份核验、幂等订单与链下对账。
- 此合约没有可升级代理，未做专业安全审计，不用于真实资产发行。

## 6. Fuji 实际部署与交互记录

所有下列交易均已由 Fuji RPC 重新查询确认 `status = 1`。使用各笔交易所在区块读取历史状态，避免把演示结果写成手工预期值。表中数量均为完整 FCWR。

| 操作 | 区块 | 总供应量 | 部署钱包余额 | 接收钱包余额 | 交易 |
| --- | --- | ---: | ---: | ---: | --- |
| 部署成功 | 58365495 | 0 | 0 | 0 | [0xcef060fa4cf0f7c5fb027d9c01b3f5c279a40d678fa44f5450fa604a3adf6d67](https://testnet.snowtrace.io/tx/0xcef060fa4cf0f7c5fb027d9c01b3f5c279a40d678fa44f5450fa604a3adf6d67) |
| 发行 1,000 | 58365497 | 1000 | 1000 | 0 | [0x7654c7c71e7d84b29d6ade6614ba8af2df7eed69f1942a69070843d69406985d](https://testnet.snowtrace.io/tx/0x7654c7c71e7d84b29d6ade6614ba8af2df7eed69f1942a69070843d69406985d) |
| 转账 200 | 58365499 | 1000 | 800 | 200 | [0x9052c5ca46c13702b7cc933fcdeba7798989e8e604049b927609d2d430cb2800](https://testnet.snowtrace.io/tx/0x9052c5ca46c13702b7cc933fcdeba7798989e8e604049b927609d2d430cb2800) |
| 销毁 50 | 58365502 | 950 | 750 | 200 | [0xc5ce76357b45a5220c700af4fbacc7ce6a0f27beffcc9aa8b6e67dc4b5e1d57b](https://testnet.snowtrace.io/tx/0xc5ce76357b45a5220c700af4fbacc7ce6a0f27beffcc9aa8b6e67dc4b5e1d57b) |
| 更新证明至 v2 | 58365506 | 950 | 750 | 200 | [0xfafa8cb02bd8985e2ffbcdca8bed2bb7fb5352aa50e1b35fa10872de2b3ac163](https://testnet.snowtrace.io/tx/0xfafa8cb02bd8985e2ffbcdca8bed2bb7fb5352aa50e1b35fa10872de2b3ac163) |

完整的交易回执、状态和权限拒绝结果见 [onchain-verification.json](evidence/onchain-verification.json)，原始广播记录见 [broadcast.json](evidence/broadcast.json)。这两个文件仅保存公开链上信息。非授权行为使用只读 `eth_call` 模拟，不发送无意义的失败交易。

## 7. 本地测试与复现

前置条件：安装 Foundry（本次使用 forge 1.7.1）与 Python 3；首次编译可能需要下载 Solidity 0.8.24。OpenZeppelin 必要源码已经附带，不需要运行 `forge install`，也不依赖其他学员项目。

```bash
git clone --branch task5-rwa-coffee https://github.com/BareerahBenjamin/Avalanche-101-Bootcamp.git
cd Avalanche-101-Bootcamp/learn/BareerahBenjamin/task5
forge test --root . -vv
```

**25 项测试全部通过**，其中 1 项 fuzz 测试执行 256 组随机输入。实际日志：[tests.txt](evidence/tests.txt)。

| 测试范围 | 验证内容 |
| --- | --- |
| 部署 / 元信息 | 字节码存在、名称、符号、精度、管理员、初始零供应量、证明与版本正确。 |
| 发行 / 证明权限 | 授权发行及更新成功、事件正确；非授权操作被自定义错误拒绝。 |
| 转账 / 销毁 / 记账 | 余额和总供应量变化正确，不能销毁别人的余额；完整业务流程与随机守恒检查。 |
| 错误操作 | 零数量发行/销毁、零地址 owner/接收方、空证明、余额不足、超发行上限均拒绝。 |
| ERC-20 授权 | approve / transferFrom 正常扣减余额及 allowance，无授权代扣被拒绝。 |
| 额外业务约束 | 销毁不恢复发行额度；失败发行回滚累计发行量；两步交接后旧 owner 丧失权限。 |

重新核对**现有部署**（只读，不需要私钥）：

```bash
forge build --root .
python3 script/verify_onchain.py
```

部署**新的演示实例**（会新建合约并发送五笔 Fuji 交易；已有实例无需重跑）：

```bash
cp .env.example .env
# 仅在本地编辑 .env，填入有测试 AVAX 的 Fuji 专用私钥。
# 不要在聊天、截图或 GitHub 中粘贴私钥。
set -a
source .env
set +a
forge script --root . script/DeployAndDemo.s.sol:DeployAndDemo \
  --rpc-url "$FUJI_RPC_URL" --broadcast --slow -vv
unset PRIVATE_KEY
```

脚本强制 `block.chainid == 43113`，按顺序部署 → 发行 → 转账 → 销毁 → 更新证明，并检查最终余额。`verify_onchain.py` 固定核对本 README 的已提交部署；若重新部署，需要同步替换脚本的地址和 `evidence/broadcast.json`。

## 8. 截图材料（待补）

链上部署、发行、转账、销毁及源码验证均已完成；**作业要求的五张截图尚未完成，目前不能视为材料齐全**。内置浏览器连接持续超时，使用独立 Safari 作业窗口的许可尚待确认。

[截图清单与对应交易页面](evidence/SCREENSHOTS.md) 已准备好。不会使用伪造页面或示意图片充当实际交易截图。

## 9. 文件索引

- `src/CoffeeWarehouseToken.sol`：ERC-20 仓单合约。
- `test/CoffeeWarehouseToken.t.sol`：25 项测试，含 fuzz。
- `script/DeployAndDemo.s.sol`：Fuji 部署与交互脚本。
- `script/verify_onchain.py`：只读复查回执、历史余额、权限和源码字节码。
- `docs/`：两版模拟资产证明。
- `evidence/`：真实截图、测试日志、公开交易记录与源码验证结果。
- `vendor/openzeppelin/`：官方 5.0.2 必要源码与 MIT 许可证。

仅增加本人的 `task5/` 目录，不修改其他学员目录与公共任务说明。
