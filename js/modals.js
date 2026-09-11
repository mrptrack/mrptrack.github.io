// ============================================================
//  modals.js — Modales de edición y alta
//
//  Las funciones criticas se exponen en window.* para que los
//  atributos onclick del HTML de los modales puedan invocarlas
//  sin necesidad de importar este módulo en el HTML.
// ============================================================
import { D } from './state.js';
import { openGameModal } from './games.js';
import { _authed } from './state.js';
import { saveAndSync } from './cloud.js';
import { renderPortfolio, renderHistory, getPriceData } from './portfolio.js';
import { renderTrades } from './trades.js';
import { renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';
import { renderAnalytics } from './analytics.js';
import { F, ttOpts, legOpts, toast } from './utils.js';
import { PROXY_URL } from './config.js';

// ── Mapa ticker → sector (fallback cuando el usuario no especifica) ──
const TICKER_SECTOR_MAP = {
  AAPL:'Technology', MSFT:'Technology', NVDA:'Technology', GOOGL:'Technology', GOOG:'Technology',
  META:'Technology', AVGO:'Technology', TSM:'Technology', ORCL:'Technology', INTC:'Technology',
  AMZN:'Consumer', TSLA:'Consumer', WMT:'Consumer', HD:'Consumer', PG:'Consumer',
  KO:'Consumer', PEP:'Consumer', MCD:'Consumer', COST:'Consumer', NKE:'Consumer',
  JPM:'Financials', BAC:'Financials', WFC:'Financials', GS:'Financials', MS:'Financials',
  V:'Financials', MA:'Financials', 'BRK.B':'Financials', 'BRK.A':'Financials', AXP:'Financials',
  JNJ:'Healthcare', UNH:'Healthcare', LLY:'Healthcare', ABBV:'Healthcare', MRK:'Healthcare',
  PFE:'Healthcare', TMO:'Healthcare', ABT:'Healthcare', DHR:'Healthcare', AMGN:'Healthcare',
  XOM:'Energy', CVX:'Energy', COP:'Energy', SLB:'Energy', BP:'Energy', TTE:'Energy',
  BA:'Industrials', GE:'Industrials', CAT:'Industrials', MMM:'Industrials', DE:'Industrials',
  HON:'Industrials', UPS:'Industrials', RTX:'Industrials', LMT:'Industrials',
  NEE:'Utilities', DUK:'Utilities', SO:'Utilities', AEP:'Utilities', D:'Utilities',
  AMT:'Real Estate', PLD:'Real Estate', SPG:'Real Estate', EQIX:'Real Estate',
  LIN:'Materials', APD:'Materials', SHW:'Materials', FCX:'Materials', NEM:'Materials',
  SPY:'ETF/Index', QQQ:'ETF/Index', VTI:'ETF/Index', VOO:'ETF/Index', IVV:'ETF/Index',
  EEM:'ETF/Index', GLD:'ETF/Index', SLV:'ETF/Index', IAG:'Materials'
};

// ── 10 colores Cyberpunk predefinidos ────────────────────────
const CYBER_COLORS = ['#5588ff','#22df8a','#aa66ff','#ffaa22','#ff4466','#22dddd','#ff8844','#88bbff','#ffdd44','#667788'];

// ── Helper: color picker con swatches predefinidos ───────────
function _colorPicker(id, current) {
  const cur = current || CYBER_COLORS[0];
  return `<div class="fg"><label>Color</label><div class="cp-row">
    ${CYBER_COLORS.map(c => `<span class="cp-swatch" style="background:${c}" onclick="document.getElementById('${id}').value='${c}'" title="${c}"></span>`).join('')}
    <input type="color" id="${id}" value="${cur}">
  </div></div>`;
}

// ── Helper: sector combobox (lista + valor libre) ────────────
function _sectorCombo(id, current) {
  const sects = ['Technology','Financials','Healthcare','Energy','Consumer','Industrials','Materials','Utilities','Real Estate','ETF/Index','Other'];
  return `<div class="fg"><label>Sector</label>
    <input id="${id}" list="${id}-dl" value="${current || ''}" placeholder="Select or type…" autocomplete="off">
    <datalist id="${id}-dl">${sects.map(s => `<option value="${s}">`).join('')}</datalist>
  </div>`;
}

// ── Helper: campo Broker ─────────────────────────────────────
function _brokerField(id, current) {
  return `<div class="fg"><label>Broker <small style="color:var(--text-muted)">(optional)</small></label>
    <input id="${id}" list="brokerDl" value="${current || ''}" placeholder="IBKR, Degiro…" autocomplete="off">
    <datalist id="brokerDl"><option value="IBKR"><option value="Degiro"><option value="Revolut"><option value="Trading212"><option value="eToro"></datalist>
  </div>`;
}

// ── Helper: autofill datos de Yahoo para un ticker ───────────
async function _fetchAndAutofill(tickerId, nameId, curId, priceId, sectorId) {
  const ticker = (document.getElementById(tickerId)?.value || '').trim().toUpperCase();
  if (!ticker) return;
  const btn = document.getElementById('btnFetchTicker');
  if (btn) { btn.disabled = true; btn.textContent = 'Fetching…'; }
  _clearErr();

  // v8/finance/chart: más permisivo que v7, no requiere crumb/cookies
  const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' + ticker + '?range=1d&interval=1d';
  const finalUrl = PROXY_URL + '?url=' + encodeURIComponent(yahooUrl);

  try {
    const res = await fetch(finalUrl);
    const textResponse = await res.text();
    console.log('RESPUESTA CRUDA DE YAHOO/GAS:', textResponse); // DEBUG

    let data;
    try {
      data = JSON.parse(textResponse);
    } catch (_) {
      throw new Error('Respuesta no es JSON válido. Revisa la consola.');
    }

    // Validación para v8
    if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
      console.error('JSON parseado pero sin datos válidos:', data);
      throw new Error('Ticker no válido o sin datos.');
    }

    const meta = data.chart.result[0].meta;
    console.log('Yahoo v8 meta:', meta); // DEBUG

    // Limpiar todos los campos del modal antes de mapear nuevos datos
    ['aHName', 'aHCur', 'aHEntry', 'aHExch'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });

    // Mapeo al DOM usando los IDs reales del modal
    if (nameId) {
      const nameEl = document.getElementById(nameId);
      if (nameEl) nameEl.value = meta.shortName || meta.symbol || ticker;
    }
    if (curId && meta.currency) {
      const cur = ['GBp', 'GBX', 'GBx'].includes(meta.currency) ? 'GBP' : meta.currency;
      const el = document.getElementById(curId); if (el) el.value = cur;
    }
    if (priceId && isFinite(meta.regularMarketPrice)) {
      let price = meta.regularMarketPrice;
      if (['GBp', 'GBX', 'GBx'].includes(meta.currency)) price /= 100;
      const el = document.getElementById(priceId); if (el) el.value = price.toFixed(4);
    }
    // Exchange (ej: NYSE, NASDAQ, LSE)
    if (meta.exchangeName || meta.fullExchangeName) {
      const exchEl = document.getElementById('aHExch');
      if (exchEl) exchEl.value = meta.exchangeName || meta.fullExchangeName;
    }
    // v8 no provee sector — el mapa local TICKER_SECTOR_MAP cubre este campo al hacer blur
    toast('Datos obtenidos correctamente', 'success');
  } catch (err) {
    console.error('Fetch autofill error:', err);
    const errEl = document.getElementById('formErr');
    if (errEl) { errEl.textContent = 'Fetch fallido: ' + err.message; errEl.style.display = 'block'; }
  }
  if (btn) { btn.disabled = false; btn.textContent = '🔍 Fetch'; }
}

