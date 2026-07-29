import { ensureShell } from "../components/shell.js";
import { getSupabase } from "../lib/supabase.js";
import { esc, fmtMoney, debounce, toast } from "../lib/utils.js";

let items = [], selectedId = null, catFilter = "todos", search = "", showInactive = false;

export async function serviciosView() {
  const shell = ensureShell("/servicios");
  shell.setTitle(""); shell.setActions("");
  const c = shell.content();
  c.innerHTML = `
<div class="crm-panel">
  <div class="crm-header">
    <h2>🔧 Catálogo de Servicios <span class="crm-header-count" id="srv-count">—</span></h2>
    <div class="crm-header-actions">
      <label style="display:flex;align-items:center;gap:5px;font-size:11px;color:rgba(255,255,255,0.7);cursor:pointer;">
        <input type="checkbox" id="srv-inactivos" /> Ver inactivos
      </label>
      <button class="crm-action-btn primary" id="srv-new-btn" style="flex:none;">＋ Nuevo Servicio</button>
    </div>
  </div>
  <div class="crm-kpi-row" id="srv-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane">
      <div class="crm-search-bar">
        <input class="crm-search-input" id="srv-search" placeholder="🔍  Nombre, código o categoría…" />
      </div>
      <div class="crm-filters" id="srv-filters"></div>
      <div class="crm-list-scroll" id="srv-list">
        <div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div><div class="crm-empty-text">Cargando…</div></div>
      </div>
      <div class="crm-list-actions">
        <button class="crm-action-btn primary" id="srv-add-btn">＋ Nuevo Servicio</button>
      </div>
    </div>
    <div class="crm-detail-pane" id="srv-detail">
      <div class="crm-placeholder">
        <div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
        <div class="crm-placeholder-text">Seleccioná un servicio</div>
        <div class="crm-placeholder-sub">Hacé clic en cualquier servicio para ver precios, descripción y detalles completos.</div>
      </div>
    </div>
  </div>
</div>`;

  document.getElementById("srv-new-btn").addEventListener("click", () => showForm(null));
  document.getElementById("srv-add-btn").addEventListener("click", () => showForm(null));
  document.getElementById("srv-search").addEventListener("input", debounce(e => { search = e.target.value.trim().toLowerCase(); renderList(); }, 220));
  document.getElementById("srv-inactivos").addEventListener("change", e => { showInactive = e.target.checked; renderList(); });
  await loadData();
}

async function loadData() {
  const listEl = document.getElementById("srv-list");
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("catalogo_servicios").select("*").eq("tipo", "servicio").order("nombre");
    if (error) throw error;
    items = data || [];
  } catch (err) {
    console.error("Error al cargar servicios de Supabase:", err);
    toast("Error al conectar con Supabase: " + (err.message || err), "error");
    items = [];
    if (listEl) {
      listEl.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon" style="color:var(--red);">⚠️</div><div class="crm-empty-text" style="color:var(--red);">Error de Supabase: ${esc(err.message || String(err))}</div></div>`;
      return;
    }
  }
  renderAll();
}

function renderAll() {
  document.getElementById("srv-count").textContent = items.length;
  renderKPIs();
  renderFilters();
  renderList();
}

function renderKPIs() {
  const active = items.filter(s => s.activo !== false);
  const inactive = items.filter(s => s.activo === false);
  const cats = [...new Set(items.map(s => s.categoria).filter(Boolean))];
  const avgRes = active.length ? Math.round(active.reduce((a, s) => a + (s.precio_residencial || s.precio || 0), 0) / active.length) : 0;
  document.getElementById("srv-kpis").innerHTML = `
    <div class="crm-kpi"><div class="crm-kpi-icon blue"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg></div><div><div class="crm-kpi-label">Total</div><div class="crm-kpi-value">${items.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon green"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div><div class="crm-kpi-label">Activos</div><div class="crm-kpi-value">${active.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon purple"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg></div><div><div class="crm-kpi-label">Categorías</div><div class="crm-kpi-value">${cats.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon amber"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg></div><div><div class="crm-kpi-label">Tarifa Prom.</div><div class="crm-kpi-value">${fmtMoney(avgRes)}</div></div></div>`;
}

