import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { fmtMoney, fmtDate, esc, toast, debounce } from '../lib/utils.js';
import { convertirAFactura, eliminarDocumento } from '../data/documentos.js';
import { getCurrentCurrency, convertFromCRC } from '../lib/currency.js';

const PAGE_SIZE = 100;

const TIPO_INFO = {
  OT: { label: 'Orden de Trabajo', code: 'OT', bg: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' },
  PRO: { label: 'Doc. Electrónico', code: 'PRO', bg: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6' },
  FAC: { label: 'Factura Electrónica', code: 'FAC', bg: 'rgba(16, 185, 129, 0.1)', color: '#059669' },
  COT: { label: 'Cotización', code: 'COT', bg: 'rgba(245, 158, 11, 0.1)', color: '#d97706' },
  DEF: { label: 'Comprobante', code: 'DOC', bg: 'rgba(100, 116, 139, 0.1)', color: '#64748b' }
};

let docState = { search: '', tipo: '', estado: '', loading: false };
let selectedDocs = new Set();
let cachedDocs = [];

export async function documentosListView() {
  docState = { search: '', tipo: '', estado: '', loading: false };
  selectedDocs.clear();
  const shell = ensureShell('/documentos');
  shell.setTitle('');
  shell.setActions('');
  const c = shell.content();

  c.innerHTML = `
    <div class="t1-ledger-container">
      
      <!-- ENCABEZADO ULTRA-COMPACTO CON RESUMEN EJECUTIVO EN LÍNEA (CERO TARJETAS INFLADAS) -->
      <div class="t1-ledger-header">
        <div class="t1-ledger-title-group">
          <h1 class="t1-ledger-title">Documentos</h1>
          <div class="t1-ledger-stat-strip">
            <span class="t1-stat-pill"><strong id="stat-total-count">0</strong> documentos</span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill">Emitido: <strong id="stat-total-amount">₡0</strong></span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill" style="color: #059669;">Cobrado: <strong id="stat-paid-amount">₡0</strong></span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill" style="color: var(--muted-color);">Pendiente: <strong id="stat-pending-amount">₡0</strong></span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button class="t1-btn-primary" id="doc-new-btn">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Documento
          </button>
        </div>
      </div>

      <!-- TABLA DE ALTA DENSIDAD / LEDGER (RENGLONES DELGADOS, SIN CORTES) -->
      <div class="t1-ledger-card">
        
        <!-- Barra de herramientas compacta -->
        <div class="t1-ledger-toolbar">
          
          <div class="t1-ledger-search-box">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input type="text" id="doc-search-input" placeholder="Buscar consecutivo, cliente o cédula..." class="t1-ledger-search-input" />
          </div>

          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <!-- Filtro de Tipo -->
            <div class="t1-ledger-filter-group" id="doc-tipo-filters">
              <button class="t1-ledger-filter-btn active" data-tipo="">Todos (<span id="count-all">0</span>)</button>
              <button class="t1-ledger-filter-btn" data-tipo="FAC">Facturas (<span id="count-fac">0</span>)</button>
              <button class="t1-ledger-filter-btn" data-tipo="OT">Órdenes OT (<span id="count-ot">0</span>)</button>
              <button class="t1-ledger-filter-btn" data-tipo="COT">Cotizaciones (<span id="count-cot">0</span>)</button>
            </div>

            <!-- Filtro de Estado -->
            <select id="doc-estado-select" class="t1-ledger-select">
              <option value="">Todos los Estados</option>
              <option value="pagada">Pagadas</option>
              <option value="pendiente">Pendientes</option>
              <option value="anulada">Anuladas</option>
            </select>
          </div>

        </div>

        <!-- Barra de acciones masivas -->
        <div id="doc-bulk-bar" style="display: none; padding: 6px 16px; background: rgba(2, 132, 199, 0.06); border-bottom: 1px solid rgba(2, 132, 199, 0.15); align-items: center; justify-content: space-between;">
          <span style="font-size: 12px; font-weight: 700; color: #0284c7;" id="doc-bulk-count">0 seleccionados</span>
          <div style="display: flex; gap: 6px;">
            <button id="doc-bulk-delete" style="padding: 4px 10px; font-size: 11.5px; font-weight: 700; border-radius: 5px; border: 1px solid #ef4444; background: #fef2f2; color: #b91c1c; cursor: pointer;">🗑 Eliminar selección</button>
            <button id="doc-bulk-cancel" style="padding: 4px 10px; font-size: 11.5px; font-weight: 600; border-radius: 5px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--muted-color); cursor: pointer;">✕ Cancelar</button>
          </div>
        </div>

        <!-- Tabla de renglones delgados -->
        <div class="t1-table-wrapper">
          <table class="t1-ledger-table" id="doc-table">
            <thead>
              <tr>
                <th style="width: 36px; text-align: center;">
                  <input type="checkbox" id="doc-check-all" style="cursor: pointer; accent-color: var(--innovio-teal);" />
                </th>
                <th style="min-width: 190px;">COMPROBANTE</th>
                <th style="min-width: 70px; text-align: center;">TIPO</th>
                <th style="min-width: 280px;">CLIENTE / RAZÓN SOCIAL</th>
                <th style="min-width: 110px;">FECHA</th>
                <th style="min-width: 130px; text-align: right;">TOTAL</th>
                <th style="min-width: 110px; text-align: center;">ESTADO</th>
                <th style="min-width: 120px; text-align: center;">HACIENDA v4.4</th>
                <th style="min-width: 110px; text-align: right;">ACCIONES</th>
              </tr>
            </thead>
            <tbody id="doc-table-body">
              <tr>
                <td colspan="9" style="text-align: center; padding: 36px; color: var(--muted-color);">
                  <div style="font-size: 13px; font-weight: 600;">Cargando listado de documentos...</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- DRAWER / SLIDE-OVER SHEET LATERAL (DETALLES ESTRUCTURADOS) -->
    <div class="t1-drawer-overlay" id="doc-drawer-overlay"></div>
    <div class="t1-drawer-panel" id="doc-drawer" style="max-width: 580px;">
      <div class="t1-drawer-header">
        <div>
          <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-color);" id="doc-drawer-type-label">DOCUMENTO</div>
          <h2 style="font-size: 18px; font-weight: 800; color: var(--heading-color); margin: 2px 0 0 0;" id="doc-drawer-title">—</h2>
        </div>
        <button class="t1-drawer-close-btn" id="doc-drawer-close">✕</button>
      </div>
      <div class="t1-drawer-scroll" id="doc-drawer-content">
        <div style="padding: 40px; text-align: center; color: var(--muted-color); font-size: 13px;">Cargando detalle...</div>
      </div>
    </div>
  `;

  // Bind nuevo documento
  document.getElementById('doc-new-btn').addEventListener('click', () => {
    window.location.hash = '/documentos/nuevo/orden';
  });

  // Bind búsqueda
  const searchInput = document.getElementById('doc-search-input');
  searchInput.addEventListener('input', debounce((e) => {
    docState.search = e.target.value.trim().toLowerCase();
    renderFilteredTable();
  }, 180));

  // Bind filtros de tipo
  document.getElementById('doc-tipo-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.t1-ledger-filter-btn');
    if (!btn) return;
    document.querySelectorAll('#doc-tipo-filters .t1-ledger-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    docState.tipo = btn.dataset.tipo;
    renderFilteredTable();
  });

  // Bind estado dropdown
  document.getElementById('doc-estado-select').addEventListener('change', (e) => {
    docState.estado = e.target.value;
    renderFilteredTable();
  });

  // Bind drawer close
  document.getElementById('doc-drawer-close').addEventListener('click', closeDocDrawer);
  document.getElementById('doc-drawer-overlay').addEventListener('click', closeDocDrawer);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDocDrawer();
  });

  // Cargar documentos
  await loadDocuments();
}

