// Deterministic offline checks for the production refresh functions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,'js',name),'utf8');
const source=read('portfolio.js').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const elements={dot:{style:{}},ts:{textContent:''}};
const memory=new Map(), calls=[];
let saves=0,behaviour;
class Monday extends Date {constructor(...args){super(...(args.length?args:['2026-10-05T12:00:00Z']));}}
const ctx=vm.createContext({
  D:{holdings:[{ticker:'TEST',shares:2,currency:'EUR'}],cash:0,totalInvested:100,closedTrades:[],history:[]},
  _cloudReady:false,PROXY_URL:'https://example.invalid/exec',_authed:true,
  document:{addEventListener(){},getElementById:id=>elements[id]},
  localStorage:{getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},
  AbortController,Date:Monday,locale:()=> 'en-GB',console:{warn(){}},
  setTimeout:fn=>setTimeout(fn,5),clearTimeout,
  saveAndSync:()=>{saves++;},
  fetch:(url,opts)=>{calls.push(url);return behaviour(url,opts);}
});
vm.runInContext(source,ctx);
ctx.renderPortfolio=()=>{};ctx.rSkeletons=()=>{};ctx.renderHistory=()=>{};
const rates={rates:{USD:1.1,CAD:1.5,GBP:.8,JPY:160}};
const response=data=>({ok:true,json:async()=>data});
const quote=price=>({chart:{result:[{meta:{regularMarketPrice:price,previousClose:10,currency:'EUR'},indicators:{quote:[{close:[price]}]},timestamp:[]}]}});
const hanging=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
const normal=url=>Promise.resolve(response(url.includes('latest/EUR')?rates:url.includes('v8')?quote(12):{}));
(async()=>{
  behaviour=normal;
  await ctx.refreshPortfolio();
  assert.equal(ctx.getPriceData('TEST').price,12);
  assert.equal(saves,0,'no automatic cloud write before successful cloud read');
  assert.equal(ctx.D.history.length,0);
  assert.ok(!elements.ts.textContent.includes('Parcial'));
  assert.equal(ctx.fxR('CAD'),1/1.5);
  assert.ok(!calls.some(url=>url.includes('USDEUR')),'do not query rejected Yahoo FX endpoint');
  assert.ok(calls[0].includes('latest/EUR')&&calls[1].includes('v8'),'start FX and quotes concurrently');

  ctx._cloudReady=true;await ctx.refreshPortfolio();
  assert.equal(saves,1);assert.equal(ctx.D.history[0].totalValue,24);
  const history=JSON.stringify(ctx.D.history);
  behaviour=(url,opts)=>url.includes('v8')?hanging(url,opts):normal(url);
  await ctx.refreshPortfolio();
  assert.equal(ctx.getPriceData('TEST').price,12,'keep cached quote on timeout');
  assert.equal(ctx.getPriceData('TEST')._stale,true);
  assert.match(elements.ts.textContent,/Parcial/);
  assert.equal(JSON.stringify(ctx.D.history),history);
  assert.equal(saves,1);

  behaviour=(url,opts)=>url.includes('latest/EUR')?hanging(url,opts):normal(url);
  await ctx.refreshPortfolio();
  assert.match(elements.ts.textContent,/Parcial/);
  assert.equal(ctx.fxR('CAD'),1/1.5,'keep previous FX on source failure');
  assert.equal(saves,1,'no snapshot using fallback FX');
  behaviour=url=>Promise.resolve(response(url.includes('latest/EUR')?rates:quote(null)));
  await ctx.refreshPortfolio();assert.equal(ctx.getPriceData('TEST').price,12);

  behaviour=normal;ctx.renderPortfolio=()=>{throw new Error('render failed');};
  await ctx.refreshPortfolio();assert.match(elements.ts.textContent,/Parcial/);
  ctx.renderPortfolio=()=>{};await ctx.refreshPortfolio();
  assert.ok(!elements.ts.textContent.includes('Parcial'),'refresh lock released even after rendering error');
  behaviour=(url,{signal})=>Promise.resolve({ok:true,json:()=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('body timeout')),{once:true}))});
  await assert.rejects(ctx.fetchJson('https://example.invalid/slow-body'));
  behaviour=hanging;
  const pending=ctx.refreshPortfolio(),before=calls.length;
  await ctx.refreshPortfolio();assert.equal(calls.length,before,'no overlapping refresh');await pending;

  let resolveCloud,refreshes=0,renders=0;
  const cloud=new Promise(r=>resolveCloud=r);
  const auth=vm.createContext({renderAll:()=>renders++,renderCalculator(){},fetchDataFromCloud:()=>cloud,updateSyncStatus(){},refreshPortfolio:()=>refreshes++,setInterval:()=>1});
  const app=read('app.js'),start=app.indexOf('async function _postAuthInit()'),end=app.indexOf('// ── Handlers de Google Sign-In',start);
  vm.runInContext('let _rfInterval=null;\n'+app.slice(start,end),auth);
  const loading=auth._postAuthInit();await Promise.resolve();
  assert.equal(refreshes,0);assert.equal(renders,1);
  resolveCloud(true);await loading;
  assert.equal(renders,2);assert.equal(refreshes,1,'render cloud result before starting price refresh');
  console.log('PASS: bounded requests/body, parallel FX/quotes, cache retention, accurate partial state, no unsafe snapshot, lock recovery, cloud ordering');
})().catch(error=>{console.error(error);process.exitCode=1;});
