// ============================================================
//  portfolio.js — Cotizaciones, FX y render del portfolio
// ============================================================
import { PROXY_URL } from './config.js';
import { D } from './state.js';
import { _authed } from './state.js';
import { F, ttOpts, legOpts, gradFill, centerTextPlugin, crosshairPlugin, monthlyReturns } from './utils.js';
import { saveAndSync } from './cloud.js';

// ── Precio y FX en memoria (persisten en localStorage) ──────
let P = {};
let FX = { USD: null, CAD: null, GBP: null, JPY: null };
let CH = {};
let _refreshing = false;
let _monthlyPage = 1;
const _monthlyPerPage = 12;
let _monthlyTotalPages = 1;

// Restaurar caché del portfolio al cargar el módulo
try {
  const cp = localStorage.getItem('trackmrp_pf_p');
  const cf = localStorage.getItem('trackmrp_pf_fx');
  if (cp) {
    P = JSON.parse(cp);
    Object.values(P).forEach(v => { if (v.ts) v.ts = v.ts.map(t => new Date(t)); });
  }
  if (cf) {
    const fx = JSON.parse(cf);
    if (fx.USD) FX = fx;
  }
} catch (e) { /* noop */ }

// ── Delegación para paginación mensual ──────────────────────
document.addEventListener('click', function (e) {
  const btn = e.target.closest('[data-monthly-action]');
  if (!btn) return;
  const action = btn.dataset.monthlyAction;
  if (action === 'first') _monthlyPage = 1;
  else if (action === 'prev') _monthlyPage = Math.max(1, _monthlyPage - 1);
  else if (action === 'next') _monthlyPage = Math.min(_monthlyTotalPages, _monthlyPage + 1);
  else if (action === 'last') _monthlyPage = _monthlyTotalPages;
  else _monthlyPage = parseInt(action) || 1;
  renderMonthlyTable();
});

// ── Helpers de FX ───────────────────────────────────────────
const _FX_FALLBACK = { USD: 0.92, CAD: 0.68, GBP: 1.17, JPY: 0.006 };
export function fxR(c) { return c === 'EUR' ? 1 : (FX[c] || _FX_FALLBACK[c] || 1); }
export function valEur(h) {
  const d = P[h.ticker];
  if (!d || !isFinite(d.price)) return 0;
  return d.price * h.shares * fxR(h.currency);
}
export function getPriceData(ticker) { return P[ticker] || null; }

// ── Fetch interno a través del GAS proxy ────────────────────
async function pFetch(u) {
  const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(u)}`);
  if (!r.ok) throw new Error('Proxy:' + r.status);
  return r.json();
}

export async function fetchStock(tk) {
  const d = await pFetch(`https://query1.finance.yahoo.com/v8/finance/chart/${tk}?range=1d&interval=5m`);
  const result = d.chart.result[0], m = result.meta, q = result.indicators.quote[0];
  let price = m.regularMarketPrice, prev = m.chartPreviousClose || m.previousClose;
  let cls = q.close || [], his = (q.high || []).filter(v => v != null), los = (q.low || []).filter(v => v != null);
  if (['GBp', 'GBX', 'GBx'].includes(m.currency)) {
    price /= 100; prev /= 100;
    cls = cls.map(v => v != null ? v / 100 : null);
    his = his.map(v => v / 100);
    los = los.map(v => v / 100);
  }
  return {
    ticker: tk, price, prev,
    high: his.length ? Math.max(...his) : price,
    low: los.length ? Math.min(...los) : price,
    ts: (result.timestamp || []).map(t => new Date(t * 1000)),
    cls,
    wk52High: isFinite(m.fiftyTwoWeekHigh) ? (m.currency && ['GBp','GBX','GBx'].includes(m.currency) ? m.fiftyTwoWeekHigh / 100 : m.fiftyTwoWeekHigh) : null,
    wk52Low:  isFinite(m.fiftyTwoWeekLow)  ? (m.currency && ['GBp','GBX','GBx'].includes(m.currency) ? m.fiftyTwoWeekLow  / 100 : m.fiftyTwoWeekLow)  : null,
    _stale: !isFinite(price)
  };
}

