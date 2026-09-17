<#
.SYNOPSIS
  一键把 XRIR (星海广场租金收益权 Token) 部署到 Avalanche Fuji 测试网,
  并依次执行 mint / transfer / burn / updateAssetDocument 演示, 最后打印可直接回填文档的摘要。

.DESCRIPTION
  本脚本封装了 DEPLOYMENT.md 第 8-9 节的全部命令, 用于:
    1. 校验 .env 与账户余额 (余额为 0 时给出水龙头指引并退出)
    2. 部署合约并解析出合约地址、交易 hash、区块号
    3. 以 owner 身份发行 -> 转账 -> 销毁 -> 更新资产证明
    4. 打印部署结果摘要; 加 -UpdateDocs 可自动回填 README.md 与 DEPLOYMENT.md 中的占位符

.PARAMETER UpdateDocs
  自动把 README.md / DEPLOYMENT.md 中的 <CONTRACT_ADDRESS>、<DEPLOY_TX_HASH>、
  <DEPLOY_TX_URL>、<CONTRACT_URL>、<DEPLOYER_ADDRESS>、<OWNER_ADDRESS>、
  <BLOCK_NUMBER>、<GAS_USED> 占位符替换为真实值。默认不修改任何文件。

.PARAMETER Receiver
  演示转账时的接收地址, 默认 0x000000000000000000000000000000000000dEaD。

.EXAMPLE
  .\deploy-fuji.ps1
  .\deploy-fuji.ps1 -UpdateDocs

.NOTES
  前置: 已把测试网私钥写入 .env 的 PRIVATE_KEY, 且该地址已从
  https://faucet.avax.network/ (选择 Fuji C-Chain) 领到测试 AVAX。
#>
[CmdletBinding()]
param(
    [switch]$UpdateDocs,
    [string]$RpcUrl = "https://api.avax-test.network/ext/bc/C/rpc",
    [string]$Receiver = "0x000000000000000000000000000000000000dEaD",
    [string]$EnvFile = ".env"
)

$ErrorActionPreference = "Stop"
if ($PSScriptRoot) { Set-Location -LiteralPath $PSScriptRoot }

$MINT_AMOUNT     = "1000000000000000000000"   # 1000 XRIR
$TRANSFER_AMOUNT = "400000000000000000000"    # 400 XRIR
$BURN_AMOUNT     = "250000000000000000000"    # 250 XRIR
$NEW_DOC         = "ipfs://bafybeih2x9k4m2v7q3s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3l/asset-report-2026Q1.json"

function Write-Step([string]$text) {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "  $text" -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
}

function Invoke-Forge([string[]]$ForgeArgs) {
    $out = & forge @ForgeArgs 2>&1 | Out-String
    if ($out -match "Compiler run failed") { throw "编译失败:`n$out" }
    return $out
}

# ---------------------------------------------------------------- 1. 前置校验
Write-Step "1/9  前置校验"

if (-not (Test-Path $EnvFile)) { throw "缺少 $EnvFile, 请先复制 .env.example 并填入 PRIVATE_KEY" }

$envLines = Get-Content $EnvFile
$pkLine = $envLines | Where-Object { $_ -match '^\s*PRIVATE_KEY\s*=' } | Select-Object -First 1
if (-not $pkLine) { throw "$EnvFile 中没有 PRIVATE_KEY" }
$pk = ($pkLine -split '=', 2)[1].Trim()
if ([string]::IsNullOrWhiteSpace($pk)) { throw "$EnvFile 中的 PRIVATE_KEY 为空" }
if ($pk -notmatch '^0x[0-9a-fA-F]{64}$') { throw "PRIVATE_KEY 格式不正确 (应为 0x + 64 位十六进制)" }

$env:PRIVATE_KEY = $pk
$env:FUJI_RPC_URL = $RpcUrl
$deployer = (& cast wallet address --private-key $pk 2>&1 | Out-String).Trim()
Write-Host "Deployer : $deployer"

