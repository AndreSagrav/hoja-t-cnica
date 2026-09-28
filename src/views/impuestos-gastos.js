// ============================================================
// INNOVIO Tax Module — Gastos View (Executive Premium Edition)
// Expense & fiscal credit management with local & cloud XML sync
// ============================================================

import { ensureShell } from '../components/shell.js';
import { IVA_RATES, formatColones, MESES, mesActual, calcularMontos } from '../lib/tax-engine.js';
import { parseXMLFile, clasificarComprobante } from '../lib/xml-parser.js';
import { fetchTaxData, invalidateTaxCache, updateTaxMetadata } from '../lib/tax-data.js';
import { toast } from '../lib/utils.js';

export async function impuestosGastosView() {
  const shell = ensureShell('/impuestos/gastos');
  shell.setTitle('Gastos y Facturas de Compras');
  shell.setActions(`
    <button class="bf-btn bf-btn-primary" id="btn-subir-xml-gasto" style="height:36px;padding:0 18px;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:8px;border:none;font-family:var(--font);background:linear-gradient(135deg,#ef4444,#dc2626);color:white;box-shadow:0 3px 12px rgba(239,68,68,0.28);transition:all 0.2s;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      Subir XML
    </button>
  `);

  const content = shell.content();
  const { mes, anio } = mesActual();
  const initHash = window.location.hash;

  let filterMes = mes;
  let filterAnio = anio;
  let gastos = [];
  let searchQuery = '';

  render();

  async function loadData(force = false) {
    try {
      const data = await fetchTaxData(filterAnio, filterMes, force);
      gastos = data.gastosMes;
    } catch {
      gastos = [];
    }
    render();
  }

  function render() {
    if (window.location.hash !== initHash) return;

    const totalBruto = gastos.reduce((s, g) => s + Number(g.monto_bruto || 0), 0);
    const totalIVA = gastos.reduce((s, g) => s + Number(g.monto_iva || 0), 0);
    const totalNeto = gastos.reduce((s, g) => s + Number(g.monto_neto || 0), 0);
    const deducibles = gastos.filter(g => g.deducible !== false);
    const ivaDeducible = deducibles.reduce((s, g) => s + Number(g.monto_iva || 0), 0);

    // Apply search
    let filtered = gastos;
    if (searchQuery) {
      filtered = gastos.filter(g => {
        const hay = [g.descripcion, g.proveedor, String(g.monto_bruto), g.xml_clave].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(searchQuery);
      });
    }

    content.innerHTML = `
      <style>
        .gst-container { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }
        
        /* KPI Cards */
        .gst-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 18px; }
        .gst-kpi { 
          background: var(--surface, #ffffff); 
          border: 1px solid var(--border, #e5e7eb); 
          border-radius: 12px; 
          padding: 16px 18px; 
          position: relative; 
          overflow: hidden; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
          transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.2s; 
        }
        .gst-kpi:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.06); }
        .gst-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3.5px; }
        .gst-kpi:nth-child(1)::before { background: linear-gradient(90deg, #ef4444, #dc2626); }
        .gst-kpi:nth-child(2)::before { background: linear-gradient(90deg, #f59e0b, #d97706); }
        .gst-kpi:nth-child(3)::before { background: linear-gradient(90deg, #6366f1, #4f46e5); }
        .gst-kpi:nth-child(4)::before { background: linear-gradient(90deg, #10b981, #059669); }
        
        .gst-kpi-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.75px; color: var(--text-soft, #6b7280); margin-bottom: 6px; }
        .gst-kpi-value { font-size: 22px; font-weight: 800; color: var(--text, #111827); letter-spacing: -0.5px; line-height: 1.2; font-variant-numeric: tabular-nums; }
        .gst-kpi:nth-child(1) .gst-kpi-value { color: #dc2626; }
        .gst-kpi:nth-child(4) .gst-kpi-value { color: #059669; }
        .gst-kpi-sub { font-size: 11px; color: var(--text-soft, #6b7280); margin-top: 5px; font-weight: 500; }
        
        /* Toolbar */
        .gst-toolbar { 
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
        .gst-select { 
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
        .gst-select:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
        .gst-search-wrap { flex: 1; position: relative; min-width: 220px; }
        .gst-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #9ca3af; pointer-events: none; display: flex; align-items: center; }
        .gst-search { 
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
        .gst-search:focus { border-color: #ef4444; box-shadow: 0 0 0 3px rgba(239,68,68,0.15); }
        .gst-count { font-size: 12px; color: var(--text-soft, #6b7280); font-weight: 600; white-space: nowrap; padding-right: 4px; }
        
        /* Table Wrap */
        .gst-table-wrap { 
          background: var(--surface, #ffffff); 
          border: 1px solid var(--border, #e5e7eb); 
          border-radius: 12px; 
          overflow-x: auto; 
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .gst-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .gst-table thead th { 
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
        .gst-table thead th.col-r { text-align: right; }
        .gst-table tbody tr { transition: background 0.15s ease; }
        .gst-table tbody tr:hover { background: rgba(239,68,68,0.03); }
        .gst-table tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border-light, #f3f4f6); }
        .gst-table td { padding: 14px 16px; font-size: 13px; color: var(--text, #1f2937); vertical-align: top; }
        .gst-table td.col-r { text-align: right; }
        
        /* Dedicated Columns without text truncation */
        .gst-vendor-cell { font-weight: 600; color: var(--text, #111827); line-height: 1.4; word-break: break-word; min-width: 190px; max-width: 300px; }
        .gst-desc-cell { font-size: 12px; color: var(--text-mid, #4b5563); line-height: 1.45; word-break: break-word; min-width: 220px; max-width: 420px; }
        .gst-tipo-doc { 
          display: inline-block;
          padding: 3px 8px; 
          border-radius: 6px; 
          font-size: 10px; 
          font-weight: 700; 
          letter-spacing: 0.5px; 
          background: #f3f4f6; 
          color: #374151; 
          border: 1px solid #e5e7eb;
        }
        .gst-iva-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #dbeafe;
          white-space: nowrap;
        }
        .gst-deducible-btn { 
          display: inline-flex; 
          align-items: center; 
          gap: 4px; 
          padding: 3px 10px; 
          border-radius: 20px; 
          font-size: 11px; 
          font-weight: 700; 
          cursor: pointer;
          border: 1px solid transparent;
          transition: all 0.2s;
        }
        .gst-deducible-btn.si { background: #ecfdf5; color: #047857; border-color: #d1fae5; }
        .gst-deducible-btn.si:hover { background: #d1fae5; }
        .gst-deducible-btn.no { background: #fef2f2; color: #b91c1c; border-color: #fee2e2; }
        .gst-deducible-btn.no:hover { background: #fee2e2; }
        
        .gst-amount { font-size: 14px; font-weight: 800; color: #dc2626; letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
        .gst-num { font-variant-numeric: tabular-nums; font-weight: 500; }
        
        /* Empty State */
        .gst-empty { text-align: center; padding: 56px 20px; }
        .gst-empty-icon { 
          width: 56px; 
          height: 56px; 
          border-radius: 16px; 
          background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.2)); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 26px; 
          margin: 0 auto 14px; 
          color: #dc2626;
        }
        .gst-empty h3 { font-size: 16px; font-weight: 700; color: var(--text, #111827); margin: 0 0 6px; }
        .gst-empty p { font-size: 13px; color: var(--text-soft, #6b7280); margin: 0 0 20px; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.5; }
        .gst-empty-btn { 
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
        .gst-empty-btn:hover { border-color: #ef4444; color: #dc2626; background: #fef2f2; }
        
        @media (max-width: 900px) {
          .gst-kpi-row { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .gst-kpi-row { grid-template-columns: 1fr; }
          .gst-container { padding: 12px; }
        }
      </style>

      <div class="gst-container">
        <!-- KPI Cards -->
        <div class="gst-kpi-row">
          <div class="gst-kpi">
            <div class="gst-kpi-label">Total Gastos Bruto</div>
            <div class="gst-kpi-value">${formatColones(totalBruto)}</div>
            <div class="gst-kpi-sub">${gastos.length} comprobante${gastos.length !== 1 ? 's' : ''} registrados</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">IVA Pagado Total</div>
            <div class="gst-kpi-value">${formatColones(totalIVA)}</div>
            <div class="gst-kpi-sub">Crédito fiscal potencial</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">Compras Netas</div>
            <div class="gst-kpi-value">${formatColones(totalNeto)}</div>
            <div class="gst-kpi-sub">Base imponible sin IVA</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">IVA Crédito Deducible</div>
            <div class="gst-kpi-value">${formatColones(ivaDeducible)}</div>
            <div class="gst-kpi-sub">${deducibles.length} compras deducibles</div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="gst-toolbar">
          <select id="filter-mes" class="gst-select">
            <option value="0" ${filterMes === 0 ? 'selected' : ''}>Todos los meses</option>
            ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === filterMes ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="filter-anio" class="gst-select">
            ${[anio - 3, anio - 2, anio - 1, anio, anio + 1].map(y => `<option value="${y}" ${y === filterAnio ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <div class="gst-search-wrap">
            <span class="gst-search-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            </span>
            <input type="text" class="gst-search" id="gst-search" autocomplete="off" spellcheck="false" placeholder="Buscar por proveedor, descripción de compra, monto o clave...">
          </div>
          <span class="gst-count">${filtered.length} de ${gastos.length} comprobantes</span>
        </div>

        <!-- Content -->
        ${filtered.length === 0 ? `
          <div class="gst-empty">
            <div class="gst-empty-icon">🧾</div>
            <h3>${gastos.length === 0 ? (filterMes === 0 ? 'Sin gastos registrados en ' + filterAnio : 'Sin gastos en ' + MESES[filterMes - 1] + ' ' + filterAnio) : 'Sin resultados para la búsqueda'}</h3>
            <p>${gastos.length === 0 
              ? 'Las facturas electrónicas de compras recibidas de tus proveedores aparecerán aquí detalladas automáticamente con su desglose.'
              : 'Probá con otro término de búsqueda o proveedor.'}</p>
            ${gastos.length === 0 ? `<button class="gst-empty-btn" id="btn-change-month">← Ver mes anterior</button>` : ''}
          </div>
        ` : `
          <div class="gst-table-wrap">
            <table class="gst-table">
              <thead>
                <tr>
                  <th style="width:90px;">Fecha</th>
                  <th style="width:70px;">Doc</th>
                  <th>Proveedor (Emisor)</th>
                  <th>Detalle de Compra / Concepto</th>
                  <th style="width:80px;text-align:center;">IVA %</th>
                  <th style="width:95px;text-align:center;">Deducible</th>
                  <th class="col-r" style="width:130px;">Neto</th>
                  <th class="col-r" style="width:110px;">IVA</th>
                  <th class="col-r" style="width:140px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(g => {
                  const fecha = g.fecha ? new Date(g.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                  const ded = g.deducible !== false;
                  const proveedor = g.proveedor || 'Proveedor General';
                  const descripcion = g.descripcion || 'Compra de bienes o servicios';
                  return `
                    <tr>
                      <td style="white-space:nowrap;color:var(--text-soft,#6b7280);font-size:12px;font-weight:600;">${fecha}</td>
                      <td><span class="gst-tipo-doc">FE</span></td>
                      <td>
                        <div class="gst-vendor-cell">${esc(proveedor)}</div>
                      </td>
                      <td>
                        <div class="gst-desc-cell">${esc(descripcion)}</div>
                      </td>
                      <td style="text-align:center;">
                        <span class="gst-iva-badge">${g.tarifa_iva || 13}%</span>
                      </td>
                      <td style="text-align:center;">
                        <button class="gst-deducible-btn ${ded ? 'si' : 'no'}" data-id="${g.id}" data-deducible="${ded}" title="Clic para alternar deducibilidad fiscal">
                          ${ded ? '✓ Sí' : '✗ No'}
                        </button>
                      </td>
                      <td class="col-r">
                        <span class="gst-num" style="color:var(--text,#374151);font-weight:600;">${formatColones(g.monto_neto)}</span>
                      </td>
                      <td class="col-r">
                        <span class="gst-num" style="color:#f59e0b;font-weight:600;">${formatColones(g.monto_iva)}</span>
                      </td>
                      <td class="col-r">
                        <span class="gst-amount">${formatColones(g.monto_bruto)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:#f9fafb;border-top:2px solid var(--border,#e5e7eb);">
                  <td colspan="6" style="padding:14px 16px;font-size:12px;font-weight:800;color:var(--text,#1f2937);text-transform:uppercase;letter-spacing:0.75px;">
                    Totales ${filterMes === 0 ? 'Año ' + filterAnio : MESES[filterMes - 1] + ' ' + filterAnio}
                  </td>
                  <td class="col-r" style="padding:14px 16px;font-size:13px;font-weight:700;color:var(--text,#1f2937);">${formatColones(totalNeto)}</td>
                  <td class="col-r" style="padding:14px 16px;font-size:13px;font-weight:700;color:#f59e0b;">${formatColones(totalIVA)}</td>
                  <td class="col-r" style="padding:14px 16px;">
                    <span style="font-size:16px;font-weight:800;color:#dc2626;">${formatColones(totalBruto)}</span>
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
    content.querySelector('#gst-search')?.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase();
      render();
    });
    content.querySelector('#btn-change-month')?.addEventListener('click', () => {
      filterMes = filterMes > 1 ? filterMes - 1 : 12;
      if (filterMes === 12) filterAnio--;
      loadData();
    });

    // Deducible toggle
    content.querySelectorAll('.gst-deducible-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = btn.dataset.id;
        const current = btn.dataset.deducible === 'true';
        const next = !current;
        btn.disabled = true;
        btn.className = `gst-deducible-btn ${next ? 'si' : 'no'}`;
        btn.textContent = next ? '✓ Sí' : '✗ No';
        btn.dataset.deducible = String(next);
        
        // Update in memory
        const g = gastos.find(item => item.id === id);
        if (g) g.deducible = next;

        await updateTaxMetadata(id, { deducible: next });
        btn.disabled = false;
        render();
      });
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

  document.getElementById('btn-subir-xml-gasto')?.addEventListener('click', handleXMLUpload);
  loadData(true);
}

function esc(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
