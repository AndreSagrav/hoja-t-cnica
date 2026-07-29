// ============================================================
// INNOVIO Tax Module — Gastos View (Premium Redesign)
// Expense management powered by local XML data
// ============================================================

import { ensureShell } from '../components/shell.js';
import { IVA_RATES, formatColones, MESES, mesActual, calcularMontos } from '../lib/tax-engine.js';
import { parseXMLFile, clasificarComprobante } from '../lib/xml-parser.js';
import { fetchTaxData, invalidateTaxCache, updateTaxMetadata } from '../lib/tax-data.js';
import { toast } from '../lib/utils.js';

export async function impuestosGastosView() {
  const shell = ensureShell('/impuestos/gastos');
  shell.setTitle('Gastos');
  shell.setActions(`
    <button class="bf-btn bf-btn-primary" id="btn-subir-xml-gasto" style="height:34px;padding:0 16px;border-radius:12px;font-size:11px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;border:none;font-family:var(--font);background:linear-gradient(135deg,#c0392b,#e74c3c);color:white;box-shadow:0 2px 8px rgba(192,57,43,0.25);">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
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
        .gst-container { padding: 16px 20px; max-width: 1280px; }
        
        /* KPI row */
        .gst-kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
        .gst-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); padding: 12px 14px; position: relative; overflow: hidden; transition: all 0.2s var(--ease-out); }
        .gst-kpi:hover { box-shadow: var(--shadow-md); transform: translateY(-1px); }
        .gst-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; }
        .gst-kpi:nth-child(1)::before { background: linear-gradient(90deg, #c0392b, #e74c3c); }
        .gst-kpi:nth-child(2)::before { background: var(--grad-accent); }
        .gst-kpi:nth-child(3)::before { background: var(--grad-navy); }
        .gst-kpi:nth-child(4)::before { background: linear-gradient(90deg, #1b5e20, #4caf50); }
        .gst-kpi-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-soft); margin-bottom: 4px; }
        .gst-kpi-value { font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; line-height: 1; }
        .gst-kpi:nth-child(1) .gst-kpi-value { color: #c0392b; }
        .gst-kpi:nth-child(4) .gst-kpi-value { color: #1b5e20; }
        .gst-kpi-sub { font-size: 9px; color: var(--text-soft); margin-top: 3px; }
        
        /* Toolbar */
        .gst-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; flex-wrap: wrap; }
        .gst-select { height: 32px; padding: 0 10px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); font-size: 11px; font-family: var(--font); color: var(--text); cursor: pointer; outline: none; transition: all 0.2s; }
        .gst-select:focus { border-color: var(--accent); box-shadow: var(--focus); }
        .gst-search-wrap { flex: 1; position: relative; min-width: 160px; }
        .gst-search { width: 100%; height: 32px; padding: 0 12px 0 32px; border-radius: var(--r-md); border: 1px solid var(--border); background: var(--surface); font-size: 11px; font-family: var(--font); color: var(--text); outline: none; transition: all 0.2s; }
        .gst-search:focus { border-color: var(--accent); box-shadow: var(--focus); }
        .gst-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 11px; color: var(--text-soft); pointer-events: none; }
        .gst-count { font-size: 10px; color: var(--text-soft); font-weight: 600; white-space: nowrap; }
        
        /* Table */
        .gst-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow-x: auto; }
        .gst-table { width: 100%; border-collapse: separate; border-spacing: 0; }
        .gst-table thead th { padding: 8px 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-soft); background: var(--surface-2); text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
        .gst-table thead th.col-r { text-align: right; }
        .gst-table tbody tr { transition: background 0.15s; }
        .gst-table tbody tr:hover { background: rgba(192,57,43,0.03); }
        .gst-table tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border-light); }
        .gst-table td { padding: 8px 12px; font-size: 12px; color: var(--text); vertical-align: middle; }
        .gst-table td.col-r { text-align: right; }
        
        .gst-entity { font-weight: 600; color: var(--text); display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .gst-desc { font-size: 10px; color: var(--text-soft); display: block; max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
        .gst-amount { font-size: 13px; font-weight: 800; color: #c0392b; letter-spacing: -0.3px; }
        .gst-iva-sm { font-size: 10px; color: var(--text-soft); display: block; margin-top: 1px; }
        .gst-tipo-doc { padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; background: var(--bg-subtle); color: var(--text-mid); }
        .gst-deducible { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 20px; font-size: 9px; font-weight: 700; }
        .gst-deducible.si { background: rgba(27,94,32,0.08); color: #1b5e20; }
        .gst-deducible.no { background: rgba(192,57,43,0.08); color: #c0392b; }
        
        /* Empty */
        .gst-empty { text-align: center; padding: 40px 20px; }
        .gst-empty-icon { width: 48px; height: 48px; border-radius: var(--r-lg); background: linear-gradient(135deg, rgba(192,57,43,0.08), rgba(192,57,43,0.16)); display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px; }
        .gst-empty h3 { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
        .gst-empty p { font-size: 11px; color: var(--text-soft); margin: 0 0 16px; max-width: 320px; margin-left: auto; margin-right: auto; }
        .gst-empty-btn { height: 34px; padding: 0 20px; border-radius: var(--r-md); font-size: 11px; font-weight: 600; cursor: pointer; border: 1px solid var(--border); background: var(--surface); color: var(--text-mid); font-family: var(--font); transition: all 0.2s; }
        .gst-empty-btn:hover { border-color: #c0392b; color: #c0392b; background: rgba(192,57,43,0.04); }
        
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
            <div class="gst-kpi-label">Total Gastos</div>
            <div class="gst-kpi-value">−${formatColones(totalBruto)}</div>
            <div class="gst-kpi-sub">${gastos.length} comprobante${gastos.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">IVA Pagado</div>
            <div class="gst-kpi-value">${formatColones(totalIVA)}</div>
            <div class="gst-kpi-sub">Crédito fiscal potencial</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">Compras Netas</div>
            <div class="gst-kpi-value">${formatColones(totalNeto)}</div>
            <div class="gst-kpi-sub">Sin IVA · ${filterMes === 0 ? 'Todo el año' : MESES[filterMes - 1]} ${filterAnio}</div>
          </div>
          <div class="gst-kpi">
            <div class="gst-kpi-label">IVA Deducible</div>
            <div class="gst-kpi-value">${formatColones(ivaDeducible)}</div>
            <div class="gst-kpi-sub">${deducibles.length} gasto${deducibles.length !== 1 ? 's' : ''} deducible${deducibles.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        <!-- Toolbar -->
        <div class="gst-toolbar">
          <select id="filter-mes" class="gst-select">
            <option value="0" ${filterMes === 0 ? 'selected' : ''}>Todos los meses</option>
            ${MESES.map((m, i) => `<option value="${i + 1}" ${i + 1 === filterMes ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="filter-anio" class="gst-select">
            ${[anio - 1, anio, anio + 1].map(y => `<option value="${y}" ${y === filterAnio ? 'selected' : ''}>${y}</option>`).join('')}
          </select>
          <div class="gst-search-wrap">
            <span class="gst-search-icon">🔍</span>
            <input type="text" class="gst-search" id="gst-search" autocomplete="off" spellcheck="false" placeholder="Buscar proveedor, descripción, monto...">
          </div>
          <span class="gst-count">${filtered.length} de ${gastos.length}</span>
        </div>

        <!-- Content -->
        ${filtered.length === 0 ? `
          <div class="gst-empty">
            <div class="gst-empty-icon">💸</div>
            <h3>${gastos.length === 0 ? (filterMes === 0 ? 'Sin gastos en ' + filterAnio : 'Sin gastos en ' + MESES[filterMes - 1]) : 'Sin resultados'}</h3>
            <p>${gastos.length === 0 
              ? 'Las facturas de compras que recibás aparecerán aquí automáticamente cuando las importe el sistema desde tu correo.'
              : 'Probá con otro término de búsqueda.'}</p>
            ${gastos.length === 0 ? `<button class="gst-empty-btn" id="btn-change-month">← Probar otro mes</button>` : ''}
          </div>
        ` : `
          <div class="gst-table-wrap">
            <table class="gst-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Doc</th>
                  <th>Proveedor / Descripción</th>
                  <th>IVA%</th>
                  <th>Deducible</th>
                  <th class="col-r">Neto</th>
                  <th class="col-r">IVA</th>
                  <th class="col-r">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.map(g => {
                  const fecha = g.fecha ? new Date(g.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: 'short' }) : '—';
                  const ded = g.deducible !== false;
                  return `
                    <tr>
                      <td style="white-space:nowrap;color:var(--text-mid);font-size:11px;">${fecha}</td>
                      <td><span class="gst-tipo-doc">FE</span></td>
                      <td>
                        <span class="gst-entity">${esc(g.proveedor || g.descripcion || '—')}</span>
                        ${g.proveedor && g.descripcion ? `<span class="gst-desc">${esc(g.descripcion)}</span>` : ''}
                      </td>
                      <td style="font-size:11px;color:var(--text-mid);">${g.tarifa_iva}%</td>
                      <td>
                        <button class="gst-deducible ${ded ? 'si' : 'no'}" data-id="${g.id}" data-deducible="${ded}" style="cursor:pointer;border:none;outline:none;" title="Clic para alternar">
                          ${ded ? '✓ Sí' : '✗ No'}
                        </button>
                      </td>
                      <td class="col-r" style="font-size:12px;color:var(--text-mid);">${formatColones(g.monto_neto)}</td>
                      <td class="col-r" style="font-size:12px;color:var(--accent-dark);">${formatColones(g.monto_iva)}</td>
                      <td class="col-r">
                        <span class="gst-amount">−${formatColones(g.monto_bruto)}</span>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:var(--surface-2);border-top:2px solid var(--border);">
                  <td colspan="5" style="padding:12px 14px;font-size:11px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;">
                    Totales ${filterMes === 0 ? filterAnio : MESES[filterMes - 1] + ' ' + filterAnio}
                  </td>
                  <td class="col-r" style="padding:12px 14px;font-size:12px;font-weight:700;color:var(--text);">${formatColones(totalNeto)}</td>
                  <td class="col-r" style="padding:12px 14px;font-size:12px;font-weight:700;color:var(--accent-dark);">${formatColones(totalIVA)}</td>
                  <td class="col-r" style="padding:12px 14px;">
                    <span style="font-size:15px;font-weight:800;color:#c0392b;">−${formatColones(totalBruto)}</span>
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

    // Toggle Deducible
    content.querySelectorAll('.gst-deducible').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const current = e.currentTarget.dataset.deducible === 'true';
        const next = !current;
        
        // Optimistic UI update
        e.currentTarget.dataset.deducible = String(next);
        e.currentTarget.className = `gst-deducible ${next ? 'si' : 'no'}`;
        e.currentTarget.innerHTML = next ? '✓ Sí' : '✗ No';
        toast(next ? 'Marcado como gasto deducible' : 'Marcado como gasto personal (no deducible)', 'info');
        
        // Background sync and full re-render
        await updateTaxMetadata(id, { deducible: next });
        loadData(true);
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
        } catch {
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
