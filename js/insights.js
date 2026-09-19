import { locale } from './i18n.js';
// ============================================================
//  insights.js — Métricas derivadas: riesgo, heatmap,
//  milestones, stats de gym y perfil de gustos (media).
//  Solo lectura sobre D — no escribe ni sincroniza nada.
// ============================================================
import { D } from './state.js';
import { F, toast, monthlyReturns } from './utils.js';
import { valEur } from './portfolio.js';
import { buildDataObj } from './storage.js';

// ── Serie mensual desde D.history ─────────────────────────────
// Misma convención que la tabla "Monthly Returns" de portfolio.js:
// m.ret = P&L del mes / valor al empezarlo. m.twr queda para CAGR y volatilidad.
function _monthlySeries() {
  return monthlyReturns(D.history);
}

function _monthName(key) {
  const [y, m] = key.split('-');
  return new Date(parseInt(y), parseInt(m) - 1)
    .toLocaleDateString(locale(), { month: 'short', year: '2-digit' });
}

// ── Render principal (lo llama renderAnalytics) ───────────────
export function renderInsights() {
  const monthly = _monthlySeries();
  _renderRiskGrid(monthly);
  _renderHeatmap(monthly);
  _renderMilestones(monthly);
}

// ── Risk & Performance ────────────────────────────────────────
function _renderRiskGrid(monthly) {
  const el = document.getElementById('riskGrid');
  if (!el) return;

  let cagr = null, vol = null, best = null, worst = null;
  if (monthly.length >= 2) {
    const rets = monthly.map(m => m.twr / 100);   // encadenado: es lo que toca componer
    const idx = rets.reduce((acc, r) => acc * (1 + r), 1);
    cagr = (Math.pow(idx, 12 / rets.length) - 1) * 100;
    const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
    const variance = rets.reduce((a, r) => a + (r - mean) ** 2, 0) / (rets.length - 1);
    vol = Math.sqrt(variance) * Math.sqrt(12) * 100;
    best = monthly.reduce((a, b) => (b.ret > a.ret ? b : a));
    worst = monthly.reduce((a, b) => (b.ret < a.ret ? b : a));
  }

  const tiles = [
    { lbl: 'CAGR (annualized)', val: cagr != null ? (cagr >= 0 ? '+' : '') + F(cagr, 1) + '%' : '—', cls: cagr >= 0 ? 'up' : 'dn' },
    { lbl: 'Volatility (ann.)', val: vol != null ? F(vol, 1) + '%' : '—', cls: '' },
    { lbl: 'Best Month', val: best ? (best.ret >= 0 ? '+' : '') + F(best.ret, 1) + '%' : '—', sub: best ? _monthName(best.key) : '', cls: 'up' },
    { lbl: 'Worst Month', val: worst ? (worst.ret >= 0 ? '+' : '') + F(worst.ret, 1) + '%' : '—', sub: worst ? _monthName(worst.key) : '', cls: worst && worst.ret < 0 ? 'dn' : 'up' }
  ];
  el.innerHTML = tiles.map(t => `<div class="sum-card">
    <div class="sum-lbl">${t.lbl}</div>
    <div class="sum-val ${t.cls}" style="font-size:16px">${t.val}</div>
    ${t.sub ? `<div class="sum-sub">${t.sub}</div>` : ''}
  </div>`).join('');
}

