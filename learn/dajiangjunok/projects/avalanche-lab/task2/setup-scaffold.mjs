// Obtain the official template at an immutable revision; do not copy another student's project.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destination = path.join(root, 'scaffold-eth-2');
const revision = '208fbd6103f905ec2c9d4451d735c0883a0f2d9f';
if (fs.existsSync(destination)) throw Error('scaffold-eth-2 already exists; refusing to overwrite your work.');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dajiangjunok-scaffold-'));
try {
  const archive = path.join(tmp, 'template.tar.gz');
  execFileSync('curl', ['-fL', '--retry', '2', '--max-time', '120', `https://codeload.github.com/scaffold-eth/scaffold-eth-2/tar.gz/${revision}`, '-o', archive], { stdio: 'inherit' });
  execFileSync('tar', ['-xzf', archive, '-C', tmp]);
  const source = path.join(tmp, `scaffold-eth-2-${revision}`);
  const hardhat = path.join(source, 'packages/hardhat');
  for (const file of ['BootcampToken.sol', 'LearningPair.sol', 'TestAssets.sol']) fs.copyFileSync(path.join(root, 'contracts', file), path.join(hardhat, 'contracts', file));
  fs.copyFileSync(path.join(root, 'task2/00_deploy_bootcamp.ts'), path.join(hardhat, 'deploy/01_deploy_bootcamp.ts'));
  fs.copyFileSync(path.join(root, 'task2/page.tsx'), path.join(source, 'packages/nextjs/app/page.tsx'));
  const configPath = path.join(hardhat, 'hardhat.config.ts');
  let config = fs.readFileSync(configPath, 'utf8');
  if (!config.includes('version: "0.8.20"') || !config.includes('  networks: {')) throw Error('Unexpected upstream Hardhat template');
  config = config.replace('version: "0.8.20"', 'version: "0.8.24"').replace('  networks: {', `  networks: {\n    avalancheFuji: {\n      url: "https://api.avax-test.network/ext/bc/C/rpc",\n      chainId: 43113,\n      accounts: process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY ? [process.env.__RUNTIME_DEPLOYER_PRIVATE_KEY] : [],\n    },`);
  config = config.replace('          optimizer: {', '          evmVersion: "paris",\n          optimizer: {');
  fs.writeFileSync(configPath, config);
  const nextConfig = path.join(source, 'packages/nextjs/scaffold.config.ts');
  const frontend = fs.readFileSync(nextConfig, 'utf8');
  if (!frontend.includes('targetNetworks: [chains.hardhat]')) throw Error('Unexpected upstream frontend template');
  fs.writeFileSync(nextConfig, frontend.replace('targetNetworks: [chains.hardhat]', 'targetNetworks: process.env.NEXT_PUBLIC_LOCAL_TEST === "true" ? [chains.hardhat] : [chains.avalancheFuji, chains.hardhat]'));
  fs.writeFileSync(path.join(source,'BOOTCAMP_REVISION.txt'), `${revision}\nLocal overlays: ../contracts + ../task2/00_deploy_bootcamp.ts\n`);
  fs.cpSync(source, destination, { recursive: true });
  console.log('Scaffold-ETH prepared. Next: cd scaffold-eth-2 && yarn install');
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
