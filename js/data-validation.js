import {validateLife,lifeDefaults} from './life-schema.js';
import {validateGame} from './game-schema.js';
import {validateBrokers} from './broker-model.js';
const CURRENCIES = ['EUR', 'USD', 'CAD', 'GBP', 'JPY'];
const KNOWN_KEYS = ['dashboardExtras','holdings', 'cash', 'totalInvested', 'closedTrades', 'history',
  'gym', 'books', 'movies', 'series', 'watchlist', 'games', 'schemaVersion', 'preferences', 'workouts', 'activities', 'trainingInitialized', 'brokers'];

// ── Validación de esquema (pura, testeable desde consola) ────
export function validateData(obj, current={}) {
  const errors = [], warnings = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['El JSON raíz debe ser un objeto'], warnings, data: null };
  }

  errors.push(...validateLife({...obj, activities: obj.activities ?? current.activities}));
  for (const key of ['workouts','activities','preferences']) if (obj[key] == null && current[key]) warnings.push(key + ': missing in backup; current data will be preserved');
  const isNum = v => typeof v === 'number' && isFinite(v);
  const arr = k => Array.isArray(obj[k]) ? obj[k] : (obj[k] == null ? null : undefined);

  ['holdings', 'closedTrades', 'history', 'gym', 'books', 'movies', 'series'].forEach(k => {
    if (arr(k) === undefined) errors.push(`"${k}" debe ser un array`);
    if (arr(k) === null) warnings.push(`"${k}" no existe en el archivo → se importa vacío`);
  });
  if (obj.watchlist != null && !Array.isArray(obj.watchlist)) errors.push('"watchlist" debe ser un array');
  if (obj.cash != null && (!isNum(obj.cash) || obj.cash < 0)) errors.push('"cash" debe ser un número ≥ 0');
  if (obj.totalInvested != null && (!isNum(obj.totalInvested) || obj.totalInvested < 0)) errors.push('"totalInvested" debe ser un número ≥ 0');

  // A partir de aquí solo se itera lo que de verdad es un array (los tipos
  // incorrectos ya están reportados arriba; sin esto un string crashearía)
  const safe = k => Array.isArray(obj[k]) ? obj[k] : [];

  safe('holdings').forEach((h, i) => {
    const id = `holdings[${i}]${h && h.ticker ? ' (' + h.ticker + ')' : ''}`;
    if (!h || typeof h !== 'object') { errors.push(`${id}: no es un objeto`); return; }
    if (!h.ticker || typeof h.ticker !== 'string') errors.push(`${id}: falta "ticker"`);
    if (!isNum(h.shares) || h.shares <= 0) errors.push(`${id}: "shares" debe ser > 0`);
    if (!isNum(h.entryPrice) || h.entryPrice <= 0) errors.push(`${id}: "entryPrice" debe ser > 0`);
    if (!CURRENCIES.includes(h.currency)) errors.push(`${id}: "currency" debe ser ${CURRENCIES.join('/')}`);
  });
  errors.push(...validateBrokers(obj.brokers ?? current.brokers ?? [],safe('holdings')));
  if(obj.brokers==null && (current.brokers||[]).length) warnings.push('Sin brokers en este backup: se conservarán los actuales');

  safe('closedTrades').forEach((t, i) => {
    const id = `closedTrades[${i}]${t && t.ticker ? ' (' + t.ticker + ')' : ''}`;
    if (!t || typeof t !== 'object') { errors.push(`${id}: no es un objeto`); return; }
    if (!t.ticker || typeof t.ticker !== 'string') errors.push(`${id}: falta "ticker"`);
    if (!isNum(t.totalShares) || t.totalShares <= 0) errors.push(`${id}: "totalShares" debe ser > 0`);
    if (!isNum(t.avgBuy) || t.avgBuy <= 0) errors.push(`${id}: "avgBuy" debe ser > 0`);
    if (!isNum(t.sellPrice) || t.sellPrice <= 0) errors.push(`${id}: "sellPrice" debe ser > 0`);
    if (!CURRENCIES.includes(t.currency)) errors.push(`${id}: "currency" debe ser ${CURRENCIES.join('/')}`);
  });

  if (obj.games != null && !Array.isArray(obj.games)) errors.push('games debe ser un array');
  safe('games').forEach((g, i) => {
    const error = validateGame(g);
    if (error) errors.push('games[' + i + ']: ' + error);
  });
  if (obj.games == null && (current.games || []).length) warnings.push('Sin videojuegos en este backup: se conservarán los actuales');
  const seen = new Set();
  let dupes = 0, badDates = 0;
  safe('history').forEach(h => {
    if (!h || !/^\d{4}-\d{2}-\d{2}$/.test(h.date || '') || !isNum(h.totalInvested) || !isNum(h.totalValue)) { badDates++; return; }
    if (seen.has(h.date)) dupes++;
    seen.add(h.date);
  });
  if (badDates) errors.push(`history: ${badDates} entradas sin fecha ISO o sin números válidos`);
  if (dupes) warnings.push(`history: ${dupes} fechas duplicadas → se conserva la última de cada fecha`);

  Object.keys(obj).forEach(k => {
    if (!KNOWN_KEYS.includes(k)) warnings.push(`clave desconocida "${k}" → se ignorará al guardar`);
  });

  // Nunca pisar datos buenos con un archivo vacío
  const empty = !safe('holdings').length && !safe('closedTrades').length
    && !safe('history').length && !obj.cash && !obj.totalInvested;
  const currentHasData = (current.holdings || []).length || (current.closedTrades || []).length
    || (current.history || []).length;
  if (empty && currentHasData) errors.push('El archivo no contiene datos de cartera: import bloqueado para no borrar los actuales');

  if (errors.length) return { ok: false, errors, warnings, data: null };

  // Normalizar: ordenar history y deduplicar por fecha (gana la última)
  const map = {};
  (obj.history || []).forEach(h => { map[h.date] = h; });
  const data = {
    ...lifeDefaults(obj, structuredClone(current)),
    holdings: obj.holdings || [], cash: obj.cash ?? 0, totalInvested: obj.totalInvested ?? 0,
    brokers: obj.brokers ?? structuredClone(current.brokers || []),
    closedTrades: obj.closedTrades || [],
    history: Object.values(map).sort((a, b) => a.date.localeCompare(b.date)),
    gym: obj.gym || [], books: obj.books || [], movies: obj.movies || [],
    series: obj.series || [], watchlist: obj.watchlist || [], games: obj.games ?? structuredClone(current.games || [])
  };
  return { ok: true, errors, warnings, data };
}
