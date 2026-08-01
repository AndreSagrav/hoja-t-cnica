import { ensureShell } from "../components/shell.js";
import { getSupabase } from "../lib/supabase.js";
import { esc, fmtMoney, debounce, toast } from "../lib/utils.js";
import { generateSmartCode, PRESET_ACTIVITIES, getCategoryName } from "../lib/code-generator.js";

let items = [], selectedId = null, catFilter = "todos", search = "", showInactive = false;

// ── SVG Icon Constants ──────────────────────────────────────
const ICONS = {
  gear:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  search:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>`,
  diag:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>`,
  support: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`,
  maint:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  visit:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>`,
  install: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>`,
  network: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"></path></svg>`,
  hosting: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>`,
  dev:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"></path></svg>`,
  consult: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"></path></svg>`,
  remote:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>`,
  folder:  `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>`,
  tag:     `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>`,
  clock:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
  check:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`,
  chart:   `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>`,
  edit:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>`,
  clipboard: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>`,
  home:    `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>`,
  save:    `<svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>`,
  editPen: `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>`,
  back:    `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>`,
};

// ── Category → Icon + Avatar Color Mapping ──────────────────
const CATEGORY_ICONS = {
  'Diagnóstico':     { icon: ICONS.diag,    class: 'av-diag' },
  'Soporte Técnico': { icon: ICONS.support,  class: 'av-support' },
  'Soporte Remoto':  { icon: ICONS.remote,   class: 'av-remote' },
  'Mantenimiento':   { icon: ICONS.maint,    class: 'av-maint' },
  'Visita Técnica':  { icon: ICONS.visit,    class: 'av-visit' },
  'Instalación':     { icon: ICONS.install,  class: 'av-install' },
  'Redes':           { icon: ICONS.network,  class: 'av-network' },
  'Hosting & Web':   { icon: ICONS.hosting,  class: 'av-hosting' },
  'Desarrollo':      { icon: ICONS.dev,      class: 'av-dev' },
  'Consultoría':     { icon: ICONS.consult,  class: 'av-consult' },
};

function getCatVisuals(catName) {
  return CATEGORY_ICONS[catName] || { icon: ICONS.gear, class: 'av-svc' };
}

// ── Skeleton Loading HTML ───────────────────────────────────
function skeletonHTML() {
  const row = `<div class="skeleton-item"><div class="skeleton-avatar"></div><div class="skeleton-lines"><div class="skeleton-line w70"></div><div class="skeleton-line w40"></div></div></div>`;
  return row.repeat(4);
}

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
        <div class="crm-search-wrap">
          <svg class="crm-search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input class="crm-search-input" id="srv-search" placeholder="Nombre, código o categoría…" />
        </div>
        <div class="crm-filter-tabs" id="srv-filters"></div>
      </div>
      <div class="crm-list-scroll" id="srv-list">${skeletonHTML()}</div>
      <div class="crm-list-actions">
        <button class="crm-action-btn primary" id="srv-add-btn">＋ Nuevo Servicio</button>
      </div>
    </div>
    <div class="crm-detail-pane" id="srv-detail">
      <div class="crm-placeholder">
        <div class="crm-placeholder-icon">${ICONS.gear}</div>
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
  let localCache = [];
  try {
    localCache = JSON.parse(localStorage.getItem("local_servicios_overrides") || "[]");
  } catch {}

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("catalogo_servicios").select("*").eq("tipo", "servicio").order("nombre");
    if (!error && data && data.length) {
      // Supabase loaded OK — use cloud data as single source of truth
      items = data;
      // Clear local overrides since cloud is working
      try { localStorage.removeItem("local_servicios_overrides"); } catch {}
    } else if (localCache.length) {
      items = localCache;
    }
  } catch (err) {
    if (localCache.length) items = localCache;
  }

  items = items.map(s => {
    let codigo = s.codigo;
    if (!codigo || codigo.startsWith('SRV-177') || codigo === 'REPP') {
      codigo = generateSmartCode(s.nombre) || 'ST';
    }
    let categoria = s.categoria;
    if (!categoria || categoria.toLowerCase() === 'general') {
      categoria = getCategoryName(codigo);
    } else {
      categoria = getCategoryName(categoria);
    }
    return { ...s, codigo, categoria };
  });

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
  const cats = [...new Set(items.map(s => getCategoryName(s.categoria)).filter(Boolean))];
  const avgRes = active.length ? Math.round(active.reduce((a, s) => a + (s.precio_residencial || s.precio || 0), 0) / active.length) : 0;
  document.getElementById("srv-kpis").innerHTML = `
    <div class="crm-kpi"><div class="crm-kpi-icon blue">${ICONS.clipboard}</div><div><div class="crm-kpi-label">Total</div><div class="crm-kpi-value">${items.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon green">${ICONS.check}</div><div><div class="crm-kpi-label">Activos</div><div class="crm-kpi-value">${active.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon purple">${ICONS.folder}</div><div><div class="crm-kpi-label">Categorías</div><div class="crm-kpi-value">${cats.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon amber">${ICONS.home}</div><div><div class="crm-kpi-label">Tarifa Prom.</div><div class="crm-kpi-value">${fmtMoney(avgRes)}</div></div></div>`;
}

