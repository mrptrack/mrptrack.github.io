// ============================================================
//  sw.js — Service Worker del Dashboard Personal
//
//  Estrategia de caché:
//
//  1. CACHE-FIRST   → assets estáticos (JS, CSS, HTML, fuentes)
//     Si el recurso está en caché → sirve desde caché, actualiza en background.
//     Si NO está en caché → red → guarda en caché → responde.
//
//  2. NETWORK-FIRST → llamadas a la API (GAS / script.google.com)
//     Intenta red (timeout internamente por el propio fetch).
//     Si la red falla → sirve desde caché como fallback offline.
//     Nunca deja la UI en blanco.
//
// ============================================================

const CACHE_VERSION = 'mrp-v1'; const APP_BASE = new URL('./', self.location.href);

// Nombres de cada caché por tipo
const CACHE_STATIC = 'trackmrp-static-' + CACHE_VERSION;
const CACHE_API    = 'trackmrp-api-'    + CACHE_VERSION;

// Assets precargados en install (shell de la app)
const PRECACHE_URLS = [
  new URL('', APP_BASE).href,
  new URL('index.html', APP_BASE).href,
  new URL('css/styles.css', APP_BASE).href,
  new URL('js/app.js', APP_BASE).href,
  new URL('js/config.js', APP_BASE).href,
  new URL('js/state.js', APP_BASE).href,
  new URL('js/utils.js', APP_BASE).href,
  new URL('js/storage.js', APP_BASE).href,
  new URL('js/cloud.js', APP_BASE).href,
  new URL('js/portfolio.js', APP_BASE).href,
  new URL('js/trades.js', APP_BASE).href,
  new URL('js/gym.js', APP_BASE).href,
  new URL('js/media.js', APP_BASE).href,
  new URL('js/games.js', APP_BASE).href,
  new URL('js/game-schema.js', APP_BASE).href,
  new URL('js/modals.js', APP_BASE).href,
  new URL('js/auth.js', APP_BASE).href,
  new URL('js/analytics.js', APP_BASE).href,
  new URL('js/calculator.js', APP_BASE).href,
  new URL('js/insights.js', APP_BASE).href,
  new URL('js/watchlist.js', APP_BASE).href,
  new URL('js/importer.js', APP_BASE).href,
  new URL('manifest.json', APP_BASE).href,
  new URL('icons/logo.png', APP_BASE).href,
  new URL('icons/logo.png', APP_BASE).href,
  // Chart.js desde CDN (también cacheado)
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
];

// Hosts cuyas peticiones se tratan con Network-First (APIs externas)
const API_HOSTS = [
  'script.google.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
];

// ── Install: precachear el shell de la app ──────────────────
self.addEventListener('install', event => {
  // Precaching resiliente: ignorar recursos que fallen (p. ej. iconos faltantes)
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_STATIC);
    for (const url of PRECACHE_URLS) {
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res && res.ok) {
          await cache.put(url, res.clone());
        } else {
          console.warn('sw: precache failed for', url, res && res.status);
        }
      } catch (e) {
        console.warn('sw: precache error for', url, e && e.message);
      }
    }
  })());
  // Activar inmediatamente sin esperar a que cierren pestañas anteriores
  self.skipWaiting();
});

// ── Activate: eliminar cachés de versiones anteriores ───────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('trackmrp-') && k !== CACHE_STATIC && k !== CACHE_API)
          .map(k => caches.delete(k))
      )
    )
  );
  // Tomar control de todas las pestañas abiertas
  self.clients.claim();
});

// ── Fetch: enrutador de estrategias ─────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo interceptar GET
  if (request.method !== 'GET') return;

  // Ignorar peticiones chrome-extension o no-http
  if (!request.url.startsWith('http')) return;

  // ── Network-First para APIs (GAS, fuentes de Google)
  if (API_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(networkFirst(request));
    return;
  }

  // ── Cache-First para todo lo demás (assets estáticos)
  event.respondWith(cacheFirst(request));
});

// ── Estrategia Cache-First ───────────────────────────────────
// Responde desde caché si existe; si no, va a red y cachea la respuesta.
async function cacheFirst(request) {
  const cached = await (await caches.open(CACHE_STATIC)).match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && response.status === 200 && response.type !== 'error') {
      const cache = await caches.open(CACHE_STATIC);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    // Último recurso: devolver index.html cacheado para navegación offline
    if (request.destination === 'document') {
      return (await caches.open(CACHE_STATIC)).match(new URL('index.html', APP_BASE).href);
    }
    throw e;
  }
}

// ── Estrategia Network-First ────────────────────────────────
// Intenta la red; si falla (offline / timeout de GAS), sirve desde caché.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(CACHE_API);
      cache.put(request, response.clone());
    }
    return response;
  } catch (e) {
    const cached = await (await caches.open(CACHE_API)).match(request);
    if (cached) return cached;
    throw e;
  }
}