// ── Helpers de validación inline ─────────────────────────────
function _showErr(msg) {
  const el = document.getElementById('formErr');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}
function _clearErr() {
  const el = document.getElementById('formErr');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

// ── Helper: estado de carga en botón de modal ────────────────
function _setBtnLoading(btnId, on, label) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = on;
  if (on) { btn.dataset.origText = btn.textContent; btn.textContent = 'Saving…'; }
  else btn.textContent = label || btn.dataset.origText || 'Save';
}

// ── Helper: leer valor de input por id ──────────────────────
const g = id => document.getElementById(id);

// ── Cerrar modal ─────────────────────────────────────────────
export function closeModal() { document.getElementById('ov').classList.remove('open'); }
window.closeModal = closeModal;

// ── Abrir modal de edición ───────────────────────────────────
export function openEditModal(type, idx) {
  if (type === 'game') return openGameModal(idx);
  if (!_authed) return;
  const m = document.getElementById('mod');
  let f = '';

  if (type === 'book') {
    const b = D.books[idx];
    f = `<h2>Edit Book</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(b.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Author</label><input id="eAuthor" value="${(b.author || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Goodreads rating</label><input type="number" id="eGr" step="0.01" value="${b.grRating || ''}"></div>
      <div class="fg"><label>Pages</label><input type="number" id="ePages" value="${b.pages || ''}"></div>
      <div class="fg"><label>Year</label><input id="eYear" value="${b.year || ''}"></div>
      <div class="fg"><label>My rating (0-5)</label><input type="number" id="eMy" step="0.25" min="0" max="5" value="${b.myRating != null ? b.myRating : ''}"></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${b.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('book',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('book',${idx})">Save</button>
      </div>`;
  } else if (type === 'movie') {
    const mv = D.movies[idx];
    f = `<h2>Edit Movie</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(mv.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Director</label><input id="eDir" value="${(mv.director || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Filmaffinity rating</label><input type="number" id="eFa" step="0.1" value="${mv.faRating || ''}"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="eMy" step="0.25" min="0" max="10" value="${mv.myRating != null ? mv.myRating : ''}"></div>
      <div class="fg"><label>Duration</label><input id="eDur" value="${mv.duration || ''}"></div>
      <div class="fg"><label>Year</label><input type="number" id="eYear" value="${mv.year || ''}"></div>
      <div class="fg"><label>Platform</label><input id="ePlat" value="${(mv.platform || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Actors</label><input id="eAct" value="${(mv.actors || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${mv.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('movie',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('movie',${idx})">Save</button>
      </div>`;
  } else if (type === 'serie') {
    const s = D.series[idx];
    f = `<h2>Edit Series</h2>
      <div class="fg"><label>Title</label><input id="eTitle" value="${(s.title || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>IMDB rating</label><input type="number" id="eImdb" step="0.1" value="${s.imdbRating || ''}"></div>
      <div class="fg"><label>Seasons</label><input type="number" id="eSeasons" value="${s.seasons || ''}"></div>
      <div class="fg"><label>Ep length</label><input id="eEpLen" value="${s.epLength || ''}"></div>
      <div class="fg"><label>Platform</label><input id="ePlat" value="${(s.platform || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Years</label><input id="eYears" value="${s.years || ''}"></div>
      <div class="fg"><label>Watched</label><input id="eWatched" value="${(s.watched || '').replace(/"/g, '&quot;')}" placeholder="Finished / 3 seasons / Up to date"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="eMy" step="0.25" min="0" max="10" value="${s.myRating != null ? s.myRating : ''}"></div>
      <div class="fg"><label>Want to finish?</label><select id="eWant">
        <option value="">-</option>
        <option value="Yes" ${s.wantFinish === 'S\u00ed' || s.wantFinish === 'Yes' ? 'selected' : ''}>Yes</option>
        <option value="No" ${s.wantFinish === 'No' ? 'selected' : ''}>No</option>
        <option value="Rewatch" ${s.wantFinish === 'Volver a verla' || s.wantFinish === 'Rewatch' ? 'selected' : ''}>Rewatch</option>
      </select></div>
      <div class="fg"><label>Opinion</label><textarea id="eOp">${s.opinion || ''}</textarea></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('serie',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('serie',${idx})">Save</button>
      </div>`;
  } else if (type === 'cash') {
    f = `<h2>Edit Cash & Totals</h2>
      <div class="fg"><label>Cash (EUR)</label><input type="number" id="eCash" step="0.01" value="${D.cash}"></div>
      <div class="fg"><label>Total invested (EUR)</label><input type="number" id="eInvested" step="1" value="${D.totalInvested}"></div>
      <div class="m-btns">
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('cash',0)">Save</button>
      </div>`;
  } else if (type === 'holding') {
    const h = D.holdings[idx];
    f = `<h2>Edit Position</h2>
      <div class="fg"><label>Ticker</label><input id="eHTicker" value="${(h.ticker || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Name</label><input id="eHName" value="${(h.name || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Shares</label><input type="number" id="eHShares" value="${h.shares || ''}"></div>
      <div class="fg"><label>Avg entry price (${h.currency})</label><input type="number" id="eHEntry" step="0.0001" value="${h.entryPrice || ''}"></div>
      <div class="fg"><label>Currency</label><select id="eHCur">
        <option ${h.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option ${h.currency === 'CAD' ? 'selected' : ''}>CAD</option>
        <option ${h.currency === 'GBP' ? 'selected' : ''}>GBP</option><option ${h.currency === 'JPY' ? 'selected' : ''}>JPY</option>
        <option ${h.currency === 'EUR' ? 'selected' : ''}>EUR</option>
      </select></div>
      <div class="fg"><label>Exchange</label><input id="eHExch" value="${(h.exchange || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Buy date</label><input type="date" id="eHBuyDate" value="${h.buyDate || ''}"></div>
      ${_colorPicker('eHColor', h.color || '#5588ff')}
      <div class="fg"><label>Dividends received (total, ${h.currency})</label><input type="number" id="eHDiv" step="0.01" value="${h.dividends || ''}"></div>
      ${_sectorCombo('eHSector', h.sector || TICKER_SECTOR_MAP[h.ticker] || '')}
      ${_brokerField('eHBroker', h.broker || '')}
      <div id="formErr" class="form-err"></div>
      <div class="m-btns" style="flex-wrap:wrap">
        <button class="btn btn-r" onclick="window.modalDelete('holding',${idx})">Delete</button>
        <button class="btn btn-amber" onclick="window.openClosePositionModal(${idx})">Close Position</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('holding',${idx})">Save</button>
      </div>`;
  } else if (type === 'trade') {
    const t = D.closedTrades[idx];
    f = `<h2>Edit Trade</h2>
      <div class="fg"><label>Ticker</label><input id="eTTicker" value="${(t.ticker || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Name</label><input id="eTName" value="${(t.name || '').replace(/"/g, '&quot;')}"></div>
      <div class="fg"><label>Currency</label><select id="eTCur">
        <option ${t.currency === 'EUR' ? 'selected' : ''}>EUR</option>
        <option ${t.currency === 'USD' ? 'selected' : ''}>USD</option>
        <option ${t.currency === 'CAD' ? 'selected' : ''}>CAD</option>
        <option ${t.currency === 'GBP' ? 'selected' : ''}>GBP</option><option ${t.currency === 'JPY' ? 'selected' : ''}>JPY</option>
      </select></div>
      <div class="fg"><label>Total shares</label><input type="number" id="eTShares" value="${t.totalShares || ''}"></div>
      <div class="fg"><label>Avg buy price</label><input type="number" id="eTBuy" step="0.0001" value="${t.avgBuy || ''}"></div>
      <div class="fg"><label>Buy date</label><input type="date" id="eTBuyDate" value="${t.buyDate || ''}"></div>
      <div class="fg"><label>Sell price</label><input type="number" id="eTSell" step="0.0001" value="${t.sellPrice || ''}"></div>
      <div class="fg"><label>Sell date</label><input type="date" id="eTSellDate" value="${t.sellDate || ''}"></div>
      <div class="fg"><label>Lots</label><input id="eTLots" value="${(t.lots || '').replace(/"/g, '&quot;')}"></div>
      ${_colorPicker('eTColor', t.color || '#667788')}
      <div class="fg"><label>Dividends received (total, ${t.currency})</label><input type="number" id="eTDiv" step="0.01" value="${t.dividends || ''}"></div>
      ${_sectorCombo('eTSector', t.sector || '')}
      ${_brokerField('eTBroker', t.broker || '')}
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('trade',${idx})">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('trade',${idx})">Save</button>
      </div>`;
  } else if (type === 'gym') {
    // idx es la fecha (string) en el caso del gym
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx < 0) return;
    const gym = D.gym[gIdx];
    f = `<h2>Edit Entry</h2>
      <div class="fg"><label>Date</label><input type="date" id="eGDate" value="${gym.date || ''}"></div>
      <div class="fg"><label>Weight (kg)</label><input type="number" id="eGWeight" step="0.1" value="${gym.weight != null ? gym.weight : ''}"></div>
      <div class="fg"><label>Body Fat (%)</label><input type="number" id="eGBf" step="0.1" value="${gym.bf != null ? gym.bf : ''}"></div>
      <div class="m-btns">
        <button class="btn btn-r" onclick="window.modalDelete('gym','${gym.date}')">Delete</button>
        <button class="btn" onclick="window.closeModal()">Cancel</button>
        <button class="btn btn-g" onclick="window.modalSave('gym','${gym.date}')">Save</button>
      </div>`;
  }

  m.innerHTML = f;
  document.getElementById('ov').classList.add('open');
}
window.openEditModal = openEditModal;

