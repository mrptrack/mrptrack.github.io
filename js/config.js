// ============================================================
//  config.js — Constantes de la aplicación
// ============================================================

// --- GOOGLE SIGN-IN ---
// Client ID de OAuth 2.0 (GCP → APIs & Services → Credentials).
// La allowlist de emails (hasheados) vive en Script Properties del GAS;
// nunca se publica en el repo.
export const GOOGLE_CLIENT_ID = '291605339266-hfqnq95geadidevdeq1ml1mokmmcs0bn.apps.googleusercontent.com';

// --- STORAGE (Drive vía Apps Script) ---
export const PROXY_URL = 'https://script.google.com/macros/s/AKfycbybSusVna8maivC4ilshN_3cIHSq_c60CP8Qn7ZWRb2TAWxWgQxha_dR9qljxLSLAI3/exec';

// ── Constantes estáticas ────────────────────────────────────

// Tipos de cambio estáticos (fallback de emergencia si las APIs de FX fallan)
export const TRADE_FX = { EUR: 1, USD: 0.8696, CAD: 0.6369, GBP: 1.1574, JPY: 0.006 /* emergency estimate */ };
// Datos de arranque vacíos (FALLBACK)
export const FALLBACK = {
  holdings: [],
  cash: 0,
  totalInvested: 0,
  closedTrades: [],
  history: [],
  gym: [],
  books: [],
  movies: [],
  series: [],
  games: [],
  watchlist: []
};
