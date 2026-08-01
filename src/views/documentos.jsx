import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { fmtMoney, fmtDate, esc, toast, debounce } from '../lib/utils.js';

const PAGE_SIZE = 80;
const ESTADO_COLOR = { pendiente:'#f59e0b', en_proceso:'#3b82f6', completado:'#10b981', facturado:'#6366f1', cancelado:'#ef4444' };
const ESTADO_BG    = { pendiente:'#fff7ed', en_proceso:'#eff6ff', completado:'#f0fdf4', facturado:'#f5f3ff', cancelado:'#fef2f2' };

let docState = { search:'', tipo:'', estado:'', loading:false };

export async function documentosListView() {
  docState = { search:'', tipo:'', estado:'', loading:false };
  const shell = ensureShell('/documentos');
  shell.setTitle(''); 
  shell.setActions('');
  const c = shell.content();

  c.innerHTML = `
<div class="crm-panel">
  <div class="crm-header">
    <h2>📄 Gestión de Documentos <span class="crm-header-count" id="doc-count">—</span></h2>
    <div class="crm-header-actions">
      <button class="crm-action-btn primary" id="doc-new-btn" style="flex:none;">＋ Nuevo Documento</button>
    </div>
  </div>
  <div class="crm-kpi-row" id="doc-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane" style="width:100%;border-right:none;">
      <div class="crm-search-bar">
        <div class="crm-search-wrap">
          <svg class="crm-search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input class="crm-search-input" id="doc-search" placeholder="Buscar por número o cliente…" />
        </div>
        <div class="crm-search-row2">
          <div class="crm-filter-tabs" id="doc-tipo-filters"></div>
          <div class="crm-filter-tabs" id="doc-estado-filters"></div>
        </div>
      </div>
      <div class="crm-list-scroll" id="doc-list">
        <div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div><div class="crm-empty-text">Cargando…</div></div>
      </div>
    </div>
  </div>
</div>`;

  document.getElementById('doc-new-btn').addEventListener('click', () => {
    window.location.hash = '/wizard/nuevo';
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
        items(*)
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
    `<button class="crm-filter-tab ${docState.tipo === v ? 'active' : ''}" data-tipo="${v}">${l}</button>`
  ).join('');

  document.getElementById('doc-estado-filters').innerHTML = estados.map(([v, l]) =>
    `<button class="crm-filter-tab ${docState.estado === v ? 'active' : ''}" data-estado="${v}">${l}</button>`
  ).join('');

  document.getElementById('doc-tipo-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.crm-filter-tab');
    if (!btn) return;
    docState.tipo = btn.dataset.tipo;
    renderDocFilters();
    loadDocList();
  });

  document.getElementById('doc-estado-filters').addEventListener('click', (e) => {
    const btn = e.target.closest('.crm-filter-tab');
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
    <div class="crm-kpi">
      <div class="crm-kpi-icon blue"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg></div>
      <div><div class="crm-kpi-label">Total</div><div class="crm-kpi-value">${counts.total}</div></div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-icon amber"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div><div class="crm-kpi-label">Pendientes</div><div class="crm-kpi-value">${counts.pendiente}</div></div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-icon purple"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg></div>
      <div><div class="crm-kpi-label">En progreso</div><div class="crm-kpi-value">${counts.en_progreso}</div></div>
    </div>
    <div class="crm-kpi">
      <div class="crm-kpi-icon green"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg></div>
      <div><div class="crm-kpi-label">Completados</div><div class="crm-kpi-value">${counts.completado}</div></div>
    </div>`;
}

function renderListToBox(data) {
  const box = document.getElementById('doc-list');
  if (!box) return;

  if (!data.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><div class="crm-empty-text">Sin resultados</div></div>`; return;
  }

  const thead = `
    <div class="doc-table-wrap">
    <table class="doc-table">
      <thead>
        <tr>
          <th style="width: 140px;">Tipo / ID</th>
          <th>Cliente / Proveedor</th>
          <th style="width: 110px; text-align: center;">Fecha</th>
          <th style="width: 130px; text-align: right;">Monto</th>
          <th style="width: 120px; text-align: center;">Estado</th>
        </tr>
      </thead>
      <tbody>
  `;

  const rows = data.map(d => {
    const tipo = d.doc_type || 'DEF';
    const cliente = d.clientes?.empresa || d.clientes?.nombre || '—';
    const estado = d.estado || 'pendiente';
    const badgeClass = `doc-badge ${estado}`;

    return `
    <tr class="doc-table-row" data-id="${d.id}">
      <td>
        <div style="font-weight:800; color:var(--navy); font-size:12px;">
          ${tipo} ${d.doc_num ? `<span style="color:var(--text-soft);font-weight:600;font-size:11px;">#${d.doc_num}</span>` : ''}
        </div>
      </td>
      <td>
        <div style="font-weight:700; font-size:13px; color:var(--text);">
          ${esc(cliente)}
        </div>
      </td>
      <td style="color:var(--text-mid); font-weight:500; font-size:11px; text-align:center;">
        ${fmtDate(d.fecha)}
      </td>
      <td style="font-size:14px; font-weight:900; color:var(--navy); text-align:right;">
        ${fmtMoney(d.total)}
      </td>
      <td style="text-align:center;">
        <span class="${badgeClass}">
          ${estado.replace('_', ' ')}
        </span>
      </td>
    </tr>`;
  }).join('');

  box.innerHTML = thead + rows + `</tbody></table></div>`;
  
  // Agregar eventos de click
  box.querySelectorAll('.doc-table-row').forEach(row => {
    row.addEventListener('click', async () => {
      let nextTr = row.nextElementSibling;
      if (nextTr && nextTr.classList.contains('doc-accordion-row')) {
        nextTr.style.display = nextTr.style.display === 'none' ? 'table-row' : 'none';
        return;
      }
      
      const detailsRow = document.createElement('tr');
      detailsRow.className = 'doc-accordion-row';
      const detailsCell = document.createElement('td');
      detailsCell.colSpan = 5;
      detailsCell.style.padding = '0';
      detailsRow.appendChild(detailsCell);
      
      let detailsDiv = document.createElement('div');
      detailsDiv.className = 'doc-accordion-details';
      detailsDiv.innerHTML = `<div style="padding:10px;text-align:center;color:var(--text-soft);font-size:11px;">Cargando detalles...</div>`;
      detailsDiv.addEventListener('click', e => e.stopPropagation());
      detailsCell.appendChild(detailsDiv);
      row.parentNode.insertBefore(detailsRow, row.nextSibling);

      try {
        const supabase = await getSupabase();
        const { data, error } = await supabase
          .from('documentos')
          .select('*, clientes(nombre, empresa, telefono, email, direccion), items(*)')
          .eq('id', row.dataset.id)
          .single();
        if (error) throw error;
        
        detailsDiv.innerHTML = renderAccordionHTML(data);
        
        const btnEdit = detailsDiv.querySelector('.acc-btn-edit');
        if(btnEdit) btnEdit.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = `/documentos/${data.id}/editar`; });
        const btnComp = detailsDiv.querySelector('.acc-btn-comp');
        if(btnComp) btnComp.addEventListener('click', (e) => { e.stopPropagation(); window.location.hash = `/documentos/${data.id}/comprobante`; });

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
  
  let itemsHtml = '<div style="color:var(--text-soft);font-size:11px;padding:10px 0;">No hay ítems registrados</div>';
  if (data.items && data.items.length) {
    itemsHtml = `
      <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:11px;">
        <thead>
          <tr style="border-bottom:1px solid var(--border-light); color:var(--text-soft); text-align:left;">
            <th style="padding:6px 4px;font-weight:600;">Descripción</th>
            <th style="padding:6px 4px;text-align:center;font-weight:600;width:40px;">Cant.</th>
            <th style="padding:6px 4px;text-align:right;font-weight:600;width:70px;">Precio</th>
            <th style="padding:6px 4px;text-align:right;font-weight:600;width:80px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map(it => `
            <tr style="border-bottom:1px solid rgba(0,0,0,0.03);">
              <td style="padding:8px 4px; color:var(--text-mid);">${esc(it.descripcion)}</td>
              <td style="padding:8px 4px; text-align:center; color:var(--text-mid);">${it.cantidad}</td>
              <td style="padding:8px 4px; text-align:right; color:var(--text-mid);">${fmtMoney(it.precio_unitario)}</td>
              <td style="padding:8px 4px; text-align:right; font-weight:700; color:var(--navy);">${fmtMoney(it.cantidad * it.precio_unitario)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  return `
    <div style="border-top:1px dashed var(--border-light); padding-top:16px; display:flex; gap:32px; align-items:flex-start;">
      <div style="flex:1;">
        <div style="font-size:10px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">Datos del Cliente</div>
        <div style="font-size:13px; font-weight:800; color:var(--navy); margin-bottom:4px; letter-spacing:-0.01em;">${esc(clienteStr)}</div>
        <div style="font-size:11px; color:var(--text-mid); margin-bottom:4px;"><span style="color:var(--text-soft);margin-right:4px;">📞</span> ${esc(telStr)}</div>
        <div style="font-size:11px; color:var(--text-mid);"><span style="color:var(--text-soft);margin-right:4px;">📍</span> ${esc(dirStr)}</div>
        <div style="margin-top:16px; display:flex; gap:8px;">
          <button class="btn btn-primary acc-btn-edit" style="padding:5px 12px; font-size:10px;"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right:4px;vertical-align:-2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar Documento</button>
          <button class="btn acc-btn-comp" style="padding:5px 12px; font-size:10px; border:1px solid var(--border); background:white;"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="margin-right:4px;vertical-align:-2px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Ver Comprobante</button>
        </div>
      </div>
      <div style="flex:2; background:var(--surface); border:1px solid var(--border-light); border-radius:8px; padding:12px 16px; box-shadow:var(--shadow-xs);">
        <div style="font-size:10px; font-weight:800; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Detalle de Ítems</div>
        ${itemsHtml}
      </div>
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
          <button class="hero-btn hero-btn-main" onclick="window.location.hash='/documentos/${data.id}/editar'"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar</button>
          <button class="hero-btn hero-btn-edit" onclick="window.location.hash='/documentos/${data.id}/comprobante'"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Comprobante</button>
        </div>
      </div>
    </div>

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
      ${data.items?.length ? `
        <div class="table-wrap">
          <table class="data">
            <thead><tr><th>Descripción</th><th style="text-align:center;">Cant.</th><th style="text-align:right;">Precio</th><th style="text-align:right;">Total</th></tr></thead>
            <tbody>
              ${data.items.map(item => `
                <tr>
                  <td>${esc(item.descripcion)}</td>
                  <td style="text-align:center;">${item.cantidad}</td>
                  <td style="text-align:right;">${fmtMoney(item.precio)}</td>
                  <td style="text-align:right;font-weight:var(--fw-bold);color:var(--navy);">${fmtMoney(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div style="text-align:center;padding:var(--sp-6);color:var(--text-soft);font-size:var(--fs-sm);">No hay ítems registrados</div>'}
    </div>
  `;
}