// ── Guardar edición desde modal ──────────────────────────────
window.modalSave = function (type, idx) {
  if (type === 'book') {
    D.books[idx] = {
      title: g('eTitle').value,
      author: g('eAuthor').value,
      grRating: parseFloat(g('eGr').value) || 0,
      pages: parseInt(g('ePages').value) || 0,
      year: g('eYear').value,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      opinion: g('eOp').value
    };
    closeModal(); renderBooks(); saveAndSync();
  } else if (type === 'movie') {
    D.movies[idx] = {
      title: g('eTitle').value,
      director: g('eDir').value,
      faRating: parseFloat(g('eFa').value) || 0,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      duration: g('eDur').value,
      year: parseInt(g('eYear').value) || 0,
      platform: g('ePlat').value,
      actors: g('eAct').value,
      opinion: g('eOp').value
    };
    closeModal(); renderMovies(); saveAndSync();
  } else if (type === 'serie') {
    D.series[idx] = {
      title: g('eTitle').value,
      imdbRating: parseFloat(g('eImdb').value) || 0,
      seasons: parseInt(g('eSeasons').value) || 1,
      epsPerSeason: '',
      epLength: g('eEpLen').value,
      platform: g('ePlat').value,
      years: g('eYears').value,
      watched: g('eWatched').value,
      myRating: g('eMy').value ? parseFloat(g('eMy').value) : null,
      wantFinish: g('eWant').value,
      opinion: g('eOp').value
    };
    closeModal(); renderSeries(); saveAndSync();
  } else if (type === 'cash') {
    const c = parseFloat(g('eCash').value);
    const t = parseFloat(g('eInvested').value);
    if (!isNaN(c) && c >= 0) D.cash = c;
    if (!isNaN(t) && t >= 0) D.totalInvested = t;
    closeModal(); renderPortfolio(); saveAndSync();
  } else if (type === 'holding') {
    D.holdings[idx] = {
      ...D.holdings[idx],
      ticker: g('eHTicker').value.toUpperCase(),
      name: g('eHName').value,
      shares: parseInt(g('eHShares').value) || 0,
      entryPrice: parseFloat(g('eHEntry').value) || 0,
      currency: g('eHCur').value,
      exchange: g('eHExch').value,
      buyDate: g('eHBuyDate')?.value || D.holdings[idx].buyDate || '',
      color: g('eHColor').value,
      dividends: parseFloat(g('eHDiv').value) || 0,
      sector: g('eHSector')?.value || TICKER_SECTOR_MAP[g('eHTicker').value.toUpperCase()] || D.holdings[idx].sector || '',
      broker: g('eHBroker')?.value || D.holdings[idx].broker || ''
    };
    closeModal(); renderPortfolio(); renderHistory(); saveAndSync();
  } else if (type === 'trade') {
    D.closedTrades[idx] = {
      ...D.closedTrades[idx],
      ticker: g('eTTicker').value.toUpperCase(),
      name: g('eTName').value,
      currency: g('eTCur').value,
      totalShares: parseInt(g('eTShares').value) || 0,
      avgBuy: parseFloat(g('eTBuy').value) || 0,
      buyDate: g('eTBuyDate')?.value || D.closedTrades[idx].buyDate || '',
      sellPrice: parseFloat(g('eTSell').value) || 0,
      sellDate: g('eTSellDate')?.value || D.closedTrades[idx].sellDate || '',
      lots: g('eTLots').value,
      color: g('eTColor').value,
      dividends: parseFloat(g('eTDiv').value) || 0,
      sector: g('eTSector')?.value || D.closedTrades[idx].sector || '',
      broker: g('eTBroker')?.value || D.closedTrades[idx].broker || ''
    };
    closeModal(); renderTrades(); saveAndSync();
  } else if (type === 'gym') {
    // idx es la fecha original del gym
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx < 0) return;
    const nd = g('eGDate').value;
    const nw = parseFloat(g('eGWeight').value);
    const nb = parseFloat(g('eGBf').value);
    D.gym[gIdx] = { date: nd || idx, weight: isNaN(nw) ? null : nw, bf: isNaN(nb) ? null : nb };
    D.gym.sort((a, b) => a.date.localeCompare(b.date));
    closeModal(); renderGym(); saveAndSync();
  }
};

