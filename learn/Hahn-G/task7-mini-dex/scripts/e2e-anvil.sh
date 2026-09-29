#!/usr/bin/env bash
# 一键联调：anvil → 部署合约 → server（链上模式）→ e2e 脚本。跑完自动清理。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PK0=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80   # anvil #0 部署者
SIGNER=0x70997970C51812dc3A010C7d01b50e0d17dc79C8                         # anvil #1 = server 的 BACKEND_SIGNER
cleanup() { pkill -f "tsx src/index.ts" 2>/dev/null || true; pkill -x anvil 2>/dev/null || true; }
trap cleanup EXIT

anvil --silent & sleep 2
cd "$ROOT/contracts"
OUT=$(PRIVATE_KEY=$PK0 SIGNER_ADDRESS=$SIGNER forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast 2>&1)
VAULT=$(echo "$OUT" | grep -o 'VAULT_ADDRESS=0x[0-9a-fA-F]*' | cut -d= -f2)
USDC=$(echo "$OUT" | grep -o 'USDC_ADDRESS=0x[0-9a-fA-F]*' | cut -d= -f2)
WAVAX=$(echo "$OUT" | grep -o 'WAVAX_ADDRESS=0x[0-9a-fA-F]*' | cut -d= -f2)
echo "deployed: VAULT=$VAULT USDC=$USDC WAVAX=$WAVAX"
rm -rf broadcast cache

cd "$ROOT/server"
export PORT=8787 JWT_SECRET=e2e CHAIN_ID=31337 RPC_URL=http://127.0.0.1:8545 VAULT_ADDRESS=$VAULT USDC_ADDRESS=$USDC WAVAX_ADDRESS=$WAVAX \
       BACKEND_SIGNER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
npx tsx src/index.ts > /tmp/minidex-e2e-server.log 2>&1 &
for i in $(seq 1 20); do sleep 0.5; curl -sf http://localhost:8787/config >/dev/null && break; done
npx tsx scripts/e2e-anvil.ts
