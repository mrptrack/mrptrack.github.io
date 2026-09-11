// ============================================================
//  analytics.js — Pestaña Analytics: sectores, divisa,
//  benchmark SPY, heatmap de dividendos.
// ============================================================
import { D } from './state.js';
import { F, ttOpts, legOpts, gradFill, centerTextPlugin, crosshairPlugin } from './utils.js';
import { fxR, valEur, fetchStock } from './portfolio.js';
import { PROXY_URL } from './config.js';
import { renderInsights } from './insights.js';

// Caché de charts para destruir antes de re-render
const CH = {};

// ── Sectores por defecto (enriquecibles por el usuario) ──────
// El usuario puede añadir una propiedad `sector` a cada holding
// via el modal de edición. Si no existe, se agrupa como "Other".
const SECTOR_COLORS = {
  Technology: '#5588ff', Financials: '#22df8a', Healthcare: '#aa66ff',
  Energy: '#ffaa22', Consumer: '#ff6688', Industrials: '#22dddd',
  Materials: '#ff8844', Utilities: '#88bbff', 'Real Estate': '#ffdd44',
  Other: '#667788'
};

// ── Render principal de la pestaña Analytics ─────────────────
export function renderAnalytics() {
  _renderSummaryCards();
  _renderSectorChart();
  _renderCurrencyChart();
  renderInsights();
}

// ── Tarjetas de resumen ──────────────────────────────────────
function _renderSummaryCards() {
  const el = document.getElementById('analyticsSummary');
  if (!el) return;

  const totalVal = D.cash + D.holdings.reduce((s, h) => s + valEur(h), 0);
  const totalInv = D.totalInvested;

  // PnL Latente: valor actual posiciones abiertas vs lo invertido en ellas
  const openInvestedEur = D.holdings.reduce((s, h) => s + h.entryPrice * h.shares * fxR(h.currency), 0);
  const latentPnl   = D.holdings.reduce((s, h) => s + valEur(h), 0) - openInvestedEur;

  // PnL Realizado: suma de realizedPnl de closedTrades (o gross si no existe)
  const realizedPnl = D.closedTrades.reduce((s, t) => {
    const fx = fxR(t.currency);
    if (t.realizedPnl != null) return s + t.realizedPnl * fx;
    return s + (t.sellPrice - t.avgBuy) * t.totalShares * fx;
  }, 0);

  const totalReturn = latentPnl + realizedPnl;
  const totalReturnPct = totalInv > 0 ? (totalReturn / totalInv) * 100 : 0;

  // Dividendos totales cobrados (en EUR)
  const totalDivEur = D.holdings.reduce((s, h) => s + (h.dividends || 0) * fxR(h.currency), 0)
    + D.closedTrades.reduce((s, t) => s + (t.dividends || 0) * fxR(t.currency), 0);

  const yieldPct = totalInv > 0 ? (totalDivEur / totalInv) * 100 : 0;

  el.innerHTML = [
    { lbl: 'Realized P&L', val: (realizedPnl >= 0 ? '+' : '') + F(realizedPnl) + ' €', cls: realizedPnl >= 0 ? 'up' : 'dn' },
    { lbl: 'Unrealized P&L', val: (latentPnl >= 0 ? '+' : '') + F(latentPnl) + ' €', cls: latentPnl >= 0 ? 'up' : 'dn' },
    { lbl: 'Dividends (EUR)', val: F(totalDivEur) + ' €', cls: totalDivEur > 0 ? 'up' : '' },
    { lbl: 'Dividend Yield', val: F(yieldPct) + '%', cls: '' },
    { lbl: 'Positions', val: D.holdings.length, cls: '' },
    { lbl: 'Closed Trades', val: D.closedTrades.length, cls: '' }
  ].map(c => `<div class="sum-card">
    <div class="sum-lbl">${c.lbl}</div>
    <div class="sum-val ${c.cls}" style="font-size:16px">${c.val}</div>
  </div>`).join('');
}

