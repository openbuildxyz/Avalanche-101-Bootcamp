# 1. 学员信息

## GitHub 用户名
gitgdut

## 作业项目的仓库地址
https://github.com/gitgdut/GoldRWA

# 2.项目说明

### RWA 业务场景

本项目模拟一个基于黄金凭证（Gold Certificate）的 RWA（Real World Asset）Token 化场景。

在传统模式下，黄金等现实资产通常由线下机构进行存储和管理，资产所有权证明、交易记录以及流转过程依赖中心化系统。RWA Token 化通过区块链技术，将现实资产权益映射为链上的数字 Token，使资产信息、交易记录和所有权变化能够以透明、可验证的方式记录。


本项目发行的 Gold RWA Token（GRWA）用于模拟黄金资产权益的链上表示。

每一个 GRWA Token 代表一定数量的模拟黄金权益，用户可以通过区块链进行 Token 转账和余额查询。


### 现实资产或资产权益介绍

本项目对应的现实资产为黄金资产权益。

在真实 RWA 应用中，黄金通常由第三方托管机构负责保管，并通过资产证明文件、审计报告或链下登记信息证明黄金的存在和所有权关系。

在本项目中：

- 资产类型：黄金资产权益
- Token 名称：Gold RWA Token
- Token 符号：GRWA
- 资产映射关系：1 GRWA 代表 1 克模拟黄金权益
- 资产证明信息：通过 Asset Document URI 保存在智能合约中，用于记录对应的链下资产证明文件信息。


该项目中的黄金资产和证明信息均为技术演示用途，不代表真实黄金发行、投资产品或金融服务。

在实际 RWA 系统中，资产托管方需要负责现实资产的保管和验证，审计机构或可信数据提供方需要提供资产证明，以保证链上 Token 与链下资产之间的一致性。

# 3.合约信息

- 智能合约代码仓库地址
(https://github.com/gitgdut/GoldRWA)

- 合约部署地址
0x1eb96bf618151adA2F7174CE9b8c41F45486084F

# 4.功能说明

本项目基于 ERC-20 标准实现 Gold RWA Token（GRWA），用于模拟现实黄金资产权益在区块链上的映射。智能合约实现了 Token 管理、权限控制以及资产证明信息维护等功能。


### Token 发行（Mint）

合约支持通过 `mint()` 函数发行新的 GRWA Token。

只有经过授权的管理员账户（Owner）可以执行 Token 发行操作，防止未经授权的账户创建新的 Token。

在实际 RWA 场景中，Token 发行代表经过资产验证后，将对应的现实资产权益映射到区块链上的过程。


### Token 销毁（Burn）

合约支持通过 `burn()` 函数销毁 Token。

Token 持有人可以销毁自己账户中的 GRWA Token，使 Token 总供应量减少。

在实际应用中，Token 销毁可以代表资产权益回收、赎回或资产状态变化等业务操作。


### Token 转账（Transfer）

合约继承 ERC-20 标准，实现 Token 转账功能。

用户之间可以通过 `transfer()` 函数进行 GRWA Token 转移，实现链上资产权益流转。

所有转账记录都会被记录在 Avalanche 区块链上，保证交易过程透明和可追踪。


### 余额查询（Balance Query）

合约支持通过 ERC-20 标准接口 `balanceOf()` 查询任意地址持有的 GRWA Token 数量。

用户可以实时查看自己的资产余额。


### 总供应量查询（Total Supply Query）

合约支持通过 `totalSupply()` 查询当前 GRWA Token 的总发行数量。

当 Token 被发行或销毁时，总供应量会自动更新。


### 发行权限控制（Mint Permission Control）

合约使用 OpenZeppelin `Ownable` 权限管理机制限制 Token 发行权限。

只有合约 Owner 可以调用 `mint()` 函数创建新的 Token。

该机制用于模拟真实 RWA 项目中的资产发行方或托管机构角色，避免任意账户随意增加 Token 供应量。


### 资产证明信息更新（Asset Document Update）

合约保存一个资产证明信息 URI，用于记录模拟的链下资产证明文件，例如 IPFS 文档链接、资产报告或登记信息摘要。

只有 Owner 可以通过 `updateAssetDocument()` 更新资产证明信息。

在真实 RWA 系统中，该信息可以用于关联链上 Token 与链下现实资产之间的证明关系。

#  5.截图材料


## 合约部署成功截图
![alt text](task5(1)Purple.png)
## 测试网区块浏览器中的合约或交易截图
![alt text](task5(2)Purple.png)
## Token 发行截图
![alt text](task5(3)Purple.png)
## Token 转账截图
![alt text](task5(4)Purple.png)
## Token 销毁截图
![alt text](task5(5)Purple.png)