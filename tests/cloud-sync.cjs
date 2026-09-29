// Isolated regression tests. No production data, credentials or network calls.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/cloud.js'), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export \{.*\};\r?\n/gm, '').replace(/\bexport /g, '');
const clone = value => JSON.parse(JSON.stringify(value));
const data = cash => ({ holdings: [{ ticker: 'TEST', shares: 1 }], cash, totalInvested: 10, history: [], books: [] });
const pendingKey = 'trackmrp_cloud_pending';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const failure = name => Object.assign(new Error('private-url-and-token-must-not-be-logged'), { name });
function harness(options = {}) {
  let state = clone(options.data || data(1));
  const store = new Map(Object.entries(options.storage || {}));
  const calls = [], statuses = [], loaded = [], logs = [];
  const env = { token: 'synthetic-session', localSaves: 0, logouts: 0 };
  const context = vm.createContext({
    PROXY_URL: 'https://example.invalid/exec',
    console: { warn: (...args) => logs.push(args.join(' ')) },
    localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
    toast() {}, updateSyncStatus: status => statuses.push(status),
    buildDataObj: () => clone(state),
    loadDataFromObj: remote => { loaded.push(clone(remote)); state = clone(remote); },
    saveLocal: () => { env.localSaves++; },
    isFallbackState: () => options.fallback || false,
    getSessionToken: () => env.token,
    onUnauthorizedFromServer: () => { env.logouts++; env.token = null; },
    fetchJsonWithTimeout: async (url, timeout, request = {}) => {
      calls.push({ url, timeout, request });
      return options.fetch ? options.fetch({ url, timeout, request }, env) : clone(state);
    }
  });
  vm.runInContext(source, context);
  return Object.assign(env, { context, store, calls, statuses, loaded, logs,
    state: () => clone(state), edit: next => { state = clone(next); },
    ready: () => vm.runInContext('_cloudReady', context) });
}

test('retries a timed-out GET with a fresh URL and backs up local data before applying', async () => {
  let attempts = 0;
  const h = harness({ fetch: () => { if (++attempts === 1) throw failure('TimeoutError'); return data(2); } });
  assert.equal(await h.context.fetchDataFromCloud(), true);
  assert.equal(h.calls.length, 2);
  assert.notEqual(h.calls[0].url, h.calls[1].url);
  assert.equal(JSON.parse(h.store.get('trackmrp_before_cloud')).cash, 1);
  assert.equal(h.state().cash, 2);
  assert.equal(h.ready(), true);
  assert.equal(h.statuses.at(-1), 'ok');
  assert.ok(!h.logs.join('').includes('private-url'));
});

test('overlapping startup and visibility reads share a single request', async () => {
  const wait = deferred();
  const h = harness({ fetch: () => wait.promise });
  const a = h.context.fetchDataFromCloud(), b = h.context.fetchDataFromCloud();
  assert.equal(a, b);
  wait.resolve(data(2));
  await Promise.all([a, b]);
  assert.equal(h.calls.length, 1);
  assert.equal(h.loaded.length, 1);
});

test('unauthorized read is not retried and signs out', async () => {
  const h = harness({ fetch: () => ({ error: 'unauthorized' }) });
  assert.equal(await h.context.fetchDataFromCloud(), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.logouts, 1);
  assert.equal(h.loaded.length, 0);
});

test('invalid or empty remote data never replaces populated local data', async () => {
  for (const remote of [{}, { holdings: [] }, { holdings: 'invalid' }, []]) {
    const h = harness({ fetch: () => remote });
    assert.equal(await h.context.fetchDataFromCloud(), false);
    assert.equal(h.state().cash, 1);
    assert.equal(h.loaded.length, 0);
    assert.equal(h.ready(), false);
  }
});

test('both failed reads leave local data intact and report an error', async () => {
  const h = harness({ fetch: () => { throw failure('TimeoutError'); } });
  assert.equal(await h.context.fetchDataFromCloud(), false);
  assert.equal(h.calls.length, 2);
  assert.equal(h.statuses.at(-1), 'err');
  assert.equal(h.loaded.length, 0);
});

test('a strict save acknowledgement clears the persisted pending marker', async () => {
  const h = harness({ fetch: () => ({ ok: true }) });
  assert.equal(await h.context.saveAndSync(), true);
  assert.equal(h.localSaves, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].request.method, 'POST');
  assert.equal(h.calls[0].request.headers['Content-Type'], 'text/plain');
  assert.equal(h.calls[0].request.credentials, 'omit');
  assert.equal(h.store.has(pendingKey), false);
  assert.equal(h.ready(), true);
});