// ── Fundamentales: P/E y Dividend Yield (batch Yahoo v7/quote) ──
async function fetchFundamentals(tickers) {
  if (!tickers.length) return {};
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${tickers.join(',')}`;
    const data = await pFetch(url);
    const result = {};
    (data.quoteResponse?.result || []).forEach(q => {
      result[q.symbol] = {
        pe: isFinite(q.trailingPE) ? q.trailingPE : null,
        divYield: isFinite(q.dividendYield) && q.dividendYield > 0 ? q.dividendYield * 100 : null,
        wk52High: isFinite(q.fiftyTwoWeekHigh) ? q.fiftyTwoWeekHigh : null,
        wk52Low:  isFinite(q.fiftyTwoWeekLow)  ? q.fiftyTwoWeekLow  : null,
      };
    });
    return result;
  } catch (_) { return {}; }
}

export async function fetchFx() {
  // Primero: pares FX de Yahoo Finance via proxy (más actualizado)
  try {
    const url = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=USDEUR%3DX,CADEUR%3DX,GBPEUR%3DX,JPYEUR%3DX';
    const data = await pFetch(url);
    const found = {};
    (data.quoteResponse?.result || []).forEach(q => { found[q.symbol] = q.regularMarketPrice; });
    if (['USDEUR=X', 'CADEUR=X', 'GBPEUR=X', 'JPYEUR=X'].every(k => Number.isFinite(found[k]) && found[k] > 0)) {
      FX.USD = found['USDEUR=X'];
      FX.CAD = found['CADEUR=X'];
      FX.GBP = found['GBPEUR=X'];
      FX.JPY = found['JPYEUR=X'];
      return;
    }
  } catch (e) { /* si el proxy falla, usa fuentes alternativas */ }
  // Segundo: exchangerate-api.com (libre, sin clave)
  try {
    const d = await (await fetch('https://api.exchangerate-api.com/v4/latest/EUR')).json();
    if (!['USD','CAD','GBP','JPY'].every(c => Number.isFinite(d.rates?.[c]) && d.rates[c] > 0)) throw new Error('Incomplete FX rates');
    for (const c of ['USD','CAD','GBP','JPY']) FX[c] = 1 / d.rates[c];
    return;
  } catch (e) { /* fallback */ }
  // Tercero: open.er-api.com
  try {
    const d = await (await fetch('https://open.er-api.com/v6/latest/EUR')).json();
    if (!['USD','CAD','GBP','JPY'].every(c => Number.isFinite(d.rates?.[c]) && d.rates[c] > 0)) throw new Error('Incomplete FX rates');
    for (const c of ['USD','CAD','GBP','JPY']) FX[c] = 1 / d.rates[c];
    return;
  } catch (e) { /* noop */ }
  // Fallback estático (solo si todo lo anterior falla y no hay valor previo)
  if (!FX.USD) { FX.USD = 0.92; FX.CAD = 0.68; FX.GBP = 1.17; }
}

// ── Actualización completa de precios ───────────────────────
export async function refreshPortfolio() {
  if (_refreshing) return;
  _refreshing = true;
  const dot = document.getElementById('dot'), tsE = document.getElementById('ts');
  dot.style.background = 'var(--amber)';
  tsE.textContent = 'Updating...';
  if (Object.keys(P).length) renderPortfolio();
  else rSkeletons();

  let fxOk = false;
  try { await fetchFx(); fxOk = true; } catch (e) { /* noop */ }
  if (!FX.USD) { FX.USD = 0.86; FX.CAD = 0.63; FX.GBP = 1.17; }

  const res = await Promise.allSettled(D.holdings.map(h => fetchStock(h.ticker)));
  let allOk = true;
  res.forEach((r, i) => {
    if (r.status === 'fulfilled') P[D.holdings[i].ticker] = r.value;
    else { if (P[D.holdings[i].ticker]) P[D.holdings[i].ticker]._stale = true; allOk = false; }
  });

  // Enriquecer con P/E, Dividend Yield y 52-semanas vía Yahoo v7 (batch)
  const tks = D.holdings.map(h => h.ticker).filter(Boolean);
  fetchFundamentals(tks).then(fund => {
    Object.entries(fund).forEach(([ticker, f]) => {
      if (P[ticker]) {
        // v7 52wk prevalece si más preciso; P/E y yield solo de v7
        if (f.wk52High != null) P[ticker].wk52High = f.wk52High;
        if (f.wk52Low  != null) P[ticker].wk52Low  = f.wk52Low;
        P[ticker].pe       = f.pe;
        P[ticker].divYield = f.divYield;
      }
    });
    renderPortfolio(); // re-render con datos enriquecidos
  }).catch(() => { /* non-blocking */ });

  try {
    localStorage.setItem('trackmrp_pf_p', JSON.stringify(
      Object.fromEntries(Object.entries(P).map(([k, v]) => [k, { ...v, ts: v.ts ? v.ts.map(d => d.toISOString()) : [] }]))
    ));
    localStorage.setItem('trackmrp_pf_fx', JSON.stringify(FX));
  } catch (e) { /* storage full */ }

  renderPortfolio();

  // GUARD: no generar snapshot si D está vacío (cold-start con
  // localStorage limpio). Sin este guard, refreshPortfolio puede
  // llamar saveAndSync() con D=FALLBACK y nukear el cloud antes
  // de que fetchDataFromCloud traiga los datos buenos.
  const _hasRealData = D.holdings.length > 0 || (D.cash || 0) > 0 || (D.totalInvested || 0) > 0 || (D.closedTrades || []).length > 0;

  // Snapshot diario (solo días laborables, zona Europe/Amsterdam)
  if (allOk && fxOk && _hasRealData) {
    const euNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Amsterdam' }));
    const dow = euNow.getDay();
    if (dow !== 0 && dow !== 6) {
      const todayStr = euNow.getFullYear() + '-'
        + String(euNow.getMonth() + 1).padStart(2, '0') + '-'
        + String(euNow.getDate()).padStart(2, '0');
      if (!D.history) D.history = [];
      const already = D.history.find(h => h.date === todayStr);
      let totalVal = D.cash;
      D.holdings.forEach(h => {
        const d = P[h.ticker];
        if (d && isFinite(d.price)) totalVal += d.price * h.shares * fxR(h.currency);
      });
      if (!already) {
        D.history.push({ date: todayStr, totalInvested: D.totalInvested, totalValue: Math.round(totalVal * 100) / 100 });
        saveAndSync();
      } else {
        const oldVal = already.totalValue;
        already.totalValue = Math.round(totalVal * 100) / 100;
        already.totalInvested = D.totalInvested;
        if (oldVal !== already.totalValue) saveAndSync();
      }
    }
    renderHistory();
  }

  dot.style.background = (allOk && fxOk) ? 'var(--green)' : 'var(--amber)';
  const now = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  tsE.textContent = (allOk && fxOk) ? now : now + ' (Parcial)';
  _refreshing = false;
}

// ── Render completo del portfolio ───────────────────────────
export function renderPortfolio() { rHero(); rStocks(); rDonut(); rBar(); }

// ── Skeleton loaders (mientras la API responde) ──────────────
function rSkeletons() {
  const g = document.getElementById('sGrid');
  const count = D.holdings.length || 3;
  g.innerHTML = Array(count).fill(`
    <div class="stock-skeleton">
      <div class="sk-line sk-lg skeleton"></div>
      <div class="sk-line sk-sm skeleton" style="width:45%;margin-top:4px"></div>
      <div class="sk-line sk-xl skeleton" style="margin-top:8px"></div>
      <div class="sk-grid">
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
        <div class="sk-block skeleton"></div>
      </div>
    </div>`).join('');
}

function rHero() {
  let t = D.cash;
  D.holdings.forEach(h => { t += valEur(h); });
  document.getElementById('hVal').innerHTML = `${F(t)} &euro;`;
  const inv = D.totalInvested, tRoi = t - inv, tPct = (tRoi / inv) * 100, tPos = tRoi >= 0;
  document.getElementById('hRoi').innerHTML = `
    <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-dim);margin-bottom:6px">Invested: ${F(inv)} &euro;</div>
    <div style="font-family:'IBM Plex Mono',monospace;font-size:15px;font-weight:600;margin-bottom:14px;color:var(--${tPos ? 'green' : 'red'})">ROI: ${tPos ? '+' : ''}${F(tPct)}% | ${tPos ? '+' : ''}${F(tRoi)} &euro;</div>`;
}

function rStocks() {
  const g = document.getElementById('sGrid');
  g.innerHTML = '';
  let totalPV = D.cash;
  D.holdings.forEach(h => { totalPV += valEur(h); });
  const sorted = D.holdings.map((h, i) => ({ h, i, ve: valEur(h) })).sort((a, b) => b.ve - a.ve);
  sorted.forEach(({ h, i: hi }) => {
    const d = P[h.ticker];
    const dOk = d && isFinite(d.price);
    const chg = dOk ? (d.price - d.prev) : 0, pct = dOk && d.prev ? (chg / d.prev) * 100 : 0, pos = chg >= 0;
    const ve = dOk ? d.price * h.shares * fxR(h.currency) : 0;
    const tc = h.currency === 'USD' ? 'tag-usd' : h.currency === 'CAD' ? 'tag-cad' : 'tag-gbp';
    const staleTag = dOk && d._stale ? '<span class="tag" style="background:rgba(255,170,34,.12);color:var(--amber);margin-left:4px">STALE</span>' : '';
    const noData = !dOk ? '<span class="tag" style="background:rgba(255,68,102,.12);color:var(--red);margin-left:4px">NO DATA</span>' : '';
    const divNetEur = (h.dividends || 0) * fxR(h.currency);
    const hRoiAbsEur = dOk ? (d.price - h.entryPrice) * h.shares * fxR(h.currency) + divNetEur : 0;
    const totalInv = h.entryPrice * h.shares * fxR(h.currency);
    const hRoiPct = totalInv > 0 ? (hRoiAbsEur / totalInv) * 100 : 0;
    const hPos = hRoiAbsEur >= 0;
    const pctOfPortfolio = totalPV > 0 ? (ve / totalPV) * 100 : 0;
    const el = document.createElement('div');
    el.className = 'stock';
    if (dOk && d._stale) el.style.opacity = '0.7';
    if (!dOk) el.style.opacity = '0.55';
    const _inEditMode = document.body.classList.contains('edit-mode');
    if (_inEditMode) { el.dataset.editType = 'holding'; el.dataset.editIdx = hi; el.style.cursor = 'pointer'; }
    else { el.dataset.detailIdx = hi; el.style.cursor = 'pointer'; }
    // ── Barra de rango 52 semanas ────────────────────────────────
    const has52 = dOk && d.wk52High != null && d.wk52Low != null && d.wk52High > d.wk52Low;
    const pct52 = has52 ? Math.round(Math.max(0, Math.min(100, (d.price - d.wk52Low) / (d.wk52High - d.wk52Low) * 100))) : null;
    const wk52html = has52 ? `
      <div class="s-wk52">
        <span>${F(d.wk52Low)}</span>
        <div class="s-wk52-track"><div class="s-wk52-fill" style="width:${pct52}%"></div></div>
        <span>${F(d.wk52High)}</span>
      </div>` : '';
    const fundTags = dOk ? [
      d.pe       ? `<span class="tag tag-pe">P/E  ${F(d.pe, 1)}</span>` : '',
      d.divYield ? `<span class="tag tag-yield">Yield ${F(d.divYield, 2)}%</span>` : ''
    ].join('') : '';
    const fundHtml = fundTags ? `<div class="s-fund-tags">${fundTags}</div>` : '';

    el.innerHTML = `
      <div class="s-top"><div>
        <div class="s-tk">${h.ticker} <span class="tag ${tc}">${h.exchange}</span>${staleTag}${noData}</div>
        <div class="s-nm">${h.name}</div>
        <div class="s-pr" style="margin:6px 0 0">${dOk ? F(d.price) : '--'} <span class="cur">${h.currency}</span></div>
      </div>
      ${dOk ? `<div class="s-chg" style="text-align:right">
        <div style="font-size:9px;color:var(--text);text-transform:uppercase;letter-spacing:1px;font-weight:600;margin-bottom:3px">Daily</div>
        <div class="pct ${pos ? 'up' : 'dn'}">${pos ? '+' : ''}${F(pct)}%</div>
        <div class="abs ${pos ? 'up' : 'dn'}" style="font-size:11px">${pos ? '+' : ''}${F(chg)} ${h.currency}</div>
        <div style="font-size:10px;color:var(--text-muted);margin-top:4px">${F(d.low)} \u2013 ${F(d.high)}</div>
      </div>` : ''}</div>
      ${wk52html}${fundHtml}
      <div class="s-meta">
        <div><div class="ml">Shares</div><div class="mv">${h.shares.toLocaleString('de-DE')}</div></div>
        <div><div class="ml">Value (EUR)</div><div class="mv ${dOk ? 'up' : ''}">${dOk ? F(ve) + ' \u20ac' : '--'}</div></div>
        <div><div class="ml">Dividends (${h.currency})</div><div class="mv ${(h.dividends || 0) > 0 ? 'up' : ''}">${(h.dividends || 0) > 0 ? '+' + F(h.dividends) + ' ' + h.currency : '\u2014'}</div></div>
        <div><div class="ml">% of Portfolio</div><div class="mv">${dOk ? F(pctOfPortfolio, 1) + '%' : '--'}</div></div>
        <div><div class="ml">Avg Price</div><div class="mv">${F(h.entryPrice)} <span style="font-size:10px;color:var(--text-dim)">${h.currency}</span></div></div>
        <div><div class="ml">Total Return</div><div class="mv ${dOk ? (hPos ? 'up' : 'dn') : ''}">${dOk ? (hPos ? '+' : '') + F(hRoiPct) + '% <span style="font-size:10px;">(' + (hPos ? '+' : '') + F(hRoiAbsEur) + ' \u20ac)</span>' : '--'}</div></div>
      </div>`;
    g.appendChild(el);
  });
  if (D.cash > 0 || _authed) {
    const cel = document.createElement('div');
    cel.className = 'stock';
    const _inEditModeCash = document.body.classList.contains('edit-mode');
    if (_inEditModeCash) { cel.dataset.editType = 'cash'; cel.style.cursor = 'pointer'; }
    cel.innerHTML = `<div class="s-top"><div>
      <div class="s-tk" style="color:#a0a0b8">CASH <span class="tag" style="background:rgba(160,160,184,.12);color:#a0a0b8">EUR</span></div>
      <div class="s-nm">Cash & totals${_inEditModeCash ? ' \u00b7 click to edit' : ''}</div>
    </div></div>
    <div class="s-pr">${F(D.cash)} <span class="cur">EUR</span></div>`;
    g.appendChild(cel);
  }
}

function rDonut() {
  const ctx = document.getElementById('cD').getContext('2d');
  if (CH.d) CH.d.destroy();
  const dItems = [
    ...D.holdings.map(h => ({ tk: h.ticker, val: valEur(h), color: h.color })),
    { tk: 'Cash', val: D.cash, color: '#667788' }
  ].sort((a, b) => b.val - a.val);
  const dTotal = dItems.reduce((a, b) => a + b.val, 0);
  CH.d = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: dItems.map(i => i.tk),
      datasets: [{
        data: dItems.map(i => i.val),
        backgroundColor: dItems.map(i => i.color),
        borderColor: '#0d0d1a',
        borderWidth: 4,
        hoverBorderWidth: 4,
        hoverOffset: 10,
        spacing: 2,
        borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '72%',
      animation: { animateRotate: true, animateScale: true, duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: legOpts },
        tooltip: { ...ttOpts, callbacks: { label: c => { const pct = dTotal > 0 ? (c.parsed / dTotal * 100) : 0; return ` ${c.label}: ${F(c.parsed)} \u20ac (${F(pct, 1)}%)`; } } },
        centerText: { label: 'Total', value: F(dTotal, 0) + ' \u20ac' }
      }
    },
    plugins: [centerTextPlugin]
  });
}

function rBar() {
  const ctx = document.getElementById('cB').getContext('2d');
  const items = [
    ...D.holdings.map(h => ({ tk: h.ticker, val: valEur(h), color: h.color })),
    { tk: 'Cash', val: D.cash, color: '#667788' }
  ].sort((a, b) => b.val - a.val);
  if (CH.b) CH.b.destroy();
  CH.b = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map(i => i.tk),
      datasets: [{
        data: items.map(i => i.val),
        backgroundColor: items.map(i => i.color + 'cc'),
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.78,
        categoryPercentage: 0.85,
        hoverBackgroundColor: items.map(i => i.color)
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, indexAxis: 'y',
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${F(c.parsed.x)} \u20ac` } } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac', padding: 8 }
        },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 11, weight: '600' }, padding: 6 }
        }
      }
    }
  });
}

