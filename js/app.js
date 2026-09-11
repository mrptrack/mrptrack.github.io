// ============================================================
//  app.js — Punto de entrada. Orquesta todos los módulos.
// ============================================================
import { loadData } from './storage.js';
import { fetchDataFromCloud, updateSyncStatus } from './cloud.js';
import { refreshPortfolio, renderPortfolio, renderHistory, toggleHoldingDetail } from './portfolio.js';
import { renderTrades, toggleTradeDetail } from './trades.js';
import { addGymEntry, renderGym } from './gym.js';
import { renderBooks, renderMovies, renderSeries } from './media.js';
import { openEditModal, openAddModal, closeModal } from './modals.js';
import { initAuth, signOut } from './auth.js';
import { toast } from './utils.js';
import { renderAnalytics, renderBenchmark } from './analytics.js';
import { renderCalculator, syncCalculatorCapital } from './calculator.js';
import { initWatchlist, renderWatchlist, refreshWatchlist } from './watchlist.js';
import { openImportModal } from './importer.js';
import { renderGames, initGames } from './games.js';

// ── Render completo de todas las secciones ───────────────────
// Cada módulo se programa como una tarea independiente (setTimeout 0)
// para ceder el hilo principal al navegador entre renders y reducir el TBT.
function renderAll() {
  renderPortfolio();
  renderGames();
  setTimeout(() => renderTrades(), 0);
  setTimeout(() => renderGym(), 0);
  setTimeout(() => renderBooks(), 0);
  setTimeout(() => renderMovies(), 0);
  setTimeout(() => renderSeries(), 0);
  setTimeout(() => renderHistory(), 0);
  setTimeout(() => renderAnalytics(), 0);
  setTimeout(() => renderWatchlist(), 0);
}

// ── Ejecuta una acción que requiere auth ─────────────────────
function doAction(action) {
  if (action === 'addBook') openAddModal('book');
  else if (action === 'addMovie') openAddModal('movie');
  else if (action === 'addSeries') openAddModal('serie');
  else if (action === 'addTrade') openAddModal('trade');
  else if (action === 'addHolding') openAddModal('holding');
}

// ── Helper: aplicar estado autenticado a la UI ──────────────────
function _applyAuthUI(_user) {
  const lb = document.getElementById('btnLogout');
  if (lb) lb.style.display = '';
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = '';
  const exportBtn = document.getElementById('btnExport');
  if (exportBtn) exportBtn.style.display = '';
  const importBtn = document.getElementById('btnImport');
  if (importBtn) importBtn.style.display = '';
}

// ── Login overlay helpers ─────────────────────────────────
function _showLoginOverlay() {
  const el = document.getElementById('loginOv');
  if (el) el.style.display = 'flex';
}
function _hideLoginOverlay() {
  const el = document.getElementById('loginOv');
  if (el) el.style.display = 'none';
  const errEl = document.getElementById('loginErr');
  if (errEl) errEl.textContent = '';
}

// ── Modo edición: muestra/oculta controles de escritura ───────────────
let _editMode = false;
let _activeTab = 'portfolio';

// btnAddTrade solo visible cuando (edit mode) Y (pestaña activa = trades)
function _syncTradeBtn() {
  const btn = document.getElementById('btnAddTrade');
  if (btn) btn.style.display = (_editMode && _activeTab === 'trades') ? '' : 'none';
}

function _applyEditMode(on) {
  _editMode = on;
  document.body.classList.toggle('edit-mode', on);
  // Los elementos .add-section se muestran/ocultan mediante CSS (body.edit-mode .add-section)
  // btnAddTrade tiene lógica especial (tab + edit-mode) gestionada por _syncTradeBtn
  _syncTradeBtn();
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.innerHTML = on ? '&#x270F;&#xFE0E; Editing' : '&#x270F; Edit';
  // Al desactivar el modo edición se hace un renderAll para limpiar cualquier
  // elemento de UI de edición que quedara visible (tarjetas, atributos, etc.)
  if (on) renderPortfolio();
  else renderAll();
}

// ── Flag de bloqueo de vista (eliminado en Fase 7.3) ──────────
let _rfInterval = null;

