const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');

(async () => {
  const server = http.createServer((req, res) => {
    const file = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
    if (!file.startsWith(root + path.sep)) {res.writeHead(403).end(); return;}
    try {res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  let browser;
  try {
    browser = await chromium.launch({channel:'msedge', headless:true});
    const context = await browser.newContext({serviceWorkers:'block'});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => {
      if (route.request().url().startsWith('http://127.0.0.1:')) return route.continue();
      if (route.request().url().includes('exchangerate-api.com')) return route.fulfill({json:{rates:{USD:1.1,CAD:1.5,GBP:0.85,JPY:160}}});
      return route.abort();
    });
    await page.addInitScript(() => {window.Chart = class {constructor(ctx, opts){this.data=opts.data;} destroy(){} update(){}};});
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => document.getElementById('gamesSummary').children.length === 4);
    await page.evaluate(async () => {
      (await import('/js/state.js')).setAuthed(true);
      document.getElementById('loginOv').style.display='none';
      document.getElementById('btnAdmin').style.display='';
    });
    const currencies = await page.evaluate(async () => {
      const {openAddModal, closeModal} = await import('/js/modals.js');
      openAddModal('holding');
      const holding = [...document.querySelectorAll('#aHCur option')].some(o => o.value === 'JPY');
      closeModal(); openAddModal('trade');
      const trade = [...document.querySelectorAll('#aCur option')].some(o => o.value === 'JPY');
      closeModal();
      const watchlist = [...document.querySelectorAll('#wlCurrency option')].some(o => o.value === 'JPY');
      return {holding,trade,watchlist};
    });
    assert.deepEqual(currencies,{holding:true,trade:true,watchlist:true});
    await page.click('#btnAdmin');
    await page.click('[data-tab="games"]');
    await page.click('#btnAddGame');
    for (const [key,value] of Object.entries({title:'Test <game>',platform:'PC',developer:'Test studio',releaseYear:'2024',playedYear:'2026',metacritic:'89',myRating:'9.2',hours:'42.5'})) await page.fill('#game-'+key,value);
    await page.fill('#game-titleEn','Test <game>');
    await page.selectOption('#game-status','Completed');
    await page.fill('#game-opinion','<img src=x onerror=alert(1)>');
    await page.click('#gameForm button[type=submit]');
    assert.equal(await page.locator('#gamesGrid .m-card').count(),1);
    assert.equal(await page.locator('#gamesGrid img').count(),0);
    assert.match(await page.locator('#gamesGrid').innerText(), /Metacritic: 89\/100/);
    const checks = await page.evaluate(async () => {
      const {D,isFallbackState} = await import('/js/state.js');
      const {buildDataObj,loadDataFromObj} = await import('/js/storage.js');
      const {validateImportObj} = await import('/js/importer.js');
      const saved=structuredClone(buildDataObj());
      const roundtrip=validateImportObj(saved);
      const legacy=structuredClone(saved); delete legacy.games;
      loadDataFromObj(legacy);
      const kept=D.games.length;
      const invalid=validateImportObj({...saved,games:[{title:'Oops',myRating:11}]}).ok;
      const yen=validateImportObj({...saved,holdings:[{ticker:'7203.T',shares:100,entryPrice:2500,currency:'JPY'}]}).ok;
      const {fetchFx,fxR}=await import('/js/portfolio.js'); await fetchFx();
      return {roundtrip:roundtrip.ok,games:roundtrip.data.games.length,kept,invalid,yen,fx:fxR('JPY'),fallback:isFallbackState()};
    });
    assert.deepEqual(checks,{roundtrip:true,games:1,kept:1,invalid:false,yen:true,fx:1/160,fallback:false});
    await page.reload();
    await page.evaluate(async () => {(await import('/js/state.js')).setAuthed(true);document.getElementById('loginOv').style.display='none';document.getElementById('btnAdmin').style.display='';});
    await page.click('#btnAdmin'); await page.click('[data-tab="games"]');
    assert.equal(await page.locator('#gamesGrid .m-card').count(),1);
    await page.fill('#gamesSearch','missing'); assert.equal(await page.locator('#gamesGrid .m-card').count(),0);
    await page.fill('#gamesSearch','studio'); assert.equal(await page.locator('#gamesGrid .m-card').count(),1);
    await page.setViewportSize({width:375,height:812});
    await page.click('#gamesGrid .m-card');
    await page.fill('#game-hours','50'); await page.click('#gameForm button[type=submit]');
    assert.match(await page.locator('#gamesGrid').innerText(),/50[,.]0h/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    await page.click('#gamesGrid .m-card');
    page.once('dialog',d=>d.accept()); await page.click('#gameDelete');
    assert.equal(await page.locator('#gamesGrid .m-card').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: game add/edit/delete, persistence, legacy backup, validation, JPY FX, escaping, search and mobile width');
  } finally {if(browser) await browser.close(); await new Promise(r=>server.close(r));}
})().catch(e => {console.error(e);process.exitCode=1;});