// ── Eliminar entrada desde modal ─────────────────────────────
window.modalDelete = function (type, idx) {
  const msgs = { book: 'Delete this book?', movie: 'Delete this movie?', serie: 'Delete this series?', holding: 'Delete this position?', trade: 'Delete this trade?', gym: 'Delete this entry?' };
  if (!confirm(msgs[type] || 'Delete?')) return;
  if (type === 'book') { D.books.splice(idx, 1); closeModal(); renderBooks(); saveAndSync(); }
  else if (type === 'movie') { D.movies.splice(idx, 1); closeModal(); renderMovies(); saveAndSync(); }
  else if (type === 'serie') { D.series.splice(idx, 1); closeModal(); renderSeries(); saveAndSync(); }
  else if (type === 'holding') { D.holdings.splice(idx, 1); closeModal(); renderPortfolio(); saveAndSync(); }
  else if (type === 'trade') { D.closedTrades.splice(idx, 1); closeModal(); renderTrades(); saveAndSync(); }
  else if (type === 'gym') {
    const gIdx = D.gym.findIndex(x => x.date === idx);
    if (gIdx >= 0) { D.gym.splice(gIdx, 1); closeModal(); renderGym(); saveAndSync(); }
  }
};

// ── Abrir modal de alta ──────────────────────────────────────
export function openAddModal(type) {
  const m = document.getElementById('mod');
  let f = '';
  if (type === 'book') {
    f = `<h2>Add Book</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>Author</label><input id="aAuthor"></div>
      <div class="fg"><label>Goodreads rating</label><input type="number" id="aGr" step="0.01"></div>
      <div class="fg"><label>Pages</label><input type="number" id="aPages"></div>
      <div class="fg"><label>Year</label><input id="aYear"></div>
      <div class="fg"><label>My rating (0-5)</label><input type="number" id="aMy" step="0.25" min="0" max="5"></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('book')">Add</button></div>`;
  } else if (type === 'movie') {
    f = `<h2>Add Movie</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>Director</label><input id="aDir"></div>
      <div class="fg"><label>Filmaffinity rating</label><input type="number" id="aFa" step="0.1"></div>
      <div class="fg"><label>Duration</label><input id="aDur" placeholder="2h 30 min"></div>
      <div class="fg"><label>Year</label><input type="number" id="aYear"></div>
      <div class="fg"><label>Platform</label><input id="aPlat"></div>
      <div class="fg"><label>Actors</label><input id="aAct"></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('movie')">Add</button></div>`;
  } else if (type === 'serie') {
    f = `<h2>Add Series</h2>
      <div class="fg"><label>Title *</label><input id="aTitle" autofocus></div>
      <div class="fg"><label>IMDB rating</label><input type="number" id="aImdb" step="0.1"></div>
      <div class="fg"><label>Seasons</label><input type="number" id="aSeasons"></div>
      <div class="fg"><label>Ep length</label><input id="aEpLen" placeholder="1h"></div>
      <div class="fg"><label>Platform</label><input id="aPlat"></div>
      <div class="fg"><label>Years</label><input id="aYears" placeholder="2020-2024"></div>
      <div class="fg"><label>Watched</label><input id="aWatched" placeholder="Finished / 2 seasons / Up to date"></div>
      <div class="fg"><label>My rating (0-10)</label><input type="number" id="aMy" step="0.25" min="0" max="10"></div>
      <div class="fg"><label>Want to finish?</label><select id="aWant"><option value="">-</option><option value="Yes">Yes</option><option value="No">No</option><option value="Rewatch">Rewatch</option></select></div>
      <div class="fg"><label>Opinion</label><textarea id="aOp"></textarea></div>
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('serie')">Add</button></div>`;
  } else if (type === 'trade') {
    const todayStr = new Date().toISOString().slice(0, 10);
    f = `<h2>Add Closed Trade</h2>
      <div class="fg"><label>Ticker *</label><input id="aTicker" autofocus placeholder="AAPL"></div>
      <div class="fg"><label>Name</label><input id="aName"></div>
      <div class="fg"><label>Currency</label><select id="aCur"><option>EUR</option><option>USD</option><option>CAD</option><option>GBP</option><option>JPY</option></select></div>
      <div class="fg"><label>Total shares *</label><input type="number" id="aShares" min="1"></div>
      <div class="fg"><label>Avg buy price *</label><input type="number" id="aAvgBuy" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Buy date</label><input type="date" id="aBuyDate"></div>
      <div class="fg"><label>Sell price *</label><input type="number" id="aSell" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Sell date</label><input type="date" id="aSellDate" value="${todayStr}"></div>
      <div class="fg"><label>Lots (optional)</label><input id="aLots" placeholder="100@5.00 + 50@5.50"></div>
      ${_colorPicker('aColor', '#667788')}
      <div class="fg"><label>Dividends received (total, in selected currency)</label><input type="number" id="aDiv" step="0.01"></div>
      ${_brokerField('aBroker', '')}
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('trade')">Add</button></div>`;
  } else if (type === 'holding') {
    f = `<h2>Add Position</h2>
      <div class="fg" style="display:flex;gap:8px;align-items:flex-end">
        <div style="flex:1"><label>Ticker *</label><input id="aHTicker" autofocus placeholder="AAPL" style="width:100%"></div>
        <button type="button" class="btn btn-sm" id="btnFetchTicker" style="height:36px;white-space:nowrap;flex-shrink:0">🔍 Fetch</button>
      </div>
      <div class="fg"><label>Name</label><input id="aHName"></div>
      <div class="fg"><label>Currency</label><select id="aHCur"><option>USD</option><option>CAD</option><option>GBP</option><option>JPY</option><option>EUR</option></select></div>
      <div class="fg"><label>Exchange</label><input id="aHExch" placeholder="NYSE / LSE / TSX"></div>
      <div class="fg"><label>Shares *</label><input type="number" id="aHShares" min="1"></div>
      <div class="fg"><label>Entry price *</label><input type="number" id="aHEntry" step="0.0001" min="0.0001"></div>
      <div class="fg"><label>Buy date</label><input type="date" id="aHBuyDate" value="${new Date().toISOString().slice(0, 10)}"></div>
      ${_colorPicker('aHColor', '#5588ff')}
      <div class="fg"><label>Dividends received (total, in selected currency)</label><input type="number" id="aHDiv" step="0.01"></div>
      ${_sectorCombo('aHSector', '')}
      ${_brokerField('aHBroker', '')}
      <div id="formErr" class="form-err"></div>
      <div class="m-btns"><button class="btn" onclick="window.closeModal()">Cancel</button><button class="btn btn-g" onclick="window.saveAdd('holding')">Add</button></div>`;
  }
  m.innerHTML = f;
  if (type === 'holding') {
    const tkInput = document.getElementById('aHTicker');
    const secInput = document.getElementById('aHSector');
    const fetchBtn = document.getElementById('btnFetchTicker');
    if (tkInput && secInput) {
      tkInput.addEventListener('blur', () => {
        if (!secInput.value) {
          const mapped = TICKER_SECTOR_MAP[tkInput.value.toUpperCase()];
          if (mapped) secInput.value = mapped;
        }
      });
    }
    if (fetchBtn) {
      fetchBtn.addEventListener('click', () => _fetchAndAutofill('aHTicker', 'aHName', 'aHCur', 'aHEntry', 'aHSector'));
    }
  }
  document.getElementById('ov').classList.add('open');
}
window.openAddModal = openAddModal;
window.saveAdd = function (type) {
  _clearErr();
  const gv = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  const gvRaw = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  if (type === 'book') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.books.push({ title: t, author: gv('aAuthor'), grRating: parseFloat(gvRaw('aGr')) || 0, pages: parseInt(gvRaw('aPages')) || 0, year: gv('aYear'), myRating: gvRaw('aMy') ? parseFloat(gvRaw('aMy')) : null, opinion: gvRaw('aOp') });
    renderBooks();
  } else if (type === 'movie') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.movies.push({ title: t, director: gv('aDir'), faRating: parseFloat(gvRaw('aFa')) || 0, duration: gv('aDur'), year: parseInt(gvRaw('aYear')) || 0, platform: gv('aPlat'), actors: gv('aAct'), opinion: gvRaw('aOp') });
    renderMovies();
  } else if (type === 'serie') {
    const t = gv('aTitle');
    if (!t) { _showErr('Title is required'); return; }
    D.series.push({ title: t, imdbRating: parseFloat(gvRaw('aImdb')) || 0, seasons: parseInt(gvRaw('aSeasons')) || 1, epsPerSeason: '', epLength: gv('aEpLen'), platform: gv('aPlat'), years: gv('aYears'), watched: gv('aWatched'), myRating: gvRaw('aMy') ? parseFloat(gvRaw('aMy')) : null, wantFinish: gvRaw('aWant'), opinion: gvRaw('aOp') });
    renderSeries();
  } else if (type === 'trade') {
    const tk = gv('aTicker');
    if (!tk) { _showErr('Ticker is required'); return; }
    const sh = parseInt(gvRaw('aShares'));
    const ab = parseFloat(gvRaw('aAvgBuy'));
    const sp = parseFloat(gvRaw('aSell'));
    if (!sh || sh <= 0) { _showErr('Shares must be a positive whole number'); return; }
    if (!ab || ab <= 0) { _showErr('Avg buy price must be a positive number'); return; }
    if (!sp || sp <= 0) { _showErr('Sell price must be a positive number'); return; }
    D.closedTrades.push({ ticker: tk.toUpperCase(), name: gv('aName'), currency: gvRaw('aCur'), color: gvRaw('aColor') || '#667788', totalShares: sh, avgBuy: ab, buyDate: gvRaw('aBuyDate') || '', sellPrice: sp, sellDate: gvRaw('aSellDate') || '', dividends: parseFloat(gvRaw('aDiv')) || 0, lots: gv('aLots'), broker: gv('aBroker') || '' });
    renderTrades();
  } else if (type === 'holding') {
    const tk = gv('aHTicker');
    if (!tk) { _showErr('Ticker is required'); return; }
    const sh = parseInt(gvRaw('aHShares'));
    const ep = parseFloat(gvRaw('aHEntry'));
    if (!sh || sh <= 0) { _showErr('Shares must be a positive whole number'); return; }
    if (!ep || ep <= 0) { _showErr('Entry price must be a positive number'); return; }
    const tkUpper = tk.toUpperCase();
    const existIdx = D.holdings.findIndex(h => h.ticker === tkUpper);
    if (existIdx >= 0) {
      // Ticker ya existe: promediar precio de entrada
      const ex = D.holdings[existIdx];
      const newShares = ex.shares + sh;
      const newAvg = Math.round(((ex.entryPrice * ex.shares) + (ep * sh)) / newShares * 10000) / 10000;
      const confirmMsg = `"${tkUpper}" already exists (${ex.shares} shares @ ${ex.entryPrice} ${ex.currency}).\n\nAverage into position?\nNew avg price: ${newAvg} ${ex.currency} | Total shares: ${newShares}`;
      if (!confirm(confirmMsg)) return;
      D.holdings[existIdx] = { ...ex, shares: newShares, entryPrice: newAvg };
    } else {
      D.holdings.push({ ticker: tkUpper, name: gv('aHName'), currency: gvRaw('aHCur'), exchange: gv('aHExch'), shares: sh, entryPrice: ep, buyDate: gvRaw('aHBuyDate') || '', color: gvRaw('aHColor') || '#5588ff', dividends: parseFloat(gvRaw('aHDiv')) || 0, sector: gvRaw('aHSector') || TICKER_SECTOR_MAP[tkUpper] || '', broker: gv('aHBroker') || '' });
    }
    renderPortfolio();
    renderHistory();
  }
  closeModal();
  saveAndSync();
};

