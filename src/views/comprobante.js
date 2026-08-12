// ============================================================
// COMPROBANTE — Diseño V2 (mismo que vista previa del wizard)
// Carga datos de Supabase y renderiza con el estilo visual V2
// ============================================================
import { obtenerDocumentoCompleto, CODE_TO_LABEL } from '../data/documentos.js';
import { fmtMoney, esc, toast } from '../lib/utils.js';
import { calcTotals } from '../lib/comprobante.js';
import { generarPDFComprobante, shareViaWhatsApp, shareViaEmail, downloadPDF, canShareFiles } from '../lib/share.js';
import { LOGO_DATA_URL } from '../assets/logo.js';
import { getSupabase } from '../lib/supabase.js';

async function cargarCuentasSinpe() {
  try {
    const supabase = await getSupabase();
    const { data: cuentas, error: errCuentas } = await supabase
      .from('cuentas_bancarias')
      .select('*')
      .order('created_at', { ascending: true });
    if (errCuentas) console.error('[comprobante] Error cargando cuentas_bancarias:', errCuentas);

    const { data: sinpe, error: errSinpe } = await supabase
      .from('sinpe_config')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (errSinpe) console.error('[comprobante] Error cargando sinpe_config:', errSinpe);

    console.log('[comprobante] Cuentas cargadas:', cuentas?.length || 0, 'SINPE:', sinpe ? 'sí' : 'no');
    return { cuentas: cuentas || [], sinpe: sinpe || null };
  } catch (e) {
    console.error('[comprobante] Error general cargando cuentas/sinpe:', e);
    return { cuentas: [], sinpe: null };
  }
}

// ── Utilidades ──────────────────────────────────────────────
const safe = (v, fallback = '—') => (v && String(v).trim()) ? String(v).trim() : fallback;

