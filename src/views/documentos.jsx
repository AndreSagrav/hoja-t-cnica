import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { fmtMoney, fmtDate, esc, toast, debounce } from '../lib/utils.js';
import { convertirAFactura, eliminarDocumento } from '../data/documentos.js';

const PAGE_SIZE = 80;
const ESTADO_COLOR = { pendiente:'#f59e0b', en_proceso:'#3b82f6', completado:'#10b981', facturado:'#6366f1', cancelado:'#ef4444' };
const ESTADO_BG    = { pendiente:'#fff7ed', en_proceso:'#eff6ff', completado:'#f0fdf4', facturado:'#f5f3ff', cancelado:'#fef2f2' };

const HACIENDA_ESTADOS = [
  { value: 'sin_enviar', label: 'Sin enviar', color: '#94a3b8' },
  { value: 'pendiente_h', label: 'Pendiente', color: '#f59e0b' },
  { value: 'aceptado', label: 'Aceptado', color: '#10b981' },
  { value: 'rechazado', label: 'Rechazado', color: '#ef4444' },
];

const ESTADO_PAGO = {
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  abonada: { label: 'Abonada', color: '#3b82f6' },
  pagada: { label: 'Pagada', color: '#10b981' },
  anulada: { label: 'Anulada', color: '#ef4444' },
};

async function cambiarEstadoHacienda(docId, nuevoEstado, btn) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('documentos').update({ estado_hacienda: nuevoEstado }).eq('id', docId);
  if (error) throw error;
  toast('Estado Hacienda actualizado: ' + HACIENDA_ESTADOS.find(e => e.value === nuevoEstado)?.label, 'success');
}

async function cambiarEstadoPago(docId, nuevoEstado, btn) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('documentos').update({ estado: nuevoEstado }).eq('id', docId);
  if (error) throw error;
  toast('Estado actualizado: ' + ESTADO_PAGO[nuevoEstado]?.label, 'success');
}

let docState = { search:'', tipo:'', estado:'', loading:false };
let selectedDocs = new Set();

