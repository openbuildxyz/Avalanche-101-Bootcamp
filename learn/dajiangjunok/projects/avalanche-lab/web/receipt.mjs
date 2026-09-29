import {BrowserProvider,JsonRpcProvider,Contract,Interface,formatUnits} from '/ethers.js';
const $=id=>document.getElementById(id);
const put=(id,data)=>$(id).replaceChildren(...Object.entries(data).flatMap(([k,v])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=String(v);return[dt,dd];}));
const provider=window.ethereum?new BrowserProvider(window.ethereum):new JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
try {
  if((await provider.getNetwork()).chainId!==43113n)throw Error('网络不是 Fuji 43113');
  const report=await(await fetch('/fuji/deployment.json')).json();
  const step=new URLSearchParams(location.search).get('step')??'deploy-BootcampToken';
  const record=report.steps[step]; if(!record)throw Error('找不到该交易记录');
  const receipt=await provider.getTransactionReceipt(record.hash);
  if(!receipt||receipt.status!==1)throw Error('交易未成功确认');
  const tx=await provider.getTransaction(record.hash),block=await provider.getBlock(receipt.blockNumber);
  const {config,accounts}=report;
  const specs={token:'BootcampToken',quote:'MockUSDC',pair:'LearningPair',rwa:'CoffeeWarehouseReceipt',base:'BaseAsset',dex:'MiniExchange'};
  const contracts={},interfaces={};
  for(const [key,name]of Object.entries(specs)) {
    if(!config[key])continue;
    const {abi}=await(await fetch(`/artifacts/${name}.json`)).json();
    contracts[key]=new Contract(config[key],abi,provider);interfaces[config[key].toLowerCase()]=new Interface(abi);
  }
  const isRwa=step.startsWith('rwa-')||step==='deploy-CoffeeWarehouseReceipt';
  const isDex=['deposit-base','deposit-quote','settle-trade','withdraw-base','withdraw-quote','deploy-MiniExchange'].includes(step);
  const isPair=['add-liquidity','dex-purchase'].includes(step);
  const labels={'deploy-BootcampToken':'Task2 · ERC-20 部署','add-liquidity':'Task3 · 创建交易对与添加流动性','dex-purchase':'Task3 · 使用 DEX 价格买入','deploy-CoffeeWarehouseReceipt':'Task5 · 咖啡仓单部署','rwa-mint':'Task5 · 发行 100 CWR','rwa-transfer':'Task5 · 转账 30 CWR','rwa-burn':'Task5 · 销毁 10 CWR','settle-trade':'Task7 · 两地址签名成交','deposit-quote':'Task7 · 存入 1,000 mUSD','withdraw-base':'Task7 · 提取 10 BASE'};
  $('title').textContent=labels[step]??step;
  const info=isRwa?{CWR:config.rwa}:isDex?{BASE:config.base,mUSD:config.dexQuote,MiniExchange:config.dex}:isPair?{DJJ:config.token,mUSD:config.quote,Pair:config.pair}:{DJJ:config.token};
  put('contracts',{...info,'部署 / 卖方账户':accounts.deployer,'买方账户':accounts.buyer});
  put('transaction',{'交易哈希':receipt.hash,'状态':'Success · status = 1','区块':receipt.blockNumber,'区块时间 UTC':new Date(block.timestamp*1000).toISOString(),'发送者':tx.from,'接收 / 新合约':tx.to??receipt.contractAddress,'实际手续费 AVAX':formatUnits(receipt.fee,18)});
  $('explorer').href=`https://testnet.snowtrace.io/tx/${receipt.hash}`;
  const at={blockTag:receipt.blockNumber},state={};
  if(isRwa) {
    Object.assign(state,{'Token':'Coffee Warehouse Receipt / CWR','精度':await contracts.rwa.decimals(),'供应量 CWR':await contracts.rwa.totalSupply(at),'部署者 CWR':await contracts.rwa.balanceOf(accounts.deployer,at),'买方 CWR':await contracts.rwa.balanceOf(accounts.buyer,at),'资产证明':await contracts.rwa.assetDocument(at)});
  } else if(isDex) {
    Object.assign(state,{'卖方交易所 BASE':await contracts.dex.balances(accounts.deployer,config.base,at),'卖方交易所 mUSD':formatUnits(await contracts.dex.balances(accounts.deployer,config.dexQuote,at),6),'买方交易所 BASE':await contracts.dex.balances(accounts.buyer,config.base,at),'买方交易所 mUSD':formatUnits(await contracts.dex.balances(accounts.buyer,config.dexQuote,at),6),'买方钱包 BASE':await contracts.base.balanceOf(accounts.buyer,at)});
  } else if(isPair) {
    Object.assign(state,{'池内 DJJ':formatUnits(await contracts.pair.reserve0(at),18),'池内 mUSD':formatUnits(await contracts.pair.reserve1(at),6),'买方 DJJ':formatUnits(await contracts.token.balanceOf(accounts.buyer,at),18),'支付 100 mUSD 的链上报价 DJJ':formatUnits(await contracts.token.quotePurchase(100_000_000n,at),18)});
  } else Object.assign(state,{'名称':await contracts.token.name(),'符号':await contracts.token.symbol(),'decimals':await contracts.token.decimals(),'总供应 DJJ':formatUnits(await contracts.token.totalSupply(at),18),'部署账户 DJJ':formatUnits(await contracts.token.balanceOf(accounts.deployer,at),18)});
  put('state',state);
  const events=[];
  for(const log of receipt.logs) {
    const iface=interfaces[log.address.toLowerCase()];if(!iface)continue;
    try {const parsed=iface.parseLog(log);if(parsed)events.push({contract:log.address,event:parsed.name,args:Object.fromEntries(parsed.fragment.inputs.map((input,i)=>[input.name||String(i),String(parsed.args[i])]))});}catch{}
  }
  $('events').textContent=JSON.stringify(events,null,2);
  $('status').textContent=`核验成功 · Fuji 43113 · 区块 ${receipt.blockNumber} · 交易成功`;
  window.receiptVerified={step,hash:receipt.hash,chainId:43113,blockNumber:receipt.blockNumber,state,events};
}catch(e){$('status').textContent=e.shortMessage??e.message;$('status').className='error';}