test('POST 404 followed by matching read-back confirms the save without a second POST', async () => {
  const h = harness({ fetch: ({ request }) => {
    if (request.method === 'POST') throw Object.assign(failure('Error'), { status: 404, responseHost: 'script.googleusercontent.com' });
    return { books: [], history: [], totalInvested: 10, cash: 1, holdings: [{ shares: 1, ticker: 'TEST' }] };
  } });
  assert.equal(await h.context.saveAndSync(), true);
  assert.equal(h.calls.filter(c => c.request.method === 'POST').length, 1);
  assert.equal(h.calls.length, 2);
  assert.equal(h.loaded.length, 0); // Verification must not reload/merge UI data.
  assert.equal(h.store.has(pendingKey), false);
});

test('missing or false acknowledgement cannot show Synced when read-back differs', async () => {
  for (const ack of [{}, { ok: false }, { ok: 'true' }]) {
    const h = harness({ fetch: ({ request }) => request.method === 'POST' ? ack : data(99) });
    assert.equal(await h.context.saveAndSync(), false);
    assert.equal(h.statuses.at(-1), 'pending');
    assert.equal(JSON.parse(h.store.get(pendingKey)).cash, 1);
    assert.equal(h.state().cash, 1);
    assert.equal(h.ready(), false);
  }
});

test('an uncertain write survives failed verification and a subsequent reload', async () => {
  const h = harness({ fetch: () => { throw failure('TimeoutError'); } });
  assert.equal(await h.context.saveAndSync(), false);
  assert.equal(h.calls.length, 3); // One POST, two safe GET attempts, no repeated POST.
  const reloaded = harness({ storage: Object.fromEntries(h.store), fetch: () => data(99) });
  assert.equal(await reloaded.context.fetchDataFromCloud(), false);
  assert.equal(reloaded.loaded.length, 0);
  assert.equal(reloaded.state().cash, 1);
  assert.equal(reloaded.statuses.at(-1), 'pending');
});

test('matching cloud data resolves a pending marker after reload without rewriting Drive', async () => {
  const h = harness({ storage: { [pendingKey]: JSON.stringify(data(1)) } });
  assert.equal(await h.context.fetchDataFromCloud(), true);
  assert.equal(h.store.has(pendingKey), false);
  assert.equal(h.calls.some(c => c.request.method === 'POST'), false);
});

test('a late read cannot overwrite edits made during its request', async () => {
  const read = deferred();
  const h = harness({ fetch: ({ request }) => request.method === 'POST' ? { ok: true } : read.promise });
  const loading = h.context.fetchDataFromCloud();
  h.edit(data(5));
  await h.context.saveAndSync();
  read.resolve(data(1));
  assert.equal(await loading, false);
  assert.equal(h.loaded.length, 0);
  assert.equal(h.state().cash, 5);
  assert.equal(h.statuses.at(-1), 'ok');
});

test('writes are serialized and an old acknowledgement cannot clear a newer pending edit', async () => {
  const first = deferred(), second = deferred();
  let posts = 0;
  const h = harness({ fetch: () => ++posts === 1 ? first.promise : second.promise });
  const a = h.context.saveAndSync();
  await Promise.resolve();
  h.edit(data(7));
  const b = h.context.saveAndSync();
  assert.equal(posts, 1);
  first.resolve({ ok: true });
  assert.equal(await a, true);
  assert.equal(JSON.parse(h.store.get(pendingKey)).cash, 7);
  assert.notEqual(h.statuses.at(-1), 'ok');
  second.resolve({ ok: true });
  assert.equal(await b, true);
  assert.equal(posts, 2);
  assert.equal(h.store.has(pendingKey), false);
  assert.equal(JSON.parse(JSON.parse(h.calls[1].request.body).data).cash, 7);
});

test('fallback data never reaches cloud and never creates a pending write', async () => {
  const h = harness({ fallback: true });
  assert.equal(await h.context.saveAndSync(), false);
  assert.equal(h.calls.length, 0);
  assert.equal(h.localSaves, 0);
  assert.equal(h.store.has(pendingKey), false);
});

test('read response from a previous session is discarded', async () => {
  const wait = deferred();
  const h = harness({ fetch: () => wait.promise });
  const loading = h.context.fetchDataFromCloud();
  h.token = null;
  wait.resolve(data(99));
  assert.equal(await loading, false);
  assert.equal(h.loaded.length, 0);
});

test('expired session while saving leaves a recoverable pending payload', async () => {
  const h = harness({ fetch: () => ({ error: 'unauthorized' }) });
  assert.equal(await h.context.saveAndSync(), false);
  assert.equal(h.logouts, 1);
  assert.equal(h.calls.length, 1);
  assert.equal(JSON.parse(h.store.get(pendingKey)).cash, 1);
});

test('explicit refresh retries pending local changes; clean refresh only reads', async () => {
  const pending = harness({ storage: { [pendingKey]: JSON.stringify(data(1)) }, fetch: () => ({ ok: true }) });
  assert.equal(await pending.context.syncNow(), true);
  assert.equal(pending.calls[0].request.method, 'POST');
  const clean = harness();
  assert.equal(await clean.context.syncNow(), true);
  assert.equal(clean.calls[0].request.method, undefined);
});
