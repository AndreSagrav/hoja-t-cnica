import { ensureShell } from "../components/shell.js";
import { getSupabase } from "../lib/supabase.js";
import { esc, fmtMoney, debounce, toast } from "../lib/utils.js";

let items = [], selectedId = null, catFilter = "todos", search = "", showInactive = false;

export async function inventarioView() {
  const shell = ensureShell("/inventario");
  shell.setTitle(""); shell.setActions("");
  const c = shell.content();
  c.innerHTML = `
<div class="crm-panel">
  <div class="crm-header">
    <h2>📦 Inventario de Productos <span class="crm-header-count" id="inv-count">—</span></h2>
    <div class="crm-header-actions">
      <button class="crm-action-btn" id="inv-export-btn" style="flex:none; background:var(--surface-2); color:var(--navy); border:1px solid var(--border);" title="Exportar a Excel">📥 Exportar</button>
      <button class="crm-action-btn" id="inv-import-btn" style="flex:none; background:var(--surface-2); color:var(--navy); border:1px solid var(--border);" title="Importar desde Excel">📤 Importar Excel</button>
      <input type="file" id="inv-file-input" accept=".xlsx,.xls,.csv" style="display:none;" />
      <button class="crm-action-btn primary" id="inv-new-btn" style="flex:none;">＋ Nuevo Producto</button>
    </div>
  </div>
  <div class="crm-kpi-row" id="inv-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane">
      <div class="crm-search-bar">
        <div class="crm-search-wrap">
          <svg class="crm-search-icon" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input class="crm-search-input" id="inv-search" placeholder="Nombre, marca o código…" />
        </div>
        <div class="crm-search-row2">
          <label class="crm-toggle-label">
            <input type="checkbox" id="inv-inactivos" />
            <span>Ver inactivos</span>
          </label>
          <div class="crm-filter-tabs" id="inv-filters"></div>
        </div>
      </div>
      <div class="crm-list-scroll" id="inv-list">
        <div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div><div class="crm-empty-text">Cargando…</div></div>
      </div>
    </div>
    <div class="crm-detail-pane" id="inv-detail">
      <div class="crm-placeholder">
        <div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div>
        <div class="crm-placeholder-text">Seleccioná un producto</div>
        <div class="crm-placeholder-sub">Hacé clic en cualquier ítem para ver stock, especificaciones y precios.</div>
      </div>
    </div>
  </div>
</div>`;

  document.getElementById("inv-new-btn").addEventListener("click", () => showForm(null));
  document.getElementById("inv-search").addEventListener("input", debounce(e => { search = e.target.value.trim().toLowerCase(); renderList(); }, 220));
  document.getElementById("inv-inactivos").addEventListener("change", e => { showInactive = e.target.checked; renderList(); });
  document.getElementById("inv-export-btn").addEventListener("click", () => exportExcel());
  document.getElementById("inv-import-btn").addEventListener("click", () => document.getElementById("inv-file-input").click());
  document.getElementById("inv-file-input").addEventListener("change", (e) => importExcel(e));
  await loadData();
}

async function loadData() {
  const listEl = document.getElementById("inv-list");
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from("catalogo_servicios").select("*").eq("tipo", "producto").order("nombre");
    if (error) throw error;
    items = data || [];
  } catch (err) {
    console.error("Error al cargar inventario de Supabase:", err);
    toast("Error al conectar con Supabase: " + (err.message || err), "error");
    items = [];
    if (listEl) {
      listEl.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon" style="color:var(--red);">⚠️</div><div class="crm-empty-text" style="color:var(--red);">Error de Supabase: ${esc(err.message || String(err))}</div></div>`;
      return;
    }
  }
  renderAll();
}

function stockTag(n) {
  if (n <= 0) return `<span class="stock-out">Sin stock</span>`;
  if (n <= 3) return `<span class="stock-low">Stock bajo · ${n} uds.</span>`;
  return `<span class="stock-ok">${n} en stock</span>`;
}

