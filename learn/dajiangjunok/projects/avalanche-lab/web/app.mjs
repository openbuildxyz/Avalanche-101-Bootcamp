import { BrowserProvider, Contract, ContractFactory, parseUnits, formatUnits, verifyMessage, verifyTypedData, getAddress } from '/ethers.js';
import { MatchingEngine } from '/task7/engine.mjs';
import { orderTypes } from './order-types.mjs';
const $ = id => document.getElementById(id);
const json = obj => JSON.stringify(obj, (_, v) => typeof v === 'bigint' ? v.toString() : v, 2);
let provider, signer, account, chainId, config = {}, records = [], signedOrders = [];
const artifacts = {};
const status = (text, error = false) => { $('status').textContent = text; $('status').className = error ? 'error' : ''; };
function persist() { localStorage.setItem(`bootcamp:${chainId}`, json({ config, records })); }
function info(id, values) { $(id).replaceChildren(...Object.entries(values).flatMap(([k,v]) => {
  const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; return [dt, dd];
})); }
function log(label, receipt) {
  records.push({ label, hash: receipt.hash, blockNumber: receipt.blockNumber, status: receipt.status });
  $('log').textContent = json({ chainId, network: chainId === 43113 ? 'Fuji' : 'LOCAL ANVIL — NOT FUJI', config, transactions: records }); persist();
}
async function artifact(name) {
  if (!artifacts[name]) { const r = await fetch(`/artifacts/${name}.json`); if (!r.ok) throw Error('请先运行 npm run compile'); artifacts[name] = await r.json(); }
  return artifacts[name];
}
async function contract(name, address) {
  if (!address || await provider.getCode(address) === '0x') throw Error(`${name} 尚未部署，或地址与当前网络不符`);
  return new Contract(address, (await artifact(name)).abi, signer);
}
async function send(label, call) {
  status(`${label}：等待钱包确认…`); const tx = await call; status(`${label}：等待链上回执 ${tx.hash}`);
  const receipt = await tx.wait(); if (receipt.status !== 1) throw Error('交易失败'); log(label, receipt); return receipt;
}
async function deploy(name, args, key) {
  if (config[key]) { await contract(name, config[key]); return contract(name, config[key]); }
  const a = await artifact(name); status(`部署 ${name}：请确认钱包交易`);
  const c = await new ContractFactory(a.abi, a.bytecode, signer).deploy(...args);
  await send(`deploy ${name}`, Promise.resolve(c.deploymentTransaction()));
  config[key] = await c.getAddress(); persist(); return c;
}
async function requireWallet() {
  if (!signer) throw Error('请先连接钱包');
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainId || ![43113, 31337].includes(chainId)) throw Error('仅支持 Fuji 或本地 Anvil，请重新连接');
  const accounts = await provider.send('eth_accounts', []);
  if (accounts[0]?.toLowerCase() !== account.toLowerCase()) throw Error('钱包账户已变化，请重新连接');
}
async function refresh() {
  await requireWallet();
  $('network').textContent = chainId === 43113 ? 'Avalanche Fuji · 43113' : '本地 Anvil · 31337 · 非 Fuji 凭证';
  $('account').textContent = `${account} · ${formatUnits(await provider.getBalance(account), 18)} AVAX`;
  if (config.token) { const t = await contract('BootcampToken', config.token); info('tokenInfo', { '合约': config.token, '我的 DJJ': formatUnits(await t.balanceOf(account), 18), '总供应': formatUnits(await t.totalSupply(), 18) }); }
  if (config.pair) { const p = await contract('LearningPair', config.pair); info('pairInfo', { 'Pair': config.pair, 'mUSD': config.quote, 'DJJ 储备': formatUnits(await p.reserve0(), 18), 'mUSD 储备': formatUnits(await p.reserve1(), 6) }); }
  if (config.rwa) { const r = await contract('CoffeeWarehouseReceipt', config.rwa); info('rwaInfo', { '合约': config.rwa, '我的 CWR': String(await r.balanceOf(account)), '总供应': String(await r.totalSupply()), '资产证明': await r.assetDocument() }); }
  if (config.dex) { const d = await contract('MiniExchange', config.dex); info('dexInfo', { 'BASE': config.base, 'mUSD': config.dexQuote, 'MiniExchange': config.dex, '账户 BASE': String(await d.balances(account, config.base)), '账户 mUSD': formatUnits(await d.balances(account, config.dexQuote), 6) }); }
  $('log').textContent = json({ chainId, config, transactions: records });
}
function action(id, fn, needsWallet = true) { $(id).onclick = async () => {
  document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { if (needsWallet) await requireWallet(); await fn(); status('操作完成'); }
  catch (e) { status(e.shortMessage ?? e.message, true); }
  finally { document.querySelectorAll('button').forEach(b => b.disabled = false); }
}; }
action('connect', async () => {
  if (!window.ethereum) throw Error('未检测到浏览器钱包，请安装或启用 MetaMask / Core');
  provider = new BrowserProvider(window.ethereum); await provider.send('eth_requestAccounts', []); signer = await provider.getSigner();
  account = await signer.getAddress(); chainId = Number((await provider.getNetwork()).chainId);
  if (chainId === 31337) provider.pollingInterval = 100;
  if (![43113,31337].includes(chainId)) throw Error('请切换至 Fuji 测试网');
  const message = `Avalanche Bootcamp wallet ownership proof\nOrigin: ${location.origin}\nAddress: ${account}\nChain ID: ${chainId}\nNonce: ${crypto.randomUUID()}\nIssued: ${new Date().toISOString()}`;
  if (verifyMessage(message, await signer.signMessage(message)) !== account) throw Error('签名验证失败');
  const saved = JSON.parse(localStorage.getItem(`bootcamp:${chainId}`) ?? '{}'); config = saved.config ?? {}; records = saved.records ?? [];
  signedOrders = []; $('book').textContent = '已验证钱包签名；尚无订单';
  $('recipient').value = account; $('assetRecipient').value = account; await refresh();
}, false);
action('switch', async () => {
  if (!window.ethereum) throw Error('未检测到浏览器钱包');
  try { await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0xa869' }] }); }
  catch (e) { if (e.code !== 4902) throw e; await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [{ chainId: '0xa869', chainName: 'Avalanche Fuji', nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 }, rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'], blockExplorerUrls: ['https://testnet.snowtrace.io'] }] }); }
}, false);
action('refresh', refresh);
action('deployToken', async () => { await deploy('BootcampToken', [account], 'token'); await refresh(); });
action('setupPair', async () => {
  const t = await contract('BootcampToken', config.token);
  const q = await deploy('MockUSDC', [account], 'quote');
  const p = await deploy('LearningPair', [t.target, q.target], 'pair');
  if (await t.dexPair() === '0x0000000000000000000000000000000000000000') await send('配置 DEX 价格源', t.setDexPair(p.target));
  if (await p.totalSupply() === 0n) {
    await send('发行学习 mUSD', q.mint(account, parseUnits('20000', 6)));
    await send('授权 DJJ 流动性', t.approve(p.target, parseUnits('100000', 18)));
    await send('授权 mUSD 流动性', q.approve(p.target, parseUnits('10000', 6)));
    await send('添加交易对流动性', p.addLiquidity(parseUnits('100000',18), parseUnits('10000',6), 1, Math.floor(Date.now()/1000)+1200));
  }
  await refresh();
});
action('getQuote', async () => { const t = await contract('BootcampToken', config.token); const out = await t.quotePurchase(parseUnits($('quoteAmount').value,6)); info('pairInfo', { 'Pair': config.pair, '支付 mUSD': $('quoteAmount').value, '预期获得 DJJ（含手续费与价格影响）': formatUnits(out,18) }); });
action('buy', async () => {
  const t = await contract('BootcampToken', config.token), q = await contract('MockUSDC', config.quote);
  const amount = parseUnits($('quoteAmount').value,6), out = await t.quotePurchase(amount);
  await send('授权购买', q.approve(t.target, amount));
  await send('使用 DEX 报价购买 DJJ', t.buyWithQuote(amount, out*99n/100n, Math.floor(Date.now()/1000)+1200)); await refresh();
});
action('deployRwa', async () => { await deploy('CoffeeWarehouseReceipt', [account,10000,'urn:bootcamp:coffee:batch-001:v1'], 'rwa'); await refresh(); });
for (const [id, method] of [['mintRwa','mint'],['transferRwa','transfer'],['burnRwa','burn']]) action(id, async () => {
  const c = await contract('CoffeeWarehouseReceipt',config.rwa), amount = parseUnits($('rwaAmount').value,0);
  const args = method === 'burn' ? [amount] : [getAddress($('recipient').value),amount];
  await send(`RWA ${method}`,c[method](...args)); await refresh();
});
action('updateDoc', async () => { const r = await contract('CoffeeWarehouseReceipt',config.rwa); await send('更新资产证明',r.updateAssetDocument($('document').value)); await refresh(); });
action('deployDex', async () => {
  const b = await deploy('BaseAsset',[account],'base'), q = await deploy('MockUSDC',[account],'dexQuote');
  await deploy('MiniExchange',[b.target,q.target,100000,parseUnits('1000000',6)],'dex'); await refresh();
});
for (const id of ['mintAsset','deposit','withdraw']) action(id, async () => {
  const isBase = $('asset').value === 'base'; const addr = isBase ? config.base : config.dexQuote;
  const amount = parseUnits($('dexAmount').value,isBase ? 0 : 6);
  const t = await contract(isBase ? 'BaseAsset' : 'MockUSDC',addr), d = await contract('MiniExchange',config.dex);
  if (id === 'mintAsset') await send('发行测试币',t.mint(getAddress($('assetRecipient').value || account),amount));
  if (id === 'deposit') { await send('授权存款',t.approve(d.target,amount)); await send('deposit',d.deposit(addr,amount)); }
  if (id === 'withdraw') await send('withdraw',d.withdraw(addr,amount)); await refresh();
});
const domain = () => ({ name:'BootcampMiniDEX',version:'1',chainId,verifyingContract:config.dex });
async function addOrder(bundle) {
  if (bundle.chainId !== chainId || getAddress(bundle.exchange) !== getAddress(config.dex)) throw Error('订单网络或交易所地址不符');
  const o = bundle.order; o.trader = getAddress(o.trader);
  if (verifyTypedData(domain(),orderTypes,o,bundle.signature) !== o.trader) throw Error('订单签名无效');
  if (typeof o.isBuy !== 'boolean' || BigInt(o.price)<=0n || BigInt(o.amount)<=0n || BigInt(o.deadline)<BigInt(Math.floor(Date.now()/1000))) throw Error('订单参数无效或已过期');
  const d = await contract('MiniExchange',config.dex); const hash = await d.hashOrder(o);
  if (await d.cancelled(o.trader,o.nonce)) throw Error('订单已撤销');
  if (!signedOrders.some(x=>x.hash===hash)) signedOrders.push({...bundle,hash});
  $('book').textContent = json(signedOrders.map(x=>({ hash:x.hash,trader:x.order.trader,side:x.order.isBuy?'buy':'sell',price:formatUnits(x.order.price,6),amount:x.order.amount })));
}
action('signOrder', async () => {
  await contract('MiniExchange',config.dex);
  const order = { trader:account,isBuy:$('side').value==='buy',price:parseUnits($('price').value,6),amount:parseUnits($('orderAmount').value,0),nonce:BigInt('0x'+Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('')),deadline:Math.floor(Date.now()/1000)+3600 };
  const bundle = { chainId,exchange:config.dex,order,signature:await signer.signTypedData(domain(),orderTypes,order) };
  $('orderJson').value = json(bundle); await addOrder(bundle);
});
action('importOrder', async () => addOrder(JSON.parse($('orderJson').value)));
action('settle', async () => {
  const d = await contract('MiniExchange',config.dex); const book = new MatchingEngine(); let proposed;
  for (const b of signedOrders) {
    const o = b.order, remaining = BigInt(o.amount)-await d.filled(b.hash);
    if (remaining <= 0n || await d.cancelled(o.trader,o.nonce) || BigInt(o.deadline)<BigInt(Math.floor(Date.now()/1000))) continue;
    const result = book.submit({id:b.hash,trader:o.trader,side:o.isBuy?'buy':'sell',price:BigInt(o.price),amount:remaining,deadline:Number(o.deadline)});
    if (result.fills.length) { proposed = result.fills[0]; break; }
  }
  if (!proposed) throw Error('没有可成交的双边订单，请导入另一钱包签名的订单');
  const maker = signedOrders.find(x=>x.hash===proposed.makerId), taker = signedOrders.find(x=>x.hash===proposed.takerId);
  const [buy,sell] = maker.order.isBuy ? [maker,taker] : [taker,maker];
  await send('双地址签名成交',d.settle(buy.order,buy.signature,sell.order,sell.signature,proposed.amount,proposed.price)); await refresh();
});
action('cancelOrder', async () => {
  const b = signedOrders.findLast(x=>x.order.trader===account); if(!b) throw Error('没有本人订单');
  const d = await contract('MiniExchange',config.dex); await send('撤销订单',d.cancel(b.order.nonce));
});
action('export', async () => {
  const blob = new Blob([json({chainId,network:chainId===43113?'Fuji':'LOCAL ANVIL — NOT FUJI',account,config,transactions:records})],{type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=`bootcamp-${chainId}.json`; a.click(); URL.revokeObjectURL(url);
});
$('importConfig').onchange = async e => {
  try {
    await requireWallet(); const data=JSON.parse(await e.target.files[0].text()); if(data.chainId!==chainId) throw Error('部署记录网络不符');
    const valid={token:'BootcampToken',quote:'MockUSDC',pair:'LearningPair',rwa:'CoffeeWarehouseReceipt',base:'BaseAsset',dexQuote:'MockUSDC',dex:'MiniExchange'};
    for(const [key,value] of Object.entries(data.config??{})) { if(!valid[key]) throw Error('不支持的配置项'); await contract(valid[key],getAddress(value)); }
    config=data.config; records=data.transactions??[]; signedOrders=[]; persist(); await refresh(); status('部署记录已导入');
  } catch(e) { status(e.shortMessage??e.message,true); }
};
window.ethereum?.on?.('accountsChanged',()=>{signer=undefined;signedOrders=[];status('钱包账户已变化，请重新连接');});
window.ethereum?.on?.('chainChanged',()=>location.reload());
