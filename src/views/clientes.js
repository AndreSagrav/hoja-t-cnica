import { ensureShell } from "../components/shell.js";
import { getSupabase, withTimeout } from "../lib/supabase.js";
import { esc, debounce, toast, fmtDate } from "../lib/utils.js";
import { parseUsuarios } from "../data/documentos.js";
import { asignarCodigoFiscal } from "../lib/hacienda.js";
import { consultarIdentificacionHacienda } from "../lib/hacienda-api.js";
import { PROVINCIAS_CR, CANTONES_CR, DISTRITOS_CR } from "../data/ubicaciones-cr.js";

let items = [], selectedId = null, search = "", typeFilter = "todos";
let currentClientMergedEquipos = [], currentEqFilter = "activos";

export async function clientesListView() {
  const shell = ensureShell("/clientes");
  shell.setTitle("Clientes");
  shell.setActions("");
  const c = shell.content();

  c.innerHTML = `
    <div class="t1-clients-view">
      
      <!-- ENCABEZADO TIER-1 MINIMALISTA -->
      <div class="t1-crm-header">
        <div class="t1-crm-title-area">
          <h1 class="t1-crm-title">Clientes</h1>
          <span class="t1-crm-count-badge" id="cli-count-badge">— Registrados</span>
        </div>

        <div style="display: flex; align-items: center; gap: 12px;">
          <button class="crm-action-btn primary" id="cli-new-btn" style="padding: 9px 18px; border-radius: 8px; font-weight: 700; background: var(--innovio-teal); border: none; color: #fff; box-shadow: 0 2px 8px rgba(0, 194, 168, 0.25); cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Cliente
          </button>
        </div>
      </div>

      <!-- MÉTRICAS DE ALTA DENSIDAD (4 COLUMNAS EQUILIBRADAS) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;" id="cli-kpis"></div>

      <!-- TABLA DE ANCHO COMPLETO (CERO TEXTOS APELOTADOS O CORTADOS) -->
      <div class="t1-clients-table-card">
        
        <!-- Barra de herramientas: Búsqueda y Filtros de Chip -->
        <div class="t1-clients-toolbar">
          
          <div class="t1-clients-search-box">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
            <input class="t1-clients-search-input" id="cli-search" placeholder="Buscar por razón social, contacto, cédula o correo…" />
          </div>

          <div class="t1-filter-group" id="cli-filter-tabs">
            <button class="t1-filter-btn active" data-filter="todos">Todos (<span id="count-all">0</span>)</button>
            <button class="t1-filter-btn" data-filter="empresarial">Empresas (<span id="count-emp">0</span>)</button>
            <button class="t1-filter-btn" data-filter="residencial">Personas Físicas (<span id="count-res">0</span>)</button>
          </div>

        </div>

        <!-- Tabla Completa con Razón Social Expandida -->
        <div style="overflow-x: auto;">
          <table class="t1-full-table">
            <thead>
              <tr>
                <th style="min-width: 320px;">Cliente / Razón Social</th>
                <th style="min-width: 180px;">Contacto Principal</th>
                <th style="min-width: 140px;">Cédula Oficial</th>
                <th style="min-width: 110px;">Código Fiscal</th>
                <th style="min-width: 220px;">Correo de Facturación</th>
                <th style="min-width: 130px;">Teléfono</th>
                <th style="min-width: 120px;">Tipo</th>
                <th style="text-align: right; min-width: 110px;">Acciones</th>
              </tr>
            </thead>
            <tbody id="cli-table-body">
              <tr>
                <td colspan="8" style="text-align: center; padding: 48px 24px; color: var(--muted-color);">Cargando directorio de clientes…</td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

    </div>

    <!-- SLIDE-OVER DRAWER (FICHA EXPEDIENTE 360° DESLIZANTE) -->
    <div class="t1-drawer-overlay" id="cli-drawer-overlay"></div>
    <div class="t1-drawer-panel" id="cli-drawer-panel">
      <div class="t1-drawer-header">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted-color);">Expediente de Cliente</span>
        </div>
        <button class="t1-drawer-close-btn" id="cli-drawer-close" title="Cerrar (Esc)">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div class="t1-drawer-scroll" id="cli-drawer-content"></div>
    </div>
  `;

  document.getElementById("cli-new-btn").addEventListener("click", () => showForm(null));
  document.getElementById("cli-search").addEventListener("input", debounce(e => { search = e.target.value.trim().toLowerCase(); renderTable(); }, 200));
  
  document.getElementById("cli-filter-tabs").addEventListener("click", (e) => {
    const btn = e.target.closest(".t1-filter-btn");
    if (!btn) return;
    document.querySelectorAll(".t1-filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    typeFilter = btn.dataset.filter;
    renderTable();
  });

  // Drawer Close handlers
  const closeDrawer = () => {
    document.getElementById("cli-drawer-overlay")?.classList.remove("open");
    document.getElementById("cli-drawer-panel")?.classList.remove("open");
  };
  document.getElementById("cli-drawer-close")?.addEventListener("click", closeDrawer);
  document.getElementById("cli-drawer-overlay")?.addEventListener("click", closeDrawer);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeDrawer();
  });

  loadData();
}

