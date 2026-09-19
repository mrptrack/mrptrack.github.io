import { t, mediaTitle } from './i18n.js';
import { esc, seriesProgress } from './life-schema.js';
// ============================================================
//  media.js — Books, Movies y Series: render y helpers
// ============================================================
import { D } from './state.js';
import { _authed } from './state.js';
import { F, ratingColor } from './utils.js';
import { renderMediaInsights } from './insights.js';

export function _parseDurMin(s) {
  if (!s) return 0;
  let m = 0;
  const h = s.match(/(\d+)\s*h/);
  const mi = s.match(/(\d+)\s*min/);
  if (h) m += parseInt(h[1]) * 60;
  if (mi) m += parseInt(mi[1]);
  return m;
}

// ── Books ────────────────────────────────────────────────────
export function renderBooks() {
  renderMediaInsights('books');
  const q = (document.getElementById('booksSearch').value || '').toLowerCase();
  const sort = document.getElementById('booksSort').value;
  const filter = document.getElementById('booksFilter').value;
  let list = D.books.map((b, i) => ({ ...b, title:mediaTitle(b), _i: i }));
  if (q) list = list.filter(b => (b.title + ' ' + b.author + ' ' + Object.values(b.translations || {}).map(x=>x.title).join(' ')).toLowerCase().includes(q));
  if (filter === 'rated') list = list.filter(b => b.myRating != null);
  if (filter === 'unrated') list = list.filter(b => b.myRating == null);
  const S = {
    default: (a, b) => a._i - b._i,
    'rating-desc': (a, b) => (b.myRating || 0) - (a.myRating || 0),
    'gr-desc': (a, b) => b.grRating - a.grRating,
    'pages-desc': (a, b) => (b.pages || 0) - (a.pages || 0),
    'pages-asc': (a, b) => (a.pages || 9999) - (b.pages || 9999),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  list.sort(S[sort] || S.default);

  const rated = D.books.filter(b => b.myRating != null);
  const avgMy = rated.length ? rated.reduce((s, b) => s + b.myRating, 0) / rated.length : 0;
  const pendingPages = D.books.filter(b=>b.myRating==null).reduce((sum,b)=>sum+(b.pages||0),0);
  const totPages = rated.reduce((s, b) => s + (b.pages || 0), 0);

  document.getElementById('booksSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.books.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Read</div><div class="sum-val">${rated.length}/${D.books.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Pages read</div><div class="sum-val">${F(totPages,0)}</div><div class="sum-sub">${F(pendingPages,0)} ${t('remaining')}</div></div>
    <div class="sum-card"><div class="sum-lbl">Avg mine</div><div class="sum-val" style="color:var(--amber)">${rated.length ? F(avgMy, 1) : '\u2014'}/5</div></div>`;

  const grid = document.getElementById('booksGrid');
  grid.innerHTML = '';
  list.forEach(b => {
    const idx = b._i;
    grid.innerHTML += `<div class="m-card" ${_authed ? `data-edit-type="book" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <div class="m-card-top">
        <div class="m-card-title">${esc(b.title)}</div>
        <div class="m-card-rating" style="color:${ratingColor(b.myRating ? b.myRating * 2 : null)}">${b.myRating != null ? b.myRating + '/5' : '<span style="color:var(--text-muted);font-size:12px">TBR</span>'}</div>
      </div>
      <div class="m-card-meta">${esc(b.author)} \u00b7 ${b.year} \u00b7 ${b.pages} pg \u00b7 <span style="color:var(--text-muted)">GR: ${b.grRating}</span></div>
      ${b.opinion ? `<div class="m-card-opinion">${esc(b.opinion)}</div>` : ''}
    </div>`;
  });
}

// ── Movies ───────────────────────────────────────────────────
export function renderMovies() {
  renderMediaInsights('movies');
  const q = (document.getElementById('moviesSearch').value || '').toLowerCase();
  const sort = document.getElementById('moviesSort').value;
  const filt = document.getElementById('moviesFilter').value;
  let list = D.movies.map((m, i) => ({ ...m, title:mediaTitle(m), _i: i }));
  if (q) list = list.filter(m => (m.title + ' ' + m.director + ' ' + m.actors + ' ' + Object.values(m.translations || {}).map(x=>x.title).join(' ')).toLowerCase().includes(q));
  if (filt === 'rated') list = list.filter(m => m.myRating != null);
  else if (filt === 'unrated') list = list.filter(m => m.myRating == null);
  const S = {
    default: (a, b) => a._i - b._i,
    'fa-desc': (a, b) => (b.faRating || 0) - (a.faRating || 0),
    'my-desc': (a, b) => (b.myRating || 0) - (a.myRating || 0),
    'year-desc': (a, b) => (b.year || 0) - (a.year || 0),
    'year-asc': (a, b) => (a.year || 9999) - (b.year || 9999),
    'dur-desc': (a, b) => _parseDurMin(b.duration) - _parseDurMin(a.duration),
    'dur-asc': (a, b) => _parseDurMin(a.duration) - _parseDurMin(b.duration),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  list.sort(S[sort] || S.default);

  const rated = D.movies.filter(m => m.myRating != null);
  const avgMy = rated.length ? rated.reduce((s, m) => s + m.myRating, 0) / rated.length : 0;
  const watched = D.movies.filter(m => m.myRating != null || !!m.opinion?.trim());
  const pendingMovies = D.movies.filter(m=>!watched.includes(m));
  const pendingHours = pendingMovies.reduce((sum,m)=>sum+_parseDurMin(m.duration),0)/60;
  const missingDurations = pendingMovies.filter(m=>!_parseDurMin(m.duration)).length;
  const totalMin = watched.reduce((s, m) => s + _parseDurMin(m.duration), 0);
  const totalHrs = Math.round(totalMin / 60);

  document.getElementById('moviesSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.movies.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Watched</div><div class="sum-val">${watched.length}/${D.movies.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Hours watched</div><div class="sum-val">${totalHrs}h</div><div class="sum-sub">${F(pendingHours,1)}h ${t('remaining')}${missingDurations ? ' · '+missingDurations+' '+t('Unknown duration') : ''}</div></div>
    <div class="sum-card"><div class="sum-lbl">Avg mine</div><div class="sum-val" style="color:var(--amber)">${rated.length ? F(avgMy, 1) : '\u2014'}/10</div></div>`;

  const grid = document.getElementById('moviesGrid');
  grid.innerHTML = '';
  list.forEach(m => {
    const idx = m._i;
    const mainR = m.myRating != null ? m.myRating : null;
    grid.innerHTML += `<div class="m-card" ${_authed ? `data-edit-type="movie" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <div class="m-card-top">
        <div class="m-card-title">${esc(m.title)}</div>
        <div class="m-card-rating" style="color:${mainR != null ? ratingColor(mainR) : 'var(--text-muted)'}">${mainR != null ? mainR + '<span style="font-size:11px;font-weight:400">/10</span>' : '<span style="font-size:12px">\u2014</span>'}</div>
      </div>
      <div class="m-card-meta">${esc(m.director)} \u00b7 ${m.year} \u00b7 ${esc(m.duration)} \u00b7 <span style="color:var(--text-muted)">FA: ${m.faRating || '\u2014'}</span>${m.platform && !m.platform.startsWith('Ninguna') && !m.platform.startsWith('None') ? ' \u00b7 ' + m.platform : ''}</div>
      ${m.actors ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${esc(m.actors)}</div>` : ''}
      ${m.opinion ? `<div class="m-card-opinion">${esc(m.opinion)}</div>` : ''}
    </div>`;
  });
}

// ── Series ───────────────────────────────────────────────────
export function renderSeries() {
  renderMediaInsights('series');
  const q = (document.getElementById('seriesSearch').value || '').toLowerCase();
  const sort = document.getElementById('seriesSort').value;
  const filter = document.getElementById('seriesFilter').value;
  let list = D.series.map((s, i) => ({ ...s, title:mediaTitle(s), _i: i }));
  if (q) list = list.filter(s => (s.title + ' ' + s.platform + ' ' + Object.values(s.translations || {}).map(x=>x.title).join(' ')).toLowerCase().includes(q));
  if (filter === 'finished') list = list.filter(s => s.watched === 'Entera' || s.watched === 'Finished');
  if (filter === 'watching') list = list.filter(s => s.wantFinish === 'S\u00ed' || s.wantFinish === 'Yes' || s.wantFinish === 'Volver a verla' || s.wantFinish === 'Rewatch' || s.watched === 'Al d\u00eda' || s.watched === 'Up to date');
  if (filter === 'dropped') list = list.filter(s => s.wantFinish === 'No');
  if (filter === 'notstarted') list = list.filter(s => s.myRating == null);
  const S = {
    default: (a, b) => a._i - b._i,
    'rating-desc': (a, b) => (b.myRating || 0) - (a.myRating || 0),
    'imdb-desc': (a, b) => (b.imdbRating || 0) - (a.imdbRating || 0),
    title: (a, b) => a.title.localeCompare(b.title)
  };
  list.sort(S[sort] || S.default);

  const rated = D.series.filter(s => s.myRating != null);
  const avgMy = rated.length ? rated.reduce((s, x) => s + x.myRating, 0) / rated.length : 0;
  const notStarted = D.series.filter(s => s.myRating == null).length;
  const watchedCount = D.series.length - notStarted;

  const progress=D.series.map(seriesProgress);
  const seriesHrs=Math.round(progress.reduce((sum,p)=>sum+p.done,0)/60);
  const remainingHrs=Math.round(progress.reduce((sum,p)=>sum+p.remaining,0)/60);
  const estimated=progress.some(p=>p.estimated);

  document.getElementById('seriesSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.series.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Watched</div><div class="sum-val">${watchedCount}/${D.series.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Hours watched</div><div class="sum-val">${estimated?'≈ ':''}${seriesHrs}h</div><div class="sum-sub" title="${t('Estimated hours: incomplete episode counts or viewing progress.')}">${estimated?'≈ ':''}${remainingHrs}h ${t('remaining')}</div></div>
    <div class="sum-card"><div class="sum-lbl">Avg mine</div><div class="sum-val" style="color:var(--amber)">${rated.length ? F(avgMy, 1) : '\u2014'}/10</div></div>`;

  const grid = document.getElementById('seriesGrid');
  grid.innerHTML = '';
  list.forEach(s => {
    const idx = s._i;
    let sc, st;
    if (s.watched === 'Entera' || s.watched === 'Finished') { sc = 'var(--green)'; st = 'Finished'; }
    else if (s.watched === 'Al d\u00eda' || s.watched === 'Up to date') { sc = 'var(--blue)'; st = 'Up to date'; }
    else if (s.wantFinish === 'Volver a verla' || s.wantFinish === 'Rewatch') { sc = 'var(--cyan)'; st = 'Rewatch'; }
    else if (s.wantFinish === 'No') { sc = 'var(--red)'; st = 'Dropped'; }
    else if (s.wantFinish === 'S\u00ed' || s.wantFinish === 'Yes') { sc = 'var(--amber)'; st = s.watched || 'In progress'; }
    else if (s.watched && s.watched !== '') { sc = 'var(--amber)'; st = s.watched; }
    else if (!s.watched && !s.myRating) { sc = 'var(--text-muted)'; st = 'Watchlist'; }
    else { sc = 'var(--text-dim)'; st = s.watched || 'Unknown'; }
    grid.innerHTML += `<div class="m-card" ${_authed ? `data-edit-type="serie" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <div class="m-card-top">
        <div class="m-card-title">${esc(s.title)}</div>
        <div class="m-card-rating" style="color:${ratingColor(s.myRating)}">${s.myRating != null ? s.myRating : '<span style="color:var(--text-muted);font-size:12px">\u2014</span>'}</div>
      </div>
      <div class="m-card-meta"><span style="color:${sc};font-weight:600">${esc(t(st))}</span>
        \u00b7 ${t(s.seasons+' seasons')} \u00b7 ${esc(s.epLength)} \u00b7 ${esc(s.platform)} \u00b7 ${esc(s.years)}
        ${s.imdbRating ? ' \u00b7 <span style="color:var(--text-muted)">IMDB: ' + s.imdbRating + '</span>' : ''}
      </div>
      ${s.opinion ? `<div class="m-card-opinion">${esc(s.opinion)}</div>` : ''}
    </div>`;
  });
}
