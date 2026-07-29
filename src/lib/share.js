// ============================================================
// SHARE — Generar PDF del comprobante y compartir via
// WhatsApp / Correo / Descarga usando Web Share API
// Optimizado para móvil (navigator.share con files)
// ============================================================

// ─── Cargar html2pdf.js desde CDN ────────────────────────────
function loadHtml2Pdf() {
  if (window.html2pdf) return Promise.resolve(window.html2pdf);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="html2pdf"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.html2pdf));
      existing.addEventListener('error', () => reject(new Error('Failed to load html2pdf')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    s.onload = () => resolve(window.html2pdf);
    s.onerror = () => reject(new Error('Failed to load html2pdf'));
    document.head.appendChild(s);
  });
}

// ─── Generar PDF desde un elemento DOM ───────────────────────
export async function generarPDFComprobante(element, filename = 'comprobante.pdf') {
  const html2pdf = await loadHtml2Pdf();

  const opt = {
    margin: [8, 8, 8, 8],
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      backgroundColor: '#ffffff'
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: 'portrait'
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // Devolver como blob (no descargar directamente)
  const worker = html2pdf().set(opt).from(element);
  const pdfBlob = await worker.outputPdf('blob');
  return pdfBlob;
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
  const docType = data.docType || 'documento';
  const docNum = data.docNum || '';
  const clientName = data.clientName || '';
  const total = data.totalText || '';

  return `Hola${clientName ? ' ' + clientName : ''}, le compartimos su *${docType}*${docNum ? ' No. *' + docNum + '*' : ''} de INNOVIO.\n\n💰 Total: *${total}*\n\nGracias por su preferencia.`;
}

export function buildEmailSubject(data) {
  const docType = data.docType || 'Documento';
  const docNum = data.docNum || '';
  return `${docType}${docNum ? ' ' + docNum : ''} — INNOVIO`;
}

// ─── Compartir via WhatsApp ─────────────────────────────────
export async function shareViaWhatsApp(pdfBlob, filename, data) {
  const message = buildMessage(data);
  const pdfFile = blobToFile(pdfBlob, filename);

  // En móvil con Web Share API: compartir archivo + texto
  if (canShareFiles()) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: 'INNOVIO',
        text: message
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
      // Si falla, hacer fallback
    }
  }

  // Fallback: descargar PDF + abrir wa.me con texto
  downloadBlob(pdfBlob, filename);
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
  const pdfFile = blobToFile(pdfBlob, filename);

  // En móvil con Web Share API: compartir archivo + texto
  if (canShareFiles()) {
    try {
      await navigator.share({
        files: [pdfFile],
        title: subject,
        text: message
      });
      return { success: true, method: 'native' };
    } catch (err) {
      if (err.name === 'AbortError') return { success: false, cancelled: true };
    }
  }

  // Fallback: descargar PDF + abrir mailto
  downloadBlob(pdfBlob, filename);
  const email = data.clientEmail || '';
  const body = encodeURIComponent(message);
  const subj = encodeURIComponent(subject);
  window.location.href = `mailto:${email}?subject=${subj}&body=${body}`;
  return { success: true, method: 'fallback' };
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
  return blob;
}
