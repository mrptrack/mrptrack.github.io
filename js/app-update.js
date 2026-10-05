// Refresh the installed PWA only when a different deployment is ready.
// Never clears cookies, localStorage, IndexedDB or user data.
import { hasPendingCloudChanges } from './cloud.js';

export function canReloadApp() {
  return document.visibilityState === 'visible' && navigator.onLine !== false
    && !hasPendingCloudChanges()
    && !document.body.classList.contains('edit-mode')
    && !document.querySelector('#ov.open')
    && !document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')
    && !['gymWeight','gymBf'].some(id => document.getElementById(id)?.value);
}

export function initAppUpdates() {
  if (!('serviceWorker' in navigator)) return;
  const pageVersion = document.querySelector('meta[name="app-version"]')?.content;
  if (!/^[a-f0-9]{40}$/.test(pageVersion || '')) return;
  const sw = navigator.serviceWorker;
  let registration, pendingVersion, reloading = false, retryTimer;
  let lastInteraction = Date.now(), lastCheck = 0, checking = false;
  const noteInteraction = () => { lastInteraction = Date.now(); };
  for (const event of ['input','change','pointerdown','keydown']) document.addEventListener(event, noteInteraction, { passive: true });

  const applyUpdate = () => {
    clearTimeout(retryTimer);
    if (!pendingVersion || reloading) return;
    if (!canReloadApp() || Date.now() - lastInteraction < 5000) {
      retryTimer = setTimeout(applyUpdate, 2000);
      return;
    }
    reloading = true;
    try {
      const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
      if (activeTab) sessionStorage.setItem('app-update-tab', activeTab);
    } catch (_) { /* restricted browser storage */ }
    location.reload();
  };
  const askVersion = () => sw.controller?.postMessage({ type: 'APP_VERSION' });
  sw.addEventListener('message', event => {
    if (event.source !== sw.controller || event.data?.type !== 'APP_VERSION') return;
    const version = event.data.version;
    if (/^[a-f0-9]{40}$/.test(version) && version !== pageVersion) {
      pendingVersion = version;
      applyUpdate();
    }
  });
  sw.addEventListener('controllerchange', askVersion);
  const check = async () => {
    askVersion();
    if (!registration || checking || document.visibilityState !== 'visible' || navigator.onLine === false || Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();checking = true;
    try { await registration.update(); } catch (_) { /* offline: retain installed app */ }
    finally { checking = false; }
  };
  const start = async () => {
    try {
      const tab = sessionStorage.getItem('app-update-tab');
      sessionStorage.removeItem('app-update-tab');
      if (tab) [...document.querySelectorAll('.tab-btn')].find(b => b.dataset.tab === tab)?.click();
    } catch (_) { /* optional view restoration */ }
    try {
      registration = await sw.register('./sw.js', { updateViaCache: 'none' });
      await check();
    } catch (error) { console.warn('App update check failed:', error.message); }
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { check();applyUpdate(); } });
  window.addEventListener('online', check);
  window.addEventListener('pageshow', check);
  setInterval(check, 5 * 60000); // Checks only; unchanged versions never clear/reload anything.
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}

initAppUpdates();