// ── Gráfico de sectores ──────────────────────────────────────
function _renderSectorChart() {
  const canvas = document.getElementById('cSector');
  if (!canvas) return;

  const sectors = {};
  D.holdings.forEach(h => {
    const s = h.sector || 'Other';
    sectors[s] = (sectors[s] || 0) + valEur(h);
  });

  if (!Object.keys(sectors).length) { canvas.getContext('2d'); return; }

  const labels = Object.keys(sectors);
  const data = Object.values(sectors);
  const colors = labels.map(l => SECTOR_COLORS[l] || SECTOR_COLORS.Other);
  const total = data.reduce((a, b) => a + b, 0);

  if (CH.sector) CH.sector.destroy();
  CH.sector = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data, backgroundColor: colors,
        borderColor: '#0d0d1a',
        borderWidth: 4, hoverBorderWidth: 4, hoverOffset: 10,
        spacing: 2, borderRadius: 6
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '72%',
      animation: { animateRotate: true, animateScale: true, duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'bottom', labels: legOpts },
        tooltip: {
          ...ttOpts,
          callbacks: { label: c => ` ${c.label}: ${F(c.parsed)} € (${total > 0 ? F(c.parsed / total * 100, 1) : 0}%)` }
        },
        centerText: { label: 'Sectors', value: labels.length.toString(), sub: F(total, 0) + ' €' }
      }
    },
    plugins: [centerTextPlugin]
  });
}

// ── Gráfico de exposición por divisa ─────────────────────────
function _renderCurrencyChart() {
  const canvas = document.getElementById('cCurrency');
  if (!canvas) return;

  const cur = { EUR: D.cash };
  D.holdings.forEach(h => { cur[h.currency] = (cur[h.currency] || 0) + valEur(h); });

  const labels = Object.keys(cur);
  const data = Object.values(cur);
  const bgColors = { EUR: '#22df8a', USD: '#5588ff', CAD: '#ffaa22', GBP: '#aa66ff', JPY: '#ff6688' };
  const colors = labels.map(l => bgColors[l] || '#667788');

  if (CH.currency) CH.currency.destroy();
  CH.currency = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + 'cc'),
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false,
        barPercentage: 0.6,
        categoryPercentage: 0.85,
        hoverBackgroundColor: colors
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: { legend: { display: false }, tooltip: { ...ttOpts, callbacks: { label: c => ` ${F(c.parsed.y)} €` } } },
      scales: {
        x: {
          grid: { display: false }, border: { display: false },
          ticks: { color: '#e2e2f0', font: { family: 'IBM Plex Mono', size: 12, weight: '600' }, padding: 6 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' €', padding: 10 }
        }
      }
    }
  });
}

// ── Benchmark: Portfolio vs índices (money-weighted) ───────────
// Simula comprar cada índice con LAS MISMAS aportaciones en LAS
// MISMAS fechas que registra D.history, convirtiendo EUR→USD al
// tipo del día para los denominados en USD. Un benchmark que
// "compra todo el día 1" mentiría: el dinero no estaba.
// Solo SPY visible por defecto; el resto sale tachado en la leyenda
// (hidden) y se activa con un toque.
const BENCHMARKS = [
  { sym: 'SPY',     label: 'S&P 500',    color: '#5588ff', usd: true,  hidden: false },
  { sym: 'QQQ',     label: 'Nasdaq 100', color: '#aa66ff', usd: true,  hidden: true },
  { sym: '^IBEX',   label: 'IBEX 35',    color: '#ffaa22', usd: false, hidden: true },
  { sym: 'EEM',     label: 'MSCI EM',    color: '#22dddd', usd: true,  hidden: true },
  { sym: 'GLD',     label: 'Gold',       color: '#ffdd44', usd: true,  hidden: true },
  { sym: 'BTC-USD', label: 'Bitcoin',    color: '#ff8844', usd: true,  hidden: true }
];
// null = no intentado / pendiente de retry; {} vacío = fallo ya registrado
let _benchMaps = null;         // sym → (fecha → cierre en divisa nativa)
let _usdMap = null;            // fecha → EURUSD=X (USD por 1 EUR)
let _benchExtrasLoaded = false;

