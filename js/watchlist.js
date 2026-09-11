// ============================================================
//  watchlist.js — Watchlist de stocks con precio objetivo
// ============================================================
import { PROXY_URL } from './config.js';
import { D } from './state.js';
import { saveAndSync } from './cloud.js';

const F2 = v => isFinite(v) ? (Math.abs(v) < 10 ? v.toFixed(3) : v.toFixed(2)) : '—';

// Color según distancia al objetivo
// ≤ 0%: verde | 0–30%: naranja | > 30%: rojo | sin precio: muted
function _distColor(distPct, hasPrice) {
  if (!hasPrice) return 'var(--text-muted)';
  if (distPct <= 0)  return 'var(--green)';
  if (distPct <= 30) return 'var(--amber)';
  return 'var(--red)';
}

let _prices = {};
let _refreshing = false;

async function _pFetch(u) {
  const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(u)}`);
  if (!r.ok) throw new Error('Proxy:' + r.status);
  return r.json();
}

export async function refreshWatchlist() {
  if (_refreshing) return;
  _refreshing = true;
  const items = D.watchlist || [];
  if (!items.length) { _refreshing = false; renderWatchlist(); return; }

  const tickers = [...new Set(items.map(i => i.ticker))];
  await Promise.allSettled(tickers.map(async tk => {
    try {
      const d = await _pFetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(tk)}?range=1d&interval=5m`
      );
      const result = d.chart?.result?.[0];
      if (!result) return;
      const m = result.meta;
      let price = m.regularMarketPrice;
      let prev  = m.chartPreviousClose || m.previousClose;
      if (['GBp', 'GBX', 'GBx'].includes(m.currency)) { price /= 100; prev /= 100; }
      _prices[tk] = { price, prev };
    } catch (_) { /* mantener precio anterior si falla */ }
  }));

  _refreshing = false;
  renderWatchlist();
}