// ── Heatmap de retornos mensuales (CSS grid, sin canvas) ─────
function _renderHeatmap(monthly) {
  const el = document.getElementById('heatmapWrap');
  if (!el) return;
  if (!monthly.length) {
    el.innerHTML = '<p class="empty-state">Not enough history yet — returns appear after two months of snapshots.</p>';
    return;
  }
  const byYear = {};
  monthly.forEach(m => {
    const [y, mo] = m.key.split('-');
    (byYear[y] = byYear[y] || {})[parseInt(mo)] = m.ret;
  });
  const maxAbs = Math.max(...monthly.map(m => Math.abs(m.ret)), 1);
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

  let html = '<div class="hm-row hm-head"><div class="hm-y"></div>'
    + MONTHS.map(m => `<div class="hm-c">${m}</div>`).join('') + '</div>';
  Object.keys(byYear).sort((a, b) => b.localeCompare(a)).forEach(y => {
    html += `<div class="hm-row"><div class="hm-y">${y}</div>`;
    for (let m = 1; m <= 12; m++) {
      const r = byYear[y][m];
      if (r == null) { html += '<div class="hm-c hm-empty"></div>'; continue; }
      const a = Math.min(Math.abs(r) / maxAbs, 1) * 0.75 + 0.12;
      const bg = r >= 0 ? `rgba(34,223,138,${a.toFixed(2)})` : `rgba(255,68,102,${a.toFixed(2)})`;
      html += `<div class="hm-c hm-cell" style="background:${bg}" title="${_monthName(y + '-' + String(m).padStart(2, '0'))}: ${r >= 0 ? '+' : ''}${F(r, 2)}%">${(r >= 0 ? '+' : '') + F(r, 1)}</div>`;
    }
    html += '</div>';
  });
  el.innerHTML = html;
}

// ── Road to €1M ───────────────────────────────────────────────
const MILESTONES = [125000, 150000, 200000, 250000, 500000, 750000, 1000000];

function _renderMilestones(monthly) {
  const el = document.getElementById('milestones');
  if (!el) return;

  const holdingsVal = (D.holdings || []).reduce((s, h) => s + valEur(h), 0);
  let current = (D.cash || 0) + holdingsVal;
  // Si hay posiciones pero los precios aún no han cargado (valEur=0),
  // usar el último snapshot del historial para no enseñar solo el cash.
  if ((D.holdings || []).length && !holdingsVal && D.history && D.history.length) {
    const last = [...D.history].sort((a, b) => a.date.localeCompare(b.date)).pop();
    if (last.totalValue > current) current = last.totalValue;
  }
  if (!current) {
    el.innerHTML = '<p class="empty-state">Portfolio value pending — milestones light up once prices load.</p>';
    return;
  }

  // Ritmo honesto: TWR mensual medio de los últimos 12 meses (retorno de
  // mercado, aportaciones neutralizadas) + aportación media mensual del último
  // año. Extrapolar el crecimiento bruto del valor desde el día 1 contaba los
  // depósitos como rentabilidad y daba ETAs de fantasía.
  let rate = null, contrib = 0;
  const m12 = monthly.slice(-12).filter(x => isFinite(x.ret));
  if (m12.length >= 3) {
    const growth = m12.reduce((a, x) => a * (1 + x.ret / 100), 1);
    rate = Math.pow(growth, 1 / m12.length) - 1;
  }
  if (D.history && D.history.length >= 2) {
    const sorted = [...D.history].sort((a, b) => a.date.localeCompare(b.date));
    const last = sorted[sorted.length - 1];
    const cut = new Date(last.date + 'T00:00:00Z');
    cut.setUTCFullYear(cut.getUTCFullYear() - 1);
    const cutStr = cut.toISOString().slice(0, 10);
    const prev = [...sorted].reverse().find(h => h.date <= cutStr) || sorted[0];
    const ms = new Date(last.date) - new Date(prev.date);
    const monthsSpan = Math.max(ms / (30.4375 * 24 * 3600 * 1000), 1);
    contrib = Math.max(0, ((last.totalInvested || 0) - (prev.totalInvested || 0)) / monthsSpan);
  }

  // ETA: iterar mes a mes V = V·(1+rate) + aportación
  const etaFor = target => {
    if (rate == null && !contrib) return '';
    let v = current, months = 0;
    const r = rate || 0;
    while (v < target && months <= 120) { v = v * (1 + r) + contrib; months++; }
    if (months > 120) return '10y+';
    const d = new Date();
    d.setMonth(d.getMonth() + months);
    return d.toLocaleDateString(locale(), { month: 'short', year: 'numeric' });
  };

  const next = MILESTONES.find(m => m > current);
  const prevM = [...MILESTONES].reverse().find(m => m <= current) || 0;
  const pct = next ? Math.min((current - prevM) / (next - prevM) * 100, 100) : 100;

  let html = '';
  if (next) {
    html += `<div class="ms-head">
      <div><span class="ms-now">${F(current, 0)} €</span><span class="ms-target"> / next stop ${F(next, 0)} €</span></div>
      <div class="ms-pct">${F(pct, 0)}%</div>
    </div>
    <div class="ms-track"><div class="ms-fill" style="width:${pct}%"></div></div>`;
  } else {
    html += `<div class="ms-head"><div><span class="ms-now">${F(current, 0)} €</span><span class="ms-target"> — millionaire&nbsp;🥂</span></div></div>`;
  }

  html += '<div class="ms-grid">';
  MILESTONES.forEach(m => {
    const done = current >= m;
    const eta = done ? '' : etaFor(m);
    html += `<div class="ms-item ${done ? 'ms-done' : ''}">
      <div class="ms-amt">${m >= 1000000 ? '1M' : (m / 1000) + 'k'} €</div>
      <div class="ms-eta">${done ? '✓ reached' : (eta || '—')}</div>
    </div>`;
  });
  html += '</div>';
  if (rate != null) html += `<div class="ms-note">ETA at current pace: ${rate >= 0 ? '+' : ''}${F(rate * 100, 1)}%/mo (12m TWR) + ${F(contrib, 0)} €/mo contributed</div>`;
  el.innerHTML = html;
}

