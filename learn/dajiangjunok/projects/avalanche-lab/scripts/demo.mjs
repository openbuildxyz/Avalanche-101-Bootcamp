// Runs only on a fresh, private Anvil process. Never uses user keys or broadcasts to Fuji.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { JsonRpcProvider, ContractFactory, verifyMessage } from 'ethers';
import { MatchingEngine } from '../task7/engine.mjs';
import { orderTypes } from '../web/order-types.mjs';
import './compile.mjs';

const rpc = 'http://127.0.0.1:18545';
// Refuse to reuse an existing node; demo output must correspond to a fresh controlled chain.
try { await fetch(rpc, { method: 'POST', body: '{}', signal: AbortSignal.timeout(500) });
  throw Error('Port 18545 is occupied. Stop that process before running the local demo.');
} catch (e) { if (e.message.startsWith('Port')) throw e; }
const anvil = spawn('anvil', ['--host', '127.0.0.1', '--port', '18545', '--chain-id', '31337', '--silent'], { stdio: 'ignore' });
let startupError;
anvil.on('error', e => { startupError = e; });
const provider = new JsonRpcProvider(rpc, 31337, { staticNetwork: true });
provider.pollingInterval = 50;
const report = { network: 'LOCAL ANVIL ONLY — NOT FUJI', chainId: 31337, generatedAt: new Date().toISOString(), contracts: {}, transactions: [], checks: {} };
async function tx(label, promise) {
  const receipt = await (await promise).wait(); assert.equal(receipt.status, 1);
  report.transactions.push({ label, hash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status });
  console.log(`PASS ${label}: ${receipt.hash}`); return receipt;
}
async function deploy(name, signer, args = []) {
  const artifact = JSON.parse(fs.readFileSync(`artifacts/${name}.json`));
  const c = await new ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await tx(`deploy ${name}`, Promise.resolve(c.deploymentTransaction()));
  report.contracts[name] = await c.getAddress(); return c;
}
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (startupError) throw startupError;
    if (anvil.exitCode !== null) throw Error('Anvil exited during startup');
    try { await provider.getBlockNumber(); ready = true; break; } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  if (!ready) throw Error('Anvil did not start');
  const admin = await provider.getSigner(0), buyer = await provider.getSigner(1);
  const a = await admin.getAddress(), b = await buyer.getAddress(); report.accounts = { seller: a, buyer: b };
  const loginMessage = `Bootcamp local wallet ownership proof\nChain ID: 31337\nNonce: ${crypto.randomUUID()}`;
  for (const s of [admin, buyer]) assert.equal(verifyMessage(loginMessage, await s.signMessage(loginMessage)), await s.getAddress());
  report.checks.twoWalletLoginSignatures = true;
  const token = await deploy('BootcampToken', admin, [a]);
  const usd = await deploy('MockUSDC', admin, [a]);
  const pair = await deploy('LearningPair', admin, [token.target, usd.target]);
  await tx('configure DEX price source', token.setDexPair(pair.target));
  await tx('mint mock quote', usd.mint(a, 100_000_000_000n));
  await tx('approve liquidity DJJ', token.approve(pair.target, 100_000n * 10n ** 18n));
  await tx('approve liquidity mUSD', usd.approve(pair.target, 10_000n * 10n ** 6n));
  const deadline = Number((await provider.getBlock('latest')).timestamp) + 3600;
  await tx('add real pool liquidity', pair.addLiquidity(100_000n * 10n ** 18n, 10_000n * 10n ** 6n, 1, deadline));
  await tx('fund buyer mUSD', usd.mint(b, 2000n * 10n ** 6n));
  const quoteBefore = await token.quotePurchase(100n * 10n ** 6n);
  await tx('approve purchase', usd.connect(buyer).approve(token.target, 100n * 10n ** 6n));
  await tx('purchase priced by DEX', token.connect(buyer).buyWithQuote(100n * 10n ** 6n, quoteBefore * 99n / 100n, deadline));
  assert.equal(await token.balanceOf(b), quoteBefore);
  const quoteAfter = await token.quotePurchase(100n * 10n ** 6n); assert(quoteAfter < quoteBefore);
  report.checks.dex = { quoteBefore: String(quoteBefore), quoteAfter: String(quoteAfter), purchased: String(await token.balanceOf(b)), decimals: { DJJ: 18, mUSD: 6 } };
  const rwa = await deploy('CoffeeWarehouseReceipt', admin, [a, 10_000, 'urn:bootcamp:coffee:batch-001:v1']);
  await tx('RWA mint 100 kg', rwa.mint(a, 100));
  await tx('RWA transfer 30 kg', rwa.transfer(b, 30));
  await tx('RWA burn 10 kg', rwa.connect(buyer).burn(10));
  assert.equal(await rwa.totalSupply(), 90n); assert.equal(await rwa.balanceOf(b), 20n);
  report.checks.rwa = { totalSupply: '90', sellerBalance: '70', buyerBalance: '20' };
  const base = await deploy('BaseAsset', admin, [a]);
  const dex = await deploy('MiniExchange', admin, [base.target, usd.target, 100_000, 1_000_000n * 10n ** 6n]);
  await tx('mint BASE for seller', base.mint(a, 100));
  await tx('approve BASE deposit', base.approve(dex.target, 100));
  await tx('deposit BASE', dex.deposit(base.target, 100));
  await tx('approve mUSD deposit', usd.connect(buyer).approve(dex.target, 1000n * 10n ** 6n));
  await tx('deposit mUSD', dex.connect(buyer).deposit(usd.target, 1000n * 10n ** 6n));
  const sell = { trader: a, isBuy: false, price: 10_000_000n, amount: 10n, nonce: 1n, deadline };
  const buy = { trader: b, isBuy: true, price: 11_000_000n, amount: 10n, nonce: 2n, deadline };
  const domain = { name: 'BootcampMiniDEX', version: '1', chainId: 31337, verifyingContract: dex.target };
  const ss = await admin.signTypedData(domain, orderTypes, sell), bs = await buyer.signTypedData(domain, orderTypes, buy);
  const book = new MatchingEngine();
  book.submit({ id: 'sell', trader: a, side: 'sell', price: sell.price, amount: sell.amount });
  const { fills } = book.submit({ id: 'buy', trader: b, side: 'buy', price: buy.price, amount: buy.amount });
  assert.equal(fills.length, 1);
  await tx('two-address signed settlement', dex.settle(buy, bs, sell, ss, fills[0].amount, fills[0].price));
  assert.equal(await dex.balances(b, base.target), 10n); assert.equal(await dex.balances(a, usd.target), 100_000_000n);
  await tx('withdraw BASE', dex.connect(buyer).withdraw(base.target, 10));
  await tx('withdraw mUSD', dex.withdraw(usd.target, 100_000_000n));
  assert.equal(await base.balanceOf(b), 10n);
  report.checks.miniDex = { twoAddressTrade: true, buyerReceivedBASE: '10', sellerReceivedMUSD: '100', enginePrice: '10', depositAndWithdraw: true };
  fs.mkdirSync('../../public/evidence', { recursive: true });
  fs.writeFileSync('../../public/evidence/local-demo.json', JSON.stringify(report, null, 2));
  console.log('All local integration checks passed. Saved ../../public/evidence/local-demo.json (NOT Fuji evidence).');
} finally {
  provider.destroy(); anvil.kill('SIGTERM');
}