// ── Modal: cerrar posición (total o parcial) ─────────────────
window.openClosePositionModal = function (holdingIdx) {
  const h = D.holdings[holdingIdx];
  if (!h) return;
  const todayStr = new Date().toISOString().slice(0, 10);
  const m = document.getElementById('mod');
  m.innerHTML = `<h2>Close Position — ${h.ticker}</h2>
    <p style="color:var(--text-dim);font-size:13px;margin-bottom:16px">${h.name || h.ticker} &mdash; ${h.shares.toLocaleString('de-DE')} shares &bull; avg entry ${h.entryPrice} ${h.currency}</p>
    <div class="fg"><label>Shares to sell * <small style="color:var(--text-muted)">(max ${h.shares})</small></label>
      <input type="number" id="cSellShares" min="1" max="${h.shares}" value="${h.shares}" autofocus>
    </div>
    <div class="fg"><label>Sell price (${h.currency}) *</label>
      <input type="number" id="cSell" step="0.0001" min="0.0001" placeholder="0.0000">
    </div>
    <div class="fg"><label>Sell date</label>
      <input type="date" id="cDate" value="${todayStr}">
    </div>
    <div class="fg"><label>Lots (optional)</label>
      <input id="cLots" placeholder="200@12.50">
    </div>
    ${ _brokerField('cBroker', h.broker || '') }
    <div id="cPnl" style="background:var(--bg-hover);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;font-family:'IBM Plex Mono',monospace;display:none">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Estimated P&amp;L (sold shares)</div>
      <div id="cPnlVal" style="font-size:18px;font-weight:600"></div>
      <div id="cPnlPct" style="font-size:12px;margin-top:2px;opacity:.7"></div>
      <div id="cPnlType" style="font-size:10px;color:var(--amber);margin-top:4px"></div>
    </div>
    <div id="formErr" class="form-err"></div>
    <div class="m-btns">
      <button class="btn" onclick="window.openEditModal('holding',${holdingIdx})">&#8592; Back</button>
      <button class="btn btn-r" id="btnClosePos" onclick="window.saveClosePosition(${holdingIdx})">Confirm Close</button>
    </div>`;

  // Vista previa en directo del P&L usando shares a vender
  const sellInput   = m.querySelector('#cSell');
  const sharesInput = m.querySelector('#cSellShares');
  const pnlBox      = m.querySelector('#cPnl');
  const pnlVal      = m.querySelector('#cPnlVal');
  const pnlPct      = m.querySelector('#cPnlPct');
  const pnlType     = m.querySelector('#cPnlType');
  function _updatePnl() {
    const sp = parseFloat(sellInput.value);
    const ss = parseInt(sharesInput.value) || h.shares;
    if (!isFinite(sp) || sp <= 0) { pnlBox.style.display = 'none'; return; }
    const pnl = (sp - h.entryPrice) * ss;
    const pct = ((sp - h.entryPrice) / h.entryPrice) * 100;
    const pos = pnl >= 0;
    pnlBox.style.display = '';
    pnlVal.style.color = pos ? 'var(--green)' : 'var(--red)';
    pnlVal.textContent = `${pos ? '+' : ''}${pnl.toFixed(2)} ${h.currency}`;
    pnlPct.textContent = `${pos ? '+' : ''}${pct.toFixed(2)}% vs avg entry`;
    const isPartial = ss < h.shares;
    pnlType.textContent = isPartial ? `Partial close: ${ss} of ${h.shares} shares — ${h.shares - ss} remain` : 'Full close';
  }
  sellInput.addEventListener('input', _updatePnl);
  sharesInput.addEventListener('input', _updatePnl);
};

