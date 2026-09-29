# Avalanche Lab

Task2/3/5/7 共用的合约、页面及测试项目。作业提交见 [上级目录](../../README.md)。

## 常用命令

需要 Node.js 22+、Python 3 和 Foundry。在本目录执行：

```bash
npm ci
npm run compile
npm test
forge test -vv
npm start
```

页面：<http://127.0.0.1:4173>。导入 [Fuji 部署配置](../../public/evidence/fuji/wallet-import.json) 后即可读取或操作已部署的合约。

- `npm run deploy:fuji`：读取本地 `.env.local` 中的 `AVALANCHE_WALLET_KEY`，只允许 Fuji 43113；根据已保存回执续跑，不重复发送已完成步骤。第二测试钱包保存在被忽略的 `.env.test-wallet`。不要删除这些密钥或已确认回执来重跑同一部署。
- `npm run demo`：临时 Anvil 上运行完整交互，结果写入 `../../public/evidence/local-demo.json`。
- `npm run test:browser`：本地 Chrome + Anvil 页面测试，截图写入 `../../public/evidence/local-browser/`。
- `node scripts/fuji-screenshots.mjs`：只查询 Fuji 和验证登录签名，生成实际链上回执截图；禁止发送新交易。

Solidity 0.8.24 / OpenZeppelin 5.0.2 / Paris EVM。Foundry 通过 `scripts/solc-wrapper.py` 使用本项目的 solc。静态服务器仅暴露页面、ABI 和指定公共回执，不暴露环境文件。

## Scaffold-ETH

首次运行 `node task2/setup-scaffold.mjs` 下载固定官方模板；已有目录无需重复初始化。在 `scaffold-eth-2` 执行 `yarn install`、`yarn compile`。

运行 `node scripts/sync-scaffold-fuji.mjs` 可同步已确认的 Fuji 地址和 ABI，再进入 `scaffold-eth-2` 执行 `yarn start`。Node 25 下使用 `NODE_OPTIONS=--no-experimental-webstorage yarn start`；此旧模板优先使用 Node 22。上游钱包组件在 Node 25 下可能输出 indexedDB 警告，本次 Fuji 合约读取已单独验证。

独立进行 Scaffold-ETH 部署时，可在其目录使用 `yarn account:import` 和 `yarn deploy --network avalancheFuji --tags BootcampToken`，导入本机测试密钥即可。`node scripts/scaffold-test.mjs` 仅测试本地链，会重建 localhost 部署记录及前端 ABI；之后运行 sync 脚本恢复 Fuji 配置。

## 源码

- `contracts/`：ERC-20、AMM、MiniExchange 和测试代币。
- `task5/contracts/`：咖啡仓单合约；`test/`：43 个合约测试。
- `task7/`：撮合引擎、15 个测试、安全自查。
- `task2/`：Scaffold-ETH 模板覆盖文件；`web/`：钱包页面及回执核验界面。

RWA 为模拟权益，mUSD 为自行发行的测试币。Task7 是独立现货实现，课程仓库仍待提供。私钥、node_modules、构建缓存和生成的完整 Scaffold-ETH 模板均不提交。