$chainId = (& cast chain-id --rpc-url $RpcUrl 2>&1 | Out-String).Trim()
Write-Host "Chain ID : $chainId"
if ($chainId -ne "43113") { throw "Chain ID 不是 43113 (Fuji), 实际为 $chainId —— 请勿在主网执行本脚本" }

$balRaw = (& cast balance $deployer --rpc-url $RpcUrl 2>&1 | Out-String).Trim()
if ($balRaw -notmatch '^\d+$') { throw "无法查询余额: $balRaw" }
$balAvax = [double]$balRaw / 1e18
Write-Host ("Balance  : {0} wei  ({1:N6} AVAX)" -f $balRaw, $balAvax)
if ([double]$balRaw -le 0) {
    Write-Host ""
    Write-Host "余额为 0, 无法部署。请先领取测试 AVAX:" -ForegroundColor Yellow
    Write-Host "  1. 打开 https://faucet.avax.network/" -ForegroundColor Yellow
    Write-Host "  2. 选择 Fuji (C-Chain)" -ForegroundColor Yellow
    Write-Host "  3. 粘贴地址: $deployer" -ForegroundColor Yellow
    Write-Host "  4. 领取后重新运行本脚本" -ForegroundColor Yellow
    exit 1
}

# ---------------------------------------------------------------- 2. 编译 + 测试
Write-Step "2/9  编译与测试"
Invoke-Forge @("build") | Out-Null
Write-Host "编译成功" -ForegroundColor Green
$testOut = Invoke-Forge @("test")
if ($testOut -notmatch "(\d+) tests passed, (\d+) failed") { throw "测试输出无法解析" }
$passed = $Matches[1]; $failed = $Matches[2]
Write-Host "测试: $passed passed, $failed failed" -ForegroundColor Green
if ([int]$failed -gt 0) { throw "存在失败测试, 终止部署" }

# ---------------------------------------------------------------- 3. 部署
Write-Step "3/9  部署到 Fuji"
$deployOut = Invoke-Forge @(
    "script", "script/DeployRentalIncomeRightToken.s.sol:DeployRentalIncomeRightToken",
    "--rpc-url", $RpcUrl, "--broadcast", "--private-key", $pk
)
if ($deployOut -notmatch "ONCHAIN EXECUTION COMPLETE & SUCCESSFUL") {
    Write-Host $deployOut
    throw "部署未成功"
}
$m = [regex]::Match($deployOut, "deployed at:\s*(0x[0-9a-fA-F]{40})")
if (-not $m.Success) { throw "无法从输出中解析合约地址`n$deployOut" }
$contract = $m.Groups[1].Value
Write-Host "合约地址: $contract" -ForegroundColor Green

# ---------------------------------------------------------------- 4. 解析 tx / 区块
Write-Step "4/9  解析部署交易信息"
$latest = Get-ChildItem "broadcast\DeployRentalIncomeRightToken.s.sol\43113" -Filter "run-latest.json" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $latest) { throw "找不到 broadcast 记录, 无法解析 tx hash" }
$json = Get-Content $latest.FullName -Raw
$txHash = [regex]::Match($json, '"transactionHash"\s*:\s*"(0x[0-9a-fA-F]{64})"').Groups[1].Value
if (-not $txHash) { throw "无法解析 transactionHash" }
$receipt = & cast receipt $txHash --rpc-url $RpcUrl --json 2>&1 | Out-String
$blockNumber = [regex]::Match($receipt, '"blockNumber"\s*:\s*"?(0x[0-9a-fA-F]+|\d+)"?').Groups[1].Value
$gasUsed = [regex]::Match($receipt, '"gasUsed"\s*:\s*"?(0x[0-9a-fA-F]+|\d+)"?').Groups[1].Value
Write-Host "tx hash : $txHash"
Write-Host "block   : $blockNumber"
Write-Host "gasUsed : $gasUsed"

$txUrl      = "https://testnet.snowtrace.io/tx/$txHash"
$addrUrl    = "https://testnet.snowtrace.io/address/$contract"
Write-Host "tx 链接 : $txUrl"
Write-Host "合约链接: $addrUrl"

