import { ensureShell } from "../components/shell.js";
import { getSupabase, withTimeout } from "../lib/supabase.js";
import { esc, debounce, toast } from "../lib/utils.js";
import { parseUsuarios } from "../data/documentos.js";
import { asignarCodigoFiscal } from "../lib/hacienda.js";
import { consultarIdentificacionHacienda } from "../lib/hacienda-api.js";

let items = [], selectedId = null, search = "", typeFilter = "todos";

export async function clientesListView() {
  const shell = ensureShell("/clientes");
  shell.setTitle(""); shell.setActions("");
  const c = shell.content();
  c.innerHTML = `
<div class="crm-panel">
  <div class="crm-header">
    <h2>👥 Directorio de Clientes <span class="crm-header-count" id="cli-count">—</span></h2>
    <div class="crm-header-actions">
      <button class="crm-action-btn primary" id="cli-new-btn" style="flex:none;">＋ Nuevo Cliente</button>
    </div>
  </div>
  <div class="crm-kpi-row" id="cli-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane">
      <div class="crm-search-bar" style="display:flex; gap:16px; align-items:center; border-bottom:1px solid var(--border-light); padding:16px 24px; background:var(--surface);">
        <input class="crm-search-input" id="cli-search" placeholder="🔍  Buscar por nombre, empresa o contacto…" style="flex:1; max-width: 400px; padding: 10px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); font-size: 13px;" />
        <div style="width:1px; height:24px; background:var(--border-light); margin: 0 4px;"></div>
        <div id="cli-filters" style="display:flex; align-items:center;">
          <select id="select-cli-type" style="padding: 10px 36px 10px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface) url('data:image/svg+xml;utf8,<svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%23475569\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 9l6 6 6-6\"/></svg>') no-repeat right 12px center; appearance: none; color: var(--text-mid); font-size: 13px; outline: none; cursor: pointer; min-width: 180px; font-weight: 600;">
            <option value="todos">Todos los clientes</option>
            <option value="empresarial">🏢 Empresariales</option>
            <option value="residencial">🏠 Residenciales</option>
          </select>
        </div>
      </div>
      <div class="crm-list-scroll" id="cli-list">
        <div class="crm-empty"><div class="crm-empty-icon">👥</div><div class="crm-empty-text">Cargando…</div></div>
      </div>
    </div>
    <div class="crm-detail-pane" id="cli-detail">
      <div class="crm-placeholder">
        <div class="crm-placeholder-icon">👥</div>
        <div class="crm-placeholder-text">Seleccioná un cliente</div>
        <div class="crm-placeholder-sub">Hacé clic en cualquier cliente para ver su perfil completo, historial e información de contacto.</div>
      </div>
    </div>
  </div>
</div>`;

  document.getElementById("cli-new-btn").addEventListener("click", () => showForm(null));
  document.getElementById("cli-search").addEventListener("input", debounce(e => { search = e.target.value.trim().toLowerCase(); renderList(); }, 220));
  
  document.getElementById("select-cli-type").addEventListener("change", (e) => {
    typeFilter = e.target.value;
    renderList();
  });

  loadData();
}

async function loadData() {
  const listEl = document.getElementById("cli-list");
  try {
    const supabase = await getSupabase();
    const result = await withTimeout(
      supabase.from("clientes").select("*").order("nombre"),
      5000,
      { data: [], error: null }
    );
    const { data, error } = result;
    if (error) throw error;
    items = (data || []).map(c => ({
      ...c,
      usuarios_autorizados: parseUsuarios(c.usuarios_autorizados)
    }));
  } catch (err) {
    console.error("Error al cargar clientes reales de Supabase:", err);
    toast("Error de conexión con Supabase: " + (err.message || err), "error");
    items = [];
    if (listEl) {
      listEl.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon" style="color:var(--red);">⚠️</div><div class="crm-empty-text" style="color:var(--red);">Error de Supabase: ${esc(err.message || String(err))}</div></div>`;
      return;
    }
  }
  renderAll();
}

function renderAll() {
  const countEl = document.getElementById("cli-count");
  if (countEl) countEl.textContent = items.length;
  renderKPIs();
  renderList();
}

function renderKPIs() {
  const kpis = document.getElementById("cli-kpis");
  if (!kpis) return;
  const activeEmp = items.filter(c => c.tipo_cliente === "empresarial").length;
  const activeRes = items.filter(c => c.tipo_cliente === "residencial").length;
  kpis.innerHTML = `
    <div class="crm-kpi"><div class="crm-kpi-icon blue"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg></div><div><div class="crm-kpi-label">Total Clientes</div><div class="crm-kpi-value">${items.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon green"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z"></path></svg></div><div><div class="crm-kpi-label">Empresariales</div><div class="crm-kpi-value">${activeEmp}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon purple"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg></div><div><div class="crm-kpi-label">Residenciales</div><div class="crm-kpi-value">${activeRes}</div></div></div>`;
}