async function loadData() {
  try {
    const supabase = await getSupabase();
    const result = await withTimeout(
      supabase.from("clientes").select("*").order("codigo_fiscal", { ascending: true, nullsFirst: false }),
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
    console.error("Error al cargar clientes de Supabase:", err);
    toast("Error de conexión: " + (err.message || err), "error");
    items = [];
  }
  renderAll();
}

function renderAll() {
  const badgeEl = document.getElementById("cli-count-badge");
  if (badgeEl) badgeEl.textContent = `${items.length} Registrados`;

  const activeEmp = items.filter(c => c.tipo_cliente === "empresarial").length;
  const activeRes = items.filter(c => c.tipo_cliente === "residencial").length;

  const countAll = document.getElementById("count-all");
  const countEmp = document.getElementById("count-emp");
  const countRes = document.getElementById("count-res");
  if (countAll) countAll.textContent = items.length;
  if (countEmp) countEmp.textContent = activeEmp;
  if (countRes) countRes.textContent = activeRes;

  renderKPIs(activeEmp, activeRes);
  renderTable();
}

function renderKPIs(activeEmp, activeRes) {
  const kpis = document.getElementById("cli-kpis");
  if (!kpis) return;
  const total = items.length;
  const empPercent = total > 0 ? Math.round((activeEmp / total) * 100) : 0;
  const resPercent = total > 0 ? Math.round((activeRes / total) * 100) : 0;
  const withCedula = items.filter(c => Boolean(c.fact_numero_id || c.cedula)).length;
  const cedulaPercent = total > 0 ? Math.round((withCedula / total) * 100) : 0;

  kpis.innerHTML = `
    <!-- CARD 1: DIRECTORIO TOTAL -->
    <div class="t1-clean-kpi-card">
      <div class="t1-clean-kpi-header">
        <span class="t1-clean-kpi-label">Directorio Activo</span>
        <span class="t1-clean-kpi-badge" style="background: rgba(11, 36, 78, 0.08); color: var(--innovio-navy);">100% Cartera</span>
      </div>
      <div class="t1-clean-kpi-value">${total} <span style="font-size: 14px; font-weight: 600; color: var(--muted-color);">cuentas registradas</span></div>
      <div class="t1-clean-kpi-bar-track" title="${empPercent}% Empresas / ${resPercent}% Físicas" style="display: flex;">
        <div style="width: ${empPercent}%; height: 100%; background: #0284c7;"></div>
        <div style="width: ${resPercent}%; height: 100%; background: var(--innovio-teal);"></div>
      </div>
      <div class="t1-clean-kpi-footer">
        <span class="t1-clean-kpi-footer-main">${activeEmp} Empresas / ${activeRes} Físicas</span>
        <span class="t1-clean-kpi-footer-sub" style="color: var(--heading-color);">Total: ${total}</span>
      </div>
    </div>

    <!-- CARD 2: EMPRESAS (JURÍDICAS) -->
    <div class="t1-clean-kpi-card">
      <div class="t1-clean-kpi-header">
        <span class="t1-clean-kpi-label">Empresas (Jurídicas)</span>
        <span class="t1-clean-kpi-badge" style="background: rgba(2, 132, 199, 0.1); color: #0284c7;">${empPercent}% Cuota</span>
      </div>
      <div class="t1-clean-kpi-value" style="color: #0284c7;">${activeEmp} <span style="font-size: 14px; font-weight: 600; color: var(--muted-color);">cuentas B2B</span></div>
      <div class="t1-clean-kpi-bar-track">
        <div class="t1-clean-kpi-bar-fill" style="width: ${empPercent}%; background: #0284c7;"></div>
      </div>
      <div class="t1-clean-kpi-footer">
        <span class="t1-clean-kpi-footer-main">Cuentas corporativas registradas</span>
        <span class="t1-clean-kpi-footer-sub" style="color: #0284c7;">${activeEmp} de ${total}</span>
      </div>
    </div>

    <!-- CARD 3: PERSONAS FÍSICAS -->
    <div class="t1-clean-kpi-card">
      <div class="t1-clean-kpi-header">
        <span class="t1-clean-kpi-label">Personas Físicas</span>
        <span class="t1-clean-kpi-badge" style="background: rgba(0, 194, 168, 0.1); color: var(--innovio-teal);">${resPercent}% Cuota</span>
      </div>
      <div class="t1-clean-kpi-value" style="color: var(--innovio-teal);">${activeRes} <span style="font-size: 14px; font-weight: 600; color: var(--muted-color);">cliente particular</span></div>
      <div class="t1-clean-kpi-bar-track">
        <div class="t1-clean-kpi-bar-fill" style="width: ${resPercent}%; background: var(--innovio-teal);"></div>
      </div>
      <div class="t1-clean-kpi-footer">
        <span class="t1-clean-kpi-footer-main">Clientes particulares en cartera</span>
        <span class="t1-clean-kpi-footer-sub" style="color: var(--innovio-teal);">${activeRes} de ${total}</span>
      </div>
    </div>

    <!-- CARD 4: HACIENDA V4.4 -->
    <div class="t1-clean-kpi-card">
      <div class="t1-clean-kpi-header">
        <span class="t1-clean-kpi-label">Hacienda v4.4</span>
        <span class="t1-clean-kpi-badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981;">✓ ${cedulaPercent}% Listo FE</span>
      </div>
      <div class="t1-clean-kpi-value" style="color: #10b981;">${withCedula} / ${total} <span style="font-size: 14px; font-weight: 600; color: var(--muted-color);">cédulas</span></div>
      <div class="t1-clean-kpi-bar-track">
        <div class="t1-clean-kpi-bar-fill" style="width: ${cedulaPercent}%; background: #10b981;"></div>
      </div>
      <div class="t1-clean-kpi-footer">
        <span class="t1-clean-kpi-footer-main">Cédulas verificadas en DGT</span>
        <span class="t1-clean-kpi-footer-sub" style="color: #10b981;">${withCedula} registradas</span>
      </div>
    </div>
  `;
}

function renderTable() {
  let filtered = [...items];
  if (typeFilter !== "todos") filtered = filtered.filter(c => c.tipo_cliente === typeFilter);
  if (search) filtered = filtered.filter(c =>
    (c.nombre || "").toLowerCase().includes(search) ||
    (c.empresa || "").toLowerCase().includes(search) ||
    (c.email || "").toLowerCase().includes(search) ||
    (c.telefono || "").toLowerCase().includes(search) ||
    (c.cedula || "").toLowerCase().includes(search) ||
    (c.fact_numero_id || "").toLowerCase().includes(search)
  );

  filtered.sort((a, b) => {
    const codeA = a.codigo_fiscal != null ? Number(a.codigo_fiscal) : 999999;
    const codeB = b.codigo_fiscal != null ? Number(b.codigo_fiscal) : 999999;
    return codeA - codeB;
  });

  const tbody = document.getElementById("cli-table-body");
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 48px 24px; color: var(--muted-color); font-size: 13.5px;">
          Sin coincidencias para "${esc(search)}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const isEmp = c.tipo_cliente === "empresarial";
    const mainText = isEmp && c.empresa ? c.empresa : c.nombre;
    const contactText = isEmp && c.empresa ? c.nombre : "—";
    const avatarInitials = getInitials(mainText);
    const cedula = c.fact_numero_id || c.cedula || "—";
    const email = c.fact_email || c.email || "—";
    const tel = c.fact_telefono || c.telefono || "—";

    return `
      <tr data-id="${c.id}" class="cli-row">
        <td>
          <div class="t1-table-client-cell">
            <div class="t1-table-avatar ${isEmp ? '' : 'res'}">${avatarInitials}</div>
            <div>
              <div class="t1-table-client-name">${esc(mainText)}</div>
            </div>
          </div>
        </td>
        <td style="font-weight: 500; color: var(--body-color);">
          ${esc(contactText)}
        </td>
        <td>
          <span style="font-family: var(--font-mono); font-weight: 700; color: var(--heading-color);">${esc(cedula)}</span>
        </td>
        <td>
          ${c.codigo_fiscal ? `<span class="t1-crm-code-pill">#${String(c.codigo_fiscal).padStart(5, '0')}</span>` : '<span style="color:var(--muted-color);">—</span>'}
        </td>
        <td style="color: var(--muted-color); font-size: 13px;">
          ${esc(email)}
        </td>
        <td style="font-family: var(--font-mono); font-size: 13px; color: var(--body-color);">
          ${esc(tel)}
        </td>
        <td>
          <span class="t1-crm-type-pill ${isEmp ? 't1-type-emp' : 't1-type-res'}">
            ${isEmp ? 'Empresarial' : 'Residencial'}
          </span>
        </td>
        <td style="text-align: right;">
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <button class="btn-inspect-cli" data-id="${c.id}" style="padding: 5px 10px; font-size: 12px; font-weight: 700; background: var(--panel-subtle); border: 1px solid var(--panel-border); color: var(--heading-color); border-radius: 6px; cursor: pointer;">
              Expediente
            </button>
            <button class="btn-invoice-cli" data-id="${c.id}" title="Emitir Factura" style="padding: 5px 8px; font-size: 12px; font-weight: 700; background: rgba(0, 194, 168, 0.1); border: 1px solid rgba(0, 194, 168, 0.25); color: var(--innovio-teal); border-radius: 6px; cursor: pointer;">
              + FE
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Row Click opens Slide-over Drawer
  tbody.querySelectorAll(".cli-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-invoice-cli")) {
        const id = e.target.closest(".btn-invoice-cli").dataset.id;
        window.location.hash = `/documentos/nuevo/cotizacion?cliente_id=${id}`;
        return;
      }
      const id = row.dataset.id;
      openClientDrawer(id);
    });
  });
}

