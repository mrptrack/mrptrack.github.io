// Offline regression tests: no browser, credentials, or remote writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const D = {preferences:{language:'es',theme:'dark'},workouts:[],activities:[]};
const context = vm.createContext({D, _authed:true, structuredClone, console});
function source(file) {
  return fs.readFileSync(path.join(root,'js',file),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
}
vm.runInContext(source('life-schema.js')+'\n'+source('i18n.js')+'\n'+source('training.js'),context);
const {validateLife,trainingStats,muscleSets,lifeDefaults,t} = vm.runInContext('({validateLife,trainingStats,muscleSets,lifeDefaults,t})',context);
const legacy={id:'legacy',date:'2026-01-05',mode:'gym',muscles:['chest','lowerBack']};
const session={...legacy,id:'new',sets:{chest:12,lowerBack:4}};
const clean=v=>JSON.parse(JSON.stringify(v));
assert.deepEqual(clean(validateLife({workouts:[legacy,session]})),[]);
assert.deepEqual(clean(lifeDefaults({workouts:[legacy,session]}).workouts),[legacy,session]);
assert.equal(muscleSets(legacy,'chest'),null);
let stats=trainingStats([legacy,session],'2026-01-06');
assert.equal(stats.muscles.find(m=>m.id==='chest').n,12);
assert.equal(stats.muscles.find(m=>m.id==='lowerBack').n,4);
assert.equal(stats.days,1);
assert.equal(stats.thisWeek,1);
assert.equal(stats.activeWeeks,1);
assert.equal(stats.uncountedSessions,1);
assert.equal(trainingStats([legacy],'2026-01-06').muscles[0].n,0);
const other={...session,id:'second',sets:{chest:3,lowerBack:2}};
stats=trainingStats([session,other,{...session,date:'2025-01-01'},{...session,date:'2026-01-07'}],'2026-01-06');
assert.equal(stats.muscles[0].n,15,'sum same-day sessions; exclude old/future volume');
assert.equal(stats.muscles.find(m=>m.id==='lowerBack').n,6);
assert.equal(stats.uncountedSessions,0);
for(const n of [0,-1,1.5,'12',null,NaN,Infinity,1000]) {
  assert.ok(validateLife({workouts:[{...session,sets:{chest:n}}]}).includes('Invalid set counts'));
}
for(const sets of [null,[],12,{arms:3},{back:3}]) {
  assert.ok(validateLife({workouts:[{...session,sets}]}).includes('Invalid set counts'));
}
assert.ok(validateLife({workouts:[{...session,muscles:{},sets:{chest:1}}]}).length);
assert.equal(validateLife({workouts:[{...legacy,sets:{}}]}).length,0);
assert.equal(validateLife({workouts:[{...session,sets:{chest:999}}]}).length,0);
assert.equal(validateLife({workouts:[{id:'run',date:legacy.date,mode:'activity',activityId:'treadmill',muscles:[],sets:{}}]}).length,0);
assert.equal(t('Sets'),'Series realizadas');
assert.equal(t('Series'),'Series','media section must remain untouched');
D.preferences.language='en';
assert.equal(t('Series realizadas'),'Sets');
assert.equal(t('Series'),'Series');

// Exercise the actual form submit handler using minimal DOM doubles.
const elements={},checkboxes=[{value:'chest',checked:true},{value:'lowerBack',checked:true}];
function element(){return {value:'',style:{},classList:{add(){},remove(){}},parentElement:{},focus(){},querySelectorAll(){return [];}};}
context.document={getElementById(id){if(id==='trainingDashboard')return null;return elements[id]??=element();}};
context.crypto={randomUUID:()=> 'created'};
let saves=0;context.saveAndSync=()=>saves++;
context.confirm=()=>true;
elements.workoutForm=element();
elements.workoutForm.querySelectorAll=selector=>selector.includes(':checked')?checkboxes.filter(x=>x.checked):checkboxes;
D.workouts=[structuredClone(session)];
context.openWorkout('new');
elements['sets-chest']=element();elements['sets-lowerBack']=element();
elements.workoutDate.value='2026-01-05';
elements['sets-chest'].value='12';elements['sets-lowerBack'].value='4';
elements.workoutForm.onsubmit({preventDefault(){}});
assert.deepEqual(clean(D.workouts[0].sets),{chest:12,lowerBack:4});
assert.equal(saves,1);
const before=JSON.stringify(D.workouts);
elements['sets-chest'].value='2.5';elements.workoutForm.onsubmit({preventDefault(){}});
assert.equal(JSON.stringify(D.workouts),before);
assert.equal(saves,1,'invalid form must not save');
elements['sets-chest'].value='8';checkboxes[1].checked=false;checkboxes[1].onchange();
assert.equal(elements['sets-lowerBack'].disabled,true);
elements.workoutForm.onsubmit({preventDefault(){}});
assert.deepEqual(clean(D.workouts[0].sets),{chest:8},'deselected muscles must not retain counts');
elements['sets-chest'].value='';elements.workoutForm.onsubmit({preventDefault(){}});
assert.deepEqual(clean(D.workouts[0].sets),{});
assert.equal(trainingStats(D.workouts,'2026-01-06').uncountedSessions,1);
const roundtrip=JSON.parse(JSON.stringify(lifeDefaults(D)));
assert.deepEqual(clean(roundtrip.workouts),clean(D.workouts));
assert.equal(validateLife(roundtrip).length,0);
// Check the production JSON exporter/importer, not only the new schema helper.
context.document.dispatchEvent=()=>{};context.Event=Event;
context.FALLBACK={holdings:[],closedTrades:[],history:[],gym:[],books:[],movies:[],series:[],watchlist:[],cash:0,totalInvested:0};
vm.runInContext(source('storage.js')+'\n'+source('game-schema.js')+'\n'+source('importer.js'),context);
context.loadDataFromObj({...context.FALLBACK,...roundtrip,workouts:[session,legacy],cash:100,totalInvested:67000,holdings:[{ticker:'TEST',shares:2,entryPrice:10,currency:'EUR',dividends:0}]});
const exported=JSON.parse(JSON.stringify(context.buildDataObj()));
const imported=context.validateImportObj(exported);
assert.equal(imported.ok,true,JSON.stringify(imported.errors));
context.loadDataFromObj(imported.data);
assert.deepEqual(clean(context.buildDataObj()),exported,'export/import retains sets and all unrelated data');
assert.equal(context.validateImportObj({...exported,workouts:[{...session,sets:{chest:-1}}]}).ok,false);
D.workouts=[structuredClone(session)];
elements.deleteWorkout.onclick();assert.equal(D.workouts.length,0);
console.log('PASS: set totals, 12:4 ratio, same-day sessions, legacy data, validation, edit/remove/blank counts, JSON roundtrip, ES/EN and unchanged day counts — '+root);