function renderList() {
  let filtered = items;
  if (typeFilter !== "todos") filtered = filtered.filter(c => c.tipo_cliente === typeFilter);
  if (search) filtered = filtered.filter(c =>
    c.nombre.toLowerCase().includes(search) ||
    (c.empresa || "").toLowerCase().includes(search) ||
    (c.email || "").toLowerCase().includes(search) ||
    (c.telefono || "").toLowerCase().includes(search) ||
    (c.cedula || "").toLowerCase().includes(search)
  );
  
  const countEl = document.getElementById("cli-count");
  if (countEl) countEl.textContent = filtered.length;
  const box = document.getElementById("cli-list");
  if (!box) return;
  if (!filtered.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><div class="crm-empty-text">Sin resultados</div></div>`; return;
  }
  box.innerHTML = filtered.map(c => {
    const isEmp = c.tipo_cliente === "empresarial";
    const clr = isEmp ? "var(--green-mid)" : "var(--blue)";
    const bg  = isEmp ? "var(--green-light)" : "var(--surface-2)";
    
    const mainText = isEmp && c.empresa ? c.empresa : c.nombre;
    const subText  = isEmp && c.empresa ? `Contacto: ${c.nombre}` : "Persona Física";

    return `<div class="crm-item ${String(selectedId)===String(c.id)?"selected":""}" data-id="${c.id}">
      <div class="crm-item-avatar av-cli" style="background:${bg};color:${clr};font-size:14px;font-weight:700;">${getInitials(mainText)}</div>
      <div class="crm-item-info">
        <div class="crm-item-name">${esc(mainText)}</div>
        <div class="crm-item-sub">${esc(subText)}</div>
      </div>
      <div class="crm-item-meta">
        ${c.codigo_fiscal ? `<span style="font-size:10px;font-weight:700;color:var(--navy);background:#e0f2fe;padding:2px 8px;border-radius:20px;margin-right:6px;">#${String(c.codigo_fiscal).padStart(5,'0')}</span>` : ''}
        <span class="badge badge-${c.tipo_cliente}">${esc(c.tipo_cliente)}</span>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll(".crm-item").forEach(el =>
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      renderList();
      showDetail(el.dataset.id);
    }));
}

function getInitials(str) {
  return str.split(" ").map(w => w[0]).join("").toUpperCase().slice(0,2);
}

