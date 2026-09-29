import fs from 'node:fs';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import './compile.mjs';

const rpc = 'http://127.0.0.1:18546', origin = 'http://127.0.0.1:4173';
for (const url of [rpc, origin]) {
  try { await fetch(url, { signal: AbortSignal.timeout(400) }); throw Error(`Port occupied: ${url}`); }
  catch(e) { if(e.message.startsWith('Port occupied')) throw e; }
}
const processes = [
  spawn('anvil',['--host','127.0.0.1','--port','18546','--chain-id','31337','--silent'],{stdio:'ignore'}),
  spawn(process.execPath,['scripts/serve.mjs'],{stdio:'ignore'})
];
let processError;
processes.forEach(p=>p.on('error',e=>{processError=e;}));
let browser;
const errors=[];
const output='../../public/evidence/local-browser'; fs.mkdirSync(output,{recursive:true});
async function rpcCall(method,params=[]) {
  const r=await fetch(rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const data=await r.json(); if(data.error) throw Error(data.error.message); return data.result;
}
async function waitReady() {
  for(let i=0;i<80;i++) {
    if(processError) throw processError;
    if(processes.some(p=>p.exitCode!==null)) throw Error('Local test process exited');
    try { await rpcCall('eth_chainId'); if((await fetch(origin)).ok) return; } catch{}
    await new Promise(r=>setTimeout(r,100));
  }
  throw Error('Local test services not ready');
}
async function walletPage(address) {
  const context=await browser.newContext({viewport:{width:1360,height:950}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  // Isolated test-only EIP-1193 adapter. All signatures/transactions come from unlocked LOCAL Anvil accounts.
  await page.exposeFunction('localTestRpc',async ({method,params=[]})=>{
    if(method==='eth_requestAccounts'||method==='eth_accounts') return [address];
    return rpcCall(method,params);
  });
  await page.addInitScript(()=>{ window.ethereum={request:args=>window.localTestRpc(args),on:()=>{}}; });
  await page.goto(origin);
  return page;
}
async function click(page,id) {
  await page.locator(`#${id}`).click();
  await page.waitForFunction(id=>!document.getElementById(id).disabled,id,{timeout:90000});
  const status=await page.locator('#status').textContent();
  assert.equal(await page.locator('#status').getAttribute('class'),'','UI error: '+status);
  assert.equal(status,'操作完成');
  console.log(`PASS browser: ${id}`);
}
async function screenshot(page,name) {
  await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
}
try {
  await waitReady();
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const accounts=await rpcCall('eth_accounts'); const a=await walletPage(accounts[0]), b=await walletPage(accounts[1]);
  await click(a,'connect'); await screenshot(a,'01-login-local');
  await click(a,'deployToken'); assert.match(await a.locator('#tokenInfo').textContent(),/1000000/);
  await screenshot(a,'02-token-local');
  await click(a,'setupPair'); await click(a,'getQuote');
  assert.match(await a.locator('#pairInfo').textContent(),/987\.158/);
  await screenshot(a,'03-dex-quote-local');
  await click(a,'buy'); await screenshot(a,'04-dex-purchase-local');
  await click(a,'deployRwa'); await screenshot(a,'05-rwa-deploy-local');
  await click(a,'mintRwa'); await screenshot(a,'06-rwa-mint-local');
  await a.locator('#recipient').fill(accounts[1]); await a.locator('#rwaAmount').fill('30'); await click(a,'transferRwa');
  await screenshot(a,'07-rwa-transfer-local');
  await a.locator('#rwaAmount').fill('10'); await click(a,'burnRwa'); await screenshot(a,'08-rwa-burn-local');
  await click(a,'updateDoc');
  await click(a,'deployDex');
  await a.locator('#asset').selectOption('base'); await a.locator('#dexAmount').fill('100'); await click(a,'mintAsset'); await click(a,'deposit');
  await a.locator('#asset').selectOption('quote'); await a.locator('#dexAmount').fill('1000'); await a.locator('#assetRecipient').fill(accounts[1]); await click(a,'mintAsset');
  const saved=JSON.parse(await a.evaluate(()=>localStorage.getItem('bootcamp:31337')));
  await click(b,'connect');
  await b.locator('#importConfig').setInputFiles({name:'local-config.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({chainId:31337,config:saved.config,transactions:saved.records}))});
  await b.waitForFunction(()=>document.getElementById('status').textContent==='部署记录已导入');
  await b.locator('#asset').selectOption('quote'); await b.locator('#dexAmount').fill('1000'); await click(b,'deposit');
  await screenshot(b,'09-buyer-balance-local');
  await a.locator('#side').selectOption('sell'); await click(a,'signOrder');
  const sell=await a.locator('#orderJson').inputValue(); await b.locator('#orderJson').fill(sell); await click(b,'importOrder');
  await b.locator('#side').selectOption('buy'); await click(b,'signOrder'); await click(b,'settle');
  assert.match(await b.locator('#dexInfo').textContent(),/账户 BASE10/); await screenshot(b,'10-two-address-trade-local');
  await b.locator('#asset').selectOption('base'); await b.locator('#dexAmount').fill('10'); await click(b,'withdraw');
  assert.match(await b.locator('#dexInfo').textContent(),/账户 BASE0/); await screenshot(b,'11-withdraw-local');
  // Order signatures and chain settlements were real; no successful RPC result is mocked.
  for(const p of ['/.env','/dajiangjunok.md','/package.json']) assert.equal((await fetch(origin+p)).status,404);
  assert.deepEqual(errors,[]);
  fs.writeFileSync(`${output}/result.json`,JSON.stringify({network:'LOCAL ANVIL ONLY — NOT FUJI',chainId:31337,generatedAt:new Date().toISOString(),checks:['wallet signature login','ERC20 deployment','pool liquidity and live quote','DEX purchase','RWA mint/transfer/burn/document','two wallets deposit','signed orders matched and settled','withdraw','private files not served'],pageErrors:errors,receiptLog:JSON.parse(await b.locator('#log').textContent())},null,2));
  console.log('All browser checks passed. Screenshots and receipt log are LOCAL evidence only.');
} finally {
  if(browser) await browser.close();
  processes.forEach(p=>p.kill('SIGTERM'));
}