// ── Gym: tarjetas de progreso ─────────────────────────────────
export function renderGymInsights() {
  const el = document.getElementById('gymSummary');
  if (!el) return;
  const gym = (D.gym || []).filter(x => x.weight != null);
  if (gym.length < 1) { el.innerHTML = ''; return; }

  const sorted = [...gym].sort((a, b) => a.date.localeCompare(b.date));
  const last = sorted[sorted.length - 1], first = sorted[0];
  const cutoff = new Date(last.date); cutoff.setDate(cutoff.getDate() - 35);
  const cutStr = cutoff.toISOString().slice(0, 10);
  const prev30 = [...sorted].reverse().find(x => x.date <= cutStr);

  const dTotal = last.weight - first.weight;
  const d30 = prev30 ? last.weight - prev30.weight : null;
  const bfLast = [...sorted].reverse().find(x => x.bf != null);
  const bfFirst = sorted.find(x => x.bf != null);
  const dBf = bfLast && bfFirst && bfLast !== bfFirst ? bfLast.bf - bfFirst.bf : null;
  const lean = bfLast && last.weight != null ? last.weight * (1 - bfLast.bf / 100) : null;

  const sign = v => (v >= 0 ? '+' : '') + F(v, 1);
  el.innerHTML = [
    { lbl: 'Current Weight', val: F(last.weight, 1) + ' kg', cls: '' },
    { lbl: 'Last 30 Days', val: d30 != null ? sign(d30) + ' kg' : '—', cls: d30 == null ? '' : d30 <= 0 ? 'up' : 'dn' },
    { lbl: 'Since Start', val: sign(dTotal) + ' kg', cls: dTotal <= 0 ? 'up' : 'dn' },
    { lbl: 'Body Fat', val: bfLast ? F(bfLast.bf, 1) + '%' : '—', cls: '' },
    { lbl: 'BF Change', val: dBf != null ? sign(dBf) + ' pts' : '—', cls: dBf == null ? '' : dBf <= 0 ? 'up' : 'dn' },
    { lbl: 'Lean Mass', val: lean != null ? F(lean, 1) + ' kg' : '—', cls: 'up' }
  ].map(c => `<div class="sum-card">
    <div class="sum-lbl">${c.lbl}</div>
    <div class="sum-val ${c.cls}" style="font-size:16px">${c.val}</div>
  </div>`).join('');
}

// ── Media: perfil de gustos ───────────────────────────────────
// Histograma CSS de notas + top creadores. Sin canvas: funciona
// aunque la pestaña esté oculta en el primer render.
function _bars(bins, color) {
  const max = Math.max(...bins.map(b => b.n), 1);
  return '<div class="tp-bars">' + bins.map(b => `
    <div class="tp-bar-col" title="${b.label}: ${b.n}">
      <div class="tp-bar-val">${b.n || ''}</div>
      <div class="tp-bar" style="height:${Math.round(b.n / max * 100)}%;background:${color}"></div>
      <div class="tp-bar-lbl">${b.label}</div>
    </div>`).join('') + '</div>';
}

