export async function captureExplorer(context, report, output) {
  const page=await context.newPage();
  const url=`https://explorer-test.avax.network/c-chain/address/${report.config.rwa}`;
  try {
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(address=>document.body.innerText.toLowerCase().includes(address.toLowerCase())&&document.body.innerText.includes('Coffee Warehouse Receipt'),report.config.rwa,{timeout:60000});
    const reject=page.getByRole('button',{name:/^(拒绝|Reject|Reject All)$/i});
    if(await reject.count())await reject.first().click();
    // Allow indexed transaction rows to load without changing or fabricating page contents.
    try{await page.waitForFunction(()=>!document.querySelector('[aria-busy="true"]'),{},{timeout:5000});}catch{}
    await page.screenshot({path:`${output}/rwa-explorer.png`,fullPage:true});
    return {status:'captured',source:'Avalanche official testnet explorer',url,screenshot:'rwa-explorer.png'};
  }finally{await page.close();}
}