function renderFilters() {
  const cats = [...new Set(items.map(s => getCategoryName(s.categoria)).filter(Boolean))];
  document.getElementById("srv-filters").innerHTML =
    `<button class="crm-filter-tab ${catFilter==="todos"?"active":""}" data-cat="todos">Todos</button>` +
    cats.map(c => `<button class="crm-filter-tab ${catFilter===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  document.querySelectorAll("#srv-filters .crm-filter-tab").forEach(b =>
    b.addEventListener("click", () => { catFilter = b.dataset.cat; renderFilters(); renderList(); }));
}

function renderList() {
  const box = document.getElementById("srv-list");
  let filtered = items.filter(s => {
    if (!showInactive && s.activo === false) return false;
    const catName = getCategoryName(s.categoria);
    if (catFilter !== "todos" && catName !== catFilter && s.categoria !== catFilter) return false;
    if (!search) return true;
    return (s.nombre || "").toLowerCase().includes(search) ||
      (catName || "").toLowerCase().includes(search) ||
      (s.codigo || "").toLowerCase().includes(search);
  });
  if (!filtered.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon">${ICONS.search}</div><div class="crm-empty-text">Sin resultados</div></div>`;
    return;
  }
  box.innerHTML = filtered.map(s => {
    const pRes = s.precio_residencial || s.precio || 0;
    const pEmp = s.precio_empresarial || 0;
    const inact = s.activo === false;
    const catName = getCategoryName(s.categoria);
    const vis = getCatVisuals(catName);
    return `<div class="crm-item ${String(selectedId)===String(s.id)?"selected":""}${inact?" crm-item-inactive":""}" data-id="${s.id}">
      <div class="crm-item-avatar ${vis.class}">${vis.icon}</div>
      <div class="crm-item-info">
        <div class="crm-item-name">${esc(s.nombre)}${inact?` <span class="badge-inactivo">INACTIVO</span>`:""}</div>
        <div class="crm-item-sub">${esc(catName)}${s.codigo?" · "+esc(s.codigo):""} · <span style="color:var(--teal);font-weight:600;">${esc(s.unidad||"Hora")}</span></div>
      </div>
      <div class="crm-item-meta">
        <div class="crm-item-price">${pRes?fmtMoney(pRes):"₡0"}</div>
        ${pEmp?`<div class="crm-item-price emp">${fmtMoney(pEmp)} <span class="emp-label">EMP</span></div>`:""}
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

// ── Detail View (extracted to function) ─────────────────────
function renderHeroHTML(s) {
  const pRes = s.precio_residencial || s.precio || 0;
  const pEmp = s.precio_empresarial || 0;
  const vis = getCatVisuals(getCategoryName(s.categoria));
  return `
    <div class="detail-hero">
      <div class="detail-hero-avatar">${vis.icon}</div>
      <div class="detail-hero-info">
        <div class="detail-hero-name">${esc(s.nombre)}</div>
        <div class="detail-hero-sub">
          ${s.categoria?`<span>${ICONS.folder} ${esc(s.categoria)}</span>`:""}
          ${s.codigo?`<span>${ICONS.tag} ${esc(s.codigo)}</span>`:""}
          <span class="hero-unit-badge">${ICONS.clock} ${esc(s.unidad||"Hora")}</span>
        </div>
      </div>
      <div class="detail-hero-actions">
        <div class="hero-prices">
          ${pRes?`<div class="hero-price-block"><div class="hero-price-label">Residencial</div><div class="hero-price-value res">${fmtMoney(pRes)}</div></div>`:""}
          ${pEmp?`<div class="hero-price-block"><div class="hero-price-label">Empresarial</div><div class="hero-price-value emp">${fmtMoney(pEmp)}</div></div>`:""}
        </div>
        <button class="hero-btn hero-btn-edit" id="srv-edit-btn">✏️ Editar</button>
        <button class="hero-btn hero-btn-del" id="srv-del-btn">🗑️ ${s.activo===false?"Activar":"Desactivar"}</button>
      </div>
    </div>`;
}

function renderDetailSections(s) {
  const pRes = s.precio_residencial || s.precio || 0;
  const pEmp = s.precio_empresarial || 0;
  return `
    ${s.descripcion?`<div class="detail-section"><div class="detail-section-title">${ICONS.edit} Descripción</div><p style="font-size:13.5px;color:var(--text);line-height:1.7;">${esc(s.descripcion)}</p></div>`:""}
    <div class="detail-section"><div class="detail-section-title">${ICONS.chart} Ficha Técnica</div><div class="detail-info-grid">
      <div class="detail-info-item"><div class="detail-info-label">Precio Residencial</div><div class="detail-info-value">${pRes?fmtMoney(pRes):"—"}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Precio Empresarial</div><div class="detail-info-value">${pEmp?fmtMoney(pEmp):"—"}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Código</div><div class="detail-info-value mono">${esc(s.codigo||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Categoría</div><div class="detail-info-value">${esc(s.categoria||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Unidad de Medida</div><div class="detail-info-value" style="font-weight:700;color:var(--teal);">${esc(s.unidad||"Hora")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Garantía</div><div class="detail-info-value">${esc(s.garantia||"—")}</div></div>
      <div class="detail-info-item"><div class="detail-info-label">Estado</div><div class="detail-info-value"><span class="crm-item-tag ${s.activo===false?"tag-out":"tag-ok"}">${s.activo===false?"Inactivo":"Activo"}</span></div></div>
    </div></div>`;
}

function showDetail(s) {
  if (!s) return;
  const detailEl = document.getElementById("srv-detail");
  const crmBody = detailEl?.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');
  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      ${ICONS.back} Volver a la lista
    </button>
    ${renderHeroHTML(s)}
    ${renderDetailSections(s)}`;
  document.getElementById("srv-edit-btn").addEventListener("click", () => showForm(s));
  document.getElementById("srv-del-btn").addEventListener("click", () => confirmToggleActive(s));
}

// ── Form View (extracted to function) ───────────────────────
function renderFormHTML(srv, isEdit, catOptions, currentUnidad) {
  return `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      ${ICONS.back} Volver a la lista
    </button>
    <div class="crm-form"><div class="crm-form-title">${isEdit?`${ICONS.editPen} Editar`:"＋ Nuevo"} Servicio</div>
      <div class="crm-form-grid">
        <div class="field full"><label class="field-label">Nombre *</label><input id="sf-nombre" class="input" value="${esc(srv?.nombre||"")}" placeholder="Ej: Diagnóstico Avanzado de Laptops" /></div>
        <div class="field full"><label class="field-label">Descripción</label><textarea id="sf-desc" class="textarea" style="min-height:70px;" placeholder="Detalles del servicio...">${esc(srv?.descripcion||"")}</textarea></div>
        <div class="field">
          <label class="field-label">Categoría / Actividad *</label>
          <select id="sf-cat" class="select">
            ${catOptions}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Código (Inteligente / Personalizado)</label>
          <input id="sf-codigo" class="input mono" value="${esc(srv?.codigo||"")}" placeholder="Ej: DG, SM, ST..." />
        </div>
        <div class="field"><label class="field-label">Unidad de Medida</label>
          <select id="sf-unidad" class="select">
            <option value="Hora" ${currentUnidad==='Hora'?'selected':''}>Hora (por hora)</option>
            <option value="Servicio" ${currentUnidad==='Servicio'?'selected':''}>Servicio (por evento)</option>
            <option value="Unidad" ${currentUnidad==='Unidad'?'selected':''}>Unidad (por ítem)</option>
            <option value="Día" ${currentUnidad==='Día'?'selected':''}>Día (por jornada/día)</option>
            <option value="Sesión" ${currentUnidad==='Sesión'?'selected':''}>Sesión</option>
            <option value="Km" ${currentUnidad==='Km'?'selected':''}>Km (por kilometraje)</option>
            <option value="Mes" ${currentUnidad==='Mes'?'selected':''}>Mes (mensualidad)</option>
          </select>
        </div>
        <div class="field"><label class="field-label">Precio Residencial ₡</label><input id="sf-pres" type="number" min="0" class="input" value="${srv?.precio_residencial||srv?.precio||""}" placeholder="0" /></div>
        <div class="field"><label class="field-label">Precio Empresarial ₡</label><input id="sf-pemp" type="number" min="0" class="input" value="${srv?.precio_empresarial||""}" placeholder="0" /></div>
        <div class="field"><label class="field-label">Garantía</label><input id="sf-gar" class="input" value="${esc(srv?.garantia||"30 días")}" placeholder="30 días" /></div>
        <div class="field" style="display:flex;align-items:center;gap:8px;"><label class="field-label">Activo</label><input id="sf-activo" type="checkbox" ${srv?.activo!==false?"checked":""} /></div>
      </div>
      <div class="crm-form-actions">
        <button class="btn btn-ghost" id="sf-cancel">Cancelar</button>
        <button class="btn btn-primary" id="sf-save">${ICONS.save} Guardar</button>
      </div></div>`;
}

function showForm(srv) {
  const isEdit = !!srv;
  selectedId = srv ? String(srv.id) : null;

  const detailEl = document.getElementById("srv-detail");
  if (detailEl) {
    const crmBody = detailEl.closest('.crm-body');
    if (crmBody) crmBody.classList.add('show-detail');
  }

  const currentUnidad = srv?.unidad || 'Hora';
  const currentCat = getCategoryName(srv?.categoria || 'General');
  const catOptions = `
    <option value="General" ${currentCat === 'General' ? 'selected' : ''}>General</option>
    ${PRESET_ACTIVITIES.map(a => `<option value="${a.catName}" data-code="${a.code}" ${currentCat === a.catName || srv?.codigo === a.code ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}
  `;

  detailEl.innerHTML = renderFormHTML(srv, isEdit, catOptions, currentUnidad);

  const nombreInput = document.getElementById("sf-nombre");
  const codigoInput = document.getElementById("sf-codigo");
  const catSelect = document.getElementById("sf-cat");
  let manualTouched = isEdit && !!srv?.codigo;

  codigoInput.addEventListener("input", () => { manualTouched = true; });

  nombreInput.addEventListener("input", () => {
    if (!manualTouched || !codigoInput.value.trim()) {
      const auto = generateSmartCode(nombreInput.value);
      if (auto) codigoInput.value = auto;
    }
  });

  catSelect.addEventListener("change", (e) => {
    const opt = e.target.options[e.target.selectedIndex];
    const code = opt ? opt.dataset.code : null;
    if (code) {
      codigoInput.value = code;
      manualTouched = true;
    }
  });

  document.getElementById("sf-cancel").addEventListener("click", () => {
    document.querySelector('.crm-body')?.classList.remove('show-detail');
    if (selectedId) showDetail(items.find(s => String(s.id) === String(selectedId)));
    else renderAll();
  });
  document.getElementById("sf-save").addEventListener("click", () => save(srv?.id));
}


async function save(id) {
  const nombre = document.getElementById("sf-nombre").value.trim();
  if (!nombre) { toast("Nombre obligatorio", "error"); return; }

  // ── Validate prices (no negatives) ──
  const pRes = Number(document.getElementById("sf-pres").value);
  const pEmp = Number(document.getElementById("sf-pemp").value);
  if (pRes < 0 || pEmp < 0) { toast("Los precios no pueden ser negativos", "error"); return; }
  if (pRes === 0 && pEmp === 0) { toast("⚠️ Ambos precios están en ₡0", "warning"); }

  // ── Prevent duplicate names on create ──
  const isEdit = !!id;
  if (!isEdit) {
    const dup = items.find(s => s.nombre.toLowerCase() === nombre.toLowerCase());
    if (dup) { toast(`Ya existe un servicio llamado "${dup.nombre}"`, "error"); return; }
  }

  // ── Disable save button + show spinner ──
  const saveBtn = document.getElementById("sf-save");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="btn-spinner"></span> Guardando…`;
  }

  const payload = {
    nombre, tipo: "servicio",
    descripcion: document.getElementById("sf-desc").value.trim() || null,
    codigo: document.getElementById("sf-codigo").value.trim() || null,
    categoria: document.getElementById("sf-cat").value.trim() || null,
    unidad: document.getElementById("sf-unidad")?.value || "Hora",
    precio_residencial: pRes || 0,
    precio_empresarial: pEmp || 0,
    precio: pRes || pEmp || 0,
    garantia: document.getElementById("sf-gar").value.trim() || null,
    activo: document.getElementById("sf-activo").checked
  };

  let activeId = id;
  if (isEdit) {
    const idx = items.findIndex(x => String(x.id) === String(id));
    if (idx !== -1) items[idx] = { ...items[idx], ...payload };
  } else {
    activeId = "s_local_" + Math.random().toString(36).substr(2, 9);
    items.push({ id: activeId, ...payload });
  }
  selectedId = String(activeId);

  // ── Try Supabase first, fallback to localStorage ──
  let cloudSaved = false;
  try {
    const supabase = await getSupabase();
    let currentPayload = { ...payload };
    delete currentPayload.id;

    if (String(activeId).startsWith("s_local_")) {
      let inserted = false;
      let retries = 5;
      while (!inserted && retries > 0) {
        retries--;
        const { data, error } = await supabase.from("catalogo_servicios").insert([currentPayload]).select().single();
        if (error) {
          if (error.message && error.message.includes("Could not find the") && error.message.includes("column")) {
            const match = error.message.match(/Could not find the '([^']+)' column/);
            if (match && match[1]) { delete currentPayload[match[1]]; continue; }
          }
          break;
        }
        if (data?.id) {
          selectedId = String(data.id);
          items = items.map(x => String(x.id) === String(activeId) ? { ...data, ...payload } : x);
        }
        inserted = true;
        cloudSaved = true;
      }
    } else {
      let updated = false;
      let retries = 5;
      while (!updated && retries > 0) {
        retries--;
        const { error } = await supabase.from("catalogo_servicios").update(currentPayload).eq("id", activeId);
        if (error) {
          if (error.message && error.message.includes("Could not find the") && error.message.includes("column")) {
            const match = error.message.match(/Could not find the '([^']+)' column/);
            if (match && match[1]) { delete currentPayload[match[1]]; continue; }
          }
          break;
        }
        updated = true;
        cloudSaved = true;
      }
    }
  } catch (e) {
    console.warn("Supabase background sync:", e);
  }

  // ── Handle cloud vs local save result ──
  if (cloudSaved) {
    // Success: clean up localStorage since cloud is the source of truth
    try { localStorage.removeItem("local_servicios_overrides"); } catch {}
    toast(isEdit ? "Servicio guardado con éxito ☁️" : "Servicio creado con éxito ☁️", "success");
  } else {
    // Fallback: save to localStorage and warn user
    try {
      let localCache = JSON.parse(localStorage.getItem("local_servicios_overrides") || "[]");
      const idx = localCache.findIndex(x => String(x.id) === String(activeId));
      if (idx !== -1) localCache[idx] = { ...localCache[idx], ...payload, id: activeId };
      else localCache.push({ id: activeId, ...payload });
      localStorage.setItem("local_servicios_overrides", JSON.stringify(localCache));
    } catch {}
    toast("⚠️ Guardado localmente — sin conexión a la nube", "warning");
  }

  renderAll();
  showDetail(items.find(s => String(s.id) === String(selectedId)));
}

// ── Confirm before toggle active ────────────────────────────
function confirmToggleActive(s) {
  const action = s.activo === false ? "activar" : "desactivar";
  if (!confirm(`¿Seguro que desea ${action} el servicio "${s.nombre}"?`)) return;
  toggleActive(s);
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
