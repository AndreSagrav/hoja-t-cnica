// ============================================================
// INNOVIO Tax Module — Dashboard Fiscal
// Main fiscal overview with KPIs, chart, and calendar
// ============================================================

import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { calcularIVAMensual, calcularRentaAnual, formatColones, MESES, mesActual } from '../lib/tax-engine.js';
import { fetchTaxData } from '../lib/tax-data.js';

// Saldos oficiales verificados en Tribu-CR
const SALDOS_TRIBU_OFICIALES = {
  2026: {
    1: 43514, 2: 55781, 3: 110551, 4: 122093, 5: 124937, 6: 135372, 7: 140085, 8: 145786, 9: 145786
  }
};

async function getSaldoFavorTribu(anioTarget, mesTarget) {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('config').select('value').eq('key', 'tribu_saldo_favor').single();
    if (data?.value?.acumulado_por_mes_2026 && anioTarget === 2026 && data.value.acumulado_por_mes_2026[mesTarget] !== undefined) {
      return Number(data.value.acumulado_por_mes_2026[mesTarget]);
    }
    if (data?.value?.total_disponible && (anioTarget > 2026 || (anioTarget === 2026 && mesTarget >= 8))) {
      return Number(data.value.total_disponible);
    }
  } catch {}
  return SALDOS_TRIBU_OFICIALES[anioTarget]?.[mesTarget] ?? (anioTarget === 2026 && mesTarget >= 8 ? 145786 : 0);
}

export async function impuestosDashboardView() {
  const shell = ensureShell('/impuestos');
  shell.setTitle('Panel Fiscal');
  shell.setActions('');

  const initHash = window.location.hash;
  const content = shell.content();
  const { mes, anio } = mesActual();

  let ingresos = [], gastos = [], allIngresos = [], allGastos = [];
  let creditosFiscales = [];
  let initialSaldoFavor = await getSaldoFavorTribu(anio, mes);

  renderFiscalDashboard(content, { ingresos, gastos, allIngresos, allGastos, creditosFiscales, mes, anio, initialSaldoFavor });

  // Load real data in background
  try {
    const data = await fetchTaxData(anio, mes);
    if (window.location.hash !== initHash) return;
    ingresos = data.ingresosMes;
    gastos = data.gastosMes;
    allIngresos = data.ingresosAnio;
    allGastos = data.gastosAnio;
    creditosFiscales = data.creditos;
    renderFiscalDashboard(content, { ingresos, gastos, allIngresos, allGastos, creditosFiscales, mes, anio, initialSaldoFavor });
  } catch (e) {
    console.warn('Tax data load error:', e);
  }
}

