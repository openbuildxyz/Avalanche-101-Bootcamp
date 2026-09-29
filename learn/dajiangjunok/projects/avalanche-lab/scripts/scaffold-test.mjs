import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { chromium } from 'playwright-core';

const root=process.cwd(), scaffold=path.join(root,'scaffold-eth-2'), output=path.join(root,'../../public/evidence/scaffold-local');
fs.mkdirSync(output,{recursive:true});
for(const url of ['http://127.0.0.1:8545','http://127.0.0.1:3000']) {
  try { await fetch(url,{signal:AbortSignal.timeout(500)}); throw Error(`Port occupied: ${url}`); }
  catch(e) { if(e.message.startsWith('Port occupied')) throw e; }
}
const processes=[]; let browser, startupError;
const env={...process.env,HUSKY:'0',NEXT_TELEMETRY_DISABLED:'1',NEXT_PUBLIC_LOCAL_TEST:'true',
  NODE_OPTIONS:[process.env.NODE_OPTIONS??'','--no-experimental-webstorage'].join(' ').trim()};
function start(command,args,options) { const p=spawn(command,args,options);p.on('error',e=>{startupError=e;});processes.push(p);return p; }
async function ready(url,limit=60) {
  for(let i=0;i<limit;i++) {
    if(startupError) throw startupError;
    if(processes.some(p=>p.exitCode!==null)) throw Error('Local service exited unexpectedly');
    try {
      const options = url.endsWith(':8545')
        ? {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})}
        : {};
      if((await fetch(url,{...options,signal:AbortSignal.timeout(2000)})).ok) return;
    } catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  throw Error(`Service not ready: ${url}`);
}
try {
  start('anvil',['--host','127.0.0.1','--port','8545','--chain-id','31337','--silent'],{stdio:'ignore'});
  await ready('http://127.0.0.1:8545');
  const deploy=spawnSync(process.execPath,['.yarn/releases/yarn-3.2.3.cjs','deploy','--network','localhost','--tags','BootcampToken','--reset'],{cwd:scaffold,env,encoding:'utf8',timeout:120000});
  fs.writeFileSync(path.join(output,'deployment.txt'),'LOCAL ANVIL 31337 — NOT FUJI\n'+deploy.stdout+deploy.stderr);
  if(deploy.status!==0) throw Error('Scaffold-ETH local deployment failed: '+deploy.stdout+deploy.stderr);
  console.log('PASS Scaffold-ETH local deployment and generated ABI');
  const nextLog=fs.openSync('/private/tmp/dajiangjunok-scaffold-next.log','w');
  start(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'],{cwd:path.join(scaffold,'packages/nextjs'),env,stdio:['ignore',nextLog,nextLog]});
  await ready('http://127.0.0.1:3000',90);
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage({viewport:{width:1360,height:1000}});
  await page.goto('http://127.0.0.1:3000');
  await page.getByRole('heading',{name:'My first Avalanche ERC-20'}).waitFor();
  await page.screenshot({path:path.join(output,'home-local.png'),fullPage:true});
  await page.getByRole('link',{name:'Open Debug Contracts'}).click();
  await page.getByText('BootcampToken',{exact:true}).first().waitFor({timeout:60000});
  await page.getByText('"DJJ"',{exact:true}).first().waitFor({timeout:60000});
  await page.screenshot({path:path.join(output,'debug-contracts-local.png'),fullPage:true});
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({chainId:31337,network:'LOCAL ANVIL ONLY — NOT FUJI',revision:'208fbd6103f905ec2c9d4451d735c0883a0f2d9f',checks:['Scaffold-ETH Hardhat deployment','generated TypeScript ABI','Next.js home rendered','Debug Contracts shows BootcampToken'],generatedAt:new Date().toISOString()},null,2));
  console.log('PASS Scaffold-ETH home and Debug Contracts rendered');
} finally { if(browser)await browser.close(); processes.forEach(p=>p.kill('SIGTERM')); }
