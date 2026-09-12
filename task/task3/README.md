# Task 3 — DEX-priced AvalancheBootcampToken

Foundry project for Avalanche 101 Bootcamp Task 3. Source lives in this folder (not the repo root).

## Dependencies (cloned into `lib/`)

```bash
git clone --depth 1 --branch v5.4.0 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
git clone --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std.git lib/forge-std
```

## Test

```bash
forge test
```

## Deploy + add Pangolin liquidity + buy on Fuji

```bash
export PRIVATE_KEY=0x...
forge script script/DeployAndSetup.s.sol --rpc-url https://api.avax-test.network/ext/bc/C/rpc --broadcast --slow --legacy --with-gas-price 250000000
```

Homework write-up: `learn/alanyoungcy/task3.md` and `REPORT.md`.