function renderFiscalDashboard(content, { ingresos, gastos, allIngresos, allGastos, creditosFiscales, mes, anio, initialSaldoFavor = 145786 }) {

  // Load Saldo Anterior (prefer official verified Tribu-CR balance)
  const saldoAnteriorKey = `saldo_anterior_${anio}_${mes}`;
  const savedSaldo = localStorage.getItem(saldoAnteriorKey);
  let saldoFavorAnterior = savedSaldo !== null ? Number(savedSaldo) : initialSaldoFavor;

  // Calculate IVA for current month with Saldo Anterior
  const iva = calcularIVAMensual(ingresos, gastos, saldoFavorAnterior);
  const totalCreditosFiscales = creditosFiscales.reduce((s, c) => s + Number(c.monto_disponible || 0), 0);

  // Annual totals
  const ingresosAnual = allIngresos.reduce((s, i) => s + Number(i.monto_bruto || 0), 0);
  const gastosAnual = allGastos.reduce((s, g) => s + Number(g.monto_bruto || 0), 0);
  const ingresosNetoAnual = allIngresos.reduce((s, i) => s + Number(i.monto_neto || i.monto_bruto - i.monto_iva || 0), 0);
  const gastosNetoAnual = allGastos.filter(g => g.deducible !== false).reduce((s, g) => s + Number(g.monto_neto || g.monto_bruto - g.monto_iva || 0), 0);

  // Real renta calculation
  const rentaCalc = calcularRentaAnual({
    year: anio,
    ingresosBrutos: ingresosNetoAnual,
    gastosDeducibles: gastosNetoAnual,
    hijos: 0,
    tieneConyuge: false
  });

  // Monthly chart data (12 months)
  const chartData = [];
  for (let m = 1; m <= 12; m++) {
    const ingMes = allIngresos.filter(i => i.periodo_mes === m).reduce((s, i) => s + Number(i.monto_bruto || 0), 0);
    const gasMes = allGastos.filter(g => g.periodo_mes === m).reduce((s, g) => s + Number(g.monto_bruto || 0), 0);
    chartData.push({ mes: m, label: MESES[m - 1].substring(0, 3), ingresos: ingMes, gastos: gasMes });
  }
  const maxChart = Math.max(...chartData.map(d => Math.max(d.ingresos, d.gastos)), 1);

  // Fiscal calendar dates
  const calendarItems = buildCalendar(mes, anio);

  content.innerHTML = `
    <!-- KPIs -->
    <div class="tax-kpis">
      <div class="tax-kpi-card kpi-income" id="kpi-income">
        <div class="tax-kpi-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
        <div class="tax-kpi-label">Ingresos del Mes</div>
        <div class="tax-kpi-value">${formatColones(iva.totalVentasNeto + iva.debitoFiscal)}</div>
        <div class="tax-kpi-sub">${ingresos.length} comprobante${ingresos.length !== 1 ? 's' : ''} ${mes === 9 ? '· Último mes (Ago): ₡149.031' : ''}</div>
      </div>
      <div class="tax-kpi-card kpi-expense" id="kpi-expense">
        <div class="tax-kpi-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/></svg></div>
        <div class="tax-kpi-label">Gastos del Mes</div>
        <div class="tax-kpi-value">${formatColones(iva.totalComprasNeto + iva.creditoFiscal)}</div>
        <div class="tax-kpi-sub">${gastos.length} gasto${gastos.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="tax-kpi-card kpi-iva" id="kpi-iva">
        <div class="tax-kpi-icon"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg></div>
        <div class="tax-kpi-label">IVA a Pagar</div>
        <div class="tax-kpi-value" style="color:var(--green);">${formatColones(iva.ivaPagar)}</div>
        <div class="tax-kpi-sub">${iva.saldoFavor > 0 ? 'Saldo a favor: ' + formatColones(iva.saldoFavor) : 'Compensado (₡0 a pagar)'}</div>
      </div>
      <div class="tax-kpi-card kpi-credit" id="kpi-credit">
        <div class="tax-kpi-icon" style="display:flex;justify-content:space-between;align-items:center;">
          <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <div style="font-size:10px;font-weight:normal;color:var(--text-soft);text-align:right;">
            Saldo Ant. (Tribu-CR)<br>
            <input type="number" id="input-saldo-anterior" style="width:95px;height:22px;margin-top:3px;padding:0 6px;font-size:11px;font-weight:700;border:1.5px solid var(--accent);border-radius:var(--r);background:var(--surface);outline:none;font-family:var(--font-mono, monospace);" value="${saldoFavorAnterior}" placeholder="₡145 786">
          </div>
        </div>
        <div class="tax-kpi-label" style="margin-top:8px;">Crédito Fiscal Real</div>
        <div class="tax-kpi-value" style="color:var(--accent-dark);">${formatColones(iva.creditoTotal)}</div>
        <div class="tax-kpi-sub">Compras mes + Saldo Cuenta Trib.</div>
      </div>
    </div>

    <!-- Chart + Calendar Row -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);margin-bottom:var(--sp-4);">

      <!-- Chart -->
      <div class="tax-section" style="animation-delay:0.1s">
        <div class="tax-section-header">
          <div class="tax-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg> Ingresos vs Gastos — ${anio}</div>
        </div>
        <div class="tax-section-body">
          <div class="tax-chart">
            ${chartData.map(d => `
              <div class="tax-chart-bar-group">
                <div class="tax-chart-bars">
                  <div class="tax-chart-bar income" style="height:${(d.ingresos / maxChart) * 100}%" data-tooltip="${formatColones(d.ingresos)}"></div>
                  <div class="tax-chart-bar expense" style="height:${(d.gastos / maxChart) * 100}%" data-tooltip="${formatColones(d.gastos)}"></div>
                </div>
                <div class="tax-chart-label">${d.label}</div>
              </div>
            `).join('')}
          </div>
          <div class="tax-chart-legend">
            <div class="tax-chart-legend-item"><div class="tax-chart-legend-dot income"></div> Ingresos</div>
            <div class="tax-chart-legend-item"><div class="tax-chart-legend-dot expense"></div> Gastos</div>
          </div>
        </div>
      </div>

      <!-- Calendar -->
      <div class="tax-section" style="animation-delay:0.2s">
        <div class="tax-section-header">
          <div class="tax-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> Calendario Fiscal</div>
        </div>
        <div class="tax-section-body" id="tax-calendar-list">
          <div class="tax-calendar">
            ${calendarItems.map(ci => `
              <div class="tax-cal-item ${ci.status || ''}" data-href="${ci.href || '#/impuestos/declaraciones'}" style="cursor:pointer;">
                <div class="tax-cal-date" style="${ci.calDateStyle || ''}">
                  <span class="day">${ci.day}</span>
                  <span class="month">${ci.monthLabel}</span>
                </div>
                <div class="tax-cal-info">
                  <div class="label" style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                    <span>${ci.label}</span>
                    <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;${ci.badgeStyle}">${ci.badgeText}</span>
                  </div>
                  <div class="sub">${ci.sub}</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions + Annual Summary -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-4);">

      <!-- Quick Actions -->
      <div class="tax-section" style="animation-delay:0.3s">
        <div class="tax-section-header">
          <div class="tax-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg> Acciones Rápidas</div>
        </div>
        <div class="tax-section-body">
          <div style="display:flex;flex-direction:column;gap:var(--sp-2);">
            <a href="#/impuestos/ingresos" class="tax-btn tax-btn-primary" style="justify-content:center;text-decoration:none;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 10v1"/></svg>
              Registrar Ingreso
            </a>
            <a href="#/impuestos/gastos" class="tax-btn tax-btn-accent" style="justify-content:center;text-decoration:none;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"/></svg>
              Registrar Gasto
            </a>
            <a href="#/impuestos/declaraciones" class="tax-btn tax-btn-outline" style="justify-content:center;text-decoration:none;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Calcular Declaración IVA
            </a>
            <a href="#/impuestos/declaraciones" class="tax-btn tax-btn-outline" style="justify-content:center;text-decoration:none;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
              Generar Reporte
            </a>
          </div>
        </div>
      </div>

      <!-- Annual Summary -->
      <div class="tax-section" style="animation-delay:0.4s">
        <div class="tax-section-header">
          <div class="tax-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/></svg> Resumen Anual ${anio}</div>
        </div>
        <div class="tax-section-body">
          <div class="tax-result">
            <div class="tax-result-row">
              <span class="label">Ingresos brutos acumulados</span>
              <span class="value" style="color:var(--green)">${formatColones(ingresosAnual)}</span>
            </div>
            <div class="tax-result-row">
              <span class="label">Gastos acumulados</span>
              <span class="value" style="color:var(--red)">${formatColones(gastosAnual)}</span>
            </div>
            <div class="tax-result-row">
              <span class="label">Utilidad bruta</span>
              <span class="value">${formatColones(ingresosAnual - gastosAnual)}</span>
            </div>
            <div class="tax-result-row">
              <span class="label">Margen</span>
              <span class="value">${ingresosAnual > 0 ? ((ingresosAnual - gastosAnual) / ingresosAnual * 100).toFixed(1) : '0.0'}%</span>
            </div>
            <div class="tax-result-row total">
              <span class="label">Impuesto Renta estimado</span>
              <span class="value">${formatColones(rentaCalc.impuestoNeto)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Responsive: stack columns on mobile
  if (window._taxMqController) { try { window._taxMqController.abort(); } catch {} }
  const grids = content.querySelectorAll('[style*="grid-template-columns:1fr 1fr"]');
  const mq = window.matchMedia('(max-width: 900px)');
  function adjustGrid() {
    grids.forEach(g => {
      g.style.gridTemplateColumns = mq.matches ? '1fr' : '1fr 1fr';
    });
  }
  adjustGrid();
  const ac = new AbortController();
  window._taxMqController = ac;
  mq.addEventListener('change', adjustGrid, { signal: ac.signal });

  // Attach click handlers for calendar items
  content.querySelectorAll('.tax-cal-item[data-href]').forEach(item => {
    item.addEventListener('click', () => {
      const href = item.dataset.href;
      if (href) window.location.hash = href;
    });
  });

  // Attach event listener for Saldo Anterior
  const inputSaldo = document.getElementById('input-saldo-anterior');
  if (inputSaldo) {
    inputSaldo.addEventListener('change', (e) => {
      let val = Number(e.target.value) || 0;
      if (val < 0) val = 0;
      localStorage.setItem(saldoAnteriorKey, val.toString());
      renderFiscalDashboard(content, { ingresos, gastos, allIngresos, allGastos, creditosFiscales, mes, anio, initialSaldoFavor: val });
    });
  }
}

