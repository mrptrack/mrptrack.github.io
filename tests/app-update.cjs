const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..'));
const A='a'.repeat(40),B='b'.repeat(40);
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const built=(source,sha)=>source.replace(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/,'').replaceAll('{{ site.github.build_revision }}',sha);
const code=source=>source.replace(/^import .*;\r?\n/gm,'').replace(/^export \{.*\};\r?\n/gm,'').replace(/^export /gm,'');
function worker(sha,{fail=false,mismatch=false}={}){
  const events={},stores=new Map(),deleted=[],requests=[];
  let skipped=0,claimed=0;
  const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,console,
    self:{location:{href:'https://example.test/sw.js'},addEventListener:(k,f)=>events[k]=f,skipWaiting:async()=>skipped++,clients:{claim:async()=>claimed++}},
    caches:{keys:async()=>[...stores.keys()],delete:async k=>{deleted.push(k);return stores.delete(k);},open:async k=>{
      if(!stores.has(k))stores.set(k,new Map());const store=stores.get(k);
      return {put:async(u,v)=>store.set(typeof u==='string'?u:u.url,v),match:async u=>store.get(typeof u==='string'?u:u.url)};
    }},
    fetch:async(url,options)=>{
      requests.push({url,options});const u=new URL(typeof url==='string'?url:url.url);
      if(fail&&u.pathname==='/js/training.js')return new Response('unavailable',{status:503});
      return new Response(u.pathname==='/'||u.pathname==='/index.html'?built(read('index.html'),mismatch?A:sha):'asset',{status:200});
    }
  });
  vm.runInContext(built(read('sw.js'),sha),ctx);
  const names=vm.runInContext('({CACHE_STATIC,CACHE_API,PRECACHE_URLS})',ctx);
  return {ctx,events,stores,deleted,requests,names,get skipped(){return skipped;},get claimed(){return claimed;},
    async dispatch(type){let pending;events[type]({waitUntil:p=>pending=p});return pending;}};
}
async function swTests(){
  const w=worker(B),prefix=w.names.CACHE_STATIC.split('static-')[0];
  w.stores.set(prefix+'static-'+A,new Map());w.stores.set(prefix+'api-'+A,new Map());w.stores.set('unrelated-cache',new Map());
  await w.dispatch('install');assert.equal(w.skipped,1);assert.equal(w.deleted.length,0);
  for(const {url,options} of w.requests.filter(r=>r.url.startsWith('https://example.test'))){assert.equal(new URL(url).searchParams.get('release'),B);assert.equal(options.cache,'no-store');}
  for(const url of w.names.PRECACHE_URLS.filter(u=>u.startsWith('https://example.test'))){
    const pathname=new URL(url).pathname;assert.ok(fs.existsSync(path.join(root,pathname==='/'?'index.html':pathname)),pathname+' exists');
  }
  await w.dispatch('activate');assert.equal(w.claimed,1);assert.ok(w.stores.has('unrelated-cache'));assert.ok(w.stores.has(w.names.CACHE_STATIC));
  assert.ok(!w.stores.has(prefix+'static-'+A));assert.ok(!w.stores.has(prefix+'api-'+A));
  const n=w.requests.length;await w.ctx.cacheFirst(new Request('https://example.test/js/app.js'));assert.equal(w.requests.length,n,'same release remains cache-first');
  let reply;w.events.message({data:{type:'APP_VERSION'},source:{postMessage:m=>reply=m}});assert.equal(reply.version,B);
  for(const options of [{fail:true},{mismatch:true}]){
    const broken=worker(B,options);broken.stores.set(prefix+'static-'+A,new Map());
    await assert.rejects(broken.dispatch('install'));assert.equal(broken.skipped,0);assert.ok(broken.stores.has(prefix+'static-'+A));assert.ok(!broken.stores.has(broken.names.CACHE_STATIC));
  }
  assert.notEqual(built(read('sw.js'),A),built(read('sw.js'),B),'every published commit changes worker bytes');
}
function page(){
  let now=100000,reloads=0,pendingSave=false,modal=false,editing=false,focused=false,weight='',version=A;
  const timers=new Map(),events={},windowEvents={},swEvents={},session=new Map();let timerID=0,checks=0;
  const sw={controller:{postMessage(){}} ,addEventListener:(k,f)=>swEvents[k]=f,
    register:async(url,options)=>{assert.equal(url,'./sw.js');assert.equal(options.updateViaCache,'none');return {update:async()=>checks++};}};
  const ctx=vm.createContext({console,Date:{now:()=>now},navigator:{serviceWorker:sw,onLine:true},location:{reload:()=>reloads++},
    hasPendingCloudChanges:()=>pendingSave,
    document:{readyState:'complete',visibilityState:'visible',body:{classList:{contains:()=>editing}},activeElement:{matches:()=>focused},
      querySelector:s=>s.startsWith('meta')?{content:version}:s==='#ov.open'?(modal?{}:null):{dataset:{tab:'gym'}},querySelectorAll:()=>[],getElementById:()=>({value:weight}),addEventListener:(k,f)=>events[k]=f},
    window:{addEventListener:(k,f)=>windowEvents[k]=f},
    sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
    localStorage:new Proxy({},{get(){throw Error('Updater must not touch localStorage');}}),
    setTimeout:f=>{timers.set(++timerID,f);return timerID;},clearTimeout:id=>timers.delete(id),setInterval:f=>{events.interval=f;}
  });
  vm.runInContext(code(read('js/app-update.js')),ctx);
  return {ctx,events,session,sw,get reloads(){return reloads;},get checks(){return checks;},
    setBlocked(reason,value){({save:v=>pendingSave=v,modal:v=>modal=v,editing:v=>editing=v,focus:v=>focused=v,weight:v=>weight=v})[reason](value);},
    message(v,source=sw.controller){swEvents.message({source,data:{type:'APP_VERSION',version:v}});},
    tick(){now+=6000;const tasks=[...timers.values()];timers.clear();tasks.forEach(f=>f());},
    advance(){now+=61000;}};
}
async function pageTests(){
  const p=page();await Promise.resolve();await Promise.resolve();p.tick();p.message(A);assert.equal(p.reloads,0);
  p.advance();await p.events.interval();p.message(A);assert.equal(p.reloads,0,'checking unchanged deployment never reloads');
  for(const reason of ['save','modal','editing','focus','weight']){
    const q=page();q.setBlocked(reason,reason==='weight'?'80':true);q.tick();q.message(B);q.tick();assert.equal(q.reloads,0,reason+' prevents reload');
    q.setBlocked(reason,reason==='weight'?'':false);q.tick();assert.equal(q.reloads,1);q.message(B);q.tick();assert.equal(q.reloads,1,'reload once only');assert.equal(q.session.get('app-update-tab'),'gym');
  }
  const hidden=page();hidden.ctx.document.visibilityState='hidden';hidden.message(B);hidden.tick();assert.equal(hidden.reloads,0);hidden.ctx.document.visibilityState='visible';hidden.tick();assert.equal(hidden.reloads,1);
  const offline=page();offline.ctx.navigator.onLine=false;offline.message(B);offline.tick();assert.equal(offline.reloads,0);
  const recent=page();recent.message(B);assert.equal(recent.reloads,0);recent.tick();assert.equal(recent.reloads,1);
  const spoof=page();spoof.tick();spoof.message(B,{});spoof.message('invalid');assert.equal(spoof.reloads,0);
}
async function saveTests(){
  const ctx=vm.createContext({console,updateSyncStatus(){}});vm.runInContext(code(read('js/cloud.js')),ctx);
  let resolve;ctx._saveToGAS=()=>new Promise(r=>resolve=r);
  const first=ctx.pushDataToCloud();assert.equal(ctx.hasPendingCloudChanges(),true);resolve(false);await first;assert.equal(ctx.hasPendingCloudChanges(),true);
  const second=ctx.pushDataToCloud();resolve(true);await second;assert.equal(ctx.hasPendingCloudChanges(),false);
  const pending=[];ctx._saveToGAS=()=>new Promise(r=>pending.push(r));
  const a=ctx.pushDataToCloud(),b=ctx.pushDataToCloud();pending[1](false);await b;pending[0](true);await a;
  assert.equal(ctx.hasPendingCloudChanges(),true,'older success cannot dismiss a newer failed save');
}
(async()=>{await swTests();await pageTests();await saveTests();console.log('PASS: per-commit version, complete install, selective cache renewal, offline rollback, same-version no-op, safe one-time reload, editing/sync guards, session preservation — '+root);})().catch(e=>{console.error(e);process.exitCode=1;});
