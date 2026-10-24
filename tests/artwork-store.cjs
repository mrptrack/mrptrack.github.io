// Offline tests for private artwork persistence. Never connects to Drive.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=f=>fs.readFileSync(path.join(root,'js',f),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
let local=0,cloud=0,editing=false,busy=false;
const item={title:'Example',year:2020,myRating:9,opinion:'Intacta'},D={movies:[item],books:[],series:[],games:[],cash:50,totalInvested:1000,holdings:[{ticker:'TEST',shares:5}],history:[{date:'2026-01-01',totalInvested:10,totalValue:20}]};
const ctx=vm.createContext({D,URL,Date,console,_authed:true,_cloudReady:false,isFallbackState:()=>false,hasPendingCloudChanges:()=>busy,
  saveLocal:()=>local++,saveAndSync:async()=>{cloud++;return true;},setTimeout:()=>1,
  document:{body:{classList:{contains:()=>editing}},getElementById:()=>({classList:{contains:()=>false}})}});
vm.runInContext(source('artwork-model.js')+'\n'+source('artwork-store.js')+'\nthis.M={persistArtwork,flushArtwork,artworkKey};',ctx);
const art={provider:'wikipedia',title:'Example',year:2020,url:'https://upload.wikimedia.org/wikipedia/en/a/ab/Example.jpg',sourceUrl:'https://en.wikipedia.org/wiki/Example'};
(async()=>{
 const before=JSON.stringify({...D,movies:undefined});
 ctx.M.persistArtwork('movie',item,art);assert.equal(item.artwork,undefined,'never write before cloud readiness');
 ctx._cloudReady=true;ctx.M.persistArtwork('movie',item,art);assert.equal(item.artwork.automatic,true);assert.equal(item.artwork.lookupKey,ctx.M.artworkKey('movie',item));assert.equal(local,1);
 assert.equal(JSON.stringify({...D,movies:undefined}),before,'cash, shares, history and contributions are unchanged');assert.equal(item.opinion,'Intacta');
 editing=true;await ctx.M.flushArtwork();assert.equal(cloud,0,'defer during editing');editing=false;busy=true;await ctx.M.flushArtwork();assert.equal(cloud,0,'defer during normal cloud writes');
 busy=false;await ctx.M.flushArtwork();assert.equal(cloud,1);await ctx.M.flushArtwork();assert.equal(cloud,1,'successful batch is cleared');
 ctx.M.persistArtwork('movie',item,art);await ctx.M.flushArtwork();assert.equal(cloud,1,'already stored cover needs no save');
 item.artwork=false;ctx.M.persistArtwork('movie',item,art);assert.equal(item.artwork,false,'respect opt-out');
 item.artwork={...art,title:'Manual'};ctx.M.persistArtwork('movie',item,{...art,title:'Auto'});assert.equal(item.artwork.title,'Manual');
 D.movies.push({...item});item.artwork=undefined;ctx.M.persistArtwork('movie',item,art);assert.equal(item.artwork,undefined,'do not guess between duplicate records');
 const library=fs.readFileSync(path.join(root,'js/library.js'),'utf8');
 assert.ok(library.includes("?'Vista':'Pendiente'"));assert.ok(library.includes("?'Leído':'Pendiente'"));
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.ok(!/library-kicker|library-count/.test(html),'decorative labels are removed, not just hidden');
 console.log('PASS: authenticated cloud guard, local persistence, deferred batched sync, no financial changes, manual/opt-out/duplicate safety and singular statuses');
})().catch(e=>{console.error(e);process.exitCode=1;});
