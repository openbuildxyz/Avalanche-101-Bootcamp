# Task 5：Avalanche RWA Token 合约实战

## 学员与项目

- 学员目录：`learn/Hahn-G/task5`
- GitHub 用户名：`Hahn-G`
- 网络：Avalanche Fuji C-Chain（Chain ID `43113`）
- 仓库地址：提交 PR 后补充

## RWA 业务设计

本项目模拟“社区光伏发电收益凭证”。项目 SPV/运营方负责托管光伏设备、核对电表数据并委托审计机构出具月度资产报告；合约 Owner 代表经授权的发行账户。

- `1 HSRT` 对应 **1 kWh 已核验发电量所关联的模拟收益权**。
- `mint` 表示新一批发电量完成核验后，由授权发行方创建对应凭证。
- `transfer` 表示持有人转让该批模拟收益权。
- `burn` 表示收益结算、凭证赎回或因更正而注销。
- `assetDocument` 保存 IPFS/资产报告 URI；真实项目中应指向带审计签名、设备编号、计量周期和报告哈希的不可篡改文件。

本作业仅用于测试网技术学习，不代表真实资产、收益承诺、募资或投资建议。合约本身不能证明线下信息真实，仍需可信托管人、审计、法律协议和合规流程。

## 合约功能

[`HahnSolarRWA.sol`](./src/HahnSolarRWA.sol) 基于 OpenZeppelin `ERC20`、`ERC20Burnable` 和 `Ownable`：

- 名称 `Hahn Solar Revenue Token`，符号 `HSRT`；
- 仅 Owner 可调用 `mint`；
- 持有人可转账或销毁自己的 Token；
- 仅 Owner 可更新资产证明 URI；
- 支持 `balanceOf`、`totalSupply` 等 ERC-20 标准查询；
- 发行、销毁和证明更新均有独立事件；
- 拒绝零地址发行、零数量发行/销毁和空证明文档。

## 测试

首次运行先安装依赖：

```bash
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

```bash
forge test -vv
```

覆盖部署和元数据、授权发行、未授权发行拒绝、转账、销毁、供应量变化、授权更新证明、未授权更新拒绝与错误参数拒绝。

## Fuji 部署与交互

运行：

```bash
forge script script/DeployAndDemo.s.sol:DeployAndDemo \
  --rpc-url "$FUJI_RPC_URL" --broadcast --slow
```

| 项目 | 链上结果 |
| --- | --- |
| 合约地址 | [`0x6300...cb35`](https://testnet.snowtrace.io/address/0x63002f6e871AdB7B30F29628D12bD6DEB599cb35) |
| 部署交易 | [`0x888d...42d5`](https://testnet.snowtrace.io/tx/0x888d191d5a993f7afc1522c61bc30458711f29310bbe393ef965e7fb5d1042d5) |
| Mint 交易 | [`0xc137...f4f7`](https://testnet.snowtrace.io/tx/0xc137784f78203e05434cba4c3399b87aeaa39c017608c756babe4a62853bf4f7) |
| Transfer 交易 | [`0xf2f5...b889`](https://testnet.snowtrace.io/tx/0xf2f5583c681ee8e2bf7fcd5711c7406a1e1c314c20f6700bb930dd3ef53bb889) |
| Burn 交易 | [`0x820c...e25d`](https://testnet.snowtrace.io/tx/0x820c4406923110461bfcf7d3c67f40b623241e4c30805ebf0b7cd55d0f10e25d) |

演示顺序为：部署 → 向发行方铸造 `100,000 HSRT` → 向演示地址 `0x1111...1111` 转账 `1,000 HSRT` → 发行方销毁 `500 HSRT`。链上最终总供应量为 `99,500 HSRT`，发行方余额为 `98,500 HSRT`，演示地址余额为 `1,000 HSRT`。

## 截图

上表的 Fuji 浏览器链接分别对应合约部署、发行、转账和销毁，可逐笔核验事件与状态变化。命令行测试结果为 **8 passed, 0 failed**。