function stockIcon(n) {
  if (n <= 0) return `<svg width="20" height="20" fill="none" stroke="#dc2626" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
  if (n <= 3) return `<svg width="20" height="20" fill="none" stroke="#d97706" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
  return `<svg width="20" height="20" fill="none" stroke="#16a34a" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
}

function renderAll() {
  renderKPIs();
  renderFilters();
  renderList();
}

function renderKPIs() {
  const inStock  = items.filter(s => (s.stock ?? 0) > 3);
  const lowStock = items.filter(s => (s.stock ?? 0) > 0 && (s.stock ?? 0) <= 3);
  const outStock = items.filter(s => (s.stock ?? 0) === 0);
  const totalVal = items.reduce((a, s) => a + ((s.precio_residencial || s.precio || 0) * (s.stock ?? 0)), 0);
  document.getElementById("inv-kpis").innerHTML = `
    <div class="crm-kpi"><div class="crm-kpi-icon blue"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg></div><div><div class="crm-kpi-label">Total productos</div><div class="crm-kpi-value">${items.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon green"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div><div class="crm-kpi-label">OK en stock</div><div class="crm-kpi-value">${inStock.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon amber"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg></div><div><div class="crm-kpi-label">Stock bajo</div><div class="crm-kpi-value">${lowStock.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon red"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div><div class="crm-kpi-label">Sin stock</div><div class="crm-kpi-value">${outStock.length}</div></div></div>`;
}

function renderFilters() {
  const cats = [...new Set(items.map(s => s.categoria).filter(Boolean))];
  document.getElementById("inv-filters").innerHTML =
    `<button class="crm-filter-tab ${catFilter==="todos"?"active":""}" data-cat="todos">Todos</button>` +
    cats.map(c => `<button class="crm-filter-tab ${catFilter===c?"active":""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
  document.querySelectorAll("#inv-filters .crm-filter-tab").forEach(b =>
    b.addEventListener("click", () => { catFilter = b.dataset.cat; renderFilters(); renderList(); }));
}

function renderList() {
  let filtered = items.filter(s => showInactive ? true : s.activo !== false);
  if (catFilter !== "todos") filtered = filtered.filter(s => s.categoria === catFilter);
  if (search) filtered = filtered.filter(s =>
    s.nombre.toLowerCase().includes(search) ||
    (s.marca || "").toLowerCase().includes(search) ||
    (s.modelo || "").toLowerCase().includes(search) ||
    (s.codigo || "").toLowerCase().includes(search));
  document.getElementById("inv-count").textContent = filtered.length;
  const box = document.getElementById("inv-list");
  if (!filtered.length) {
    box.innerHTML = `<div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg></div><div class="crm-empty-text">Sin resultados</div></div>`; return;
  }
  box.innerHTML = filtered.map(s => {
    const stock = s.stock ?? 0;
    const precio = s.precio_residencial || s.precio || 0;
    const inact = s.activo === false;
    return `<div class="crm-item ${String(selectedId)===String(s.id)?"selected":""}${inact?" crm-item-inactive":""}" data-id="${s.id}">
      <div class="crm-item-avatar av-prd">${stockIcon(stock)}</div>
      <div class="crm-item-info">
        <div class="crm-item-name">${esc(s.nombre)}${inact?` <span class="badge-inactivo">INACTIVO</span>`:""}</div>
        <div class="crm-item-sub">${esc(s.categoria||"Sin categoría")}${s.codigo?" · "+esc(s.codigo):""}</div>
      </div>
      <div class="crm-item-meta">
        ${stockTag(stock)}
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
  const inact = s.activo === false;
  const precio = s.precio_residencial || s.precio || 0;
  const precioEmp = s.precio_empresarial || 0;
  const stock = s.stock ?? 0;
  const stockColor = stock === 0 ? "#b91c1c" : stock <= 3 ? "#c2410c" : "#15803d";
  const stockBg    = stock === 0 ? "#fef2f2" : stock <= 3 ? "#fff7ed" : "#f0fdf4";
  const detailEl = document.getElementById("inv-detail");
  const crmBody = detailEl?.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');
  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <div class="detail-hero">
      <div class="detail-hero-avatar">${stockIcon(stock)}</div>
      <div class="detail-hero-info">
        <div class="detail-hero-name">${esc(s.nombre)}</div>
        <div class="detail-hero-sub">
          <span><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg> ${esc(s.categoria||"Sin categoría")}</span>
          <span><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg> ${esc(s.codigo||"Sin SKU")}</span>
        </div>
      </div>
      <div class="detail-hero-actions">
        <div style="text-align:right; margin-right: 8px;">
          <div style="font-size:20px; font-weight:900; color:#fff; line-height:1; white-space:nowrap;">${precio?fmtMoney(precio):"₡0.00"}</div>
          ${inact?`<div style="font-size:10px; font-weight:800; color:#fca5a5; text-transform:uppercase; margin-top:4px; letter-spacing:1px;">Sin Stock</div>`:""}
        </div>
        <button class="hero-btn hero-btn-edit" id="inv-edit-btn">✏️ Editar</button>
        <button class="hero-btn hero-btn-del" id="inv-del-btn">🗑️ ${inact?"Activar":"Desactivar"}</button>
      </div>
    </div>
    
    <div style="background:var(--surface); border-radius:12px; border:1px solid var(--border-light); padding:16px 20px;">
      <div style="font-size:13px; font-weight:800; color:var(--navy); margin-bottom:16px; display:flex; align-items:center; gap:6px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> 
        Inventario y Especificaciones
      </div>
      
      <div style="display:flex; flex-wrap:wrap; gap:24px; align-items:center;">
        <div style="display:flex; align-items:center; gap:12px; background:${stock>0?"rgba(20,184,166,0.05)":"rgba(239,68,68,0.05)"}; border:1px solid ${stock>0?"rgba(20,184,166,0.2)":"rgba(239,68,68,0.2)"}; border-radius:8px; padding:8px 16px;">
          <div style="font-size:28px; font-weight:900; color:${stock>0?"var(--teal)":"var(--red)"}; line-height:1;">${stock}</div>
          <div style="display:flex; flex-direction:column; justify-content:center; gap:4px;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; line-height:1;">STOCK ACTUAL</div>
            <div>${stockTag(stock)}</div>
          </div>
        </div>
        
        <div style="display:flex; gap:24px; flex:1;">
          <div style="flex:1;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; margin-bottom:4px;">MARCA</div>
            <div style="font-size:12px; font-weight:600; color:var(--navy);">${esc(s.marca||"—")}</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; margin-bottom:4px;">MODELO</div>
            <div style="font-size:12px; font-weight:600; color:var(--navy);">${esc(s.modelo||"—")}</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; margin-bottom:4px;">SERIE / IMEI</div>
            <div style="font-size:12px; font-weight:600; color:var(--navy);">${esc(s.serie||"—")}</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; margin-bottom:4px;">GARANTÍA</div>
            <div style="font-size:12px; font-weight:600; color:var(--navy);">${esc(s.garantia||"—")}</div>
          </div>
          <div style="flex:1;">
            <div style="font-size:9px; font-weight:800; color:var(--text-soft); letter-spacing:1px; margin-bottom:4px;">ESTADO</div>
            <div><span class="crm-item-tag ${s.activo===false?"tag-out":"tag-ok"}" style="font-size:10px; padding:2px 6px;">${s.activo===false?"Inactivo":"Activo"}</span></div>
          </div>
        </div>
      </div>
    </div>
    
    ${s.descripcion?`<div style="background:var(--surface); border-radius:12px; border:1px solid var(--border-light); padding:16px 20px; margin-top:16px;">
      <div style="font-size:13px; font-weight:800; color:var(--navy); margin-bottom:8px; display:flex; align-items:center; gap:6px;">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2-2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> 
        Descripción
      </div>
      <p style="font-size:12px; color:var(--text); line-height:1.6; margin:0;">${esc(s.descripcion)}</p>
    </div>`:""}`;

  document.getElementById("inv-edit-btn").addEventListener("click", () => showForm(s));
  document.getElementById("inv-del-btn").addEventListener("click", () => toggleActive(s));
}

function showForm(item) {
  const isEdit = !!item;
  selectedId = item ? String(item.id) : null;

  const detailEl = document.getElementById("inv-detail");
  if (detailEl) {
    const crmBody = detailEl.closest('.crm-body');
    if (crmBody) crmBody.classList.add('show-detail');
  }

  const catOpts = ["accesorios", "almacenamiento", "fuentes", "gabinetes", "componentes", "monitores", "perifericos", "tarjetas_graficas", "tarjetas_madre", "equipos", "otros"];
  let catSelect = `<select id="if-cat" class="input"><option value="">-- Seleccione --</option>`;
  catOpts.forEach(c => {
    catSelect += `<option value="${c}" ${item?.categoria===c?'selected':''}>${c}</option>`;
  });
  catSelect += `</select>`;

  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <div class="crm-form">
      <div class="crm-form-title">${isEdit?"✏️ Editar":"➕ Nuevo"} Producto</div>
      <div class="crm-form-grid">
        <div class="field full"><label class="field-label">Nombre *</label><input id="if-nombre" class="input" value="${esc(item?.nombre||"")}" /></div>
        <div class="field full"><label class="field-label">Descripción</label><textarea id="if-desc" class="textarea" style="min-height:65px;">${esc(item?.descripcion||"")}</textarea></div>
        <div class="field"><label class="field-label">Categoría</label>${catSelect}</div>
        <div class="field"><label class="field-label">Marca</label><input id="if-marca" class="input" value="${esc(item?.marca||"")}" /></div>
        <div class="field"><label class="field-label">Modelo</label><input id="if-modelo" class="input" value="${esc(item?.modelo||"")}" /></div>
        <div class="field"><label class="field-label">Código / SKU Interno</label><input id="if-codigo" class="input" value="${esc(item?.codigo||"")}" placeholder="Autogenerado" /></div>
        <div class="field"><label class="field-label">Serie / IMEI</label><input id="if-serie" class="input" value="${esc(item?.serie||"")}" /></div>
        <div class="field"><label class="field-label">Stock actual</label><input id="if-stock" type="number" class="input" value="${item?.stock??0}" min="0" /></div>
        
        <div class="field"><label class="field-label">Precio de Costo ₡</label><input id="if-costo" type="number" class="input" value="${item?.costo||""}" min="0" /></div>
        <div class="field" style="display:none;"></div> <!-- Filler para alinear -->
        
        <div class="field"><label class="field-label">Margen Residencial (%)</label><input id="if-margen-res" type="number" class="input" value="${item?.margen_residencial||""}" /></div>
        <div class="field"><label class="field-label">Precio Residencial ₡</label><input id="if-pres" type="number" class="input" value="${item?.precio_residencial??item?.precio??""}" /></div>
        
        <div class="field"><label class="field-label">Margen Empresarial (%)</label><input id="if-margen-emp" type="number" class="input" value="${item?.margen_empresarial||""}" /></div>
        <div class="field"><label class="field-label">Precio Empresarial ₡</label><input id="if-pemp" type="number" class="input" value="${item?.precio_empresarial??""}" /></div>
        
        <div class="field"><label class="field-label">Fecha de Compra</label><input id="if-fecha-compra" type="date" class="input" value="${esc(item?.fecha_compra||"")}" /></div>
        <div class="field"><label class="field-label">Garantía Proveedor (Meses)</label><input id="if-gar" type="number" class="input" value="${esc(item?.garantia||"")}" /></div>
        <div class="field full" style="display:flex;align-items:center;gap:8px;"><label class="field-label">Activo</label><input id="if-activo" type="checkbox" ${item?.activo!==false?"checked":""} /></div>
      </div>
      <div class="crm-form-actions">
        <button class="btn btn-ghost" id="if-cancel">Cancelar</button>
        <button class="btn btn-primary" id="if-save">💾 Guardar</button>
      </div>
    </div>`;

  // Lógica para Auto-SKU
  const marcaEl = document.getElementById("if-marca");
  const modeloEl = document.getElementById("if-modelo");
  const skuEl = document.getElementById("if-codigo");
  
  const updateSKU = () => {
    const marca = marcaEl.value.trim().substring(0, 3).toUpperCase();
    const modelo = modeloEl.value.trim().toUpperCase();
    if(marca || modelo) {
      skuEl.value = `${marca ? marca : 'XXX'}-${modelo}`.trim();
    }
  };
  if (!isEdit) {
    marcaEl.addEventListener("input", updateSKU);
    modeloEl.addEventListener("input", updateSKU);
  }

  // Lógica para Cálculo de Márgenes y Precios
  const costoEl = document.getElementById("if-costo");
  const mrEl = document.getElementById("if-margen-res");
  const prEl = document.getElementById("if-pres");
  const meEl = document.getElementById("if-margen-emp");
  const peEl = document.getElementById("if-pemp");

  const calcPrice = (cost, margin) => {
    if (!cost || margin >= 100) return "";
    return Math.round(cost / (1 - (margin / 100)));
  };
  const calcMargin = (cost, price) => {
    if (!price || !cost) return "";
    return Math.round(100 * (1 - (cost / price)));
  };

  const updatePricesFromMargin = () => {
    const cost = Number(costoEl.value) || 0;
    prEl.value = calcPrice(cost, Number(mrEl.value));
    peEl.value = calcPrice(cost, Number(meEl.value));
  };

  costoEl.addEventListener("input", updatePricesFromMargin);
  mrEl.addEventListener("input", () => { prEl.value = calcPrice(Number(costoEl.value), Number(mrEl.value)); });
  meEl.addEventListener("input", () => { peEl.value = calcPrice(Number(costoEl.value), Number(meEl.value)); });
  
  prEl.addEventListener("input", () => { mrEl.value = calcMargin(Number(costoEl.value), Number(prEl.value)); });
  peEl.addEventListener("input", () => { meEl.value = calcMargin(Number(costoEl.value), Number(peEl.value)); });

  document.getElementById("if-cancel").addEventListener("click", () =>
    selectedId ? showDetail(items.find(s => String(s.id) === String(selectedId))) : renderAll());
  document.getElementById("if-save").addEventListener("click", () => saveItem(item?.id));
}

async function saveItem(id) {
  const nombre = document.getElementById("if-nombre").value.trim();
  if (!nombre) { toast("Nombre obligatorio", "error"); return; }
  const payload = {
    nombre, tipo: "producto",
    descripcion: document.getElementById("if-desc").value.trim() || null,
    codigo: document.getElementById("if-codigo").value.trim() || null,
    categoria: document.getElementById("if-cat").value.trim() || null,
    marca: document.getElementById("if-marca").value.trim() || null,
    modelo: document.getElementById("if-modelo").value.trim() || null,
    serie: document.getElementById("if-serie").value.trim() || null,
    stock: parseInt(document.getElementById("if-stock").value) || 0,
    
    costo: Number(document.getElementById("if-costo").value) || 0,
    margen_residencial: Number(document.getElementById("if-margen-res").value) || 0,
    precio_residencial: Number(document.getElementById("if-pres").value) || 0,
    margen_empresarial: Number(document.getElementById("if-margen-emp").value) || 0,
    precio_empresarial: Number(document.getElementById("if-pemp").value) || 0,
    precio: Number(document.getElementById("if-pres").value) || 0,
    
    fecha_compra: document.getElementById("if-fecha-compra").value || null,
    garantia: document.getElementById("if-gar").value.trim() || null,
    activo: document.getElementById("if-activo").checked
  };

  try {
    const supabase = await getSupabase();
    const { data, error } = id
      ? await supabase.from("catalogo_servicios").update(payload).eq("id", id).select().single()
      : await supabase.from("catalogo_servicios").insert([payload]).select().single();
    if (error) throw error;
    toast(id ? "Producto actualizado" : "Producto creado");
    await loadData();
    selectedId = String(data.id);
  } catch (err) {
    console.warn("Guardado local/demo en memoria:", err.message || err);
    if (id) {
      const idx = items.findIndex(x => String(x.id) === String(id));
      if (idx !== -1) items[idx] = { ...items[idx], ...payload };
      toast("Producto actualizado (Demo)");
    } else {
      const newId = "p_local_" + Math.random().toString(36).substr(2, 9);
      const newProd = { id: newId, ...payload };
      items.push(newProd);
      id = newId;
      toast("Producto creado (Demo)");
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
    toast(s.activo === false ? "Producto activado" : "Producto desactivado");
    await loadData();
  } catch (err) {
    console.warn("Toggle local/demo en memoria:", err.message || err);
    const idx = items.findIndex(x => String(x.id) === String(s.id));
    if (idx !== -1) {
      items[idx].activo = (s.activo === false);
    }
    toast(s.activo === false ? "Producto activado (Demo)" : "Producto desactivado (Demo)");
  }
  renderList();
  showDetail(items.find(x => String(x.id) === String(s.id)));
}

/* ====== Importar / Exportar Excel ====== */

async function loadXLSX() {
  try {
    const mod = await import('https://esm.sh/xlsx@0.18.5');
    return mod.default || mod;
  } catch (_) {
    const mod = await import('https://cdn.sheetjs.com/xlsx-0.18.5/package/xlsx.mjs');
    return mod.default || mod;
  }
}

async function exportExcel() {
  if (!items.length) { toast("No hay productos para exportar", "error"); return; }
  try {
    toast("Generando Excel…", "info");
    const XLSX = await loadXLSX();
    const rows = items.map(s => ({
      'Nombre': s.nombre || '',
      'Descripción': s.descripcion || '',
      'Categoría': s.categoria || '',
      'Marca': s.marca || '',
      'Modelo': s.modelo || '',
      'Código / SKU': s.codigo || '',
      'Serie / IMEI': s.serie || '',
      'Stock': s.stock ?? 0,
      'Precio Costo': s.costo || 0,
      'Margen Residencial (%)': s.margen_residencial || 0,
      'Precio Residencial': s.precio_residencial || s.precio || 0,
      'Margen Empresarial (%)': s.margen_empresarial || 0,
      'Precio Empresarial': s.precio_empresarial || 0,
      'Fecha Compra': s.fecha_compra || '',
      'Garantía (Meses)': s.garantia || '',
      'Activo': s.activo === false ? 'No' : 'Sí'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `inventario_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast("Excel exportado correctamente", "success");
  } catch (err) {
    console.error("Error exportando Excel:", err);
    toast("Error al exportar: " + (err.message || err), "error");
  }
}

async function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  try {
    toast("Leyendo archivo…", "info");
    const XLSX = await loadXLSX();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws);

    if (!rows.length) { toast("El archivo no tiene datos", "error"); return; }

    const validCats = ["accesorios","almacenamiento","fuentes","gabinetes","componentes","monitores","perifericos","tarjetas_graficas","tarjetas_madre","equipos","otros"];
    const toInsert = [];
    let skipped = 0;

    for (const row of rows) {
      const nombre = (row['Nombre'] || row['nombre'] || '').toString().trim();
      if (!nombre) { skipped++; continue; }

      const categoriaRaw = (row['Categoría'] || row['categoria'] || '').toString().trim().toLowerCase();
      const categoria = validCats.includes(categoriaRaw) ? categoriaRaw : (categoriaRaw || 'otros');

      const payload = {
        nombre,
        tipo: 'producto',
        descripcion: (row['Descripción'] || row['descripcion'] || '').toString().trim() || null,
        codigo: (row['Código / SKU'] || row['codigo'] || row['Codigo'] || '').toString().trim() || null,
        categoria,
        marca: (row['Marca'] || row['marca'] || '').toString().trim() || null,
        modelo: (row['Modelo'] || row['modelo'] || '').toString().trim() || null,
        serie: (row['Serie / IMEI'] || row['serie'] || '').toString().trim() || null,
        stock: parseInt(row['Stock'] || row['stock'] || 0) || 0,
        costo: Number(row['Precio Costo'] || row['costo'] || 0) || 0,
        margen_residencial: Number(row['Margen Residencial (%)'] || row['margen_residencial'] || 0) || 0,
        precio_residencial: Number(row['Precio Residencial'] || row['precio_residencial'] || row['precio'] || 0) || 0,
        margen_empresarial: Number(row['Margen Empresarial (%)'] || row['margen_empresarial'] || 0) || 0,
        precio_empresarial: Number(row['Precio Empresarial'] || row['precio_empresarial'] || 0) || 0,
        fecha_compra: (row['Fecha Compra'] || row['fecha_compra'] || '').toString().trim() || null,
        garantia: (row['Garantía (Meses)'] || row['garantia'] || '').toString().trim() || null,
        activo: (row['Activo'] || row['activo'] || 'Sí').toString().trim().toLowerCase() !== 'no'
      };
      payload.precio = payload.precio_residencial;
      toInsert.push(payload);
    }

    if (!toInsert.length) { toast("No se encontraron filas válidas", "error"); return; }

    toast(`Importando ${toInsert.length} productos…`, "info");

    const supabase = await getSupabase();
    const { data, error } = await supabase.from("catalogo_servicios").insert(toInsert).select();
    if (error) throw error;

    toast(`${toInsert.length} productos importados correctamente${skipped ? `, ${skipped} filas omitidas` : ''}`, "success");
    await loadData();
  } catch (err) {
    console.error("Error importando Excel:", err);
    toast("Error al importar: " + (err.message || err), "error");
  }
}
