import { lifeDefaults } from './life-schema.js';
// ============================================================
//  storage.js — Operaciones con localStorage y datos D
// ============================================================
import { FALLBACK } from './config.js';
import { D, isFallbackState } from './state.js';

// Convierte el campo dividends de array legacy a número
export function _migrateDivs(arr) {
  if (!arr) return arr;
  arr.forEach(item => {
    if (Array.isArray(item.dividends)) {
      let total = 0;
      item.dividends.forEach(d => {
        total += (d.perShare || 0)
          * (d.shares || item.shares || item.totalShares || 0)
          * (1 - (d.withholdingPct || 0));
      });
      item.dividends = Math.round(total * 100) / 100;
    }
    if (item.dividends === undefined) item.dividends = 0;
  });
  return arr;
}

// Fusiona historial local y remoto evitando duplicados por fecha
export function _mergeHistory(local, remote) {
  if (!local || !local.length) return remote || [];
  if (!remote || !remote.length) return local || [];
  const map = {};
  local.forEach(h => { map[h.date] = h; });
  remote.forEach(h => {
    if (!map[h.date]) {
      map[h.date] = h;
    } else if (h.totalValue && h.totalValue !== map[h.date].totalValue) {
      map[h.date] = {
        date: h.date,
        totalInvested: h.totalInvested || map[h.date].totalInvested,
        totalValue: h.totalValue || map[h.date].totalValue
      };
    }
  });
  return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
}

// Hidrata el objeto D desde un objeto fuente (localStorage o GAS)
export function loadDataFromObj(obj, merge) {
  D.holdings     = _migrateDivs(obj.holdings     || FALLBACK.holdings);
  D.cash         = obj.cash         ?? FALLBACK.cash;
  D.totalInvested = obj.totalInvested ?? FALLBACK.totalInvested;
  D.closedTrades  = _migrateDivs(obj.closedTrades || FALLBACK.closedTrades);
  if (merge) D.history = _mergeHistory(D.history, obj.history || []);
  else        D.history = obj.history || FALLBACK.history || [];
  D.gym       = obj.gym       || FALLBACK.gym;
  D.books     = obj.books     || FALLBACK.books;
  D.movies    = obj.movies    || FALLBACK.movies;
  D.series    = obj.series    || FALLBACK.series;
  D.games = obj.games ?? D.games ?? [];
  D.watchlist = obj.watchlist || FALLBACK.watchlist;
  Object.assign(D, lifeDefaults(obj, D));
  document.dispatchEvent(new Event('data-loaded'));
}

// Serializa D a un objeto plano para guardar/enviar
export function buildDataObj() {
  return {
    ...lifeDefaults(D),
    holdings:     D.holdings,
    cash:         D.cash,
    totalInvested: D.totalInvested,
    closedTrades:  D.closedTrades,
    history:      D.history,
    gym:          D.gym,
    books:        D.books,
    movies:       D.movies,
    series:       D.series,
    games:        D.games || [],
    watchlist:    D.watchlist
  };
}

// Carga datos: localStorage → FALLBACK
export function loadData() {
  try {
    const s = localStorage.getItem('trackmrp_db_data');
    if (s) { loadDataFromObj(JSON.parse(s)); return; }
  } catch (e) {
    console.warn('loadData: error leyendo localStorage', e);
  }
  loadDataFromObj(FALLBACK);
}

// Guarda el estado actual en localStorage
export function saveLocal() {
  // GUARD: si D está vacío (FALLBACK) y ya hay un snapshot bueno en
  // localStorage, NO sobreescribir. Protege contra cold-start después
  // de borrar caché donde D se inicializa a FALLBACK antes de que el
  // cloud responda — sin este guard, ese FALLBACK se persistiría y
  // se perdería el último estado conocido.
  if (isFallbackState()) {
    try {
      const existing = localStorage.getItem('trackmrp_db_data');
      if (existing && existing !== '{}') {
        console.warn('[storage] saveLocal abortado: D vacío y db_data ya tiene contenido. Se preserva localStorage.');
        return;
      }
    } catch (_) { /* lectura puede fallar en modo privado */ }
  }
  try {
    localStorage.setItem('trackmrp_db_data', JSON.stringify(buildDataObj()));
  } catch (e) {
    console.warn('saveLocal: error escribiendo localStorage', e);
  }
}

// Actualiza el indicador visual de sincronización en el header
export function updateSyncStatus(state) {
  const el = document.getElementById('syncStatus');
  if (!el) return;
  if (state === 'ok') {
    el.textContent = 'Synced';
    el.style.color = 'var(--green)';
    el.style.borderColor = 'rgba(34,223,138,.3)';
  } else if (state === 'local') {
    el.textContent = 'Local';
    el.style.color = 'var(--text-dim)';
    el.style.borderColor = 'var(--border)';
  } else if (state === 'err') {
    el.textContent = 'Sync error';
    el.style.color = 'var(--amber)';
    el.style.borderColor = 'rgba(255,170,34,.3)';
  } else {
    el.textContent = '';
    el.style.borderColor = 'var(--border)';
  }
}
