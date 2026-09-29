// Offline regression tests: no Google login, network traffic or real user data.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, name), 'utf8');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const quote = price => ({ chart: { result: [{ meta: { regularMarketPrice: price, currency: 'EUR' }, indicators: { quote: [{ close: [] }] } }] } });
const rates = { rates: { USD: 1.1, CAD: 1.5, GBP: 0.85, JPY: 160 } };

function network(fetch) {
  const context = vm.createContext({ fetch, AbortController, setTimeout, clearTimeout });
  vm.runInContext(source('js/network.js').replace(/export /g, ''), context);
  return context.fetchJsonWithTimeout;
}

function portfolio(options = {}) {
  const nodes = { dot: { style: {} }, ts: { textContent: '' } };
  const storage = new Map(Object.entries(options.storage || {}));
  const calls = [];
  let saves = 0;
  const context = vm.createContext({
    console: { warn() {} },
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : ['2026-09-29T12:00:00Z'])); }
      static now() { return new Date('2026-09-29T12:00:00Z').getTime(); }
    },
    document: { addEventListener() {}, getElementById: id => nodes[id] },
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) },
    PROXY_URL: 'https://example.invalid/proxy', _cloudReady: options.cloudReady ?? true,
    D: { holdings: [{ ticker: 'TEST', shares: 2, currency: 'EUR' }], cash: 5, totalInvested: 20, history: [] },
    locale: () => 'en-GB', saveAndSync: async () => { saves++; },
    fetchJsonWithTimeout: async (url, ms) => {
      calls.push({ url, ms });
      if (options.fetch) return options.fetch(url, ms);
      if (url.includes('finance%2Fchart')) return quote(12);
      if (url.includes('exchangerate-api.com') || url.includes('open.er-api.com')) return rates;
      return {};
    }
  });
  const code = source('js/portfolio.js').replace(/^import .*;\r?\n/gm, '').replace(/\bexport /g, '');
  vm.runInContext(code + '\nrenderPortfolio = () => { if (globalThis.renderError) throw new Error("render"); }; renderHistory = () => {}; rSkeletons = () => {};', context);
  return { context, nodes, storage, calls, saves: () => saves };
}

test('request timeout aborts a hung fetch', async () => {
  let signal;
  const get = network((_url, options) => { signal = options.signal; return new Promise(() => {}); });
  await assert.rejects(get('https://example.invalid', 15), { name: 'TimeoutError' });
  assert.equal(signal.aborted, true);
});

test('deadline also covers a hung response body', async () => {
  const get = network(async () => ({ ok: true, json: () => new Promise(() => {}) }));
  await assert.rejects(get('https://example.invalid', 15), { name: 'TimeoutError' });
});

test('successful requests clear the timer; HTTP and JSON errors propagate', async () => {
  let signal;
  const get = network(async (_url, options) => {
    signal = options.signal;
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ ok: true }) };
  });
  assert.equal((await get('https://example.invalid', 10)).ok, true);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(signal.aborted, false);
  await assert.rejects(network(async () => ({ ok: false, status: 404 }))('x'), /HTTP 404/);
  await assert.rejects(network(async () => ({ ok: true, json: async () => { throw new Error('bad JSON'); } }))('x'), /bad JSON/);
});

test('prices start in parallel with FX; successful refresh can snapshot', async () => {
  const fx = deferred();
  const env = portfolio({ fetch: url => url.includes('exchangerate-api.com') ? fx.promise : url.includes('finance%2Fchart') ? quote(12) : {} });
  const refresh = env.context.refreshPortfolio();
  assert.ok(env.calls.some(call => call.url.includes('finance%2Fchart')));
  fx.resolve(rates);
  await refresh;
  assert.equal(env.context.D.history[0].totalValue, 29);
  assert.equal(env.saves(), 1);
  assert.doesNotMatch(env.nodes.ts.textContent, /Updating|Parcial/);
});

test('FX uses direct sources, is reused for an hour and survives reload', async () => {
  const env = portfolio();
  assert.equal(await env.context.fetchFx(), true);
  assert.equal(await env.context.fetchFx(), true);
  assert.equal(env.calls.length, 1);
  assert.match(env.calls[0].url, /^https:\/\/api.exchangerate-api.com/);
  const restored = portfolio({ storage: Object.fromEntries(env.storage) });
  assert.equal(await restored.context.fetchFx(), true);
  assert.equal(restored.calls.length, 0);
});

test('invalid primary FX falls back to the secondary source', async () => {
  const env = portfolio({ fetch: url => url.includes('api.exchangerate-api.com') ? { rates: { USD: 1 } } : rates });
  assert.equal(await env.context.fetchFx(), true);
  assert.equal(env.calls.length, 2);
  assert.ok(env.calls.every(call => call.ms === 4000));
});

test('expired FX + failed sources retains cache and does not save a misleading snapshot', async () => {
  const env = portfolio({
    storage: { trackmrp_pf_fx: JSON.stringify({ USD: 0.9, CAD: 0.7, GBP: 1.2, JPY: 0.006, updatedAt: 1 }) },
    fetch: url => { if (url.includes('finance%2Fchart')) return quote(12); throw new Error('offline'); }
  });
  await env.context.refreshPortfolio();
  assert.equal(env.context.fxR('USD'), 0.9);
  assert.equal(env.saves(), 0);
  assert.match(env.nodes.ts.textContent, /Parcial/);
});

