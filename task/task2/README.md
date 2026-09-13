# Task 2 DApp: Scaffold-ETH 2 + ERC-20 on Avalanche Fuji

Scaffold-ETH 2 project for Avalanche 101 Bootcamp Task 2.

## Token

- Name: Avalanche Bootcamp Token (`ABT`)
- Contract: `packages/hardhat/contracts/AvalancheBootcampToken.sol`
- Network: Avalanche Fuji (`chainId` 43113)

## Setup

```bash
cd task/task2/scaffold-eth-2
yarn install
```

A deployer key is already in `packages/hardhat/.env` (gitignored). Address:

`0x5C770164fEf4912d69aBCc93260529914E08B1a9`

Fuji contract: [`0xB6C4E2D8abC4646C968699566F5cF189EEE464C1`](https://testnet.snowtrace.io/address/0xB6C4E2D8abC4646C968699566F5cF189EEE464C1)

## Commands

```bash
yarn test
yarn deploy --network fuji
yarn start
```

The Next.js app targets Fuji in `packages/nextjs/scaffold.config.ts`. Use the Debug Contracts tab to mint, transfer, and burn.
