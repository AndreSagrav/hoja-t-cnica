// ============================================================
// COMPROBANTE — Diseño premium original replicado
// Carga datos de Supabase y renderiza con el estilo visual V1
// ============================================================
import { obtenerDocumentoCompleto, CODE_TO_LABEL } from '../data/documentos.js';
import { fmtMoney, esc, toast } from '../lib/utils.js';
import { calcTotals } from '../lib/comprobante.js';
import { generarPDFComprobante, shareViaWhatsApp, shareViaEmail, downloadPDF, canShareFiles } from '../lib/share.js';

// ── Utilidades ──────────────────────────────────────────────
const safe = (v, fallback = '—') => (v && String(v).trim()) ? String(v).trim() : fallback;

function tagClass(desc = '') {
  const d = desc.toLowerCase();
  if (d.includes('hora') || d.includes('servicio') || d.includes('mano de obra')) return 'comp-lt-bh';
  if (d.includes('transporte') || d.includes('envío') || d.includes('visita')) return 'comp-lt-eh';
  return 'comp-lt-def';
}

function tagLabel(desc = '') {
  const d = desc.toLowerCase();
  if (d.includes('hora') || d.includes('servicio') || d.includes('mano de obra')) return 'BH';
  if (d.includes('transporte') || d.includes('envío') || d.includes('visita')) return 'EH';
  return 'OT';
}

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