function buildCalendar(currentMonth, currentYear) {
  const today = new Date();
  const items = [];

  // IVA monthly deadlines (15th of each month for previous month)
  for (let m = currentMonth; m <= Math.min(currentMonth + 3, 12); m++) {
    const deadline = new Date(currentYear, m - 1, 15);
    const targetMonth = m === 1 ? 12 : m - 1;
    const targetYear = m === 1 ? currentYear - 1 : currentYear;
    const isPast = today > deadline;

    let badgeText = 'En plazo';
    let badgeStyle = 'background:rgba(0,194,168,0.12);color:#00a884;';
    let calDateStyle = '';

    if (isPast) {
      badgeText = '✓ Al día · Compensado';
      badgeStyle = 'background:rgba(39,174,96,0.12);color:#27ae60;';
      calDateStyle = 'background:rgba(39,174,96,0.1);color:#27ae60;border:1px solid rgba(39,174,96,0.25);';
    } else {
      const daysLeft = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        badgeText = `Próximo · ${daysLeft} días`;
        badgeStyle = 'background:rgba(59,130,246,0.12);color:#2563eb;';
      }
    }

    items.push({
      date: deadline,
      day: 15,
      monthLabel: MESES[m - 1].substring(0, 3).toUpperCase(),
      label: `IVA ${MESES[targetMonth - 1]}`,
      sub: isPast ? `D-150 • ${targetYear} · Sin saldo deudor` : `D-150 • ${targetYear}`,
      overdue: false,
      status: isPast ? 'completed' : 'upcoming',
      badgeText,
      badgeStyle,
      calDateStyle,
      href: '#/impuestos/declaraciones'
    });
  }

  // Renta partial payments (June 15, Sept 15, Dec 15)
  for (const m of [6, 9, 12]) {
    if (m >= currentMonth) {
      const deadline = new Date(currentYear, m - 1, 15);
      const isPast = today > deadline;

      items.push({
        date: deadline,
        day: 15,
        monthLabel: MESES[m - 1].substring(0, 3).toUpperCase(),
        label: 'Pago Parcial Renta',
        sub: isPast ? 'Cubierto con saldo a favor' : '25% del ISR anterior',
        overdue: false,
        status: isPast ? 'completed' : 'upcoming',
        badgeText: isPast ? '✓ Sin deuda' : 'En plazo',
        badgeStyle: isPast ? 'background:rgba(39,174,96,0.12);color:#27ae60;' : 'background:rgba(0,194,168,0.12);color:#00a884;',
        calDateStyle: isPast ? 'background:rgba(39,174,96,0.1);color:#27ae60;border:1px solid rgba(39,174,96,0.25);' : '',
        href: '#/impuestos/declaraciones'
      });
    }
  }

  // Renta annual (March 15 of next year)
  if (currentMonth >= 10) {
    items.push({
      date: new Date(currentYear + 1, 2, 15),
      day: 15,
      monthLabel: 'MAR',
      label: 'Declaración Renta Anual',
      sub: `D-101 • Año ${currentYear}`,
      href: '#/impuestos/declaraciones',
      overdue: false,
      status: 'upcoming',
      badgeText: 'En plazo',
      badgeStyle: 'background:rgba(0,194,168,0.12);color:#00a884;'
    });
  }

  return items.sort((a, b) => a.date - b.date).slice(0, 6);
}
