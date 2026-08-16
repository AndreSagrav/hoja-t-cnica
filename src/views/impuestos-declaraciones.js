// ============================================================
// INNOVIO Tax Module — Declaraciones y Reportes
// IVA calculator, Renta calculator, Balance, Reports
// ============================================================

import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { fetchTaxData } from '../lib/tax-data.js';
import {
  calcularIVAMensual, calcularRentaAnual, calcularPagosParciales,
  generarBalanceGeneral, generarEstadoResultados,
  formatColones, MESES, mesActual, IVA_RATES
} from '../lib/tax-engine.js';
import {
  generarPDFIVA, generarPDFRenta, generarPDFBalance, generarPDFEstadoResultados,
  generarExcelIVA, generarExcelRenta, generarExcelBalance, generarExcelEstadoResultados, generarExcelLibro
} from '../lib/doc-generator.js';
import { toast } from '../lib/utils.js';

export async function impuestosDeclaracionesView() {
  const shell = ensureShell('/impuestos/declaraciones');
  shell.setTitle('Declaraciones y Reportes');
  shell.setActions('');

  const content = shell.content();
  const { mes, anio } = mesActual();
  const initHash = window.location.hash;

  let activeTab = 'iva';

  function render() {
    if (window.location.hash !== initHash) return;
    content.innerHTML = `
      <div class="tax-tabs">
        <button class="tax-tab ${activeTab === 'iva' ? 'active' : ''}" data-tab="iva"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg> IVA Mensual <span style="opacity:.5;font-weight:400;font-size:var(--fs-2xs);">(D-150)</span></button>
        <button class="tax-tab ${activeTab === 'renta' ? 'active' : ''}" data-tab="renta"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Renta Anual <span style="opacity:.5;font-weight:400;font-size:var(--fs-2xs);">(D-101)</span></button>
        <button class="tax-tab ${activeTab === 'reportes' ? 'active' : ''}" data-tab="reportes"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> Reportes</button>
      </div>
      <div id="tab-content"></div>
    `;

    content.querySelectorAll('.tax-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = tab.dataset.tab;
        render();
      });
    });

    const tabContent = content.querySelector('#tab-content');
    if (activeTab === 'iva') renderIVATab(tabContent);
    else if (activeTab === 'renta') renderRentaTab(tabContent);
    else renderReportesTab(tabContent);
  }

  render();

  // ─── IVA TAB ──────────────────────────────────────────────

  let ivaViewMode = 'calc'; // 'calc' | 'replica'

  async function renderIVATab(container) {
    let selMes = mes; // Default to current month
    let selAnio = anio;

    container.innerHTML = `
      <div class="tax-section" style="animation-delay:0.1s">
        <div class="tax-section-header">
          <div class="tax-section-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
            ${ivaViewMode === 'replica' ? 'Réplica D-150 — Declaración de IVA' : 'Calculadora IVA Mensual'}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;">
            <select id="iva-mes" class="tax-select">
              ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === selMes ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
            <select id="iva-anio" class="tax-select">
              ${[anio - 4, anio - 3, anio - 2, anio - 1, anio].map(y => `<option value="${y}" ${y === selAnio ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <div style="display:flex;align-items:center;background:rgba(255,255,255,0.7);border:1px solid rgba(0,194,168,0.3);border-radius:var(--r);padding:0 var(--sp-2);">
              <span style="font-size:var(--fs-xs);color:var(--text-mid);margin-right:var(--sp-2);">+ Saldo a favor (Cuenta Trib.) ₡</span>
              <input type="number" id="iva-saldo-favor-previo" style="width:100px;border:none;background:transparent;padding:var(--sp-2) 0;box-shadow:none;outline:none;font-weight:600;color:var(--text);" placeholder="0" min="0">
            </div>
            <button class="tax-btn tax-btn-primary" id="btn-calc-iva">Calcular</button>
            <button class="tax-btn ${ivaViewMode === 'replica' ? 'tax-btn-primary' : 'tax-btn-outline'}" id="btn-toggle-d150" style="font-size:var(--fs-xs);">
              ${ivaViewMode === 'replica' ? '📊 Calculadora' : '📋 Réplica D-150'}
            </button>
          </div>
        </div>
        <div class="tax-section-body" id="iva-result">
          <div class="tax-empty" style="padding:var(--sp-6);">
            <div class="tax-empty-icon">
              <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="opacity:.5;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"/></svg>
            </div>
            <h3>Seleccioná el período</h3>
            <p>Elegí el mes y año, luego hacé clic en "Calcular" para ver el desglose del IVA.</p>
          </div>
        </div>
      </div>
    `;

    async function calcIVA() {
      selMes = Number(document.getElementById('iva-mes').value);
      selAnio = Number(document.getElementById('iva-anio').value);
      const resultDiv = document.getElementById('iva-result');

      resultDiv.innerHTML = '<div style="text-align:center;padding:40px;"><div class="boot-spinner" style="width:30px;height:30px;border-width:3px;display:inline-block;"></div></div>';

      try {
        const data = await fetchTaxData(selAnio, selMes, true);

        const ingresos = data.ingresosMes;
        const gastos = data.gastosMes;

        // Check for previous month saldo a favor
        let saldoAnterior = 0;
        const prevMes = selMes > 1 ? selMes - 1 : 12;
        const prevAnio = selMes > 1 ? selAnio : selAnio - 1;
        try {
          const supabase = await getSupabase();
          const { data: prevDecl } = await supabase.from('tax_iva_declarations')
            .select('saldo_favor')
            .eq('periodo_mes', prevMes)
            .eq('periodo_anio', prevAnio)
            .single();
          if (prevDecl) saldoAnterior = Number(prevDecl.saldo_favor || 0);
        } catch {}

        const manualSaldo = Number(document.getElementById('iva-saldo-favor-previo')?.value) || 0;
        saldoAnterior += manualSaldo;

        const calc = calcularIVAMensual(ingresos, gastos, saldoAnterior);
        const mesNombre = MESES[selMes - 1];

        if (ivaViewMode === 'replica') {
          renderD150Replica(resultDiv, calc, { mes: selMes, anio: selAnio, mesNombre, saldoAnterior, prevMes, prevAnio, ingresos, gastos });
          return;
        }

        resultDiv.innerHTML = `
          <div style="margin-bottom:var(--sp-3);">
            <div style="display:flex;align-items:center;gap:var(--sp-2);margin-bottom:var(--sp-2);">
              <span style="font-size:var(--fs-sm);color:var(--text-mid);font-weight:var(--fw-medium);">
                ${calc.cantidadIngresos} ingresos · ${calc.cantidadGastos} gastos · <span style="color:var(--text);">${mesNombre} ${selAnio}</span>
              </span>
            </div>

            <div class="tax-result">
              <div class="tax-result-row" style="background:linear-gradient(90deg, rgba(27,94,32,0.08), transparent);margin:calc(-1 * var(--sp-4)) calc(-1 * var(--sp-5)) var(--sp-2) calc(-1 * (var(--sp-5) + 4px));padding:var(--sp-3) var(--sp-5);border-radius:var(--r-xl) var(--r-xl) 0 0;border-bottom:1px solid rgba(27,94,32,0.1);">
                <span class="label" style="font-weight:var(--fw-bold);color:var(--green);display:flex;align-items:center;gap:var(--sp-2);"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg> VENTAS (Débito Fiscal)</span>
                <span class="value" style="color:var(--green);font-size:var(--fs-lg);">${formatColones(calc.debitoFiscal)}</span>
              </div>
              <div class="tax-result-row">
                <span class="label">Total ventas netas (sin IVA)</span>
                <span class="value">${formatColones(calc.totalVentasNeto)}</span>
              </div>
              <div class="tax-result-row">
                <span class="label">IVA cobrado (débito fiscal)</span>
                <span class="value">${formatColones(calc.debitoFiscal)}</span>
              </div>

              <div style="height:1px;background:rgba(13,50,112,0.06);margin:var(--sp-2) 0;"></div>

              <div class="tax-result-row" style="background:linear-gradient(90deg, rgba(192,57,43,0.06), transparent);margin:0 calc(-1 * var(--sp-5)) 0 calc(-1 * (var(--sp-5) + 4px));padding:var(--sp-2) var(--sp-5);border-top:1px solid rgba(192,57,43,0.05);">
                <span class="label" style="font-weight:var(--fw-bold);color:var(--red);display:flex;align-items:center;gap:var(--sp-2);"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 12H4"/></svg> COMPRAS (Crédito Fiscal)</span>
                <span class="value" style="color:var(--red);font-size:var(--fs-lg);">${formatColones(calc.creditoFiscal)}</span>
              </div>
              <div class="tax-result-row">
                <span class="label">Total compras netas (sin IVA)</span>
                <span class="value">${formatColones(calc.totalComprasNeto)}</span>
              </div>
              <div class="tax-result-row">
                <span class="label">IVA pagado en compras deducibles</span>
                <span class="value">${formatColones(calc.creditoFiscal)}</span>
              </div>
              ${saldoAnterior > 0 ? `
                <div class="tax-result-row" style="background:rgba(0,194,168,0.05);margin:0 -var(--sp-5);padding:var(--sp-2) var(--sp-5);">
                  <span class="label" style="color:var(--accent-dark);font-weight:500;">Saldo a favor acumulado de meses anteriores</span>
                  <span class="value" style="color:var(--accent-dark);font-weight:600;">+ ${formatColones(saldoAnterior)}</span>
                </div>
              ` : ''}
              ${calc.factorProporcionalidad < 1 ? `
                <div class="tax-result-row">
                  <span class="label">Factor de proporcionalidad</span>
                  <span class="value">${(calc.factorProporcionalidad * 100).toFixed(2)}%</span>
                </div>
              ` : ''}
              ${calc.totalGastosNoDeducibles > 0 ? `
                <div class="tax-result-row">
                  <span class="label" style="opacity:0.8;">Gastos no deducibles (sin crédito)</span>
                  <span class="value" style="color:var(--text-soft);">${formatColones(calc.totalGastosNoDeducibles)}</span>
                </div>
              ` : ''}

              ${saldoAnterior > 0 ? `
                <div style="height:1px;background:rgba(13,50,112,0.06);margin:var(--sp-2) 0;"></div>
                <div class="tax-result-row">
                  <span class="label">Saldo a favor de ${MESES[prevMes - 1]}</span>
                  <span class="value" style="color:var(--accent-dark);">${formatColones(saldoAnterior)}</span>
                </div>
              ` : ''}

              <div class="tax-result-row total ${calc.ivaPagar > 0 ? 'pagar' : 'favor'}">
                <span class="label">${calc.ivaPagar > 0 ? 'IVA A PAGAR' : 'SALDO A FAVOR'}</span>
                <span class="value">${formatColones(calc.ivaPagar > 0 ? calc.ivaPagar : calc.saldoFavor)}</span>
              </div>
            </div>
          </div>

          <!-- Desglose por tarifa -->
          ${(Object.keys(calc.ventasPorTarifa).length > 0 || Object.keys(calc.comprasPorTarifa).length > 0) ? `
            <div style="margin-top:var(--sp-3);">
              <h4 style="font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text-mid);margin-bottom:var(--sp-2);">Desglose por Tarifa IVA</h4>
              <div class="tax-table-wrap">
                <table class="tax-table">
                  <thead>
                    <tr><th>Tarifa</th><th>Tipo</th><th class="col-money">Base</th><th class="col-money">IVA</th><th class="col-money">Total</th><th>Cant.</th></tr>
                  </thead>
                  <tbody>
                    ${Object.entries(calc.ventasPorTarifa).map(([t, v]) => `
                      <tr>
                        <td>${t}%</td><td><span class="tax-badge tax-badge-deducible">Ventas</span></td>
                        <td class="col-money">${formatColones(v.base)}</td>
                        <td class="col-money">${formatColones(v.iva)}</td>
                        <td class="col-money">${formatColones(v.total)}</td>
                        <td>${v.count}</td>
                      </tr>
                    `).join('')}
                    ${Object.entries(calc.comprasPorTarifa).map(([t, v]) => `
                      <tr>
                        <td>${t}%</td><td><span class="tax-badge tax-badge-correo">Compras</span></td>
                        <td class="col-money">${formatColones(v.base)}</td>
                        <td class="col-money">${formatColones(v.iva)}</td>
                        <td class="col-money">${formatColones(v.total)}</td>
                        <td>${v.count}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          ` : ''}

          <!-- Actions -->
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3);flex-wrap:wrap;">
            <button class="tax-btn tax-btn-primary" id="btn-save-iva">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
              Guardar Declaración
            </button>
            <button class="tax-btn tax-btn-outline" id="btn-pdf-iva">📄 Descargar PDF</button>
            <button class="tax-btn tax-btn-outline" id="btn-excel-iva">📊 Descargar Excel</button>
          </div>

          <div style="margin-top:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:linear-gradient(135deg,rgba(0,194,168,0.08),rgba(0,194,168,0.03));border-radius:var(--r-md);font-size:var(--fs-sm);color:var(--text);border-left:4px solid var(--accent);display:flex;align-items:flex-start;gap:var(--sp-2);box-shadow:var(--shadow-xs);">
            <div style="background:var(--accent);color:white;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div><strong style="color:var(--accent-dark);font-size:var(--fs-sm);">Para TRIBU-CR (D-150):</strong> Ingresá los montos de Débito Fiscal (<strong style="font-family:var(--font-mono);">${formatColones(calc.debitoFiscal)}</strong>) y Crédito Fiscal (<strong style="font-family:var(--font-mono);">${formatColones(calc.creditoFiscal)}</strong>) en los campos correspondientes del formulario D-150. Fecha límite: 15 de ${MESES[selMes % 12]}.</div>
          </div>
        `;

        // Save declaration
        resultDiv.querySelector('#btn-save-iva')?.addEventListener('click', async () => {
          try {
            const supabase = await getSupabase();
            await supabase.from('tax_iva_declarations').upsert({
              periodo_mes: selMes,
              periodo_anio: selAnio,
              total_ingresos: calc.totalVentasNeto + calc.debitoFiscal,
              debito_fiscal: calc.debitoFiscal,
              total_gastos: calc.totalComprasNeto + calc.creditoFiscal,
              credito_fiscal: calc.creditoFiscal,
              iva_a_pagar: calc.ivaPagar,
              saldo_favor: calc.saldoFavor,
              desglose: { ventasPorTarifa: calc.ventasPorTarifa, comprasPorTarifa: calc.comprasPorTarifa },
              estado: 'guardado'
            }, { onConflict: 'periodo_mes,periodo_anio' });

            // If there's a saldo a favor, create fiscal credit
            if (calc.saldoFavor > 0) {
              await supabase.from('tax_fiscal_credits').insert({
                tipo: 'iva_saldo_favor',
                periodo_origen: `${mesNombre} ${selAnio}`,
                monto: calc.saldoFavor,
                monto_disponible: calc.saldoFavor,
                estado: 'disponible'
              });
            }

            toast('Declaración IVA guardada ✓', 'success');
          } catch (e) {
            toast('Error: ' + e.message, 'error');
          }
        });

        // PDF/Excel
        resultDiv.querySelector('#btn-pdf-iva')?.addEventListener('click', () => {
          generarPDFIVA(calc, { mes: selMes, anio: selAnio }, ingresos, gastos);
          toast('PDF generado ✓', 'success');
        });
        resultDiv.querySelector('#btn-excel-iva')?.addEventListener('click', () => {
          generarExcelIVA(calc, { mes: selMes, anio: selAnio }, ingresos, gastos);
          toast('Excel generado ✓', 'success');
        });

      } catch (e) {
        resultDiv.innerHTML = `<div class="tax-empty"><div class="tax-empty-icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
      }
    }

    container.querySelector('#btn-calc-iva')?.addEventListener('click', calcIVA);
    container.querySelector('#btn-toggle-d150')?.addEventListener('click', () => {
      ivaViewMode = ivaViewMode === 'replica' ? 'calc' : 'replica';
      renderIVATab(container);
    });
    // Auto-calculate on load
    calcIVA();
  }

  // ─── D-150 REPLICA ────────────────────────────────────────

  function renderD150Replica(resultDiv, calc, ctx) {
    const { mes, anio, mesNombre, saldoAnterior, prevMes, prevAnio } = ctx;
    const ventas = calc.ventasPorTarifa || {};
    const compras = calc.comprasPorTarifa || {};

    function v(t) { return ventas[t] || { base: 0, iva: 0, total: 0 }; }
    function c(t) { return compras[t] || { base: 0, iva: 0, total: 0 }; }

    const ivaPagar = calc.ivaPagar || 0;
    const saldoFavor = calc.saldoFavor || 0;

    const TARIFAS_ORDEN = ['0.5', '1', '2', '3', '4', '4A', '13'];
    const TARIFAS_LABEL = {
      '0.5': '0,5%',
      '1': '1%',
      '2': '2%',
      '3': '3%',
      '4': '4%',
      '4A': '4% (Servicios aéreos internacionales exclusivos)',
      '13': '13%'
    };

    function getBaseVenta(t) {
      if (t === '4A') return 0;
      if (t === '0.5') return 0;
      if (t === '3') return 0;
      return v(t).base;
    }
    function getIVAVenta(t) {
      if (t === '4A') return 0;
      if (t === '0.5') return 0;
      if (t === '3') return 0;
      return v(t).iva;
    }
    function getBaseCompra(t) {
      if (t === '4A') return 0;
      if (t === '0.5') return 0;
      if (t === '3') return 0;
      return c(t).base;
    }
    function getIVACompra(t) {
      if (t === '4A') return 0;
      if (t === '0.5') return 0;
      if (t === '3') return 0;
      return c(t).iva;
    }

    const totalVentasGenerales = TARIFAS_ORDEN.reduce((s, t) => s + getBaseVenta(t), 0);
    const totalVentasGravadas = TARIFAS_ORDEN.filter(t => t !== '4A').reduce((s, t) => s + getBaseVenta(t), 0);
    const montoImpuestoVentas = TARIFAS_ORDEN.filter(t => t !== '4A').reduce((s, t) => s + getIVAVenta(t), 0);
    const totalImporteCompras = TARIFAS_ORDEN.reduce((s, t) => s + getBaseCompra(t) + getIVACompra(t), 0);
    const totalImpuestoSoportado = TARIFAS_ORDEN.filter(t => t !== '4A').reduce((s, t) => s + getIVACompra(t), 0);
    const totalCreditoFiscal = calc.creditoFiscal || 0;

    const accordionVentas = TARIFAS_ORDEN.map(t => `
      <div class="d150-accordion" data-tarifa="v-${t}">
        <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
          <span>Tarifa ${TARIFAS_LABEL[t]}</span>
          <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div class="d150-accordion-body">
          ${t === '13' ? `
            <div class="d150-field">
              <label>Total ventas a 13%</label>
              <div class="d150-input">${formatColones(getBaseVenta(t))}</div>
            </div>
            <div class="d150-field">
              <label>Monto del impuesto a 13%</label>
              <div class="d150-input">${formatColones(getIVAVenta(t))}</div>
            </div>
          ` : `
            <div class="d150-field">
              <label>Total ventas a ${TARIFAS_LABEL[t]}</label>
              <div class="d150-input">${formatColones(getBaseVenta(t))}</div>
            </div>
          `}
        </div>
      </div>
    `).join('');

    const accordionCompras = TARIFAS_ORDEN.map(t => `
      <div class="d150-accordion" data-tarifa="c-${t}">
        <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
          <span>Compras a ${TARIFAS_LABEL[t]}</span>
          <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
        </div>
        <div class="d150-accordion-body">
          ${t === '13' ? `
            <div class="d150-field">
              <label>Total importe compras a 13%</label>
              <div class="d150-input">${formatColones(getBaseCompra(t) + getIVACompra(t))}</div>
            </div>
            <div class="d150-field">
              <label>Impuesto soportado a 13%</label>
              <div class="d150-input">${formatColones(getIVACompra(t))}</div>
            </div>
          ` : `
            <div class="d150-field">
              <label>Total importe compras a ${TARIFAS_LABEL[t]}</label>
              <div class="d150-input">${formatColones(getBaseCompra(t) + getIVACompra(t))}</div>
            </div>
          `}
        </div>
      </div>
    `).join('');

    resultDiv.innerHTML = `
      <style>
        .d150-tribu { font-family:'Inter',-apple-system,system-ui,sans-serif; color:#1a1a2e; background:#f7f8fb; min-height:0; }
        .d150-breadcrumb { font-size:12px; color:#555; margin-bottom:12px; }
        .d150-breadcrumb a { color:#555; text-decoration:none; }
        .d150-breadcrumb strong { color:#1a1a2e; }
        .d150-title { font-size:22px; font-weight:700; color:#2c2c54; margin:0 0 16px 0; }
        .d150-layout { display:flex; gap:18px; align-items:flex-start; }
        .d150-stepper { width:230px; flex-shrink:0; background:#fff; border-radius:12px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-step { display:flex; align-items:flex-start; gap:10px; margin-bottom:18px; position:relative; }
        .d150-step:last-child { margin-bottom:0; }
        .d150-step-dot { width:16px; height:16px; border-radius:50%; background:#e2e8f0; border:2px solid #cbd5e1; flex-shrink:0; margin-top:2px; }
        .d150-step.active .d150-step-dot { background:#2c2c54; border-color:#2c2c54; }
        .d150-step.completed .d150-step-dot { background:#2c2c54; border-color:#2c2c54; }
        .d150-step.active .d150-step-dot::after { content:''; display:block; width:6px; height:6px; background:#fff; border-radius:50%; margin:3px auto; }
        .d150-step-text { font-size:12px; color:#666; line-height:1.35; }
        .d150-step.active .d150-step-text { font-weight:700; color:#2c2c54; }
        .d150-main { flex:1; min-width:0; }
        .d150-card { background:#fff; border-radius:12px; padding:22px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-card h3 { font-size:16px; font-weight:700; color:#2c2c54; margin:0 0 10px 0; display:flex; align-items:center; gap:8px; }
        .d150-card p { font-size:13px; color:#555; line-height:1.6; margin:0 0 12px 0; }
        .d150-card ul { margin:0 0 12px 0; padding-left:18px; font-size:13px; color:#555; line-height:1.7; }
        .d150-card .dotted { border-top:1px dashed #cbd5e1; margin:14px 0; }
        .d150-accordion { border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; overflow:hidden; }
        .d150-accordion-head { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:#fff; cursor:pointer; font-size:13px; font-weight:600; color:#2c2c54; }
        .d150-accordion-head:hover { background:#f8fafc; }
        .d150-accordion-body { display:none; padding:14px; background:#fff; border-top:1px solid #f1f5f9; }
        .d150-accordion.open .d150-accordion-body { display:block; }
        .d150-accordion.open .d150-chevron { transform:rotate(180deg); }
        .d150-chevron { transition:transform .2s; color:#64748b; }
        .d150-field { margin-bottom:12px; }
        .d150-field:last-child { margin-bottom:0; }
        .d150-field label { display:block; font-size:12px; color:#555; margin-bottom:5px; }
        .d150-input { background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:9px 12px; font-size:13px; font-family:'JetBrains Mono','Consolas',monospace; color:#1a1a2e; text-align:right; min-width:180px; display:inline-block; }
        .d150-input:focus { outline:none; border-color:#2c2c54; }
        .d150-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
        .d150-row:last-child { border-bottom:none; }
        .d150-row .value { font-family:'JetBrains Mono','Consolas',monospace; font-weight:600; color:#1a1a2e; }
        .d150-row.total { font-weight:700; font-size:14px; padding-top:14px; }
        .d150-resumen { width:280px; flex-shrink:0; background:#fff; border-radius:12px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-resumen h4 { font-size:14px; font-weight:700; color:#2c2c54; margin:0 0 14px 0; }
        .d150-resumen-row { display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; color:#555; }
        .d150-resumen-row span:first-child { font-weight:500; }
        .d150-resumen-row span:last-child { color:#1a1a2e; font-weight:600; text-align:right; }
        .d150-resumen-divider { border-top:1px solid #e2e8f0; margin:12px 0; }
        .d150-resumen-total { font-size:13px; font-weight:700; }
        .d150-buttons { display:flex; justify-content:space-between; margin-top:18px; }
        .d150-btn { padding:10px 20px; border-radius:24px; font-size:13px; font-weight:600; cursor:pointer; border:none; min-width:120px; text-align:center; }
        .d150-btn-prev { background:#fff; border:1.5px solid #2c2c54; color:#2c2c54; }
        .d150-btn-next { background:#2c2c54; color:#fff; }
        .d150-nota { font-size:11px; color:#888; margin-top:10px; line-height:1.5; }
        @media (max-width:1024px) {
          .d150-layout { flex-direction:column; }
          .d150-stepper, .d150-resumen { width:100%; }
        }
      </style>
      <div class="d150-tribu">
        <div class="d150-breadcrumb">
          <a href="#/dashboard">Inicio</a> / <a href="#/impuestos">Declaraciones</a> / <strong>150 - Impuesto al valor agregado</strong>
        </div>
        <h2 class="d150-title">150 - Impuesto al valor agregado</h2>

        <div class="d150-layout">
          <!-- STEPPER IZQUIERDO -->
          <div class="d150-stepper">
            <div class="d150-step active">
              <div class="d150-step-dot"></div>
              <div class="d150-step-text">Ventas generales</div>
            </div>
            <div class="d150-step">
              <div class="d150-step-dot"></div>
              <div class="d150-step-text">Pago diferido del impuesto por ventas a crédito del período a presentar o de períodos anteriores</div>
            </div>
            <div class="d150-step">
              <div class="d150-step-dot"></div>
              <div class="d150-step-text">Compras totales</div>
            </div>
            <div class="d150-step">
              <div class="d150-step-dot"></div>
              <div class="d150-step-text">Crédito fiscal</div>
            </div>
            <div class="d150-step">
              <div class="d150-step-dot"></div>
              <div class="d150-step-text">Cálculo del impuesto</div>
            </div>
          </div>

          <!-- CONTENIDO PRINCIPAL -->
          <div class="d150-main">

            <!-- CRÉDITO FISCAL -->
            <div class="d150-card" id="d150-credito-fiscal">
              <h3>Crédito fiscal</h3>
              <p>En esta sección del formulario se calcula el crédito fiscal para el IVA de la siguiente forma:</p>
              <ul>
                <li>Si usted vende a una única tarifa reducida y no es con derecho a crédito pleno, la "tarifa de IVA aplicada" es la tarifa menor de entre la tarifa de compras y la tarifa de ventas.</li>
                <li>Si usted vende a una única tarifa que es con derecho a crédito pleno, la "tarifa de IVA aplicada" es la tarifa que ha soportado en sus compras.</li>
                <li>Si usted vende a varias tarifas con derecho a crédito pleno, exentas o no, la "tarifa de IVA aplicada" es la que ha soportado en sus compras.</li>
              </ul>
              <p>La diferencia entre el monto del impuesto soportado y el crédito fiscal para el IVA será el "importe de costo o gasto para utilidades".</p>
            </div>

            <!-- COMPRAS TOTALES -->
            <div class="d150-card" id="d150-compras-totales">
              <h3>Compras totales</h3>
              <p>En esta sección incluya el monto de las compras realizadas en este período por cada tarifa. El sistema calculará de forma automática el impuesto soportado en cada una.</p>
              ${accordionCompras}

              <div class="dotted"></div>
              <div class="d150-row total">
                <span>Total importe compras</span>
                <span class="value">${formatColones(totalImporteCompras)}</span>
              </div>
              <div class="d150-row">
                <span>Total importe de compras con IVA soportado</span>
                <span class="value">${formatColones(TARIFAS_ORDEN.filter(t => t !== '4A').reduce((s, t) => s + getBaseCompra(t) + getIVACompra(t), 0))}</span>
              </div>
              <div class="d150-row">
                <span>Total impuesto soportado</span>
                <span class="value">${formatColones(totalImpuestoSoportado)}</span>
              </div>
              <div class="d150-row total">
                <span>Total crédito fiscal del período</span>
                <span class="value">${formatColones(totalCreditoFiscal)}</span>
              </div>
            </div>

            <!-- PAGO DIFERIDO -->
            <div class="d150-card" id="d150-pago-diferido">
              <h3>Pago diferido del impuesto por ventas a crédito del período a presentar o de períodos anteriores</h3>
              <p>En este apartado seleccione la opción "Sí lo utilizaré" si desea acogerse al esquema del pago diferido del impuesto por ventas a crédito; o si requiere cancelar el impuesto de períodos anteriores bajo esta modalidad.</p>
              <p style="margin-top:12px;"><strong>Opción seleccionada:</strong> No lo utilizaré</p>
            </div>

            <!-- VENTAS GENERALES -->
            <div class="d150-card" id="d150-ventas-generales">
              <h3>Ventas generales</h3>
              <p>En esta sección complete el importe de las ventas que ha realizado a cada una de las tarifas. El formulario calculará de forma automática el importe del monto del impuesto para cada una de ellas.</p>
              <p style="font-size:12px;color:#777;margin-top:-6px;">Asimismo, si le corresponde, complete las casillas de las ventas sin impuesto que dan derecho a crédito pleno y las ventas sin impuesto que no dan derecho a crédito.</p>
              ${accordionVentas}

              <div class="dotted"></div>
              <div class="d150-row total">
                <span>Total ventas generales</span>
                <span class="value">${formatColones(totalVentasGenerales)}</span>
              </div>
              <div class="d150-row total">
                <span>Total ventas generales gravadas</span>
                <span class="value">${formatColones(totalVentasGravadas)}</span>
              </div>
              <div class="d150-row total">
                <span>Monto del impuesto ventas generales</span>
                <span class="value">${formatColones(montoImpuestoVentas)}</span>
              </div>
              <div class="d150-row total" style="color:${ivaPagar > 0 ? '#c0392b' : '#27ae60'};">
                <span>${ivaPagar > 0 ? 'IVA a pagar' : 'Saldo a favor'}</span>
                <span class="value">${formatColones(ivaPagar > 0 ? ivaPagar : saldoFavor)}</span>
              </div>
            </div>

            <div class="d150-buttons">
              <button class="d150-btn d150-btn-prev" onclick="alert('Paso anterior (simulado)')">‹ Anterior</button>
              <button class="d150-btn d150-btn-next" onclick="alert('Paso siguiente (simulado)')">Siguiente ›</button>
            </div>
            <p class="d150-nota">Réplica visual para referencia. Período: ${mesNombre} ${anio}. Completá los valores en TRIBU-CR antes del 15 de ${MESES[mes % 12]} ${mes === 12 ? anio + 1 : anio}.</p>
          </div>

          <!-- RESUMEN DERECHO -->
          <div class="d150-resumen">
            <h4>Resumen</h4>
            <div class="d150-resumen-row">
              <span>Identificación</span>
              <span>205390118</span>
            </div>
            <div class="d150-resumen-row">
              <span>Nombre</span>
              <span>CESAR ANDRES BATISTA VARGAS</span>
            </div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row">
              <span>Período</span>
              <span>${mes.toString().padStart(2,'0')}/${anio}</span>
            </div>
            <div class="d150-resumen-row">
              <span>Declaración</span>
              <span>150 - Impuesto al valor agregado</span>
            </div>
            <div class="d150-resumen-row">
              <span>Fecha inicio</span>
              <span>01/${mes.toString().padStart(2,'0')}/${anio}</span>
            </div>
            <div class="d150-resumen-row">
              <span>Fecha fin</span>
              <span>${new Date(anio, mes, 0).getDate()}/${mes.toString().padStart(2,'0')}/${anio}</span>
            </div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row d150-resumen-total">
              <span>Total monto del impuesto</span>
              <span>${formatColones(calc.debitoFiscal)}</span>
            </div>
            <div class="d150-resumen-row d150-resumen-total">
              <span>Total crédito fiscal</span>
              <span>${formatColones(totalCreditoFiscal)}</span>
            </div>
            <div class="d150-resumen-row d150-resumen-total">
              <span>Total gasto para utilidades</span>
              <span>${formatColones(0)}</span>
            </div>
            <div class="d150-resumen-row d150-resumen-total" style="color:${ivaPagar > 0 ? '#c0392b' : '#27ae60'};">
              <span>Saldo a favor</span>
              <span>${formatColones(saldoFavor)}</span>
            </div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row" style="font-size:11px;color:#888;">
              <span>Estado</span>
              <span>En plazo</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── RENTA TAB ────────────────────────────────────────────

  let rentaViewMode = 'calc'; // 'calc' | 'replica'

  async function renderRentaTab(container) {
    let selAnio = anio - 1; // Previous year by default

    container.innerHTML = `
      <div class="tax-section" style="animation-delay:0.1s">
        <div class="tax-section-header">
          <div class="tax-section-title">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            ${rentaViewMode === 'replica' ? 'Réplica D-101 — Declaración de Renta' : 'Calculadora Renta Anual'}
          </div>
          <div style="display:flex;gap:var(--sp-2);align-items:center;flex-wrap:wrap;">
            <span style="font-size:var(--fs-sm);color:var(--text-mid);font-weight:var(--fw-medium);">Año fiscal:</span>
            <select id="renta-anio" class="tax-select">
              ${[anio - 4, anio - 3, anio - 2, anio - 1, anio].map(y => `<option value="${y}" ${y === selAnio ? 'selected' : ''}>${y}</option>`).join('')}
            </select>
            <label class="tax-toggle" style="margin-left:var(--sp-2);">
              <input type="checkbox" id="renta-deduccion-unica">
              <div class="tax-toggle-track"></div>
              <span class="tax-toggle-label" style="font-size:var(--fs-sm);color:var(--text-mid);font-weight:var(--fw-medium);">Deducción única 25%</span>
            </label>
            <button class="tax-btn tax-btn-primary" id="btn-calc-renta">Calcular</button>
            <button class="tax-btn ${rentaViewMode === 'replica' ? 'tax-btn-primary' : 'tax-btn-outline'}" id="btn-toggle-d101" style="font-size:var(--fs-xs);">
              ${rentaViewMode === 'replica' ? '📊 Calculadora' : '📋 Réplica D-101'}
            </button>
          </div>
        </div>
        <div class="tax-section-body" id="renta-result">
          <div class="tax-empty" style="padding:var(--sp-6);">
            <div class="tax-empty-icon">
              <svg width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24" style="opacity:.5;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
            </div>
            <h3>Seleccioná el año</h3>
            <p>Elegí el año fiscal y hacé clic en "Calcular". Actividad: 9511.0 — Reparación de computadoras y equipo periférico.</p>
          </div>
        </div>
      </div>
    `;

    async function calcRenta() {
      selAnio = Number(document.getElementById('renta-anio').value);
      const usarDeduccionUnica = document.getElementById('renta-deduccion-unica').checked;
      const resultDiv = document.getElementById('renta-result');

      resultDiv.innerHTML = '<div style="text-align:center;padding:40px;"><div class="boot-spinner" style="width:30px;height:30px;border-width:3px;display:inline-block;"></div></div>';

      try {
        const data = await fetchTaxData(selAnio, mes, true);

        const ingresos = data.ingresosAnio;
        const gastos = data.gastosAnio;

        const ingresosBrutos = ingresos.reduce((s, i) => s + (Number(i.monto_bruto || 0) - Number(i.monto_iva || 0)), 0);
        const gastosTotal = gastos.reduce((s, g) => s + (Number(g.monto_bruto || 0) - Number(g.monto_iva || 0)), 0);

        const calc = calcularRentaAnual({
          year: selAnio,
          ingresosBrutos,
          gastosDeducibles: gastosTotal,
          usarDeduccionUnica,
          hijos: 0,
          tieneConyuge: false
        });

        const parciales = calcularPagosParciales(calc.impuestoNeto, selAnio + 1);

        if (rentaViewMode === 'replica') {
          renderD101Replica(resultDiv, calc, { selAnio, usarDeduccionUnica });
          return;
        }

        resultDiv.innerHTML = `
          <div class="tax-result">
            <div class="tax-result-row">
              <span class="label">Ingresos brutos anuales (netos de IVA)</span>
              <span class="value" style="color:var(--green);">${formatColones(calc.ingresosBrutos)}</span>
            </div>
            <div class="tax-result-row">
              <span class="label">${calc.usarDeduccionUnica ? 'Deducción única (25%)' : 'Gastos deducibles'}</span>
              <span class="value" style="color:var(--red);">- ${formatColones(calc.deduccionAplicada)}</span>
            </div>
            <div class="tax-result-row" style="font-weight:600;">
              <span class="label">Renta neta gravable</span>
              <span class="value">${formatColones(calc.rentaNeta)}</span>
            </div>

            <div style="height:1px;background:var(--border);margin:var(--sp-2) 0;"></div>

            ${calc.desgloseTrmos.map(t => `
              <div class="tax-result-row">
                <span class="label">Tramo ${t.tasa}% (${formatColones(t.desde)} — ${t.hasta === Infinity ? 'en adelante' : formatColones(t.hasta)})</span>
                <span class="value">${formatColones(t.impuesto)}</span>
              </div>
            `).join('')}

            <div class="tax-result-row" style="font-weight:600;">
              <span class="label">Impuesto bruto</span>
              <span class="value">${formatColones(calc.impuestoBruto)}</span>
            </div>

            ${calc.totalCreditos > 0 ? `
              <div style="height:1px;background:var(--border);margin:var(--sp-2) 0;"></div>
              <div class="tax-result-row">
                <span class="label">(-) Créditos fiscales</span>
                <span class="value">- ${formatColones(calc.totalCreditos)}</span>
              </div>
            ` : ''}

            <div class="tax-result-row total ${calc.impuestoNeto > 0 ? 'pagar' : 'favor'}">
              <span class="label">IMPUESTO NETO A PAGAR</span>
              <span class="value">${formatColones(calc.impuestoNeto)}</span>
            </div>

            <div class="tax-result-row">
              <span class="label">Tasa efectiva</span>
              <span class="value">${calc.tasaEfectiva.toFixed(2)}%</span>
            </div>
          </div>

          <!-- Pagos parciales -->
          ${parciales.totalPagos > 0 ? `
            <div style="margin-top:var(--sp-5);">
              <h4 style="font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:var(--text-mid);margin-bottom:var(--sp-3);">
                📅 Pagos Parciales de Renta ${selAnio + 1}
              </h4>
              <div class="tax-calendar">
                ${parciales.pagos.map(p => `
                  <div class="tax-cal-item">
                    <div class="tax-cal-date">
                      <span class="day">${p.fecha_limite.split('/')[0]}</span>
                      <span class="month">${p.mesNombre.substring(0, 3).toUpperCase()}</span>
                    </div>
                    <div class="tax-cal-info">
                      <div class="label">${formatColones(p.monto)}</div>
                      <div class="sub">Pago parcial (25%)</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Comparison -->
          ${!usarDeduccionUnica ? `
            <div style="margin-top:var(--sp-3);padding:var(--sp-3);background:rgba(240,180,41,0.08);border-radius:var(--r);border:1px solid rgba(240,180,41,0.2);">
              <div style="font-size:var(--fs-sm);font-weight:var(--fw-semibold);color:#b8860b;margin-bottom:var(--sp-1);">
                💡 ¿Te conviene la deducción única del 25%?
              </div>
              <div style="font-size:var(--fs-xs);color:var(--text-mid);">
                ${(() => {
                  const altCalc = calcularRentaAnual({ year: selAnio, ingresosBrutos, gastosDeducibles: gastosTotal, usarDeduccionUnica: true, hijos: 0, tieneConyuge: false });
                  const diff = calc.impuestoNeto - altCalc.impuestoNeto;
                  if (diff > 0) {
                    return `Con deducción única pagarías <strong>${formatColones(altCalc.impuestoNeto)}</strong> — te ahorrás <strong style="color:var(--green)">${formatColones(diff)}</strong>. ¡Activá el switch!`;
                  } else if (diff < 0) {
                    return `Con deducción única pagarías <strong>${formatColones(altCalc.impuestoNeto)}</strong> — pagarías <strong style="color:var(--red)">${formatColones(Math.abs(diff))} más</strong>. Mejor dejalo con gastos reales.`;
                  }
                  return 'Ambas opciones dan el mismo resultado.';
                })()}
              </div>
            </div>
          ` : ''}

          <!-- Actions -->
          <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3);flex-wrap:wrap;">
            <button class="tax-btn tax-btn-primary" id="btn-save-renta">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>
              Guardar Declaración
            </button>
            <button class="tax-btn tax-btn-outline" id="btn-pdf-renta">📄 Descargar PDF</button>
            <button class="tax-btn tax-btn-outline" id="btn-excel-renta">📊 Descargar Excel</button>
          </div>

          <div style="margin-top:var(--sp-4);padding:var(--sp-3) var(--sp-4);background:linear-gradient(135deg,rgba(0,194,168,0.08),rgba(0,194,168,0.03));border-radius:var(--r-md);font-size:var(--fs-sm);color:var(--text);border-left:4px solid var(--accent);display:flex;align-items:flex-start;gap:var(--sp-2);box-shadow:var(--shadow-xs);">
            <div style="background:var(--accent);color:white;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            <div><strong style="color:var(--accent-dark);font-size:var(--fs-sm);">Para TRIBU-CR (D-101):</strong> Ingresá <strong style="font-family:var(--font-mono);">${formatColones(calc.ingresosBrutos)}</strong> en Ingresos Brutos. Si elegís Deducción Única (25%), marcá la casilla; sino, ingresá <strong style="font-family:var(--font-mono);">${formatColones(calc.gastosDeducibles)}</strong> en Gastos Deducibles. Fecha límite: 15 de Marzo de ${selAnio + 1}.</div>
          </div>
        `;

        // Save
        resultDiv.querySelector('#btn-save-renta')?.addEventListener('click', async () => {
          try {
            const supabase = await getSupabase();
            await supabase.from('tax_renta_declarations').upsert({
              periodo_anio: selAnio,
              ingresos_brutos: calc.ingresosBrutos,
              gastos_deducibles: calc.deduccionAplicada,
              renta_neta: calc.rentaNeta,
              impuesto_bruto: calc.impuestoBruto,
              impuesto_neto: calc.impuestoNeto,
              usa_deduccion_unica: calc.usarDeduccionUnica,
              desglose: calc,
              estado: 'guardado'
            }, { onConflict: 'periodo_anio' });
            toast('Declaración Renta guardada ✓', 'success');
          } catch (e) {
            toast('Error: ' + e.message, 'error');
          }
        });

        resultDiv.querySelector('#btn-pdf-renta')?.addEventListener('click', () => {
          generarPDFRenta(calc);
          toast('PDF generado ✓', 'success');
        });
        resultDiv.querySelector('#btn-excel-renta')?.addEventListener('click', () => {
          generarExcelRenta(calc);
          toast('Excel generado ✓', 'success');
        });

      } catch (e) {
        resultDiv.innerHTML = `<div class="tax-empty"><div class="tax-empty-icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
      }
    }

    container.querySelector('#btn-calc-renta')?.addEventListener('click', calcRenta);
    container.querySelector('#btn-toggle-d101')?.addEventListener('click', () => {
      rentaViewMode = rentaViewMode === 'replica' ? 'calc' : 'replica';
      renderRentaTab(container);
    });
    calcRenta();
  }

  // ─── D-150 REPLICA ────────────────────────────────────────

  function renderD150Replica(resultDiv, calc, ctx) {
    const { mes, anio, mesNombre, ingresos, gastos } = ctx;

    const fmt = (n) => {
      const s = Number(n || 0).toFixed(2);
      const [int, dec] = s.split('.');
      const intFormatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      return `${intFormatted},${dec}`;
    };
    const money = (n) => '₡' + fmt(n);

    // ── Cálculos directos desde los arrays originales ──────────────────
    const totalVentasBruto = ingresos.reduce((s, i) => s + (Number(i.monto_bruto) || 0), 0);
    const totalVentasBase = ingresos.reduce((s, i) => s + (Number(i.monto_bruto) || 0) - (Number(i.monto_iva) || 0), 0);
    const totalVentasIVA = ingresos.reduce((s, i) => s + (Number(i.monto_iva) || 0), 0);

    const totalComprasBruto = gastos.reduce((s, g) => s + (Number(g.monto_bruto) || 0), 0);
    const totalComprasBase = gastos.reduce((s, g) => s + (Number(g.monto_bruto) || 0) - (Number(g.monto_iva) || 0), 0);
    const totalImpuestoSoportado = gastos.reduce((s, g) => s + (Number(g.monto_iva) || 0), 0);
    const comprasConIVASoportado = gastos.filter(g => (g.tarifa_iva || 0) > 0).reduce((s, g) => s + (Number(g.monto_bruto) || 0), 0);
    const comprasSinIVA = gastos.filter(g => (g.tarifa_iva || 0) === 0).reduce((s, g) => s + (Number(g.monto_bruto) || 0), 0);

    const creditoFiscal = calc.creditoFiscal || 0;
    const gastoParaUtilidades = Math.max(0, totalImpuestoSoportado - creditoFiscal);
    const ivaPagar = calc.ivaPagar || 0;
    const saldoFavor = calc.saldoFavor || 0;

    // ── Desglose por tarifa (usar calc + detectar otras) ───────────────
    const ventas = calc.ventasPorTarifa || {};
    const compras = calc.comprasPorTarifa || {};
    const tarifasPresentes = new Set([
      ...Object.keys(ventas).map(Number),
      ...Object.keys(compras).map(Number)
    ]);

    const TARIFAS_STANDARD = [13, 4, 4.1, 3, 2, 1, 0.5, 0];
    const otrasTarifas = [...tarifasPresentes].filter(t => !TARIFAS_STANDARD.includes(Number(t)));
    const hayOtras = otrasTarifas.length > 0;

    function v(t) { return ventas[t] || { base: 0, iva: 0, total: 0 }; }
    function c(t) { return compras[t] || { base: 0, iva: 0, total: 0 }; }

    function tarifaLabel(t) {
      if (t === 0) return '0%';
      if (t === 0.5) return '0,5%';
      if (t === 4.1) return '4% (Servicios aéreos internacionales exclusivos)';
      return `${t}%`;
    }

    const TARIFAS_ROWS = [13, 4, 4.1, 3, 2, 1, 0.5, 0, ...(hayOtras ? ['otras'] : [])];

    function acordeonVentas() {
      return TARIFAS_ROWS.map(t => {
        if (t === 'otras') {
          const base = otrasTarifas.reduce((s, tt) => s + (ventas[tt]?.base || 0), 0);
          const iva = otrasTarifas.reduce((s, tt) => s + (ventas[tt]?.iva || 0), 0);
          return `
            <div class="d150-accordion" data-tarifa="v-otras">
              <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                <span>Otras tarifas</span>
                <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div class="d150-accordion-body">
                <div class="d150-field"><label>Total ventas otras tarifas</label><div class="d150-input">${money(base + iva)}</div></div>
                <div class="d150-field"><label>Monto del impuesto</label><div class="d150-input">${money(iva)}</div></div>
              </div>
            </div>`;
        }
        const label = tarifaLabel(t);
        const base = v(t).base;
        const iva = v(t).iva;
        const total = v(t).total;
        if (t === 13) {
          return `
            <div class="d150-accordion open" data-tarifa="v-13">
              <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                <span>Tarifa ${label}</span>
                <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div class="d150-accordion-body" style="display:block;">
                <div class="d150-field"><label>Total ventas a 13%</label><div class="d150-input">${money(total)}</div></div>
                <div class="d150-field"><label>Monto del impuesto a 13%</label><div class="d150-input">${money(iva)}</div></div>
              </div>
            </div>`;
        }
        return `
          <div class="d150-accordion" data-tarifa="v-${t}">
            <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
              <span>Tarifa ${label}</span>
              <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div class="d150-accordion-body">
              <div class="d150-field"><label>Total ventas a ${label}</label><div class="d150-input">${money(total)}</div></div>
            </div>
          </div>`;
      }).join('');
    }

    function acordeonCompras() {
      return TARIFAS_ROWS.map(t => {
        if (t === 'otras') {
          const base = otrasTarifas.reduce((s, tt) => s + (compras[tt]?.base || 0), 0);
          const iva = otrasTarifas.reduce((s, tt) => s + (compras[tt]?.iva || 0), 0);
          const total = otrasTarifas.reduce((s, tt) => s + (compras[tt]?.total || 0), 0);
          return `
            <div class="d150-accordion" data-tarifa="c-otras">
              <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                <span>Otras tarifas</span>
                <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div class="d150-accordion-body">
                <div class="d150-field"><label>Total importe compras otras tarifas</label><div class="d150-input">${money(total)}</div></div>
                <div class="d150-field"><label>Impuesto soportado otras tarifas</label><div class="d150-input">${money(iva)}</div></div>
              </div>
            </div>`;
        }
        const label = tarifaLabel(t);
        const total = c(t).total;
        const iva = c(t).iva;
        if (t === 13) {
          return `
            <div class="d150-accordion open" data-tarifa="c-13">
              <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                <span>Compras a ${label}</span>
                <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
              </div>
              <div class="d150-accordion-body" style="display:block;">
                <div class="d150-field"><label>Total importe compras a 13%</label><div class="d150-input">${money(total)}</div></div>
                <div class="d150-field"><label>Impuesto soportado a 13%</label><div class="d150-input">${money(iva)}</div></div>
              </div>
            </div>`;
        }
        return `
          <div class="d150-accordion" data-tarifa="c-${t}">
            <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
              <span>Compras a ${label}</span>
              <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
            </div>
            <div class="d150-accordion-body">
              <div class="d150-field"><label>Total importe compras a ${label}</label><div class="d150-input">${money(total)}</div></div>
            </div>
          </div>`;
      }).join('');
    }

    resultDiv.innerHTML = `
      <style>
        .d150-tribu { font-family:'Inter',-apple-system,system-ui,sans-serif; color:#1a1a2e; background:#f7f8fb; min-height:0; }
        .d150-breadcrumb { font-size:12px; color:#555; margin-bottom:12px; }
        .d150-breadcrumb a { color:#555; text-decoration:none; }
        .d150-breadcrumb strong { color:#1a1a2e; }
        .d150-title { font-size:22px; font-weight:700; color:#2c2c54; margin:0 0 16px 0; }
        .d150-layout { display:flex; gap:18px; align-items:flex-start; }
        .d150-stepper { width:230px; flex-shrink:0; background:#fff; border-radius:12px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-step { display:flex; align-items:flex-start; gap:10px; margin-bottom:18px; position:relative; }
        .d150-step:last-child { margin-bottom:0; }
        .d150-step-dot { width:16px; height:16px; border-radius:50%; background:#e2e8f0; border:2px solid #cbd5e1; flex-shrink:0; margin-top:2px; }
        .d150-step.active .d150-step-dot { background:#2c2c54; border-color:#2c2c54; }
        .d150-step.completed .d150-step-dot { background:#2c2c54; border-color:#2c2c54; }
        .d150-step.active .d150-step-dot::after { content:''; display:block; width:6px; height:6px; background:#fff; border-radius:50%; margin:3px auto; }
        .d150-step-text { font-size:12px; color:#666; line-height:1.35; }
        .d150-step.active .d150-step-text { font-weight:700; color:#2c2c54; }
        .d150-main { flex:1; min-width:0; }
        .d150-card { background:#fff; border-radius:12px; padding:22px; margin-bottom:16px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-card h3 { font-size:16px; font-weight:700; color:#2c2c54; margin:0 0 10px 0; display:flex; align-items:center; gap:8px; }
        .d150-card p { font-size:13px; color:#555; line-height:1.6; margin:0 0 12px 0; }
        .d150-card ul { margin:0 0 12px 0; padding-left:18px; font-size:13px; color:#555; line-height:1.7; }
        .d150-card .dotted { border-top:1px dashed #cbd5e1; margin:14px 0; }
        .d150-accordion { border:1px solid #e2e8f0; border-radius:8px; margin-bottom:8px; overflow:hidden; }
        .d150-accordion-head { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:#fff; cursor:pointer; font-size:13px; font-weight:600; color:#2c2c54; }
        .d150-accordion-head:hover { background:#f8fafc; }
        .d150-accordion-body { display:none; padding:14px; background:#fff; border-top:1px solid #f1f5f9; }
        .d150-accordion.open .d150-accordion-body { display:block; }
        .d150-accordion.open .d150-chevron { transform:rotate(180deg); }
        .d150-chevron { transition:transform .2s; color:#64748b; }
        .d150-field { margin-bottom:12px; }
        .d150-field:last-child { margin-bottom:0; }
        .d150-field label { display:block; font-size:12px; color:#555; margin-bottom:5px; }
        .d150-input { background:#fff; border:1px solid #cbd5e1; border-radius:8px; padding:9px 12px; font-size:13px; font-family:'JetBrains Mono','Consolas',monospace; color:#1a1a2e; text-align:right; min-width:180px; display:inline-block; }
        .d150-row { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #f1f5f9; font-size:13px; }
        .d150-row:last-child { border-bottom:none; }
        .d150-row .value { font-family:'JetBrains Mono','Consolas',monospace; font-weight:600; color:#1a1a2e; }
        .d150-row.total { font-weight:700; font-size:14px; padding-top:14px; }
        .d150-resumen { width:280px; flex-shrink:0; background:#fff; border-radius:12px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,0.05); }
        .d150-resumen h4 { font-size:14px; font-weight:700; color:#2c2c54; margin:0 0 14px 0; }
        .d150-resumen-row { display:flex; justify-content:space-between; margin-bottom:10px; font-size:12px; color:#555; }
        .d150-resumen-row span:first-child { font-weight:500; }
        .d150-resumen-row span:last-child { color:#1a1a2e; font-weight:600; text-align:right; }
        .d150-resumen-divider { border-top:1px solid #e2e8f0; margin:12px 0; }
        .d150-resumen-total { font-size:13px; font-weight:700; }
        .d150-buttons { display:flex; justify-content:space-between; margin-top:18px; }
        .d150-btn { padding:10px 20px; border-radius:24px; font-size:13px; font-weight:600; cursor:pointer; border:none; min-width:120px; text-align:center; }
        .d150-btn-prev { background:#fff; border:1.5px solid #2c2c54; color:#2c2c54; }
        .d150-btn-next { background:#2c2c54; color:#fff; }
        .d150-nota { font-size:11px; color:#888; margin-top:10px; line-height:1.5; }
        @media (max-width:1024px) { .d150-layout { flex-direction:column; } .d150-stepper, .d150-resumen { width:100%; } }
      </style>
      <div class="d150-tribu">
        <div class="d150-breadcrumb">
          <a href="#/dashboard">Inicio</a> / <a href="#/impuestos">Declaraciones</a> / <strong>150 - Impuesto al valor agregado</strong>
        </div>
        <h2 class="d150-title">150 - Impuesto al valor agregado</h2>

        <div class="d150-layout">
          <!-- STEPPER -->
          <div class="d150-stepper">
            <div class="d150-step active"><div class="d150-step-dot"></div><div class="d150-step-text">Ventas generales</div></div>
            <div class="d150-step"><div class="d150-step-dot"></div><div class="d150-step-text">Pago diferido del impuesto por ventas a crédito del período a presentar o de períodos anteriores</div></div>
            <div class="d150-step"><div class="d150-step-dot"></div><div class="d150-step-text">Compras totales</div></div>
            <div class="d150-step"><div class="d150-step-dot"></div><div class="d150-step-text">Crédito fiscal</div></div>
            <div class="d150-step"><div class="d150-step-dot"></div><div class="d150-step-text">Cálculo del impuesto</div></div>
          </div>

          <!-- MAIN -->
          <div class="d150-main">

            <!-- CRÉDITO FISCAL -->
            <div class="d150-card" id="d150-credito-fiscal">
              <h3>Crédito fiscal</h3>
              <p>En esta sección del formulario se calcula el crédito fiscal para el IVA de la siguiente forma:</p>
              <ul>
                <li>Si usted vende a una única tarifa reducida y no es con derecho a crédito pleno, la "tarifa de IVA aplicada" es la tarifa menor de entre la tarifa de compras y la tarifa de ventas.</li>
                <li>Si usted vende a una única tarifa que es con derecho a crédito pleno, la "tarifa de IVA aplicada" es la tarifa que ha soportado en sus compras.</li>
                <li>Si usted vende a varias tarifas con derecho a crédito pleno, exentas o no, la "tarifa de IVA aplicada" es la que ha soportado en sus compras.</li>
              </ul>
              <p>La diferencia entre el monto del impuesto soportado y el crédito fiscal para el IVA será el "importe de costo o gasto para utilidades".</p>
            </div>

            <!-- COMPRAS TOTALES -->
            <div class="d150-card" id="d150-compras-totales">
              <h3>Compras totales</h3>
              <p>En esta sección incluya el monto de las compras realizadas en este período por cada tarifa. El sistema calculará de forma automática el impuesto soportado en cada una.</p>
              ${acordeonCompras()}

              <div class="d150-accordion">
                <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                  <span>Compras sin IVA soportado o no acreditable</span>
                  <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                </div>
                <div class="d150-accordion-body">
                  <div class="d150-field"><label>Total importe compras sin IVA soportado o no acreditable</label><div class="d150-input">${money(comprasSinIVA)}</div></div>
                </div>
              </div>

              <div class="dotted"></div>
              <div class="d150-row total"><span>Total importe compras</span><span class="value">${money(totalComprasBruto)}</span></div>
              <div class="d150-row"><span>Total importe compras sin IVA soportado o no acreditable</span><span class="value">${money(comprasSinIVA)}</span></div>
              <div class="d150-row"><span>Total importe de compras con IVA soportado</span><span class="value">${money(comprasConIVASoportado)}</span></div>
              <div class="d150-row"><span>Total impuesto soportado</span><span class="value">${money(totalImpuestoSoportado)}</span></div>
              <div class="d150-row total"><span>Total crédito fiscal del período</span><span class="value">${money(creditoFiscal)}</span></div>
              <div class="d150-row total"><span>Total importe de gasto para utilidades</span><span class="value">${money(gastoParaUtilidades)}</span></div>
            </div>

            <!-- PAGO DIFERIDO -->
            <div class="d150-card" id="d150-pago-diferido">
              <h3>Pago diferido del impuesto por ventas a crédito del período a presentar o de períodos anteriores</h3>
              <p>En este apartado seleccione la opción "Sí lo utilizaré" si desea acogerse al esquema del pago diferido del impuesto por ventas a crédito; o si requiere cancelar el impuesto de períodos anteriores bajo esta modalidad.</p>
              <p style="margin-top:12px;"><strong>Opción seleccionada:</strong> No lo utilizaré</p>
            </div>

            <!-- VENTAS GENERALES -->
            <div class="d150-card" id="d150-ventas-generales">
              <h3>Ventas generales</h3>
              <p>En esta sección complete el importe de las ventas que ha realizado a cada una de las tarifas. El formulario calculará de forma automática el importe del monto del impuesto para cada una de ellas.</p>
              <p style="font-size:12px;color:#777;margin-top:-6px;">Asimismo, si le corresponde, complete las casillas de las ventas sin impuesto que dan derecho a crédito pleno y las ventas sin impuesto que no dan derecho a crédito.</p>
              ${acordeonVentas()}

              <div class="d150-accordion">
                <div class="d150-accordion-head" onclick="this.parentElement.classList.toggle('open')">
                  <span>Otras ventas sin IVA</span>
                  <svg class="d150-chevron" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
                </div>
                <div class="d150-accordion-body">
                  <div class="d150-field"><label>Otras ventas sin IVA con derecho a crédito pleno</label><div class="d150-input">${money(0)}</div></div>
                  <div class="d150-field"><label>Otras ventas sin IVA sin derecho a crédito</label><div class="d150-input">${money(0)}</div></div>
                  <div class="d150-field"><label>Total ventas de bienes de capital exentos sin derecho a crédito</label><div class="d150-input">${money(0)}</div></div>
                </div>
              </div>

              <div class="dotted"></div>
              <div class="d150-row total"><span>Total ventas generales</span><span class="value">${money(totalVentasBruto)}</span></div>
              <div class="d150-row total"><span>Total ventas generales gravadas</span><span class="value">${money(totalVentasBase)}</span></div>
              <div class="d150-row total"><span>Monto del impuesto ventas generales</span><span class="value">${money(totalVentasIVA)}</span></div>
              <div class="d150-row total" style="color:${ivaPagar > 0 ? '#c0392b' : '#27ae60'};">
                <span>${ivaPagar > 0 ? 'IVA a pagar' : 'Saldo a favor'}</span>
                <span class="value">${money(ivaPagar > 0 ? ivaPagar : saldoFavor)}</span>
              </div>
            </div>

            <div class="d150-buttons">
              <button class="d150-btn d150-btn-prev" onclick="alert('Paso anterior (simulado)')">‹ Anterior</button>
              <button class="d150-btn d150-btn-next" onclick="alert('Paso siguiente (simulado)')">Siguiente ›</button>
            </div>
            <p class="d150-nota">Réplica visual para referencia. Período: ${mesNombre} ${anio}. Completá los valores en TRIBU-CR antes del 15 de ${MESES[mes % 12]} ${mes === 12 ? anio + 1 : anio}.</p>
          </div>

          <!-- RESUMEN -->
          <div class="d150-resumen">
            <h4>Resumen</h4>
            <div class="d150-resumen-row"><span>Identificación</span><span>205390118</span></div>
            <div class="d150-resumen-row"><span>Nombre</span><span>CESAR ANDRES BATISTA VARGAS</span></div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row"><span>Período</span><span>${mes.toString().padStart(2,'0')}/${anio}</span></div>
            <div class="d150-resumen-row"><span>Declaración</span><span>150 - Impuesto al valor agregado</span></div>
            <div class="d150-resumen-row"><span>Fecha inicio</span><span>01/${mes.toString().padStart(2,'0')}/${anio}</span></div>
            <div class="d150-resumen-row"><span>Fecha fin</span><span>${new Date(anio, mes, 0).getDate()}/${mes.toString().padStart(2,'0')}/${anio}</span></div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row d150-resumen-total"><span>Total monto del impuesto</span><span>${money(totalVentasIVA)}</span></div>
            <div class="d150-resumen-row d150-resumen-total"><span>Total crédito fiscal</span><span>${money(creditoFiscal)}</span></div>
            <div class="d150-resumen-row d150-resumen-total"><span>Total gasto para utilidades</span><span>${money(gastoParaUtilidades)}</span></div>
            <div class="d150-resumen-row d150-resumen-total" style="color:${ivaPagar > 0 ? '#c0392b' : '#27ae60'};"><span>Saldo a favor</span><span>${money(saldoFavor)}</span></div>
            <div class="d150-resumen-divider"></div>
            <div class="d150-resumen-row" style="font-size:11px;color:#888;"><span>Estado</span><span>En plazo</span></div>
          </div>
        </div>
      </div>
    `;
  }

  // ─── REPORTES TAB ─────────────────────────────────────────

  function renderReportesTab(container) {
    container.innerHTML = `
      <div style="display:flex;gap:var(--sp-2);margin-bottom:var(--sp-3);align-items:center;">
        <span style="font-size:var(--fs-sm);color:var(--text-mid);">Período:</span>
        <select id="rep-mes" style="padding:var(--sp-2) var(--sp-3);border:1.5px solid var(--border);border-radius:var(--r);font-size:var(--fs-sm);font-family:var(--font);background:var(--surface);">
          <option value="0">Anual completo</option>
          ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === mes ? 'selected' : ''}>${m}</option>`).join('')}
        </select>
        <select id="rep-anio" style="padding:var(--sp-2) var(--sp-3);border:1.5px solid var(--border);border-radius:var(--r);font-size:var(--fs-sm);font-family:var(--font);background:var(--surface);">
          ${[anio - 1, anio].map(y => `<option value="${y}" ${y === anio ? 'selected' : ''}>${y}</option>`).join('')}
        </select>
      </div>

      <div class="tax-reports-grid">
        <!-- Balance General -->
        <div class="tax-report-card">
          <div class="tax-report-icon pdf">📊</div>
          <div class="tax-report-info">
            <h4>Balance General</h4>
            <p>Activos, pasivos y patrimonio</p>
          </div>
          <div class="tax-report-actions">
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="balance" data-format="pdf" title="PDF">📄</button>
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="balance" data-format="excel" title="Excel">📊</button>
          </div>
        </div>

        <!-- Estado de Resultados -->
        <div class="tax-report-card">
          <div class="tax-report-icon excel">📈</div>
          <div class="tax-report-info">
            <h4>Estado de Resultados</h4>
            <p>Pérdidas y ganancias del período</p>
          </div>
          <div class="tax-report-actions">
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="resultados" data-format="pdf">📄</button>
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="resultados" data-format="excel">📊</button>
          </div>
        </div>

        <!-- Reporte IVA -->
        <div class="tax-report-card">
          <div class="tax-report-icon pdf">🏛️</div>
          <div class="tax-report-info">
            <h4>Reporte IVA Mensual</h4>
            <p>Débito, crédito y desglose por tarifa</p>
          </div>
          <div class="tax-report-actions">
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="iva" data-format="pdf">📄</button>
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="iva" data-format="excel">📊</button>
          </div>
        </div>

        <!-- Reporte Renta -->
        <div class="tax-report-card">
          <div class="tax-report-icon excel">📋</div>
          <div class="tax-report-info">
            <h4>Reporte Renta Anual</h4>
            <p>Tramos, créditos e impuesto neto</p>
          </div>
          <div class="tax-report-actions">
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="renta" data-format="pdf">📄</button>
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="renta" data-format="excel">📊</button>
          </div>
        </div>

        <!-- Libro de Ingresos y Egresos -->
        <div class="tax-report-card">
          <div class="tax-report-icon excel">📒</div>
          <div class="tax-report-info">
            <h4>Libro de Ingresos y Egresos</h4>
            <p>Todos los movimientos del período</p>
          </div>
          <div class="tax-report-actions">
            <button class="tax-btn tax-btn-sm tax-btn-outline btn-report" data-type="libro" data-format="excel">📊</button>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.btn-report').forEach(btn => {
      btn.addEventListener('click', async () => {
        const type = btn.dataset.type;
        const format = btn.dataset.format;
        const repMes = Number(document.getElementById('rep-mes').value);
        const repAnio = Number(document.getElementById('rep-anio').value);
        const periodoLabel = repMes > 0 ? `${MESES[repMes - 1]} ${repAnio}` : `Año ${repAnio}`;

        btn.disabled = true;
        btn.textContent = '⏳';

        try {
          // Use fetchTaxData (reads from local XML files) instead of empty Supabase tables
          const data = await fetchTaxData(repAnio, repMes, true);
          const ingresos = repMes > 0 ? data.ingresosMes : data.ingresosAnio;
          const gastos = repMes > 0 ? data.gastosMes : data.gastosAnio;

          if (type === 'balance') {
            const balance = generarBalanceGeneral({ ingresos, gastos, periodo: periodoLabel });
            if (format === 'pdf') await generarPDFBalance(balance);
            else await generarExcelBalance(balance);
          } else if (type === 'resultados') {
            const estado = generarEstadoResultados(ingresos, gastos, periodoLabel);
            if (format === 'pdf') await generarPDFEstadoResultados(estado);
            else await generarExcelEstadoResultados(estado);
          } else if (type === 'iva') {
            const calc = calcularIVAMensual(ingresos, gastos);
            if (format === 'pdf') await generarPDFIVA(calc, { mes: repMes || 1, anio: repAnio }, ingresos, gastos);
            else await generarExcelIVA(calc, { mes: repMes || 1, anio: repAnio }, ingresos, gastos);
          } else if (type === 'renta') {
            const ingBrutos = ingresos.reduce((s, i) => s + Number(i.monto_bruto || 0) - Number(i.monto_iva || 0), 0);
            const gasDeducibles = gastos.filter(g => g.deducible !== false).reduce((s, g) => s + Number(g.monto_bruto || 0) - Number(g.monto_iva || 0), 0);
            const calc = calcularRentaAnual({ year: repAnio, ingresosBrutos: ingBrutos, gastosDeducibles: gasDeducibles, hijos: 0, tieneConyuge: false });
            if (format === 'pdf') await generarPDFRenta(calc);
            else await generarExcelRenta(calc);
          } else if (type === 'libro') {
            await generarExcelLibro(ingresos, gastos, periodoLabel);
          }

          toast(`${type.toUpperCase()} ${format.toUpperCase()} generado ✓`, 'success');
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = format === 'pdf' ? '📄' : '📊';
        }
      });
    });
  }

  render();
}