// ── Generar HTML del comprobante ─────────────────────────────
function buildComprobanteHTML(d) {
  const currencyCode = d.currency?.code || 'CRC';
  const sym = currencyCode === 'CRC' ? '₡' : '$';
  const isEmp = d.clientType === 'empresarial';
  const isCotizacion = (d.docType || '').toUpperCase().includes('COTIZ');

  // Equipos/dispositivos del documento
  const equip = d.equipos?.[0] || d.equip || {};
  const specs = [
    equip.serie    ? ['SERIE', equip.serie]   : null,
    equip.nombre   ? ['HOST',  equip.nombre]  : null,
    equip.tipo     ? ['TIPO',  equip.tipo]    : null,
    (equip.marca || equip.fabricante)
      ? ['MARCA', [equip.marca || equip.fabricante, equip.modelo].filter(Boolean).join(' ')]
      : null,
    equip.so       ? ['S.O.',  equip.so]      : null,
    equip.password ? ['PASS',  equip.password]: null,
  ].filter(Boolean);

  const specsHTML = specs.map(([k, v]) =>
    `<span class="comp-spec-key">${esc(k)}</span><span class="comp-spec-val">${esc(v)}</span>`
  ).join('');

  // Trabajos realizados
  const workItems = d.workItems || d.tareasRealizadas || [];
  let tasksHTML = '';
  if (workItems.length) {
    const items = workItems.map(w => {
      const text = typeof w === 'string' ? w : (w.descripcion || w.text || '');
      const checked = typeof w === 'string' ? true : (w.realizada ?? w.checked ?? true);
      return `
        <div class="comp-task-item">
          <span class="comp-check-icon ${checked ? 'done' : 'pend'}">${checked ? '✓' : '○'}</span>
          <span class="comp-task-text ${checked ? 'done' : 'pend'}">${esc(text)}</span>
        </div>`;
    }).join('');
    // Si no es múltiplo de 4, agregar celdas vacías para completar la fila
    const remainder = workItems.length % 4;
    const extra = remainder !== 0 ? Array(4 - remainder).fill('<div class="comp-task-item" style="border-top:1px solid var(--c-rule);border-left:1px solid var(--c-rule);"></div>').join('') : '';
    tasksHTML = items + extra;
  }

  // Líneas de tarifa
  const lines = d.lines || [];
  const linesHTML = lines.filter(l => l.descripcion || l.desc).map(l => {
    const desc = l.descripcion || l.desc || '';
    const qty  = Number(l.cantidad || l.qty) || 0;
    const price = Number(l.precio || l.price) || 0;
    const total = qty * price;
    const tag = tagLabel(desc);
    const cls = tagClass(desc);
    return `<tr>
      <td><span class="comp-line-tag ${cls}">${tag}</span></td>
      <td>${esc(desc)}</td>
      <td class="r mono">${qty}</td>
      <td class="r mono">${price ? fmtMoney(price, currencyCode) : '—'}</td>
      <td class="r mono">${total ? fmtMoney(total, currencyCode) : '—'}</td>
    </tr>`;
  }).join('');

  // Calcular totales
  const totals = calcTotals({
    lines: lines.map(l => ({
      qty: Number(l.cantidad || l.qty) || 0,
      price: Number(l.precio || l.price) || 0
    })),
    discount: d.discount || { enabled: false, value: 0 },
    iva: d.iva || { enabled: false, value: 0 },
    currency: d.currency || { code: 'CRC' }
  });

  // Tiempo laborado
  const laborTxt = calcLaborTime(d.timeIn, d.timeOut);

  // Contacto de empresa
  const contact = d.contact || { address: 'Cartago, La Unión', phone: '(506) 62 777 500', email: 'innoviocr@outlook.com' };

  // Timestamp
  const now = new Date();
  const ts = now.toLocaleDateString('es-CR') + ' · ' + now.toLocaleTimeString('es-CR', { hour:'2-digit', minute:'2-digit' });

  // Verificar si el teléfono del cliente es válido para WhatsApp
  const hasValidPhone = d.clientPhone && d.clientPhone.replace(/\D/g, '').length >= 8;
  const hasEmail = d.clientEmail && d.clientEmail.includes('@');
  const shareSupported = canShareFiles();

  return `
    <!-- BOTONES FLOTANTES -->
    <div class="comp-fab-group">
      <button class="comp-fab comp-fab-close" id="comp-btn-close" title="Cerrar">✕</button>
      <button class="comp-fab comp-fab-download" id="comp-btn-download" title="Descargar PDF">📥</button>
      ${hasValidPhone ? '<button class="comp-fab comp-fab-wa" id="comp-btn-wa" title="Enviar por WhatsApp">💬</button>' : ''}
      ${hasEmail ? '<button class="comp-fab comp-fab-email" id="comp-btn-email" title="Enviar por Correo">✉️</button>' : ''}
      <button class="comp-fab comp-fab-print" id="comp-btn-print" title="Imprimir">🖨️</button>
    </div>

    <!-- COMPROBANTE -->
    <div class="comprobante">

      <!-- CABECERA -->
      <div class="comp-header">
        <div class="comp-header-brand">
          <div class="comp-brand-title">INNOVIO</div>
          <div class="comp-brand-sub">Soluciones Tecnológicas</div>
          <div class="comp-brand-contact">
            <span>📍 ${esc(contact.address || contact.addr || '')}</span>
            <span>📱 ${esc(contact.phone || '')}</span>
            <span>✉️ ${esc(contact.email || '')}</span>
          </div>
        </div>
        <div class="comp-header-doc">
          <span class="comp-doc-badge">${esc(d.docType || 'ORDEN DE TRABAJO')}</span>
          <div class="comp-doc-num">${esc(d.docNum || '—')}</div>
          <div class="comp-doc-date">${formatDate(d.date)}</div>
        </div>
      </div>
      <div class="comp-accent-bar"></div>

      <!-- CUERPO -->
      <div class="comp-body">

        <!-- META: CLIENTE + EQUIPO -->
        <div class="comp-meta-grid">

          <!-- CLIENTE -->
          <div class="comp-meta-panel comp-client">
            <div class="comp-panel-label">Cliente</div>
            <div class="comp-panel-name">${safe(d.clientName)}</div>
            <div class="comp-panel-sub">${safe(d.clientCompany, '')}</div>
            ${d.clientCompany ? `<div class="comp-tipo-chip ${isEmp ? 'emp' : 'res'}">${isEmp ? '🏢 Empresarial' : '🏠 Residencial'}</div>` : ''}
            <div class="comp-panel-contact">
              ${d.clientPhone ? `<span>📱 ${esc(d.clientPhone)}</span>` : ''}
              ${d.clientEmail ? `<span>✉️ ${esc(d.clientEmail)}</span>` : ''}
              ${d.clientAddress ? `<span>📍 ${esc(d.clientAddress)}</span>` : ''}
            </div>
          </div>

          ${isCotizacion ? `
          <!-- TIEMPO DE ENTREGA (solo cotización) -->
          ${d.tiempoEstimado ? `
          <div class="comp-meta-panel comp-equip">
            <div class="comp-panel-label">Tiempo de Entrega</div>
            <div class="comp-panel-name">${esc(d.tiempoEstimado)}</div>
          </div>` : ''}
          ` : `
          <!-- EQUIPO (solo OT) -->
          <div class="comp-meta-panel comp-equip">
            <div class="comp-panel-label">Equipo</div>
            <div class="comp-panel-name">${safe(equip.tipo || equip.dispositivo, 'Sin equipo')}</div>
            <div class="comp-panel-sub">${[safe(equip.marca || equip.fabricante, ''), safe(equip.modelo, '')].filter(v => v && v !== '—').join(' — ') || '—'}</div>
            <div class="comp-equip-specs">${specsHTML || '<span class="comp-spec-val" style="grid-column:span 2;">Sin especificaciones registradas</span>'}</div>
          </div>
          `}

        </div>

        <!-- PROBLEMA (solo OT) -->
        ${(!isCotizacion && d.problem) ? `
        <div class="comp-section">
          <div class="comp-section-head">
            <div class="comp-section-title">Problema Reportado</div>
            <div class="comp-section-head-line"></div>
          </div>
          <div class="comp-text-block">${esc(d.problem)}</div>
        </div>` : ''}

        <!-- TRABAJO REALIZADO (solo OT) -->
        ${(!isCotizacion && tasksHTML) ? `
        <div class="comp-section">
          <div class="comp-section-head">
            <div class="comp-section-title">Trabajo Realizado</div>
            <div class="comp-section-head-line"></div>
          </div>
          <div class="comp-tasks-grid">${tasksHTML}</div>
        </div>` : ''}

        <!-- DIAGNÓSTICO (solo OT) -->
        ${(!isCotizacion && d.diagnosis) ? `
        <div class="comp-section">
          <div class="comp-section-head">
            <div class="comp-section-title">Diagnóstico / Resultado</div>
            <div class="comp-section-head-line"></div>
          </div>
          <div class="comp-text-block">${esc(d.diagnosis)}</div>
        </div>` : ''}

        <!-- TARIFA -->
        ${linesHTML ? `
        <div class="comp-section">
          <div class="comp-section-head">
            <div class="comp-section-title">Detalle de Tarifas</div>
            <div class="comp-section-head-line"></div>
          </div>
          <table class="comp-tariff-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Descripción</th>
                <th class="r">Cant.</th>
                <th class="r">Precio Unit.</th>
                <th class="r">Total</th>
              </tr>
            </thead>
            <tbody>${linesHTML}</tbody>
          </table>

          ${laborTxt ? `
          <div class="comp-tiempo-block">
            <div class="comp-tiempo-label">⏱ Tiempo Laborado</div>
            <div class="comp-tiempo-val">${laborTxt}</div>
            ${d.timeIn && d.timeOut ? `<div class="comp-tiempo-hours">${d.timeIn} → ${d.timeOut}</div>` : ''}
          </div>` : ''}

          <div class="comp-totals-wrapper">
            <div class="comp-totals-box">
              <div class="comp-total-row">
                <span>Importe bruto</span>
                <span class="comp-amount">${totals.gross}</span>
              </div>
              ${d.discount?.enabled ? `
              <div class="comp-total-row comp-disc-row">
                <span>Descuento (${d.discount.value}%)</span>
                <span class="comp-amount">▼ ${totals.discount}</span>
              </div>` : ''}
              <div class="comp-total-row" style="font-weight:600">
                <span>Subtotal</span>
                <span class="comp-amount">${d.iva?.enabled ? fmtMoney(totals.grossNum * (1 - ((d.discount?.enabled ? d.discount.value : 0) / 100)), currencyCode) : totals.total}</span>
              </div>
              ${d.iva?.enabled ? `
              <div class="comp-total-row comp-iva-row">
                <span>IVA (${d.iva.value}%)</span>
                <span class="comp-amount">${totals.iva}</span>
              </div>` : ''}
              <div class="comp-total-row comp-grand-total">
                <span class="comp-label">TOTAL ${currencyCode}</span>
                <span class="comp-amount">${totals.total}</span>
              </div>
            </div>
          </div>
        </div>` : ''}

        <!-- OBSERVACIONES -->
        ${d.observations ? `
        <div class="comp-obs-block">
          <div class="comp-obs-head">Observaciones</div>
          <div>${esc(d.observations)}</div>
        </div>` : ''}

      </div><!-- /comp-body -->

      ${!isCotizacion ? `
      <!-- FIRMA TÉCNICO (solo OT) -->
      <div class="comp-sigs" style="grid-template-columns:1fr;gap:0;padding:20px 40px 16px;">
        <div class="comp-sig-block">
          <div class="comp-sig-line"></div>
          <div class="comp-sig-label">Firma del Técnico</div>
        </div>
      </div>` : ''}

      <!-- PIE -->
      <div class="comp-footer">
        <div class="comp-footer-brand">INNOVIO</div>
        <div class="comp-footer-note">
          Documento generado digitalmente<br>
          <span>${ts}</span>
        </div>
      </div>

    </div><!-- /comprobante -->
  `;
}