async function _fetchDailyMap(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d`;
  const res = await fetch(`${PROXY_URL}?url=${encodeURIComponent(url)}`);
  const raw = await res.text();
  let json;
  try { json = JSON.parse(raw); } catch { json = null; }
  const r0 = json?.chart?.result?.[0];
  if (!r0) {
    console.warn(`[bench] chart.result vacío para ${symbol}:`, raw.slice(0, 200));
    return {};
  }
  const ts = r0.timestamp || [];
  const cls = r0.indicators?.quote?.[0]?.close || [];
  const map = {};
  ts.forEach((t, i) => {
    const p = cls[i];
    if (p != null && isFinite(p) && p > 0) {
      const d = new Date(t * 1000);
      const key = d.getUTCFullYear() + '-'
        + String(d.getUTCMonth() + 1).padStart(2, '0') + '-'
        + String(d.getUTCDate()).padStart(2, '0');
      map[key] = p;
    }
  });
  return map;
}

// Valor más cercano (±7 días) a una fecha ISO en un mapa fecha→valor
function _nearestIn(map, dateStr) {
  if (!map || !Object.keys(map).length) return null;
  if (map[dateStr] > 0) return map[dateStr];
  const base = new Date(dateStr + 'T00:00:00Z');
  for (let offset = 1; offset <= 7; offset++) {
    for (const sign of [1, -1]) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + sign * offset);
      const k = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
      if (map[k] > 0) return map[k];
    }
  }
  return null;
}
// EURUSD: si el fetch falla se usa 1 (benchmark en % USD; mejor eso que nada)
const _nearestUsd = d => _nearestIn(_usdMap, d) || 1;

// Caché localStorage (20h): sobrevive a los 429 esporádicos de Yahoo/proxy
function _cacheGet(key) {
  try {
    const raw = localStorage.getItem('trackmrp_' + key);
    if (!raw) return null;
    const { ts, map } = JSON.parse(raw);
    return { fresh: Date.now() - ts < 20 * 3600 * 1000, map };
  } catch (_) { return null; }
}
function _cacheSet(key, map) {
  try { localStorage.setItem('trackmrp_' + key, JSON.stringify({ ts: Date.now(), map })); } catch (_) { /* quota */ }
}

async function _loadDailyMapCached(symbol, key) {
  const cached = _cacheGet(key);
  if (cached && cached.fresh && Object.keys(cached.map).length) return cached.map;
  const map = await _fetchDailyMap(symbol);
  if (Object.keys(map).length) { _cacheSet(key, map); return map; }
  // fetch vacío (429, etc.) → mejor caché rancia que nada
  return cached && Object.keys(cached.map).length ? cached.map : {};
}

const _cacheKey = sym => 'bench_' + sym.replace(/[^A-Za-z0-9]/g, '').toLowerCase() + '_v1';

export async function renderBenchmark() {
  // _benchMaps === null → aún no hemos intentado cargar (o falló HTTP → reintentar)
  if (_benchMaps === null) {
    try {
      // secuencial, no en paralelo: el proxy GAS + Yahoo devuelven 429 con ráfagas
      const spy = await _loadDailyMapCached('SPY', _cacheKey('SPY'));
      _usdMap = await _loadDailyMapCached('EURUSD=X', 'bench_usd_v1');
      console.log('[bench] SPY:', Object.keys(spy).length, 'días | EURUSD:', Object.keys(_usdMap).length, 'días');
      if (Object.keys(spy).length) _benchMaps = { SPY: spy };
    } catch (err) {
      console.warn('[bench] fetch falló (proxy/red):', err.message);
      _benchMaps = null;   // null → reintentará en la próxima llamada
    }
  }
  _drawBenchmark();
  // El resto de índices se carga en segundo plano la primera vez y se re-pinta
  if (_benchMaps && !_benchExtrasLoaded) {
    _benchExtrasLoaded = true;
    (async () => {
      for (const b of BENCHMARKS) {
        if (_benchMaps[b.sym]) continue;
        try { _benchMaps[b.sym] = await _loadDailyMapCached(b.sym, _cacheKey(b.sym)); }
        catch (_) { _benchMaps[b.sym] = {}; }
      }
      _drawBenchmark();
    })();
  }
}

// ── Aportaciones desde D.history ──────────────────────────────
// [{date, amt}] = aportación inicial + cada cambio de totalInvested
// (positivo = dinero nuevo, negativo = retirada)
function _contributions(allPortfolio) {
  const out = [];
  let prev = null;
  for (const h of allPortfolio) {
    if (prev === null) {
      if (h.totalInvested > 0) out.push({ date: h.date, amt: h.totalInvested });
    } else if (h.totalInvested !== prev) {
      out.push({ date: h.date, amt: h.totalInvested - prev });
    }
    prev = h.totalInvested;
  }
  return out;
}

// Prefijos de la simulación: tras cada aportación, unidades e invertido acumulados.
// Compra (o vende, si amt<0) al precio del índice y al EURUSD del día si cotiza en USD.
function _simPrefixesFor(map, usd, contribs) {
  const pref = [];
  let units = 0, invested = 0;
  for (const c of contribs) {
    const px = _nearestIn(map, c.date);
    if (!px) continue;
    units += (c.amt * (usd ? _nearestUsd(c.date) : 1)) / px;
    invested += c.amt;
    pref.push({ date: c.date, units, invested });
  }
  return pref;
}

function _drawBenchmark() {
  const canvas = document.getElementById('cBenchmark');
  if (!canvas) return;

  const period = document.querySelector('#benchmarkBtns .active')?.dataset.period || 'all';
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  // ── Datos reales del portfolio ────────────────────────────────
  const allPortfolio = [...(D.history || [])].sort((a, b) => a.date.localeCompare(b.date));
  const firstEntry = allPortfolio[0] || null;
  const portMap = {};
  for (const h of allPortfolio) portMap[h.date] = h;

  // ── viewStart según período (nunca antes del primer dato real) ──
  const MIN_DATE = firstEntry ? firstEntry.date : '2025-01-01';
  let viewStart = MIN_DATE;
  if (period === '1y')  { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '6m') { const d = new Date(now); d.setMonth(d.getMonth() - 6); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '3m') { const d = new Date(now); d.setMonth(d.getMonth() - 3); viewStart = d.toISOString().slice(0, 10); }
  else if (period === '1m') { const d = new Date(now); d.setMonth(d.getMonth() - 1); viewStart = d.toISOString().slice(0, 10); }
  if (viewStart < MIN_DATE) viewStart = MIN_DATE;

  // ── Simulación money-weighted por índice ─────────────────────
  const contribs = _contributions(allPortfolio);

  // Retorno absoluto de un índice simulado: (valor EUR − invertido) / invertido
  const _benchAbsFor = (map, usd, prefixes) => dateStr => {
    if (!prefixes.length || dateStr < prefixes[0].date) return null;
    let p = null;
    for (const x of prefixes) { if (x.date <= dateStr) p = x; else break; }
    if (!p || p.invested <= 0) return null;
    const px = _nearestIn(map, dateStr);
    if (!px) return null;
    const valueEur = (p.units * px) / (usd ? _nearestUsd(dateStr) : 1);
    return ((valueEur - p.invested) / p.invested) * 100;
  };

  // Retorno absoluto real del portfolio: (totalValue − totalInvested) / totalInvested
  function _absReturn(dateStr) {
    if (!firstEntry || dateStr < firstEntry.date) return null;
    let entry = portMap[dateStr];
    if (!entry) {
      const prev = allPortfolio.filter(h => h.date <= dateStr);
      entry = prev.length ? prev[prev.length - 1] : null;
    }
    if (!entry || entry.totalInvested <= 0) return null;
    return ((entry.totalValue - entry.totalInvested) / entry.totalInvested) * 100;
  }

  // ── Eje X: muestreo adaptativo según período ──────────────────
  // 1m → diario, 3m → semanal, 6m → quincenal, 1y/all �� mensual
  const stepDays = period === '1m' ? 1 : period === '3m' ? 7 : period === '6m' ? 14 : 30;
  const axisDates = [];
  const cur = new Date(viewStart + 'T00:00:00Z');
  while (true) {
    const key = cur.getUTCFullYear() + '-' + String(cur.getUTCMonth() + 1).padStart(2, '0') + '-' + String(cur.getUTCDate()).padStart(2, '0');
    if (key > todayStr) break;
    axisDates.push(key);
    cur.setUTCDate(cur.getUTCDate() + stepDays);
  }
  // Siempre incluir hoy como último punto
  if (axisDates.length && axisDates[axisDates.length - 1] !== todayStr) axisDates.push(todayStr);

  if (axisDates.length < 2 || !firstEntry) {
    if (CH.benchmark) { CH.benchmark.destroy(); CH.benchmark = null; }
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Formato de label adaptado al período
  const labelOpts = stepDays <= 7
    ? { day: 'numeric', month: 'short' }
    : { month: 'short', year: '2-digit' };
  const labels = axisDates.map(d => new Date(d + 'T00:00:00Z').toLocaleDateString('es-ES', labelOpts));

  // ── Ambas series: retorno absoluto rebasado a 0% en el primer punto del eje ──
  // (misma métrica, mismas aportaciones → comparación honesta)
  // ALL = retorno absoluto sobre lo aportado (cuadra con el ROI del hero y el
  // All-Time% de la tabla mensual). Períodos cortos = rebase al inicio del eje.
  const _series = absFn => {
    if (period === 'all') {
      return axisDates.map(d => {
        const abs = absFn(d);
        return abs == null ? null : parseFloat(abs.toFixed(2));
      });
    }
    const base = absFn(axisDates[0]);
    if (base == null) return axisDates.map(() => null);
    return axisDates.map((d, i) => {
      if (i === 0) return 0;
      const abs = absFn(d);
      if (abs == null) return null;
      return parseFloat((((1 + abs / 100) / (1 + base / 100) - 1) * 100).toFixed(2));
    });
  };
  const portData = _series(_absReturn);

  // Conservar los toggles del usuario en la leyenda entre re-renders
  const prevHidden = {};
  if (CH.benchmark) {
    CH.benchmark.data.datasets.forEach((ds, i) => { prevHidden[ds.label] = !CH.benchmark.isDatasetVisible(i); });
  }

  const datasets = [];
  for (const b of BENCHMARKS) {
    const map = _benchMaps && _benchMaps[b.sym];
    if (!map || !Object.keys(map).length) continue;
    const data = _series(_benchAbsFor(map, b.usd, _simPrefixesFor(map, b.usd, contribs)));
    if (!data.some(v => v !== null)) continue;
    datasets.push({
      label: b.label,
      data,
      borderColor: b.color,
      backgroundColor: 'transparent',
      fill: false, tension: .4, pointRadius: 0, pointHoverRadius: 5,
      pointBackgroundColor: b.color, pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3,
      borderWidth: 1.8,
      borderDash: [6, 4], spanGaps: true,
      hidden: prevHidden[b.label] != null ? prevHidden[b.label] : b.hidden
    });
  }
  if (portData.some(v => v !== null)) {
    datasets.push({
      label: 'My Portfolio',
      data: portData,
      borderColor: '#22df8a',
      backgroundColor: gradFill('#22df8a', '50', '00'),
      fill: true, tension: .4,
      pointRadius: 0, pointHoverRadius: 6,
      pointBackgroundColor: '#22df8a', pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3,
      borderWidth: 2.5, spanGaps: true,
      hidden: prevHidden['My Portfolio'] === true
    });
  }

  if (!datasets.length || axisDates.length < 2) {
    if (CH.benchmark) { CH.benchmark.destroy(); CH.benchmark = null; }
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  if (CH.benchmark) CH.benchmark.destroy();
  CH.benchmark = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { labels: legOpts },
        tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${c.parsed.y != null ? (c.parsed.y >= 0 ? '+' : '') + F(c.parsed.y, 2) + '%' : 'N/A'}` } }
      },
      scales: {
        x: {
          grid: { display: false },
          border: { color: 'rgba(255,255,255,.06)' },
          ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, maxTicksLimit: 14, padding: 8 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#a0a0b8', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => (v >= 0 ? '+' : '') + F(v, 1) + '%', padding: 10 }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}
