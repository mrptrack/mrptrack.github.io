// ============================================================
//  utils.js — Funciones de utilidad reutilizables
// ============================================================

// Formatea un número con separadores alemanes (1.234,56)
export const F = (n, d = 2) =>
  n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

// Devuelve color CSS según ratio (verde/ámbar/gris/rojo)
export function ratingColor(r, max = 10) {
  if (!r) return 'var(--text-muted)';
  const pct = r / max;
  return pct >= 0.85 ? 'var(--green)'
       : pct >= 0.70 ? 'var(--amber)'
       : pct >= 0.50 ? 'var(--text-dim)'
       : 'var(--red)';
}

// ── Serie mensual desde history ─────────────────────────────
// Para cada mes devuelve:
//   pnl   — P&L de mercado del mes (Δvalor − aportaciones), en €
//   start — valor de la cartera al empezar el mes
//   ret   — pnl / start, en %  ← el retorno "de andar por casa": lo que gané
//           este mes sobre lo que tenía al empezarlo. Es el que se enseña.
//   twr   — retornos encadenados dentro del mes (time-weighted). Solo se usa
//           para CAGR y volatilidad, donde componer bien sí importa.
// En ambos casos las aportaciones se excluyen: ingresar dinero no es ganarlo.
export function monthlyReturns(history) {
  if (!history || history.length < 2) return [];
  const s = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const months = {};
  for (let i = 1; i < s.length; i++) {
    const prev = s[i - 1], cur = s[i];
    const flow = (cur.totalInvested || 0) - (prev.totalInvested || 0);
    const base = (prev.totalValue || 0) + flow;
    if (base <= 0) continue;
    const r = (cur.totalValue - prev.totalValue - flow) / base;
    const mk = cur.date.substring(0, 7);
    if (!months[mk]) months[mk] = { growth: 1, pnl: 0, start: prev.totalValue || 0 };
    months[mk].growth *= (1 + r);
    months[mk].pnl += cur.totalValue - prev.totalValue - flow;
  }
  return Object.keys(months).sort().map(k => {
    const m = months[k];
    return {
      key: k,
      pnl: m.pnl,
      start: m.start,
      ret: m.start > 0 ? (m.pnl / m.start) * 100 : 0,
      twr: (m.growth - 1) * 100
    };
  });
}

// Toast de notificación (auto-elimina a los 3s)
export function toast(msg, type) {
  const t = document.createElement('div');
  t.className = 'toast toast-' + (type || 'ok');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// Configuración de tooltip para Chart.js (premium look)
export const ttOpts = {
  backgroundColor: 'rgba(13,13,26,.96)',
  titleColor: '#e2e2f0',
  bodyColor: '#e2e2f0',
  borderColor: 'rgba(34,223,138,.22)',
  borderWidth: 1,
  cornerRadius: 12,
  padding: 14,
  bodyFont: { family: 'IBM Plex Mono', size: 12, weight: '500' },
  titleFont: { family: 'Sora', size: 12, weight: '600' },
  titleMarginBottom: 8,
  boxPadding: 6,
  usePointStyle: true,
  caretPadding: 10,
  caretSize: 0
};

// Configuración de leyenda para Chart.js
export const legOpts = {
  color: '#a0a0b8',
  font: { family: 'Sora', size: 11, weight: '500' },
  padding: 14,
  usePointStyle: true,
  pointStyleWidth: 8,
  boxHeight: 6,
  boxWidth: 6
};

// Genera un gradiente vertical para fill de área (líneas) o barras
// color: hex 6 dígitos (ej. '#22df8a'). top/bot: alpha en hex 2 dígitos.
export function gradFill(color, top = 'aa', bot = '08') {
  return ctx => {
    const ch = ctx.chart;
    const a = ch && ch.chartArea;
    if (!a) return color + top;
    const g = ch.ctx.createLinearGradient(0, a.top, 0, a.bottom);
    g.addColorStop(0, color + top);
    g.addColorStop(1, color + bot);
    return g;
  };
}

// Plugin: texto central en doughnut (label arriba, valor grande debajo)
// Uso: pasar `plugins: [centerTextPlugin]` y `options.plugins.centerText: {label, value}`
export const centerTextPlugin = {
  id: 'centerText',
  afterDraw(chart) {
    const o = chart.options.plugins && chart.options.plugins.centerText;
    if (!o || !o.value) return;
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    const cx = (chartArea.left + chartArea.right) / 2;
    const cy = (chartArea.top + chartArea.bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (o.label) {
      ctx.font = '600 10px Sora, sans-serif';
      ctx.fillStyle = '#7070a0';
      ctx.fillText(o.label.toUpperCase(), cx, cy - 16);
    }
    ctx.font = "700 22px 'IBM Plex Mono', monospace";
    ctx.fillStyle = '#e2e2f0';
    ctx.fillText(o.value, cx, cy + 6);
    if (o.sub) {
      ctx.font = "500 11px 'IBM Plex Mono', monospace";
      ctx.fillStyle = o.subColor || '#a0a0b8';
      ctx.fillText(o.sub, cx, cy + 26);
    }
    ctx.restore();
  }
};

// Plugin: línea vertical de hover (crosshair) en charts de línea
export const crosshairPlugin = {
  id: 'crosshair',
  afterDatasetsDraw(chart) {
    const tt = chart.tooltip;
    if (!tt || !tt._active || !tt._active.length) return;
    const { ctx, chartArea } = chart;
    const x = tt._active[0].element.x;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, chartArea.top);
    ctx.lineTo(x, chartArea.bottom);
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(34,223,138,.35)';
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();
  }
};
