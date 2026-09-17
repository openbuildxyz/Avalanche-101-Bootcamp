# 截图材料清单 / Screenshot Checklist

本目录用于存放作业要求的截图。请按下表逐项采集，**文件名与 `README.md` 第 7 节的表格一一对应**。

> 当前状态：**合约已部署到 Fuji 且 4 笔业务交易已上链**，因此所有截图都可以直接在浏览器里完成。
> 部署详情见 [`../DEPLOYMENT.md`](../DEPLOYMENT.md) 附录 C/D。

---

## 合约与交易地址（截图直接用）

| 项目 | 地址 |
| --- | --- |
| **合约页** | https://testnet.snowtrace.io/address/0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E |
| 部署交易 | https://testnet.snowtrace.io/tx/0x6d84cc56cff262fc074c876319d73be0ddc52565a6ae77963cdea11b9dfd309b |
| 发行交易（mint） | https://testnet.snowtrace.io/tx/0x71532c943406b9c24960ee49a89c394066f818fb96b857410abb299813d00844 |
| 转账交易（transfer） | https://testnet.snowtrace.io/tx/0x2e2e4a74cb74022978018f9091b345abac07f316baf1f513b7c93af678153c2d |
| 销毁交易（burn） | https://testnet.snowtrace.io/tx/0x8c1b44efbda411e85fd97741ade45d268fd13d2121cdd4346a498271d5740cac |
| 更新资产证明 | https://testnet.snowtrace.io/tx/0x0a1ea5bacf35c9c96a3006ed13908daeb726e8867c1fe9a6341896cd40781b56 |

---

## 采集清单

> **提示**：作业要求的 5 张必交截图**全部可以通过打开上面的链接完成**，不需要额外操作终端。

| # | 文件名 | 打开哪个链接 | 截什么 |
| --- | --- | --- | --- |
| 1 | `01-deploy.jpg` | **部署交易** | 交易详情页（显示 Status: Success、合约创建、From/To） |
| 2 | `02-snowtrace-contract.jpg` | **合约页** | 合约页顶部（显示 Contract / Balance / Transactions，**含 URL 栏**） |
| 3 | `03-mint.jpg` | **发行交易** | mint 交易详情（可展开 Logs 看 `TokensMinted`） |
| 4 | `04-transfer.jpg` | **转账交易** | transfer 交易详情（可展开 Logs 看 `Transfer`） |
| 5 | `05-burn.jpg` | **销毁交易** | burn 交易详情（可展开 Logs 看 `TokensBurned`） |
| 6 | `06-tests.jpg` | — | 在项目目录运行 `forge test`，截图输出（`45 passed; 0 failed`） |
| 7 | `07-asset-document.jpg` | **更新资产证明交易** | 可选加分项 |

**推荐做法**：每个交易页点开 **Logs**（日志）标签再截图 —— 这样能直接看到合约发出的事件，比只看 `Status: Success` 更有说服力。

---

## 附：本次实际执行的命令（复现记录）

> **这些命令已经执行完毕并上链**，此节保留作为复现与审计记录，无需再次运行。
> 实际使用的值：`TOKEN=0xd4ED0cab9926233C3125f6C2b8A2c45126C5128E`、
> `INVESTOR/RECEIVER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8`、
> owner 与签名者为 `0x4589215F79884067593a6E52a9cffe344050fEAd`。

**#1 部署**

```bash
forge script script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $PRIVATE_KEY
```

**#2 浏览器** — 打开 `https://testnet.snowtrace.io/address/$TOKEN`

**#3 发行 1000 XRIR**

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runMint(address,address,uint256)" $TOKEN $INVESTOR 1000000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY
```

**#4 转账 400 XRIR**

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runTransfer(address,address,address,uint256)" $TOKEN $INVESTOR $RECEIVER 400000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
```

**#5 销毁 250 XRIR**

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runBurn(address,address,uint256)" $TOKEN $INVESTOR 250000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
```

**#6 测试**

```bash
forge test
```

**#7 更新资产证明**

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runUpdateDocument(address,string)" $TOKEN "ipfs://bafybei.../asset-report-2026Q1.json" \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $OWNER_KEY
```

**#8 权限拒绝（预期失败）**

```bash
forge script script/TokenActions.s.sol:TokenActions \
  --sig "runMint(address,address,uint256)" $TOKEN $RECEIVER 1000000000000000000000 \
  --rpc-url $FUJI_RPC_URL --broadcast --private-key $INVESTOR_KEY
# 预期输出：Error: script failed: OwnableUnauthorizedAccount(0x...)
```

---

## 截图要求

- **终端截图**必须包含**完整命令**，且合约地址清晰可读 —— 否则无法证明是在本合约上执行的。
- **浏览器截图**必须包含 **URL 栏**（含 `testnet.snowtrace.io`），避免被质疑截图来源。
- 建议在文件名或图内标注日期。
- 截图是作业的**必交材料**，请勿遗漏 #1–#5 这五张核心截图。