function _topList(items, titleFn) {
  return '<div class="tp-top">' + items.map(([name, o]) => `
    <div class="tp-top-row">
      <span class="tp-top-name">${name}</span>
      <span class="tp-top-meta">${o.n}× · avg <b>${F(o.sum / o.n, 1)}</b></span>
    </div>`).join('') + '</div>';
}

function _group(list, keyFn, ratingFn) {
  const g = {};
  list.forEach(x => {
    const k = keyFn(x), r = ratingFn(x);
    if (!k || r == null) return;
    (g[k] = g[k] || { n: 0, sum: 0 }).n++;
    g[k].sum += r;
  });
  return Object.entries(g).filter(([, o]) => o.n >= 2)
    .sort((a, b) => b[1].n - a[1].n || b[1].sum / b[1].n - a[1].sum / a[1].n)
    .slice(0, 5);
}

export function renderMediaInsights(kind) {
  const el = document.getElementById(kind + 'Insights');
  if (!el) return;
  let html = '';

  if (kind === 'books') {
    const rated = (D.books || []).filter(b => b.myRating != null);
    if (rated.length >= 3) {
      const bins = [];
      for (let r = 1; r <= 5; r += 0.5) {
        bins.push({ label: r % 1 ? '' : r.toString(), n: rated.filter(b => Math.abs(b.myRating - r) < 0.25).length });
      }
      const tough = rated.filter(b => b.grRating).map(b => b.myRating * 2 - b.grRating);
      const bias = tough.length ? tough.reduce((a, b) => a + b, 0) / tough.length : null;
      html = `<h2>Taste Profile</h2><div class="tp-wrap">
        <div><div class="tp-sub">My ratings (/5)</div>${_bars(bins, 'var(--amber)')}</div>
        <div><div class="tp-sub">Most read authors</div>${_topList(_group(rated, b => b.author, b => b.myRating))}
        ${bias != null ? `<div class="ms-note">vs Goodreads: you rate ${bias >= 0 ? 'higher' : 'tougher'} by ${F(Math.abs(bias), 1)} pts (GR scale)</div>` : ''}</div>
      </div>`;
    }
  } else if (kind === 'movies') {
    const rated = (D.movies || []).filter(m => m.myRating != null);
    if (rated.length >= 3) {
      const bins = [];
      for (let r = 1; r <= 10; r++) bins.push({ label: r.toString(), n: rated.filter(m => Math.round(m.myRating) === r).length });
      const decades = _group(rated.filter(m => m.year), m => Math.floor(m.year / 10) * 10 + 's', m => m.myRating);
      decades.sort((a, b) => a[0].localeCompare(b[0]));
      html = `<h2>Taste Profile</h2><div class="tp-wrap">
        <div><div class="tp-sub">My ratings (/10)</div>${_bars(bins, 'var(--blue)')}</div>
        <div><div class="tp-sub">Top directors</div>${_topList(_group(rated, m => m.director, m => m.myRating))}</div>
        <div><div class="tp-sub">Favourite decades</div>${_topList(decades)}</div>
      </div>`;
    }
  } else if (kind === 'series') {
    const rated = (D.series || []).filter(s => s.myRating != null);
    if (rated.length >= 3) {
      const bins = [];
      for (let r = 1; r <= 10; r++) bins.push({ label: r.toString(), n: rated.filter(s => Math.round(s.myRating) === r).length });
      html = `<h2>Taste Profile</h2><div class="tp-wrap">
        <div><div class="tp-sub">My ratings (/10)</div>${_bars(bins, 'var(--purple)')}</div>
        <div><div class="tp-sub">Top platforms</div>${_topList(_group(rated, s => s.platform, s => s.myRating))}</div>
      </div>`;
    }
  }

  el.style.display = html ? 'block' : 'none';
  el.style.marginBottom = '20px';
  el.innerHTML = html;
}

// ── Backup: descarga D como JSON ──────────────────────────────
document.getElementById('btnExport')?.addEventListener('click', () => {
  try {
    const blob = new Blob([JSON.stringify(buildDataObj(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'trackmrp-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
    toast('Backup downloaded', 'ok');
  } catch (e) {
    toast('Backup failed: ' + e.message, 'err');
  }
});