// ── Post-auth: render + fetch + intervalo ────────────────────
// CRÍTICO: el orden importa. fetchDataFromCloud() DEBE completarse
// antes de arrancar refreshPortfolio() para evitar la race condition
// donde la lógica de snapshot diario sobreescribe cloud con un D
// FALLBACK (vacío) tras un cold-start con localStorage limpio.
// Render inicial se mantiene inmediato (con datos locales si los hay)
// para que el usuario vea UI sin esperar.
async function _postAuthInit() {
  renderAll();        // 1. Render inmediato con localStorage (o vacío)
  renderCalculator();
  // 2. Cloud fetch SIN concurrencia con refreshPortfolio (timeout 8s)
  let ok = false;
  try {
    ok = await Promise.race([
      fetchDataFromCloud(),
      new Promise(r => setTimeout(() => r(false), 8000))
    ]);
  } catch (_) { ok = false; }
  if (ok) renderAll();
  else updateSyncStatus('local');
  // 3. AHORA sí, ya con D estable, arrancamos prices + intervalo
  refreshPortfolio();
  if (!_rfInterval) _rfInterval = setInterval(refreshPortfolio, 60000);
}

// ── Handlers de Google Sign-In ────────────────────────────────
async function _handleLogin(user, isNewLogin) {
  _hideLoginOverlay();
  _applyAuthUI(user);
  await _postAuthInit();
}

function _handleLogout() {
  _applyEditMode(false);
  const lb = document.getElementById('btnLogout');
  if (lb) lb.style.display = 'none';
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = 'none';
  const exportBtn = document.getElementById('btnExport');
  if (exportBtn) exportBtn.style.display = 'none';
  const importBtn = document.getElementById('btnImport');
  if (importBtn) importBtn.style.display = 'none';
  _showLoginOverlay();
}

// ── Sistema de pestañas ──────────────────────────────────────
// Las pestañas inactivas tienen display:none al cargar → cualquier
// canvas Chart.js dentro mide 0×0 y se "fija" en esas dimensiones.
// Re-renderizamos cuando el usuario entra por primera vez para que
// Chart.js mida con el canvas ya visible.
let _benchmarkLoaded = false;
const _tabsRenderedAfterVisible = new Set(['portfolio']); // portfolio es activo desde el inicio

document.getElementById('tabBar').addEventListener('click', e => {
  if (!e.target.matches('.tab-btn')) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  e.target.classList.add('active');
  const tab = e.target.dataset.tab;
  _activeTab = tab;
  document.getElementById('tab-' + tab).classList.add('active');
  _syncTradeBtn();

  // Re-render lazy: en el primer click sobre una pestaña, el canvas
  // ya tiene dimensiones reales y Chart.js puede dibujar correctamente.
  // Esperamos un microtick para asegurar que el navegador aplicó el
  // display:block antes de medir el canvas.
  if (!_tabsRenderedAfterVisible.has(tab)) {
    _tabsRenderedAfterVisible.add(tab);
    requestAnimationFrame(() => {
      if (tab === 'analytics') renderAnalytics();
      else if (tab === 'trades') renderTrades();
      else if (tab === 'gym') renderGym();
      else if (tab === 'watchlist') refreshWatchlist();
    });
  } else if (tab === 'watchlist') {
    refreshWatchlist();
  }

  // Carga el benchmark SPY al entrar por primera vez en Analytics (evita fetch innecesario)
  if (tab === 'analytics' && !_benchmarkLoaded) {
    _benchmarkLoaded = true;
    renderBenchmark();
  }
  // Siempre sincroniza la calculadora con el patrimonio actual al abrir Analytics
  if (tab === 'analytics') syncCalculatorCapital();
});

