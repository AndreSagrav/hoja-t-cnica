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
  <div class="crm-header" style="height: auto; padding: 16px 24px;">
    <div style="display: flex; align-items: center; gap: 16px;">
      <div style="background: rgba(255,255,255,0.1); width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px); border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <svg width="22" height="22" fill="none" stroke="white" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      </div>
      <div>
        <h2 style="font-size: 20px; font-weight: 800; letter-spacing: -0.5px; margin: 0; display: flex; align-items: center; gap: 10px;">
          Gestión de Documentos
          <span class="crm-header-count" id="doc-count" style="font-size: 11px; padding: 3px 12px; margin-left: 4px;">—</span>
        </h2>
        <div style="font-size: 12px; color: rgba(255,255,255,0.7); font-weight: 500; margin-top: 3px;">
          Control y seguimiento unificado de todas las transacciones
        </div>
      </div>
    </div>
  </div>
  <div class="crm-kpi-row" id="doc-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane" style="width:100%;border-right:none;">
      <div class="crm-search-bar" style="display:flex; gap:16px; align-items:center; border-bottom:1px solid var(--border-light); padding:16px 24px; background:var(--surface);">
        <input class="crm-search-input" id="doc-search" placeholder="🔍  Buscar por número o cliente…" style="flex:1; max-width: 400px; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); font-size: 13px;" />
        <div style="width:1px; height:24px; background:var(--border-light); margin: 0 4px;"></div>
        <div id="doc-tipo-filters" style="display:flex; align-items:center;"></div>
        <div id="doc-estado-filters" style="display:flex; align-items:center;"></div>
      </div>
      <div class="crm-list-scroll" id="doc-list" style="position: relative;">
        <div class="doc-grid-header" style="display: grid; grid-template-columns: 150px 1fr 100px 130px 100px; gap: 20px; padding: 12px 24px; border-bottom: 1px solid var(--border-light); border-left: 4px solid transparent; background: var(--surface-2); font-size: 10px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px; align-items: center; position: sticky; top: 0; z-index: 10;">
          <div style="padding-left: 24px;">Tipo / ID Documento</div>
          <div style="padding-left: 16px;">Cliente / Proveedor</div>
          <div style="text-align: right;">Fecha</div>
          <div style="text-align: right;">Monto</div>
          <div style="text-align: center;">Estado</div>
        </div>
        <div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></div><div class="crm-empty-text">Cargando…</div></div>
      </div>
    </div>
  </div>
</div>`;

  // Agregar evento al botón del asistente
  setTimeout(() => {
    const btnAsistente = document.getElementById('btn-asistente-ot');
    if (btnAsistente) {
      btnAsistente.addEventListener('click', () => {
        window.location.hash = '/asistente-ot';
      });
    }
  }, 0);

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
    
    // Renderizar el detalle del documento
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
  const tipos   = [['','Todos'],['OT','OT'],['PRO','Doc. Electrónicos'],['FAC','Facturas sin IVA'],['COT','Cotización']];
  const estados = [['','Todos estados'],['pendiente','Pendiente'],['en_progreso','En progreso'],['completado','Completado'],['facturado','Facturado'],['cancelado','Cancelado']];
  document.getElementById('doc-tipo-filters').innerHTML = `
    <select id="select-tipo" style="padding: 10px 36px 10px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface) url('data:image/svg+xml;utf8,<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23475569\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>') no-repeat right 12px center; appearance: none; color: var(--text-mid); font-size: 13px; outline: none; cursor: pointer; min-width: 180px; font-weight: 600;">
      ${tipos.map(([v,l]) => `<option value="${v}" ${docState.tipo===v?'selected':''}>${l}</option>`).join('')}
    </select>
  `;
  document.getElementById('doc-estado-filters').innerHTML = `
    <select id="select-estado" style="padding: 10px 36px 10px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface) url('data:image/svg+xml;utf8,<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23475569\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>') no-repeat right 12px center; appearance: none; color: var(--text-mid); font-size: 13px; outline: none; cursor: pointer; min-width: 180px; font-weight: 600;">
      ${estados.map(([v,l]) => `<option value="${v}" ${docState.estado===v?'selected':''}>${l}</option>`).join('')}
    </select>
  `;
  
  document.getElementById('select-tipo').addEventListener('change', (e) => {
    docState.tipo = e.target.value;
    loadDocList();
  });
  document.getElementById('select-estado').addEventListener('change', (e) => {
    docState.estado = e.target.value;
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

    document.getElementById('doc-count').textContent = count ?? data.length;
    renderDocKPIs(data || []);
    renderListToBox(data || []);
  } catch (e) {
    console.error("Error al cargar documentos reales de Supabase:", e);
    toast("Error al conectar con Supabase: " + (e.message || e), "error");
    if (box) {
      box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon" style="color:var(--red);">⚠️</div><div class="crm-empty-text" style="color:var(--red);">Error de Supabase: ${esc(e.message || String(e))}</div></div>`;
    }
  } finally {
    docState.loading = false;
  }
}

