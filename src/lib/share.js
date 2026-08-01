// ============================================================
// SHARE — Generar PDF del comprobante y compartir via
// WhatsApp / Correo / Descarga usando Web Share API
// Optimizado para móvil (navigator.share con files)
// ============================================================

// ─── Cargar jsPDF desde CDN ──────────────────────────────────
function loadJsPDF() {
  if (window.jspdf) return Promise.resolve(window.jspdf.jsPDF);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="jspdf"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.jspdf.jsPDF));
      existing.addEventListener('error', () => reject(new Error('Failed to load jsPDF')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    s.onload = () => resolve(window.jspdf.jsPDF);
    s.onerror = () => reject(new Error('Failed to load jsPDF'));
    document.head.appendChild(s);
  });
}

// ─── Cargar html2canvas desde CDN ────────────────────────────
function loadHtml2Canvas() {
  if (window.html2canvas) return Promise.resolve(window.html2canvas);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2canvas"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2canvas));
      existing.addEventListener('error', () => reject(new Error('Failed to load html2canvas')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    s.onload = () => resolve(window.html2canvas);
    s.onerror = () => reject(new Error('Failed to load html2canvas'));
    document.head.appendChild(s);
  });
}

// ─── Helper: eliminar bloques @media responsive/print del CSS ─
function stripMediaBlocks(css) {
  let result = css;
  for (const marker of ['@media (max-width:', '@media print']) {
    let idx = result.indexOf(marker);
    while (idx !== -1) {
      let depth = 0, end = idx;
      for (let i = idx; i < result.length; i++) {
        if (result[i] === '{') depth++;
        if (result[i] === '}') {
          depth--;
          if (depth === 0) { end = i + 1; break; }
        }
      }
      result = result.slice(0, idx) + result.slice(end);
      idx = result.indexOf(marker);
    }
  }
  return result;
}

// ─── Generar PDF real desde un elemento DOM (html2canvas + jsPDF) ─
export async function generarPDFComprobante(element, filename = 'comprobante.pdf') {
  const [jsPDF, html2canvas] = await Promise.all([loadJsPDF(), loadHtml2Canvas()]);

  const ownerDoc = element.ownerDocument;

  // Clonar el elemento y sus estilos en un contenedor oculto del documento
  // principal para que html2canvas lo capture de forma fiable a 850px de ancho
  // (ancho desktop), evitando que las media queries colapsen el header.
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:absolute;left:-9999px;top:0;z-index:-9999;pointer-events:none;overflow:visible;';

  // Copiar estilos del iframe, sin responsive ni print
  ownerDoc.querySelectorAll('style').forEach(styleEl => {
    const s = document.createElement('style');
    s.textContent = stripMediaBlocks(styleEl.textContent);
    wrapper.appendChild(s);
  });

  // Clonar la hoja A4
  const clone = element.cloneNode(true);
  clone.style.width = '850px';
  clone.style.maxWidth = '850px';
  clone.style.boxShadow = 'none';
  clone.style.margin = '0';
  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  // Esperar a que estilos e imágenes se apliquen
  await new Promise(r => setTimeout(r, 300));

  try {
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: '#ffffff',
      width: 850,
      windowWidth: 900,
    });

    // Crear PDF tamaño A4
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();   // ~210mm
    const pageH = pdf.internal.pageSize.getHeight();  // ~297mm

    const imgRatio = canvas.height / canvas.width;
    const pdfImgW = pageW;
    const pdfImgH = pageW * imgRatio;

    if (pdfImgH <= pageH) {
      // Cabe en una sola página
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfImgW, pdfImgH);
    } else {
      // Multi-página: dividir el canvas en chunks del tamaño de una página
      const pixelsPerPage = canvas.width * (pageH / pageW);
      let srcY = 0;
      let page = 0;

      while (srcY < canvas.height) {
        if (page > 0) pdf.addPage();
        const sliceH = Math.min(pixelsPerPage, canvas.height - srcY);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceH;
        const ctx = pageCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, sliceH);
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

        const scaledSliceH = (sliceH / canvas.width) * pageW;
        pdf.addImage(pageCanvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pdfImgW, scaledSliceH);

        srcY += sliceH;
        page++;
      }
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(wrapper);
  }
}

// ─── Crear objeto File desde blob ───────────────────────────
function blobToFile(blob, filename) {
  return new File([blob], filename, { type: 'application/pdf' });
}

// ─── Verificar soporte de Web Share API con archivos ────────
export function canShareFiles() {
  return typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    typeof navigator.share === 'function' &&
    navigator.canShare({ files: [new File(['test'], 'test.pdf', { type: 'application/pdf' })] });
}