// ── Historial y tabla mensual ────────────────────────────────
export function renderHistory() { renderHistoryChart(); renderMonthlyTable(); }

// Selector de período de la gráfica de histórico
document.getElementById('historyBtns')?.addEventListener('click', e => {
  const btn = e.target.closest('.bench-btn');
  if (!btn) return;
  document.querySelectorAll('#historyBtns .bench-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderHistoryChart();
});

function renderHistoryChart() {
  if (!D.history || !D.history.length) return;
  let sorted = [...D.history].sort((a, b) => a.date.localeCompare(b.date));

  // Período seleccionado (mismos botones que el benchmark)
  const period = document.querySelector('#historyBtns .active')?.dataset.period || 'all';
  if (period !== 'all') {
    const d = new Date();
    if (period === '1y') d.setFullYear(d.getFullYear() - 1);
    else if (period === '6m') d.setMonth(d.getMonth() - 6);
    else if (period === '3m') d.setMonth(d.getMonth() - 3);
    else d.setMonth(d.getMonth() - 1);
    const cut = d.toISOString().slice(0, 10);
    const filtered = sorted.filter(h => h.date >= cut);
    if (filtered.length >= 2) sorted = filtered;
  }

  let sampled;
  if (period !== 'all' || sorted.length <= 90) {
    // Períodos acotados: todos los puntos diarios (máx ~260 en 1Y, Chart.js lo lleva bien)
    sampled = sorted;
  } else {
    // ALL: semanal hasta ~4 años de datos; quincenal a partir de ahí.
    // El último punto real siempre entra (es el valor de "hoy").
    const bucket = sorted.length <= 1000 ? 7 : 14;
    sampled = [];
    let i = 0;
    while (i < sorted.length) {
      const chunk = sorted.slice(i, i + bucket);
      const last = chunk[chunk.length - 1];
      sampled.push({ date: last.date, totalInvested: last.totalInvested, totalValue: last.totalValue });
      i += bucket;
    }
  }
  // Eje X: en vistas largas manda mes+año ("ene 25") — con solo día+mes no se
  // sabía de qué año era cada punto. En 3M/1M el día sí aporta.
  const fmt = (period === '3m' || period === '1m')
    ? { day: 'numeric', month: 'short' }
    : { month: 'short', year: '2-digit' };
  const labels = sampled.map(h => new Date(h.date).toLocaleDateString('es-ES', fmt));
  const invested = sampled.map(h => h.totalInvested);
  const values = sampled.map(h => h.totalValue);
  const ctx = document.getElementById('cHistory').getContext('2d');
  if (CH.history) CH.history.destroy();
  CH.history = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Invested', data: invested,
          borderColor: '#22df8a', backgroundColor: gradFill('#22df8a', '20', '00'),
          fill: true, tension: .1, borderWidth: 2, borderDash: [6, 4],
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#22df8a', pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3
        },
        {
          label: 'Portfolio Value', data: values,
          borderColor: '#5588ff', backgroundColor: gradFill('#5588ff', '50', '00'),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#5588ff', pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { labels: legOpts },
        tooltip: {
          ...ttOpts, callbacks: {
            label: c => ` ${c.dataset.label}: ${F(c.parsed.y)} \u20ac`,
            afterBody: function (ctx) {
              const i = ctx[0].dataIndex;
              const inv = invested[i], val = values[i];
              if (inv > 0) { const r = ((val - inv) / inv) * 100; return `  Return: ${r >= 0 ? '+' : ''}${F(r)}%`; }
              return '';
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: 'rgba(255,255,255,.06)' },
          ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 14, padding: 8 }
        },
        y: {
          type: 'linear',
          grid: { color: 'rgba(255,255,255,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#a0a0b8', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' \u20ac', padding: 10 }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}

function renderMonthlyTable() {
  if (!D.history || !D.history.length) {
    document.getElementById('monthlyTable').innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:30px">No history yet. Data is recorded daily on each page load.</p>';
    document.getElementById('monthlyPag').innerHTML = '';
    return;
  }
  const sorted = [...D.history].sort((a, b) => a.date.localeCompare(b.date));
  const months = {};
  sorted.forEach(h => {
    const mk = h.date.substring(0, 7);
    if (!months[mk]) months[mk] = { key: mk, entries: [] };
    months[mk].entries.push(h);
  });
  // P&L de mercado del mes y retorno sobre el valor inicial
  const twr = {};
  monthlyReturns(D.history).forEach(m => { twr[m.key] = m; });
  const mList = Object.values(months).sort((a, b) => b.key.localeCompare(a.key));
  _monthlyTotalPages = Math.max(1, Math.ceil(mList.length / _monthlyPerPage));
  if (_monthlyPage > _monthlyTotalPages) _monthlyPage = _monthlyTotalPages;
  const start = (_monthlyPage - 1) * _monthlyPerPage;
  const page = mList.slice(start, start + _monthlyPerPage);
  let rows = '';
  page.forEach(m => {
    const last = m.entries[m.entries.length - 1];
    const fullIdx = mList.indexOf(m);
    const prevMonth = fullIdx < mList.length - 1 ? mList[fullIdx + 1] : null;
    const startVal = prevMonth ? prevMonth.entries[prevMonth.entries.length - 1].totalValue : m.entries[0].totalValue;
    const endVal = last.totalValue;
    const t = twr[m.key] || { ret: 0, pnl: 0 };
    const totalRet = last.totalInvested > 0 ? ((endVal - last.totalInvested) / last.totalInvested) * 100 : 0;
    const pos = t.pnl >= 0, rPos = t.ret >= 0, tPos = totalRet >= 0;
    const [y, mo] = m.key.split('-');
    const mName = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    rows += `<tr>
      <td style="font-weight:600">${mName}</td>
      <td>${F(startVal)} \u20ac</td><td>${F(endVal)} \u20ac</td>
      <td class="${pos ? 'up' : 'dn'}" style="font-weight:600">${pos ? '+' : ''}${F(t.pnl)} \u20ac</td>
      <td class="${rPos ? 'up' : 'dn'}" style="font-weight:600">${rPos ? '+' : ''}${F(t.ret)}%</td>
      <td class="${tPos ? 'up' : 'dn'}">${tPos ? '+' : ''}${F(totalRet)}%</td>
    </tr>`;
  });
  document.getElementById('monthlyTable').innerHTML = `<table><thead><tr><th>Month</th><th>Start Value</th><th>End Value</th><th title="P&L de mercado del mes, aportaciones excluidas">Market P&L</th><th title="P&L de mercado del mes sobre el valor al empezarlo (las aportaciones no cuentan como ganancia)">Monthly %</th><th>All-Time %</th></tr></thead><tbody>${rows}</tbody></table>`;

  if (_monthlyTotalPages <= 1) { document.getElementById('monthlyPag').innerHTML = ''; return; }
  let pg = '';
  pg += `<button class="btn btn-sm" data-monthly-action="first" ${_monthlyPage === 1 ? 'disabled' : ''}>\u00ab</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="prev" ${_monthlyPage === 1 ? 'disabled' : ''}>\u2039</button>`;
  const maxShow = 5;
  let s = Math.max(1, _monthlyPage - Math.floor(maxShow / 2));
  let e = Math.min(_monthlyTotalPages, s + maxShow - 1);
  s = Math.max(1, e - maxShow + 1);
  for (let i = s; i <= e; i++) pg += `<button class="btn btn-sm${i === _monthlyPage ? ' btn-g' : ''}" data-monthly-action="${i}">${i}</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="next" ${_monthlyPage === _monthlyTotalPages ? 'disabled' : ''}>\u203a</button>`;
  pg += `<button class="btn btn-sm" data-monthly-action="last" ${_monthlyPage === _monthlyTotalPages ? 'disabled' : ''}>\u00bb</button>`;
  document.getElementById('monthlyPag').innerHTML = pg;
}

// ── Accordion inline: detalle de holding (modo lectura) ──────
export function toggleHoldingDetail(cardEl, holdingIdx) {
  const next = cardEl.nextElementSibling;
  const alreadyOpen = next && next.classList.contains('accordion-pane') && next.dataset.accIdx == holdingIdx;

  // Cerrar todos los paneles existentes
  document.querySelectorAll('.accordion-pane').forEach(p => p.remove());
  document.querySelectorAll('.stock.accordion-open').forEach(s => s.classList.remove('accordion-open'));

  if (alreadyOpen) return; // toggle off

  const h = D.holdings[holdingIdx];
  if (!h) return;
  const pd = P[h.ticker];
  const dOk = pd && isFinite(pd.price);
  const chg = dOk ? pd.price - pd.prev : 0;
  const pct = dOk && pd.prev ? (chg / pd.prev) * 100 : 0;
  const pos = chg >= 0;
  const ve = dOk ? pd.price * h.shares * fxR(h.currency) : 0;
  const hRoiAbs = dOk ? (pd.price - h.entryPrice) * h.shares * fxR(h.currency) : 0;
  const hRoiPct = h.entryPrice > 0 ? ((pd.price - h.entryPrice) / h.entryPrice) * 100 : 0;
  const has52 = dOk && pd.wk52High != null && pd.wk52Low != null && pd.wk52High > pd.wk52Low;
  const pct52 = has52 ? Math.round(Math.max(0, Math.min(100, (pd.price - pd.wk52Low) / (pd.wk52High - pd.wk52Low) * 100))) : null;

  const closedForTicker = (D.closedTrades || []).filter(t => t.ticker === h.ticker);
  const histRows = closedForTicker.map(t => {
    const rp = t.realizedPnl != null ? t.realizedPnl : (t.sellPrice - t.avgBuy) * t.totalShares;
    const rpPos = rp >= 0;
    return `<div class="detail-hist-row">
      <span style="color:var(--text-dim)">${t.sellDate || '—'}</span>
      <span>${t.totalShares} @ ${F(t.sellPrice)} ${t.currency}</span>
      <span class="${rpPos ? 'up' : 'dn'}" style="font-weight:600">${rpPos ? '+' : ''}${F(rp)} ${t.currency}</span>
    </div>`;
  }).join('') || '<div style="color:var(--text-muted);font-size:12px;padding:6px 0">No closed trades for this ticker</div>';

  const chip = (lbl, val) => val ? `<span class="detail-chip"><span style="opacity:.65">${lbl}</span>\u00a0<strong>${val}</strong></span>` : '';

  const pane = document.createElement('div');
  pane.className = 'accordion-pane';
  pane.dataset.accIdx = holdingIdx;
  pane.innerHTML = `
    <div class="acc-header">
      <div>
        <span class="acc-ticker" style="color:${h.color}">${h.ticker}</span>
        <span style="font-size:12px;color:var(--text-muted);margin-left:10px">${h.name}</span>
      </div>
      <button class="acc-close" id="accClose_${holdingIdx}" title="Close">&#x2715;</button>
    </div>
    ${dOk ? `<div style="margin-bottom:10px">
      <span style="font-family:'IBM Plex Mono',monospace;font-size:18px;font-weight:700">${F(pd.price)} <span style="font-size:12px;color:var(--text-muted)">${h.currency}</span></span>
      <span style="font-size:13px;font-weight:600;color:var(--${pos ? 'green' : 'red'});margin-left:10px">${pos ? '+' : ''}${F(chg)} &nbsp;${pos ? '+' : ''}${F(pct)}%</span>
    </div>` : ''}
    <div class="acc-chips">
      ${dOk && pd.pe ? `<span class="detail-chip">P/E&nbsp;<strong>${F(pd.pe, 1)}</strong></span>` : ''}
      ${dOk && pd.divYield ? `<span class="detail-chip">Yield&nbsp;<strong>${F(pd.divYield, 2)}%</strong></span>` : ''}
      ${has52 ? `<span class="detail-chip" title="Posición del precio actual respecto al rango 52 semanas (Low: ${F(pd.wk52Low)} / High: ${F(pd.wk52High)})">52w&nbsp;${F(pd.wk52Low)}&ndash;${F(pd.wk52High)}&nbsp;(${pct52}%)</span>` : ''}
      ${chip('Sector', h.sector)}
      ${chip('Broker', h.broker)}
      ${chip('Buy date', h.buyDate)}
    </div>
    <div class="acc-grid">
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Shares</div><div class="sum-val">${h.shares.toLocaleString('de-DE')}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Avg Entry</div><div class="sum-val">${F(h.entryPrice)}&nbsp;${h.currency}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Value (EUR)</div><div class="sum-val ${dOk ? 'up' : ''}">${dOk ? F(ve) + '\u00a0\u20ac' : '\u2014'}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Total Return</div><div class="sum-val ${dOk ? (hRoiAbs >= 0 ? 'up' : 'dn') : ''}">${dOk ? (hRoiAbs >= 0 ? '+' : '') + F(hRoiPct) + '% (' + (hRoiAbs >= 0 ? '+' : '') + F(hRoiAbs) + '\u00a0\u20ac)' : '\u2014'}</div></div>
    </div>
    <div>
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Performance &mdash; last 30 days</div>
      <div class="acc-chart"><canvas id="accChart_${holdingIdx}"></canvas></div>
    </div>
    <div class="acc-hist-title" style="margin-top:14px">Closed trades (${h.ticker})</div>
    ${histRows}`;

  cardEl.classList.add('accordion-open');

  // Insertar el panel después de la ÚLTIMA tarjeta de la misma fila visual,
  // para que grid-column:1/-1 se renderice correctamente bajo toda la fila.
  const _insertAfterRow = (clickedCard) => {
    const grid = clickedCard.parentNode;
    if (!grid) return clickedCard;
    const allCards = [...grid.querySelectorAll('.stock')];
    const clickedTop = clickedCard.getBoundingClientRect().top;
    // Agrupar cards de la misma fila (misma posición Y ± 5px)
    const sameRow = allCards.filter(c => Math.abs(c.getBoundingClientRect().top - clickedTop) < 5);
    return sameRow.length ? sameRow[sameRow.length - 1] : clickedCard;
  };
  const lastInRow = _insertAfterRow(cardEl);
  lastInRow.parentNode.insertBefore(pane, lastInRow.nextSibling);

  document.getElementById(`accClose_${holdingIdx}`)?.addEventListener('click', ev => {
    ev.stopPropagation();
    pane.remove();
    cardEl.classList.remove('accordion-open');
  });

  _fetchMiniChart(h.ticker, `accChart_${holdingIdx}`, pos);
}

// ── Fetch mini-chart de 1 mes desde Yahoo y renderiza sparkline ──
async function _fetchMiniChart(ticker, canvasId, defaultPos) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1mo&interval=1d`;
    const r = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
    if (!r.ok) return;
    const json = await r.json();
    const result = json.chart?.result?.[0];
    if (!result) return;
    const rawCloses = result.indicators.quote[0].close || [];
    const timestamps = result.timestamp || [];
    const pairs = rawCloses.map((c, i) => ({ c, ts: timestamps[i] })).filter(p => p.c != null);
    let data = pairs.map(p => p.c);
    const labels = pairs.map(p => {
      const d = new Date(p.ts * 1000);
      return d.getUTCDate() + '/' + (d.getUTCMonth() + 1);
    });
    if (['GBp', 'GBX', 'GBx'].includes(result.meta?.currency)) data = data.map(v => v / 100);
    const isPos = data.length >= 2 ? data[data.length - 1] >= data[0] : defaultPos;
    const col = isPos ? '#22df8a' : '#ff4466';
    new Chart(canvas.getContext('2d'), {
      type: 'line',
      data: { labels, datasets: [{
        data, borderColor: col,
        backgroundColor: gradFill(col, '38', '00'),
        fill: true, tension: .4, borderWidth: 2,
        pointRadius: 0, pointHoverRadius: 4,
        pointBackgroundColor: col, pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 2
      }] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${F(c.parsed.y)}` } } },
        scales: {
          x: { grid: { display: false }, border: { display: false }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 6, maxRotation: 0 } },
          y: { grid: { color: 'rgba(255,255,255,.03)', drawTicks: false }, border: { display: false }, ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 9 }, maxTicksLimit: 4, callback: v => F(v), padding: 6 } }
        }
      }
    });
  } catch (_) { /* non-blocking */ }
}