async function loadDocuments() {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('documentos')
      .select('id, doc_type, doc_num, created_at, fecha, total, subtotal, moneda, tipo_cambio, estado, cliente_id, clientes(nombre, empresa)')
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);

    if (error) throw error;
    cachedDocs = data || [];

    // Actualizar strip de estadísticas en el encabezado
    updateHeaderStats(cachedDocs);

    // Contadores
    const countAll = document.getElementById('count-all');
    const countFac = document.getElementById('count-fac');
    const countOt = document.getElementById('count-ot');
    const countCot = document.getElementById('count-cot');

    if (countAll) countAll.textContent = cachedDocs.length;
    if (countFac) countFac.textContent = cachedDocs.filter(d => d.doc_type === 'FAC').length;
    if (countOt) countOt.textContent = cachedDocs.filter(d => d.doc_type === 'OT').length;
    if (countCot) countCot.textContent = cachedDocs.filter(d => d.doc_type === 'COT').length;

    renderFilteredTable();
  } catch (err) {
    console.error('Error al cargar documentos:', err);
    toast('Error al consultar documentos: ' + (err.message || err), 'error');
  }
}

function updateHeaderStats(docs) {
  const cur = getCurrentCurrency();
  const totalCount = docs.length;

  const totalEmitidoCRC = docs.reduce((acc, d) => {
    const rate = d.moneda === 'USD' ? (Number(d.tipo_cambio || 1) * 1.03) : 1;
    return acc + (Number(d.total || 0) * rate);
  }, 0);

  const pagadas = docs.filter(d => ['pagada', 'completado', 'facturado'].includes(d.estado));
  const totalPagadoCRC = pagadas.reduce((acc, d) => {
    const rate = d.moneda === 'USD' ? (Number(d.tipo_cambio || 1) * 1.03) : 1;
    return acc + (Number(d.total || 0) * rate);
  }, 0);

  const pendientes = docs.filter(d => ['pendiente', 'emitida', 'en_progreso'].includes(d.estado));
  const totalPendienteCRC = pendientes.reduce((acc, d) => {
    const rate = d.moneda === 'USD' ? (Number(d.tipo_cambio || 1) * 1.03) : 1;
    return acc + (Number(d.total || 0) * rate);
  }, 0);

  const countEl = document.getElementById('stat-total-count');
  const amountEl = document.getElementById('stat-total-amount');
  const paidEl = document.getElementById('stat-paid-amount');
  const pendingEl = document.getElementById('stat-pending-amount');

  if (countEl) countEl.textContent = totalCount;
  if (amountEl) amountEl.textContent = fmtMoney(convertFromCRC(totalEmitidoCRC, cur), cur);
  if (paidEl) paidEl.textContent = fmtMoney(convertFromCRC(totalPagadoCRC, cur), cur);
  if (pendingEl) pendingEl.textContent = fmtMoney(convertFromCRC(totalPendienteCRC, cur), cur);
}