function getInitials(str) {
  if (!str) return "—";
  return str.split(" ").filter(Boolean).map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

async function openClientDrawer(id) {
  const item = items.find(c => String(c.id) === String(id));
  if (!item) return;

  const overlay = document.getElementById("cli-drawer-overlay");
  const panel = document.getElementById("cli-drawer-panel");
  const content = document.getElementById("cli-drawer-content");
  if (!panel || !content) return;

  const isEmp = item.tipo_cliente === 'empresarial';
  const tipoLabel = isEmp ? 'Cuenta Empresarial' : 'Persona Física';
  const displayName = isEmp && item.empresa ? item.empresa : item.nombre;
  const subName = isEmp && item.empresa ? item.nombre : null;
  const initials = getInitials(displayName);

  // Render Skeleton Structure with 3 Executive Tabs
  content.innerHTML = `
    <!-- HERO DEL CLIENTE -->
    <div class="t1-detail-hero" style="margin-bottom: 0;">
      <div class="t1-detail-hero-left">
        <div class="t1-detail-hero-avatar" style="width: 46px; height: 46px; font-size: 16px;">${initials}</div>
        <div>
          <h2 class="t1-detail-hero-name" style="font-size: 17px;">${esc(displayName)}</h2>
          <div class="t1-detail-hero-tags">
            ${item.codigo_fiscal ? `<span class="t1-crm-code-pill">#${String(item.codigo_fiscal).padStart(5, '0')}</span>` : ''}
            <span class="t1-crm-type-pill ${isEmp ? 't1-type-emp' : 't1-type-res'}">${tipoLabel}</span>
            ${subName ? `<span style="font-size:12px; color:var(--muted-color);">· Contacto: ${esc(subName)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- PESTAÑAS EJECUTIVAS TIER-1 (CUSTOMER 360°) -->
    <div class="t1-client-tabs-bar">
      <button class="t1-c360-tab-btn active" data-tab="ficha">
        📋 Ficha & Fiscal
      </button>
      <button class="t1-c360-tab-btn" data-tab="equipos">
        💻 Equipos / Inventario (<span id="c360-count-equipos">...</span>)
      </button>
      <button class="t1-c360-tab-btn" data-tab="docs">
        📄 Historial (<span id="c360-count-docs">...</span>)
      </button>
    </div>

    <!-- PESTAÑA 1: FICHA & FACTURACIÓN -->
    <div class="t1-c360-tab-pane active" id="c360-pane-ficha">
      <!-- Acciones de edición -->
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button id="drawer-btn-edit" class="t1-btn-primary" style="flex: 1; padding: 7px 12px; font-size: 12px;">
          <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
          Editar Ficha
        </button>
        <button id="drawer-btn-fe" style="padding: 7px 12px; font-size: 12px; font-weight: 600; background: var(--panel-subtle); border: 1px solid var(--panel-border); color: var(--heading-color); border-radius: 6px; cursor: pointer;">
          ＋ Factura
        </button>
        <button id="drawer-btn-ot" style="padding: 7px 12px; font-size: 12px; font-weight: 600; background: var(--panel-subtle); border: 1px solid var(--panel-border); color: var(--heading-color); border-radius: 6px; cursor: pointer;">
          ＋ Orden OT
        </button>
        <button id="drawer-btn-del" style="padding: 7px 10px; font-size: 12px; font-weight: 600; background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.2); color: #f43f5e; border-radius: 6px; cursor: pointer;" title="Eliminar cliente">
          🗑
        </button>
      </div>

      <!-- Tarjeta Fiscal Hacienda v4.4 -->
      <div class="t1-detail-card" style="margin-bottom: 0;">
        <div class="t1-detail-card-header">
          <h3 class="t1-detail-card-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:var(--innovio-teal);"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Facturación Electrónica (DGT v4.4)
          </h3>
          <span style="font-size: 10.5px; font-weight: 700; padding: 2px 7px; border-radius: 5px; background: rgba(16, 185, 129, 0.1); color: #10b981;">✓ Validado</span>
        </div>

        <div class="t1-detail-grid">
          <div class="t1-field-box">
            <span class="t1-field-label">Código Fiscal</span>
            <span class="t1-field-val mono">${item.codigo_fiscal ? String(item.codigo_fiscal).padStart(5, '0') : '—'}</span>
          </div>
          <div class="t1-field-box">
            <span class="t1-field-label">Tipo Cédula</span>
            <span class="t1-field-val" style="text-transform: capitalize;">${esc(item.fact_tipo_id || "—")}</span>
          </div>
          <div class="t1-field-box">
            <span class="t1-field-label">Cédula Oficial</span>
            <span class="t1-field-val mono">${esc(item.fact_numero_id || item.cedula || "—")}</span>
          </div>
          <div class="t1-field-box">
            <span class="t1-field-label">Email Recepción FE</span>
            <span class="t1-field-val">${esc(item.fact_email || item.email || "—")}</span>
          </div>
          <div class="t1-field-box" style="grid-column: 1 / -1;">
            <span class="t1-field-label">Razón Social Registrada</span>
            <span class="t1-field-val">${esc(item.fact_nombre || displayName || "—")}</span>
          </div>
          <div class="t1-field-box" style="grid-column: 1 / -1;">
            <span class="t1-field-label">Ubicación Tributaria</span>
            <span class="t1-field-val">
              ${[item.fact_provincia, item.fact_canton, item.fact_distrito].filter(Boolean).map(esc).join(' · ') || "—"}
              ${item.fact_otras_senas ? ` — ${esc(item.fact_otras_senas)}` : ''}
            </span>
          </div>
        </div>
      </div>

      <!-- Tarjeta Contacto Directo -->
      <div class="t1-detail-card" style="margin-bottom: 0;">
        <div class="t1-detail-card-header">
          <h3 class="t1-detail-card-title">
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color:#0284c7;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
            Contacto & Operaciones
          </h3>
        </div>

        <div class="t1-detail-grid">
          <div class="t1-field-box">
            <span class="t1-field-label">Correo Operativo</span>
            <span class="t1-field-val">${esc(item.email || "—")}</span>
          </div>
          <div class="t1-field-box">
            <span class="t1-field-label">Teléfono Directo</span>
            <span class="t1-field-val mono">${esc(item.telefono || "—")}</span>
          </div>
          <div class="t1-field-box" style="grid-column: 1 / -1;">
            <span class="t1-field-label">Dirección Física / Ubicación</span>
            <span class="t1-field-val">${esc(item.direccion || "—")}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- PESTAÑA 2: EQUIPOS / INVENTARIO DEL CLIENTE -->
    <div class="t1-c360-tab-pane" id="c360-pane-equipos">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap;">
        <div>
          <span style="font-size: 12.5px; font-weight: 700; color: var(--heading-color);">Parque de Equipos</span>
          <div style="font-size: 11px; color: var(--muted-color);">Equipos atendidos o en custodia de este cliente</div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button id="btn-c360-export-equipos" class="t1-btn-secondary" style="padding: 5px 9px; font-size: 11px; display: inline-flex; align-items: center; gap: 4px; border: 1px solid var(--panel-border); background: var(--panel-subtle); border-radius: 6px; cursor: pointer; color: var(--heading-color); font-weight: 600;" title="Descargar inventario en CSV / Excel">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
            Descargar
          </button>
          <button id="btn-c360-add-equipo" class="t1-btn-primary" style="padding: 5px 10px; font-size: 11.5px;">
            ＋ Registrar Equipo
          </button>
        </div>
      </div>

      <!-- Barra de Filtros de Estado de Equipos -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; margin-bottom: 2px;">
        <div class="t1-eq-filter-group" id="c360-eq-filters" style="display: inline-flex; background: var(--panel-subtle); padding: 2px; border-radius: 6px; border: 1px solid var(--panel-border);">
          <button class="t1-eq-filter-btn active" data-filter="activos" style="padding: 3px 8px; font-size: 10.5px; font-weight: 600; border: none; background: #fff; color: var(--innovio-navy); border-radius: 4px; cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">Activos (<span id="c360-eq-count-activos">0</span>)</button>
          <button class="t1-eq-filter-btn" data-filter="archivados" style="padding: 3px 8px; font-size: 10.5px; font-weight: 600; border: none; background: transparent; color: var(--muted-color); border-radius: 4px; cursor: pointer;">Archivados (<span id="c360-eq-count-archivados">0</span>)</button>
          <button class="t1-eq-filter-btn" data-filter="todos" style="padding: 3px 8px; font-size: 10.5px; font-weight: 600; border: none; background: transparent; color: var(--muted-color); border-radius: 4px; cursor: pointer;">Todos (<span id="c360-eq-count-todos">0</span>)</button>
        </div>
      </div>

      <div id="c360-equipos-list" style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
        <div style="padding: 24px; text-align: center; color: var(--muted-color); font-size: 12px;">Cargando inventario de equipos...</div>
      </div>
    </div>

    <!-- PESTAÑA 3: HISTORIAL DE DOCUMENTOS -->
    <div class="t1-c360-tab-pane" id="c360-pane-docs">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
        <div>
          <span style="font-size: 12.5px; font-weight: 700; color: var(--heading-color);">Historial de Comprobantes</span>
          <div style="font-size: 11px; color: var(--muted-color);">Órdenes de trabajo, facturas y cotizaciones</div>
        </div>
        <a href="#/documentos" style="font-size: 11.5px; font-weight: 700; color: var(--innovio-teal); text-decoration: none;">
          Ver en módulo Documentos ↗
        </a>
      </div>

      <div id="c360-docs-list" style="margin-top: 4px;">
        <div style="padding: 24px; text-align: center; color: var(--muted-color); font-size: 12px;">Consultando historial de documentos...</div>
      </div>
    </div>
  `;

  // Wire Tab Switching
  content.querySelectorAll(".t1-c360-tab-btn").forEach(btn => {
    btn.onclick = () => {
      content.querySelectorAll(".t1-c360-tab-btn").forEach(b => b.classList.remove("active"));
      content.querySelectorAll(".t1-c360-tab-pane").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const targetPane = document.getElementById(`c360-pane-${btn.dataset.tab}`);
      if (targetPane) targetPane.classList.add("active");
    };
  });

  // Wire Ficha Actions
  document.getElementById("drawer-btn-edit")?.addEventListener("click", () => {
    closeDrawer();
    showForm(item.id);
  });
  document.getElementById("drawer-btn-fe")?.addEventListener("click", () => {
    window.location.hash = `/documentos/nuevo/cotizacion?cliente_id=${item.id}`;
  });
  document.getElementById("drawer-btn-ot")?.addEventListener("click", () => {
    window.location.hash = `/documentos/nuevo/orden?cliente_id=${item.id}`;
  });
  document.getElementById("drawer-btn-del")?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar el cliente "${displayName}"?`)) return;
    try {
      const supabase = await getSupabase();
      const { error } = await supabase.from("clientes").delete().eq("id", item.id);
      if (error) throw error;
      toast("Cliente eliminado correctamente", "info");
      closeDrawer();
      loadData();
    } catch (e) {
      toast("Error al eliminar: " + e.message, "error");
    }
  });

  // Wire Add Equipo button
  document.getElementById("btn-c360-add-equipo")?.addEventListener("click", () => {
    showAddEquipoModal(item);
  });

  // Wire Export Equipos
  document.getElementById("btn-c360-export-equipos")?.addEventListener("click", () => {
    exportClientEquiposCSV(item, currentClientMergedEquipos);
  });

  // Wire Filter tabs
  currentEqFilter = "activos";
  document.querySelectorAll("#c360-eq-filters .t1-eq-filter-btn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll("#c360-eq-filters .t1-eq-filter-btn").forEach(b => {
        b.classList.remove("active");
        b.style.background = "transparent";
        b.style.color = "var(--muted-color)";
        b.style.boxShadow = "none";
      });
      btn.classList.add("active");
      btn.style.background = "#fff";
      btn.style.color = "var(--innovio-navy)";
      btn.style.boxShadow = "0 1px 2px rgba(0,0,0,0.05)";
      currentEqFilter = btn.dataset.filter;
      renderCurrentClientEquipos(item);
    };
  });

  overlay.classList.add("open");
  panel.classList.add("open");

  // Load Equipos and Documentos in Background
  await loadClientEquipos(item.id, item);
  await loadClientDocumentos(item.id);
}

// ── Carga y Renderizado del Inventario de Equipos del Cliente ────────────────
async function loadClientEquipos(clienteId, clientItem = null) {
  const container = document.getElementById("c360-equipos-list");
  const countBadge = document.getElementById("c360-count-equipos");
  if (!container) return;

  try {
    const supabase = await getSupabase();

    // 1. Equipos desde tabla relacional 'equipos'
    const { data: tableEquipos, error } = await supabase
      .from("equipos")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) console.warn("Error consultando tabla equipos:", error);

    // 2. Equipos históricos desde JSON column 'clientes.equipos' (generados por OT)
    let jsonEquiposRaw = clientItem?.equipos;
    if (!jsonEquiposRaw) {
      const { data: cData } = await supabase
        .from("clientes")
        .select("equipos")
        .eq("id", clienteId)
        .maybeSingle();
      jsonEquiposRaw = cData?.equipos || [];
    }

    if (typeof jsonEquiposRaw === "string") {
      try { jsonEquiposRaw = JSON.parse(jsonEquiposRaw); } catch(e) { jsonEquiposRaw = []; }
    }
    if (!Array.isArray(jsonEquiposRaw)) jsonEquiposRaw = [];

    // Mapear equipos de tabla
    const listTable = (tableEquipos || []).map(eq => {
      let extra = {};
      try {
        if (eq.detalles) extra = typeof eq.detalles === 'object' ? eq.detalles : JSON.parse(eq.detalles);
      } catch(e){}
      return {
        ...eq,
        usuario: extra.usuario || eq.usuario || "",
        estado: extra.estado || eq.estado || "activo",
        detalles: extra,
        _source: "table"
      };
    });

    // Mapear equipos del JSON de OTs
    const listJson = jsonEquiposRaw.map((raw, idx) => {
      const rawBrand = raw.FABRICANTE || raw.marca || raw.Marca || "";
      const marca = rawBrand.includes("/") ? rawBrand.split("/")[0].trim() : rawBrand;
      const modelo = raw.MODELO || raw.modelo || raw.Modelo || "";
      const tipo = raw.DISPOSITIVO || raw.tipo || raw.Tipo || "Equipo";
      const serie = raw["NÚMERO DE SERIE"] || raw.SERIE || raw.serie || raw.Serie || "";
      const cpu = [raw["CPU MARCA"], raw["CPU MODELO"]].filter(Boolean).join(" ") || raw.cpu || "";
      const ram = [raw["RAM CAPACIDAD"], raw["RAM VELOCIDAD"]].filter(Boolean).join(" ") || raw.ram || "";
      const disco = [raw["DISCO TIPO"], raw["DISCO CAPACIDAD"]].filter(Boolean).join(" ") || raw.disco || "";
      const so = raw["S.O."] || raw.sistema_operativo || raw.so || "";
      const usuario = raw.USUARIO || raw.usuario || "";
      const estado = raw.ESTADO || raw.estado || "activo";

      return {
        id: `json_${idx}`,
        _jsonIndex: idx,
        cliente_id: clienteId,
        tipo,
        marca,
        modelo,
        serie,
        cpu,
        ram,
        disco,
        sistema_operativo: so,
        usuario,
        estado,
        detalles: { usuario, estado },
        _source: "json"
      };
    });

    // Unificar y desduplicar inteligentemente
    const merged = [...listTable];
    for (const jEq of listJson) {
      const isDuplicate = merged.some(m => {
        if (m.serie && jEq.serie && m.serie.trim().toLowerCase() === jEq.serie.trim().toLowerCase()) return true;
        if (m.marca && jEq.marca && m.modelo && jEq.modelo) {
          const mBrand = (m.marca || "").toLowerCase().split("/")[0].trim();
          const jBrand = (jEq.marca || "").toLowerCase().split("/")[0].trim();
          const mMod = (m.modelo || "").toLowerCase().trim();
          const jMod = (jEq.modelo || "").toLowerCase().trim();
          if (mBrand === jBrand && (mMod === jMod || mMod.includes(jMod) || jMod.includes(mMod))) return true;
        }
        return false;
      });
      if (!isDuplicate) {
        merged.push(jEq);
      }
    }

    currentClientMergedEquipos = merged;

    // Actualizar badges de conteo
    const countActivos = merged.filter(e => e.estado !== 'archivado').length;
    const countArchivados = merged.filter(e => e.estado === 'archivado').length;
    const countTodos = merged.length;

    if (countBadge) countBadge.textContent = countActivos;
    const bAct = document.getElementById("c360-eq-count-activos");
    const bArc = document.getElementById("c360-eq-count-archivados");
    const bTod = document.getElementById("c360-eq-count-todos");
    if (bAct) bAct.textContent = countActivos;
    if (bArc) bArc.textContent = countArchivados;
    if (bTod) bTod.textContent = countTodos;

    // Renderizar lista según filtro actual
    renderCurrentClientEquipos(clientItem || { id: clienteId });

  } catch (err) {
    container.innerHTML = `<div style="padding: 16px; color: #ef4444; font-size: 11.5px;">Error al cargar equipos: ${esc(err.message)}</div>`;
  }
}

function renderCurrentClientEquipos(clientItem) {
  const container = document.getElementById("c360-equipos-list");
  if (!container) return;

  const clienteId = clientItem?.id;
  let filtered = currentClientMergedEquipos;
  if (currentEqFilter === 'activos') {
    filtered = currentClientMergedEquipos.filter(e => e.estado !== 'archivado');
  } else if (currentEqFilter === 'archivados') {
    filtered = currentClientMergedEquipos.filter(e => e.estado === 'archivado');
  }

  if (filtered.length === 0) {
    const emptyMsg = currentEqFilter === 'archivados'
      ? 'No hay equipos archivados para este cliente.'
      : 'Sin equipos registrados aún.';
    container.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; background: var(--panel-subtle); border-radius: 8px; border: 1px dashed var(--panel-border);">
        <div style="font-size: 20px; margin-bottom: 4px;">💻</div>
        <div style="font-size: 12px; font-weight: 700; color: var(--heading-color);">${emptyMsg}</div>
        <div style="font-size: 11px; color: var(--muted-color); margin-top: 2px;">
          ${currentEqFilter === 'archivados' ? 'Cuando archive un equipo, aparecerá en esta sección para su consulta o restauración.' : 'Puede registrar equipos con el botón superior o se importarán automáticamente de las Órdenes de Trabajo.'}
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(eq => {
    const usuarioAsignado = eq.usuario || eq.detalles?.usuario || null;
    const estado = eq.estado || 'activo';
    const isArchived = estado === 'archivado';
    const isTaller = estado === 'en_taller' || estado === 'taller';

    let estadoBadge = '<span style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background: rgba(16, 185, 129, 0.12); color: #047857; border: 1px solid rgba(16, 185, 129, 0.25);">● Activo</span>';
    if (isArchived) {
      estadoBadge = '<span style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background: rgba(100, 116, 139, 0.12); color: #475569; border: 1px solid rgba(100, 116, 139, 0.25);">● Archivado</span>';
    } else if (isTaller) {
      estadoBadge = '<span style="font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; background: rgba(245, 158, 11, 0.12); color: #b45309; border: 1px solid rgba(245, 158, 11, 0.25);">● En Taller</span>';
    }

    const deviceType = (eq.tipo || 'Equipo').toLowerCase();
    let icon = '💻';
    if (deviceType.includes('escritorio') || deviceType.includes('pc') || deviceType.includes('desktop') || deviceType.includes('torre') || deviceType.includes('optiplex')) icon = '🖥️';
    else if (deviceType.includes('portátil') || deviceType.includes('laptop') || deviceType.includes('notebook')) icon = '💻';
    else if (deviceType.includes('all-in-one') || deviceType.includes('aio')) icon = '🖥️';
    else if (deviceType.includes('servidor') || deviceType.includes('server') || deviceType.includes('red')) icon = '🖧';
    else if (deviceType.includes('impresora') || deviceType.includes('printer')) icon = '🖨️';
    else if (deviceType.includes('móvil') || deviceType.includes('celular') || deviceType.includes('tablet') || deviceType.includes('ipad')) icon = '📱';

    const specs = [eq.cpu, eq.ram, eq.disco, eq.sistema_operativo].filter(Boolean);

    return `
      <div class="t1-equipo-item-card" data-eq-id="${eq.id}" style="${isArchived ? 'opacity: 0.75; background: rgba(241, 245, 249, 0.6);' : ''}">
        <div class="t1-equipo-item-top">
          <div class="t1-equipo-title-wrap">
            <span class="t1-equipo-icon">${icon}</span>
            <div>
              <span class="t1-equipo-name">${esc(eq.marca || '')} ${esc(eq.modelo || eq.tipo || 'Dispositivo')}</span>
              ${eq.serie ? `<span class="t1-equipo-serie-badge">SN: ${esc(eq.serie)}</span>` : ''}
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 5px;">
            ${estadoBadge}
            <button class="t1-row-action-btn-mini btn-edit-eq" data-id="${eq.id}" title="Editar especificaciones y estado" style="color: var(--innovio-teal); display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;">
              <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button class="t1-row-action-btn-mini btn-archive-eq" data-id="${eq.id}" title="${isArchived ? 'Restaurar a activo' : 'Archivar equipo'}" style="color: #64748b; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;">
              ${isArchived ? `
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
              ` : `
                <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/></svg>
              `}
            </button>
            <button class="t1-row-action-btn-mini btn-del-eq" data-id="${eq.id}" data-source="${eq._source}" data-json-idx="${eq._jsonIndex ?? ''}" style="color: #f43f5e; display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0;" title="Eliminar definitivamente">✕</button>
          </div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
          ${usuarioAsignado ? `
            <span class="t1-equipo-user-badge">
              <span>👤</span> ${esc(usuarioAsignado)}
            </span>
          ` : `
            <span style="font-size: 10.5px; color: var(--muted-color);">Sin usuario específico asignado</span>
          `}

          ${specs.length > 0 ? `
            <div class="t1-equipo-specs-row">
              ${specs.map(s => `<span class="t1-equipo-spec-chip">${esc(s)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');

  // Wire Edit buttons
  container.querySelectorAll('.btn-edit-eq').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const eq = currentClientMergedEquipos.find(item => String(item.id) === String(btn.dataset.id));
      if (eq) showAddEquipoModal(clientItem, eq);
    };
  });

  // Wire Archive / Restore buttons
  container.querySelectorAll('.btn-archive-eq').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      const eq = currentClientMergedEquipos.find(item => String(item.id) === String(btn.dataset.id));
      if (!eq) return;

      const isArchived = eq.estado === 'archivado';
      const targetEstado = isArchived ? 'activo' : 'archivado';
      try {
        const supabase = await getSupabase();
        if (eq._source === 'table') {
          let det = {};
          try { if (eq.detalles) det = typeof eq.detalles === 'object' ? eq.detalles : JSON.parse(eq.detalles); } catch(err){}
          det.estado = targetEstado;
          await supabase.from('equipos').update({ detalles: JSON.stringify(det) }).eq('id', eq.id);
        } else {
          const { data: cData } = await supabase.from('clientes').select('equipos').eq('id', clienteId).maybeSingle();
          let arr = cData?.equipos || [];
          if (typeof arr === 'string') { try { arr = JSON.parse(arr); } catch(err){ arr = []; } }
          if (Array.isArray(arr) && arr[eq._jsonIndex]) {
            arr[eq._jsonIndex].ESTADO = targetEstado;
            await supabase.from('clientes').update({ equipos: arr }).eq('id', clienteId);
            if (clientItem) clientItem.equipos = arr;
          }
        }
        toast(isArchived ? 'Equipo restaurado a activo' : 'Equipo archivado en el inventario', 'info');
        loadClientEquipos(clienteId, clientItem);
      } catch (err) {
        toast('Error al cambiar estado: ' + err.message, 'error');
      }
    };
  });

  // Wire Delete buttons
  container.querySelectorAll('.btn-del-eq').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar este equipo definitivamente del inventario del cliente?')) return;
      try {
        const supabase = await getSupabase();
        const source = btn.dataset.source;
        const eqId = btn.dataset.id;
        
        if (source === 'table') {
          await supabase.from('equipos').delete().eq('id', eqId);
        } else {
          const jIdx = parseInt(btn.dataset.jsonIdx, 10);
          const { data: cData } = await supabase.from('clientes').select('equipos').eq('id', clienteId).maybeSingle();
          let arr = cData?.equipos || [];
          if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch(err) { arr = []; }
          }
          if (Array.isArray(arr) && arr[jIdx] !== undefined) {
            arr.splice(jIdx, 1);
            await supabase.from('clientes').update({ equipos: arr }).eq('id', clienteId);
            if (clientItem) clientItem.equipos = arr;
            const inMem = items.find(c => String(c.id) === String(clienteId));
            if (inMem) inMem.equipos = arr;
          }
        }
        toast('Equipo eliminado del inventario', 'success');
        loadClientEquipos(clienteId, clientItem);
      } catch(err) {
        toast('Error al eliminar equipo: ' + err.message, 'error');
      }
    };
  });
}

