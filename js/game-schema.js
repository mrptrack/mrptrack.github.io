export const GAME_STATUSES = ['Backlog', 'Playing', 'Completed', 'Paused', 'Dropped'];

export function validateGame(g) {
  if (!g || typeof g !== 'object' || Array.isArray(g)) return 'Invalid game';
  if (typeof g.title !== 'string' || !g.title.trim()) return 'Title is required';
  for (const k of ['platform', 'developer', 'opinion']) {
    if (g[k] != null && typeof g[k] !== 'string') return k + ' must be text';
  }
  for (const [k, min, max, integer] of [['releaseYear', 1950, 2200, true], ['playedYear', 1950, 2200, true], ['metacritic', 0, 100, true], ['myRating', 0, 10, false], ['hours', 0, 100000, false]]) {
    const v = g[k];
    if (v != null && (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v)))) return k + ': enter a value between ' + min + ' and ' + max;
  }
  if (g.status != null && !GAME_STATUSES.includes(g.status)) return 'Invalid status';
  return null;
}
