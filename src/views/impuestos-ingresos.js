// ============================================================
// INNOVIO Tax Module — Ingresos View (Executive Premium Edition)
// Income management powered by local XML data & Supabase Cloud
// ============================================================

import { ensureShell } from '../components/shell.js';
import { IVA_RATES, formatColones, MESES, mesActual, calcularMontos } from '../lib/tax-engine.js';
import { parseXMLFile, clasificarComprobante } from '../lib/xml-parser.js';
import { fetchTaxData, invalidateTaxCache } from '../lib/tax-data.js';
import { toast } from '../lib/utils.js';

export async function impuestosIngresosView() {
  const shell = ensureShell('/impuestos/ingresos');
  shell.setTitle('Ingresos y Facturación Emitida');
  shell.setActions(`
    <button class="bf-btn bf-btn-primary" id="btn-subir-xml-ing" style="height:36px;padding:0 18px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;border:none;font-family:var(--font);background:linear-gradient(135deg,#00b894,#00cec9);color:white;box-shadow:0 3px 12px rgba(0,184,148,0.28);transition:all 0.2s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Subir XML
    </button>
  `);

  const content = shell.content();
  const { mes, anio } = mesActual();
  const initHash = window.location.hash;

  let filterMes = mes;
  let filterAnio = anio;
  let ingresos = [];
  let searchQuery = '';

  render();

  async function loadData(force = false) {
    try {
      const data = await fetchTaxData(filterAnio, filterMes, force);
      ingresos = data.ingresosMes;
    } catch {
      ingresos = [];
    }
    render();
  }

  function render() {
    if (window.location.hash !== initHash) return;

    const totalBruto = ingresos.reduce((s, i) => s + Number(i.monto_bruto || 0), 0);
    const totalIVA = ingresos.reduce((s, i) => s + Number(i.monto_iva || 0), 0);
    const totalNeto = ingresos.reduce((s, i) => s + Number(i.monto_neto || 0), 0);

    // Apply search
    let filtered = ingresos;
    if (searchQuery) {
      filtered = ingresos.filter(i => {
        const hay = [i.descripcion, i.cliente, String(i.monto_bruto), i.xml_clave].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(searchQuery);
      });
    }

    content.innerHTML = `
      <style>
        .ing-container { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }
        
        /* KPI Cards */
        .ing-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .ing-kpi { 
          background: var(--surface, #ffffff); 
          border: 1px solid var(--border, #e5e7eb); 
          border-radius: 12px; 
          padding: 16px 18px; 
          position: relative; 
          overflow: hidden; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s; 
        }
        .ing-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
        .ing-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3.5px; }
        .ing-kpi:nth-child(1)::before { background: linear-gradient(90deg, #10b981, #059669); }
        .ing-kpi:nth-child(2)::before { background: linear-gradient(90deg, #06b6d4, #0284c7); }
        .ing-kpi:nth-child(3)::before { background: linear-gradient(90deg, #6366f1, #4f46e5); }
        .ing-kpi:nth-child(4)::before { background: linear-gradient(90deg, #10b981, #14b8a6); }
        
        .ing-kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: var(--text-soft, #6b7280); margin-bottom: 6px; }
        .ing-kpi-value { font-size: 22px; font-weight: 800; color: var(--text, #111827); letter-spacing: -0.5px; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .ing-kpi:nth-child(1) .ing-kpi-value { color: #059669; }
        .ing-kpi:nth-child(4) .ing-kpi-value { color: #047857; }
        .ing-kpi-sub { font-size: 11px; color: var(--text-soft, #6b7280); margin-top: 5px; font-weight: 500; }
        
        /* Toolbar */
        .ing-toolbar { 
          display: flex; 
          align-items: center; 
          gap: 12px; 
          margin-bottom: 16px; 
          background: var(--surface, #ffffff);
          padding: 10px 14px;
          border-radius: 12px;
          border: 1px solid var(--border, #e5e7eb);
          box-shadow: 0 1px 2px rgba(0,0,0,0.03);
          flex-wrap: wrap; 
        }
        .ing-select { 
          height: 36px; 
          padding: 0 12px; 
          border-radius: 8px; 
          border: 1px solid var(--border, #d1d5db); 
          background: var(--surface, #ffffff); 
          font-size: 12px; 
          font-weight: 600;
          font-family: var(--font); 
          color: var(--text, #1f2937); 
          cursor: pointer; 
          outline: none; 
          transition: all 0.2s; 
        }
        .ing-select:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
        .ing-search-wrap { flex: 1; position: relative; min-width: 220px; }
        .ing-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; display: flex; align-items: center; }
        .ing-search { 
          width: 100%; 
          height: 36px; 
          padding: 0 14px 0 36px; 
          border-radius: 8px; 
          border: 1px solid var(--border, #d1d5db); 
          background: var(--surface, #ffffff); 
          font-size: 12px; 
          font-family: var(--font); 
          color: var(--text, #1f2937); 
          outline: none; 
          transition: all 0.2s; 
        }
        .ing-search:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,0.15); }
        .ing-count { font-size: 12px; color: var(--text-soft, #6b7280); font-weight: 600; white-space: nowrap; padding-right: 4px; }
        
        /* Table Wrap */
        .ing-table-wrap { 
          background: var(--surface, #ffffff); 
          border: 1px solid var(--border, #e5e7eb); 
          border-radius: 12px; 
          overflow-x: auto; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .ing-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .ing-table thead th { 
          padding: 12px 16px; 
          font-size: 11px; 
          font-weight: 700; 
          text-transform: uppercase; 
          letter-spacing: 0.6px; 
          color: var(--text-soft, #4b5563); 
          background: #f9fafb; 
          text-align: left; 
          border-bottom: 1px solid var(--border, #e5e7eb); 
          white-space: nowrap; 
        }
        .ing-table thead th.col-r { text-align: right; }
        .ing-table tbody tr { transition: background 0.15s ease; }
        .ing-table tbody tr:hover { background: rgba(16,185,129,0.035); }
        .ing-table tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border-light, #f3f4f6); }
        .ing-table td { padding: 14px 16px; font-size: 13px; color: var(--text, #1f2937); vertical-align: top; }
        .ing-table td.col-r { text-align: right; }
        
        /* Text Columns with No Cutoff & Separate Columns */
        .ing-client-cell { font-weight: 600; color: var(--text, #111827); line-height: 1.4; word-break: break-word; min-width: 200px; max-width: 320px; }
        .ing-desc-cell { font-size: 12px; color: var(--text-mid, #4b5563); line-height: 1.45; word-break: break-word; min-width: 240px; max-width: 440px; }
        .ing-tipo-doc { 
          display: inline-block;
          padding: 3px 8px; 
          border-radius: 6px; 
          font-size: 10px; 
          font-weight: 700; 
          letter-spacing: 0.5px; 
          background: #eef2ff; 
          color: #4338ca; 
          border: 1px solid #e0e7ff;
        }
        .ing-iva-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #d1fae5;
          white-space: nowrap;
        }
        .ing-amount { font-size: 14px; font-weight: 800; color: #047857; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
        .ing-num { font-variant-numeric: tabular-nums; font-weight: 500; }
        
        /* Empty State */
        .ing-empty { text-align: center; padding: 56px 20px; }
        .ing-empty-icon { 
          width: 56px; 
          height: 56px; 
          border-radius: 16px; 
          background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.2)); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 26px; 
          margin: 0 auto 14px; 
          color: #059669;
        }
        .ing-empty h3 { font-size: 16px; font-weight: 700; color: var(--text, #111827); margin: 0 0 6px; }
        .ing-empty p { font-size: 13px; color: var(--text-soft, #6b7280); margin: 0 0 20px; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.5; }
        .ing-empty-btn { 
          height: 38px; 
          padding: 0 22px; 
          border-radius: 8px; 
          font-size: 12px; 
          font-weight: 600; 
          cursor: pointer; 
          border: 1px solid var(--border, #d1d5db); 
          background: var(--surface, #ffffff); 
          color: var(--text, #374151); 
          font-family: var(--font); 
          transition: all 0.2s; 
        }
        .ing-empty-btn:hover { border-color: #10b981; color: #059669; background: #ecfdf5; }
        
        @media (max-width: 900px) {
          .ing-kpi-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .ing-kpi-row { grid-template-columns: 1fr; }
          .ing-container { padding: 12px; }
        }
      </style>

      <div class="ing-container">
        <!-- KPI Cards -->
        <div class="ing-kpi-row">
          <div class="ing-kpi">
            <div class="ing-kpi-label">Ventas Netas</div>
            <div class="ing-kpi-value">${formatColones(totalNeto)}</div>
            <div class="ing-kpi-sub">${ingresos.length} factura${ingresos.length !== 1 ? 's' : ''} emitidas</div>
          </div>
          <div class="ing-kpi">
            <div class="ing-kpi-label">IVA Cobrado</div>
            <div class="ing-kpi-value">${formatColones(totalIVA)}</div>
            <div class="ing-kpi-sub">Débito fiscal del mes</div>
          </div>
          <div class="ing-kpi">
            <div class="ing-kpi-label">Promedio / Factura</div>
            <div class="ing-kpi-value">${formatColones(ingresos.length > 0 ? totalBruto / ingresos.length : 0)}</div>
            <div class="ing-kpi-sub">Facturación promedio del período</div>
          </div>
          <div class="ing-kpi">
            <div class="ing-kpi-label">Total Bruto Facturado</div>
            <div class="ing-kpi-value">${formatColones(totalBruto)}</div>
            <div class="ing-kpi-sub">Total ${filterMes === 0 ? 'Año ' + filterAnio : MESES[filterMes - 1] + ' ' + filterAnio}</div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="ing-toolbar">
          <select id="filter-mes" class="ing-select">
            <option value="0" ${filterMes === 0 ? 'selected' : ''}>Todos los meses</option>
            ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === filterMes ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="filter-anio" class="ing-select">
            ${[anio - 3, anio - 2, anio - 1, anio, anio + 1].map(y => `<option value="${y}" ${y === filterAnio ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <div class="ing-search-wrap">
            <span class="ing-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input type="text" class="ing-search" id="ing-search" autocomplete="off" spellcheck="false" placeholder="Buscar por cliente, descripción del servicio, monto o clave...">
          </div>
          <span class="ing-count">${filtered.length} de ${ingresos.length} comprobantes</span>
        </div>

        <!-- Content -->
        ${filtered.length === 0 ? `
          <div class="ing-empty">
            <div class="ing-empty-icon">📈</div>
            <h3>${ingresos.length === 0 ? (filterMes === 0 ? 'Sin ingresos registrados en ' + filterAnio : 'Sin ingresos en ' + MESES[filterMes - 1] + ' ' + filterAnio) : 'Sin resultados para la búsqueda'}</h3>
            <p>${ingresos.length === 0 
              ? 'Las facturas electrónicas de venta que emitás aparecerán aquí detalladas automáticamente con su cliente y desglose fiscal.' 
              : 'Probá buscando con otro nombre de cliente, término de servicio o monto.'}</p>
            ${ingresos.length === 0 ? `<button class="ing-empty-btn" id="btn-change-month">← Ver mes anterior</button>` : ''}
          </div>
        ` : `
          <div class="ing-table-wrap">
            <table class="ing-table">
              <thead>
                <tr>
                  <th style="width:90px;">Fecha</th>
                  <th style="width:70px;">Doc</th>
                  <th>Cliente (Receptor)</th>
                  <th>Descripción del Servicio / Producto</th>
                  <th style="width:80px;text-align:center;">IVA %</th>
                  <th class="col-r" style="width:130px;">Neto</th>
                  <th class="col-r" style="width:110px;">IVA</th>
                  <th class="col-r" style="width:140px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(ing => {
                  const fecha = ing.fecha ? new Date(ing.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                  const clienteNombre = ing.cliente || 'Cliente General';
                  const descripcion = ing.descripcion || 'Servicios profesionales';
                  return `
                    <tr>
                      <td style="white-space:nowrap;color:var(--text-soft,#6b7280);font-size:12px;font-weight:600;">${fecha}</td>
                      <td><span class="ing-tipo-doc">FE</span></td>
                      <td>
                        <div class="ing-client-cell">${esc(clienteNombre)}</div>
                      </td>
                      <td>
                        <div class="ing-desc-cell">${esc(descripcion)}</div>
                      </td>
                      <td style="text-align:center;">
                        <span class="ing-iva-badge">${ing.tarifa_iva || 13}%</span>
                      </td>
                      <td class="col-r">
                        <span class="ing-num" style="color:var(--text,#374151);font-weight:600;">${formatColones(ing.monto_neto)}</span>
                      </td>
                      <td class="col-r">
                        <span class="ing-num" style="color:#0284c7;font-weight:600;">${formatColones(ing.monto_iva)}</span>
                      </td>
                      <td class="col-r">
                        <span class="ing-amount">+${formatColones(ing.monto_bruto)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f9fafb;border-top:2px solid var(--border,#e5e7eb);">
                  <td colspan="5" style="padding:14px 16px;font-size:12px;font-weight:800;color:var(--text,#1f2937);text-transform:uppercase;letter-spacing:0.75px;">
                    Totales ${filterMes === 0 ? 'Año ' + filterAnio : MESES[filterMes - 1] + ' ' + filterAnio}
                  </td>
                  <td class="col-r" style="padding:14px 16px;font-size:13px;font-weight:700;color:var(--text,#1f2937);">${formatColones(totalNeto)}</td>
                  <td class="col-r" style="padding:14px 16px;font-size:13px;font-weight:700;color:#0284c7;">${formatColones(totalIVA)}</td>
                  <td class="col-r" style="padding:14px 16px;">
                    <span style="font-size:16px;font-weight:800;color:#047857;">+${formatColones(totalBruto)}</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        `}
      </div>
    `;

    // Events
    content.querySelector('#filter-mes')?.addEventListener('change', e => {
      filterMes = Number(e.target.value);
      loadData();
    });
    content.querySelector('#filter-anio')?.addEventListener('change', e => {
      filterAnio = Number(e.target.value);
      loadData();
    });
    content.querySelector('#ing-search')?.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase();
      render();
    });
    content.querySelector('#btn-change-month')?.addEventListener('click', () => {
      filterMes = filterMes > 1 ? filterMes - 1 : 12;
      if (filterMes === 12) filterAnio--;
      loadData();
    });
  }

  // XML Upload
  function handleXMLUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.multiple = true;
    input.onchange = async (e) => {
      let count = 0;
      for (const file of e.target.files) {
        try {
          const xmlContent = await file.text();
          await fetch('/api/facturas/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, content: xmlContent })
          });
          count++;
        } catch (err) {
          toast(`Error: ${file.name}`, 'error');
        }
      }
      if (count > 0) {
        toast(`✅ ${count} archivo${count > 1 ? 's' : ''} importado${count > 1 ? 's' : ''}`, 'success');
        invalidateTaxCache();
        loadData(true);
      }
    };
    input.click();
  }

  document.getElementById('btn-subir-xml-ing')?.addEventListener('click', handleXMLUpload);
  loadData(true);
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
