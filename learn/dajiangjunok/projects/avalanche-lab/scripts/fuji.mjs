import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { Wallet, NonceManager, JsonRpcProvider, Contract, ContractFactory, formatEther, parseEther, verifyMessage } from 'ethers';
import { MatchingEngine } from '../task7/engine.mjs';
import { orderTypes } from '../web/order-types.mjs';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const output = '../../public/evidence/fuji';
fs.mkdirSync(output, { recursive: true });
const reportPath = `${output}/deployment.json`;
const rpc = 'https://api.avax-test.network/ext/bc/C/rpc';
const provider = new JsonRpcProvider(rpc);
provider.pollingInterval = 1500;
const artifact = name => JSON.parse(fs.readFileSync(`artifacts/${name}.json`, 'utf8'));
let stage = 'configuration';
let report;
function save() {
  report.updatedAt = new Date().toISOString();
  fs.writeFileSync(`${reportPath}.tmp`, JSON.stringify(report, null, 2));
  fs.renameSync(`${reportPath}.tmp`, reportPath);
}
async function confirmed(label, hash) {
  let receipt = await provider.getTransactionReceipt(hash);
  if (!receipt) receipt = await provider.waitForTransaction(hash, 1, 180000);
  if (!receipt || receipt.status !== 1) throw Error('TRANSACTION_NOT_SUCCESSFUL');
  report.steps[label] = { hash, blockNumber: receipt.blockNumber, status: receipt.status,
    contractAddress: receipt.contractAddress, gasUsed: String(receipt.gasUsed), feeWei: String(receipt.fee),
    explorer: `https://testnet.snowtrace.io/tx/${hash}` };
  save();
  return receipt;
}
async function step(label, signer, makeRequest) {
  stage = label;
  if (report.steps[label]) return confirmed(label, report.steps[label].hash);
  const request = await makeRequest();
  const gasEstimate = await signer.estimateGas(request);
  const fees = await provider.getFeeData();
  const gasPrice = (fees.gasPrice ?? 0n) * 2n + 1_000_000n;
  if (gasPrice > 5_000_000_000n) throw Error('GAS_PRICE_EXCEEDS_TEST_BUDGET');
  const gasLimit = gasEstimate * 125n / 100n;
  const spent = Object.values(report.steps).reduce((sum, r) => sum + BigInt(r.feeWei ?? 0), 0n);
  if (spent + gasPrice * gasLimit > parseEther('0.05')) throw Error('TOTAL_GAS_BUDGET_EXCEEDED');
  const tx = await signer.sendTransaction({ ...request, gasPrice, gasLimit });
  report.steps[label] = { hash: tx.hash, status: 'pending' }; save();
  console.log(`SENT ${label}: ${tx.hash}`);
  const receipt = await confirmed(label, tx.hash);
  console.log(`PASS ${label}: block ${receipt.blockNumber}`);
  return receipt;
}
async function deploy(name, args, signer, key) {
  const a = artifact(name);
  const factory = new ContractFactory(a.abi, a.bytecode, signer);
  const receipt = await step(`deploy-${name}`, signer, () => factory.getDeployTransaction(...args));
  const address = receipt.contractAddress;
  if (!address || await provider.getCode(address) === '0x') throw Error('DEPLOYMENT_CODE_MISSING');
  report.config[key] = address; save();
  return new Contract(address, a.abi, signer);
}
try {
  process.loadEnvFile('.env.local');
  const key = process.env.AVALANCHE_WALLET_KEY?.trim();
  if (!key || !/^(0x)?[a-fA-F0-9]{64}$/.test(key)) throw Error('INVALID_KEY_FORMAT');
  const adminWallet = new Wallet(key.startsWith('0x') ? key : `0x${key}`, provider);
  if ((await provider.getNetwork()).chainId !== 43113n) throw Error('WRONG_CHAIN');
  console.log(`Fuji 43113 deployer ${adminWallet.address}; balance ${formatEther(await provider.getBalance(adminWallet.address))} AVAX`);
  if (!process.argv.includes('--execute')) { console.log('Preflight only. Use --execute to deploy.'); }
  else {
    if (!fs.existsSync('.env.test-wallet')) {
      fs.writeFileSync('.env.test-wallet', `TEST_COUNTERPARTY_KEY=${Wallet.createRandom().privateKey}\n`, { mode: 0o600, flag: 'wx' });
    }
    process.loadEnvFile('.env.test-wallet');
    const buyerWallet = new Wallet(process.env.TEST_COUNTERPARTY_KEY, provider);
    const admin = new NonceManager(adminWallet), buyer = new NonceManager(buyerWallet);
    const a = adminWallet.address, b = buyerWallet.address;
    report = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath)) : {
      network: 'Avalanche Fuji C-Chain', chainId: 43113, rpc, createdAt: new Date().toISOString(),
      accounts: { deployer: a, buyer: b }, config: {}, steps: {}, checks: {}, status: 'in-progress'
    };
    assert.equal(report.chainId, 43113); assert.equal(report.accounts.deployer, a); assert.equal(report.accounts.buyer, b);
    save();
    // Both wallets are controlled locally. The second key is never included in public artifacts.
    if (report.steps['fund-test-buyer']) await confirmed('fund-test-buyer', report.steps['fund-test-buyer'].hash);
    else if (await provider.getBalance(b) < parseEther('0.005')) {
      await step('fund-test-buyer', admin, async () => ({ to: b, value: parseEther('0.005') }));
    }
    const token = await deploy('BootcampToken', [a], admin, 'token');
    const usd = await deploy('MockUSDC', [a], admin, 'quote');
    const pair = await deploy('LearningPair', [token.target, usd.target], admin, 'pair');
    await step('configure-dex-pair', admin, () => token.setDexPair.populateTransaction(pair.target));
    await step('mint-liquidity-quote', admin, () => usd.mint.populateTransaction(a, 20_000n * 10n**6n));
    await step('approve-liquidity-token', admin, () => token.approve.populateTransaction(pair.target, 100_000n * 10n**18n));
    await step('approve-liquidity-quote', admin, () => usd.approve.populateTransaction(pair.target, 10_000n * 10n**6n));
    await step('add-liquidity', admin, async () => pair.addLiquidity.populateTransaction(100_000n * 10n**18n, 10_000n * 10n**6n, 1,
      (await provider.getBlock('latest')).timestamp + 1800));
    await step('mint-buyer-quote', admin, () => usd.mint.populateTransaction(b, 2000n * 10n**6n));
    if (!report.checks.quoteBefore) { report.checks.quoteBefore = String(await token.quotePurchase(100n * 10n**6n)); save(); }
    await step('approve-dex-purchase', buyer, () => usd.connect(buyer).approve.populateTransaction(token.target, 100n * 10n**6n));
    await step('dex-purchase', buyer, async () => token.connect(buyer).buyWithQuote.populateTransaction(100n * 10n**6n,
      (await token.quotePurchase(100n * 10n**6n)) * 99n / 100n, (await provider.getBlock('latest')).timestamp + 1800));
    report.checks.quoteAfter = String(await token.quotePurchase(100n * 10n**6n));
    report.checks.buyerDJJ = String(await token.balanceOf(b));
    assert(BigInt(report.checks.buyerDJJ) > 0n); save();
    const rwa = await deploy('CoffeeWarehouseReceipt', [a, 10000, 'urn:bootcamp:coffee:batch-001:v1'], admin, 'rwa');
    await step('rwa-mint', admin, () => rwa.mint.populateTransaction(a, 100));
    await step('rwa-transfer', admin, () => rwa.transfer.populateTransaction(b, 30));
    await step('rwa-burn', buyer, () => rwa.connect(buyer).burn.populateTransaction(10));
    report.checks.rwa = { supply: String(await rwa.totalSupply()), deployer: String(await rwa.balanceOf(a)), buyer: String(await rwa.balanceOf(b)) };
    assert.equal(report.checks.rwa.supply, '90'); assert.equal(report.checks.rwa.deployer, '70'); assert.equal(report.checks.rwa.buyer, '20'); save();
    const base = await deploy('BaseAsset', [a], admin, 'base');
    const dex = await deploy('MiniExchange', [base.target, usd.target, 100000, 1_000_000n * 10n**6n], admin, 'dex');
    report.config.dexQuote = usd.target; save();
    await step('mint-dex-base', admin, () => base.mint.populateTransaction(a, 100));
    await step('approve-base-deposit', admin, () => base.approve.populateTransaction(dex.target, 100));
    await step('deposit-base', admin, () => dex.deposit.populateTransaction(base.target, 100));
    await step('approve-quote-deposit', buyer, () => usd.connect(buyer).approve.populateTransaction(dex.target, 1000n * 10n**6n));
    await step('deposit-quote', buyer, () => dex.connect(buyer).deposit.populateTransaction(usd.target, 1000n * 10n**6n));
    if (!report.steps['settle-trade']) {
      const deadline = (await provider.getBlock('latest')).timestamp + 3600;
      const sell = { trader:a, isBuy:false, price:10_000_000n, amount:10n, nonce:1n, deadline };
      const buy = { trader:b, isBuy:true, price:11_000_000n, amount:10n, nonce:2n, deadline };
      const domain = { name:'BootcampMiniDEX', version:'1', chainId:43113, verifyingContract:dex.target };
      const ss = await adminWallet.signTypedData(domain, orderTypes, sell), bs = await buyerWallet.signTypedData(domain, orderTypes, buy);
      const book = new MatchingEngine();
      book.submit({id:'seller', trader:a, side:'sell', price:sell.price, amount:sell.amount});
      const { fills } = book.submit({id:'buyer', trader:b, side:'buy', price:buy.price, amount:buy.amount});
      assert.equal(fills.length, 1);
      await step('settle-trade', admin, () => dex.settle.populateTransaction(buy,bs,sell,ss,fills[0].amount,fills[0].price));
    } else await confirmed('settle-trade', report.steps['settle-trade'].hash);
    await step('withdraw-base', buyer, () => dex.connect(buyer).withdraw.populateTransaction(base.target, 10));
    await step('withdraw-quote', admin, () => dex.withdraw.populateTransaction(usd.target, 100n * 10n**6n));
    assert.equal(await base.balanceOf(b), 10n);
    report.checks.miniDex = { buyerBASE: String(await base.balanceOf(b)), buyerQuoteInExchange: String(await dex.balances(b, usd.target)), sellerBaseInExchange: String(await dex.balances(a, base.target)), twoAddressSettlement: true };
    report.checks.login = {};
    for (const w of [adminWallet,buyerWallet]) {
      const message = `Avalanche Bootcamp wallet ownership proof\nChain ID: 43113\nAddress: ${w.address}\nNonce: ${crypto.randomUUID()}`;
      const signature = await w.signMessage(message);
      assert.equal(verifyMessage(message, signature), w.address);
      report.checks.login[w.address] = { message, signature, verified: true };
    }
    report.totalGasAVAX = formatEther(Object.values(report.steps).reduce((n,r)=>n+BigInt(r.feeWei??0),0n));
    report.status = 'complete'; save();
    const transactions = Object.entries(report.steps).map(([label,r]) => ({label,...r}));
    fs.writeFileSync(`${output}/wallet-import.json`, JSON.stringify({chainId:43113,network:'Fuji',config:report.config,transactions},null,2));
    console.log(`Fuji deployment and interactions complete. Gas spent: ${report.totalGasAVAX} AVAX.`);
  }
} catch (error) {
  // Never print arbitrary errors, environment values, wallet objects or private keys.
  console.error(`Fuji workflow stopped at ${stage}; code=${error.code ?? error.name ?? 'UNKNOWN'}`);
  if (report) { report.lastFailure = {stage,code:error.code??error.name}; save(); }
  process.exitCode = 1;
} finally { provider.destroy(); }
