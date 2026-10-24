// Service-worker thumbnail-cache tests. No real network or browser.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const stores=new Map();let calls=0,quota=false;
const ctx=vm.createContext({URL,AbortController,setTimeout,clearTimeout,console,
 self:{location:{href:'https://example.test/sw.js'},addEventListener(){}},
 fetch:async()=>{calls++;return new Response('image',{headers:{'Content-Type':'image/jpeg'}});},
 caches:{open:async name=>{if(!stores.has(name))stores.set(name,new Map());const s=stores.get(name);return{
  match:async req=>s.get(req.url)?.clone(),put:async(req,res)=>{if(quota)throw new Error('Quota');s.set(req.url,res);},keys:async()=>[...s.keys()].map(url=>({url})),delete:async req=>s.delete(req.url)
 };}}});
let code=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8').replace(/^---[\s\S]*?---\s*/,'').replaceAll('{{ site.github.build_revision }}','a'.repeat(40));
vm.runInContext(code+'\nthis.image=artworkImage;',ctx);
(async()=>{
 const req={url:'https://upload.wikimedia.org/wikipedia/en/a/test.jpg'};
 await ctx.image(req);await ctx.image(req);assert.equal(calls,1,'second visit serves saved image without network');
 for(let i=0;i<245;i++)await ctx.image({url:req.url+'?item='+i});
 assert.equal(stores.get('trackmrp-artwork-v1').size,240,'bounded thumbnail cache');
 assert.equal(stores.has('trackmrp-api-'+'a'.repeat(40)),false,'thumbnail storage never touches the API cache');
 quota=true;const res=await ctx.image({url:req.url+'?quota=1'});assert.equal(await res.text(),'image','quota error does not break display');
 assert.ok(code.includes("const CACHE_ARTWORK = 'trackmrp-artwork-v1'"),'cover cache is not tied to deployment revision');
 console.log('PASS: repeat visits avoid image downloads, 240-image bound, separate persistent cache and safe quota fallback');
})().catch(e=>{console.error(e);process.exitCode=1;});
