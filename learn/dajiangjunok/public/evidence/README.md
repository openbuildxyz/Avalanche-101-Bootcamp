# 验证材料

## Fuji 真实部署与交互

- [完整地址和交易回执](fuji/deployment.json)：Avalanche Fuji，Chain ID 43113，全部交易 status=1。
- [页面导入配置](fuji/wallet-import.json)：在项目首页导入即可读取部署结果。
- [回执截图与区块状态](fuji/screenshots.json)：通过实时 RPC 核验，图片位于同目录。
- [Scaffold-ETH Fuji 验证](fuji/scaffold-result.json)：Debug Contracts 读取实际 DJJ 合约。

根目录 `task2.md / task3.md / task5.md / task7.md` 直接引用相应 Fuji 图片与浏览器链接。

## 本地测试

- [npm-test.txt](npm-test.txt)：15 项撮合测试通过。
- [forge-test.txt](forge-test.txt)：43 项 Solidity 测试通过，含两组各 256 次 fuzz。
- [Scaffold-ETH 编译](scaffold-compile.txt)、[模板原有测试](scaffold-tests.txt)：16 个文件编译成功、2 个原有测试通过。
- [本地脚本演示](local-demo.json)、[浏览器演示](local-browser/result.json)、[Scaffold-ETH 演示](scaffold-local/result.json)：均为 31337 本地网络，仅用于开发复现，与 Fuji 记录分开保存。

Kite 账号与资金释放记录仍未提供；提交字段见 [submission.json](../submission.json)。