function renderFilteredTable() {
  const tbody = document.getElementById('doc-table-body');
  if (!tbody) return;

  let filtered = [...cachedDocs];

  if (docState.tipo) {
    filtered = filtered.filter(d => d.doc_type === docState.tipo);
  }

  if (docState.estado) {
    filtered = filtered.filter(d => d.estado === docState.estado);
  }

  if (docState.search) {
    filtered = filtered.filter(d => {
      const q = docState.search;
      const num = (d.doc_num || '').toLowerCase();
      const cliEmpresa = (d.clientes?.empresa || '').toLowerCase();
      const cliNombre = (d.clientes?.nombre || '').toLowerCase();
      return num.includes(q) || cliEmpresa.includes(q) || cliNombre.includes(q);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 40px 16px; color: var(--muted-color);">
          <div style="font-size: 13.5px; font-weight: 700; color: var(--heading-color);">No se encontraron documentos</div>
          <div style="font-size: 12px; margin-top: 2px;">Intente ajustar el término de búsqueda o filtros.</div>
        </td>
      </tr>
    `;
    return;
  }

  const cur = getCurrentCurrency();
  const allIds = filtered.map(d => d.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedDocs.has(id));

  const checkAllEl = document.getElementById('doc-check-all');
  if (checkAllEl) checkAllEl.checked = allSelected;

  tbody.innerHTML = filtered.map(d => {
    const isSelected = selectedDocs.has(d.id);
    const tipo = TIPO_INFO[d.doc_type] || TIPO_INFO.DEF;
    const clientName = d.clientes?.empresa || d.clientes?.nombre || 'Consumidor Final';
    const consecutivo = d.doc_num ? `#${d.doc_num}` : `#${d.id}`;

    const estado = d.estado || 'pendiente';
    const statusClass = (estado === 'pagada' || estado === 'completado') ? 'paid' : (estado === 'anulada' || estado === 'cancelado' ? 'canceled' : 'pending');
    const statusLabel = estado.charAt(0).toUpperCase() + estado.slice(1);

    const rate = d.moneda === 'USD' ? (Number(d.tipo_cambio || 1) * 1.03) : 1;
    const montoCRC = Number(d.total || 0) * rate;
    const displayAmount = convertFromCRC(montoCRC, cur);

    const isHaciendaReady = d.doc_type === 'FAC';
    const haciendaBadge = isHaciendaReady 
      ? `<span class="t1-hacienda-quiet-badge">✓ DGT v4.4</span>`
      : `<span class="t1-hacienda-quiet-badge none">—</span>`;

    return `
      <tr class="t1-ledger-row ${isSelected ? 'selected' : ''}" data-doc-id="${d.id}" style="cursor: pointer;">
        <td style="text-align: center;" onclick="event.stopPropagation();">
          <input type="checkbox" class="doc-row-cb" data-id="${d.id}" ${isSelected ? 'checked' : ''} style="cursor: pointer; accent-color: var(--innovio-teal);" />
        </td>
        <td>
          <span class="t1-ledger-consecutivo">${consecutivo}</span>
        </td>
        <td style="text-align: center;">
          <span class="t1-type-badge" style="background: ${tipo.bg}; color: ${tipo.color};">${tipo.code}</span>
        </td>
        <td>
          <span class="t1-client-title">${esc(clientName)}</span>
        </td>
        <td>
          <span style="font-size: 12px; color: var(--muted-color); font-variant-numeric: tabular-nums;">${fmtDate(d.fecha)}</span>
        </td>
        <td style="text-align: right;">
          <span style="font-family: var(--font-display); font-size: 13.5px; font-weight: 800; color: var(--heading-color); font-variant-numeric: tabular-nums;">
            ${fmtMoney(displayAmount, cur)}
          </span>
        </td>
        <td style="text-align: center;">
          <span class="t1-dot-status ${statusClass}">${statusLabel}</span>
        </td>
        <td style="text-align: center;">
          ${haciendaBadge}
        </td>
        <td style="text-align: right;" onclick="event.stopPropagation();">
          <div style="display: inline-flex; align-items: center; gap: 4px;">
            <button class="t1-row-action-btn-mini btn-view-comp" data-id="${d.id}" title="Ver Comprobante">
              PDF
            </button>
            <button class="t1-row-action-btn-mini btn-view-drawer" data-id="${d.id}" title="Ver Detalle" style="border-color: rgba(0,194,168,0.3); color: var(--innovio-teal);">
              Ver →
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row click -> Drawer
  tbody.querySelectorAll('.t1-ledger-row').forEach(row => {
    row.addEventListener('click', () => {
      openDocDrawer(row.dataset.docId);
    });
  });

  // Action buttons
  tbody.querySelectorAll('.btn-view-comp').forEach(btn => {
    btn.addEventListener('click', () => {
      window.location.hash = `/documentos/${btn.dataset.id}/comprobante`;
    });
  });

  tbody.querySelectorAll('.btn-view-drawer').forEach(btn => {
    btn.addEventListener('click', () => {
      openDocDrawer(btn.dataset.id);
    });
  });

  // Checkbox interactions
  tbody.querySelectorAll('.doc-row-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = cb.dataset.id;
      if (cb.checked) selectedDocs.add(id);
      else selectedDocs.delete(id);
      updateBulkBar();
    });
  });

  // Check all
  const checkAllEl2 = document.getElementById('doc-check-all');
  if (checkAllEl2) {
    checkAllEl2.onchange = (e) => {
      if (e.target.checked) {
        allIds.forEach(id => selectedDocs.add(id));
      } else {
        selectedDocs.clear();
      }
      renderFilteredTable();
      updateBulkBar();
    };
  }

  updateBulkBar();
}

function updateBulkBar() {
  const bar = document.getElementById('doc-bulk-bar');
  const countEl = document.getElementById('doc-bulk-count');
  if (!bar || !countEl) return;

  if (selectedDocs.size > 0) {
    bar.style.display = 'flex';
    countEl.textContent = `${selectedDocs.size} seleccionado${selectedDocs.size !== 1 ? 's' : ''}`;
  } else {
    bar.style.display = 'none';
  }

  const btnCancel = document.getElementById('doc-bulk-cancel');
  if (btnCancel) {
    btnCancel.onclick = () => {
      selectedDocs.clear();
      renderFilteredTable();
      updateBulkBar();
    };
  }

  const btnDelete = document.getElementById('doc-bulk-delete');
  if (btnDelete) {
    btnDelete.onclick = async () => {
      if (selectedDocs.size === 0) return;
      if (!confirm(`¿Eliminar ${selectedDocs.size} documento(s) definitivamente?`)) return;
      try {
        for (const id of selectedDocs) {
          await eliminarDocumento(id);
        }
        toast(`✅ ${selectedDocs.size} documento(s) eliminado(s)`, 'success');
        selectedDocs.clear();
        await loadDocuments();
      } catch (err) {
        toast('Error al eliminar: ' + (err.message || err), 'error');
      }
    };
  }
}

async function openDocDrawer(docId) {
  const drawer = document.getElementById('doc-drawer');
  const overlay = document.getElementById('doc-drawer-overlay');
  const titleEl = document.getElementById('doc-drawer-title');
  const typeLabelEl = document.getElementById('doc-drawer-type-label');
  const contentEl = document.getElementById('doc-drawer-content');

  if (!drawer || !overlay) return;

  overlay.classList.add('open');
  drawer.classList.add('open');

  contentEl.innerHTML = `<div style="padding: 36px; text-align: center; color: var(--muted-color); font-size: 13px;">Cargando expediente...</div>`;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('documentos')
      .select('*, clientes(*), lineas_documento(*)')
      .eq('id', docId)
      .single();

    if (error) throw error;

    const tipo = TIPO_INFO[data.doc_type] || TIPO_INFO.DEF;
    const consecutivo = data.doc_num ? `#${data.doc_num}` : `#${data.id}`;
    titleEl.textContent = `${tipo.code} ${consecutivo}`;
    typeLabelEl.textContent = tipo.label;

    const clienteName = data.clientes?.empresa || data.clientes?.nombre || 'Consumidor Final';
    const cur = getCurrentCurrency();
    const rate = data.moneda === 'USD' ? (Number(data.tipo_cambio || 1) * 1.03) : 1;
    const montoCRC = Number(data.total || 0) * rate;
    const displayTotal = convertFromCRC(montoCRC, cur);

    const totalNum = Number(data.total || 0);
    let subtotalReal = Number(data.subtotal || 0);
    let ivaReal = Number(data.iva || 0);
    if (ivaReal === 13 || ivaReal === 0 || !data.subtotal) {
      subtotalReal = Number((totalNum / 1.13).toFixed(2));
      ivaReal = Number((totalNum - subtotalReal).toFixed(2));
    }

    const items = data.lineas_documento || [];
    let itemsTable = `<div style="padding: 12px; text-align: center; color: var(--muted-color); font-size: 12px;">Sin líneas detalladas</div>`;

    if (items.length > 0) {
      itemsTable = `
        <div style="border: 1px solid var(--panel-border); border-radius: 8px; overflow: hidden; margin-top: 8px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: var(--panel-subtle); border-bottom: 1px solid var(--panel-border); color: var(--subtle-color); text-align: left;">
                <th style="padding: 7px 10px; font-weight: 700; text-transform: uppercase; font-size: 10px;">Descripción</th>
                <th style="padding: 7px 6px; text-align: center; font-weight: 700; font-size: 10px; width: 45px;">Cant.</th>
                <th style="padding: 7px 10px; text-align: right; font-weight: 700; font-size: 10px; width: 85px;">Precio</th>
                <th style="padding: 7px 10px; text-align: right; font-weight: 700; font-size: 10px; width: 90px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(it => {
                const sub = (it.precio_unitario || 0) * (it.cantidad || 1);
                return `
                  <tr style="border-bottom: 1px solid rgba(15, 23, 42, 0.04);">
                    <td style="padding: 8px 10px; font-weight: 600; color: var(--heading-color);">${esc(it.descripcion)}</td>
                    <td style="padding: 8px 6px; text-align: center; color: var(--muted-color); font-weight: 600;">${it.cantidad}</td>
                    <td style="padding: 8px 10px; text-align: right; color: var(--muted-color);">${fmtMoney(convertFromCRC(it.precio_unitario, cur), cur)}</td>
                    <td style="padding: 8px 10px; text-align: right; font-weight: 700; color: var(--heading-color); font-variant-numeric: tabular-nums;">${fmtMoney(convertFromCRC(sub, cur), cur)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    contentEl.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 14px;">
        
        <!-- CARD CLIENTE -->
        <div style="background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 10px; padding: 14px 18px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-color); margin-bottom: 6px;">Receptor del Comprobante</div>
          <div style="font-size: 15px; font-weight: 800; color: var(--heading-color); margin-bottom: 3px;">${esc(clienteName)}</div>
          ${data.clientes?.cedula ? `<div style="font-size: 11.5px; font-weight: 600; color: var(--muted-color); margin-bottom: 4px;">Cédula: ${esc(data.clientes.cedula)}</div>` : ''}
          <div style="display: flex; gap: 14px; font-size: 11.5px; color: var(--muted-color); flex-wrap: wrap;">
            ${data.clientes?.telefono ? `<span>📞 ${esc(data.clientes.telefono)}</span>` : ''}
            ${data.clientes?.email ? `<span>✉️ ${esc(data.clientes.email)}</span>` : ''}
          </div>
        </div>

        <!-- CARD TOTALES Y LIQUIDACIÓN -->
        <div style="background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 10px; padding: 14px 18px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
            <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-color);">Liquidación Tributaria</div>
            <span style="font-size: 10.5px; font-weight: 700; padding: 1.5px 6px; border-radius: 5px; background: rgba(16, 185, 129, 0.1); color: #10b981;">Hacienda v4.4</span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 5px; font-size: 12.5px;">
            <div style="display: flex; justify-content: space-between; color: var(--muted-color);">
              <span>Subtotal</span>
              <span>${fmtMoney(convertFromCRC(subtotalReal, cur), cur)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; color: var(--muted-color);">
              <span>IVA (13%)</span>
              <span>${fmtMoney(convertFromCRC(ivaReal, cur), cur)}</span>
            </div>
            <div style="height: 1px; background: var(--panel-border); margin: 4px 0;"></div>
            <div style="display: flex; justify-content: space-between; font-size: 15px; font-weight: 800; color: var(--heading-color);">
              <span>Total Comprobante</span>
              <span style="color: #059669; font-family: var(--font-display);">${fmtMoney(displayTotal, cur)}</span>
            </div>
          </div>
        </div>

        <!-- CARD LÍNEAS -->
        <div style="background: var(--panel-bg); border: 1px solid var(--panel-border); border-radius: 10px; padding: 14px 18px;">
          <div style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-color);">Detalle de Líneas</div>
          ${itemsTable}
        </div>

        <!-- BOTONES DE ACCIÓN -->
        <div style="display: flex; gap: 8px; margin-top: 6px;">
          <button id="drawer-btn-comp" style="flex: 1; padding: 9px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--heading-color); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
            📄 Ver Comprobante PDF
          </button>
          <button id="drawer-btn-edit" style="flex: 1; padding: 9px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: none; background: var(--innovio-navy); color: #fff; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 5px;">
            ✏️ Editar
          </button>
          <button id="drawer-btn-delete" style="padding: 9px 12px; font-size: 12px; font-weight: 700; border-radius: 7px; border: 1px solid #ef4444; background: #fef2f2; color: #b91c1c; cursor: pointer;">
            🗑
          </button>
        </div>

      </div>
    `;

    document.getElementById('drawer-btn-comp')?.addEventListener('click', () => {
      window.location.hash = `/documentos/${data.id}/comprobante`;
    });
    document.getElementById('drawer-btn-edit')?.addEventListener('click', () => {
      window.location.hash = `/documentos/${data.id}/editar`;
    });
    document.getElementById('drawer-btn-delete')?.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este documento definitivamente?')) return;
      try {
        await eliminarDocumento(data.id);
        toast('Documento eliminado', 'success');
        closeDocDrawer();
        await loadDocuments();
      } catch (e) {
        toast('Error: ' + (e.message || e), 'error');
      }
    });

  } catch (err) {
    console.error('Error cargando expediente:', err);
    contentEl.innerHTML = `<div style="padding: 24px; text-align: center; color: #ef4444;">Error: ${esc(err.message || err)}</div>`;
  }
}

function closeDocDrawer() {
  const drawer = document.getElementById('doc-drawer');
  const overlay = document.getElementById('doc-drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

export async function documentoDetalleView(params = {}) {
  const id = params?.id;
  if (!id || id === 'undefined' || id === 'null') {
    return documentosListView();
  }
  const shell = ensureShell('/documentos');
  shell.setTitle('Expediente de Documento');
  const c = shell.content();

  c.innerHTML = `
    <div style="padding: 20px; max-width: 800px; margin: 0 auto;">
      <div style="margin-bottom: 14px;">
        <button onclick="window.location.hash='/documentos'" style="padding: 7px 14px; border-radius: 7px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--heading-color); font-weight: 700; cursor: pointer; font-size: 12px;">
          ← Volver a Documentos
        </button>
      </div>
      <div id="full-detail-box" class="t1-ledger-card" style="padding: 24px;">
        Cargando expediente...
      </div>
    </div>
  `;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('documentos')
      .select('*, clientes(nombre, empresa, telefono, email, direccion, cedula), lineas_documento(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    const box = document.getElementById('full-detail-box');
    if (box) {
      const tipo = TIPO_INFO[data.doc_type] || TIPO_INFO.DEF;
      const consecutivo = data.doc_num ? `#${data.doc_num}` : `#${data.id}`;
      box.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 1px solid var(--panel-border); padding-bottom: 14px;">
          <div>
            <span style="font-size: 10.5px; font-weight: 700; text-transform: uppercase; color: var(--muted-color);">${tipo.label}</span>
            <h1 style="font-size: 22px; font-weight: 800; color: var(--heading-color); margin: 2px 0 0 0;">${tipo.code} ${consecutivo}</h1>
          </div>
          <div style="display: flex; gap: 8px;">
            <button onclick="window.location.hash='/documentos/${data.id}/comprobante'" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: 1px solid var(--panel-border); background: var(--panel-bg); cursor: pointer;">
              📄 Ver Comprobante
            </button>
            <button onclick="window.location.hash='/documentos/${data.id}/editar'" style="padding: 8px 14px; font-size: 12px; font-weight: 700; border-radius: 7px; border: none; background: var(--innovio-teal); color: #fff; cursor: pointer;">
              ✏️ Editar
            </button>
          </div>
        </div>
        <div style="font-size: 14px; font-weight: 700; margin-bottom: 6px;">Receptor: ${esc(data.clientes?.empresa || data.clientes?.nombre || 'Consumidor Final')}</div>
        <div style="font-size: 20px; font-weight: 800; color: #059669; margin-bottom: 20px;">Total: ${fmtMoney(data.total, data.moneda || 'CRC')}</div>
      `;
    }
  } catch (e) {
    const box = document.getElementById('full-detail-box');
    if (box) box.innerHTML = `<div style="color: #ef4444;">Error al cargar detalle: ${esc(e.message || e)}</div>`;
  }
}