test('failed quote retains its last price, marks it stale and releases the refresh lock', async () => {
  let fail = true;
  const env = portfolio({
    storage: { trackmrp_pf_p: JSON.stringify({ TEST: { price: 10, ts: [] } }) },
    fetch: url => {
      if (url.includes('finance%2Fchart')) { if (fail) throw new Error('timeout'); return quote(12); }
      return url.includes('exchangerate-api.com') ? rates : {};
    }
  });
  await env.context.refreshPortfolio();
  assert.equal(env.context.getPriceData('TEST').price, 10);
  assert.equal(env.context.getPriceData('TEST')._stale, true);
  assert.equal(env.saves(), 0);
  assert.match(env.nodes.ts.textContent, /Parcial/);
  fail = false;
  await env.context.refreshPortfolio();
  assert.equal(env.context.getPriceData('TEST').price, 12);
  assert.equal(env.saves(), 1);
});

test('invalid or nonpositive quote is rejected instead of replacing cached data', async () => {
  for (const payload of [{ chart: { result: null } }, quote(0), quote(null)]) {
    const env = portfolio({ fetch: () => payload });
    await assert.rejects(env.context.fetchStock('TEST'), /Invalid quote/);
  }
});

test('failed cloud load prevents automatic snapshots even when prices succeed', async () => {
  const env = portfolio({ cloudReady: false });
  await env.context.refreshPortfolio();
  assert.equal(env.saves(), 0);
  assert.equal(env.context.D.history.length, 0);
});

test('holdings edited during refresh cannot mix ticker prices or trigger a snapshot', async () => {
  const pending = deferred();
  const env = portfolio({ fetch: url => url.includes('finance%2Fchart') ? pending.promise : rates });
  const refresh = env.context.refreshPortfolio();
  env.context.D.holdings = [{ ticker: 'OTHER', shares: 3, currency: 'EUR' }];
  pending.resolve(quote(12));
  await refresh;
  assert.equal(env.context.getPriceData('TEST').price, 12);
  assert.equal(env.context.getPriceData('OTHER'), null);
  assert.equal(env.saves(), 0);
});

test('in-place ticker edits also preserve the request-to-ticker mapping', async () => {
  const pending = deferred();
  const env = portfolio({ fetch: url => url.includes('finance%2Fchart') ? pending.promise : rates });
  const refresh = env.context.refreshPortfolio();
  env.context.D.holdings[0].ticker = 'OTHER';
  pending.resolve(quote(12));
  await refresh;
  assert.equal(env.context.getPriceData('TEST').price, 12);
  assert.equal(env.context.getPriceData('OTHER'), null);
  assert.equal(env.saves(), 0);
});

test('refresh retains cached fundamentals between throttled enrichment requests', async () => {
  const env = portfolio({ storage: { trackmrp_pf_p: JSON.stringify({ TEST: { price: 10, pe: 15, divYield: 2, ts: [] } }) } });
  await env.context.refreshPortfolio();
  assert.equal(env.context.getPriceData('TEST').pe, 15);
  assert.equal(env.context.getPriceData('TEST').divYield, 2);
});

test('end-to-end hung market requests settle without overwriting prices or saving', async () => {
  const signals = [];
  const boundedFetch = network((url, options) => {
    if (url.includes('v7%2Ffinance')) return Promise.resolve({ ok: true, json: async () => ({}) });
    signals.push(options.signal);
    return new Promise(() => {});
  });
  const env = portfolio({
    storage: { trackmrp_pf_p: JSON.stringify({ TEST: { price: 10, ts: [] } }) },
    fetch: url => boundedFetch(url, 15)
  });
  await env.context.refreshPortfolio();
  assert.equal(signals.length, 3); // One quote and two FX sources.
  assert.ok(signals.every(signal => signal.aborted));
  assert.equal(env.context.getPriceData('TEST').price, 10);
  assert.match(env.nodes.ts.textContent, /Parcial/);
  assert.equal(env.saves(), 0);
});

test('unexpected rendering error clears Updating and permits the next refresh', async () => {
  const env = portfolio();
  env.context.renderError = true;
  await env.context.refreshPortfolio();
  assert.match(env.nodes.ts.textContent, /Parcial/);
  env.context.renderError = false;
  await env.context.refreshPortfolio();
  assert.equal(env.context.getPriceData('TEST').price, 12);
});

test('optional fundamentals are throttled, including empty/failed responses', async () => {
  const env = portfolio();
  await env.context.refreshPortfolio();
  await env.context.refreshPortfolio();
  assert.equal(env.calls.filter(call => call.url.includes('v7%2Ffinance')).length, 1);
});

test('post-login waits for the actual cloud result before rendering and refreshing', async () => {
  const pending = deferred(), events = [];
  const context = vm.createContext({
    renderAll: () => events.push('render'), renderCalculator() {},
    fetchDataFromCloud: () => pending.promise,
    updateSyncStatus: state => events.push(state),
    refreshPortfolio: () => events.push('prices'),
    setInterval: () => 1
  });
  const code = source('js/app.js').split('async function _postAuthInit() {')[1].split('// ── Handlers')[0];
  vm.runInContext('let _rfInterval = null; async function _postAuthInit() {' + code, context);
  const init = context._postAuthInit();
  assert.deepEqual(events, ['render']);
  pending.resolve(true);
  await init;
  assert.deepEqual(events, ['render', 'render', 'prices']);
});

test('service worker does not serve live API data from permanent caches', () => {
  const handlers = {};
  const context = vm.createContext({ URL, self: { location: { href: 'https://example.invalid/sw.js' }, addEventListener: (name, fn) => { handlers[name] = fn; } } });
  vm.runInContext(source('sw.js'), context);
  for (const host of ['script.google.com', 'script.googleusercontent.com', 'api.exchangerate-api.com', 'open.er-api.com']) {
    handlers.fetch({ request: { method: 'GET', url: 'https://' + host + '/test' }, respondWith() { assert.fail('Live API intercepted by cache'); } });
  }
  assert.match(source('sw.js'), /js\/network\.js/);
  assert.match(source('sw.js'), /mrp-v3-refresh/);
});
