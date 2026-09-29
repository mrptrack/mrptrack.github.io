// Drive via Apps Script. A failed redirect is NOT proof that a write failed.
import { PROXY_URL } from './config.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
import { getSessionToken, onUnauthorizedFromServer } from './auth.js';
import { isFallbackState } from './state.js';
import { fetchJsonWithTimeout } from './network.js';
export { updateSyncStatus };

const PENDING_KEY = 'trackmrp_cloud_pending';
let _pending = false;
try { _pending = !!localStorage.getItem(PENDING_KEY); } catch (_) { /* private mode */ }
let _revision = 0;
let _loadPromise = null;
let _saveQueue = Promise.resolve();
export let _cloudReady = false;

function _payloadIsEmpty(j) {
  if (!j) return true;
  const noHoldings = !Array.isArray(j.holdings) || j.holdings.length === 0;
  const noClosed = !Array.isArray(j.closedTrades) || j.closedTrades.length === 0;
  return noHoldings && !j.cash && !j.totalInvested && noClosed && !j.trainingInitialized
    && !['history','gym','books','movies','series','watchlist','games','workouts'].some(k => Array.isArray(j[k]) && j[k].length);
}

function _canonical(value) {
  if (Array.isArray(value)) return value.map(_canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, _canonical(value[key])]));
  }
  return value;
}
function _sameData(a, b) { return JSON.stringify(_canonical(a)) === JSON.stringify(_canonical(b)); }

function _setPending(snapshot) {
  _pending = true;
  _cloudReady = false;
  // Keep the unconfirmed payload across reloads, without storing credentials.
  try { localStorage.setItem(PENDING_KEY, snapshot); } catch (_) { /* retain in-memory guard */ }
}
function _clearPending() {
  _pending = false;
  try { localStorage.removeItem(PENDING_KEY); } catch (_) { /* conservative on reload */ }
}
function _unauthorized() {
  _cloudReady = false;
  onUnauthorizedFromServer();
  toast('Sesión caducada', 'err');
  updateSyncStatus('local');
}
function _log(operation, error) {
  // Never log request URLs, response bodies or credentials.
  console.warn('[GAS] ' + operation, error.status ? 'HTTP ' + error.status : error.name,
    error.responseHost || '');
}

async function _readRemote(token) {
  // GET is safe to retry; each attempt gets a fresh ContentService response.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const url = PROXY_URL + '?action=getData&session_token=' + encodeURIComponent(token)
        + '&t=' + Date.now() + '-' + attempt + '-' + Math.random().toString(36).slice(2);
      const data = await fetchJsonWithTimeout(url, 10000, { credentials: 'omit', redirect: 'follow' });
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Invalid cloud response');
      if (data.error) {
        const error = new Error('Cloud rejected request');
        error.unauthorized = data.error === 'unauthorized';
        error.serverRejected = true;
        throw error;
      }
      if (Object.keys(data).length && !Array.isArray(data.holdings)) throw new Error('Invalid cloud schema');
      return data;
    } catch (error) {
      _log('read attempt ' + (attempt + 1), error);
      if (error.serverRejected || attempt === 1 || getSessionToken() !== token) throw error;
    }
  }
}

async function _loadFromGAS() {
  const token = getSessionToken();
  if (!PROXY_URL || !token) { _cloudReady = false; updateSyncStatus('local'); return false; }
  const revision = _revision;
  _cloudReady = false;
  updateSyncStatus(_pending ? 'pending' : 'loading');
  try {
    const remote = await _readRemote(token);
    if (getSessionToken() !== token || revision !== _revision) return false;
    if (!Array.isArray(remote.holdings)) { updateSyncStatus(_pending ? 'pending' : 'local'); return false; }
    if (_pending) {
      // Do not silently replace local edits by an older cloud copy.
      if (!_sameData(remote, buildDataObj())) {
        updateSyncStatus('pending');
        toast('Cambios locales pendientes — se conservan en este navegador', 'err');
        return false;
      }
      _clearPending();
    }
    if (_payloadIsEmpty(remote) && !isFallbackState()) {
      toast('Cloud vacío — manteniendo datos locales', 'err');
      updateSyncStatus('local');
      return false;
    }
    // Recovery copy before applying a remote payload (also covers pre-fix data).
    if (!isFallbackState() && !_sameData(remote, buildDataObj())) {
      try { localStorage.setItem('trackmrp_before_cloud', JSON.stringify(buildDataObj())); } catch (_) { /* storage full */ }
    }
    loadDataFromObj(remote, true);
    saveLocal();
    _cloudReady = true;
    updateSyncStatus('ok');
    return true;
  } catch (error) {
    if (getSessionToken() !== token || revision !== _revision) return false;
    if (error.unauthorized) _unauthorized();
    else updateSyncStatus(_pending ? 'pending' : 'err');
    return false;
  }
}

async function _saveToGAS(snapshot, revision, token) {
  if (getSessionToken() !== token) return false;
  if (revision === _revision) updateSyncStatus('saving');
  let confirmed = false;
  try {
    const response = await fetchJsonWithTimeout(PROXY_URL + '?request=' + Date.now() + '-' + revision, 12000, {
      method: 'POST', redirect: 'follow', credentials: 'omit',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ session_token: token, data: snapshot })
    });
    if (response?.error === 'unauthorized') { if (getSessionToken() === token) _unauthorized(); return false; }
    if (response?.error) throw new Error('Cloud rejected save');
    confirmed = response?.ok === true;
  } catch (error) {
    _log('save response unconfirmed', error);
  }
  if (getSessionToken() !== token) return false;
  if (!confirmed) {
    // No blind POST retries: the original write may already have happened.
    // Read back WITHOUT applying this payload to the UI/local data.
    try {
      confirmed = _sameData(await _readRemote(token), JSON.parse(snapshot));
    } catch (error) {
      if (error.unauthorized && getSessionToken() === token) _unauthorized();
    }
  }
  if (getSessionToken() !== token) return false;
  if (revision === _revision) {
    if (confirmed) {
      _clearPending();
      _cloudReady = true;
      updateSyncStatus('ok');
      toast('Synced', 'ok');
    } else {
      updateSyncStatus('pending');
      toast('Guardado local — Drive no ha confirmado los cambios', 'err');
    }
  }
  return confirmed;
}

export function fetchDataFromCloud() {
  // Visibility events and startup must not launch competing reads.
  if (!_loadPromise) _loadPromise = _loadFromGAS().finally(() => { _loadPromise = null; });
  return _loadPromise;
}

export function pushDataToCloud() {
  if (isFallbackState()) return Promise.resolve(false);
  const snapshot = JSON.stringify(buildDataObj());
  const revision = ++_revision;
  _setPending(snapshot);
  const token = getSessionToken();
  if (!PROXY_URL || !token) { updateSyncStatus('pending'); return Promise.resolve(false); }
  updateSyncStatus('pending');
  // Preserve write order; an older acknowledgement cannot clear a newer edit.
  const result = _saveQueue.then(() => _saveToGAS(snapshot, revision, token));
  _saveQueue = result.catch(() => false);
  return result;
}

export function saveAndSync() {
  if (isFallbackState()) return Promise.resolve(false);
  saveLocal();
  return pushDataToCloud();
}

// Only an explicit refresh retries an unconfirmed write; background loads
// merely verify remote data and never overwrite it with a pending local copy.
export function syncNow() {
  return _pending ? saveAndSync() : fetchDataFromCloud();
}