function showDetail(id) {
  const item = items.find(c => String(c.id) === String(id));
  if (!item) return;
  
  const detail = document.getElementById("cli-detail");
  if (!detail) return;

  const crmBody = detail.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');

  const isEmp = item.tipo_cliente === 'empresarial';
  const tipoLabel = isEmp ? 'Empresarial' : 'Residencial';
  const tipoColor = isEmp ? '#166534' : '#0284c7';
  const tipoBg = isEmp ? '#dcfce7' : '#e0f2fe';
  const initials = getInitials(isEmp && item.empresa ? item.empresa : item.nombre);
  const displayName = isEmp && item.empresa ? item.empresa : item.nombre;
  const subName = isEmp && item.empresa ? item.nombre : null;

  detail.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <!-- HERO -->
    <div class="detail-hero" style="padding: 20px 28px; gap: 20px;">
      <div style="display:flex; gap:16px; flex:1; min-width:0; align-items:center;">
        <div class="detail-hero-avatar" style="width:52px; height:52px; font-size:20px;">${initials}</div>
        <div class="detail-hero-info" style="display:flex; flex-direction:column; justify-content:center; min-width:0; gap:8px;">
          <div class="detail-hero-name" style="font-size:22px; font-weight:800; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin:0;">${esc(displayName)}</div>
          <div class="detail-hero-sub" style="margin:0; display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
            ${subName ? `<span style="font-size:13px; opacity:0.7; font-weight:500;">Contacto: ${esc(subName)}</span>` : ''}
            <span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; background:${tipoBg}; color:${tipoColor}; border:1px solid ${tipoColor}22;">
              ${isEmp ? '🏢' : '🏠'} ${tipoLabel}
            </span>
            ${item.cargo ? `<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:500; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08);">💼 ${esc(item.cargo)}</span>` : ''}
            ${item.codigo_fiscal ? `<span style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; background:rgba(0,194,168,0.12); color:#00c2a8; border:1px solid rgba(0,194,168,0.2);">#${String(item.codigo_fiscal).padStart(5,'0')}</span>` : ''}
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; flex-shrink:0;">
        <div class="detail-hero-actions" style="margin:0; gap:8px;">
          <button class="hero-btn hero-btn-edit" style="padding:8px 14px; font-size:12px; font-weight:600;" onclick="editClient('${item.id}')">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar
          </button>
          <button class="hero-btn hero-btn-del" style="padding:8px 14px; font-size:12px; font-weight:600; background:transparent;" onclick="deleteClient('${item.id}')">
            <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar
          </button>
        </div>
      </div>
    </div>

    <div style="padding: 0 4px;">

      <!-- CONTACTO -->
      <div class="crm-detail-section" style="margin-bottom:16px; border-radius:14px; padding:20px 24px;">
        <h3 style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--navy); margin:0 0 16px 0; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--blue-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
          Información de Contacto
        </h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px 24px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:6px;">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg> Email
            </div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.email || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:6px;">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg> Teléfono
            </div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.telefono || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; grid-column:1/-1;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px; display:flex; align-items:center; gap:6px;">
              <svg width="13" height="13" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.243-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Dirección
            </div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.direccion || "—")}</div>
          </div>
        </div>
      </div>

      <!-- FACTURACIÓN ELECTRÓNICA -->
      <div class="crm-detail-section" style="margin-bottom:16px; border-radius:14px; padding:20px 24px;">
        <h3 style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--navy); margin:0 0 16px 0; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--blue-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
          Facturación Electrónica
          ${item.fact_tipo_id ? `<span style="margin-left:auto; font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px; background:#dcfce7; color:#166534; border:1px solid #16653422;">✓ Configurado</span>` : `<span style="margin-left:auto; font-size:10px; font-weight:700; padding:3px 10px; border-radius:20px; background:#fef08a; color:#b45309; border:1px solid #b4530922;">⚠ Sin configurar</span>`}
        </h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:16px 24px;">
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Código Fiscal</div>
            <div style="font-size:15px; color:var(--navy); font-weight:700; font-family:monospace;">${item.codigo_fiscal ? String(item.codigo_fiscal).padStart(5, '0') : '—'}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Tipo de Cédula</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500; text-transform:capitalize;">${esc(item.fact_tipo_id || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Cédula Hacienda</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500; font-family:monospace;">${esc(item.fact_numero_id || item.cedula || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Nombre / Razón Social</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.fact_nombre || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Email Facturación</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.fact_email || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Teléfono Facturación</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${esc(item.fact_telefono || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Régimen</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500; text-transform:capitalize;">${esc((item.fact_regimen || "").replace(/_/g, ' ')) || "—"}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Código Actividad</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500; font-family:monospace;">${esc(item.fact_actividad || "—")}</div>
          </div>
          <div style="display:flex; flex-direction:column; gap:6px; grid-column:1/-1;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Ubicación</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">
              ${item.fact_provincia || item.fact_canton || item.fact_distrito
                ? [item.fact_provincia, item.fact_canton, item.fact_distrito].filter(Boolean).map(esc).join(' · ')
                : "—"}
            </div>
          </div>
          ${item.fact_otras_senas || item.fact_barrio ? `
          <div style="display:flex; flex-direction:column; gap:6px; grid-column:1/-1;">
            <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.8px;">Otras Señas</div>
            <div style="font-size:14px; color:var(--navy); font-weight:500;">${item.fact_barrio ? esc(item.fact_barrio) + " — " : ""}${esc(item.fact_otras_senas || "")}</div>
          </div>` : ''}
        </div>
      </div>

      <!-- USUARIOS AUTORIZADOS -->
      ${isEmp ? `
      <div class="crm-detail-section" style="margin-bottom:16px; border-radius:14px; padding:20px 24px;">
        <h3 style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--navy); margin:0 0 16px 0; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--blue-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          Usuarios Autorizados
          ${item.usuarios_autorizados?.length ? `<span style="margin-left:auto; font-size:11px; font-weight:600; color:var(--text-soft);">${item.usuarios_autorizados.length} ${item.usuarios_autorizados.length === 1 ? 'persona' : 'personas'}</span>` : ''}
        </h3>
        <div style="display:flex; flex-direction:column; gap:12px;">
          ${item.usuarios_autorizados && item.usuarios_autorizados.length > 0
            ? item.usuarios_autorizados.map(u => {
                if (typeof u === 'string') return `
                  <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--surface-2); border-radius:10px; border:1px solid var(--border-light);">
                    <div style="width:36px; height:36px; border-radius:50%; background:var(--blue-light); opacity:0.15; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:var(--navy);">${getInitials(u)}</div>
                    <div style="font-size:14px; font-weight:600; color:var(--navy);">${esc(u)}</div>
                  </div>`;
                return `
                  <div style="display:flex; align-items:center; gap:12px; padding:12px 16px; background:var(--surface-2); border-radius:10px; border:1px solid var(--border-light);">
                    <div style="width:36px; height:36px; border-radius:50%; background:var(--blue-light); opacity:0.15; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:800; color:var(--navy);">${getInitials(u.nombre || '')}</div>
                    <div style="flex:1; min-width:0;">
                      <div style="font-size:14px; font-weight:700; color:var(--navy);">${esc(u.nombre || '')}</div>
                      <div style="font-size:12px; color:var(--text-soft); display:flex; gap:16px; margin-top:2px;">
                        ${u.email ? `<span>📧 ${esc(u.email)}</span>` : ''}
                        ${u.telefono ? `<span>📞 ${esc(u.telefono)}</span>` : ''}
                      </div>
                    </div>
                  </div>`;
              }).join('')
            : `<div style="font-size:13px; color:var(--text-soft); padding:8px 0;">No hay usuarios autorizados registrados.</div>`
          }
        </div>
      </div>
      ` : ''}

      <!-- EQUIPOS -->
      ${item.equipos && item.equipos.length > 0 ? `
      <div class="crm-detail-section" style="margin-bottom:16px; border-radius:14px; padding:20px 24px;">
        <h3 style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--navy); margin:0 0 16px 0; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--blue-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
          Equipos Registrados
          <span style="margin-left:auto; font-size:11px; font-weight:600; color:var(--text-soft);">${item.equipos.length} ${item.equipos.length === 1 ? 'equipo' : 'equipos'}</span>
        </h3>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(280px, 1fr)); gap:14px;">
          ${item.equipos.map(eq => `
            <div style="background:var(--surface-2); border:1px solid var(--border-light); border-radius:12px; padding:16px; transition:all 0.2s;">
              <div style="font-weight:800; color:var(--navy); font-size:15px; margin-bottom:6px;">${esc(eq.FABRICANTE || 'Marca')} ${esc(eq.MODELO || '')}</div>
              <div style="font-size:12px; color:var(--text-soft); margin-bottom:12px; font-weight:500;">${esc(eq.DISPOSITIVO || 'Dispositivo')}</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px 12px; font-size:11px; color:var(--text-soft);">
                <div><strong style="color:var(--navy);">CPU:</strong> ${esc(eq['CPU MARCA']||'')} ${esc(eq['CPU MODELO']||'')}</div>
                <div><strong style="color:var(--navy);">RAM:</strong> ${esc(eq['RAM CAPACIDAD']||'')} ${esc(eq['RAM TIPO']||'')}</div>
                <div><strong style="color:var(--navy);">Disco:</strong> ${esc(eq['DISCO CAPACIDAD']||'')} ${esc(eq['DISCO TIPO']||'')}</div>
                <div><strong style="color:var(--navy);">S.O.:</strong> ${esc(eq['S.O.']||'')}</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- NOTAS -->
      ${item.notas ? `
      <div class="crm-detail-section" style="margin-bottom:16px; border-radius:14px; padding:20px 24px;">
        <h3 style="display:flex; align-items:center; gap:8px; font-size:14px; font-weight:800; color:var(--navy); margin:0 0 16px 0; padding-bottom:12px; border-bottom:1px solid var(--border-light);">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--blue-light);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
          Notas Internas
        </h3>
        <div style="font-size:14px; color:var(--navy); white-space:pre-wrap; line-height:1.6; background:var(--surface-2); padding:16px 20px; border-radius:10px; border:1px solid var(--border-light); font-weight:400;">${esc(item.notas)}</div>
      </div>
      ` : ''}

    </div>`;
}

// Variables globales temporales para el formulario
let tempAuthUsers = [];

function showForm(id) {
  selectedId = id || null;
  const item = items.find(c => String(c.id) === String(id));
  const shell = ensureShell("/clientes");
  
  // Clonar la lista de usuarios para edición
  tempAuthUsers = item ? [...(item.usuarios_autorizados || [])] : [];

  shell.setTitle(id ? "Editar Perfil del Cliente" : "Nuevo Cliente");
  shell.setActions('<button class="btn btn-ghost" onclick="cancelForm()">Cancelar</button><button class="btn btn-primary" onclick="saveClient()">Guardar</button>');
  
  const c = shell.content();
  c.innerHTML = `
    <div class="form-section-premium">
      <h3>👤 Datos Principales</h3>
      <div class="form-grid-premium">
        <div class="field">
          <label class="field-label">Tipo de Cliente *</label>
          <select class="select" id="cli-tipo" onchange="toggleEmpresarialFields(this.value)">
            <option value="residencial" ${item?.tipo_cliente === "residencial" ? "selected" : ""}>🏠 Residencial</option>
            <option value="empresarial" ${item?.tipo_cliente === "empresarial" ? "selected" : ""}>🏢 Empresarial</option>
          </select>
        </div>
        <div class="field" id="wrap-empresa" style="display:${item?.tipo_cliente === 'empresarial' ? 'block' : 'none'};">
          <label class="field-label">Nombre de la Empresa / Razón Social *</label>
          <input class="input" id="cli-empresa" value="${esc(item?.empresa || "")}" placeholder="Ej. Servicios e Inversiones S.A." />
        </div>
        <div class="field full-width">
          <label class="field-label" id="lbl-cli-nombre">${item?.tipo_cliente === 'empresarial' ? 'Persona de Contacto Principal *' : 'Nombre del Cliente *'}</label>
          <input class="input" id="cli-nombre" value="${esc(item?.nombre || "")}" placeholder="${item?.tipo_cliente === 'empresarial' ? 'Ej. Juan Pérez (Contacto)' : 'Nombre completo del cliente'}" />
        </div>
        <div class="field">
          <label class="field-label">Código Fiscal (Terminal de 5 dígitos)</label>
          <input class="input" id="cli-codigo-fiscal" type="number" min="1" max="99999" value="${item?.codigo_fiscal || ""}" placeholder="Ej: 00100, 00099, 99999 (auto-asignado si está vacío)" />
          <div style="font-size:11px; color:var(--text-soft); margin-top:4px;">Define los 5 dígitos de Terminal en el Consecutivo de Hacienda. Podés cambiarlo en cualquier momento.</div>
        </div>
        <div class="field" id="wrap-cargo" style="display:${item?.tipo_cliente === 'empresarial' ? 'block' : 'none'};">
          <label class="field-label">Cargo del Contacto</label>
          <input class="input" id="cli-cargo" value="${esc(item?.cargo || "")}" placeholder="Ej. Gerente de TI / Operaciones" />
        </div>
        <div class="field">
          <label class="field-label">Email Principal</label>
          <input type="email" class="input" id="cli-email" value="${esc(item?.email || "")}" placeholder="correo@ejemplo.com" />
        </div>
        <div class="field">
          <label class="field-label">Teléfono</label>
          <input class="input" id="cli-telefono" value="${esc(item?.telefono || "")}" placeholder="Número de teléfono" />
        </div>
        <div class="field full-width">
          <label class="field-label">Dirección Física (General)</label>
          <textarea class="textarea" id="cli-direccion" placeholder="Dirección general o señas principales" rows="2">${esc(item?.direccion || "")}</textarea>
        </div>
      </div>
    </div>

    <div class="form-section-premium" id="wrap-autorizados" style="display:${item?.tipo_cliente === 'empresarial' ? 'block' : 'none'};">
      <h3>👥 Personas Autorizadas (Solicitantes)</h3>
      <p style="font-size:12px; color:var(--text-soft); margin-bottom:20px; line-height:1.4;">Añade los detalles de las personas de la empresa autorizadas para solicitar servicios o equipos.</p>
      <div id="cli-auth-list"></div>
      <div style="display:flex; gap:12px; margin-top:16px; align-items:flex-start; background:#f0f4fb; padding:16px; border-radius:12px; border:1px dashed var(--blue-light);">
        <div style="flex:1; display:flex; flex-direction:column; gap:12px;">
          <input class="input" id="cli-new-auth-name" placeholder="Nombre completo del autorizado *" />
          <div class="form-grid-premium" style="gap:12px;">
            <input class="input" id="cli-new-auth-email" type="email" placeholder="Email (Opcional)" />
            <input class="input" id="cli-new-auth-phone" placeholder="Teléfono (Opcional)" />
          </div>
        </div>
        <button class="btn btn-primary" onclick="addAuthUser()" style="height:40px; padding:0 20px;">+ Agregar</button>
      </div>
    </div>

    <div class="form-section-premium">
      <h3>🧾 Datos de Facturación Electrónica</h3>
      <div class="form-grid-premium">
        <div class="field">
          <label class="field-label">Tipo de Cédula</label>
          <select class="select" id="cli-fact-tipo">
            <option value="">(Ninguna)</option>
            <option value="fisica" ${item?.fact_tipo_id === "fisica" ? "selected" : ""}>Física</option>
            <option value="juridica" ${item?.fact_tipo_id === "juridica" ? "selected" : ""}>Jurídica</option>
            <option value="DIMEX" ${item?.fact_tipo_id === "DIMEX" ? "selected" : ""}>DIMEX</option>
          </select>
        </div>
        <div class="field" style="grid-column:span 1;">
          <label class="field-label">Número de Cédula (Hacienda)</label>
          <div style="display:flex; gap:8px;">
            <input class="input" id="cli-fact-num-id" value="${esc(item?.fact_numero_id || "")}" placeholder="Cédula sin guiones" style="flex:1;" />
            <button type="button" id="btn-consultar-hacienda" style="flex:none; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:var(--navy); color:white; font-size:12px; font-weight:700; cursor:pointer; white-space:nowrap;">🔍 Hacienda</button>
          </div>
        </div>
        <div class="field">
          <label class="field-label">Nombre/Razón Social (Hacienda)</label>
          <input class="input" id="cli-fact-nombre" value="${esc(item?.fact_nombre || "")}" placeholder="Nombre fiscal" />
        </div>
        <div class="field">
          <label class="field-label">Email Facturación</label>
          <input class="input" id="cli-fact-email" value="${esc(item?.fact_email || "")}" placeholder="Email para recibir factura XML" />
        </div>
        <div class="field">
          <label class="field-label">Teléfono Facturación</label>
          <input class="input" id="cli-fact-tel" value="${esc(item?.fact_telefono || "")}" />
        </div>
        <div class="field">
          <label class="field-label">Régimen</label>
          <select class="select" id="cli-fact-regimen">
            <option value="">(Ninguno)</option>
            <option value="contribuyente_general" ${item?.fact_regimen === "contribuyente_general" ? "selected" : ""}>Contribuyente General</option>
            <option value="simplificado" ${item?.fact_regimen === "simplificado" ? "selected" : ""}>Simplificado</option>
            <option value="no_contribuyente" ${item?.fact_regimen === "no_contribuyente" ? "selected" : ""}>No Contribuyente</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label">Provincia</label>
          <input class="input" id="cli-fact-prov" value="${esc(item?.fact_provincia || "")}" />
        </div>
        <div class="field">
          <label class="field-label">Cantón</label>
          <input class="input" id="cli-fact-can" value="${esc(item?.fact_canton || "")}" />
        </div>
        <div class="field">
          <label class="field-label">Distrito</label>
          <input class="input" id="cli-fact-dis" value="${esc(item?.fact_distrito || "")}" />
        </div>
        <div class="field">
          <label class="field-label">Barrio</label>
          <input class="input" id="cli-fact-bar" value="${esc(item?.fact_barrio || "")}" />
        </div>
        <div class="field full-width">
          <label class="field-label">Otras Señas (Facturación)</label>
          <textarea class="textarea" id="cli-fact-senas" rows="2">${esc(item?.fact_otras_senas || "")}</textarea>
        </div>
        <div class="field">
          <label class="field-label">Código de Actividad Económica</label>
          <input class="input" id="cli-fact-act" value="${esc(item?.fact_actividad || "")}" placeholder="Ej. 620201" />
        </div>
      </div>
    </div>
    
    <div class="form-section-premium">
      <h3>📝 Notas Adicionales</h3>
      <div class="field full-width">
        <label class="field-label">Notas Internas</label>
        <textarea class="textarea" id="cli-notas" placeholder="Condiciones especiales, crédito, recordatorios..." rows="3">${esc(item?.notas || "")}</textarea>
      </div>
    </div>
  `;
  renderAuthUsers();
  bindHaciendaConsulta();
}

async function bindHaciendaConsulta() {
  const btn = document.getElementById('btn-consultar-hacienda');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const cedula = document.getElementById('cli-fact-num-id').value.trim();
    if (!cedula || cedula.length < 9) {
      toast('Ingrese un número de cédula válido (mínimo 9 dígitos)', 'error');
      return;
    }
    btn.textContent = '⏳...';
    btn.disabled = true;

    try {
      const data = await consultarIdentificacionHacienda(cedula);
      if (!data) {
        toast('Cédula no encontrada en Hacienda', 'error');
        return;
      }

      // Tipo de cédula
      const tipoSelect = document.getElementById('cli-fact-tipo');
      if (data.tipoIdNormalizado) {
        for (const opt of tipoSelect.options) {
          if (opt.value === data.tipoIdNormalizado) { opt.selected = true; break; }
        }
      }

      // Llenar campos de Cédula y Facturación
      const cleanCedula = cedula.replace(/[^0-9]/g, '');
      const numIdEl = document.getElementById('cli-fact-num-id');
      const cedulaGenEl = document.getElementById('cli-cedula');
      const factNombreEl = document.getElementById('cli-fact-nombre');
      const factActEl = document.getElementById('cli-fact-act');
      const cliTipoSelect = document.getElementById('cli-tipo');
      const empresaInput = document.getElementById('cli-empresa');
      const nombreInput = document.getElementById('cli-nombre');

      if (numIdEl) numIdEl.value = cleanCedula;
      if (cedulaGenEl) cedulaGenEl.value = cleanCedula;
      if (factNombreEl) factNombreEl.value = data.nombre || '';
      if (factActEl) factActEl.value = data.actividadCodigo || '';

      // Si es Cédula Jurídica (10 dígitos o tipoIdNormalizado = 'juridica')
      const isJuridica = data.tipoIdNormalizado === 'juridica' || cleanCedula.length === 10 || cleanCedula.startsWith('3101');
      if (isJuridica) {
        if (cliTipoSelect) {
          cliTipoSelect.value = 'empresarial';
          if (typeof window.toggleEmpresarialFields === 'function') {
            window.toggleEmpresarialFields('empresarial');
          }
        }
        if (empresaInput && data.nombre) {
          empresaInput.value = data.nombre;
        }
      } else {
        if (nombreInput && !nombreInput.value.trim() && data.nombre) {
          nombreInput.value = data.nombre;
        }
      }

      // Email de facturación
      if (data.correo) {
        document.getElementById('cli-fact-email').value = data.correo;
      } else {
        toast('Correo no registrado en Yo Contribuyo — llenar manualmente', 'info');
      }

      // Régimen
      const regimenSelect = document.getElementById('cli-fact-regimen');
      if (regimenSelect) {
        const regTexto = (data.regimen || '').toLowerCase();
        const regCodigo = data.regimenCodigo;
        let regimenVal = '';
        if (regCodigo === 1 || regTexto.includes('general')) regimenVal = 'contribuyente_general';
        else if (regTexto.includes('simplif')) regimenVal = 'simplificado';
        else if (regTexto.includes('no contrib') || regTexto.includes('nocontrib')) regimenVal = 'no_contribuyente';
        if (regimenVal) {
          for (const opt of regimenSelect.options) {
            if (opt.value === regimenVal) { opt.selected = true; break; }
          }
        }
      }

      const estadoMsg = data.estado === 'Inscrito' ? 'Estado: Inscrito ✓'
        : data.estado ? `Estado: ${data.estado}` : '';
      toast(`Datos cargados de Hacienda${estadoMsg ? ' · ' + estadoMsg : ''}`, 'success');
    } catch (err) {
      toast('Error al consultar Hacienda', 'error');
    } finally {
      btn.textContent = '🔍 Hacienda';
      btn.disabled = false;
    }
  });
}

function renderAuthUsers() {
  const container = document.getElementById('cli-auth-list');
  if (!container) return;
  container.innerHTML = tempAuthUsers.map((u, i) => {
    const isStr = typeof u === 'string';
    const nombre = esc(isStr ? u : u.nombre || '');
    const email = esc(isStr ? '' : u.email || '');
    const telefono = esc(isStr ? '' : u.telefono || '');
    
    return `
      <div class="premium-auth-card">
        <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <div style="font-size:14px; font-weight:800; color:var(--navy);">${nombre}</div>
          <div style="font-size:12px; color:var(--text-soft); display:flex; gap:16px;">
            ${email ? `<span style="display:flex; align-items:center; gap:4px;">📧 ${email}</span>` : ''}
            ${telefono ? `<span style="display:flex; align-items:center; gap:4px;">📞 ${telefono}</span>` : ''}
          </div>
        </div>
        <button onclick="removeAuthUser(${i})" style="background:#fee2e2; border:none; color:#b91c1c; font-size:16px; width:32px; height:32px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:transform 0.15s;" title="Eliminar" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
  }).join('');
}

window.addAuthUser = function() {
  const nameInput = document.getElementById('cli-new-auth-name');
  const emailInput = document.getElementById('cli-new-auth-email');
  const phoneInput = document.getElementById('cli-new-auth-phone');
  
  const nombre = nameInput.value.trim();
  const email = emailInput.value.trim();
  const telefono = phoneInput.value.trim();
  
  if (nombre) {
    tempAuthUsers.push({ nombre, email, telefono });
    nameInput.value = '';
    emailInput.value = '';
    phoneInput.value = '';
    renderAuthUsers();
  } else {
    toast("El nombre es obligatorio", "error");
  }
}

window.removeAuthUser = function(index) {
  tempAuthUsers.splice(index, 1);
  renderAuthUsers();
}

window.toggleEmpresarialFields = function(tipo) {
  const isEmp = tipo === 'empresarial';
  const wrapEmpresa = document.getElementById('wrap-empresa');
  const wrapCargo = document.getElementById('wrap-cargo');
  const wrapAutorizados = document.getElementById('wrap-autorizados');
  const lblNombre = document.getElementById('lbl-cli-nombre');
  const inputNombre = document.getElementById('cli-nombre');

  if (wrapEmpresa) wrapEmpresa.style.display = isEmp ? 'block' : 'none';
  if (wrapCargo) wrapCargo.style.display = isEmp ? 'block' : 'none';
  if (wrapAutorizados) wrapAutorizados.style.display = isEmp ? 'block' : 'none';

  if (lblNombre) {
    lblNombre.textContent = isEmp ? 'Persona de Contacto Principal *' : 'Nombre del Cliente *';
  }
  if (inputNombre) {
    inputNombre.placeholder = isEmp ? 'Ej. Juan Pérez (Contacto)' : 'Nombre completo del cliente';
  }
}

window.cancelForm = function() {
  selectedId = null;
  clientesListView();
}

async function saveClient() {
  const nombre = document.getElementById("cli-nombre").value;
  const tipo = document.getElementById("cli-tipo").value;
  const empresaInput = document.getElementById("cli-empresa")?.value || "";

  if (tipo === 'empresarial' && !empresaInput.trim()) {
    toast("El nombre de la empresa / razón social es obligatorio para clientes empresariales", "error");
    return;
  }

  if (!nombre.trim()) {
    toast(tipo === 'empresarial' ? "El nombre del contacto principal es obligatorio" : "El nombre del cliente es obligatorio", "error");
    return;
  }
  
  const codigoFiscalInput = document.getElementById("cli-codigo-fiscal")?.value || "";
  const data = {
    nombre,
    tipo_cliente: tipo,
    codigo_fiscal: codigoFiscalInput ? parseInt(codigoFiscalInput) : null,
    empresa: tipo === 'empresarial' ? (document.getElementById("cli-empresa")?.value || null) : null,
    cargo: tipo === 'empresarial' ? (document.getElementById("cli-cargo")?.value || null) : null,
    email: document.getElementById("cli-email")?.value || null, 
    telefono: document.getElementById("cli-telefono")?.value || null, 
    direccion: document.getElementById("cli-direccion")?.value || null,
    cedula: document.getElementById("cli-cedula")?.value || document.getElementById("cli-fact-num-id")?.value || null,
    fact_tipo_id: document.getElementById("cli-fact-tipo")?.value || null,
    fact_numero_id: document.getElementById("cli-fact-num-id")?.value || null,
    fact_nombre: document.getElementById("cli-fact-nombre")?.value || null,
    fact_email: document.getElementById("cli-fact-email")?.value || null,
    fact_telefono: document.getElementById("cli-fact-tel")?.value || null,
    fact_regimen: document.getElementById("cli-fact-regimen")?.value || null,
    fact_provincia: document.getElementById("cli-fact-prov")?.value || null,
    fact_canton: document.getElementById("cli-fact-can")?.value || null,
    fact_distrito: document.getElementById("cli-fact-dis")?.value || null,
    fact_barrio: document.getElementById("cli-fact-bar")?.value || null,
    fact_otras_senas: document.getElementById("cli-fact-senas")?.value || null,
    fact_actividad: document.getElementById("cli-fact-act")?.value || null,
    notas: document.getElementById("cli-notas")?.value || null,
    usuarios_autorizados: tipo === 'empresarial' ? tempAuthUsers : []
  };
  
  try {
    const supabase = await getSupabase();
    let currentData = { ...data };
    let success = false;
    let maxRetries = 15;
    let missingCols = [];
    
    while (!success && maxRetries > 0) {
      maxRetries--;
      const { error } = selectedId 
        ? await supabase.from("clientes").update(currentData).eq("id", selectedId)
        : await supabase.from("clientes").insert(currentData);
        
      if (error) {
        if (error.message && error.message.includes("Could not find the") && error.message.includes("column")) {
          const match = error.message.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const badCol = match[1];
            delete currentData[badCol];
            if (!missingCols.includes(badCol)) missingCols.push(badCol);
            console.warn(`Columna faltante detectada: ${badCol}. Reintentando...`);
            continue;
          }
        }
        throw error;
      }
      success = true;
    }
    
    if (!success) throw new Error("No se pudo guardar el cliente (faltan columnas críticas).");

    // Auto-asignar código fiscal si no se proporcionó y es cliente nuevo
    if (!selectedId && !codigoFiscalInput) {
      try {
        const supabase2 = await getSupabase();
        const { data: newClient } = await supabase2.from('clientes')
          .select('id').eq('nombre', nombre).order('created_at', { ascending: false }).limit(1).single();
        if (newClient) {
          await asignarCodigoFiscal(newClient.id);
        }
      } catch(e) {
        console.warn('No se pudo auto-asignar código fiscal:', e);
      }
    }

    if (missingCols.length > 0) {
      toast("Guardado, pero faltan columnas en BD: " + missingCols.join(", "), "warning");
    } else {
      toast("Cliente guardado correctamente", "success");
    }
    await clientesListView();
    // Vuelve a abrir detalle si editamos, si es nuevo lo buscamos
    if (selectedId) showDetail(selectedId);
  } catch (error) {
    toast("Error al guardar: " + error.message, "error");
  }
}

