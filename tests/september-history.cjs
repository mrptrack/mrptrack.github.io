const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,'js',file),'utf8');
const code=file=>read(file).replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\};\r?\n/gm,'').replace(/^export /gm,'');
const values=new Map();
const D={};
const context=vm.createContext({D,console,Event,locale:()=> 'es-ES',document:{dispatchEvent(){}},
 localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)},
 FALLBACK:{holdings:[],closedTrades:[],history:[],gym:[],books:[],movies:[],series:[],watchlist:[],cash:0,totalInvested:0},
 lifeDefaults:()=>({}),isFallbackState:()=>false});
vm.runInContext(code('storage.js')+'\n'+code('utils.js'),context);
const original=[{date:'2026-09-22',totalInvested:0,totalValue:1802.01,note:'keep'},
 {date:'2026-09-23',totalInvested:2180,totalValue:1870},
 {date:'2026-09-30',totalInvested:2180,totalValue:1980.66},
 {date:'2026-10-14',totalInvested:2180,totalValue:2004.55}];
const repaired=context.repairHistory(original);
assert.equal(original[0].totalInvested,0,'never mutate source or backup');
assert.equal(repaired[0].totalInvested,2180);assert.equal(repaired[0].totalValue,1802.01);assert.equal(repaired[0].note,'keep');
assert.strictEqual(context.repairHistory(repaired),repaired,'idempotent');
const unrelated=[{date:'2026-09-21',totalInvested:0,totalValue:0},{date:'2026-09-22',totalInvested:2200,totalValue:1802}];
assert.strictEqual(context.repairHistory(unrelated),unrelated,'no blanket zero replacement or overwrite of later edits');
const payload={history:original,holdings:[],cash:0,totalInvested:2180,books:[{title:'preserve'}]};
assert.equal(context.loadDataFromObj(payload),true);
assert.equal(D.history[0].totalInvested,2180);
assert.equal(JSON.parse(values.get('trackmrp_history_2026-09-22_before_fix')).totalInvested,0);
assert.equal(context.buildDataObj().books[0].title,'preserve');
assert.equal(context.loadDataFromObj({...payload,history:repaired},true),false);
const months=context.monthlyReturns(repaired),sep=months.find(m=>m.key==='2026-09'),oct=months.find(m=>m.key==='2026-10');
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
assert.equal(sep.start,2180);close(sep.pnl,-199.34);close(sep.ret,(1980.66/2180-1)*100);close(sep.twr,sep.ret);
close(oct.pnl,23.89);close(oct.ret,(2004.55/1980.66-1)*100);
assert.equal(context.monthlyReturns([]).length,0);
close(context.monthlyReturns([repaired[0]])[0].ret,(1802.01/2180-1)*100);
const withDeposit=[repaired[0],{date:'2026-09-30',totalInvested:2280,totalValue:2080.66}];
close(context.monthlyReturns(withDeposit)[0].pnl,-199.34);
close(context.monthlyReturns(withDeposit)[0].ret,sep.ret,'deposits are not profit');

// Exercise the real sector chart with mixed standard and custom sector names.
const charts=[];
const analytics=code('analytics.js');
const a=vm.createContext({D:{holdings:[{sector:'Technology',value:10},{sector:'Consumo cíclico',value:20},{sector:'Comunicación',value:30}]},
 document:{getElementById:()=>({getContext:()=>({})})},valEur:h=>h.value,Chart:class{constructor(ctx,config){charts.push(config);}},
 legOpts:{},ttOpts:{},centerTextPlugin:{},F:String});
vm.runInContext(analytics,a);
a._renderSectorChart();
const chart=charts[0];assert.equal(new Set(chart.data.datasets[0].backgroundColor).size,3);
const labels=['Technology','Consumo cíclico','Comunicación','Other'],colors=a.sectorColors(labels),reordered=a.sectorColors([...labels].reverse());
assert.equal(new Set(colors).size,labels.length);
labels.forEach((label,i)=>assert.equal(colors[i],reordered[labels.length-1-i],'stable when holdings reorder'));
assert.equal(new Set(a.sectorColors(Array.from({length:20},(_,i)=>'Custom '+i))).size,20);

// The corrected cloud load must persist once, after reading the whole JSON.
(async()=>{
 const events=[];
 const c=vm.createContext({console,AbortController,setTimeout,clearTimeout,PROXY_URL:'https://example.invalid',getSessionToken:()=> 'test',
  fetch:async()=>({ok:true,text:async()=>JSON.stringify(payload)}),
  loadDataFromObj:()=>{events.push('load');return true;},saveLocal:()=>events.push('local'),updateSyncStatus(){},isFallbackState:()=>false});
 vm.runInContext(code('cloud.js'),c);
 c.pushDataToCloud=async()=>events.push('save');
 await c.fetchDataFromCloud();assert.deepEqual(events,['load','local','save']);
 c.loadDataFromObj=()=>false;events.length=0;await c.fetchDataFromCloud();assert.deepEqual(events,['local'],'no extra write after the correction is already stored');
 console.log('PASS: 22 September targeted repair/backup, September -199.34 EUR / -9.14%, October unchanged, deposits excluded, distinct sector colours, cloud persistence');
 process.exit(0); // production GET abort timers are deliberately not relevant to this check.
})().catch(e=>{console.error(e);process.exit(1);});
