// Deterministic network/cache behavior: no remote calls or real user data.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function fixture(fetcher){
  const storage=new Map([['db_data','DO NOT CHANGE'],['track_session','DO NOT CHANGE']]),calls=[];
  let time=Date.now();
  const ctx=vm.createContext({URL,URLSearchParams,AbortController,console,setTimeout,clearTimeout,
    Date:{now:()=>time+=2000},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
    esc:x=>x,t:x=>x,fetch:async(url,options)=>{calls.push({url,options});return fetcher(url,options);}});
  vm.runInContext(read('artwork-model.js')+'\n'+read('artwork.js')+'\nthis.M={resolveArtwork,cachedArtwork,searchArtwork};',ctx);
  return {M:ctx.M,storage,calls};
}
const page={title:'Example (2020 film)',fullurl:'https://en.wikipedia.org/wiki/Example',description:'2020 film',thumbnail:{source:'https://upload.wikimedia.org/wikipedia/en/a/ab/Example.jpg?utm_source=api',width:300,height:450}};
(async()=>{
  const f=fixture(()=>({ok:true,json:async()=>({query:{pages:[page]}})}));
  const item={title:'Example',year:2020,opinion:'Never send this',myRating:8};
  const before=JSON.stringify(item);
  const [a,b]=await Promise.all([f.M.resolveArtwork('movie',item),f.M.resolveArtwork('movie',item)]);
  assert.equal(a.url,b.url);assert.equal(f.calls.length,1,'deduplicate concurrent lookups');
  assert.equal((await f.M.resolveArtwork('movie',item)).url,a.url);assert.equal(f.calls.length,1,'cache hit makes no request');
  assert.equal(JSON.stringify(item),before,'automatic lookup never mutates dashboard records');
  assert.equal(f.storage.get('db_data'),'DO NOT CHANGE');assert.equal(f.storage.get('track_session'),'DO NOT CHANGE');
  assert.ok(!JSON.stringify(f.calls).includes('Never send this'));assert.ok(!f.calls[0].url.includes('myRating'));
  assert.equal(f.calls[0].options.credentials,'omit');assert.equal(f.calls[0].options.referrerPolicy,'no-referrer');
  const off={...item,artwork:false};assert.equal(await f.M.resolveArtwork('movie',off),null);assert.equal(f.calls.length,1);
  const manual={provider:'wikipedia',title:'Pinned',url:page.thumbnail.source,sourceUrl:page.fullurl,year:2020};
  assert.equal((await f.M.resolveArtwork('movie',{...item,artwork:manual})).title,'Pinned');assert.equal(f.calls.length,1);
  const empty=fixture(()=>({ok:true,json:async()=>({query:{pages:[]}})}));
  assert.equal(await empty.M.resolveArtwork('movie',item),null);const n=empty.calls.length;
  assert.equal(await empty.M.resolveArtwork('movie',item),null);assert.equal(empty.calls.length,n,'cache missing artwork for one day');
  const down=fixture(()=>({ok:false,status:429}));
  await assert.rejects(()=>down.M.resolveArtwork('movie',item));assert.equal(down.M.cachedArtwork('movie',item),undefined,'temporary errors are retryable, not saved as a permanent miss');
  console.log('PASS: deduplication, cache, failures/429, no-match TTL, explicit opt-out/pinned cover, no record mutation, no tokens/opinions transmitted');
})().catch(e=>{console.error(e);process.exitCode=1;});