export async function documentosListView() {
  docState = { search:'', tipo:'', estado:'', loading:false };
  selectedDocs.clear();
  const shell = ensureShell('/documentos');
  shell.setTitle(''); 
  shell.setActions('');
  const c = shell.content();

  c.innerHTML = `
<style>
  .doc-page { display:flex; flex-direction:column; height:100%; min-height:0; }
  .doc-page-header { display:flex; align-items:center; justify-content:space-between; padding:0 0 16px; flex-wrap:wrap; gap:12px; flex:none; }
  .doc-page-title { font-size:22px; font-weight:900; color:var(--navy); letter-spacing:-0.02em; display:flex; align-items:center; gap:10px; }
  .doc-page-count { font-size:15px; font-weight:700; color:var(--text-soft); background:var(--surface-2); padding:4px 14px; border-radius:20px; border:1px solid var(--border-light); }
  .doc-new-btn { padding:11px 22px; font-size:14px; font-weight:800; border-radius:10px; border:none; background:var(--grad-navy); color:white; cursor:pointer; display:flex; align-items:center; gap:8px; transition:all 0.25s; box-shadow:0 4px 14px rgba(13,50,112,0.2); }
  .doc-new-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(13,50,112,0.3); }
  .doc-kpi-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(160px,1fr)); gap:12px; margin-bottom:16px; flex:none; }
  .doc-kpi-card { background:var(--surface); border:2px solid var(--border-light); border-radius:12px; padding:14px 18px; display:flex; align-items:center; gap:12px; transition:all 0.2s; }
  .doc-kpi-card:hover { border-color:var(--accent); box-shadow:0 4px 16px rgba(0,0,0,0.05); }
  .doc-kpi-icon { width:42px; height:42px; border-radius:10px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
  .doc-kpi-icon.blue { background:#dbeafe; color:#1e3a8a; }
  .doc-kpi-icon.amber { background:#fef3c7; color:#92400e; }
  .doc-kpi-icon.purple { background:#f3e8ff; color:#581c87; }
  .doc-kpi-icon.green { background:#dcfce7; color:#14532d; }
  .doc-kpi-label { font-size:12px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.3px; }
  .doc-kpi-value { font-size:22px; font-weight:900; color:var(--navy); letter-spacing:-0.02em; }
  .doc-toolbar { display:flex; align-items:center; gap:12px; margin-bottom:14px; flex-wrap:wrap; flex:none; }
  .doc-search-wrap { position:relative; flex:1; min-width:200px; }
  .doc-search-input { width:100%; padding:11px 16px 11px 42px; font-size:14px; border:2px solid var(--border-light); border-radius:10px; font-family:inherit; color:var(--text); background:var(--surface); transition:border-color 0.2s; }
  .doc-search-input:focus { outline:none; border-color:var(--accent); }
  .doc-search-icon { position:absolute; left:14px; top:50%; transform:translateY(-50%); color:var(--text-soft); }
  .doc-filters { display:flex; gap:8px; flex-wrap:wrap; }
  .doc-filter-tab { padding:8px 16px; font-size:13px; font-weight:700; border-radius:8px; border:2px solid var(--border-light); background:var(--surface); color:var(--text-mid); cursor:pointer; transition:all 0.2s; font-family:inherit; white-space:nowrap; }
  .doc-filter-tab:hover { border-color:var(--accent); color:var(--navy); }
  .doc-filter-tab.active { background:var(--navy); color:white; border-color:var(--navy); }
  .doc-bulk-bar { display:flex; align-items:center; gap:10px; padding:10px 18px; margin-bottom:12px; background:linear-gradient(135deg,rgba(0,194,168,0.08),rgba(0,194,168,0.03)); border:2px solid rgba(0,194,168,0.25); border-radius:10px; flex:none; }
  .doc-bulk-btn { font-size:13px; font-weight:700; padding:8px 16px; border-radius:8px; cursor:pointer; transition:all 0.2s; }
  .doc-bulk-btn:hover { transform:translateY(-1px); box-shadow:0 4px 12px rgba(0,0,0,0.1); }
  .doc-list-scroll { flex:1; overflow-y:auto; min-height:0; padding-right:4px; }
  .doc-list-scroll::-webkit-scrollbar { width:6px; }
  .doc-list-scroll::-webkit-scrollbar-thumb { background:var(--border); border-radius:10px; }
  .doc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px 20px; color:var(--text-soft); }
  .doc-empty-icon { margin-bottom:12px; opacity:0.4; }
  .doc-empty-text { font-size:15px; font-weight:600; }
  @media (max-width: 768px) {
    .doc-page-title { font-size:18px; }
    .doc-new-btn { padding:10px 16px; font-size:13px; }
    .doc-kpi-row { grid-template-columns:repeat(2,1fr); gap:10px; }
    .doc-kpi-card { padding:10px 14px; }
    .doc-kpi-value { font-size:18px; }
    .doc-kpi-icon { width:36px; height:36px; }
    .doc-toolbar { gap:8px; }
    .doc-filters { gap:6px; }
    .doc-filter-tab { padding:7px 12px; font-size:12px; }
    .doc-grid { grid-template-columns:1fr; gap:10px; }
    .doc-card { padding:14px 16px; }
    .doc-card-type { font-size:15px; }
    .doc-card-amount { font-size:16px; }
    .doc-card-client { font-size:14px; }
    .doc-badge { font-size:11px; padding:4px 10px; }
  }
  @media (max-width: 480px) {
    .doc-kpi-row { grid-template-columns:1fr 1fr; }
    .doc-page-header { flex-direction:column; align-items:stretch; }
    .doc-new-btn { width:100%; justify-content:center; }
  }
</style>
<div class="doc-page">
  <div class="doc-page-header">
    <div class="doc-page-title">
      <svg width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
      Gestión de Documentos <span class="doc-page-count" id="doc-count">—</span>
    </div>
    <button class="doc-new-btn" id="doc-new-btn">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
      Nuevo Documento
    </button>
  </div>
  <div class="doc-kpi-row" id="doc-kpis"></div>
  <div class="doc-toolbar">
    <div class="doc-search-wrap">
      <svg class="doc-search-icon" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input class="doc-search-input" id="doc-search" placeholder="Buscar por número o cliente…" />
    </div>
    <div class="doc-filters" id="doc-tipo-filters"></div>
    <div class="doc-filters" id="doc-estado-filters"></div>
  </div>
  <div class="doc-list-scroll" id="doc-list">
    <div class="doc-empty"><div class="doc-empty-icon"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div><div class="doc-empty-text">Cargando…</div></div>
  </div>
</div>`;

  document.getElementById('doc-new-btn').addEventListener('click', () => {
    window.location.hash = '/documentos/nuevo/orden';
  });

  document.getElementById('doc-search').addEventListener('input', debounce(e => { docState.search = e.target.value.trim(); loadDocList(); }, 280));

  renderDocFilters();
  await loadDocList();
}

export async function documentoDetalleView({ id }) {
  const shell = ensureShell('/documentos');
  shell.setTitle('Cargando documento...');
  const c = shell.content();
  
  c.innerHTML = `
    <div class="card">
      <div class="empty-state">Cargando documento...</div>
    </div>
  `;
  
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('documentos')
      .select(`
        *,
        clientes(nombre, empresa, telefono, email, direccion),
        lineas_documento(*)
      `)
      .eq('id', id)
      .single();
      
    if (error) throw error;
    
    renderDocDetail(data, shell);
  } catch (e) {
    console.error('Error cargando documento:', e);
    c.innerHTML = `
      <div class="card">
        <div class="empty-state" style="color: var(--red);">
          Error cargando documento: ${esc(e.message || 'Error desconocido')}
        </div>
      </div>
    `;
  }
}

