// ============================================================
//  cloud.js — Backend vía Apps Script (Drive)
//
//  Lectura y escritura de un único fichero JSON en Drive,
//  a través de un Apps Script publicado como Web App.
//  Cada request incluye el id_token de Google; el GAS valida
//  firma + allowlist y responde 'unauthorized' si no procede.
// ============================================================
import { PROXY_URL } from './config.js';
import { toast } from './utils.js';
import { loadDataFromObj, buildDataObj, saveLocal, updateSyncStatus } from './storage.js';
import { getSessionToken, onUnauthorizedFromServer } from './auth.js';
import { isFallbackState } from './state.js';
export { updateSyncStatus };

// ── ¿Es vacío/fallback este payload remoto? ─────────────────
// Útil para detectar respuestas de cloud que sobreescribirían
// datos buenos locales con FALLBACK.
function _payloadIsEmpty(j) {
  if (!j) return true;
  const noHoldings = !j.holdings || !Array.isArray(j.holdings) || j.holdings.length === 0;
  const noCash     = !j.cash;
  const noInvested = !j.totalInvested;
  const noClosed   = !j.closedTrades || !Array.isArray(j.closedTrades) || j.closedTrades.length === 0;
  return noHoldings && noCash && noInvested && noClosed && !j.trainingInitialized && !['history','gym','books','movies','series','watchlist','games','workouts'].some(k => Array.isArray(j[k]) && j[k].length);
}

export let _cloudReady = false;

async function _loadFromGAS() {
  if (!PROXY_URL) { console.warn('[GAS] PROXY_URL no configurada.'); updateSyncStatus('local'); return false; }
  const token = getSessionToken();
  if (!token) { updateSyncStatus('local'); return false; }
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 20000);
    const url = PROXY_URL + '?action=getData&session_token=' + encodeURIComponent(token) + '&t=' + Date.now();
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    if (!text || text === '{}' || text === 'No URL' || text === 'Blocked') {
      updateSyncStatus('local'); return false;
    }
    let j;
    try { j = JSON.parse(text); } catch { updateSyncStatus('local'); return false; }
    if (j && j.error === 'unauthorized') {
      onUnauthorizedFromServer();
      toast('Sesión caducada', 'err');
      updateSyncStatus('local');
      return false;
    }
    if (j && j.holdings) {
      // GUARD: si el cloud está vacío pero local tiene datos buenos,
      // NO aplicar — protege contra contagio cuando otra sesión nukeó cloud.
      if (_payloadIsEmpty(j) && !isFallbackState()) {
        console.warn('[cloud] _loadFromGAS: cloud vacío, local con datos. Se ignora payload remoto para no sobreescribir.');
        toast('Cloud vacío — manteniendo datos locales', 'err');
        updateSyncStatus('local');
        return false;
      }
      loadDataFromObj(j, true); saveLocal(); _cloudReady = true; updateSyncStatus('ok'); return true;
    }
    return false;
  } catch (e) {
    console.warn('[GAS] _loadFromGAS:', e.message);
    updateSyncStatus(e.name === 'AbortError' ? 'local' : 'err');
    return false;
  }
}

async function _saveToGAS() {
  if (!PROXY_URL) { updateSyncStatus('local'); return false; }
  const token = getSessionToken();
  if (!token) { updateSyncStatus('local'); return false; }
  // GUARD: nunca subir D vacío al cloud. Protege contra la race condition
  // donde un cold-start con localStorage limpio dispara un saveAndSync
  // antes de que fetchDataFromCloud termine, sobreescribiendo cloud con
  // FALLBACK y borrando todos los datos del usuario.
  if (isFallbackState()) {
    console.warn('[cloud] _saveToGAS abortado: D está en estado FALLBACK. No se sobreescribe cloud.');
    return false;
  }
  try {
    const payload = JSON.stringify({ session_token: token, data: JSON.stringify(buildDataObj()) });
    const res = await fetch(PROXY_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' }, body: payload
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}
    if (!j) { const m = text.match(/\{[^]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch {} } }
    if (j && j.error === 'unauthorized') {
      onUnauthorizedFromServer();
      toast('Sesión caducada', 'err');
      updateSyncStatus('local');
      return false;
    }
    if (j && j.error) {
      console.warn('[GAS] save error:', j.error);
      toast('Sync: ' + j.error, 'err');
      updateSyncStatus('err');
      return false;
    }
    toast('Synced', 'ok'); updateSyncStatus('ok'); return true;
  } catch (e) {
    console.warn('[GAS] _saveToGAS:', e.message);
    toast('Sync failed', 'err'); updateSyncStatus('err'); return false;
  }
}

export async function fetchDataFromCloud() {
  return await _loadFromGAS();
}

export async function pushDataToCloud() {
  return await _saveToGAS();
}

// Guarda localmente y envia a la nube
export async function saveAndSync() {
  // GUARD adicional (defensa en profundidad): incluso saveLocal se bloquea
  // si D es FALLBACK y ya hay un db_data poblado en localStorage.
  if (isFallbackState()) {
    console.warn('[cloud] saveAndSync abortado: D vacío. No se toca ni local ni cloud.');
    return false;
  }
  saveLocal();
  return await pushDataToCloud();
}