function renderFilters() {
  const cats = [...new Set(items.map(s => s.categoria).filter(Boolean))];
  document.getElementById("srv-filters").innerHTML =
    `<button class="crm-tab ${catFilter==="todos"?"active":""}" data-cat="todos">Todos</button>` +
    cats.map(c => `<button class="crm-tab ${catFilter===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  document.querySelectorAll("#srv-filters .crm-tab").forEach(b =>
    b.addEventListener("click", () => { catFilter = b.dataset.cat; renderFilters(); renderList(); }));
}

function renderList() {
  let filtered = items.filter(s => showInactive ? true : s.activo !== false);
  if (catFilter !== "todos") filtered = filtered.filter(s => s.categoria === catFilter);
  if (search) filtered = filtered.filter(s =>
    s.nombre.toLowerCase().includes(search) ||
    (s.descripcion || "").toLowerCase().includes(search) ||
    (s.codigo || "").toLowerCase().includes(search));
  document.getElementById("srv-count").textContent = filtered.length;
  const box = document.getElementById("srv-list");
  if (!filtered.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><div class="crm-empty-text">Sin resultados</div></div>`; return;
  }
  box.innerHTML = filtered.map(s => {
    const pRes = s.precio_residencial || s.precio || 0;
    const pEmp = s.precio_empresarial || 0;
    const inact = s.activo === false;
    return `<div class="crm-item ${String(selectedId)===String(s.id)?"selected":""}" data-id="${s.id}" style="${inact?"opacity:0.55":""}">
      <div class="crm-item-avatar av-svc"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
      <div class="crm-item-info">
        <div class="crm-item-name">${esc(s.nombre)}${inact?` <span style="font-size:9px;background:#fee2e2;color:#b91c1c;padding:1px 6px;border-radius:20px;font-weight:700;margin-left:4px;">INACTIVO</span>`:""}</div>
        <div class="crm-item-sub">${esc(s.categoria||"Sin categoría")}${s.codigo?" · "+esc(s.codigo):""}</div>
      </div>
      <div class="crm-item-meta">
        <div class="crm-item-price">${fmtMoney(pRes)}</div>
        ${pEmp?`<div class="crm-item-price emp">${fmtMoney(pEmp)} <span style="font-size:8px;opacity:0.7;">EMP</span></div>`:""}
      </div>
    </div>`;
  }).join("");
  box.querySelectorAll(".crm-item").forEach(el =>
    el.addEventListener("click", () => {
      selectedId = el.dataset.id;
      renderList();
      showDetail(items.find(s => String(s.id) === String(selectedId)));
    }));
}

