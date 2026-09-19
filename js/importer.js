import { validateLife, lifeDefaults, esc } from './life-schema.js';
// ============================================================
//  importer.js — Import de backups JSON (la vuelta del export)
//
//  Flujo: elegir archivo o pegar JSON → validar esquema → resumen
//  de diferencias → confirmación explícita → backup automático del
//  estado actual (descarga + copia en localStorage) → aplicar →
//  re-render + sync a la nube.
//
//  Diseñado a prueba de sustos: nunca aplica sin validar, nunca
//  pisa datos buenos con un archivo vacío, y siempre deja un
//  backup del estado anterior.
// ============================================================
import { D, _authed } from './state.js';
import { loadDataFromObj, buildDataObj } from './storage.js';
import { saveAndSync } from './cloud.js';
import { toast, F } from './utils.js';
import { closeModal } from './modals.js';
import { renderPortfolio, renderHistory } from './portfolio.js';
import { renderTrades } from './trades.js';
import { renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';
import { renderAnalytics } from './analytics.js';
import { renderWatchlist } from './watchlist.js';

import { renderGames } from './games.js';
import { validateGame } from './game-schema.js';
const CURRENCIES = ['EUR', 'USD', 'CAD', 'GBP', 'JPY'];
const KNOWN_KEYS = ['holdings', 'cash', 'totalInvested', 'closedTrades', 'history',
  'gym', 'books', 'movies', 'series', 'watchlist', 'games', 'schemaVersion', 'preferences', 'workouts', 'activities', 'trainingInitialized'];

// ── Validación de esquema (pura, testeable desde consola) ────
export function validateImportObj(obj) {
  const errors = [], warnings = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['El JSON raíz debe ser un objeto'], warnings, data: null };
  }

  errors.push(...validateLife({...obj, activities: obj.activities ?? D.activities}));
  for (const key of ['workouts','activities','preferences']) if (obj[key] == null && D[key]) warnings.push(key + ': missing in backup; current data will be preserved');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const arr = k => Array.isArray(obj[k]) ? obj[k] : (obj[k] == null ? null : undefined);

  ['holdings', 'closedTrades', 'history', 'gym', 'books', 'movies', 'series'].forEach(k => {
    if (arr(k) === undefined) errors.push(`"${k}" debe ser un array`);
    if (arr(k) === null) warnings.push(`"${k}" no existe en el archivo → se importa vacío`);
  });
  if (obj.watchlist != null && !Array.isArray(obj.watchlist)) errors.push('"watchlist" debe ser un array');
  if (obj.cash != null && (!isNum(obj.cash) || obj.cash < 0)) errors.push('"cash" debe ser un número ≥ 0');
  if (obj.totalInvested != null && (!isNum(obj.totalInvested) || obj.totalInvested < 0)) errors.push('"totalInvested" debe ser un número ≥ 0');

  // A partir de aquí solo se itera lo que de verdad es un array (los tipos
  // incorrectos ya están reportados arriba; sin esto un string crashearía)
  const safe = k => Array.isArray(obj[k]) ? obj[k] : [];

  safe('holdings').forEach((h, i) => {
    const id = `holdings[${i}]${h && h.ticker ? ' (' + h.ticker + ')' : ''}`;
    if (!h || typeof h !== 'object') { errors.push(`${id}: no es un objeto`); return; }
    if (!h.ticker || typeof h.ticker !== 'string') errors.push(`${id}: falta "ticker"`);
    if (!isNum(h.shares) || h.shares <= 0) errors.push(`${id}: "shares" debe ser > 0`);
    if (!isNum(h.entryPrice) || h.entryPrice <= 0) errors.push(`${id}: "entryPrice" debe ser > 0`);
    if (!CURRENCIES.includes(h.currency)) errors.push(`${id}: "currency" debe ser ${CURRENCIES.join('/')}`);
  });

  safe('closedTrades').forEach((t, i) => {
    const id = `closedTrades[${i}]${t && t.ticker ? ' (' + t.ticker + ')' : ''}`;
    if (!t || typeof t !== 'object') { errors.push(`${id}: no es un objeto`); return; }
    if (!t.ticker || typeof t.ticker !== 'string') errors.push(`${id}: falta "ticker"`);
    if (!isNum(t.totalShares) || t.totalShares <= 0) errors.push(`${id}: "totalShares" debe ser > 0`);
    if (!isNum(t.avgBuy) || t.avgBuy <= 0) errors.push(`${id}: "avgBuy" debe ser > 0`);
    if (!isNum(t.sellPrice) || t.sellPrice <= 0) errors.push(`${id}: "sellPrice" debe ser > 0`);
    if (!CURRENCIES.includes(t.currency)) errors.push(`${id}: "currency" debe ser ${CURRENCIES.join('/')}`);
  });

  if (obj.games != null && !Array.isArray(obj.games)) errors.push('games debe ser un array');
  safe('games').forEach((g, i) => {
    const error = validateGame(g);
    if (error) errors.push('games[' + i + ']: ' + error);
  });
  if (obj.games == null && (D.games || []).length) warnings.push('Sin videojuegos en este backup: se conservarán los actuales');
  const seen = new Set();
  let dupes = 0, badDates = 0;
  safe('history').forEach(h => {
    if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date || '') || !isNum(h.totalInvested) || !isNum(h.totalValue)) { badDates++; return; }
    if (seen.has(h.date)) dupes++;
    seen.add(h.date);
  });
  if (badDates) errors.push(`history: ${badDates} entradas sin fecha ISO o sin números válidos`);
  if (dupes) warnings.push(`history: ${dupes} fechas duplicadas → se conserva la última de cada fecha`);

  Object.keys(obj).forEach(k => {
    if (!KNOWN_KEYS.includes(k)) warnings.push(`clave desconocida "${k}" → se ignorará al guardar`);
  });

  // Nunca pisar datos buenos con un archivo vacío
  const empty = !safe('holdings').length && !safe('closedTrades').length
    && !safe('history').length && !obj.cash && !obj.totalInvested;
  const currentHasData = (D.holdings || []).length || (D.closedTrades || []).length
    || (D.history || []).length;
  if (empty && currentHasData) errors.push('El archivo no contiene datos de cartera: import bloqueado para no borrar los actuales');

  if (errors.length) return { ok: false, errors, warnings, data: null };

  // Normalizar: ordenar history y deduplicar por fecha (gana la última)
  const map = {};
  (obj.history || []).forEach(h => { map[h.date] = h; });
  const data = {
    ...lifeDefaults(obj, structuredClone(D)),
    holdings: obj.holdings || [], cash: obj.cash ?? 0, totalInvested: obj.totalInvested ?? 0,
    closedTrades: obj.closedTrades || [],
    history: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
    gym: obj.gym || [], books: obj.books || [], movies: obj.movies || [],
    series: obj.series || [], watchlist: obj.watchlist || [], games: obj.games ?? structuredClone(D.games || [])
  };
  return { ok: true, errors, warnings, data };
}

