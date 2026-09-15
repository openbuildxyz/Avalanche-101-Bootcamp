# Task 3 contract

Foundry project for the `AvalancheBuilderTokenV2` LFJ-priced token sale on Avalanche Fuji.

## Test

```bash
git clone --depth 1 --branch v5.0.2 https://github.com/OpenZeppelin/openzeppelin-contracts.git lib/openzeppelin-contracts
git clone --depth 1 --branch v1.9.7 https://github.com/foundry-rs/forge-std.git lib/forge-std
forge test
```

## Deploy

```bash
export PRIVATE_KEY=0x...
forge script script/DeployAndSetup.s.sol --rpc-url fuji --broadcast --slow --legacy
```

The deployment script creates an `ABTv2/WAVAX` LFJ V1 pair, adds liquidity, funds the sale inventory, reads a live quote, and completes a demo purchase.