// ── Selector de periodo del benchmark ───────────────────────
document.getElementById('benchmarkBtns')?.addEventListener('click', e => {
  const btn = e.target.closest('.bench-btn');
  if (!btn) return;
  document.querySelectorAll('#benchmarkBtns .bench-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderBenchmark();
});

// ── Toggle de tema claro/oscuro ──────────────────────────────
// Dark es el valor por defecto absoluto. Solo se activa light
// cuando el usuario lo selecciona manualmente.
(function initTheme() {
  const saved = localStorage.getItem('trackmrp_theme');
  if (saved === 'light') document.documentElement.classList.add('theme-light');
  else document.documentElement.classList.add('theme-dark');
})();

document.getElementById('btnTheme')?.addEventListener('click', () => {
  const html = document.documentElement;
  const isLight = html.classList.contains('theme-light');
  html.classList.toggle('theme-light', !isLight);
  html.classList.toggle('theme-dark', isLight);
  localStorage.setItem('trackmrp_theme', isLight ? 'dark' : 'light');
  const btn = document.getElementById('btnTheme');
  if (btn) btn.textContent = isLight ? '☽' : '☀';
});

// ── Listeners de botones de la barra superior ────────────────
// btnLogout — Sign out
document.getElementById('btnLogout')?.addEventListener('click', () => signOut());
document.getElementById('btnRefresh')?.addEventListener('click', () => refreshPortfolio());
document.getElementById('btnImport')?.addEventListener('click', () => openImportModal());
document.getElementById('btnAdmin')?.addEventListener('click', () => _applyEditMode(!_editMode));
document.getElementById('btnAddHolding')?.addEventListener('click', () => doAction('addHolding'));
document.getElementById('btnAddTrade')?.addEventListener('click', () => doAction('addTrade'));
document.getElementById('btnAddBook')?.addEventListener('click', () => doAction('addBook'));
document.getElementById('btnAddMovie')?.addEventListener('click', () => doAction('addMovie'));
document.getElementById('btnAddSeries')?.addEventListener('click', () => doAction('addSeries'));
document.getElementById('btnGymAdd')?.addEventListener('click', () => addGymEntry());

// ── Login overlay: el botón lo renderiza GSI en #gsiButton (ver auth.js) ──

// ── Cerrar modal genérico al hacer click en el overlay ────────
document.getElementById('ov')?.addEventListener('click', e => {
  if (e.target === document.getElementById('ov')) closeModal();
});
document.getElementById('booksSearch')?.addEventListener('input', () => renderBooks());
document.getElementById('booksSort')?.addEventListener('change', () => renderBooks());
document.getElementById('booksFilter')?.addEventListener('change', () => renderBooks());
document.getElementById('moviesSearch')?.addEventListener('input', () => renderMovies());
document.getElementById('moviesSort')?.addEventListener('change', () => renderMovies());
document.getElementById('moviesFilter')?.addEventListener('change', () => renderMovies());
document.getElementById('seriesSearch')?.addEventListener('input', () => renderSeries());
document.getElementById('seriesSort')?.addEventListener('change', () => renderSeries());
document.getElementById('seriesFilter')?.addEventListener('change', () => renderSeries());

// ── Delegación global: click en tarjetas editables ───────────
document.addEventListener('click', function (e) {  // En modo lectura no se procesa ninguna edición
  if (!document.body.classList.contains('edit-mode')) {
    // Accordion de holding al hacer clic en tarjeta (modo lectura)
    const stock = e.target.closest('.stock[data-detail-idx]');
    if (stock) { toggleHoldingDetail(stock, parseInt(stock.dataset.detailIdx)); return; }
    // Accordion de trade cerrado al hacer clic en fila (siempre disponible en lectura)
    const tradeRow = e.target.closest('tr[data-trade-idx]');
    if (tradeRow && !e.target.closest('tr.trade-detail-row')) {
      toggleTradeDetail(tradeRow, parseInt(tradeRow.dataset.tradeIdx)); return;
    }
    return;
  }
  const card = e.target.closest('.m-card[data-edit-type]');
  if (card) { openEditModal(card.dataset.editType, parseInt(card.dataset.editIdx)); return; }

  const stock = e.target.closest('.stock[data-edit-type]');
  if (stock) {
    if (stock.dataset.editType === 'cash') openEditModal('cash', 0);
    else openEditModal('holding', parseInt(stock.dataset.editIdx));
    return;
  }

  const row = e.target.closest('tr[data-edit-type]');
  if (row) {
    if (row.dataset.editType === 'trade') openEditModal('trade', parseInt(row.dataset.editIdx));
    else if (row.dataset.editType === 'gym') openEditModal('gym', row.dataset.editDate);
  }
});

// ── Inicialización ───────────────────────────────────────────
async function init() {
  loadData();
  initWatchlist();
  initGames();
  document.getElementById('gymDate').value = new Date().toISOString().slice(0, 10);

  // Icono del botón de tema al estado actual
  const btnTheme = document.getElementById('btnTheme');
  if (btnTheme) {
    const isLight = document.documentElement.classList.contains('theme-light');
    btnTheme.textContent = isLight ? '☀' : '☽';
  }

  // Ocultar btnAdmin hasta que haya sesión activa
  const adminBtn = document.getElementById('btnAdmin');
  if (adminBtn) adminBtn.style.display = 'none';

  // Si hay session token guardado, ocultar el login overlay inmediatamente
  // para evitar el flash de login en recargas (auth.js lo valida al instante).
  const storedToken = localStorage.getItem('trackmrp_track_session');
  if (storedToken) _hideLoginOverlay();

  // Render inicial con datos locales (sin esperar a la nube)
  renderAll();
  renderCalculator();

  // Configurar Google Sign-In: restaura sesión local o muestra el botón.
  initAuth(_handleLogin, _handleLogout);

  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      const ok = await fetchDataFromCloud();
      if (ok) renderAll();
    }
  });

  window.addEventListener('online', () => toast('Back online', 'ok'));
  window.addEventListener('offline', () => toast('Sin conexión — mostrando datos en caché', 'err'));
}

init();
