# Task 5 — Fuji Carbon Credit (FCC)

## 学员与源码

- GitHub：`tz-hao`
- 作业源码：[`learn/tz-hao/task5`](https://github.com/tz-hao/Avalanche-101-Bootcamp/tree/task5-tz-hao/learn/tz-hao/task5)
- 网络：Avalanche Fuji C-Chain，Chain ID `43113`

## RWA 业务场景

FCC 是技术学习用途的模拟碳信用 Token：`1 FCC` 模拟代表 `1 kg` 已核证的 CO2e 减排量。

- **现实资产/权益**：项目减排量所对应的碳信用凭证。
- **资产托管与证明**：在真实项目中，应由独立的碳核证机构、登记机构和托管方共同负责。该作业仅保存模拟资产证明 URI，不连接真实的线下登记系统。
- **发行**：具备 `ISSUER_ROLE` 的机构根据经核验的减排量发行 FCC。
- **转让**：模拟碳信用在账户间交割。
- **销毁**：模拟持有人注销碳信用并减少流通供应量。

> 本作业仅用于 Solidity 与 Avalanche Fuji 技术学习，不募集资金、不构成真实资产所有权、投资建议或金融产品。

## 合约信息

- 合约地址：[`0x8E682FE2C825B6978147fe18a575Bc5C7f416eF3`](https://build.avax.network/explorer/fuji/c-chain/address/0x8E682FE2C825B6978147fe18a575Bc5C7f416eF3)
- Token：`Fuji Carbon Credit` (`FCC`)，18 decimals
- 初始资产证明：`ipfs://bafybeigdyrzt-simulated-carbon-report-v1`
- [Solidity 合约源码](./contracts/FujiCarbonCredit.sol)
- [Hardhat 测试](./test/FujiCarbonCredit.ts)

合约使用 OpenZeppelin 的 `ERC20`、`ERC20Burnable` 与 `AccessControl`：

- `mint(address,uint256)` 仅 `ISSUER_ROLE` 可调用，并发出 `CarbonCreditsIssued` 事件。
- `burn(uint256)` 由持有人主动销毁 Token。
- ERC-20 标准 `transfer`、`balanceOf`、`totalSupply` 可用。
- `updateAssetDocument(string)` 仅 `ASSET_MANAGER_ROLE` 可调用，并发出 `AssetDocumentUpdated` 事件。
- `assetDocument()` 读取当前模拟资产证明 URI。

## Fuji 链上操作与验证

| 操作 | 结果 | 交易 |
| --- | --- | --- |
| 发行 2,000 FCC | 成功，`CarbonCreditsIssued` 与 ERC-20 `Transfer(0x0 → 发行账户)` 已记录 | [查看交易](https://build.avax.network/explorer/fuji/c-chain/tx/0x2a92dda8d5498bee3f339e4596c951a811e35a82903029dd10108c3109b51c10) |
| 转账 100 FCC | 成功，ERC-20 `Transfer` 已记录 | [查看交易](https://build.avax.network/explorer/fuji/c-chain/tx/0x60c1a0a69f83133736845db18f31eeaf05d3081254fd04d7044d2629403f4d5a) |
| 销毁 50 FCC | 成功，ERC-20 `Transfer(持有人 → 0x0)` 已记录 | [查看交易](https://build.avax.network/explorer/fuji/c-chain/tx/0xfd619bbb196b6a7c8ade9caba0bc5372dfbee836274bf6834d52b2c90dad93f3) |

通过 Fuji 公共 RPC 对交易收据和合约公开状态进行独立读取，最终状态：

- 总供应量：`1,950 FCC`
- 发行账户余额：`1,850 FCC`
- 测试接收地址余额：`100 FCC`

## 本地测试

```text
9 passing
```

其中 FCC 测试覆盖部署与元数据、授权发行、非授权发行拒绝、转账、持有人销毁、总供应量变化，以及非资产管理员修改证明信息被拒绝。
