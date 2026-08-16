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
    const TARIFAS = ['13', '4', '2', '1', '0'];
    const ventas = calc.ventasPorTarifa || {};
    const compras = calc.comprasPorTarifa || {};

    function v(t) { return ventas[t] || { base: 0, iva: 0, total: 0 }; }
    function c(t) { return compras[t] || { base: 0, iva: 0, total: 0 }; }

    const totalVentasBase = TARIFAS.reduce((s, t) => s + v(t).base, 0);
    const totalVentasIVA = TARIFAS.reduce((s, t) => s + v(t).iva, 0);
    const totalVentasBruto = totalVentasBase + totalVentasIVA;
    const totalComprasBase = TARIFAS.reduce((s, t) => s + c(t).base, 0);
    const totalComprasIVA = TARIFAS.reduce((s, t) => s + c(t).iva, 0);
    const totalComprasBruto = totalComprasBase + totalComprasIVA;

    const ivaPagar = calc.ivaPagar || 0;
    const saldoFavor = calc.saldoFavor || 0;

    resultDiv.innerHTML = `
      <style>
        .d150-form { background:#fff; border:2px solid #1a3a6b; border-radius:6px; overflow:hidden; font-family:'Inter',-apple-system,sans-serif; color:#1a1a1a; }
        .d150-header { background:linear-gradient(180deg,#1a3a6b,#0d3270); color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; }
        .d150-header h2 { margin:0; font-size:18px; font-weight:700; letter-spacing:0.5px; }
        .d150-header .d150-periodo { font-size:13px; opacity:0.9; }
        .d150-body { padding:16px 20px; }
        .d150-declarante { background:#f0f4fa; border:1px solid #c8d6e5; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:13px; display:flex; gap:24px; flex-wrap:wrap; }
        .d150-declarante span strong { color:#0d3270; }
        .d150-section { margin-bottom:14px; }
        .d150-section-title { font-size:14px; font-weight:700; color:#0d3270; border-bottom:2px solid #0d3270; padding-bottom:4px; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
        .d150-section-title .dot { width:8px; height:8px; background:#0d3270; border-radius:50%; }
        .d150-table { width:100%; border-collapse:collapse; font-size:13px; }
        .d150-table th { background:#e8eef6; color:#0d3270; font-weight:600; padding:7px 10px; text-align:left; border:1px solid #c8d6e5; font-size:11px; text-transform:uppercase; letter-spacing:0.3px; }
        .d150-table td { padding:7px 10px; border:1px solid #e0e6ed; }
        .d150-table td.num { text-align:right; font-family:'JetBrains Mono','Consolas',monospace; font-size:12px; }
        .d150-table tr.subtotal td { font-weight:600; background:#f7f9fc; border-top:2px solid #c8d6e5; }
        .d150-table tr.total-row td { font-weight:700; background:#e8eef6; border-top:2px solid #0d3270; font-size:14px; }
        .d150-resumen { background:#f7f9fc; border:1px solid #c8d6e5; border-radius:4px; padding:14px 16px; }
        .d150-resumen-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:13px; border-bottom:1px dotted #d0d8e4; }
        .d150-resumen-row:last-child { border-bottom:none; }
        .d150-resumen-row .label { color:#555; }
        .d150-resumen-row .value { font-family:'JetBrains Mono','Consolas',monospace; font-weight:600; }
        .d150-result { margin-top:10px; padding:12px 16px; border-radius:4px; font-weight:700; font-size:15px; display:flex; justify-content:space-between; align-items:center; }
        .d150-result.pagar { background:#fff3f0; border:2px solid #c0392b; color:#c0392b; }
        .d150-result.favor { background:#f0fff4; border:2px solid #27ae60; color:#27ae60; }
        .d150-footer { font-size:11px; color:#888; text-align:center; padding:10px; border-top:1px solid #e0e6ed; }
      </style>
      <div class="d150-form">
        <div class="d150-header">
          <h2>FORMULARIO D-150</h2>
          <div class="d150-periodo">Declaración de IVA · ${mesNombre} ${anio}</div>
        </div>
        <div class="d150-body">
          <div class="d150-declarante">
            <span><strong>Declarante:</strong> BATISTA VARGAS CESAR ANDRES</span>
            <span><strong>Cédula:</strong> 2-0539-0118</span>
            <span><strong>Período:</strong> ${mesNombre} ${anio}</span>
          </div>

          <!-- VENTAS -->
          <div class="d150-section">
            <div class="d150-section-title"><span class="dot"></span> VENTAS DEL PERÍODO</div>
            <table class="d150-table">
              <thead>
                <tr><th>Concepto</th><th class="num">Base Imponible</th><th class="num">IVA</th><th class="num">Total</th></tr>
              </thead>
              <tbody>
                ${TARIFAS.filter(t => t !== '0').map(t => `
                  <tr>
                    <td>Gravadas al ${t}%</td>
                    <td class="num">${formatColones(v(t).base)}</td>
                    <td class="num">${formatColones(v(t).iva)}</td>
                    <td class="num">${formatColones(v(t).total)}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td>Exentas (0%)</td>
                  <td class="num">${formatColones(v('0').base)}</td>
                  <td class="num">₡0</td>
                  <td class="num">${formatColones(v('0').base)}</td>
                </tr>
                <tr class="subtotal">
                  <td>TOTAL VENTAS</td>
                  <td class="num">${formatColones(totalVentasBase)}</td>
                  <td class="num">${formatColones(totalVentasIVA)}</td>
                  <td class="num">${formatColones(totalVentasBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- COMPRAS -->
          <div class="d150-section">
            <div class="d150-section-title"><span class="dot"></span> COMPRAS DEL PERÍODO</div>
            <table class="d150-table">
              <thead>
                <tr><th>Concepto</th><th class="num">Base Imponible</th><th class="num">IVA</th><th class="num">Total</th></tr>
              </thead>
              <tbody>
                ${TARIFAS.filter(t => t !== '0').map(t => `
                  <tr>
                    <td>Gravadas al ${t}%</td>
                    <td class="num">${formatColones(c(t).base)}</td>
                    <td class="num">${formatColones(c(t).iva)}</td>
                    <td class="num">${formatColones(c(t).total)}</td>
                  </tr>
                `).join('')}
                <tr>
                  <td>Exentas (0%)</td>
                  <td class="num">${formatColones(c('0').base)}</td>
                  <td class="num">₡0</td>
                  <td class="num">${formatColones(c('0').base)}</td>
                </tr>
                <tr class="subtotal">
                  <td>TOTAL COMPRAS</td>
                  <td class="num">${formatColones(totalComprasBase)}</td>
                  <td class="num">${formatColones(totalComprasIVA)}</td>
                  <td class="num">${formatColones(totalComprasBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- RESUMEN -->
          <div class="d150-section">
            <div class="d150-section-title"><span class="dot"></span> RESUMEN — DETERMINACIÓN DEL IVA</div>
            <div class="d150-resumen">
              <div class="d150-resumen-row">
                <span class="label">(+) Débito Fiscal (IVA cobrado en ventas)</span>
                <span class="value" style="color:#27ae60;">${formatColones(calc.debitoFiscal)}</span>
              </div>
              <div class="d150-resumen-row">
                <span class="label">(-) Crédito Fiscal (IVA pagado en compras deducibles)</span>
                <span class="value" style="color:#c0392b;">${formatColones(calc.creditoFiscal)}</span>
              </div>
              ${saldoAnterior > 0 ? `
              <div class="d150-resumen-row">
                <span class="label">(-) Saldo a favor período anterior (${MESES[prevMes - 1]})</span>
                <span class="value" style="color:#c0392b;">${formatColones(saldoAnterior)}</span>
              </div>
              ` : ''}
              ${calc.factorProporcionalidad < 1 ? `
              <div class="d150-resumen-row">
                <span class="label" style="font-size:11px;">Factor proporcionalidad: ${(calc.factorProporcionalidad * 100).toFixed(2)}%</span>
                <span class="value" style="font-size:11px;opacity:0.7;">Crédito ajustado</span>
              </div>
              ` : ''}
              <div class="d150-result ${ivaPagar > 0 ? 'pagar' : 'favor'}">
                <span>${ivaPagar > 0 ? '💳 IVA A PAGAR' : '✅ SALDO A FAVOR'}</span>
                <span>${formatColones(ivaPagar > 0 ? ivaPagar : saldoFavor)}</span>
              </div>
            </div>
          </div>
        </div>
        <div class="d150-footer">
          Réplica visual para referencia — Completá estos valores en TRIBU-CR · Fecha límite: 15 de ${MESES[mes % 12]} ${mes === 12 ? anio + 1 : anio}
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

  // ─── D-101 REPLICA ────────────────────────────────────────

  function renderD101Replica(resultDiv, calc, ctx) {
    const { selAnio, usarDeduccionUnica } = ctx;
    const parciales = calcularPagosParciales(calc.impuestoNeto, selAnio + 1);

    resultDiv.innerHTML = `
      <style>
        .d101-form { background:#fff; border:2px solid #1a3a6b; border-radius:6px; overflow:hidden; font-family:'Inter',-apple-system,sans-serif; color:#1a1a1a; }
        .d101-header { background:linear-gradient(180deg,#5b2c6f,#4a235a); color:#fff; padding:14px 20px; display:flex; justify-content:space-between; align-items:center; }
        .d101-header h2 { margin:0; font-size:18px; font-weight:700; letter-spacing:0.5px; }
        .d101-header .d101-periodo { font-size:13px; opacity:0.9; }
        .d101-body { padding:16px 20px; }
        .d101-declarante { background:#f5f0f8; border:1px solid #d5c8e0; border-radius:4px; padding:10px 14px; margin-bottom:14px; font-size:13px; display:flex; gap:24px; flex-wrap:wrap; }
        .d101-declarante span strong { color:#4a235a; }
        .d101-section { margin-bottom:14px; }
        .d101-section-title { font-size:14px; font-weight:700; color:#4a235a; border-bottom:2px solid #4a235a; padding-bottom:4px; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
        .d101-section-title .dot { width:8px; height:8px; background:#4a235a; border-radius:50%; }
        .d101-table { width:100%; border-collapse:collapse; font-size:13px; }
        .d101-table th { background:#f0e8f6; color:#4a235a; font-weight:600; padding:7px 10px; text-align:left; border:1px solid #d5c8e0; font-size:11px; text-transform:uppercase; letter-spacing:0.3px; }
        .d101-table td { padding:7px 10px; border:1px solid #e8ddf0; }
        .d101-table td.num { text-align:right; font-family:'JetBrains Mono','Consolas',monospace; font-size:12px; }
        .d101-table tr.subtotal td { font-weight:600; background:#faf7fc; border-top:2px solid #d5c8e0; }
        .d101-resumen { background:#faf7fc; border:1px solid #d5c8e0; border-radius:4px; padding:14px 16px; }
        .d101-resumen-row { display:flex; justify-content:space-between; align-items:center; padding:6px 0; font-size:13px; border-bottom:1px dotted #e0d4ec; }
        .d101-resumen-row:last-child { border-bottom:none; }
        .d101-resumen-row .label { color:#555; }
        .d101-resumen-row .value { font-family:'JetBrains Mono','Consolas',monospace; font-weight:600; }
        .d101-result { margin-top:10px; padding:12px 16px; border-radius:4px; font-weight:700; font-size:15px; display:flex; justify-content:space-between; align-items:center; }
        .d101-result.pagar { background:#fff3f0; border:2px solid #c0392b; color:#c0392b; }
        .d101-result.favor { background:#f0fff4; border:2px solid #27ae60; color:#27ae60; }
        .d101-footer { font-size:11px; color:#888; text-align:center; padding:10px; border-top:1px solid #e0e6ed; }
        .d101-pagos { margin-top:12px; }
        .d101-pagos h4 { font-size:13px; color:#4a235a; margin:0 0 8px 0; }
        .d101-pago-item { display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:#f5f0f8; border-radius:4px; margin-bottom:4px; font-size:12px; }
        .d101-pago-item .cuota { font-weight:600; color:#4a235a; }
        .d101-pago-item .monto { font-family:'JetBrains Mono','Consolas',monospace; font-weight:600; }
      </style>
      <div class="d101-form">
        <div class="d101-header">
          <h2>FORMULARIO D-101</h2>
          <div class="d101-periodo">Declaración de Renta · Año fiscal ${selAnio}</div>
        </div>
        <div class="d101-body">
          <div class="d101-declarante">
            <span><strong>Declarante:</strong> BATISTA VARGAS CESAR ANDRES</span>
            <span><strong>Cédula:</strong> 2-0539-0118</span>
            <span><strong>Actividad:</strong> 9511.0 — Reparación de computadoras</span>
            <span><strong>Año fiscal:</strong> ${selAnio}</span>
          </div>

          <!-- INGRESOS Y DEDUCCIONES -->
          <div class="d101-section">
            <div class="d101-section-title"><span class="dot"></span> INGRESOS BRUTOS Y DEDUCCIONES</div>
            <table class="d101-table">
              <thead>
                <tr><th>Concepto</th><th class="num">Monto</th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>Ingresos brutos anuales (netos de IVA)</td>
                  <td class="num" style="color:#27ae60;">${formatColones(calc.ingresosBrutos)}</td>
                </tr>
                <tr>
                  <td>${calc.usarDeduccionUnica ? 'Deducción única (25% de ingresos brutos)' : 'Gastos deducibles del período'}</td>
                  <td class="num" style="color:#c0392b;">- ${formatColones(calc.deduccionAplicada)}</td>
                </tr>
                <tr class="subtotal">
                  <td>RENTA NETA GRAVABLE</td>
                  <td class="num">${formatColones(calc.rentaNeta)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- TRAMOS -->
          <div class="d101-section">
            <div class="d101-section-title"><span class="dot"></span> CÁLCULO DEL IMPUESTO POR TRAMOS</div>
            <table class="d101-table">
              <thead>
                <tr><th>Tramo</th><th class="num">Desde</th><th class="num">Hasta</th><th class="num">Tasa</th><th class="num">Impuesto</th></tr>
              </thead>
              <tbody>
                ${calc.desgloseTrmos.map(t => `
                  <tr>
                    <td>Tasa ${t.tasa}%</td>
                    <td class="num">${formatColones(t.desde)}</td>
                    <td class="num">${t.hasta === Infinity ? 'En adelante' : formatColones(t.hasta)}</td>
                    <td class="num">${t.tasa}%</td>
                    <td class="num">${formatColones(t.impuesto)}</td>
                  </tr>
                `).join('')}
                <tr class="subtotal">
                  <td colspan="4">IMPUESTO BRUTO</td>
                  <td class="num">${formatColones(calc.impuestoBruto)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- RESUMEN -->
          <div class="d101-section">
            <div class="d101-section-title"><span class="dot"></span> RESUMEN — DETERMINACIÓN DEL IMPUESTO</div>
            <div class="d101-resumen">
              <div class="d101-resumen-row">
                <span class="label">Impuesto bruto</span>
                <span class="value">${formatColones(calc.impuestoBruto)}</span>
              </div>
              ${calc.totalCreditos > 0 ? `
              <div class="d101-resumen-row">
                <span class="label">(-) Créditos fiscales acumulados</span>
                <span class="value" style="color:#c0392b;">- ${formatColones(calc.totalCreditos)}</span>
              </div>
              ` : ''}
              <div class="d101-result ${calc.impuestoNeto > 0 ? 'pagar' : 'favor'}">
                <span>${calc.impuestoNeto > 0 ? '💳 IMPUESTO NETO A PAGAR' : '✅ SALDO A FAVOR'}</span>
                <span>${formatColones(calc.impuestoNeto)}</span>
              </div>
              <div class="d101-resumen-row" style="margin-top:6px;">
                <span class="label" style="font-size:11px;">Tasa efectiva</span>
                <span class="value" style="font-size:11px;">${calc.tasaEfectiva.toFixed(2)}%</span>
              </div>
            </div>
          </div>

          <!-- PAGOS PARCIALES -->
          ${parciales.totalPagos > 0 ? `
          <div class="d101-pagos">
            <h4>📅 Pagos Parciales de Renta ${selAnio + 1}</h4>
            ${parciales.pagos.map(p => `
              <div class="d101-pago-item">
                <span class="cuota">Cuota ${p.mesNombre}</span>
                <span style="font-size:11px;color:#888;">Vence: ${p.fecha_limite}</span>
                <span class="monto">${formatColones(p.monto)}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}
        </div>
        <div class="d101-footer">
          Réplica visual para referencia — Completá estos valores en TRIBU-CR · Fecha límite: 15 de Marzo de ${selAnio + 1}
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