# ---------------------------------------------------------------- 5-8. 业务动作
Write-Step "5/9  发行 1000 XRIR (mint, 仅 owner)"
$mintOut = Invoke-Forge @(
    "script", "script/TokenActions.s.sol:TokenActions",
    "--sig", "runMint(address,address,uint256)", $contract, $deployer, $MINT_AMOUNT,
    "--rpc-url", $RpcUrl, "--broadcast", "--private-key", $pk
)
$mintOut.Trim() | Write-Host

Write-Step "6/9  转账 400 XRIR (transfer)"
$txOut = Invoke-Forge @(
    "script", "script/TokenActions.s.sol:TokenActions",
    "--sig", "runTransfer(address,address,address,uint256)", $contract, $deployer, $Receiver, $TRANSFER_AMOUNT,
    "--rpc-url", $RpcUrl, "--broadcast", "--private-key", $pk
)
$txOut.Trim() | Write-Host

Write-Step "7/9  销毁 250 XRIR (burn)"
$burnOut = Invoke-Forge @(
    "script", "script/TokenActions.s.sol:TokenActions",
    "--sig", "runBurn(address,address,uint256)", $contract, $deployer, $BURN_AMOUNT,
    "--rpc-url", $RpcUrl, "--broadcast", "--private-key", $pk
)
$burnOut.Trim() | Write-Host

Write-Step "8/9  更新资产证明 (updateAssetDocument, 仅 owner)"
$docOut = Invoke-Forge @(
    "script", "script/TokenActions.s.sol:TokenActions",
    "--sig", "runUpdateDocument(address,string)", $contract, $NEW_DOC,
    "--rpc-url", $RpcUrl, "--broadcast", "--private-key", $pk
)
$docOut.Trim() | Write-Host

# ---------------------------------------------------------------- 9. 汇总
Write-Step "9/9  最终状态"
$readOut = Invoke-Forge @(
    "script", "script/TokenActions.s.sol:TokenActions",
    "--sig", "runRead(address)", $contract, "--rpc-url", $RpcUrl
)
$readOut.Trim() | Write-Host

$summary = @"

================== 回填材料 (复制到 README / DEPLOYMENT) ==================
| 项目 | 值 |
| --- | --- |
| 测试网 | Avalanche Fuji Testnet (Chain ID 43113) |
| 合约地址 | $contract |
| 部署交易 Hash | $txHash |
| 部署交易链接 | $txUrl |
| 浏览器合约链接 | $addrUrl |
| 部署者 / owner | $deployer |
| 部署区块号 | $blockNumber |
| 实际消耗 gas | $gasUsed |
==========================================================================
"@
Write-Host $summary -ForegroundColor Green

if ($UpdateDocs) {
    Write-Host "正在回填 README.md 与 DEPLOYMENT.md ..."
    foreach ($f in @("README.md", "DEPLOYMENT.md")) {
        if (-not (Test-Path $f)) { continue }
        $c = Get-Content $f -Raw
        $c = $c -replace '<CONTRACT_ADDRESS>', $contract
        $c = $c -replace '<DEPLOY_TX_HASH>', $txHash
        $c = $c -replace '<DEPLOY_TX_URL>', $txUrl
        $c = $c -replace '<CONTRACT_URL>', $addrUrl
        $c = $c -replace '<DEPLOYER_ADDRESS>', $deployer
        $c = $c -replace '<OWNER_ADDRESS>', $deployer
        $c = $c -replace '<BLOCK_NUMBER>', $blockNumber
        $c = $c -replace '<GAS_USED>', $gasUsed
        Set-Content -Path $f -Value $c -NoNewline
        Write-Host "  已更新 $f" -ForegroundColor Green
    }
    Write-Host "提醒: README 中仍有 <GITHUB_USERNAME> 与 <REPO_URL> 需你手动替换。" -ForegroundColor Yellow
} else {
    Write-Host "提示: 加 -UpdateDocs 参数可自动把上面的值回填进文档。" -ForegroundColor Yellow
}
