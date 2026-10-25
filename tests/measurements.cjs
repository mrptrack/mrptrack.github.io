const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),ctx=vm.createContext({JSON,Date,Number,Set,structuredClone});vm.runInContext(fs.readFileSync(path.join(root,'js/layout-model.js'),'utf8').replace(/^export /gm,'')+';this.api={viewPatch,validMeasurements}',ctx);
const {viewPatch,validMeasurements}=ctx.api,current={holdings:[{ticker:'TEST',shares:10}],cash:50,history:[],gym:[]},entry={date:'2026-01-02',weight:78.5,bf:15};
assert.ok(validMeasurements([entry]));assert.ok(validMeasurements([{...entry,weight:null}]));assert.ok(validMeasurements([{...entry,bf:null}]));
for(const invalid of [{...entry,date:'2026-02-31'},{...entry,weight:'78.5'},{...entry,weight:0},{...entry,bf:100},{...entry,weight:null,bf:null}])assert.equal(validMeasurements([invalid]),false);
assert.equal(validMeasurements([entry,entry]),false);const next=viewPatch(current,{changes:[{field:'gym',before:[],after:[entry]}]}).next;assert.equal(next.gym[0].weight,78.5);assert.equal(current.gym.length,0);assert.equal(JSON.stringify(next.holdings),JSON.stringify(current.holdings));assert.equal(next.cash,50);
assert.throws(()=>viewPatch(next,{changes:[{field:'gym',before:[],after:[entry]}]}),/cambiado/);assert.throws(()=>viewPatch(current,{changes:[{field:'gym',before:[],after:[{...entry,weight:-1}]}]}),/no válidos/);
console.log('PASS: dated weight/body-fat entries, null measurements, invalid values, duplicate dates, concurrent edits and protected financial data.');