// ── Exportación de la Ficha Técnica de Equipos a CSV / Excel ────────────────
function exportClientEquiposCSV(clientItem, equiposList) {
  if (!equiposList || equiposList.length === 0) {
    toast("No hay equipos registrados para exportar en este cliente", "warning");
    return;
  }

  const clientName = clientItem.empresa || clientItem.nombre || "Cliente";
  const dateStr = new Date().toISOString().slice(0, 10);
  
  const headers = [
    "Tipo de Dispositivo",
    "Fabricante / Marca",
    "Modelo",
    "Número de Serie",
    "Usuario / Custodio",
    "CPU / Procesador",
    "Memoria RAM",
    "Almacenamiento (Disco)",
    "Sistema Operativo",
    "Estado"
  ];

  const rows = equiposList.map(eq => {
    let extra = {};
    try {
      if (eq.detalles) extra = typeof eq.detalles === 'object' ? eq.detalles : JSON.parse(eq.detalles);
    } catch(e){}
    const usuario = eq.usuario || extra.usuario || "";
    const estado = eq.estado || extra.estado || "Activo";

    return [
      `"${(eq.tipo || '').replace(/"/g, '""')}"`,
      `"${(eq.marca || '').replace(/"/g, '""')}"`,
      `"${(eq.modelo || '').replace(/"/g, '""')}"`,
      `"${(eq.serie || '').replace(/"/g, '""')}"`,
      `"${(usuario || '').replace(/"/g, '""')}"`,
      `"${(eq.cpu || '').replace(/"/g, '""')}"`,
      `"${(eq.ram || '').replace(/"/g, '""')}"`,
      `"${(eq.disco || '').replace(/"/g, '""')}"`,
      `"${(eq.sistema_operativo || '').replace(/"/g, '""')}"`,
      `"${(estado || '').replace(/"/g, '""')}"`
    ].join(",");
  });

  const csvContent = "\uFEFF" + [
    `"INVENTARIO DE EQUIPOS - ${clientName.replace(/"/g, '""')}"`,
    `"Fecha de Generación: ${dateStr}"`,
    `"Total Equipos Registrados: ${equiposList.length}"`,
    "",
    headers.map(h => `"${h}"`).join(","),
    ...rows
  ].join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeClientName = clientName.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 30);
  a.download = `Equipos_${safeClientName}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast("Ficha de inventario descargada con éxito", "success");
}

// ── Carga y Renderizado del Historial de Documentos del Cliente ──────────────
async function loadClientDocumentos(clienteId) {
  const container = document.getElementById("c360-docs-list");
  const countBadge = document.getElementById("c360-count-docs");
  if (!container) return;

  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("documentos")
      .select("id, doc_type, doc_num, fecha, total, moneda, estado, created_at")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const docs = data || [];
    if (countBadge) countBadge.textContent = docs.length;

    if (docs.length === 0) {
      container.innerHTML = `
        <div style="padding: 28px 16px; text-align: center; background: var(--panel-subtle); border-radius: 8px; border: 1px dashed var(--panel-border);">
          <div style="font-size: 22px; margin-bottom: 4px;">📄</div>
          <div style="font-size: 12.5px; font-weight: 700; color: var(--heading-color);">Sin comprobantes emitidos</div>
          <div style="font-size: 11px; color: var(--muted-color); margin-top: 2px;">
            Aún no se han generado órdenes de trabajo ni facturas para este cliente.
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="border: 1px solid var(--panel-border); border-radius: 8px; overflow: hidden; background: var(--panel-bg);">
        <table class="t1-drawer-doc-table">
          <thead>
            <tr>
              <th>COMPROBANTE</th>
              <th style="text-align: center;">TIPO</th>
              <th>FECHA</th>
              <th style="text-align: right;">TOTAL</th>
              <th style="text-align: center;">ESTADO</th>
              <th style="text-align: right;">VER</th>
            </tr>
          </thead>
          <tbody>
            ${docs.map(d => {
              const consecutivo = d.doc_num ? `#${d.doc_num}` : `#${d.id}`;
              const tipoCode = d.doc_type || 'DOC';
              let badgeColor = '#0284c7';
              let badgeBg = 'rgba(2, 132, 199, 0.1)';
              if (tipoCode === 'FAC') { badgeColor = '#059669'; badgeBg = 'rgba(16, 185, 129, 0.1)'; }
              else if (tipoCode === 'COT') { badgeColor = '#d97706'; badgeBg = 'rgba(245, 158, 11, 0.1)'; }

              const estado = (d.estado || 'pendiente').toLowerCase();
              const isPaid = estado === 'pagada' || estado === 'completado';
              const isCancel = estado === 'anulada' || estado === 'cancelado';
              const dotClass = isPaid ? 'paid' : (isCancel ? 'canceled' : 'pending');
              const statusLabel = estado.charAt(0).toUpperCase() + estado.slice(1);

              const cur = d.moneda || 'CRC';
              const symbol = cur === 'USD' ? '$' : '₡';
              const totalFmt = `${symbol} ${Number(d.total || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 })}`;

              return `
                <tr>
                  <td>
                    <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--heading-color); white-space: nowrap;">
                      ${consecutivo}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <span class="t1-type-badge" style="background: ${badgeBg}; color: ${badgeColor};">${tipoCode}</span>
                  </td>
                  <td>
                    <span style="font-size: 11px; color: var(--muted-color); font-variant-numeric: tabular-nums;">
                      ${fmtDate(d.fecha)}
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-family: var(--font-mono); font-size: 11.5px; font-weight: 700; color: var(--heading-color); font-variant-numeric: tabular-nums;">
                      ${totalFmt}
                    </span>
                  </td>
                  <td style="text-align: center;">
                    <span class="t1-dot-status ${dotClass}" style="font-size: 10.5px;">${statusLabel}</span>
                  </td>
                  <td style="text-align: right;">
                    <a href="#/documentos/${d.id}/comprobante" class="t1-row-action-btn-mini" style="text-decoration: none; display: inline-block;">
                      Ver →
                    </a>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div style="padding: 16px; color: #ef4444; font-size: 11.5px;">Error al consultar historial: ${esc(err.message)}</div>`;
  }
}

// ── Modal para Registrar Equipo en el Inventario del Cliente ────────────────
function showAddEquipoModal(clientItem, eqToEdit = null) {
  const isEditing = !!eqToEdit;
  const modal = document.createElement("div");
  modal.className = "t1-drawer-overlay open";
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
  modal.style.zIndex = "99999";

  const curTipo = eqToEdit?.tipo || "Laptop";
  const curMarca = eqToEdit?.marca || "";
  const curModelo = eqToEdit?.modelo || "";
  const curSerie = eqToEdit?.serie || "";
  const curUsuario = eqToEdit?.usuario || eqToEdit?.detalles?.usuario || "";
  const curCpu = eqToEdit?.cpu || "";
  const curRam = eqToEdit?.ram || "";
  const curDisco = eqToEdit?.disco || "";
  const curSo = eqToEdit?.sistema_operativo || "";
  const curEstado = eqToEdit?.estado || eqToEdit?.detalles?.estado || "activo";

  modal.innerHTML = `
    <div style="background: var(--panel-bg); border-radius: 12px; width: 100%; max-width: 460px; padding: 22px; border: 1px solid var(--panel-border); box-shadow: 0 20px 48px rgba(0,0,0,0.25);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div>
          <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--innovio-teal); letter-spacing: 0.04em;">Inventario de Cliente</span>
          <h3 style="font-size: 16px; font-weight: 800; color: var(--heading-color); margin: 2px 0 0 0;">
            ${isEditing ? 'Editar Equipo' : 'Registrar Nuevo Equipo'}
          </h3>
        </div>
        <button id="modal-eq-close" style="background: transparent; border: none; font-size: 16px; color: var(--muted-color); cursor: pointer;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 10px;">
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Tipo de Dispositivo</label>
            <select id="meq-tipo" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;">
              <option value="Laptop" ${curTipo.toLowerCase().includes('laptop') || curTipo.toLowerCase().includes('portátil') ? 'selected' : ''}>💻 Laptop</option>
              <option value="PC Escritorio" ${curTipo.toLowerCase().includes('escritorio') || curTipo.toLowerCase().includes('pc') ? 'selected' : ''}>🖥️ PC Escritorio</option>
              <option value="All-in-One (AIO)" ${curTipo.toLowerCase().includes('all-in-one') || curTipo.toLowerCase().includes('aio') ? 'selected' : ''}>🖥️ All-in-One (AIO)</option>
              <option value="Servidor" ${curTipo.toLowerCase().includes('servidor') || curTipo.toLowerCase().includes('red') ? 'selected' : ''}>🖧 Servidor / Red</option>
              <option value="Impresora" ${curTipo.toLowerCase().includes('impresora') ? 'selected' : ''}>🖨️ Impresora</option>
              <option value="Otro" ${curTipo.toLowerCase().includes('otro') || curTipo.toLowerCase().includes('celular') || curTipo.toLowerCase().includes('tablet') ? 'selected' : ''}>📱 Otro Dispositivo</option>
            </select>
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Estado Operativo</label>
            <select id="meq-estado" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px; font-weight: 600;">
              <option value="activo" ${curEstado === 'activo' ? 'selected' : ''}>● Activo en operación</option>
              <option value="en_taller" ${curEstado === 'en_taller' || curEstado === 'taller' ? 'selected' : ''}>● En taller / En revisión</option>
              <option value="archivado" ${curEstado === 'archivado' ? 'selected' : ''}>● Archivado / Fuera de servicio</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Marca</label>
            <input type="text" id="meq-marca" value="${esc(curMarca)}" placeholder="Ej: Dell, HP, Lenovo" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Modelo</label>
            <input type="text" id="meq-modelo" value="${esc(curModelo)}" placeholder="Ej: Latitude 5420" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Número de Serie</label>
            <input type="text" id="meq-serie" value="${esc(curSerie)}" placeholder="Ej: SN-48192" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px; font-family: var(--font-mono);" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Usuario Asignado</label>
            <input type="text" id="meq-usuario" value="${esc(curUsuario)}" placeholder="Ej: Ing. Carlos Murillo" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">CPU / Procesador</label>
            <input type="text" id="meq-cpu" value="${esc(curCpu)}" placeholder="Ej: Intel Core i5 / AMD Ryzen" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 11.5px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Memoria RAM</label>
            <input type="text" id="meq-ram" value="${esc(curRam)}" placeholder="Ej: 16 GB DDR4" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 11.5px;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Almacenamiento</label>
            <input type="text" id="meq-disco" value="${esc(curDisco)}" placeholder="Ej: SSD 512 GB NVMe" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 11.5px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Sistema Operativo</label>
            <input type="text" id="meq-so" value="${esc(curSo)}" placeholder="Ej: Windows 11 Pro" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 11.5px;" />
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px;">
          <button id="modal-eq-cancel" style="padding: 6px 12px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--muted-color); cursor: pointer;">Cancelar</button>
          <button id="modal-eq-save" class="t1-btn-primary" style="padding: 6px 14px; font-size: 12px;">
            ${isEditing ? 'Guardar Cambios' : 'Registrar Equipo'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();
  modal.querySelector("#modal-eq-close").onclick = closeModal;
  modal.querySelector("#modal-eq-cancel").onclick = closeModal;

  modal.querySelector("#modal-eq-save").onclick = async () => {
    const tipo = modal.querySelector("#meq-tipo").value;
    const estado = modal.querySelector("#meq-estado").value;
    const marca = modal.querySelector("#meq-marca").value.trim();
    const modelo = modal.querySelector("#meq-modelo").value.trim();
    const serie = modal.querySelector("#meq-serie").value.trim();
    const usuario = modal.querySelector("#meq-usuario").value.trim();
    const cpu = modal.querySelector("#meq-cpu").value.trim();
    const ram = modal.querySelector("#meq-ram").value.trim();
    const disco = modal.querySelector("#meq-disco").value.trim();
    const sistema_operativo = modal.querySelector("#meq-so").value.trim();

    if (!marca && !modelo && !serie) {
      toast("Por favor ingrese al menos marca, modelo o serie", "error");
      return;
    }

    try {
      const supabase = await getSupabase();

      if (isEditing) {
        if (eqToEdit._source === 'table') {
          const payload = {
            tipo,
            marca: marca || 'Genérico',
            modelo: modelo || '',
            serie: serie || '',
            cpu: cpu || null,
            ram: ram || null,
            disco: disco || null,
            sistema_operativo: sistema_operativo || null,
            detalles: JSON.stringify({ usuario, estado })
          };
          const { error } = await supabase.from('equipos').update(payload).eq('id', eqToEdit.id);
          if (error) throw error;
        } else {
          const { data: cData } = await supabase.from('clientes').select('equipos').eq('id', clientItem.id).maybeSingle();
          let arr = cData?.equipos || [];
          if (typeof arr === 'string') {
            try { arr = JSON.parse(arr); } catch(err) { arr = []; }
          }
          if (!Array.isArray(arr)) arr = [];
          arr[eqToEdit._jsonIndex] = {
            ...(arr[eqToEdit._jsonIndex] || {}),
            DISPOSITIVO: tipo,
            FABRICANTE: marca,
            MODELO: modelo,
            'NÚMERO DE SERIE': serie,
            USUARIO: usuario,
            'CPU MARCA': cpu,
            'RAM CAPACIDAD': ram,
            'DISCO TIPO': disco,
            'S.O.': sistema_operativo,
            ESTADO: estado
          };
          const { error } = await supabase.from('clientes').update({ equipos: arr }).eq('id', clientItem.id);
          if (error) throw error;
          if (clientItem) clientItem.equipos = arr;
          const inMem = items.find(c => String(c.id) === String(clientItem.id));
          if (inMem) inMem.equipos = arr;
        }
        toast("Equipo actualizado correctamente", "success");
      } else {
        const payload = {
          cliente_id: clientItem.id,
          tipo,
          marca: marca || 'Genérico',
          modelo: modelo || '',
          serie: serie || '',
          cpu: cpu || null,
          ram: ram || null,
          disco: disco || null,
          sistema_operativo: sistema_operativo || null,
          detalles: JSON.stringify({ usuario, estado })
        };
        const { error } = await supabase.from('equipos').insert([payload]);
        if (error) throw error;
        toast("Equipo registrado en el inventario del cliente", "success");
      }

      closeModal();
      loadClientEquipos(clientItem.id, clientItem);
    } catch(err) {
      toast("Error al guardar equipo: " + err.message, "error");
    }
  };
}

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
          <select class="select" id="cli-fact-prov"></select>
        </div>
        <div class="field">
          <label class="field-label">Cantón</label>
          <select class="select" id="cli-fact-can"></select>
        </div>
        <div class="field">
          <label class="field-label">Distrito</label>
          <select class="select" id="cli-fact-dis"></select>
        </div>
        <div class="field">
          <label class="field-label">Barrio</label>
          <input class="input" id="cli-fact-bar" value="${esc(item?.fact_barrio || "")}" placeholder="Nombre de barrio / residencial" />
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
  initUbicacionesCascada(item);
}

function initUbicacionesCascada(item) {
  const provEl = document.getElementById("cli-fact-prov");
  const canEl  = document.getElementById("cli-fact-can");
  const disEl  = document.getElementById("cli-fact-dis");
  if (!provEl || !canEl || !disEl) return;

  const currentProv = (item?.fact_provincia || "").trim();
  const currentCan  = (item?.fact_canton || "").trim();
  const currentDis  = (item?.fact_distrito || "").trim();

  // Populate Provincias
  provEl.innerHTML = `<option value="">(Seleccionar provincia)</option>` +
    PROVINCIAS_CR.map(p => `<option value="${p.id}" ${currentProv.toLowerCase() === p.nombre.toLowerCase() || currentProv === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('');

  function updateCantones(provId, selectedCantonName) {
    const list = CANTONES_CR[provId] || [];
    canEl.innerHTML = `<option value="">(Seleccionar cantón)</option>` +
      list.map(c => `<option value="${c.id}" data-name="${c.nombre}" ${selectedCantonName.toLowerCase() === c.nombre.toLowerCase() || selectedCantonName === c.id ? 'selected' : ''}>${c.nombre}</option>`).join('');
    updateDistritos(provId, canEl.value, currentDis);
  }

  function updateDistritos(provId, cantonId, selectedDistritoName) {
    const key = `${provId}-${cantonId}`;
    const list = DISTRITOS_CR[key] || [];
    disEl.innerHTML = `<option value="">(Seleccionar distrito)</option>` +
      list.map(d => `<option value="${d}" ${selectedDistritoName.toLowerCase() === d.toLowerCase() ? 'selected' : ''}>${d}</option>`).join('');
  }

  // Pre-select logic for editing
  let initialProvObj = PROVINCIAS_CR.find(p => p.nombre.toLowerCase() === currentProv.toLowerCase() || p.id === currentProv);
  if (initialProvObj) {
    provEl.value = initialProvObj.id;
    let cantonesList = CANTONES_CR[initialProvObj.id] || [];
    let initialCanObj = cantonesList.find(c => c.nombre.toLowerCase() === currentCan.toLowerCase() || c.id === currentCan);
    updateCantones(initialProvObj.id, initialCanObj ? initialCanObj.nombre : currentCan);
  } else {
    updateCantones(provEl.value, currentCan);
  }

  provEl.addEventListener("change", () => {
    updateCantones(provEl.value, "");
  });

  canEl.addEventListener("change", () => {
    updateDistritos(provEl.value, canEl.value, "");
  });
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
    fact_provincia: (() => {
      const el = document.getElementById("cli-fact-prov");
      if (!el || !el.value) return null;
      const match = PROVINCIAS_CR.find(p => p.id === el.value);
      return match ? match.nombre : el.value;
    })(),
    fact_canton: (() => {
      const el = document.getElementById("cli-fact-can");
      if (!el || !el.value) return null;
      const selOpt = el.options[el.selectedIndex];
      return selOpt ? (selOpt.dataset.name || selOpt.text) : el.value;
    })(),
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
        if (error.code === '23505' || (error.message && (error.message.toLowerCase().includes('unique') || error.message.toLowerCase().includes('duplicate')))) {
          const isCodigo = error.message && (error.message.includes('codigo_fiscal') || error.message.includes('codigo'));
          if (isCodigo && codigoFiscalInput) {
            toast(`El Código Fiscal #${codigoFiscalInput} ya pertenece a otro cliente. Usá otro código diferente.`, 'error');
          } else {
            toast(`Ya existe un cliente registrado con esa misma Cédula o Código en el sistema.`, 'error');
          }
          return;
        }
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