// ── Confirmar cierre: total o parcial ────────────────────────
window.saveClosePosition = async function (holdingIdx) {
  const sellVal = document.getElementById('cSell')?.value;
  const sell = parseFloat(sellVal);
  if (!sellVal || isNaN(sell) || sell <= 0) {
    _showErr('Sell price is required and must be greater than 0');
    return;
  }

  const h = D.holdings[holdingIdx];
  if (!h) return;

  const sellSharesRaw = parseInt(document.getElementById('cSellShares')?.value);
  const sellShares = isFinite(sellSharesRaw) && sellSharesRaw > 0 ? Math.min(sellSharesRaw, h.shares) : h.shares;
  if (sellShares <= 0) { _showErr('Shares to sell must be greater than 0'); return; }

  _setBtnLoading('btnClosePos', true);

  const sellDate    = document.getElementById('cDate')?.value || new Date().toISOString().slice(0, 10);
  const broker      = document.getElementById('cBroker')?.value || h.broker || '';
  const realizedPnl = Math.round((sell - h.entryPrice) * sellShares * 100) / 100;

  const trade = {
    ticker:      h.ticker,
    name:        h.name || h.ticker,
    currency:    h.currency,
    color:       h.color || '#667788',
    totalShares: sellShares,
    avgBuy:      h.entryPrice,
    buyDate:     h.buyDate || '',
    sellPrice:   sell,
    sellDate,
    realizedPnl,
    dividends:   sellShares === h.shares ? (h.dividends || 0) : 0,
    lots:        document.getElementById('cLots')?.value || '',
    sector:      h.sector || '',
    broker
  };

  const isFullClose = sellShares >= h.shares;
  if (isFullClose) {
    D.holdings.splice(holdingIdx, 1);
  } else {
    // Venta parcial: reducir shares del holding
    D.holdings[holdingIdx] = { ...h, shares: h.shares - sellShares };
  }
  D.closedTrades.push(trade);

  closeModal();
  renderPortfolio();
  renderTrades();
  renderHistory();
  renderAnalytics();

  await saveAndSync();
};

