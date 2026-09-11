// ============================================================
//  calculator.js — Calculadora de interés compuesto
// ============================================================
import { F, ttOpts, legOpts, gradFill, crosshairPlugin } from './utils.js';
import { D } from './state.js';
import { valEur } from './portfolio.js';

let CH_calc = null;

// Simulación de interés compuesto con aportaciones mensuales.
// Fórmula: FV = C*(1+r)^n + PMT * [((1+r)^n - 1)/r]
// donde r = tasa mensual, n = meses totales.
function _simulate(capital, monthly, annualRatePct, years) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  const results = [];
  let val = capital;
  for (let m = 0; m <= n; m++) {
    if (m > 0) {
      val = val * (1 + r) + monthly;
    }
    if (m % 12 === 0) {
      const invested = capital + monthly * m;
      results.push({ year: m / 12, value: Math.round(val * 100) / 100, invested: Math.round(invested * 100) / 100 });
    }
  }
  return results;
}

// Sincroniza el campo capital con el patrimonio neto actual y re-calcula.
export function syncCalculatorCapital() {
  const netWorth = (D.cash || 0) + (D.holdings || []).reduce((s, h) => s + valEur(h), 0);
  const capEl = document.getElementById('calcCapital');
  if (capEl && netWorth > 0) capEl.value = Math.round(netWorth);
  runCalc();
}

export function renderCalculator() {
  const btn = document.getElementById('btnCalc');
  if (!btn || btn.dataset.calcInited) return;
  btn.dataset.calcInited = '1';
  btn.addEventListener('click', () => runCalc());

  // Sincronizar con el patrimonio actual y calcular
  syncCalculatorCapital();
}

function runCalc() {
  const capital = parseFloat(document.getElementById('calcCapital')?.value) || 0;
  const monthly = parseFloat(document.getElementById('calcMonthly')?.value) || 0;
  const rate = parseFloat(document.getElementById('calcRate')?.value) || 0;
  const years = parseInt(document.getElementById('calcYears')?.value) || 20;

  if (capital < 0 || monthly < 0 || rate < 0 || years < 1) return;

  const data = _simulate(capital, monthly, rate, years);
  const final = data[data.length - 1];
  const totalInvested = capital + monthly * years * 12;
  const totalGains = final.value - totalInvested;
  const totalReturn = totalInvested > 0 ? (totalGains / totalInvested) * 100 : 0;

  // Resultado textual
  const res = document.getElementById('calcResult');
  if (res) {
    res.innerHTML = `
      <div class="cr-row"><span class="cr-lbl">Final value</span><span class="cr-val up">${F(final.value)} €</span></div>
      <div class="cr-row"><span class="cr-lbl">Total invested</span><span class="cr-val">${F(totalInvested)} €</span></div>
      <div class="cr-row"><span class="cr-lbl">Total gains</span><span class="cr-val up">+${F(totalGains)} €</span></div>
      <div class="cr-row"><span class="cr-lbl">Annual rate</span><span class="cr-val">${rate}%</span></div>
      <div class="cr-row"><span class="cr-lbl">Duration</span><span class="cr-val">${years} years</span></div>
    `;
  }

  // Gráfico
  const canvas = document.getElementById('cCalc');
  if (!canvas) return;
  const labels = data.map(d => `Y${d.year}`);
  const values = data.map(d => d.value);
  const invested = data.map(d => d.invested);

  if (CH_calc) CH_calc.destroy();
  CH_calc = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Portfolio Value',
          data: values,
          borderColor: '#22df8a',
          backgroundColor: gradFill('#22df8a', '50', '00'),
          fill: true, tension: .4, borderWidth: 2.5,
          pointRadius: 0, pointHoverRadius: 6,
          pointBackgroundColor: '#22df8a', pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3
        },
        {
          label: 'Capital Invested',
          data: invested,
          borderColor: '#5588ff',
          backgroundColor: gradFill('#5588ff', '20', '00'),
          fill: true, tension: 0, borderWidth: 2,
          pointRadius: 0, pointHoverRadius: 5,
          pointBackgroundColor: '#5588ff', pointBorderColor: '#0d0d1a', pointHoverBorderWidth: 3,
          borderDash: [6, 4]
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      animation: { duration: 800, easing: 'easeOutQuart' },
      plugins: {
        legend: { labels: legOpts },
        tooltip: { ...ttOpts, callbacks: { label: c => ` ${c.dataset.label}: ${F(c.parsed.y)} €` } }
      },
      scales: {
        x: {
          grid: { display: false }, border: { color: 'rgba(255,255,255,.06)' },
          ticks: { color: '#7070a0', font: { family: 'IBM Plex Mono', size: 10 }, padding: 8 }
        },
        y: {
          grid: { color: 'rgba(255,255,255,.04)', drawTicks: false },
          border: { display: false },
          ticks: { color: '#a0a0b8', font: { family: 'IBM Plex Mono', size: 10 }, callback: v => F(v, 0) + ' €', padding: 10 }
        }
      }
    },
    plugins: [crosshairPlugin]
  });
}
