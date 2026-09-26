# Task 3 contracts — HAHN/Pangolin Fuji

This Foundry project implements all Task 3 requirements:

1. use Pangolin V2 on Avalanche Fuji;
2. create the HAHN/WAVAX pair and seed it with liquidity;
3. read the price from Pair reserves and Router swap quotes;
4. deploy a sale contract that uses the live quote in its purchase logic;
5. execute a real Fuji purchase whose HAHN output is determined by Pangolin.

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

Expected result: `9 passed, 0 failed`.

## Fuji deployment

| Item | Address / transaction |
| --- | --- |
| HAHN/WAVAX Pair | `0x52F6D763f93F762406BD7D74538E9fd1F62B5930` |
| Add liquidity tx | `0x37286e52d409c1b467793aac27d304abd83467dbe38c77c29d22a6e155007315` |
| Price reader | `0x6eC9d8e9EAfc90D677096B94B9886992E58FD975` |
| DEX-priced sale | `0xE948ac99e17f625D338F0082a21c53BcD643A250` |
| Live-price purchase tx | `0xdbe85f33e36178c71f875f9e58a424ea9dbfd3e2b5cf1ea068912c183bd12ff4` |

