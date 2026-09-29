import './sync-scaffold-fuji.mjs';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';
const out='../../public/evidence/fuji';
const report=JSON.parse(fs.readFileSync(`${out}/deployment.json`));
const origin='http://127.0.0.1:3000';
try{await fetch(origin,{signal:AbortSignal.timeout(500)});throw Error('PORT_OCCUPIED');}catch(e){if(e.message==='PORT_OCCUPIED')throw e;}
const fd=fs.openSync('/private/tmp/dajiangjunok-scaffold-fuji-next.log','w');
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'],{
  cwd:'scaffold-eth-2/packages/nextjs',stdio:['ignore',fd,fd],env:{...process.env,NEXT_PUBLIC_LOCAL_TEST:'false',NEXT_TELEMETRY_DISABLED:'1',NODE_OPTIONS:'--no-experimental-webstorage'}
});
let browser;
try{
  for(let i=0;i<80;i++){
    if(server.exitCode!==null)throw Error('NEXT_SERVER_EXITED');
    try{if((await fetch(origin,{signal:AbortSignal.timeout(2000)})).ok)break;}catch{}
    await new Promise(r=>setTimeout(r,1000));
  }
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH??'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
  const page=await browser.newPage({viewport:{width:1360,height:1000}});
  await page.goto(`${origin}/debug`,{waitUntil:'domcontentloaded',timeout:90000});
  await page.getByText('"DJJ"',{exact:true}).first().waitFor({timeout:90000});
  await page.getByText('Avalanche Fuji',{exact:true}).first().waitFor({timeout:30000});
  await page.screenshot({path:`${out}/scaffold-eth-fuji.png`,fullPage:true});
  fs.writeFileSync(`${out}/scaffold-result.json`,JSON.stringify({chainId:43113,address:report.config.token,checks:['Scaffold-ETH Debug Contracts connected to Avalanche Fuji','Live contract symbol DJJ displayed'],screenshot:'scaffold-eth-fuji.png'},null,2));
  console.log('PASS Scaffold-ETH Fuji contract read screenshot');
}finally{if(browser)await browser.close();server.kill('SIGTERM');}