function calcLaborTime(timeIn, timeOut) {
  if (!timeIn || !timeOut) return null;
  const tIn  = new Date(`2000-01-01T${timeIn}`);
  const tOut = new Date(`2000-01-01T${timeOut}`);
  let diffMs = tOut - tIn;
  if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
  const hrs  = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs}h ${mins.toString().padStart(2,'0')}min`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('es-CR', { day:'2-digit', month:'long', year:'numeric' });
  } catch { return dateStr; }
}

// ── CSS V2 (extraído del wizard) ─────────────────────────────
const V2_CSS = `
  :root {
    --brand-blue: #0b244e;
    --brand-blue-light: #114188;
    --text-main: #2d3748;
    --text-muted: #718096;
    --text-light: #a0aec0;
    --border-color: #e2e8f0;
    --green: #16a34a;
    --red: #dc2626;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .comp-v2-page { background: #e6eaf0; font-family: 'Inter', 'Segoe UI', sans-serif; font-size: 13px; color: var(--text-main); line-height: 1.5; min-height: 100vh; padding: 20px; display: flex; justify-content: center; }
  .a4-sheet { background: #fff; width: 100%; max-width: 850px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); font-size: 13px; color: var(--text-main); position: relative; }

  /* Header */
  .header {
    background: linear-gradient(135deg, #0b244e 0%, #0d3266 40%, #114188 100%);
    color: #fff;
    padding: 36px 44px;
    position: relative;
    overflow: hidden;
  }
  .header::before {
    content: ''; position: absolute; right: -40px; top: -40px; width: 300px; height: 300px;
    background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%); z-index: 1;
  }
  .header::after {
    content: ''; position: absolute; left: 0; bottom: 0; width: 100%; height: 3px;
    background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 50%, transparent 100%); z-index: 2;
  }
  .header-content { position: relative; z-index: 3; display: flex; width: 100%; justify-content: space-between; align-items: flex-start; gap: 30px; }
  .header-left { display: flex; flex-direction: column; gap: 14px; }
  .logo-container { display: flex; align-items: center; }
  .logo-container img { height: 80px; width: auto; max-width: 280px; object-fit: contain; filter: drop-shadow(0 3px 10px rgba(0,0,0,0.2)); }
  .contact-info { display: flex; flex-wrap: wrap; align-items: center; gap: 0; font-size: 11px; color: #cbd5e1; font-weight: 500; letter-spacing: 0.3px; }
  .contact-info .ci-item { display: flex; align-items: center; gap: 5px; padding: 0 14px; }
  .contact-info .ci-item:first-child { padding-left: 0; }
  .contact-info .ci-sep { width: 1px; height: 12px; background: rgba(255,255,255,0.2); }

  .header-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 200px; }
  .doc-type { border: 1px solid rgba(255,255,255,0.25); padding: 5px 16px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #e2e8f0; }
  .doc-number { font-size: 22px; font-weight: 800; line-height: 1.1; color: #fff; letter-spacing: 0.5px; }
  .doc-date { font-size: 11px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px; }

  /* Content Body */
  .content-body { padding: 30px 40px; }

  .top-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
  .card { border: 1px solid var(--border-color); padding: 16px 20px; background: #f8fafc; }
  .card-title { font-size: 10px; font-weight: 700; color: var(--text-light); letter-spacing: 1.5px; margin-bottom: 8px; text-transform: uppercase; }
  .client-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
  .client-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }
  .client-contact { margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; }

  .device-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
  .device-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; }
  .device-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .device-tag { font-size: 10px; padding: 3px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; color: var(--text-muted); }

  .section-title-wrap { display: flex; align-items: center; margin-bottom: 20px; margin-top: 20px; }
  .section-title { font-size: 11px; font-weight: 800; color: var(--text-light); letter-spacing: 2px; text-transform: uppercase; padding-right: 15px; white-space: nowrap; }
  .section-line { height: 1px; background: var(--border-color); flex-grow: 1; }

  .tarea-category { margin-bottom: 20px; }
  .cat-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .cat-line { height: 1px; border-bottom: 1px dashed var(--border-color); flex-grow: 1; }

  .tarea-group { margin-bottom: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid var(--border-color); border-top: none; border-left: none; }
  .tarea-item { font-size: 11px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--border-color); border-left: 1px solid var(--border-color); line-height: 1.3; }
  .tarea-item.checked { color: var(--green); font-weight: 500; }
  .tarea-item.checked::before { content: '✔'; font-weight: 800; font-size: 10px; }
  .tarea-item.unchecked { color: var(--text-light); text-decoration: line-through; }
  .tarea-item.unchecked::before { content: '—'; }

  .writable-box {
    border: 1px dashed #cbd5e1; border-radius: 6px; padding: 16px; min-height: 100px;
    background: #f8fafc; color: #94a3b8; font-style: italic; font-size: 12px; margin-bottom: 20px;
  }
  .text-box { font-size: 13px; color: var(--text-main); margin-bottom: 20px; white-space: pre-wrap; }

  .tariff-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
  .tariff-table th { background: #f8fafc; color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px; border-bottom: 2px solid var(--border-color); text-align: left; }
  .tariff-table td { padding: 12px 10px; border-bottom: 1px solid var(--border-color); color: var(--text-main); }
  .tariff-table th.right, .tariff-table td.right { text-align: right; }

  .totals-area { display: flex; justify-content: flex-end; margin-top: 20px; }
  .totals-box { width: 300px; }
  .total-line { display: flex; justify-content: space-between; padding: 6px 0; color: var(--text-muted); font-size: 13px; }
  .total-line.grand { font-size: 18px; font-weight: 800; color: var(--brand-blue); border-top: 2px solid var(--brand-blue); padding-top: 12px; margin-top: 6px; }

  .signatures { display: flex; justify-content: flex-start; margin-top: 60px; padding: 0 40px; }
  .sig-block { width: 220px; text-align: center; }
  .sig-line { border-top: 1px solid var(--text-muted); margin-bottom: 8px; }
  .sig-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

  .warning-badge { background: #fef08a; color: #b45309; font-size: 10px; padding: 3px 8px; border-radius: 4px; font-weight: 800; display: inline-block; margin-top: 6px; }

  @media print {
    @page { size: A4 portrait; margin: 4mm; }
    body { background: white; margin: 0; padding: 0; }
    .header, .header::before, .header::after, .card, .warning-badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .a4-sheet { box-shadow: none; margin: 0; padding: 0; width: 100%; min-height: auto; }
    .comp-fab-group { display: none !important; }
    .comp-v2-page { padding: 0; }
    /* Forzar layout desktop al imprimir (A4 ~764px activa el breakpoint 768px) */
    .header { padding: 36px 44px !important; }
    .header-content { flex-direction: row !important; gap: 30px !important; justify-content: space-between !important; }
    .header-right { align-items: flex-end !important; text-align: right !important; min-width: 200px !important; }
    .content-body { padding: 30px 40px !important; }
    .top-cards { grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
    .tarea-group { grid-template-columns: repeat(4, 1fr) !important; }
    .totals-box { width: 300px !important; }
  }
  @media (max-width: 768px) {
    .comp-v2-page { padding: 0; }
    .a4-sheet { box-shadow: none; }
    .header { padding: 24px 20px; }
    .header-content { flex-direction: column; gap: 16px; }
    .header-right { align-items: flex-start; text-align: left; }
    .content-body { padding: 20px; }
    .top-cards { grid-template-columns: 1fr; gap: 12px; }
    .tarea-group { grid-template-columns: repeat(2, 1fr); }
    .totals-box { width: 100%; }
  }
`;

// ── Generar HTML del comprobante V2 ──────────────────────────
function buildComprobanteHTML(d) {
  const currencyCode = d.currency?.code || 'CRC';
  const sym = currencyCode === 'CRC' ? '₡' : '$';
  const isOrden = (d.docType || '').toUpperCase().includes('ORDEN');
  const title = d.docType || 'ORDEN DE TRABAJO';

  // Cliente
  const cNombre = d.clientCompany || d.clientName || 'Consumidor Final';
  const cSub = d.clientCompany ? d.clientName : '';
  const cId = d.clientCedula || '';
  const cTel = d.clientPhone || '';
  const cEmail = d.clientEmail || '';
  const warningBadge = (!cId || cId === '000000000') ? '<div class="warning-badge">⚠️ SIN DATOS DE FACTURACIÓN ELECTRÓNICA</div>' : '';

  // Equipos
  const equipos = d.equipos || [];
  const equiposHtml = equipos.length > 0 ? equipos.map((eq, i) => {
    const eqObj = typeof eq === 'object' ? eq : {};
    const nombre = eqObj['DISPOSITIVO'] || eqObj.tipo || eqObj.dispositivo || eqObj.nombre || 'Equipo';
    const fabricante = eqObj['FABRICANTE'] || eqObj.marca || eqObj.fabricante || '';
    const modelo = eqObj['MODELO'] || eqObj.modelo || '';
    const so = eqObj['S.O.'] || eqObj.so || '';
    return `${i > 0 ? '<div style="height:1px; background:var(--border-color); margin: 16px 0;"></div>' : ''}
      <div class="device-name">${esc(nombre)}</div>
      <div class="device-sub">${esc(fabricante)}${fabricante && modelo ? ' ' : ''}${esc(modelo)}</div>
      ${so ? `<div class="device-tags"><span class="device-tag">SO: ${esc(so)}</span></div>` : ''}`;
  }).join('') : '<div class="device-name">Equipo No Especificado</div>';

  // Trabajos realizados
  const workItems = d.workItems || d.tareasRealizadas || [];
  let trabajosHtml = '';
  if (workItems.length > 0) {
    trabajosHtml = `
      <div class="tarea-category">
        <div class="cat-title">🔧 TRABAJOS <div class="cat-line"></div></div>
        <div class="tarea-group">
          ${workItems.map(w => {
            const text = typeof w === 'string' ? w : (w.descripcion || w.text || '');
            const checked = typeof w === 'string' ? true : (w.realizada ?? w.checked ?? true);
            return `<div class="tarea-item ${checked ? 'checked' : 'unchecked'}">${esc(text)}</div>`;
          }).join('')}
        </div>
      </div>`;
  } else {
    trabajosHtml = '<div class="text-box" style="color:var(--text-muted); font-style:italic;">No hay trabajos marcados.</div>';
  }

  const lines = d.lines || [];
  const linesHTML = lines.filter(l => l.descripcion || l.desc).map(l => {
    const desc = l.descripcion || l.desc || '';
    const qty = Number(l.cantidad || l.qty) || 0;
    const price = Number(l.precio || l.price) || 0;
    const ltot = qty * price;
    const codigo = l.codigo || l.code || '—';
    const unidad = l.unidad || l.unit || 'Hora';
    return `<tr>
      <td style="font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--brand-blue);font-size:11px;">${esc(codigo)}</td>
      <td>${esc(desc)}</td>
      <td style="font-weight:600;color:var(--text-muted);font-size:11px;">${esc(unidad)}</td>
      <td class="right">${esc(qty)}</td>
      <td class="right">${fmtMoney(price, currencyCode)}</td>
      <td class="right" style="font-weight:700;">${fmtMoney(ltot, currencyCode)}</td>
    </tr>`;
  }).join('');


  // Totales
  const totals = calcTotals({
    lines: lines.map(l => ({
      qty: Number(l.cantidad || l.qty) || 0,
      price: Number(l.precio || l.price) || 0
    })),
    discount: d.discount || { enabled: false, value: 0 },
    iva: d.iva || { enabled: false, value: 0 },
    currency: d.currency || { code: 'CRC' }
  });

  const sub = lines.reduce((a, l) => a + (Number(l.precio || l.price) || 0) * (Number(l.cantidad || l.qty) || 0), 0);
  const desc = d.discount?.enabled ? (sub * (Number(d.discount.value) || 0) / 100) : 0;
  const net = sub - desc;
  const iva = d.iva?.enabled ? (net * Number(d.iva.value) / 100) : 0;

  // Tiempo laborado
  const laborTxt = calcLaborTime(d.timeIn, d.timeOut);

  // Fecha
  const docDateStr = d.date || new Date().toISOString().split('T')[0];

  // Botones flotantes — siempre visibles
  return `
    <style>${V2_CSS}</style>

    <!-- BOTONES FLOTANTES -->
    <div class="comp-fab-group">
      <button class="comp-fab comp-fab-close" id="comp-btn-close" title="Cerrar">✕</button>
      <button class="comp-fab comp-fab-download" id="comp-btn-download" title="Descargar PDF">📥</button>
      <button class="comp-fab comp-fab-wa" id="comp-btn-wa" title="Enviar por WhatsApp">💬</button>
      <button class="comp-fab comp-fab-email" id="comp-btn-email" title="Enviar por Correo">✉️</button>
      <button class="comp-fab comp-fab-print" id="comp-btn-print" title="Imprimir">🖨️</button>
    </div>

    <div class="comp-v2-page">
      <div class="a4-sheet">

        <!-- HEADER -->
        <div class="header">
          <div class="header-content">
            <div class="header-left">
              <div class="logo-container">
                <img src="${LOGO_DATA_URL}" alt="INNOVIO" />
              </div>
              <div class="contact-info">
                <span class="ci-item">📍 Cartago, La Unión</span>
                <span class="ci-sep"></span>
                <span class="ci-item">📱 (506) 6277 7500</span>
                <span class="ci-sep"></span>
                <span class="ci-item">✉️ innoviocr@outlook.es</span>
              </div>
            </div>
            <div class="header-right">
              <div class="doc-type">${esc(title)}</div>
              <div class="doc-number">${esc(d.docNum || '—')}</div>
              <div class="doc-date">${formatDate(docDateStr)}</div>
            </div>
          </div>
        </div>

        <!-- CONTENT BODY -->
        <div class="content-body">

          <!-- TOP CARDS: CLIENTE + EQUIPO/ENTREGA -->
          <div class="top-cards">
            <div class="card">
              <div class="card-title">CLIENTE</div>
              <div class="client-name">${esc(cNombre)}</div>
              ${cSub ? `<div class="client-sub">${esc(cSub)}</div>` : ''}
              ${warningBadge}
              <div class="client-contact">
                ${cTel ? `<div>📱 ${esc(cTel)}</div>` : ''}
                ${cEmail ? `<div>✉️ ${esc(cEmail)}</div>` : ''}
              </div>
            </div>
            ${!isOrden ? `
              ${d.tiempoEstimado ? `
              <div class="card">
                <div class="card-title">TIEMPO DE ENTREGA</div>
                <div class="client-name" style="font-size:16px;">${esc(d.tiempoEstimado)}</div>
              </div>` : '<div class="card"></div>'}
            ` : `
            <div class="card">
              <div class="card-title">EQUIPO</div>
              ${equiposHtml}
            </div>
            `}
          </div>

          ${isOrden ? `
          <!-- TRABAJOS REALIZADOS (solo OT) -->
          <div class="section-title-wrap">
            <div class="section-title">TRABAJOS REALIZADOS</div>
            <div class="section-line"></div>
          </div>
          ${trabajosHtml}

          <!-- DIAGNÓSTICO / OBSERVACIONES (solo OT) -->
          <div class="section-title-wrap">
            <div class="section-title">DIAGNÓSTICO / OBSERVACIONES</div>
            <div class="section-line"></div>
          </div>
          ${(d.diagnosis || d.observations || d.problem) ? `
            <div class="text-box">
              ${d.problem ? `<strong>Problema Reportado:</strong>\n${esc(d.problem)}\n\n` : ''}
              ${d.diagnosis ? `<strong>Diagnóstico:</strong>\n${esc(d.diagnosis)}\n\n` : ''}
              ${d.observations ? `<strong>Observaciones:</strong>\n${esc(d.observations)}` : ''}
            </div>
          ` : `
            <div class="writable-box">
              Espacio para notas, diagnóstico u observaciones del técnico...
            </div>
          `}
          ` : `
          <!-- CONDICIONES Y OBSERVACIONES (cotización) -->
          <div class="section-title-wrap">
            <div class="section-title">CONDICIONES Y OBSERVACIONES</div>
            <div class="section-line"></div>
          </div>
          ${d.observations ? `
            <div class="text-box">
              ${esc(d.observations).replace(/\n/g, '<br>')}
            </div>
          ` : `
            <div class="writable-box">
              Espacio para condiciones y observaciones...
            </div>
          `}
          `}

          <!-- TABLA DE TARIFAS -->
          ${linesHTML ? `
            <table class="tariff-table">
              <thead>
                <tr>
                  <th style="width:80px">Código</th>
                  <th>Descripción</th>
                  <th style="width:75px">Unidad</th>
                  <th class="right" style="width:60px">Cant.</th>
                  <th class="right" style="width:110px">Precio Unit.</th>
                  <th class="right" style="width:115px">Total</th>
                </tr>
              </thead>
              <tbody>${linesHTML}</tbody>
            </table>
          ` : ''}


          <!-- TIEMPO LABORADO (solo OT) -->
          ${isOrden && laborTxt ? `
          <div style="margin-top:16px; margin-bottom:8px; padding:10px 16px; background:#f5f5f0; border:1px solid #d8d8d0; border-radius:8px; display:inline-block;">
            <div style="font-size:9px; font-weight:600; opacity:0.6; letter-spacing:2px; text-transform:uppercase;">⏱ Tiempo Laborado</div>
            <div style="font-size:18px; font-weight:800; color:#0a0e1a; font-family:'Syne',sans-serif;">${laborTxt}</div>
            ${d.timeIn && d.timeOut ? `<div style="font-size:10px; opacity:0.5; color:#4a5270;">${esc(d.timeIn)} → ${esc(d.timeOut)}</div>` : ''}
          </div>
          ` : ''}

          <!-- TOTALES -->
          ${linesHTML ? `
          <div class="totals-area">
            <div class="totals-box">
              <div class="total-line"><span>Subtotal</span><span>${fmtMoney(sub, currencyCode)}</span></div>
              ${d.discount?.enabled ? `<div class="total-line"><span>Descuento (${d.discount.value}%)</span><span>- ${fmtMoney(desc, currencyCode)}</span></div>` : ''}
              ${d.iva?.enabled ? `<div class="total-line"><span>IVA (${d.iva.value}%)</span><span>${fmtMoney(iva, currencyCode)}</span></div>` : ''}
              <div class="total-line grand"><span>TOTAL</span><span>${fmtMoney(net + iva, currencyCode)}</span></div>
            </div>
          </div>
          ` : ''}

          <!-- CUENTAS BANCARIAS Y SINPE -->
          ${(d.cuentas?.length || d.sinpe?.numero) ? `
          <div style="margin-top:20px; padding:14px 20px; background:#f8fafc; border:1px solid var(--border-color); border-radius:8px;">
            <div style="font-size:10px; font-weight:800; color:var(--text-light); letter-spacing:2px; text-transform:uppercase; margin-bottom:10px;">Datos para Pago</div>
            <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:12px;">
            ${d.cuentas?.length ? d.cuentas.map(c => `
              <div style="padding:8px 12px; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">
                <div style="font-size:12px; font-weight:700; color:var(--text-main); display:flex; justify-content:space-between; align-items:center;">
                  ${esc(c.banco)}
                  <span style="font-size:9px; font-weight:700; padding:2px 6px; border-radius:3px; background:${c.moneda==='USD'?'#dbeafe':'#dcfce7'}; color:${c.moneda==='USD'?'#1e40af':'#166534'};">${c.moneda||'CRC'}</span>
                </div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:3px;">${esc(c.tipo||'cuenta')} — ${esc(c.titular)}</div>
                ${c.iban ? `<div style="font-size:10px; color:var(--text-muted); font-family:monospace; margin-top:2px;">${esc(c.iban)}</div>` : ''}
              </div>
            `).join('') : ''}
            ${d.sinpe?.numero ? `
              <div style="padding:8px 12px; background:#fff; border:1px solid #e2e8f0; border-radius:6px;">
                <div style="font-size:12px; font-weight:700; color:var(--text-main); display:flex; justify-content:space-between; align-items:center;">
                  📱 SINPE Móvil
                  <span style="font-size:9px; font-weight:700; padding:2px 6px; border-radius:3px; background:#dcfce7; color:#166534;">CRC</span>
                </div>
                <div style="font-size:10px; color:var(--text-muted); margin-top:3px; font-family:monospace;">${esc(d.sinpe.numero)}</div>
                ${d.sinpe.titular ? `<div style="font-size:10px; color:var(--text-muted);">${esc(d.sinpe.titular)}</div>` : ''}
              </div>
            ` : ''}
            </div>
          </div>
          ` : ''}

          <!-- FIRMA TÉCNICO (solo OT) -->
          ${isOrden ? `
          <div class="signatures">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Técnico</div>
            </div>
          </div>
          ` : ''}

        </div><!-- /content-body -->
      </div><!-- /a4-sheet -->
    </div><!-- /comp-v2-page -->
  `;
}

// ── Bind eventos FAB ────────────────────────────────────────
function bindCompEvents(container, data) {
  const btnClose = container.querySelector('#comp-btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      const overlay = document.querySelector('.comprobante-page');
      if (overlay) overlay.remove();
      window.history.back();
    });
  }

  const btnPrint = container.querySelector('#comp-btn-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => {
      // Necesitamos comprobanteEl y filename que se definen abajo,
      // pero el event listener es lazy — se ejecuta después, cuando ya existen.
      const sheet = container.querySelector('.a4-sheet');
      const fname = `${(data.docType || 'documento').replace(/\s+/g, '_')}_${data.docNum || 'sin_numero'}.pdf`;
      const origHTML = btnPrint.innerHTML;
      btnPrint.innerHTML = '⏳';
      btnPrint.disabled = true;
      generarPDFComprobante(sheet, fname).then(blob => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      }).catch(e => {
        toast('Error al generar PDF: ' + e.message, 'error');
      }).finally(() => {
        btnPrint.innerHTML = origHTML;
        btnPrint.disabled = false;
      });
    });
  }

  const comprobanteEl = container.querySelector('.a4-sheet');
  const filename = `${(data.docType || 'documento').replace(/\s+/g, '_')}_${data.docNum || 'sin_numero'}.pdf`;

  const totals = calcTotals({
    lines: (data.lines || []).map(l => ({ qty: Number(l.cantidad || l.qty) || 0, price: Number(l.precio || l.price) || 0 })),
    discount: data.discount || { enabled: false, value: 0 },
    iva: data.iva || { enabled: false, value: 0 },
    currency: data.currency || { code: 'CRC' }
  });

  const shareData = {
    docType: data.docType || 'documento',
    docNum: data.docNum || '',
    clientName: data.clientCompany || data.clientName || '',
    clientPhone: data.clientPhone || '',
    clientEmail: data.clientEmail || '',
    totalText: totals.total
  };

  function withLoading(btn, asyncFn) {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;
    asyncFn().finally(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    });
  }

  const btnDownload = container.querySelector('#comp-btn-download');
  if (btnDownload) {
    btnDownload.addEventListener('click', () => {
      withLoading(btnDownload, async () => {
        try {
          await downloadPDF(comprobanteEl, filename);
          toast('PDF descargado', 'success');
        } catch (e) {
          toast('Error al generar PDF: ' + e.message, 'error');
        }
      });
    });
  }

  const btnWA = container.querySelector('#comp-btn-wa');
  if (btnWA) {
    btnWA.addEventListener('click', () => {
      withLoading(btnWA, async () => {
        try {
          const pdfBlob = await generarPDFComprobante(comprobanteEl, filename);
          const result = await shareViaWhatsApp(pdfBlob, filename, shareData);
          if (result.cancelled) return;
          toast(result.method === 'native' ? 'Compartido via WhatsApp' : 'PDF descargado, abre WhatsApp para adjuntar', 'success');
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        }
      });
    });
  }

  const btnEmail = container.querySelector('#comp-btn-email');
  if (btnEmail) {
    btnEmail.addEventListener('click', () => {
      withLoading(btnEmail, async () => {
        try {
          const pdfBlob = await generarPDFComprobante(comprobanteEl, filename);
          const result = await shareViaEmail(pdfBlob, filename, shareData);
          if (result.cancelled) return;
          toast(result.method === 'native' ? 'Compartido via Correo' : 'PDF descargado, abre tu correo para adjuntar', 'success');
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        }
      });
    });
  }
}

// ── Renderizar como overlay fullscreen con iframe ───────────
function renderComprobante(data) {
  const existing = document.querySelector('.comprobante-page');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'comprobante-page';

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.background = '#e6eaf0';
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);

  iframe.addEventListener('load', () => {
    const doc = iframe.contentDocument;
    console.log('[comprobante] Data antes de render:', { cuentas: data.cuentas?.length, sinpe: data.sinpe?.numero });
    const html = buildComprobanteHTML(data);
    // Extraer el <style> y el body del HTML
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    const css = styleMatch ? styleMatch[1] : '';
    const bodyContent = html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<!--[\s\S]*?-->/g, '').trim();

    doc.open();
    doc.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><style>${css}</style></head><body>${bodyContent}</body></html>`);
    doc.close();

    // Guardar HTML completo para generar PDF
    iframe._compHTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><style>${css}</style></head><body>${bodyContent}</body></html>`;

    // Bind eventos dentro del iframe
    bindCompEvents(doc.body, data, iframe);
  });

  iframe.src = 'about:blank';

  const onEsc = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      window.removeEventListener('keydown', onEsc);
      window.history.back();
    }
  };
  window.addEventListener('keydown', onEsc);
}

// ── Vista: Comprobante de un documento guardado ─────────────
export async function comprobanteDocumentoView({ id }) {
  const loadingEl = document.createElement('div');
  loadingEl.className = 'comprobante-page';
  loadingEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:16px;color:#4a5270;font-family:'DM Sans',sans-serif;">
      <div style="width:40px;height:40px;border:3px solid #d8d8d0;border-top-color:#0a3270;border-radius:50%;animation:spin 1s linear infinite;"></div>
      <div style="font-size:14px;font-weight:500;">Cargando comprobante…</div>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;
  document.body.appendChild(loadingEl);

  try {
    const [completo, cuentasInfo] = await Promise.all([
      obtenerDocumentoCompleto(id),
      cargarCuentasSinpe()
    ]);
    const { doc, cliente, lineas, hoja, trabajos } = completo;

    const data = {
      docType: CODE_TO_LABEL[doc.doc_type] || 'ORDEN DE TRABAJO',
      docNum: doc.doc_num || '',
      date: doc.fecha || '',
      estado: doc.estado || '',
      clientName: cliente?.nombre || '',
      clientCompany: cliente?.empresa || '',
      clientType: cliente?.tipo_cliente || 'residencial',
      clientPhone: cliente?.telefono || '',
      clientEmail: cliente?.email || '',
      clientAddress: cliente?.direccion || '',
      clientCedula: cliente?.cedula || '',
      equipos: (Array.isArray(doc.equipos) && doc.equipos.length > 0) ? doc.equipos : (cliente?.equipos || []),
      lines: lineas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precio_unitario || l.precio })),
      discount: { enabled: (doc.descuento || 0) > 0, value: doc.descuento || 0 },
      iva:      { enabled: (doc.iva || 0) > 0, value: doc.iva || 0 },
      currency: { code: doc.moneda || 'CRC', symbol: doc.moneda === 'CRC' ? '₡' : '$' },
      problem: hoja?.problema_reportado || '',
      diagnosis: hoja?.diagnostico || '',
      observations: hoja?.observaciones || doc.observaciones || '',
      tiempoEstimado: doc.tiempo_estimado || '',
      timeIn: hoja?.hora_entrada || '',
      timeOut: hoja?.hora_salida || '',
      workItems: trabajos || [],
      contact: { address: 'Cartago, La Unión', phone: '(506) 6277 7500', email: 'innoviocr@outlook.es' },
      cuentas: cuentasInfo.cuentas,
      sinpe: cuentasInfo.sinpe
    };

    loadingEl.remove();
    renderComprobante(data);
  } catch (err) {
    loadingEl.remove();
    console.error('Error cargando comprobante:', err);
    toast('Error cargando comprobante: ' + (err.message || err), 'error');
  }
}

// ── Vista: Comprobante desde sessionStorage (preview) ───────
export async function comprobantePreviewView() {
  let raw = null;
  try { raw = JSON.parse(sessionStorage.getItem('innovio:editor:preview') || 'null'); } catch {}

  if (!raw) {
    toast('No hay datos para previsualizar.', 'warn');
    window.history.back();
    return;
  }

  const cuentasInfo = await cargarCuentasSinpe();

  const data = {
    docType: raw.docType || 'ORDEN DE TRABAJO',
    docNum: raw.docNum || '',
    date: raw.date || '',
    clientName: raw.clientName || '',
    clientCompany: raw.clientCompany || '',
    clientType: raw.clientType || 'residencial',
    clientPhone: raw.clientPhone || '',
    clientEmail: raw.clientEmail || '',
    clientAddress: raw.clientAddress || '',
    clientCedula: raw.clientCedula || '',
    equipos: raw.equipos || [],
    lines: raw.lines || [],
    discount: raw.discount || { enabled: false, value: 0 },
    iva: raw.iva || { enabled: false, value: 0 },
    currency: raw.currency || { code: 'CRC', symbol: '₡' },
    problem: raw.problem || '',
    diagnosis: raw.diagnosis || '',
    observations: raw.observations || '',
    tiempoEstimado: raw.tiempoEstimado || '',
    timeIn: raw.timeIn || '',
    timeOut: raw.timeOut || '',
    workItems: raw.workItems || raw.tareasRealizadas || [],
    contact: raw.contact || { address: 'Cartago, La Unión', phone: '(506) 6277 7500', email: 'innoviocr@outlook.es' },
    cuentas: cuentasInfo.cuentas,
    sinpe: cuentasInfo.sinpe
  };

  renderComprobante(data);
}