function renderDocFilters() {
  const tipos = [
    ['', 'Todos tipos'],
    ['OT', '📋 OT'],
    ['PRO', '⚡ Doc. Elec.'],
    ['FAC', '🧾 Facturas'],
    ['COT', '📄 Cotización']
  ];
  const estados = [
    ['', 'Todos estados'],
    ['pendiente', '⏳ Pendientes'],
    ['en_progreso', '🔄 En progreso'],
    ['completado', '✅ Completados'],
    ['facturado', '💰 Facturados'],
    ['cancelado', '❌ Cancelados']
  ];

  document.getElementById('doc-tipo-filters').innerHTML = tipos.map(([v, l]) =>
    `<button class="doc-filter-tab ${docState.tipo === v ? 'active' : ''}" data-tipo="${v}">${l}</button>`
  ).join('');

  document.getElementById('doc-estado-filters').innerHTML = estados.map(([v, l]) =>
    `<button class="doc-filter-tab ${docState.estado === v ? 'active' : ''}" data-estado="${v}">${l}</button>`
  ).join('');

  document.getElementById('doc-tipo-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.doc-filter-tab');
    if (!btn) return;
    docState.tipo = btn.dataset.tipo;
    renderDocFilters();
    loadDocList();
  });

  document.getElementById('doc-estado-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.doc-filter-tab');
    if (!btn) return;
    docState.estado = btn.dataset.estado;
    renderDocFilters();
    loadDocList();
  });
}

async function loadDocList() {
  if (docState.loading) return;
  docState.loading = true;
  const box = document.getElementById('doc-list');
  try {
    const supabase = await getSupabase();
    let q = supabase
      .from('documentos')
      .select('id, doc_type, doc_num, fecha, total, estado, clientes(nombre, empresa)', { count:'exact' })
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (docState.tipo)   q = q.eq('doc_type', docState.tipo);
    if (docState.estado) q = q.eq('estado', docState.estado);
    if (docState.search) q = q.ilike('doc_num', `%${docState.search}%`);

    const { data, count, error } = await q;
    if (error) throw error;

    const totalCount = count ?? (data ? data.length : 0);
    const countEl = document.getElementById('doc-count');
    if (countEl) countEl.textContent = totalCount;
    renderDocKPIs(data || []);
    renderListToBox(data || []);
  } catch (e) {
    console.error("Error al cargar documentos de Supabase:", e);
    toast("Error al conectar con Supabase: " + (e.message || e), "error");
    if (box) {
      box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon" style="color:var(--red);">⚠️</div><div class="crm-empty-text" style="color:var(--red);">Error de Supabase: ${esc(e.message || String(e))}</div></div>`;
    }
  } finally {
    docState.loading = false;
  }
}

function renderDocKPIs(data) {
  const kpiBox = document.getElementById('doc-kpis');
  if (!kpiBox) return;

  const counts = { total: data.length, pendiente: 0, en_progreso: 0, completado: 0, facturado: 0 };
  data.forEach(d => {
    const e = d.estado || 'pendiente';
    if (counts[e] !== undefined) counts[e]++;
  });

  kpiBox.innerHTML = `
    <div class="doc-kpi-card">
      <div class="doc-kpi-icon blue"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
      <div><div class="doc-kpi-label">Total</div><div class="doc-kpi-value">${counts.total}</div></div>
    </div>
    <div class="doc-kpi-card">
      <div class="doc-kpi-icon amber"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div><div class="doc-kpi-label">Pendientes</div><div class="doc-kpi-value">${counts.pendiente}</div></div>
    </div>
    <div class="doc-kpi-card">
      <div class="doc-kpi-icon purple"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div>
      <div><div class="doc-kpi-label">En progreso</div><div class="doc-kpi-value">${counts.en_progreso}</div></div>
    </div>
    <div class="doc-kpi-card">
      <div class="doc-kpi-icon green"><svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div><div class="doc-kpi-label">Completados</div><div class="doc-kpi-value">${counts.completado}</div></div>
    </div>`;
}