export function renderWatchlist() {
  const items = D.watchlist || [];
  const tbody = document.getElementById('wlBody');
  const empty = document.getElementById('wlEmpty');
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = '';
    return;
  }
  if (empty) empty.style.display = 'none';

  tbody.innerHTML = items.map((item, i) => {
    const pd       = _prices[item.ticker];
    const hasPrice = pd && isFinite(pd.price);
    const price    = hasPrice ? pd.price : null;
    const distPct  = hasPrice ? ((price - item.targetPrice) / item.targetPrice * 100) : null;
    const hit      = hasPrice && distPct <= 0;
    const color    = _distColor(distPct, hasPrice);
    const displayName = item.name || item.ticker;

    return `<tr data-wl-idx="${i}" style="${hit ? 'background:rgba(34,223,138,.07);' : ''}">
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${color}">
        ${displayName}
        ${hit ? '<span style="font-size:9px;background:rgba(34,223,138,.2);color:var(--green);border-radius:4px;padding:1px 5px;margin-left:6px;letter-spacing:.5px">TARGET</span>' : ''}
      </td>
      <td style="font-family:'IBM Plex Mono',monospace;font-weight:600;color:${color}">
        ${distPct != null ? (distPct >= 0 ? '+' : '') + distPct.toFixed(2) + '%' : '—'}
      </td>
      <td style="font-family:'IBM Plex Mono',monospace">
        ${hasPrice ? F2(price) : '<span style="color:var(--text-muted)">—</span>'}
        <span style="font-size:10px;color:var(--text-muted)">${item.currency}</span>
      </td>
      <td style="font-family:'IBM Plex Mono',monospace">
        ${F2(item.targetPrice)}
        <span style="font-size:10px;color:var(--text-muted)">${item.currency}</span>
      </td>
      <td>
        <button class="btn btn-sm wl-del-btn" data-wl-idx="${i}"
          style="padding:2px 8px;font-size:11px;color:var(--red);border-color:rgba(255,68,102,.3)"
          title="Remove">&#x2715;</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Modal de edición ─────────────────────────────────────────
function _openEditModal(idx) {
  const item = (D.watchlist || [])[idx];
  if (!item) return;
  const ov  = document.getElementById('ov');
  const mod = document.getElementById('mod');
  if (!ov || !mod) return;

  mod.innerHTML = `
    <h2 style="margin:0 0 20px;font-size:16px">Edit Watchlist Item</h2>
    <div class="fg"><label>Ticker</label>
      <input id="wlEditTicker" type="text" value="${item.ticker}" style="text-transform:uppercase">
    </div>
    <div class="fg"><label>Name</label>
      <input id="wlEditName" type="text" value="${item.name || ''}" placeholder="${item.ticker}">
    </div>
    <div class="fg"><label>Target price</label>
      <input id="wlEditTarget" type="number" value="${item.targetPrice}" step="0.001" min="0.001">
    </div>
    <div class="fg"><label>Currency</label>
      <select id="wlEditCurrency" class="input">
        <option value="USD" ${item.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option value="EUR" ${item.currency === 'EUR' ? 'selected' : ''}>EUR</option>
        <option value="GBP" ${item.currency === 'GBP' ? 'selected' : ''}>GBP</option>
        <option value="CAD" ${item.currency === 'CAD' ? 'selected' : ''}>CAD</option><option value="JPY" ${item.currency === 'JPY' ? 'selected' : ''}>JPY</option>
      </select>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      <button class="btn btn-g" id="wlEditSave" style="flex:1;justify-content:center">Save</button>
      <button class="btn" id="wlEditCancel" style="flex:1;justify-content:center">Cancel</button>
    </div>`;

  ov.style.display = 'flex';

  document.getElementById('wlEditCancel').addEventListener('click', () => {
    ov.style.display = 'none';
    mod.innerHTML = '';
  });

  document.getElementById('wlEditSave').addEventListener('click', () => {
    const ticker      = (document.getElementById('wlEditTicker').value || '').trim().toUpperCase();
    const name        = (document.getElementById('wlEditName').value   || '').trim();
    const targetPrice = parseFloat(document.getElementById('wlEditTarget').value);
    const currency    = document.getElementById('wlEditCurrency').value;
    if (!ticker || !isFinite(targetPrice) || targetPrice <= 0) return;
    D.watchlist[idx] = { ticker, name, targetPrice, currency };
    saveAndSync();
    ov.style.display = 'none';
    mod.innerHTML = '';
    renderWatchlist();
    refreshWatchlist();
  });
}

export function initWatchlist() {
  // ── Formulario de añadir ─────────────────────────────────
  const form = document.getElementById('wlForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ticker      = (document.getElementById('wlTicker').value  || '').trim().toUpperCase();
      const targetPrice = parseFloat(document.getElementById('wlTarget').value);
      const currency    = document.getElementById('wlCurrency').value || 'USD';
      const name        = (document.getElementById('wlName').value    || '').trim();
      if (!ticker || !isFinite(targetPrice) || targetPrice <= 0) return;
      if (!D.watchlist) D.watchlist = [];
      D.watchlist.push({ ticker, targetPrice, currency, name });
      saveAndSync();
      form.reset();
      document.getElementById('wlCurrency').value = 'USD';
      renderWatchlist();
      refreshWatchlist();
    });
  }

  // ── Delegación: click en fila (edit) o botón eliminar ───
  document.addEventListener('click', e => {
    // Botón eliminar
    const delBtn = e.target.closest('.wl-del-btn');
    if (delBtn) {
      e.stopPropagation();
      const idx = parseInt(delBtn.dataset.wlIdx);
      if (!D.watchlist || isNaN(idx) || idx < 0 || idx >= D.watchlist.length) return;
      D.watchlist.splice(idx, 1);
      saveAndSync();
      renderWatchlist();
      return;
    }

    // Click en fila en modo edición → abrir modal
    if (!document.body.classList.contains('edit-mode')) return;
    const row = e.target.closest('tr[data-wl-idx]');
    if (!row || !row.closest('#wlTable')) return;
    _openEditModal(parseInt(row.dataset.wlIdx));
  });
}
