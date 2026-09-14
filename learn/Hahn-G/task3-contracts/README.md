# Task 3 contracts — HAHN/Pangolin Fuji

This Foundry project implements the first three Task 3 requirements:

1. use Pangolin V2 on Avalanche Fuji;
2. create the HAHN/WAVAX pair and seed it with liquidity;
3. read the price from Pair reserves and Router swap quotes.

## Fixed Fuji addresses

| Contract | Address |
| --- | --- |
| HAHN | `0xef55c8d97a7e35ffabbd141bd5f8302b98175095` |
| Pangolin V2 Factory | `0xE4A575550C2b460d2307b82dCd7aFe84AD1484dd` |
| Pangolin V2 Router | `0x2D99ABD9008Dc933ff5c0CD271B88309593aB921` |
| WAVAX | `0xd00ae08403B9bbb9124bB305C09058E32C39A48c` |

The Router is used as the source of truth for Factory and WAVAX inside the Solidity code.

## Prerequisites

- Foundry (`forge`)
- The Task 2 deployer private key
- At least `10,000 HAHN`, `0.1 AVAX`, and a small additional AVAX balance for gas

Install the script/test dependency once:

```bash
forge install foundry-rs/forge-std --no-commit
```

## Create the pair and add liquidity

Copy `.env.example` to `.env`, fill `PRIVATE_KEY`, then load the variables into the shell. Never commit `.env`.

```bash
forge script script/SetupHahnLiquidity.s.sol:SetupHahnLiquidity \
  --rpc-url "$FUJI_RPC_URL" \
  --broadcast \
  --slow
```

PowerShell:

```powershell
$env:PRIVATE_KEY = "0xYOUR_TEST_WALLET_PRIVATE_KEY"
$env:FUJI_RPC_URL = "https://api.avax-test.network/ext/bc/C/rpc"
forge script script/SetupHahnLiquidity.s.sol:SetupHahnLiquidity `
  --rpc-url $env:FUJI_RPC_URL `
  --broadcast `
  --slow
```

The script adds `10,000 HAHN + 0.1 AVAX`. It uses 1% minimum-amount protection and refuses to run on a chain other than Fuji.

Save the printed Pair address and the broadcast transaction hash. Verify them on [Snowtrace Fuji](https://testnet.snowtrace.io/).

## Read Pair and Router prices

After liquidity exists:

```bash
forge script script/ReadHahnDexPrice.s.sol:ReadHahnDexPrice \
  --rpc-url "$FUJI_RPC_URL"
```

This is read-only and does not require `--broadcast` or a private key. Values are printed in raw 18-decimal units so the screenshots are directly reproducible.

With the untouched initial reserves, the two sample quotes should be approximately `906.610893880149131581 HAHN` for `0.01 AVAX`, and `0.000987158034397061 AVAX` for `100 HAHN`.

## Test

```bash
forge test -vv
```

