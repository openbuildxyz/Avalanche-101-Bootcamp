import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
import {JsonRpcProvider,Wallet,getBytes} from 'ethers';
import {captureExplorer} from './explorer-capture.mjs';

process.chdir(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const out='../../public/evidence/fuji',report=JSON.parse(fs.readFileSync(`${out}/deployment.json`));
if(report.status!=='complete'||report.chainId!==43113)throw Error('Fuji workflow must finish first');
process.loadEnvFile('.env.local');process.loadEnvFile('.env.test-wallet');
const raw=process.env.AVALANCHE_WALLET_KEY.trim();
const provider=new JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
let wallets;
try { wallets=[new Wallet(raw.startsWith('0x')?raw:'0x'+raw),new Wallet(process.env.TEST_COUNTERPARTY_KEY)]; }
catch { throw Error('INVALID_PRIVATE_KEY_CONFIGURATION'); }
const readonly=new Set(['eth_chainId','eth_call','eth_getBalance','eth_getCode','eth_blockNumber','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getBlockByNumber','eth_getLogs']);
const origin='http://127.0.0.1:4173';
let server,browser;
const result={chainId:43113,source:'Live Fuji RPC and genuine explorer pages',screenshots:[],verified:[]};
try {
  try{await fetch(origin,{signal:AbortSignal.timeout(500)});throw Error('PORT_OCCUPIED');}catch(e){if(e.message==='PORT_OCCUPIED')throw e;}
  server=spawn(process.execPath,['scripts/serve.mjs'],{stdio:'ignore'});
  await new Promise((resolve,reject)=>{server.once('error',reject);setTimeout(resolve,600);});
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const context=await browser.newContext({viewport:{width:1360,height:1000}});
  const page=await context.newPage();let selected=wallets[0];
  await page.exposeFunction('fujiRpc',async({method,params=[]})=>{
    if(method==='eth_requestAccounts'||method==='eth_accounts')return[selected.address];
    if(method==='personal_sign') {
      const message=Buffer.from(getBytes(params[0])).toString('utf8');
      if(!message.startsWith(`Avalanche Bootcamp wallet ownership proof\nOrigin: ${origin}\n`)||!message.includes(`Address: ${selected.address}\nChain ID: 43113`))throw Error('SIGNATURE_SCOPE_REJECTED');
      return selected.signMessage(getBytes(params[0]));
    }
    if(!readonly.has(method))throw Error('READ_ONLY_SCREENSHOT_ADAPTER');
    return provider.send(method,params);
  });
  await page.addInitScript(()=>{window.ethereum={request:args=>window.fujiRpc(args),on:()=>{}};});
  async function snapshot(name){await page.screenshot({path:`${out}/${name}.png`,fullPage:true});result.screenshots.push(`${name}.png`);}
  await page.goto(origin);
  await page.locator('#connect').click();
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='操作完成',{},{timeout:60000});
  await page.locator('#importConfig').setInputFiles(path.resolve(`${out}/wallet-import.json`));
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='部署记录已导入',{},{timeout:90000});
  await snapshot('wallet-login-balances');
  for(const step of ['deploy-BootcampToken','add-liquidity','dex-purchase','deploy-CoffeeWarehouseReceipt','rwa-mint','rwa-transfer','rwa-burn','deposit-quote','settle-trade','withdraw-base']) {
    await page.goto(`${origin}/web/receipt.html?step=${step}`);
    await page.waitForFunction(()=>window.receiptVerified||document.querySelector('#status').className==='error',{},{timeout:90000});
    if(await page.locator('#status').getAttribute('class')==='error')throw Error('RECEIPT_QUERY_FAILED');
    const verified=await page.evaluate(()=>window.receiptVerified);
    result.verified.push(JSON.parse(JSON.stringify(verified,(_,v)=>typeof v==='bigint'?String(v):v)));
    await snapshot(step);console.log(`PASS Fuji receipt screenshot: ${step}`);
  }
  // Actual official explorer page. No fabricated browser interface or modified screenshot.
  try {
    result.explorer=await captureExplorer(context,report,out);
    result.screenshots.push('rwa-explorer.png');
  }catch{result.explorer='unavailable; capture official explorer manually';}
  fs.writeFileSync(`${out}/screenshots.json`,JSON.stringify(result,(_,v)=>typeof v==='bigint'?String(v):v,2));
  console.log('Fuji screenshots saved; explorer:',result.explorer);
}catch(error){console.error('Fuji screenshots stopped; code=',error.code??error.name);process.exitCode=1;}
finally{if(browser)await browser.close();server?.kill('SIGTERM');provider.destroy();}