// ── Bind eventos FAB ────────────────────────────────────────
function bindCompEvents(container, data) {
  const btnClose = container.querySelector('#comp-btn-close');
  if (btnClose) {
    btnClose.addEventListener('click', () => {
      container.remove();
      window.history.back();
    });
  }

  const btnPrint = container.querySelector('#comp-btn-print');
  if (btnPrint) {
    btnPrint.addEventListener('click', () => window.print());
  }

  // Obtener el elemento .comprobante para generar el PDF
  const comprobanteEl = container.querySelector('.comprobante');
  const filename = `${(data.docType || 'documento').replace(/\s+/g, '_')}_${data.docNum || 'sin_numero'}.pdf`;

  // Calcular total para el mensaje
  const totals = calcTotals({
    lines: (data.lines || []).map(l => ({ qty: Number(l.cantidad || l.qty) || 0, price: Number(l.precio || l.price) || 0 })),
    discount: data.discount || { enabled: false, value: 0 },
    iva: data.iva || { enabled: false, value: 0 },
    currency: data.currency || { code: 'CRC' }
  });

  const shareData = {
    docType: data.docType || 'documento',
    docNum: data.docNum || '',
    clientName: data.clientName || '',
    clientPhone: data.clientPhone || '',
    clientEmail: data.clientEmail || '',
    totalText: totals.total
  };

  // Helper: mostrar loading en botón
  function withLoading(btn, asyncFn) {
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '⏳';
    btn.disabled = true;
    asyncFn().finally(() => {
      btn.innerHTML = originalHTML;
      btn.disabled = false;
    });
  }

  // Descargar PDF
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

  // WhatsApp con PDF
  const btnWA = container.querySelector('#comp-btn-wa');
  if (btnWA && data.clientPhone) {
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

  // Correo con PDF
  const btnEmail = container.querySelector('#comp-btn-email');
  if (btnEmail && data.clientEmail) {
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

// ── Renderizar como overlay fullscreen ──────────────────────
function renderComprobante(data) {
  // Remover overlay previo si existe
  const existing = document.querySelector('.comprobante-page');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'comprobante-page';
  overlay.innerHTML = buildComprobanteHTML(data);
  document.body.appendChild(overlay);
  bindCompEvents(overlay, data);

  // Cerrar con Escape
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
  // Mostrar loading mientras cargamos
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
    const completo = await obtenerDocumentoCompleto(id);
    const { doc, cliente, lineas, hoja, trabajos } = completo;

    // Mapear datos al formato que espera el renderizador
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
      equipos: cliente?.equipos || [],
      lines: lineas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precio })),
      discount: { enabled: (doc.descuento || 0) > 0, value: doc.descuento || 0 },
      iva:      { enabled: (doc.iva || 0) > 0, value: doc.iva || 0 },
      currency: { code: doc.moneda || 'CRC', symbol: (doc.moneda === 'CRC' ? '₡' : '$') },
      problem: hoja?.diagnostico || '',
      diagnosis: hoja?.diagnostico || '',
      observations: doc.observaciones || '',
      tiempoEstimado: doc.tiempo_estimado || '',
      timeIn: hoja?.hora_entrada || '',
      timeOut: hoja?.hora_salida || '',
      workItems: trabajos || [],
      contact: { address: 'Cartago, La Unión', phone: '(506) 62 777 500', email: 'innoviocr@outlook.com' }
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
export function comprobantePreviewView() {
  let raw = null;
  try { raw = JSON.parse(sessionStorage.getItem('innovio:editor:preview') || 'null'); } catch {}

  if (!raw) {
    toast('No hay datos para previsualizar.', 'warn');
    window.history.back();
    return;
  }

  // Mapear desde el formato del editor
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
    contact: raw.contact || { address: 'Cartago, La Unión', phone: '(506) 62 777 500', email: 'innoviocr@outlook.com' }
  };

  renderComprobante(data);
}