function renderDocKPIs(data) {
  // Renderizar KPIs
  const kpiBox = document.getElementById('doc-kpis');
  if (!kpiBox) return;
  
  // Calcular totales por estado
  const estados = {};
  data.forEach(d => {
    const e = d.estado || 'pendiente';
    estados[e] = (estados[e] || 0) + 1;
  });
  
  kpiBox.innerHTML = `
    <div class="crm-kpi">
      <div class="crm-kpi-label">Total documentos</div>
      <div class="crm-kpi-value">${data.length}</div>
    </div>
    ${Object.entries(estados).map(([estado, count]) => `
      <div class="crm-kpi">
        <div class="crm-kpi-label">${estado}</div>
        <div class="crm-kpi-value">${count}</div>
      </div>
    `).join('')}
  `;
}

function renderListToBox(data) {
  const box = document.getElementById('doc-list');
  
  if (!data.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><div class="crm-empty-text">Sin resultados</div></div>`; return;
  }
  
  const thead = `
    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
      <thead style="position: sticky; top: 0; z-index: 10; background: var(--surface-2); border-bottom: 1px solid var(--border-light);">
        <tr style="font-size: 10px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; letter-spacing: 0.5px;">
          <th style="padding: 12px 24px; width: 140px;">
            <div style="line-height: 1.4;">Tipo<br><span style="font-weight:600;font-size:9px;">N° Documento</span></div>
          </th>
          <th style="padding: 12px 24px;">Cliente / Proveedor</th>
          <th style="padding: 12px 24px; width: 100px; text-align: center;">Fecha</th>
          <th style="padding: 12px 24px; width: 130px; text-align: right;">Monto</th>
          <th style="padding: 12px 24px; width: 100px; text-align: center;">Estado</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  const rows = data.map(d => {
    const tipo    = d.doc_type || 'DEF';
    const cliente = d.clientes?.empresa || d.clientes?.nombre || '—';
    const estado  = d.estado || 'pendiente';
    const clr = ESTADO_COLOR[estado] || '#94a3b8';
    const bg  = ESTADO_BG[estado]    || '#f8fafd';
    
    return `
    <tr class="crm-table-row" data-id="${d.id}" style="background:${bg}11; border-bottom: 1px solid var(--border-light); cursor:pointer; transition:background 0.2s ease;">
      <td style="padding: 14px 24px; border-left: 4px solid ${clr};">
        <div style="display:flex; align-items:flex-start; gap:8px; font-weight:800; color:var(--navy); font-size:12px; letter-spacing:-0.01em;">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--text-soft);margin-top:1px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          <div style="word-wrap: break-word;">
            ${tipo} ${d.doc_num ? `<br><span style="color:var(--text-soft);font-weight:600;font-size:11px;">N° ${d.doc_num}</span>` : ''}
          </div>
        </div>
      </td>
      <td style="padding: 14px 24px;">
        <div style="font-weight:700; font-size:13px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:280px;">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--text-soft);margin-right:4px;vertical-align:-1px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          ${esc(cliente)}
        </div>
      </td>
      <td style="padding: 14px 24px; color:var(--text-mid); font-weight:500; font-size:11px; text-align:center;">
        ${fmtDate(d.fecha)}
      </td>
      <td style="padding: 14px 24px; font-size:14px; font-weight:900; color:var(--navy); text-align:right; letter-spacing:-0.02em;">
        ${fmtMoney(d.total)}
      </td>
      <td style="padding: 14px 24px; text-align:center;">
        <div style="display:inline-block; color:${clr}; font-weight:800; font-size:10px; text-transform:uppercase; letter-spacing:0.5px; background:${bg}; padding:4px 10px; border-radius:100px; text-align:center; box-shadow:inset 0 0 0 1px ${clr}40;">
          ${estado.replace('_',' ')}
        </div>
      </td>
    </tr>`;
  }).join('');
  
  box.innerHTML = `<style>.crm-table-row:hover { background: var(--surface-2) !important; }</style>` + thead + rows + `</tbody></table>`;
  
  // Agregar eventos de click
  box.querySelectorAll('.crm-table-row').forEach(row => {
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
      detailsDiv.style = "padding: 0 20px 20px 20px; cursor: default; animation: slideDown 0.3s ease;";
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