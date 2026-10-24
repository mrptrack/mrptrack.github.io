// Link the entire app without executing it: catches missing exports and cycles.
// Requires: node --experimental-vm-modules tests/media-modules.cjs
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),context=vm.createContext({}),modules=new Map();
for(const name of fs.readdirSync(path.join(root,'js')).filter(n=>n.endsWith('.js'))){
 const file=path.join(root,'js',name);modules.set(file,new vm.SourceTextModule(fs.readFileSync(file,'utf8'),{context,identifier:file}));
}
(async()=>{
 await modules.get(path.join(root,'js/app.js')).link((specifier,ref)=>{
  assert.ok(specifier.startsWith('./'),'no external module execution');
  const resolved=path.resolve(path.dirname(ref.identifier),specifier),module=modules.get(resolved);
  assert.ok(module,'missing module '+specifier);return module;
 });
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.ok(html.includes('<title>Track MRP</title>'));assert.ok(html.includes('icons/logo.png'));
 assert.ok(!html.includes('brokerOverview'));assert.ok(!html.includes('library-kicker'));assert.ok(!html.includes('library-count'));
 for(const name of ['artwork.js','artwork-store.js','artwork-model.js','library.js','media.js','games.js'])assert.ok(!fs.readFileSync(path.join(root,'js',name),'utf8').includes('broker-model'));
 assert.ok(!fs.existsSync(path.join(root,'js/brokers.js')),'broker feature was not transferred');
 console.log('PASS: app module graph, existing cloud exports, MRP branding, all media modules and no broker transfer');
})().catch(e=>{console.error(e);process.exitCode=1;});