function renderListToBox(data) {
  const box = document.getElementById('doc-list');
  if (!box) return;

  if (!data.length) {
    box.innerHTML = `<div class="doc-empty"><div class="doc-empty-icon"><svg width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg></div><div class="doc-empty-text">Sin resultados</div></div>`; return;
  }

  const allIds = data.map(d => d.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selectedDocs.has(id));

  const ESTADO_ICONS = { pendiente:'⏳', en_progreso:'🔄', completado:'✅', facturado:'💰', cancelado:'❌' };
  const TIPO_ICONS = { OT:'📋', PRO:'⚡', FAC:'🧾', COT:'📄', DEF:'📄' };

  const bulkBar = selectedDocs.size > 0 ? `
    <div class="doc-bulk-bar" id="doc-bulk-bar">
      <span style="font-size:14px;font-weight:800;color:var(--accent-dark);">${selectedDocs.size} seleccionado${selectedDocs.size !== 1 ? 's' : ''}</span>
      <div style="display:flex;gap:8px;margin-left:auto;">
        <button class="doc-bulk-btn" id="doc-bulk-delete" style="border:2px solid #ef4444;background:#fee2e2;color:#7f1d1d;">🗑 Eliminar</button>
        <button class="doc-bulk-btn" id="doc-bulk-cancel" style="border:2px solid var(--border);background:var(--surface);color:var(--text-mid);">✕ Cancelar</button>
      </div>
    </div>
  ` : '';

  const selectAllHtml = `
    <div style="display:flex;align-items:center;gap:10px;padding:0 0 12px;">
      <input type="checkbox" id="doc-select-all" ${allSelected ? 'checked' : ''} style="width:20px;height:20px;cursor:pointer;accent-color:var(--accent);" />
      <label for="doc-select-all" style="font-size:13px;font-weight:700;color:var(--text-mid);cursor:pointer;">Seleccionar todos</label>
    </div>
  `;

  const cards = data.map(d => {
    const tipo = d.doc_type || 'DEF';
    const cliente = d.clientes?.empresa || d.clientes?.nombre || '—';
    const estado = d.estado || 'pendiente';
    const isSelected = selectedDocs.has(d.id);
    const estadoIcon = ESTADO_ICONS[estado] || '❓';
    const tipoIcon = TIPO_ICONS[tipo] || '📄';
    const estadoLabel = estado.replace('_', ' ');

    return `
    <div class="doc-card ${isSelected ? 'selected' : ''}" data-id="${d.id}" data-estado="${estado}">
      <div class="doc-card-header">
        <div class="doc-card-type">
          <span style="font-size:18px;">${tipoIcon}</span>
          <span>${tipo}</span>
          ${d.doc_num ? `<span class="doc-num">#${d.doc_num}</span>` : ''}
        </div>
        <input type="checkbox" class="doc-card-checkbox doc-row-check" data-id="${d.id}" ${isSelected ? 'checked' : ''} />
      </div>
      <div class="doc-card-client">${esc(cliente)}</div>
      <div class="doc-card-footer">
        <div>
          <div class="doc-card-amount">${fmtMoney(d.total)}</div>
          <div class="doc-card-date">${fmtDate(d.fecha)}</div>
        </div>
        <span class="doc-badge ${estado}">
          <span class="badge-icon">${estadoIcon}</span>
          ${estadoLabel}
        </span>
      </div>
    </div>`;
  }).join('');

  box.innerHTML = bulkBar + selectAllHtml + `<div class="doc-grid">${cards}</div>`;

  // Bind select-all
  const selectAllCb = document.getElementById('doc-select-all');
  if (selectAllCb) {
    selectAllCb.addEventListener('change', () => {
      if (selectAllCb.checked) {
        allIds.forEach(id => selectedDocs.add(id));
      } else {
        allIds.forEach(id => selectedDocs.delete(id));
      }
      renderListToBox(data);
    });
  }

  // Bind row checkboxes
  box.querySelectorAll('.doc-row-check').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const id = parseInt(cb.dataset.id);
      if (cb.checked) {
        selectedDocs.add(id);
      } else {
        selectedDocs.delete(id);
      }
      renderListToBox(data);
    });
  });

  // Bind bulk actions
  const bulkCancel = document.getElementById('doc-bulk-cancel');
  if (bulkCancel) bulkCancel.addEventListener('click', () => { selectedDocs.clear(); renderListToBox(data); });

  const bulkDelete = document.getElementById('doc-bulk-delete');
  if (bulkDelete) bulkDelete.addEventListener('click', async () => {
    if (selectedDocs.size === 0) return;
    if (!confirm(`¿Eliminar ${selectedDocs.size} documento${selectedDocs.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`)) return;
    const ids = Array.from(selectedDocs);
    try {
      for (const id of ids) {
        await eliminarDocumento(id);
      }
      toast(`✅ ${ids.length} documento${ids.length !== 1 ? 's' : ''} eliminado${ids.length !== 1 ? 's' : ''}`, 'success');
      selectedDocs.clear();
      await loadDocList();
    } catch (err) {
      toast('Error al eliminar: ' + (err.message || err), 'error');
    }
  });

  // Agregar eventos de click a las tarjetas
  box.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', async () => {
      // Si ya hay un acordeon abierto despues de esta tarjeta, togglear
      let nextEl = card.nextElementSibling;
      if (nextEl && nextEl.classList.contains('doc-card-expanded')) {
        nextEl.style.display = nextEl.style.display === 'none' ? 'block' : 'none';
        return;
      }
      
      const expandedDiv = document.createElement('div');
      expandedDiv.className = 'doc-card-expanded';
      expandedDiv.style.cssText = 'grid-column:1/-1;background:var(--surface);border:2px solid var(--border-light);border-radius:14px;padding:0;overflow:hidden;animation:slideDown 0.3s ease;';
      
      let detailsDiv = document.createElement('div');
      detailsDiv.className = 'doc-accordion-details';
      detailsDiv.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-soft);font-size:14px;">Cargando detalles...</div>`;
      detailsDiv.addEventListener('click', e => e.stopPropagation());
      expandedDiv.appendChild(detailsDiv);
      card.parentNode.insertBefore(expandedDiv, card.nextSibling);

      try {
        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from('documentos')
          .select('*, clientes(nombre, empresa, telefono, email, direccion), lineas_documento(*)')
          .eq('id', card.dataset.id)
          .single();
        if (error) throw error;
        
        detailsDiv.innerHTML = renderAccordionHTML(data);
        
        const btnEdit = detailsDiv.querySelector('.acc-btn-edit');
        if(btnEdit) btnEdit.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = `/documentos/${data.id}/editar`; });
        const btnComp = detailsDiv.querySelector('.acc-btn-comp');
        if(btnComp) btnComp.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = `/documentos/${data.id}/comprobante`; });
        const btnFac = detailsDiv.querySelector('.acc-btn-factura');
        if(btnFac) btnFac.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm('¿Convertir este documento en Factura? Se cambiará el tipo a FAC manteniendo todos los datos.')) return;
          btnFac.disabled = true;
          btnFac.textContent = '⏳...';
          try {
            const newId = await convertirAFactura(data.id);
            toast('Factura creada correctamente', 'success');
            window.location.hash = '/documentos/' + newId;
          } catch (err) {
            toast('Error al convertir: ' + (err.message || err), 'error');
            btnFac.disabled = false;
            btnFac.textContent = 'Convertir en Factura';
          }
        });

        const btnDel = detailsDiv.querySelector('.acc-btn-delete');
        if(btnDel) btnDel.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`¿Eliminar el documento ${data.doc_type} ${data.doc_num || ''}? Esta acción no se puede deshacer.`)) return;
          btnDel.disabled = true;
          btnDel.textContent = '⏳...';
          try {
            await eliminarDocumento(data.id);
            toast('Documento eliminado', 'success');
            card.remove();
            expandedDiv.remove();
          } catch (err) {
            toast('Error al eliminar: ' + (err.message || err), 'error');
            btnDel.disabled = false;
            btnDel.textContent = 'Eliminar';
          }
        });

        detailsDiv.querySelectorAll('.acc-btn-hacienda').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nuevoEstado = btn.dataset.estado;
            const docId = parseInt(btn.dataset.docid);
            const origHTML = btn.innerHTML;
            btn.innerHTML = '⏳';
            btn.disabled = true;
            try {
              await cambiarEstadoHacienda(docId, nuevoEstado, btn);
              detailsDiv.querySelectorAll('.acc-btn-hacienda').forEach(b => {
                const he = HACIENDA_ESTADOS.find(h => h.value === b.dataset.estado);
                const active = b.dataset.estado === nuevoEstado;
                b.style.borderColor = active ? he.color : '#e2e8f0';
                b.style.background = active ? he.color + '22' : 'white';
                b.style.color = active ? he.color : '#94a3b8';
              });
              await loadDocList();
            } catch (err) {
              toast('Error: ' + (err.message || err), 'error');
            }
            btn.disabled = false;
            btn.innerHTML = origHTML;
          });
        });

        detailsDiv.querySelectorAll('.acc-btn-pago').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const nuevoEstado = btn.dataset.estado;
            const docId = parseInt(btn.dataset.docid);
            const origHTML = btn.innerHTML;
            btn.innerHTML = '⏳';
            btn.disabled = true;
            try {
              await cambiarEstadoPago(docId, nuevoEstado, btn);
              detailsDiv.querySelectorAll('.acc-btn-pago').forEach(b => {
                const info = ESTADO_PAGO[b.dataset.estado];
                const active = b.dataset.estado === nuevoEstado;
                b.style.borderColor = active ? info.color : '#e2e8f0';
                b.style.background = active ? info.color + '22' : 'white';
                b.style.color = active ? info.color : '#94a3b8';
              });
              await loadDocList();
            } catch (err) {
              toast('Error: ' + (err.message || err), 'error');
            }
            btn.disabled = false;
            btn.innerHTML = origHTML;
          });
        });

      } catch (e) {
        detailsDiv.innerHTML = `<div style="color:var(--red);font-size:12px;">Error: ${esc(e.message)}</div>`;
      }
    });
  });
}

