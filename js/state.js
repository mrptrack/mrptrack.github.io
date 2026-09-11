// ============================================================
//  state.js — Estado mutable compartido entre módulos
//
//  Usa live bindings de ES Modules: importar _authed en otro
//  módulo siempre refleja el valor actual (no una copia).
// ============================================================

// Objeto de datos de la aplicación — mutable, compartido
export const D = {};

// Estado de autenticación
export let _authed = false;
export function setAuthed(v) { _authed = v; }

// Acción pendiente tras autenticación
export let _pendingAction = null;
export function setPendingAction(v) { _pendingAction = v; }

// Token de sesión emitido por GAS (Fase 2). null = auth local sin token.
export let _token = null;
export function setToken(v) { _token = v; }

// Usuario autenticado activo ({id, email}). null = sin sesión.
export let _currentUser = null;
export function setCurrentUser(v) { _currentUser = v; }

// ── Guard: ¿D está en estado FALLBACK (recién inicializado, sin datos)? ──
// Devuelve true si TODOS los campos están vacíos o a 0.
// Lo usan cloud.js y storage.js para REHUSAR escrituras que sobreescribirían
// datos buenos en remoto/localStorage con un D fresh-load (race condition
// típica al borrar caché + relogin).
export function isFallbackState() {
  const noHoldings = !D.holdings || D.holdings.length === 0;
  const noCash     = !D.cash;
  const noInvested = !D.totalInvested;
  const noClosed   = !D.closedTrades || D.closedTrades.length === 0;
  // history cuenta como "vacío" si no hay entradas con totalValue/Invested > 0
  const noHistory  = !D.history || !D.history.some(h => (h.totalValue > 0) || (h.totalInvested > 0));
  const noGym      = !D.gym    || D.gym.length === 0;
  const noBooks    = !D.books  || D.books.length === 0;
  const noMovies   = !D.movies || D.movies.length === 0;
  const noSeries   = !D.series || D.series.length === 0;
  return noHoldings && noCash && noInvested && noClosed && noHistory && noGym && noBooks && noMovies && noSeries && !(D.games || []).length;
}
