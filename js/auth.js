// ============================================================
//  auth.js — Google Sign-In + session token semanal
//
//  Flujo:
//    1. Usuario pulsa "Sign in with Google"
//    2. GSI devuelve un id_token (JWT de Google, ~1h)
//    3. Lo intercambiamos con el GAS por un session_token propio (7d)
//       · GAS valida el id_token + allowlist y firma un JWT con HMAC
//    4. El session_token se guarda en localStorage; se envía en cada
//       request al GAS. El id_token se descarta tras el intercambio.
//    5. Al caducar el session_token, el usuario vuelve a iniciar sesión.
//
//  Revocación: GAS verifica la allowlist también al validar el session_token,
//  no solo en el login. Retirar un hash expulsa al usuario al instante.
// ============================================================
import { setAuthed, setCurrentUser } from './state.js';
import { GOOGLE_CLIENT_ID, PROXY_URL } from './config.js';

const LS_SESSION = 'trackmrp_track_session';
const LS_EMAIL   = 'trackmrp_g_email';

let _sessionToken = null;
let _email = null;
let _onLogin = null;
let _onLogout = null;

// Limpia claves de versiones anteriores del sistema de auth
try { localStorage.removeItem('trackmrp_g_id_token'); } catch {}

// ── Decodifica el payload de un JWT (sin verificar la firma — solo UI) ─────
function _decodeJwt(token) {
  try {
    const part = token.split('.')[1];
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - b64.length % 4) % 4);
    return JSON.parse(decodeURIComponent(escape(atob(pad))));
  } catch { return null; }
}

function _isExpired(token) {
  const p = _decodeJwt(token);
  return !p || !p.exp || (p.exp * 1000) <= Date.now();
}

// ── Accessor para cloud.js: devuelve el session token actual o null ───────
export function getSessionToken() {
  if (!_sessionToken) return null;
  if (_isExpired(_sessionToken)) {
    _clearSession();
    if (_onLogout) _onLogout();
    _initGsi();
    return null;
  }
  return _sessionToken;
}

function _clearSession() {
  _sessionToken = null;
  _email = null;
  localStorage.removeItem(LS_SESSION);
  localStorage.removeItem(LS_EMAIL);
  setAuthed(false);
  setCurrentUser(null);
}

// ── Inicializa auth: restaura sesión local o prepara el botón de login ────
export function initAuth(onLogin, onLogout) {
  _onLogin = onLogin;
  _onLogout = onLogout;

  const stored = localStorage.getItem(LS_SESSION);
  const storedEmail = localStorage.getItem(LS_EMAIL);
  if (stored && storedEmail && !_isExpired(stored)) {
    _sessionToken = stored;
    _email = storedEmail;
    const user = { id: storedEmail, email: storedEmail };
    setCurrentUser(user);
    setAuthed(true);
    onLogin(user, false);
    _initGsi();
    return;
  }

  _clearSession();
  onLogout();
  _initGsi();
}

// ── Espera a que window.google.accounts.id esté disponible ────────────────
function _whenGsiReady(cb, attempts = 50) {
  if (window.google && window.google.accounts && window.google.accounts.id) return cb();
  if (attempts <= 0) { console.warn('[auth] GSI no cargó'); return; }
  setTimeout(() => _whenGsiReady(cb, attempts - 1), 100);
}

function _initGsi() { if (!GOOGLE_CLIENT_ID || !PROXY_URL) { const box = document.getElementById('loginErr'); if (box) box.textContent = 'Google Sign-In pendiente de configurar.'; return; }
  _whenGsiReady(() => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: _handleCredentialResponse,
      auto_select: false,
    });
    const host = document.getElementById('gsiButton');
    if (host) {
      host.innerHTML = '';
      google.accounts.id.renderButton(host, {
        theme: 'filled_black',
        size: 'large',
        text: 'signin_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: 280,
      });
    }
  });
}

// ── Callback de GSI: intercambia id_token por session_token ───────────────
async function _handleCredentialResponse(resp) {
  const idToken = resp && resp.credential;
  if (!idToken) return;
  const payload = _decodeJwt(idToken);
  if (!payload || !payload.email) return;

  const errEl = document.getElementById('loginErr');
  if (errEl) errEl.textContent = '';

  let sessionToken = null;
  try {
    const r = await fetch(PROXY_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'login', id_token: idToken }),
    });
    const text = await r.text();
    let j = null;
    try { j = JSON.parse(text); } catch {}
    if (!j) { const m = text.match(/\{[^]*\}/); if (m) { try { j = JSON.parse(m[0]); } catch {} } }
    if (j && j.session_token) {
      sessionToken = j.session_token;
    } else {
      const msg = (j && j.error) === 'unauthorized'
        ? 'Email no autorizado'
        : 'Error: ' + ((j && j.error) || 'respuesta inesperada');
      if (errEl) errEl.textContent = msg;
      return;
    }
  } catch (e) {
    if (errEl) errEl.textContent = 'No se pudo contactar con el servidor';
    console.warn('[auth] login exchange failed:', e && e.message);
    return;
  }

  _sessionToken = sessionToken;
  _email = payload.email;
  localStorage.setItem(LS_SESSION, sessionToken);
  localStorage.setItem(LS_EMAIL, _email);

  const user = { id: _email, email: _email };
  setCurrentUser(user);
  setAuthed(true);
  if (_onLogin) _onLogin(user, true);
}

// ── Llamar cuando el GAS responde 'unauthorized' mid-sesión ───────────────
export function onUnauthorizedFromServer() {
  _clearSession();
  if (_onLogout) _onLogout();
  _initGsi();
}

// ── Cerrar sesión manual ──────────────────────────────────────────────────
export async function signOut() {
  try {
    if (window.google && google.accounts && google.accounts.id) {
      google.accounts.id.disableAutoSelect();
    }
  } catch {}
  _clearSession();
  if (_onLogout) _onLogout();
  _initGsi();
}