function renderAccordionHTML(data) {
  const clienteStr = data.clientes ? (data.clientes.empresa || data.clientes.nombre || '—') : '—';
  const telStr = data.clientes?.telefono || '—';
  const dirStr = data.clientes?.direccion || '—';
  
  let itemsHtml = '<div style="color:var(--text-soft);font-size:14px;padding:16px 0;">No hay ítems registrados</div>';
  const items = data.lineas_documento || data.items || [];
  if (items && items.length) {
    itemsHtml = `
      <table style="width:100%; border-collapse:collapse; margin-top:10px; font-size:13px;">
        <thead>
          <tr style="border-bottom:2px solid var(--border-light); color:var(--text-soft); text-align:left;">
            <th style="padding:10px 8px;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Descripción</th>
            <th style="padding:10px 8px;text-align:center;font-weight:700;font-size:12px;width:60px;text-transform:uppercase;">Cant.</th>
            <th style="padding:10px 8px;text-align:right;font-weight:700;font-size:12px;width:100px;text-transform:uppercase;">Precio</th>
            <th style="padding:10px 8px;text-align:right;font-weight:700;font-size:12px;width:110px;text-transform:uppercase;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr style="border-bottom:1px solid rgba(0,0,0,0.04);">
              <td style="padding:12px 8px; color:var(--text);font-weight:600;">${esc(it.descripcion)}</td>
              <td style="padding:12px 8px; text-align:center; color:var(--text-mid);font-weight:600;">${it.cantidad}</td>
              <td style="padding:12px 8px; text-align:right; color:var(--text-mid);">${fmtMoney(it.precio_unitario)}</td>
              <td style="padding:12px 8px; text-align:right; font-weight:800; color:var(--navy);font-size:14px;">${fmtMoney(it.cantidad * it.precio_unitario)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <div style="padding:24px 28px;">
      <div style="display:flex; gap:28px; align-items:flex-start; flex-wrap:wrap; margin-bottom:20px;">
        <div style="flex:1; min-width:240px;">
          <div style="font-size:13px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:10px;">Datos del Cliente</div>
          <div style="font-size:17px; font-weight:800; color:var(--navy); margin-bottom:8px; letter-spacing:-0.01em;">${esc(clienteStr)}</div>
          <div style="font-size:14px; color:var(--text-mid); margin-bottom:6px; display:flex; align-items:center; gap:8px;"><span style="font-size:16px;">📞</span> ${esc(telStr)}</div>
          <div style="font-size:14px; color:var(--text-mid); display:flex; align-items:center; gap:8px;"><span style="font-size:16px;">📍</span> ${esc(dirStr)}</div>
          <div style="margin-top:20px; display:flex; gap:10px; flex-wrap:wrap;">
            <button class="btn btn-primary acc-btn-edit" style="padding:10px 18px; font-size:13px; font-weight:700; border-radius:8px;">✏️ Editar Documento</button>
            <button class="btn acc-btn-comp" style="padding:10px 18px; font-size:13px; font-weight:700; border-radius:8px; border:2px solid var(--border-light); background:var(--surface); color:var(--navy);">📄 Ver Comprobante</button>
            ${data.doc_type !== 'FAC' ? `<button class="btn acc-btn-factura" style="padding:10px 18px; font-size:13px; font-weight:700; border-radius:8px; border:2px solid #8b5cf6; background:#f3e8ff; color:#581c87;">🧾 Convertir en Factura</button>` : ''}
            <button class="btn acc-btn-delete" style="padding:10px 18px; font-size:13px; font-weight:700; border-radius:8px; border:2px solid #ef4444; background:#fee2e2; color:#7f1d1d;">🗑 Eliminar</button>
          </div>
        </div>
      </div>

      <div style="background:var(--surface); border:2px solid var(--border-light); border-radius:12px; padding:16px 20px; margin-bottom:20px;">
        <div style="font-size:13px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:6px;">Detalle de Ítems</div>
        ${itemsHtml}
      </div>

      ${(data.doc_type === 'PRO' || data.doc_type === 'FAC') ? `
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
        ${data.doc_type === 'PRO' ? `
        <div style="background:var(--surface-2); border:2px solid var(--border-light); border-radius:12px; padding:18px 20px;">
          <div style="font-size:13px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">🏛️ Hacienda</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
            ${HACIENDA_ESTADOS.map(e => {
              const isActive = (data.estado_hacienda || 'sin_enviar') === e.value;
              return `<button class="btn acc-btn-hacienda" data-estado="${e.value}" data-docid="${data.id}" style="padding:12px 16px; font-size:13px; font-weight:700; border-radius:10px; border:2px solid ${isActive ? e.color : '#e2e8f0'}; background:${isActive ? e.color + '22' : 'var(--surface)'}; color:${isActive ? e.color : '#94a3b8'}; cursor:pointer; text-align:center;">${e.label}</button>`;
            }).join('')}
          </div>
        </div>
        ` : ''}
        ${data.doc_type === 'FAC' ? `
        <div style="background:var(--surface-2); border:2px solid var(--border-light); border-radius:12px; padding:18px 20px;">
          <div style="font-size:13px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:14px;">💳 Estado de Pago</div>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(120px, 1fr)); gap:10px;">
            ${Object.entries(ESTADO_PAGO).map(([value, info]) => {
              const isActive = (data.estado || 'pendiente') === value;
              return `<button class="btn acc-btn-pago" data-estado="${value}" data-docid="${data.id}" style="padding:12px 16px; font-size:13px; font-weight:700; border-radius:10px; border:2px solid ${isActive ? info.color : '#e2e8f0'}; background:${isActive ? info.color + '22' : 'var(--surface)'}; color:${isActive ? info.color : '#94a3b8'}; cursor:pointer; text-align:center;">${info.label}</button>`;
            }).join('')}
          </div>
        </div>
        ` : ''}
      </div>
      ` : ''}
    </div>
  `;
}

function renderDocDetail(data, shell) {
  shell.setTitle(`Documento ${data.doc_type} ${data.doc_num || ''}`);
  const c = shell.content();
  const estado = data.estado || 'pendiente';
  const clr = ESTADO_COLOR[estado] || '#94a3b8';
  
  c.innerHTML = `
    <div class="detail-hero" style="align-items: flex-start;">
      <div style="display: flex; gap: 24px; flex: 1 1 300px; min-width: 280px;">
        <div class="detail-hero-avatar" style="font-size:28px;"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div>
        <div class="detail-hero-info">
          <div class="detail-hero-name" style="font-size: clamp(20px, 2vw, 24px);">${data.doc_type} ${data.doc_num ? `N° ${data.doc_num}` : ''}</div>
          <div class="detail-hero-sub" style="margin-top: 12px;">
            <span><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg> ${fmtDate(data.fecha)}</span>
            <span style="background:${clr}22;color:${clr};border-color:${clr}44;">● ${estado}</span>
            <span><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ${fmtMoney(data.total)}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 20px;">
        <div class="detail-hero-actions" style="margin-left: 0;">
          <button class="hero-btn hero-btn-main" id="btn-edit-doc"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar</button>
          <button class="hero-btn hero-btn-edit" id="btn-comp-doc"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Comprobante</button>
          ${data.doc_type !== 'FAC' ? `<button class="hero-btn hero-btn-main" id="btn-convert-factura" style="background:#6366f1;border-color:#6366f1;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99.5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-3 3 3 3-3 3 3z"></path></svg> Convertir en Factura</button>` : `<button class="hero-btn" id="btn-comprobante-electronico" style="background:#059669;border-color:#059669;color:white;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.062-.18-2.082-.512-3.04z"></path></svg> Comprobante Electrónico</button>`}
          <button class="hero-btn" id="btn-delete-doc" style="background:#ef4444;border-color:#ef4444;color:white;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar</button>
        </div>
      </div>
    </div>

    ${data.doc_type === 'PRO' ? `
    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.062-.18-2.082-.512-3.04z"></path></svg> Estado Hacienda</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
        ${HACIENDA_ESTADOS.map(e => {
          const isActive = (data.estado_hacienda || 'sin_enviar') === e.value;
          return `<button class="btn btn-estado-hacienda" data-estado="${e.value}" style="padding:12px 16px;font-size:13px;font-weight:700;border-radius:10px;border:2px solid ${isActive ? e.color : '#e2e8f0'};background:${isActive ? e.color + '22' : 'white'};color:${isActive ? e.color : '#64748b'};cursor:pointer;text-align:center;">${e.label}</button>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    ${data.doc_type === 'FAC' ? `
    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path></svg> Estado de Pago</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
        ${Object.entries(ESTADO_PAGO).map(([value, info]) => {
          const isActive = (data.estado || 'pendiente') === value;
          return `<button class="btn btn-estado-pago" data-estado="${value}" style="padding:12px 16px;font-size:13px;font-weight:700;border-radius:10px;border:2px solid ${isActive ? info.color : '#e2e8f0'};background:${isActive ? info.color + '22' : 'white'};color:${isActive ? info.color : '#64748b'};cursor:pointer;text-align:center;">${info.label}</button>`;
        }).join('')}
      </div>
    </div>
    ` : ''}

    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> Cliente</div>
      <div class="detail-info-grid">
        <div class="detail-info-item"><div class="detail-info-label">Nombre / Empresa</div><div class="detail-info-value">${esc(data.clientes?.empresa || data.clientes?.nombre || 'Sin cliente')}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">Teléfono</div><div class="detail-info-value">${esc(data.clientes?.telefono || '—')}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">Email</div><div class="detail-info-value">${esc(data.clientes?.email || '—')}</div></div>
        <div class="detail-info-item full-width"><div class="detail-info-label">Dirección</div><div class="detail-info-value">${esc(data.clientes?.direccion || '—')}</div></div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg> Ítems del Documento</div>
      ${(data.lineas_documento || data.items)?.length ? `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Descripción</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Total</th></tr></thead>
            <tbody>
              ${(data.lineas_documento || data.items).map(item => `
                <tr>
                  <td>${esc(item.descripcion)}</td>
                  <td style="text-align:center;">${item.cantidad}</td>
                  <td style="text-align:right;">${fmtMoney(item.precio_unitario || item.precio)}</td>
                  <td style="text-align:right;font-weight:var(--fw-bold);color:var(--navy);">${fmtMoney((item.precio_unitario || item.precio) * item.cantidad)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div style="text-align:center;padding:var(--sp-6);color:var(--text-soft);font-size:var(--fs-sm);">No hay ítems registrados</div>'}
    </div>
  `;

  const btnEditDoc = document.getElementById('btn-edit-doc');
  if (btnEditDoc) btnEditDoc.addEventListener('click', () => { window.location.hash = `/documentos/${data.id}/editar`; });

  const btnCompDoc = document.getElementById('btn-comp-doc');
  if (btnCompDoc) btnCompDoc.addEventListener('click', () => { window.location.hash = `/documentos/${data.id}/comprobante`; });

  const btnConvert = document.getElementById('btn-convert-factura');
  if (btnConvert) {
    btnConvert.addEventListener('click', async () => {
      if (!confirm('¿Convertir este documento en Factura? Se cambiará el tipo a FAC manteniendo todos los datos.')) return;
      btnConvert.disabled = true;
      btnConvert.textContent = '⏳ Convirtiendo...';
      try {
        const newId = await convertirAFactura(data.id);
        toast('Documento convertido a Factura', 'success');
        window.location.hash = '/documentos/' + newId;
      } catch (e) {
        toast('Error al convertir: ' + (e.message || e), 'error');
        btnConvert.disabled = false;
        btnConvert.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 14l6-6m-5.5.5h.01m4.99.5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3-3 3 3 3-3 3 3z"></path></svg> Convertir en Factura';
      }
    });
  }

  const btnCompElec = document.getElementById('btn-comprobante-electronico');
  if (btnCompElec) {
    btnCompElec.addEventListener('click', () => {
      toast('Próximamente: Generación de comprobante electrónico Hacienda', 'warn');
    });
  }

  const btnDelete = document.getElementById('btn-delete-doc');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      if (!confirm(`¿Eliminar el documento ${data.doc_type} ${data.doc_num || ''}? Esta acción no se puede deshacer.`)) return;
      btnDelete.disabled = true;
      btnDelete.textContent = '⏳ Eliminando...';
      try {
        await eliminarDocumento(data.id);
        toast('Documento eliminado', 'success');
        window.location.hash = '/documentos';
      } catch (e) {
        toast('Error al eliminar: ' + (e.message || e), 'error');
        btnDelete.disabled = false;
        btnDelete.innerHTML = '<svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar';
      }
    });
  }

  document.querySelectorAll('.btn-estado-hacienda').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nuevoEstado = btn.dataset.estado;
      const origHTML = btn.innerHTML;
      btn.innerHTML = '⏳';
      btn.disabled = true;
      try {
        await cambiarEstadoHacienda(data.id, nuevoEstado, btn);
        document.querySelectorAll('.btn-estado-hacienda').forEach(b => {
          const e = HACIENDA_ESTADOS.find(h => h.value === b.dataset.estado);
          const active = b.dataset.estado === nuevoEstado;
          b.style.borderColor = active ? e.color : '#e2e8f0';
          b.style.background = active ? e.color + '22' : 'white';
          b.style.color = active ? e.color : '#64748b';
        });
        await loadDocList();
      } catch (err) {
        toast('Error: ' + (err.message || err), 'error');
        btn.innerHTML = origHTML;
      }
      btn.disabled = false;
      btn.innerHTML = origHTML;
    });
  });

  document.querySelectorAll('.btn-estado-pago').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nuevoEstado = btn.dataset.estado;
      const origHTML = btn.innerHTML;
      btn.innerHTML = '⏳';
      btn.disabled = true;
      try {
        await cambiarEstadoPago(data.id, nuevoEstado, btn);
        document.querySelectorAll('.btn-estado-pago').forEach(b => {
          const info = ESTADO_PAGO[b.dataset.estado];
          const active = b.dataset.estado === nuevoEstado;
          b.style.borderColor = active ? info.color : '#e2e8f0';
          b.style.background = active ? info.color + '22' : 'white';
          b.style.color = active ? info.color : '#64748b';
        });
        await loadDocList();
      } catch (err) {
        toast('Error: ' + (err.message || err), 'error');
        btn.innerHTML = origHTML;
      }
      btn.disabled = false;
      btn.innerHTML = origHTML;
    });
  });
}