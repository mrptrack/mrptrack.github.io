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
  let list = D.books.map((b, i) => ({ ...b, _i: i }));
  if (q) list = list.filter(b => (b.title + ' ' + b.author).toLowerCase().includes(q));
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
  const totPages = rated.reduce((s, b) => s + (b.pages || 0), 0);

  document.getElementById('booksSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.books.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Read</div><div class="sum-val">${rated.length}/${D.books.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Pages read</div><div class="sum-val">${totPages.toLocaleString('de-DE')}</div></div>
    <div class="sum-card"><div class="sum-lbl">Avg mine</div><div class="sum-val" style="color:var(--amber)">${rated.length ? F(avgMy, 1) : '\u2014'}/5</div></div>`;

  const grid = document.getElementById('booksGrid');
  grid.innerHTML = '';
  list.forEach(b => {
    const idx = b._i;
    grid.innerHTML += `<div class="m-card" ${_authed ? `data-edit-type="book" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <div class="m-card-top">
        <div class="m-card-title">${b.title}</div>
        <div class="m-card-rating" style="color:${ratingColor(b.myRating ? b.myRating * 2 : null)}">${b.myRating != null ? b.myRating + '/5' : '<span style="color:var(--text-muted);font-size:12px">TBR</span>'}</div>
      </div>
      <div class="m-card-meta">${b.author} \u00b7 ${b.year} \u00b7 ${b.pages} pg \u00b7 <span style="color:var(--text-muted)">GR: ${b.grRating}</span></div>
      ${b.opinion ? `<div class="m-card-opinion">${b.opinion}</div>` : ''}
    </div>`;
  });
}

// ── Movies ───────────────────────────────────────────────────
export function renderMovies() {
  renderMediaInsights('movies');
  const q = (document.getElementById('moviesSearch').value || '').toLowerCase();
  const sort = document.getElementById('moviesSort').value;
  const filt = document.getElementById('moviesFilter').value;
  let list = D.movies.map((m, i) => ({ ...m, _i: i }));
  if (q) list = list.filter(m => (m.title + ' ' + m.director + ' ' + m.actors).toLowerCase().includes(q));
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
  const watched = D.movies.filter(m => m.opinion && m.opinion !== '');
  const totalMin = watched.reduce((s, m) => s + _parseDurMin(m.duration), 0);
  const totalHrs = Math.round(totalMin / 60);

  document.getElementById('moviesSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.movies.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Watched</div><div class="sum-val">${watched.length}/${D.movies.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Hours watched</div><div class="sum-val">${totalHrs}h</div></div>
    <div class="sum-card"><div class="sum-lbl">Avg mine</div><div class="sum-val" style="color:var(--amber)">${rated.length ? F(avgMy, 1) : '\u2014'}/10</div></div>`;

  const grid = document.getElementById('moviesGrid');
  grid.innerHTML = '';
  list.forEach(m => {
    const idx = m._i;
    const mainR = m.myRating != null ? m.myRating : null;
    grid.innerHTML += `<div class="m-card" ${_authed ? `data-edit-type="movie" data-edit-idx="${idx}" style="cursor:pointer"` : ''}>
      <div class="m-card-top">
        <div class="m-card-title">${m.title}</div>
        <div class="m-card-rating" style="color:${mainR != null ? ratingColor(mainR) : 'var(--text-muted)'}">${mainR != null ? mainR + '<span style="font-size:11px;font-weight:400">/10</span>' : '<span style="font-size:12px">\u2014</span>'}</div>
      </div>
      <div class="m-card-meta">${m.director} \u00b7 ${m.year} \u00b7 ${m.duration} \u00b7 <span style="color:var(--text-muted)">FA: ${m.faRating || '\u2014'}</span>${m.platform && !m.platform.startsWith('Ninguna') && !m.platform.startsWith('None') ? ' \u00b7 ' + m.platform : ''}</div>
      ${m.actors ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">${m.actors}</div>` : ''}
      ${m.opinion ? `<div class="m-card-opinion">${m.opinion}</div>` : ''}
    </div>`;
  });
}

// ── Series ───────────────────────────────────────────────────
export function renderSeries() {
  renderMediaInsights('series');
  const q = (document.getElementById('seriesSearch').value || '').toLowerCase();
  const sort = document.getElementById('seriesSort').value;
  const filter = document.getElementById('seriesFilter').value;
  let list = D.series.map((s, i) => ({ ...s, _i: i }));
  if (q) list = list.filter(s => (s.title + ' ' + s.platform).toLowerCase().includes(q));
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

  function _seasonsWatched(s) {
    const w = (s.watched || '').toLowerCase();
    if (!w || s.myRating == null) return 0;
    if (w === 'entera' || w === 'finished' || w === 'al d\u00eda' || w === 'up to date') return s.seasons;
    const m = w.match(/(\d+)\s*(temporada|season)/);
    if (m) return parseInt(m[1]);
    if (w.includes('muchos') || w.includes('many')) return Math.ceil(s.seasons / 2);
    return s.seasons;
  }
  const seriesHrs = Math.round(
    rated.reduce((s, x) => {
      const eps = parseInt(x.epsPerSeason) || 10;
      return s + eps * _seasonsWatched(x) * _parseDurMin(x.epLength);
    }, 0) / 60
  );

  document.getElementById('seriesSummary').innerHTML = `
    <div class="sum-card"><div class="sum-lbl">Total</div><div class="sum-val">${D.series.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Watched</div><div class="sum-val">${watchedCount}/${D.series.length}</div></div>
    <div class="sum-card"><div class="sum-lbl">Hours watched</div><div class="sum-val">${seriesHrs}h</div></div>
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
        <div class="m-card-title">${s.title}</div>
        <div class="m-card-rating" style="color:${ratingColor(s.myRating)}">${s.myRating != null ? s.myRating : '<span style="color:var(--text-muted);font-size:12px">\u2014</span>'}</div>
      </div>
      <div class="m-card-meta"><span style="color:${sc};font-weight:600">${st}</span>
        \u00b7 ${s.seasons} season${s.seasons > 1 ? 's' : ''} \u00b7 ${s.epLength} \u00b7 ${s.platform} \u00b7 ${s.years}
        ${s.imdbRating ? ' \u00b7 <span style="color:var(--text-muted)">IMDB: ' + s.imdbRating + '</span>' : ''}
      </div>
      ${s.opinion ? `<div class="m-card-opinion">${s.opinion}</div>` : ''}
    </div>`;
  });
}