// ── Vista de detalle de un holding (modo lectura) ─────────────
export function openDetailModal(holdingIdx) {
  const h = D.holdings[holdingIdx];
  if (!h) return;
  const pd  = getPriceData(h.ticker);
  const dOk = pd && isFinite(pd.price);
  const chg = dOk ? pd.price - pd.prev : 0;
  const pct = dOk && pd.prev ? (chg / pd.prev) * 100 : 0;
  const pos = chg >= 0;
  const ve  = dOk ? pd.price * h.shares : 0;
  const hRoi = dOk ? (pd.price - h.entryPrice) * h.shares : 0;
  const hRoiPct = h.entryPrice > 0 ? ((hRoi / (h.entryPrice * h.shares)) * 100) : 0;
  const closedForTicker = D.closedTrades.filter(t => t.ticker === h.ticker);

  const has52 = dOk && pd.wk52High != null && pd.wk52Low != null && pd.wk52High > pd.wk52Low;
  const pct52 = has52 ? Math.round(Math.max(0, Math.min(100, (pd.price - pd.wk52Low) / (pd.wk52High - pd.wk52Low) * 100))) : null;

  const historyRows = closedForTicker.length ? closedForTicker.map(t => {
    const rp = t.realizedPnl != null ? t.realizedPnl : Math.round((t.sellPrice - t.avgBuy) * t.totalShares * 100) / 100;
    const rpPos = rp >= 0;
    return `<div class="detail-hist-row">
      <span style="color:var(--text-dim);font-size:11px">${t.sellDate || '—'}</span>
      <span>${t.totalShares} shares @ ${t.sellPrice} ${t.currency}</span>
      <span class="${rpPos ? 'up' : 'dn'}" style="font-weight:600">${rpPos?'+':''}${rp.toFixed(2)} ${t.currency}</span>
    </div>`;
  }).join('') : `<div style="color:var(--text-muted);font-size:12px;padding:8px 0">No closed trades for this ticker</div>`;

  const m = document.getElementById('mod');
  m.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px">
      <div>
        <div style="font-family:'IBM Plex Mono',monospace;font-size:22px;font-weight:700;color:${h.color||'#5588ff'}">${h.ticker}</div>
        <div style="font-size:13px;color:var(--text-dim);margin-top:2px">${h.name || ''}</div>
      </div>
      ${dOk ? `<div style="text-align:right">
        <div style="font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600">${pd.price.toFixed(4)} ${h.currency}</div>
        <div style="font-size:12px;font-weight:600;color:var(--${pos?'green':'red'})">${pos?'+':''}${chg.toFixed(4)} (${pos?'+':''}${pct.toFixed(2)}%)</div>
      </div>` : ''}
    </div>
    ${dOk ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
      ${pd.pe      ? `<span class="detail-chip">P/E ${pd.pe.toFixed(1)}</span>` : ''}
      ${pd.divYield ? `<span class="detail-chip">Yield ${pd.divYield.toFixed(2)}%</span>` : ''}
      ${has52 ? `<span class="detail-chip">52w Lo ${pd.wk52Low.toFixed(2)}</span><span class="detail-chip">Hi ${pd.wk52High.toFixed(2)}</span><span class="detail-chip">${pct52}% of range</span>` : ''}
    </div>` : ''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Shares</div><div class="sum-val" style="font-size:16px">${h.shares.toLocaleString('de-DE')}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Avg Entry</div><div class="sum-val" style="font-size:16px">${h.entryPrice} ${h.currency}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Current Value</div><div class="sum-val ${dOk?'up':''} " style="font-size:16px">${dOk ? (ve * (h.currency==='EUR'?1:1)).toFixed(2)+' '+h.currency : '—'}</div></div>
      <div class="sum-card" style="padding:10px"><div class="sum-lbl">Unrealized P&L</div><div class="sum-val ${dOk?(hRoi>=0?'up':'dn'):''} " style="font-size:16px">${dOk ? (hRoi>=0?'+':'')+hRoi.toFixed(2)+' '+h.currency : '—'}</div></div>
      ${h.sector   ? `<div class="sum-card" style="padding:10px"><div class="sum-lbl">Sector</div><div class="sum-val" style="font-size:14px">${h.sector}</div></div>` : ''}
      ${h.broker   ? `<div class="sum-card" style="padding:10px"><div class="sum-lbl">Broker</div><div class="sum-val" style="font-size:14px">${h.broker}</div></div>` : ''}
      ${h.buyDate  ? `<div class="sum-card" style="padding:10px"><div class="sum-lbl">Buy Date</div><div class="sum-val" style="font-size:14px">${h.buyDate}</div></div>` : ''}
      ${h.exchange ? `<div class="sum-card" style="padding:10px"><div class="sum-lbl">Exchange</div><div class="sum-val" style="font-size:14px">${h.exchange}</div></div>` : ''}
    </div>
    ${dOk && pd.cls && pd.cls.filter(Boolean).length > 4 ? `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">Intraday</div>
      <div style="position:relative;height:70px"><canvas id="detailChart"></canvas></div>
    </div>` : ''}
    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Past Closed Trades (${h.ticker})</div>
    ${historyRows}
    <div class="m-btns" style="margin-top:16px">
      <button class="btn" onclick="window.closeModal()">Close</button>
    </div>`;

  document.getElementById('ov').classList.add('open');

  // Render del mini sparkline intraday
  if (dOk && pd.cls) {
    const canvas = document.getElementById('detailChart');
    if (canvas && typeof Chart !== 'undefined') {
      const validCls = pd.cls.filter(v => v != null);
      const sparkColor = pos ? '#22df8a' : '#ff4466';
      new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels: Array(validCls.length).fill(''), datasets: [{ data: validCls, borderColor: sparkColor, backgroundColor: sparkColor + '18', fill: true, tension: .3, pointRadius: 0, borderWidth: 1.5 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } } }
      });
    }
  }
};
