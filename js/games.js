import { D, _authed } from './state.js';
import { saveAndSync } from './cloud.js';
import { F, ratingColor } from './utils.js';
import { GAME_STATUSES, validateGame } from './game-schema.js';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el = id => document.getElementById(id);
const close = () => el('ov').classList.remove('open');

export function renderGames() {
  if (!el('gamesGrid')) return;
  const games = D.games || [];
  const q = el('gamesSearch').value.toLowerCase().trim();
  const status = el('gamesFilter').value;
  const sort = el('gamesSort').value;
  const list = games.map((g, i) => ({...g, i})).filter(g =>
    (!q || [g.title, g.developer, g.platform].join(' ').toLowerCase().includes(q)) &&
    (status === 'all' || (g.status || 'Backlog') === status));
  if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
  else if (sort !== 'default') list.sort((a, b) => (b[sort] ?? -1) - (a[sort] ?? -1));
  const rated = games.filter(g => g.myRating != null);
  const stats = [['Games', games.length], ['Completed', games.filter(g => g.status === 'Completed').length],
    ['Hours played', F(games.reduce((s, g) => s + (g.hours || 0), 0), 1) + 'h'],
    ['Avg mine', rated.length ? F(rated.reduce((s, g) => s + g.myRating, 0) / rated.length, 1) + '/10' : '—']];
  el('gamesSummary').innerHTML = stats.map(([label, value]) => `<div class="sum-card"><div class="sum-lbl">${label}</div><div class="sum-val">${value}</div></div>`).join('');
  el('gamesGrid').innerHTML = list.map(g => {
    const meta = [g.platform, g.developer, g.releaseYear ? 'Released ' + g.releaseYear : '', g.playedYear ? 'Played ' + g.playedYear : '', g.hours != null ? F(g.hours, 1) + 'h' : '', g.metacritic != null ? 'Metacritic: ' + g.metacritic + '/100' : ''].filter(Boolean);
    return `<div class="m-card" ${_authed ? `data-edit-type="game" data-edit-idx="${g.i}"` : ''}>
      <div class="m-card-top"><div class="m-card-title">${esc(g.title)}</div><div class="m-card-rating" style="color:${g.myRating == null ? 'var(--text-muted)' : ratingColor(g.myRating, 10)}">${g.myRating == null ? '—' : g.myRating + '/10'}</div></div>
      <div class="m-card-meta">${esc(g.status || 'Backlog')}${meta.length ? ' · ' + meta.map(esc).join(' · ') : ''}</div>
      ${g.opinion ? `<div class="m-card-opinion">${esc(g.opinion)}</div>` : ''}</div>`;
  }).join('') || '<p class="empty-state">' + (games.length ? 'No games match your filters.' : 'Your games, all in one place. Use Edit to add your first game.') + '</p>';
}

export function openGameModal(idx = null) {
  if (!_authed) return;
  const g = idx == null ? {} : D.games[idx];
  if (!g) return;
  const fields = [['title','Title','text'], ['platform','Platform','text'], ['developer','Developer','text'],
    ['releaseYear','Release year','number'], ['playedYear','Year played','number'], ['metacritic','Metacritic /100','number'],
    ['myRating','My rating /10','number'], ['hours','Hours played','number']];
  const bounds = {releaseYear:'min="1950" max="2200" step="1"', playedYear:'min="1950" max="2200" step="1"', metacritic:'min="0" max="100" step="1"', myRating:'min="0" max="10" step="0.1"', hours:'min="0" max="100000" step="0.1"'};
  el('mod').innerHTML = `<h2>${idx == null ? 'Add' : 'Edit'} Game</h2><form id="gameForm">
    <div class="game-fields">${fields.map(([key, label, type]) => `<div class="fg"><label for="game-${key}">${label}</label><input id="game-${key}" name="${key}" type="${type}" value="${esc(g[key])}" ${bounds[key] || ''} ${key === 'title' ? 'required' : ''} ${key === 'platform' ? 'list="gamePlatforms"' : ''}></div>`).join('')}</div>
    <datalist id="gamePlatforms"><option value="PC"><option value="PS5"><option value="PS4"><option value="Nintendo Switch"><option value="Nintendo Switch 2"><option value="Xbox Series X|S"><option value="Steam Deck"><option value="Mobile"></datalist>
    <div class="fg"><label for="game-status">Status</label><select id="game-status" name="status">${GAME_STATUSES.map(s => `<option ${s === (g.status || 'Backlog') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
    <div class="fg"><label for="game-opinion">Notes / opinion</label><textarea id="game-opinion" name="opinion">${esc(g.opinion)}</textarea></div>
    <p id="gameError" role="alert" style="color:var(--red)"></p><div class="m-btns">${idx != null ? '<button class="btn btn-r" type="button" id="gameDelete">Delete</button>' : ''}<button class="btn" type="button" id="gameCancel">Cancel</button><button class="btn btn-g" type="submit">Save</button></div></form>`;
  el('ov').classList.add('open');
  el('gameCancel').onclick = close;
  el('gameDelete')?.addEventListener('click', () => {
    if (!_authed || !confirm('Delete this game?')) return;
    D.games.splice(idx, 1); close(); renderGames(); saveAndSync();
  });
  el('gameForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!_authed) return;
    const values = new FormData(event.currentTarget);
    const next = {};
    for (const [key, , type] of fields) {
      const value = values.get(key).trim();
      next[key] = type === 'number' ? (value === '' ? null : Number(value)) : value;
    }
    next.status = values.get('status'); next.opinion = values.get('opinion').trim();
    const error = validateGame(next);
    if (error) { el('gameError').textContent = error; return; }
    D.games ||= [];
    if (idx == null) D.games.push(next); else D.games[idx] = next;
    close(); renderGames(); saveAndSync();
  });
  el('game-title').focus();
}

export function initGames() {
  el('btnAddGame').addEventListener('click', () => openGameModal());
  el('gamesSearch').addEventListener('input', renderGames);
  for (const id of ['gamesSort', 'gamesFilter']) el(id).addEventListener('change', renderGames);
}