function editClient(id) {
  selectedId = id;
  showForm(id);
}

async function deleteClient(id) {
  if (!confirm("¿Eliminar este cliente permanentemente?")) return;
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
    toast("Cliente eliminado", "success");
    selectedId = null;
    await loadData();
    clientesListView();
  } catch (e) {
    toast("Error al eliminar: " + e.message, "error");
  }
}

function cancelForm() {
  clientesListView();
}

// Función para cliente individual (cuando se accede directo por URL /clientes/:id)
export async function clienteDetalleView({ id }) {
  const shell = ensureShell("/clientes");
  shell.setTitle("Detalles del Cliente");
  shell.setActions('<button class="btn btn-ghost" onclick="clientesListView()">Volver al directorio</button>');
  
  const c = shell.content();
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("clientes").select("*").eq("id", id).single();
    if (error) throw error;
    if (!data) throw new Error("Cliente no encontrado");
    
    // Si entran por URL, nos aseguramos de recargar los items locales
    if (!items.length) {
      await loadData();
    }
    
    selectedId = data.id;
    // Dibujamos el UI completo invocando showDetail dentro de nuestra estructura list/pane
    clientesListView().then(() => {
      showDetail(data.id);
    });
    
  } catch (error) {
    c.innerHTML = `<div style="padding:40px; text-align:center; color:var(--red);">Error: ${error.message}</div>`;
  }
}

// Exponer funciones en window para onclick inline
window.editClient = editClient;
window.deleteClient = deleteClient;
window.cancelForm = cancelForm;
window.saveClient = saveClient;
window.clientesListView = clientesListView;