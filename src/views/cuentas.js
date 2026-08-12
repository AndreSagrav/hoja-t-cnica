import { ensureShell } from "../components/shell.js";
import { esc, toast } from "../lib/utils.js";
import { getSupabase } from "../lib/supabase.js";

let cuentas = [], sinpe = null, selectedId = null, mode = null;

async function loadDB() {
  const supabase = await getSupabase();
  const { data: ctaData, error: ctaErr } = await supabase
    .from('cuentas_bancarias')
    .select('*')
    .order('created_at', { ascending: true });
  if (ctaErr) { console.error('Error cargando cuentas:', ctaErr); cuentas = []; }
  else cuentas = ctaData || [];

  const { data: sinpeData, error: sinpeErr } = await supabase
    .from('sinpe_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (sinpeErr) { console.error('Error cargando SINPE:', sinpeErr); sinpe = null; }
  else sinpe = sinpeData || null;
}

async function saveCuentaDB(payload) {
  const supabase = await getSupabase();
  if (payload.id) {
    const { data, error } = await supabase
      .from('cuentas_bancarias')
      .update({ banco: payload.banco, titular: payload.titular, iban: payload.iban, tipo: payload.tipo, moneda: payload.moneda, descripcion: payload.descripcion, updated_at: new Date().toISOString() })
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('cuentas_bancarias')
      .insert([{ banco: payload.banco, titular: payload.titular, iban: payload.iban, tipo: payload.tipo, moneda: payload.moneda, descripcion: payload.descripcion }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function deleteCuentaDB(id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('cuentas_bancarias').delete().eq('id', id);
  if (error) throw error;
}

async function saveSinpeDB(payload) {
  const supabase = await getSupabase();
  if (sinpe?.id) {
    const { data, error } = await supabase
      .from('sinpe_config')
      .update({ numero: payload.numero, titular: payload.titular, descripcion: payload.descripcion, updated_at: new Date().toISOString() })
      .eq('id', sinpe.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('sinpe_config')
      .insert([{ numero: payload.numero, titular: payload.titular, descripcion: payload.descripcion }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

async function deleteSinpeDB() {
  if (!sinpe?.id) return;
  const supabase = await getSupabase();
  const { error } = await supabase.from('sinpe_config').delete().eq('id', sinpe.id);
  if (error) throw error;
}

export async function cuentasView() {
  const shell = ensureShell("/cuentas");
  shell.setTitle(""); shell.setActions("");
  const c = shell.content();
  c.innerHTML = `
<div class="crm-panel">
  <div class="crm-header">
    <h2>🏦 Cuentas y SINPE <span class="crm-header-count" id="cta-count">—</span></h2>
    <div class="crm-header-actions">
      <button class="crm-action-btn primary" id="cta-new-btn" style="flex:none;">＋ Nueva Cuenta</button>
    </div>
  </div>
  <div class="crm-kpi-row" id="cta-kpis"></div>
  <div class="crm-body">
    <div class="crm-list-pane" style="display:flex;flex-direction:column;overflow:hidden;">
      <div style="flex:1;overflow-y:auto;" id="cta-list">
        <div class="crm-empty"><div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div><div class="crm-empty-text">Sin cuentas</div></div>
      </div>
      <div id="cta-sinpe-block"></div>
    </div>
    <div class="crm-detail-pane" id="cta-detail">
      <div class="crm-placeholder">
        <div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div>
        <div class="crm-placeholder-text">Seleccioná una cuenta</div>
        <div class="crm-placeholder-sub">Hacé clic en una cuenta bancaria o en el bloque de SINPE para ver los detalles completos.</div>
      </div>
    </div>
  </div>
</div>`;

  document.getElementById("cta-new-btn").addEventListener("click", () => showFormCuenta(null));
  await loadDB();
  renderAll();
}

function renderAll() {
  renderKPIs();
  renderList();
  renderSinpeBlock();
}

function renderKPIs() {
  const crc = cuentas.filter(c => c.moneda !== "USD");
  const usd = cuentas.filter(c => c.moneda === "USD");
  document.getElementById("cta-count").textContent = cuentas.length;
  document.getElementById("cta-kpis").innerHTML = `
    <div class="crm-kpi"><div class="crm-kpi-icon amber"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div><div><div class="crm-kpi-label">Cuentas totales</div><div class="crm-kpi-value">${cuentas.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon green"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div><div class="crm-kpi-label">En colones</div><div class="crm-kpi-value">${crc.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon blue"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></div><div><div class="crm-kpi-label">En dólares</div><div class="crm-kpi-value">${usd.length}</div></div></div>
    <div class="crm-kpi"><div class="crm-kpi-icon teal"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></div><div><div class="crm-kpi-label">SINPE</div><div class="crm-kpi-value" style="font-size:13px;font-weight:700;">${sinpe?.numero?"Configurado":"Sin config."}</div></div></div>`;
}

function bankIcon(banco) {
  const b = (banco || "").toLowerCase();
  let c = "#64748b";
  if (b.includes("bac")) c = "#dc2626";
  if (b.includes("nacional") || b.includes("bncr")) c = "#2563eb";
  if (b.includes("costa rica") || b.includes("bccr")) c = "#d97706";
  if (b.includes("popular")) c = "#16a34a";
  if (b.includes("davivienda")) c = "#ef4444";
  if (b.includes("scotiabank")) c = "#eab308";
  if (b.includes("promerica")) c = "#9333ea";
  return `<svg width="24" height="24" fill="none" stroke="${c}" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg>`;
}

function ibanPreview(iban) {
  if (!iban) return "IBAN no registrado";
  const clean = iban.replace(/\s/g, "");
  if (clean.length < 8) return iban;
  return clean.slice(0, 4) + " •••• •••• " + clean.slice(-4);
}

function renderList() {
  const box = document.getElementById("cta-list");
  if (!cuentas.length) {
    box.innerHTML = `
      <div class="crm-empty">
        <div class="crm-empty-icon"><svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div>
        <div class="crm-empty-text">No hay cuentas bancarias</div>
        <div style="margin-top:12px;">
          <button class="btn btn-primary" id="cta-add-first" style="font-size:12px;padding:8px 16px;">＋ Agregar primera cuenta</button>
        </div>
      </div>`;
    document.getElementById("cta-add-first")?.addEventListener("click", () => showFormCuenta(null));
    return;
  }
  box.innerHTML = cuentas.map(c => `
    <div class="cuenta-card ${String(selectedId)===String(c.id)&&mode==="cuenta"?"active":""}" data-id="${c.id}">
      <div class="cuenta-bank-icon">${bankIcon(c.banco)}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:700;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.banco||"Banco")}</div>
        <div style="font-size:11px;color:var(--text-soft);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(c.titular||"")}</div>
        <div style="font-size:10.5px;color:var(--text-mid);margin-top:2px;font-family:monospace;">${ibanPreview(c.iban)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
        <span class="cuenta-moneda-badge ${c.moneda==="USD"?"usd":"crc"}">${c.moneda||"CRC"}</span>
        <span style="font-size:10px;color:var(--text-soft);">${esc(c.tipo||"")}</span>
      </div>
    </div>`).join("");
  box.querySelectorAll(".cuenta-card").forEach(el =>
    el.addEventListener("click", () => {
      selectedId = el.dataset.id; mode = "cuenta";
      renderList(); renderSinpeBlock();
      showDetailCuenta(cuentas.find(c => String(c.id) === String(selectedId)));
    }));
}

function renderSinpeBlock() {
  const box = document.getElementById("cta-sinpe-block");
  if (!sinpe?.numero) {
    box.innerHTML = `
      <div class="sinpe-compact" id="cta-sinpe-btn" style="cursor:pointer;">
        <div class="sinpe-compact-title"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> SINPE Móvil</div>
        <div style="font-size:12px;color:var(--text-soft);">Sin configurar — clic para configurar</div>
      </div>`;
  } else {
    const isSinpeActive = mode === "sinpe";
    box.innerHTML = `
      <div class="sinpe-compact ${isSinpeActive?"active":""}" id="cta-sinpe-btn" style="cursor:pointer;${isSinpeActive?"border-left:3px solid var(--navy);":""}">
        <div class="sinpe-compact-title"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> SINPE Móvil</div>
        <div class="sinpe-compact-num">${esc(sinpe.numero)}</div>
        <div class="sinpe-compact-name">${esc(sinpe.titular||"")}</div>
      </div>`;
  }
  document.getElementById("cta-sinpe-btn").addEventListener("click", () => {
    selectedId = null; mode = "sinpe";
    renderList(); renderSinpeBlock();
    if (!sinpe?.numero) showFormSinpe();
    else showDetailSinpe();
  });
}

function showDetailCuenta(c) {
  if (!c) return;
  const detailEl = document.getElementById("cta-detail");
  const crmBody = detailEl?.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');
  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <div class="detail-hero" style="align-items: flex-start;">
      <div style="display: flex; gap: 24px; flex: 1 1 300px; min-width: 280px;">
        <div class="detail-hero-avatar" style="font-size:28px;background:linear-gradient(135deg,#fef9c3,#fde68a);">${bankIcon(c.banco)}</div>
        <div class="detail-hero-info">
          <div class="detail-hero-name" style="font-size: clamp(20px, 2vw, 24px);">${esc(c.banco||"Banco")}</div>
          <div class="detail-hero-sub" style="margin-top: 12px;">
            <span>${esc(c.tipo||"Cuenta")}</span>
            <span class="cuenta-moneda-badge ${c.moneda==="USD"?"usd":"crc"}" style="margin-left:6px;">${c.moneda||"CRC"}</span>
          </div>
        </div>
      </div>
      <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 20px;">
        <div class="detail-hero-actions" style="margin-left: 0; gap: 8px;">
          <button class="hero-btn hero-btn-edit" id="cta-edit-btn"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar</button>
          <button class="hero-btn hero-btn-del" id="cta-del-btn"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar</button>
        </div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"></path></svg> IBAN</div>
      <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <div style="font-size:15px;font-weight:800;font-family:monospace;letter-spacing:2px;color:var(--navy);flex:1;min-width:0;word-break:break-all;">
          ${esc(c.iban||"No registrado")}
        </div>
        ${c.iban?`<button class="btn btn-ghost" id="cta-copy-iban" style="padding:7px 14px;font-size:11px;flex-shrink:0;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copiar IBAN</button>`:""}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"></path></svg> Detalle de la cuenta</div>
      <div class="detail-info-grid">
        <div class="detail-info-item"><div class="detail-info-label">Banco</div><div class="detail-info-value">${esc(c.banco||"—")}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">Titular</div><div class="detail-info-value">${esc(c.titular||"—")}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">Tipo de cuenta</div><div class="detail-info-value">${esc(c.tipo||"—")}</div></div>
        <div class="detail-info-item"><div class="detail-info-label">Moneda</div><div class="detail-info-value">${esc(c.moneda||"—")}</div></div>
      </div>
    </div>
    ${c.descripcion?`<div class="detail-section"><div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Notas</div><p style="font-size:13.5px;color:var(--text);line-height:1.7;">${esc(c.descripcion)}</p></div>`:""}`;

  document.getElementById("cta-edit-btn").addEventListener("click", () => showFormCuenta(c));
  document.getElementById("cta-del-btn").addEventListener("click", async () => {
    if (!confirm(`¿Eliminar la cuenta de ${c.banco}?`)) return;
    try {
      await deleteCuentaDB(c.id);
      cuentas = cuentas.filter(x => x.id !== c.id);
      selectedId = null; mode = null;
      renderAll();
      document.getElementById("cta-detail").innerHTML = `<div class="crm-placeholder"><div class="crm-placeholder-icon">🏦</div><div class="crm-placeholder-text">Cuenta eliminada</div></div>`;
      toast("Cuenta eliminada");
    } catch (err) { toast("Error al eliminar: " + (err.message || err), "error"); }
  });
  if (c.iban) {
    document.getElementById("cta-copy-iban").addEventListener("click", () => {
      navigator.clipboard.writeText(c.iban)
        .then(() => toast("IBAN copiado al portapapeles"))
        .catch(() => toast("No se pudo copiar", "error"));
    });
  }
}

function showDetailSinpe() {
  if (!sinpe?.numero) { showFormSinpe(); return; }
  const detailEl = document.getElementById("cta-detail");
  const crmBody = detailEl?.closest('.crm-body');
  if (crmBody) crmBody.classList.add('show-detail');
  detailEl.innerHTML = `
    <button class="crm-back-btn" onclick="document.querySelector('.crm-body').classList.remove('show-detail')">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      Volver a la lista
    </button>
    <div class="sinpe-hero">
      <div class="sinpe-hero-label"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> SINPE Móvil</div>
      <div class="sinpe-hero-num">${esc(sinpe.numero)}</div>
      <div class="sinpe-hero-name">${esc(sinpe.titular||"")}</div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
      <button class="btn btn-ghost" id="cta-copy-sinpe" style="padding:8px 16px;font-size:12px;"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg> Copiar número</button>
      <button class="hero-btn hero-btn-edit" id="cta-edit-sinpe" style="padding:8px 16px;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar SINPE</button>
      <button class="hero-btn hero-btn-del" id="cta-del-sinpe" style="padding:8px 16px;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar</button>
    </div>
    ${sinpe.descripcion?`<div class="detail-section"><div class="detail-section-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> Descripción</div><p style="font-size:13.5px;color:var(--text);line-height:1.7;">${esc(sinpe.descripcion)}</p></div>`:""}`;

  document.getElementById("cta-edit-sinpe").addEventListener("click", () => showFormSinpe());
  document.getElementById("cta-copy-sinpe").addEventListener("click", () => {
    navigator.clipboard.writeText(sinpe.numero)
      .then(() => toast("Número copiado al portapapeles"))
      .catch(() => toast("No se pudo copiar", "error"));
  });
  document.getElementById("cta-del-sinpe").addEventListener("click", async () => {
    if (!confirm("¿Eliminar la configuración de SINPE?")) return;
    try {
      await deleteSinpeDB();
      sinpe = null; mode = null;
      renderAll();
      document.getElementById("cta-detail").innerHTML = `<div class="crm-placeholder"><div class="crm-placeholder-icon">📱</div><div class="crm-placeholder-text">SINPE eliminado</div></div>`;
      toast("SINPE eliminado");
    } catch (err) { toast("Error al eliminar SINPE: " + (err.message || err), "error"); }
  });
}

function showFormCuenta(c) {
  const isEdit = !!c;
  document.getElementById("cta-detail").innerHTML = `
    <div class="crm-form">
      <div class="crm-form-title">${isEdit?`<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg> Editar`:"＋ Nueva"} Cuenta Bancaria</div>
      <div class="crm-form-grid">
        <div class="field"><label class="field-label">Banco *</label>
          <input id="cf-banco" class="input" value="${esc(c?.banco||"")}" placeholder="Ej: BAC San José" /></div>
        <div class="field"><label class="field-label">Titular *</label>
          <input id="cf-titular" class="input" value="${esc(c?.titular||"")}" /></div>
        <div class="field full"><label class="field-label">IBAN</label>
          <input id="cf-iban" class="input" value="${esc(c?.iban||"")}" placeholder="CR00 0000 0000 0000 0000 00" style="font-family:monospace;letter-spacing:1px;" /></div>
        <div class="field"><label class="field-label">Tipo de cuenta</label>
          <select id="cf-tipo" class="select">
            <option value="corriente" ${c?.tipo==="corriente"?"selected":""}>Corriente</option>
            <option value="ahorros"   ${c?.tipo==="ahorros"  ?"selected":""}>Ahorros</option>
          </select></div>
        <div class="field"><label class="field-label">Moneda</label>
          <select id="cf-moneda" class="select">
            <option value="CRC" ${c?.moneda!=="USD"?"selected":""}>₡ Colones (CRC)</option>
            <option value="USD" ${c?.moneda==="USD"?"selected":""}>$ Dólares (USD)</option>
          </select></div>
        <div class="field full"><label class="field-label">Notas</label>
          <textarea id="cf-desc" class="textarea" style="min-height:60px;">${esc(c?.descripcion||"")}</textarea></div>
      </div>
      <div class="crm-form-actions">
        <button class="btn btn-ghost" id="cf-cancel">Cancelar</button>
        <button class="btn btn-primary" id="cf-save"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Guardar</button>
      </div>
    </div>`;

  document.getElementById("cf-cancel").addEventListener("click", () => {
    if (c) showDetailCuenta(c);
    else document.getElementById("cta-detail").innerHTML = `<div class="crm-placeholder"><div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div><div class="crm-placeholder-text">Seleccioná una cuenta</div></div>`;
  });
  document.getElementById("cf-save").addEventListener("click", async () => {
    const banco   = document.getElementById("cf-banco").value.trim();
    const titular = document.getElementById("cf-titular").value.trim();
    if (!banco || !titular) { toast("Banco y titular son obligatorios", "error"); return; }
    const payload = {
      id:          c?.id || null,
      banco, titular,
      iban:        document.getElementById("cf-iban").value.trim(),
      tipo:        document.getElementById("cf-tipo").value,
      moneda:      document.getElementById("cf-moneda").value,
      descripcion: document.getElementById("cf-desc").value.trim()
    };
    try {
      const saved = await saveCuentaDB(payload);
      if (isEdit) {
        const idx = cuentas.findIndex(x => x.id === c.id);
        if (idx >= 0) cuentas[idx] = saved;
      } else {
        cuentas.push(saved);
      }
      selectedId = String(saved.id); mode = "cuenta";
      renderAll();
      showDetailCuenta(cuentas.find(x => String(x.id) === String(saved.id)));
      toast(isEdit ? "Cuenta actualizada" : "Cuenta creada");
    } catch (err) { toast("Error al guardar: " + (err.message || err), "error"); }
  });
}

function showFormSinpe() {
  document.getElementById("cta-detail").innerHTML = `
    <div class="crm-form">
      <div class="crm-form-title"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg> Configurar SINPE Móvil</div>
      <div class="crm-form-grid">
        <div class="field"><label class="field-label">Número de teléfono *</label>
          <input id="sf-num" class="input" value="${esc(sinpe?.numero||"")}" placeholder="8888-8888" style="font-family:monospace;letter-spacing:1px;font-size:16px;" /></div>
        <div class="field"><label class="field-label">Titular / Nombre</label>
          <input id="sf-tit" class="input" value="${esc(sinpe?.titular||"")}" /></div>
        <div class="field full"><label class="field-label">Descripción o instrucciones</label>
          <textarea id="sf-desc" class="textarea" style="min-height:70px;">${esc(sinpe?.descripcion||"")}</textarea></div>
      </div>
      <div class="crm-form-actions">
        ${sinpe?.numero?`<button class="btn btn-ghost" id="sf-del" style="margin-right:auto;color:#b91c1c;border-color:#fca5a5;"><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg> Eliminar SINPE</button>`:""}
        <button class="btn btn-ghost" id="sf-cancel">Cancelar</button>
        <button class="btn btn-primary" id="sf-save"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Guardar</button>
      </div>
    </div>`;

  document.getElementById("sf-cancel").addEventListener("click", () => {
    if (sinpe?.numero) showDetailSinpe();
    else document.getElementById("cta-detail").innerHTML = `<div class="crm-placeholder"><div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg></div><div class="crm-placeholder-text">Seleccioná una opción</div></div>`;
  });
  document.getElementById("sf-save").addEventListener("click", async () => {
    const numero = document.getElementById("sf-num").value.trim();
    if (!numero) { toast("El número de teléfono es obligatorio", "error"); return; }
    const payload = {
      numero,
      titular:     document.getElementById("sf-tit").value.trim(),
      descripcion: document.getElementById("sf-desc").value.trim()
    };
    try {
      sinpe = await saveSinpeDB(payload);
      mode = "sinpe";
      renderAll(); showDetailSinpe();
      toast("SINPE guardado");
    } catch (err) { toast("Error al guardar SINPE: " + (err.message || err), "error"); }
  });
  document.getElementById("sf-del")?.addEventListener("click", async () => {
    if (!confirm("¿Eliminar la configuración de SINPE?")) return;
    try {
      await deleteSinpeDB();
      sinpe = null; mode = null;
      renderAll();
      document.getElementById("cta-detail").innerHTML = `<div class="crm-placeholder"><div class="crm-placeholder-icon"><svg width="32" height="32" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></div><div class="crm-placeholder-text">SINPE eliminado</div></div>`;
      toast("SINPE eliminado");
    } catch (err) { toast("Error al eliminar SINPE: " + (err.message || err), "error"); }
  });
}
