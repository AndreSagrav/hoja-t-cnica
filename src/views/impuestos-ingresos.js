// ============================================================
// INNOVIO Tax Module — Ingresos View (Premium Redesign)
// Income management powered by local XML data
// ============================================================

import { ensureShell } from '../components/shell.js';
import { IVA_RATES, formatColones, MESES, mesActual, calcularMontos } from '../lib/tax-engine.js';
import { parseXMLFile, clasificarComprobante } from '../lib/xml-parser.js';
import { fetchTaxData, invalidateTaxCache } from '../lib/tax-data.js';
import { toast } from '../lib/utils.js';

export async function impuestosIngresosView() {
  const shell = ensureShell('/impuestos/ingresos');
  shell.setTitle('Ingresos');
  shell.setActions(`
    <button class="bf-btn bf-btn-primary" id="btn-subir-xml-ing" style="height:34px;padding:0 16px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;border:none;font-family:var(--font);background:var(--grad-accent);color:white;box-shadow:0 2px 8px rgba(0,194,168,0.25);">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
        .ing-container { padding: 16px 20px; max-width: 1280px; }
        
        /* KPI row */
        .ing-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
        .ing-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px 14px; position: relative; overflow: hidden; transition: all 0.2s var(--ease-out); }
        .ing-kpi:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .ing-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .ing-kpi:nth-child(1)::before { background: linear-gradient(90deg, #1b5e20, #4caf50); }
        .ing-kpi:nth-child(2)::before { background: var(--grad-accent); }
        .ing-kpi:nth-child(3)::before { background: var(--grad-navy); }
        .ing-kpi-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-soft); margin-bottom: 4px; }
        .ing-kpi-value { font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; line-height: 1; }
        .ing-kpi:nth-child(1) .ing-kpi-value { color: #1b5e20; }
        .ing-kpi-sub { font-size: 9px; color: var(--text-soft); margin-top: 3px; }
        
        /* Toolbar */
        .ing-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .ing-select { height: 32px; padding: 0 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); font-size: 11px; font-family: var(--font); color: var(--text); cursor: pointer; outline: none; transition: all 0.2s; }
        .ing-select:focus { border-color: var(--accent); box-shadow: var(--focus); }
        .ing-search { flex: 1; min-width: 160px; height: 32px; padding: 0 12px 0 32px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); font-size: 11px; font-family: var(--font); color: var(--text); outline: none; transition: all 0.2s; }
        .ing-search:focus { border-color: var(--accent); box-shadow: var(--focus); }
        .ing-search-wrap { flex: 1; position: relative; min-width: 160px; }
        .ing-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); pointer-events: none; }
        .ing-count { font-size: 10px; color: var(--text-soft); font-weight: 600; white-space: nowrap; }
        
        /* Table */
        .ing-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow-x: auto; }
        .ing-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .ing-table thead th { padding: 8px 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-soft); background: var(--surface-2); text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ing-table thead th.col-r { text-align: right; }
        .ing-table tbody tr { transition: background 0.15s; }
        .ing-table tbody tr:hover { background: rgba(27,94,32,0.03); }
        .ing-table tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border-light); }
        .ing-table td { padding: 8px 12px; font-size: 12px; color: var(--text); vertical-align: middle; }
        .ing-table td.col-r { text-align: right; }
        
        .ing-entity { font-weight: 600; color: var(--text); display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ing-desc { font-size: 10px; color: var(--text-soft); display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .ing-amount { font-size: 13px; font-weight: 800; color: #1b5e20; letter-spacing: -0.3px; }
        .ing-iva-sm { font-size: 10px; color: var(--text-soft); display: block; margin-top: 1px; }
        .ing-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 20px; font-size: 9px; font-weight: 700; background: rgba(27,94,32,0.08); color: #1b5e20; }
        .ing-tipo-doc { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; background: var(--bg-subtle); color: var(--text-mid); }
        
        /* Empty */
        .ing-empty { text-align: center; padding: 40px 20px; }
        .ing-empty-icon { width: 48px; height: 48px; border-radius: var(--r-lg); background: linear-gradient(135deg, rgba(27,94,32,0.08), rgba(27,94,32,0.16)); display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px; }
        .ing-empty h3 { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
        .ing-empty p { font-size: 11px; color: var(--text-soft); margin: 0 0 16px; max-width: 320px; margin-left: auto; margin-right: auto; }
        .ing-empty-btn { height: 34px; padding: 0 20px; border-radius: var(--r-md); font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-mid); font-family: var(--font); transition: all 0.2s; }
        .ing-empty-btn:hover { border-color: #1b5e20; color: #1b5e20; background: rgba(27,94,32,0.04); }
        
        @media (max-width: 768px) {
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
            <div class="ing-kpi-label">Promedio/Factura</div>
            <div class="ing-kpi-value">${formatColones(ingresos.length > 0 ? totalBruto / ingresos.length : 0)}</div>
            <div class="ing-kpi-sub">Facturación promedio del período</div>
          </div>
          <div class="ing-kpi">
            <div class="ing-kpi-label">Total Bruto</div>
            <div class="ing-kpi-value">${formatColones(totalBruto)}</div>
            <div class="ing-kpi-sub">Facturación total ${filterMes === 0 ? 'Todo el año' : MESES[filterMes - 1]} ${filterAnio}</div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="ing-toolbar">
          <select id="filter-mes" class="ing-select">
            <option value="0" ${filterMes === 0 ? 'selected' : ''}>Todos los meses</option>
            ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === filterMes ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="filter-anio" class="ing-select">
            ${[anio - 1, anio, anio + 1].map(y => `<option value="${y}" ${y === filterAnio ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <div class="ing-search-wrap">
            <span class="ing-search-icon">🔍</span>
            <input type="text" class="ing-search" id="ing-search" autocomplete="off" spellcheck="false" placeholder="Buscar cliente, descripción, monto...">
          </div>
          <span class="ing-count">${filtered.length} de ${ingresos.length}</span>
        </div>

        <!-- Content -->
        ${filtered.length === 0 ? `
          <div class="ing-empty">
            <div class="ing-empty-icon">📈</div>
            <h3>${ingresos.length === 0 ? (filterMes === 0 ? 'Sin ingresos en ' + filterAnio : 'Sin ingresos en ' + MESES[filterMes - 1]) : 'Sin resultados'}</h3>
            <p>${ingresos.length === 0 
              ? 'Las facturas de ventas que emitás aparecerán aquí automáticamente cuando las importe el sistema desde tu correo.' 
              : 'Probá con otro término de búsqueda.'}</p>
            ${ingresos.length === 0 ? `<button class="ing-empty-btn" id="btn-change-month">← Probar otro mes</button>` : ''}
          </div>
        ` : `
          <div class="ing-table-wrap">
            <table class="ing-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Doc</th>
                  <th>Cliente / Descripción</th>
                  <th>IVA%</th>
                  <th class="col-r">Neto</th>
                  <th class="col-r">IVA</th>
                  <th class="col-r">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(ing => {
                  const fecha = ing.fecha ? new Date(ing.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '—';
                  return `
                    <tr>
                      <td style="white-space:nowrap;color:var(--text-mid);font-size:11px;">${fecha}</td>
                      <td><span class="ing-tipo-doc">FE</span></td>
                      <td>
                        <span class="ing-entity">${esc(ing.cliente || ing.descripcion || '—')}</span>
                        ${ing.cliente && ing.descripcion ? `<span class="ing-desc">${esc(ing.descripcion)}</span>` : ''}
                      </td>
                      <td style="font-size:11px;color:var(--text-mid);">${ing.tarifa_iva}%</td>
                      <td class="col-r" style="font-size:12px;color:var(--text-mid);">${formatColones(ing.monto_neto)}</td>
                      <td class="col-r" style="font-size:12px;color:var(--accent-dark);">${formatColones(ing.monto_iva)}</td>
                      <td class="col-r">
                        <span class="ing-amount">+${formatColones(ing.monto_bruto)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:var(--surface-2);border-top:2px solid var(--border);">
                  <td colspan="4" style="padding:12px 14px;font-size:11px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;">
                    Totales ${filterMes === 0 ? filterAnio : MESES[filterMes - 1] + ' ' + filterAnio}
                  </td>
                  <td class="col-r" style="padding:12px 14px;font-size:12px;font-weight:700;color:var(--text);">${formatColones(totalNeto)}</td>
                  <td class="col-r" style="padding:12px 14px;font-size:12px;font-weight:700;color:var(--accent-dark);">${formatColones(totalIVA)}</td>
                  <td class="col-r" style="padding:12px 14px;">
                    <span style="font-size:15px;font-weight:800;color:#1b5e20;">+${formatColones(totalBruto)}</span>
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
      // Go to previous month
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
