# mini-dex / contracts

mini-dex 的链上部分（Foundry 项目）。只有两个合约：

| 文件 | 作用 |
|---|---|
| `src/MockERC20.sol` | 测试代币：小数位可配置 + 公开 `mint(address,uint256)` 水龙头。部署脚本会造 `USDC`(6 位) 和 `WAVAX`(18 位) |
| `src/Vault.sol` | 资金托管：`deposit` 锁币 → 链下撮合 → 后端用 EIP-712 签 `Withdraw` 授权 → 用户 `withdraw` 取币 |

接口以课程设计文档 §3.3 为准（`docs/2026-08-22-course-design.md`），server / web 都按它写。

## 合约接口速查

```solidity
// Vault
address public signer;                                            // 后端签名地址
mapping(address => bool) public allowedTokens;
mapping(address => mapping(address => uint256)) public balances;  // user => token => 链上记账（仅展示）
mapping(uint256 => bool) public usedNonces;

event Deposit(address indexed user, address indexed token, uint256 amount);
event Withdraw(address indexed user, address indexed token, uint256 amount, uint256 nonce);

function setSigner(address s) external;                              // onlyOwner
function setAllowedToken(address token, bool allowed) external;      // onlyOwner
function deposit(address token, uint256 amount) external;            // 先 approve
function withdraw(address token, uint256 amount, uint256 nonce, uint256 deadline, bytes calldata signature) external;
function hashWithdraw(address user, address token, uint256 amount, uint256 nonce, uint256 deadline) external view returns (bytes32);
```

EIP-712：

```
domain : { name: "MiniDexVault", version: "1", chainId, verifyingContract: <Vault> }
types  : { Withdraw: [user:address, token:address, amount:uint256, nonce:uint256, deadline:uint256] }
```

`withdraw` 的 `user` 直接取 `msg.sender`，后端签名时 `user` 必须填用户地址。
`hashWithdraw` 是个方便调试的 view：后端用 viem `hashTypedData` 算出来的 digest 应该和它完全一致。

> **安全说明（课上要讲）**：提现金额不受链上 `balances` 限制（成交发生在链下，链上记账只是参考，
> 余额不够直接归零而不是 revert）。所以 **signer 私钥 = 金库钥匙**，生产上要 HSM / 多签 + 限额。

## 环境

- Foundry ≥ 1.5（`forge` / `anvil` / `cast`）：https://getfoundry.sh
- 首次运行时安装 Foundry 依赖：

```bash
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```
- 编译器固定 solc 0.8.30，EVM `cancun`（见 `foundry.toml`）。

## 编译 & 测试

```bash
cd mini-dex/contracts
forge build
forge test -vvv
```

## 本地 anvil 模式（课前排练 / 默认）

终端 1：

```bash
anvil
```

终端 2（用 anvil 账户 #0 部署，账户 #1 做后端 signer）：

```bash
cd mini-dex/contracts
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
SIGNER_ADDRESS=0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
```

脚本最后会打印一段可以直接粘贴到 `server/.env` 和 `web/.env` 的内容：

```
CHAIN_ID=31337
VAULT_ADDRESS=0x...
USDC_ADDRESS=0x...
WAVAX_ADDRESS=0x...
SIGNER_ADDRESS=0x7099...
```

然后 MetaMask 添加网络：RPC `http://127.0.0.1:8545`，chainId `31337`，货币 `ETH`。
把 anvil 账户 #0 的私钥导入 MetaMask 就能拿到 1,000,000 USDC / 10,000 WAVAX；
其他账户可以直接调 `MockERC20.mint` 自取。

### anvil 默认账户（每次启动都一样，助记词 `test test ... junk`）

| # | 地址 | 私钥 | 课上用途 |
|---|---|---|---|
| 0 | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80` | 部署者 / 演示用户 |
| 1 | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | 后端 signer（`server/.env` 的 `SIGNER_PRIVATE_KEY`） |
| 2 | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a` | 第二个演示用户（对手盘） |

> 这些私钥全世界都知道，**只能用在本地 anvil**，绝对不要往里面转真钱。

## Avalanche Fuji 模式

1. 准备一个测试钱包，去水龙头领 AVAX：https://core.app/tools/testnet-faucet/
2. 用自己的私钥部署（signer 地址换成后端真正用的那把钥匙的地址）：

```bash
PRIVATE_KEY=0x<你的私钥> \
SIGNER_ADDRESS=0x<后端签名地址> \
forge script script/Deploy.s.sol \
  --rpc-url https://api.avax-test.network/ext/bc/C/rpc \
  --broadcast
```

（`foundry.toml` 里配了别名，也可以写 `--rpc-url fuji`。）

3. 在浏览器里看合约：https://testnet.snowtrace.io
4. 同样把打印出来的地址写进 `server/.env` / `web/.env`，`CHAIN_ID=43113`。

## ABI

`forge build` 之后，`abi/Vault.json` 和 `abi/MockERC20.json` 是从 `out/` 里抽出来的纯 ABI 数组，
server / web 直接 import 即可。合约改了接口后重新生成：

```bash
forge build
jq '.abi' out/Vault.sol/Vault.json         > abi/Vault.json
jq '.abi' out/MockERC20.sol/MockERC20.json > abi/MockERC20.json
```

## 目录

```
contracts/
  src/MockERC20.sol      测试代币
  src/Vault.sol          托管合约
  test/Vault.t.sol       Foundry 测试
  script/Deploy.s.sol    部署脚本
  abi/                   给 server / web 用的 ABI
  lib/                   依赖（OpenZeppelin、forge-std）
  foundry.toml / remappings.txt / .env.example
```