// ─── Plantilla de mensaje ───────────────────────────────────
export function buildMessage(data) {
  const docType = (data.docType || 'documento').toUpperCase();
  const docNum = data.docNum || '';
  const clientName = data.clientName || '';
  const total = data.totalText || '';

  const greeting = `Hola${clientName ? ' ' + clientName : ''}, le compartimos su ${docType}${docNum ? ' ' + docNum : ''} de INNOVIO.`;
  const totalLine = `💰 Total: ${total}`;

  let body;

  if (docType.includes('COTIZ')) {
    body = `📎 Adjunto encontrará el documento PDF de su cotización.\n\nPor favor confírmenos si desea proceder con el servicio.`;
  } else if (docType.includes('ORDEN')) {
    body = `📎 Adjunto encontrará el documento PDF de su comprobante.\n\nPor favor responda para confirmar que ha recibido este mensaje.`;
  } else if (docType.includes('FACTURA')) {
    body = `📎 Adjunto encontrará el documento PDF de su factura.\n\nGracias por su pago puntual.`;
  } else {
    body = `📎 Adjunto encontrará el documento PDF de su comprobante.\n\nPor favor responda para confirmar que ha recibido este mensaje.`;
  }

  return `${greeting}\n\n${totalLine}\n\n${body}\n\nGracias por su preferencia.`;
}

export function buildEmailSubject(data) {
  const docType = data.docType || 'Documento';
  const docNum = data.docNum || '';
  return `${docType}${docNum ? ' ' + docNum : ''} — INNOVIO`;
}

// ─── Compartir via WhatsApp ─────────────────────────────────
export async function shareViaWhatsApp(pdfBlob, filename, data) {
  const message = buildMessage(data);

  // Descargar PDF para que el usuario lo tenga en su teléfono y pueda adjuntarlo
  downloadBlob(pdfBlob, filename);

  // Abrir chat de WhatsApp con el mensaje de la plantilla predeterminado
  let num = (data.clientPhone || '').replace(/\D/g, '');
  if (num.startsWith('0')) num = num.substring(1);
  if (!num.startsWith('506') && num.length === 8) num = '506' + num;
  
  if (num) {
    window.open('https://wa.me/' + num + '?text=' + encodeURIComponent(message), '_blank');
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(message), '_blank');
  }
  
  return { success: true, method: 'fallback' };
}

// ─── Compartir via Correo ───────────────────────────────────
export async function shareViaEmail(pdfBlob, filename, data) {
  const message = buildMessage(data);
  const subject = buildEmailSubject(data);

  // Móvil: Web Share API funciona bien (abre hoja nativa de compartir)
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || (('ontouchstart' in window) && screen.width < 1024);
  if (isMobile && canShareFiles()) {
    try {
      const pdfFile = blobToFile(pdfBlob, filename);
      await navigator.share({
        files: [pdfFile],
        title: subject,
        text: message
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      // Si falla en móvil, continuar al .eml
    }
  }

  // Desktop (o fallback móvil): generar .eml con PDF adjunto, destinatario y asunto.
  // Al abrir el .eml, Outlook lo carga como borrador listo para enviar.
  const email = data.clientEmail || '';
  const pdfBase64 = await blobToBase64(pdfBlob);

  const boundary = '----=_INNOVIO_' + Date.now();
  const eml = [
    `To: ${email}`,
    `Subject: ${subject}`,
    `X-Unsent: 1`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: quoted-printable`,
    ``,
    message.replace(/\n/g, '\r\n'),
    ``,
    `--${boundary}`,
    `Content-Type: application/pdf; name="${filename}"`,
    `Content-Disposition: attachment; filename="${filename}"`,
    `Content-Transfer-Encoding: base64`,
    ``,
    pdfBase64,
    ``,
    `--${boundary}--`
  ].join('\r\n');

  const emlBlob = new Blob([eml], { type: 'message/rfc822' });
  const emlFilename = filename.replace('.pdf', '.eml');
  downloadBlob(emlBlob, emlFilename);
  return { success: true, method: 'eml' };
}

// ─── Convertir Blob a base64 ───────────────────────────────
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Extraer solo la parte base64 (después de "data:...;base64,")
      const base64 = dataUrl.split(',')[1] || '';
      // Dividir en líneas de 76 chars (estándar MIME)
      const lines = base64.match(/.{1,76}/g) || [];
      resolve(lines.join('\r\n'));
    };
    reader.onerror = () => reject(new Error('Error al leer archivo'));
    reader.readAsDataURL(blob);
  });
}

// ─── Descargar PDF directamente ─────────────────────────────
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPDF(element, filename = 'comprobante.pdf') {
  const blob = await generarPDFComprobante(element, filename);
  downloadBlob(blob, filename);
}