// ── Resumen de diferencias actual → importado ────────────────
function _summaryRows(data) {
  const cur = buildDataObj();
  const range = h => h.length
    ? `${h[0].date} → ${h[h.length - 1].date}`
    : '—';
  const curH = [...(cur.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  const rows = [
    ['Posiciones', cur.holdings.length, data.holdings.length],
    ['Trades cerrados', cur.closedTrades.length, data.closedTrades.length],
    ['Histórico (puntos)', curH.length, data.history.length],
    ['Histórico (rango)', range(curH), range(data.history)],
    ['Invertido (€)', F(cur.totalInvested || 0, 0), F(data.totalInvested || 0, 0)],
    ['Cash (€)', F(cur.cash || 0, 0), F(data.cash || 0, 0)],
    ['Gym / Books / Movies / Series',
      `${cur.gym.length} / ${cur.books.length} / ${cur.movies.length} / ${cur.series.length}`,
      `${data.gym.length} / ${data.books.length} / ${data.movies.length} / ${data.series.length}`],
    ['Sessions', (cur.workouts || []).length, (data.workouts || []).length],
    ['Games', (cur.games || []).length, data.games.length],
    ['Watchlist', (cur.watchlist || []).length, data.watchlist.length]
  ];
  return rows.map(([l, a, b]) => {
    const changed = String(a) !== String(b);
    return `<tr><td>${l}</td><td>${a}</td><td style="${changed ? 'color:var(--amber);font-weight:600' : ''}">${b}</td></tr>`;
  }).join('');
}

// ── Backup del estado actual antes de importar ───────────────
function _backupCurrent() {
  const json = JSON.stringify(buildDataObj());
  try { localStorage.setItem('trackmrp_db_data_preimport_backup', json); } catch (_) { /* quota */ }
  try {
    const blob = new Blob([JSON.stringify(buildDataObj(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trackmrp-backup-pre-import-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    return true;
  } catch (e) {
    console.warn('[import] backup download failed:', e);
    return false;
  }
}

let _pending = null;   // resultado validado a la espera de confirmación

// ── Modal ────────────────────────────────────────────────────
export function openImportModal() {
  if (!_authed) { toast('Inicia sesión para importar', 'err'); return; }
  _pending = null;
  const m = document.getElementById('mod');
  m.innerHTML = `<h2>Import Data (JSON)</h2>
    <p style="color:var(--text-dim);font-size:12px;margin-bottom:14px">
      Restaura un backup exportado desde la app (mismo formato que el botón de export).
      Antes de aplicar se descarga automáticamente un backup del estado actual.
    </p>
    <div class="fg"><label>Archivo .json</label><input type="file" id="impFile" accept=".json,application/json"></div>
    <div class="fg"><label>… o pega el JSON aquí</label>
      <textarea id="impText" style="min-height:70px" placeholder='{"holdings":[...], "history":[...] }'></textarea></div>
    <div id="impResult"></div>
    <div id="formErr" class="form-err"></div>
    <div class="m-btns">
      <button class="btn" onclick="window.closeModal()">Cancel</button>
      <button class="btn btn-g" id="impAnalyze">Analizar</button>
    </div>`;
  document.getElementById('ov').classList.add('open');

  document.getElementById('impAnalyze').addEventListener('click', _analyze);
}

async function _analyze() {
  const errEl = document.getElementById('formErr');
  errEl.style.display = 'none'; errEl.textContent = '';
  let text = '';
  const fileEl = document.getElementById('impFile');
  if (fileEl && fileEl.files && fileEl.files.length) {
    try { text = await fileEl.files[0].text(); }
    catch (e) { _err('No se pudo leer el archivo: ' + e.message); return; }
  } else {
    text = (document.getElementById('impText')?.value || '').trim();
  }
  if (!text) { _err('Elige un archivo o pega el JSON'); return; }

  let obj;
  try { obj = JSON.parse(text); }
  catch (e) { _err('JSON inválido: ' + e.message); return; }

  const res = validateImportObj(obj);
  const box = document.getElementById('impResult');
  if (!res.ok) {
    box.innerHTML = `<div style="background:var(--red-bg);border:1px solid var(--red);border-radius:10px;padding:12px;margin:10px 0;font-size:12px">
      <b style="color:var(--red)">No se puede importar:</b>
      <ul style="margin:6px 0 0 16px">${res.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    _pending = null;
    return;
  }
  _pending = res.data;
  const warn = res.warnings.length
    ? `<div style="background:var(--amber-bg);border:1px solid var(--amber);border-radius:10px;padding:10px;margin:10px 0;font-size:11px">
        ${res.warnings.map(w => `⚠ ${esc(w)}`).join('<br>')}</div>`
    : '';
  box.innerHTML = `${warn}
    <div class="tbl-wrap" style="margin:10px 0">
      <table style="font-size:12px"><thead><tr><th></th><th>Actual</th><th>Importado</th></tr></thead>
      <tbody>${_summaryRows(res.data)}</tbody></table>
    </div>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-dim);margin:10px 0">
      <input type="checkbox" id="impMerge" checked style="margin-top:2px">
      <span>Fusionar histórico: conservar también los puntos locales que no estén en el archivo (recomendado)</span>
    </label>
    <label style="display:flex;gap:8px;align-items:flex-start;font-size:12px;color:var(--text-dim);margin:10px 0">
      <input type="checkbox" id="impConfirm" style="margin-top:2px">
      <span><b>Entiendo que esto sustituye los datos actuales</b> (se descarga un backup antes y queda otra copia en este navegador)</span>
    </label>
    <div class="m-btns">
      <button class="btn btn-r" id="impApply" disabled>Importar y sincronizar</button>
    </div>`;
  document.getElementById('impConfirm').addEventListener('change', e => {
    document.getElementById('impApply').disabled = !e.target.checked;
  });
  document.getElementById('impApply').addEventListener('click', _apply);
}

async function _apply() {
  if (!_pending) return;
  const btn = document.getElementById('impApply');
  btn.disabled = true; btn.textContent = 'Importando…';

  _backupCurrent();

  const merge = !!document.getElementById('impMerge')?.checked;
  // merge=true: conserva puntos de history locales que no estén en el archivo
  // (loadDataFromObj fusiona D.history actual con el history importado)
  loadDataFromObj(_pending, merge);

  closeModal();
  renderPortfolio(); renderHistory(); renderTrades(); renderGym();
  renderGames(); renderBooks(); renderMovies(); renderSeries(); renderAnalytics(); renderWatchlist();

  const ok = await saveAndSync();
  toast(ok ? 'Datos importados y sincronizados' : 'Importado en local — sync pendiente', ok ? 'ok' : 'err');
  _pending = null;
}

function _err(msg) {
  const el = document.getElementById('formErr');
  el.textContent = msg;
  el.style.display = 'block';
}
