const { chromium }=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
(async()=>{
const server=http.createServer((req,res)=>{
 const file=path.join(root,req.url.split('?')[0]==='/'?'index.html':req.url.split('?')[0]);
 if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
 try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
 await page.addInitScript(()=>{window.Chart=class{constructor(ctx,opts){this.data=opts.data;}destroy(){}update(){}}});
 await page.goto('http://127.0.0.1:'+server.address().port);
 await page.waitForFunction(()=>document.getElementById('trainingDashboard').children.length>0);
 await page.evaluate(async()=>{
  const {D,setAuthed}=await import('/js/state.js');setAuthed(true);
  document.getElementById('loginOv').style.display='none';document.getElementById('btnAdmin').style.display='';
  D.books=[{title:'Libro',author:'Autor',pages:100,myRating:4,opinion:'My opinion remains exactly as written',translations:{es:{title:'Libro'},en:{title:'Book'}}},{title:'Pendiente',pages:200,myRating:null}];
  D.movies=[{title:'Film',duration:'2h',myRating:8,opinion:''},{title:'Next',duration:'1h 30 min',myRating:null}];
  D.series=[{title:'Series',seasons:3,epsPerSeason:'8',epLength:'30 min',watched:'Temporada 1',myRating:8}];
  (await import('/js/media.js')).renderBooks();(await import('/js/media.js')).renderMovies();(await import('/js/media.js')).renderSeries();
 });
 assert.match(await page.locator('#booksSummary').innerText(),/200 pendientes/);
 assert.match(await page.locator('#moviesSummary').innerText(),/1,5h pendientes/);
 assert.match(await page.locator('#seriesSummary').innerText(),/8h pendientes/);
 assert.equal(await page.locator('#booksSummary .sum-card').count(),4);
 await page.click('[data-tab=gym]');await page.click('#newWorkout');
 assert.equal(await page.inputValue('#workoutMode'),'gym');
 await page.fill('#workoutDate','2026-01-05');
 await page.locator('[name=muscle][value=chest] + span').click();
 await page.locator('[name=muscle][value=triceps] + span').click();
 await page.click('#workoutForm [type=submit]');
 assert.equal(await page.locator('.session-row').count(),1);
 await page.click('#newWorkout');await page.selectOption('#workoutMode','activity');
 await page.selectOption('#workoutActivity','__new');await page.fill('#activityEs','Escalada');await page.fill('#activityEn','Climbing');
 await page.fill('#workoutDate','2026-01-05');await page.click('#workoutForm [type=submit]');
 assert.equal(await page.locator('.session-row').count(),2);
 let result=await page.evaluate(async()=>{
  const {D}=await import('/js/state.js'),{buildDataObj}=await import('/js/storage.js'),{validateImportObj}=await import('/js/importer.js'),{trainingStats}=await import('/js/training.js');
  const saved=structuredClone(buildDataObj()),valid=validateImportObj(saved);
  return {valid:valid.ok,errors:valid.errors,days:trainingStats(D.workouts,'2026-01-06').days,week:trainingStats(D.workouts,'2026-01-06').thisWeek,active:trainingStats(D.workouts,'2026-01-06').activeWeeks,
   legacy:validateImportObj({books:[],movies:[],series:[],gym:[],holdings:[],closedTrades:[],history:[]}).data.workouts.length,
   invalid:validateImportObj({...saved,workouts:[{id:'bad',date:'2026-02-30',mode:'gym',muscles:['chest']}]}).ok};
 });
 assert.deepEqual(result,{valid:true,errors:[],days:1,week:1,active:1,legacy:2,invalid:false});
 await page.click('#btnSettings');await page.selectOption('#settingLanguage','en');
 await page.selectOption('#settingTheme','light');await page.click('#closeSettings');
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 assert.match(await page.locator('html').getAttribute('class'),/theme-light/);
 await page.click('[data-tab=books]');
 assert.equal(await page.locator('#booksGrid .m-card-title').first().innerText(),'Book');
 assert.equal(await page.locator('#booksGrid .m-card-opinion').first().innerText(),'My opinion remains exactly as written');
 await page.click('#btnAdmin');await page.click('#booksGrid .m-card');
 await page.fill('#mediaTitle-es','Libro cambiado');await page.fill('#mediaTitle-en','Changed book');await page.click('#mediaForm [type=submit]');
 assert.equal(await page.locator('#booksGrid .m-card-title').first().innerText(),'Changed book');
 await page.reload();await page.waitForFunction(()=>document.getElementById('trainingDashboard').children.length>0);
 await page.evaluate(async()=>{(await import('/js/state.js')).setAuthed(true);document.getElementById('loginOv').style.display='none';document.getElementById('btnAdmin').style.display='';(await import('/js/gym.js')).renderGym();});
 assert.equal(await page.locator('html').getAttribute('lang'),'en');
 result=await page.evaluate(async()=>{const{D}=await import('/js/state.js');return {count:D.workouts.length,activities:D.activities.length,title:D.books[0].translations.en.title}});
 assert.deepEqual(result,{count:2,activities:4,title:'Changed book'});
 await page.click('[data-tab=gym]');await page.fill('#trainingMonth','2026-01');
 await page.click('.session-row:first-child');await page.fill('#workoutDate','2026-01-06');await page.click('#workoutForm [type=submit]');
 for(const width of [360,390,768,1440]){
  await page.setViewportSize({width,height:900});
  for(const tab of ['gym','books','movies','series','games','portfolio','analytics']){
   await page.click('[data-tab='+tab+']');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width+' '+tab);
  }
 }
 await page.setViewportSize({width:390,height:844});await page.click('[data-tab=gym]');
 await page.screenshot({path:path.join(process.env.TEMP,'track-life-mobile.png'),fullPage:true});
 await page.click('#newWorkout');await page.selectOption('#workoutMode','activity');
 assert.match(await page.locator('#workoutActivity').innerText(),/Climbing/);
 await page.click('#cancelWorkout');
 page.once('dialog',d=>d.accept());await page.click('.session-row:first-child');await page.click('#deleteWorkout');
 assert.equal(await page.locator('.session-row').count(),1);
 await page.click('#btnSettings');await page.selectOption('#settingLanguage','es');await page.click('#closeSettings');
 assert.equal(await page.locator('[data-tab=books]').innerText(),'Libros');
 const i18nChecks=await page.evaluate(async()=>{
   const {D}=await import('/js/state.js'),{t}=await import('/js/i18n.js');
   D.preferences.language='es';
   const es=[t('✏ Edit'),t('Shares *'),t('Avg entry price (USD)'),t('/ next stop 150.000 €')];
   D.preferences.language='en';const en=t('lowerBack');D.preferences.language='es';return {es,en};
 });
 assert.deepEqual(i18nChecks,{es:['✏ Editar','Acciones *','Precio medio de entrada (USD)','/ siguiente objetivo 150.000 €'],en:'Lower back'});
 const emptyLog=await page.evaluate(async()=>{
   const {D,isFallbackState}=await import('/js/state.js'),{loadDataFromObj,buildDataObj,saveLocal,loadData}=await import('/js/storage.js');
   const before=structuredClone(buildDataObj());
   loadDataFromObj({holdings:[],cash:0,totalInvested:0,closedTrades:[],history:[],gym:[],books:[],movies:[],series:[],games:[],watchlist:[],workouts:[],trainingInitialized:true});
   saveLocal();loadData();const kept=!isFallbackState()&&D.workouts.length===0&&D.trainingInitialized;
   loadDataFromObj(before);saveLocal();return kept;
 });
 assert.equal(emptyLog,true,'intentionally emptied training log must persist');
 if(process.env.LIFE_BACKUP){
  const backup=JSON.parse(fs.readFileSync(process.env.LIFE_BACKUP,'utf8'));
  const result=await page.evaluate(async data=>{
   const {validateImportObj}=await import('/js/importer.js');const res=validateImportObj(data);
   return {ok:res.ok,errors:res.errors,workouts:res.data?.workouts.length};
  },backup);
  assert.equal(result.ok,true,JSON.stringify(result));
  await page.evaluate(async data=>{
    (await import('/js/storage.js')).loadDataFromObj(data);
    (await import('/js/portfolio.js')).renderPortfolio();
    (await import('/js/portfolio.js')).renderHistory();
    (await import('/js/analytics.js')).renderAnalytics();
    (await import('/js/trades.js')).renderTrades();
    (await import('/js/media.js')).renderBooks();
    (await import('/js/media.js')).renderMovies();
    (await import('/js/media.js')).renderSeries();
    (await import('/js/i18n.js')).translateUI();
  },backup);
  if(process.env.LIFE_AUDIT) console.log(await page.evaluate(()=>[...document.querySelectorAll('h2,.sum-lbl,.stock-lbl,.hero-lbl,.ms-note,th,.hdr-r,.ms-target,.tp-sub')].map(e=>e.textContent.trim()).join('\n')));
 }
 assert.deepEqual(errors,[]);
 console.log('PASS life dashboard: persistence, legacy import, invalid data, backdating, editing, deletion, custom activities, bilingual media, settings, remaining totals and responsive layout');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