function showDetail(s) {
  if (!s) return;
  const pRes = s.precio_residencial || s.precio || 0;
  const pEmp = s.precio_empresarial || 0;
  const detailEl = document.getElementById("srv-detail");
  const crmBody = detailEl?.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');
  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <div class="detail-hero" style="align-items: center; padding: 16px 24px; gap: 16px;">
      <div style="display: flex; gap: 16px; flex: 1; min-width: 0; align-items: center;">
        <div class="detail-hero-avatar" style="width: 46px; height: 46px; font-size: 18px;"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
        <div class="detail-hero-info" style="display: flex; flex-direction: column; justify-content: center; min-width: 0;">
          <div class="detail-hero-name" style="font-size: 20px; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px;">${esc(s.nombre)}</div>
          <div class="detail-hero-sub" style="margin-top: 0; display: flex; align-items: center; gap: 8px;">
            ${s.categoria?`<span style="border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); padding: 2px 8px; font-size: 11px; font-weight: 500;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> ${esc(s.categoria)}</span>`:""}
            ${s.codigo?`<span style="border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); padding: 2px 8px; font-size: 11px; font-weight: 500;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg> ${esc(s.codigo)}</span>`:""}
            ${s.garantia?`<span style="border: 1px solid rgba(255,255,255,0.06); background: rgba(255,255,255,0.03); padding: 2px 8px; font-size: 11px; font-weight: 500;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> ${esc(s.garantia)}</span>`:""}
          </div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 8px;">
        <div style="display: flex; gap: 16px; text-align: right; align-items: flex-end;">
          ${pRes?`<div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:2px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg> Residencial</div><div style="font-size:18px;font-weight:900;color:#5eead4;line-height:1;">${fmtMoney(pRes)}</div></div>`:""}
          ${pEmp?`<div><div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;margin-bottom:2px;"><svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:text-bottom;margin-right:2px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z"></path></svg> Empresarial</div><div style="font-size:18px;font-weight:900;color:#93c5fd;line-height:1;">${fmtMoney(pEmp)}</div></div>`:""}
        </div>
        <div class="detail-hero-actions" style="margin-left: 0; gap: 8px;">
          <button class="hero-btn hero-btn-edit" id="srv-edit-btn" style="padding: 6px 12px; font-size: 11px; font-weight: 600; background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar</button>
          <button class="hero-btn hero-btn-del" id="srv-del-btn" style="padding: 6px 12px; font-size: 11px; font-weight: 600; background: transparent; border-color: rgba(239,68,68,0.2);"><svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> ${s.activo===false?"Activar":"Desactivar"}</button>
        </div>
      </div>
    </div>
    ${s.descripcion?`<div class="detail-section"><div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Descripción</div><p style="font-size:13.5px;color:var(--text);line-height:1.7;">${esc(s.descripcion)}</p></div>`:""}
    <div class="detail-section"><div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> Ficha Técnica</div><div class="detail-info-grid">
      <div class="detail-info-item"><div class="detail-info-label"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>Precio Residencial</div><div class="detail-info-value">${pRes?fmtMoney(pRes):"—"}</div></div>
      <div class="detail-info-item"><div class="detail-info-label"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1v1H9V7zm5 0h1v1h-1V7zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1zm-5 4h1v1H9v-1zm5 0h1v1h-1v-1z"></path></svg>Precio Empresarial</div><div class="detail-info-value">${pEmp?fmtMoney(pEmp):"—"}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Código</div><div class="detail-info-value mono">${esc(s.codigo||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Categoría</div><div class="detail-info-value">${esc(s.categoria||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Garantía</div><div class="detail-info-value">${esc(s.garantia||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Estado</div><div class="detail-info-value"><span class="crm-item-tag ${s.activo===false?"tag-out":"tag-ok"}">${s.activo===false?"Inactivo":"Activo"}</span></div></div>
    </div></div>`;
  document.getElementById("srv-edit-btn").addEventListener("click", () => showForm(s));
  document.getElementById("srv-del-btn").addEventListener("click", () => toggleActive(s));
}

function showForm(srv) {
  const isEdit = !!srv;
  document.getElementById("srv-detail").innerHTML = `
    <div class="crm-form"><div class="crm-form-title">${isEdit?`<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar`:"＋ Nuevo"} Servicio</div>
      <div class="crm-form-grid">
        <div class="field full"><label class="field-label">Nombre *</label><input id="sf-nombre" class="input" value="${esc(srv?.nombre||"")}" /></div>
        <div class="field full"><label class="field-label">Descripción</label><textarea id="sf-desc" class="textarea" style="min-height:70px;">${esc(srv?.descripcion||"")}</textarea></div>
        <div class="field"><label class="field-label">Código</label><input id="sf-codigo" class="input" value="${esc(srv?.codigo||"")}" placeholder="SRV-001" /></div>
        <div class="field"><label class="field-label">Categoría</label><input id="sf-cat" class="input" value="${esc(srv?.categoria||"")}" placeholder="soporte, redes…" /></div>
        <div class="field"><label class="field-label">Precio Residencial ₡</label><input id="sf-pres" type="number" class="input" value="${srv?.precio_residencial||srv?.precio||""}" /></div>
        <div class="field"><label class="field-label">Precio Empresarial ₡</label><input id="sf-pemp" type="number" class="input" value="${srv?.precio_empresarial||""}" /></div>
        <div class="field"><label class="field-label">Garantía</label><input id="sf-gar" class="input" value="${esc(srv?.garantia||"30 días")}" /></div>
        <div class="field" style="display:flex;align-items:center;gap:8px;"><label class="field-label">Activo</label><input id="sf-activo" type="checkbox" ${srv?.activo!==false?"checked":""} /></div>
      </div>
      <div class="crm-form-actions">
        <button class="btn btn-ghost" id="sf-cancel">Cancelar</button>
        <button class="btn btn-primary" id="sf-save"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Guardar</button>
      </div></div>`;
  document.getElementById("sf-cancel").addEventListener("click", () => selectedId ? showDetail(items.find(s => String(s.id) === String(selectedId))) : renderAll());
  document.getElementById("sf-save").addEventListener("click", () => save(srv?.id));
}

async function save(id) {
  const nombre = document.getElementById("sf-nombre").value.trim();
  if (!nombre) { toast("Nombre obligatorio", "error"); return; }
  const payload = {
    nombre, tipo: "servicio",
    descripcion: document.getElementById("sf-desc").value.trim() || null,
    codigo: document.getElementById("sf-codigo").value.trim() || null,
    categoria: document.getElementById("sf-cat").value.trim() || null,
    precio_residencial: Number(document.getElementById("sf-pres").value) || 0,
    precio_empresarial: Number(document.getElementById("sf-pemp").value) || 0,
    precio: Number(document.getElementById("sf-pres").value) || Number(document.getElementById("sf-pemp").value) || 0,
    garantia: document.getElementById("sf-gar").value.trim() || null,
    activo: document.getElementById("sf-activo").checked
  };

  try {
    const supabase = await getSupabase();
    const { data, error } = id
      ? await supabase.from("catalogo_servicios").update(payload).eq("id", id).select().single()
      : await supabase.from("catalogo_servicios").insert([payload]).select().single();
    if (error) throw error;
    toast(id ? "Servicio actualizado" : "Servicio creado");
    await loadData();
    selectedId = String(data.id);
  } catch (err) {
    console.warn("Guardado local/demo en memoria:", err.message || err);
    if (id) {
      const idx = items.findIndex(x => String(x.id) === String(id));
      if (idx !== -1) items[idx] = { ...items[idx], ...payload };
      toast("Servicio actualizado (Demo)");
    } else {
      const newId = "s_local_" + Math.random().toString(36).substr(2, 9);
      const newSrv = { id: newId, ...payload };
      items.push(newSrv);
      id = newId;
      toast("Servicio creado (Demo)");
    }
    selectedId = String(id);
  }

  renderAll();
  showDetail(items.find(s => String(s.id) === selectedId));
}

async function toggleActive(s) {
  try {
    const supabase = await getSupabase();
    const { error } = await supabase.from("catalogo_servicios").update({ activo: s.activo === false }).eq("id", s.id);
    if (error) throw error;
    toast(s.activo === false ? "Servicio activado" : "Servicio desactivado");
    await loadData();
  } catch (err) {
    console.warn("Toggle local/demo en memoria:", err.message || err);
    const idx = items.findIndex(x => String(x.id) === String(s.id));
    if (idx !== -1) {
      items[idx].activo = (s.activo === false);
    }
    toast(s.activo === false ? "Servicio activado (Demo)" : "Servicio desactivado (Demo)");
  }
  renderList();
  showDetail(items.find(x => String(x.id) === String(s.id)));
}
