// Utils: formatting, helpers, tiny toast

export function esc(s = '') {
  return String(s).replace(/[&<>"]+/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
}

export function fmtMoney(n = 0, currency = 'CRC') {
  const locales = 'es-CR';
  const code = currency || 'CRC';
  return new Intl.NumberFormat(locales, { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(Number(n)||0);
}

export function debounce(fn, wait = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
}

export function todayLocal() {
  // yyyy-mm-dd in local TZ (Costa Rica)
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function initials(name = '') {
  const p = String(name).trim().split(/\s+/).slice(0,2).map(s => s[0]?.toUpperCase()||'');
  return (p[0]||'') + (p[1]||'');
}

export function fmtDate(s) {
  if (!s) return '';
  try { const d = new Date(s); return d.toLocaleDateString('es-CR'); } catch { return String(s); }
}

export function toast(msg, type = 'info', ms = 3000) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    root.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;pointer-events:none;';
    document.body.appendChild(root);
  }

  const icons = {
    success: '<svg width="16" height="16" fill="none" stroke="#16a34a" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>',
    error: '<svg width="16" height="16" fill="none" stroke="#dc2626" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>',
    warn: '<svg width="16" height="16" fill="none" stroke="#f59e0b" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/></svg>',
    info: '<svg width="16" height="16" fill="none" stroke="#0d3270" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  const borderColors = {
    success: '#16a34a',
    error: '#dc2626',
    warn: '#f59e0b',
    info: 'var(--border, #e2e6f0)'
  };

  const el = document.createElement('div');
  el.style.cssText = `
    display:flex;align-items:center;gap:10px;
    padding:12px 18px;border-radius:12px;
    color:var(--text, #0f172a);font-size:12.5px;font-weight:600;
    font-family:var(--font, Inter, sans-serif);
    box-shadow:0 12px 32px rgba(13,50,112,0.12),0 4px 8px rgba(0,0,0,0.04);
    border:1.5px solid ${borderColors[type] || borderColors.info};
    background:rgba(255,255,255,0.95);
    backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
    pointer-events:auto;
    animation:toastSlide 0.35s cubic-bezier(0.34,1.56,0.64,1);
    max-width:360px;
  `;
  el.innerHTML = `${icons[type] || icons.info}<span>${msg}</span>`;

  if (!document.getElementById('toast-anim-styles')) {
    const s = document.createElement('style');
    s.id = 'toast-anim-styles';
    s.textContent = `@keyframes toastSlide { from { transform: translateY(16px) scale(0.95); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }`;
    document.head.appendChild(s);
  }

  root.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'all 0.25s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-8px) scale(0.95)';
    setTimeout(() => el.remove(), 250);
  }, ms);
}
