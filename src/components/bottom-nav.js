// ============================================================
// INNOVIO — Bottom Navigation Bar (Mobile-only)
// Premium tab bar with auto-hide on scroll, safe-area support
// ============================================================

const BOTTOM_NAV_TABS = [
  { path: '/dashboard',  icon: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>', label: 'Inicio' },
  { path: '/documentos', icon: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Docs' },
  { path: null,          icon: '<svg width="26" height="26" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>', label: 'Nuevo', isCta: true },
  { path: '/clientes',   icon: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>', label: 'Clientes' },
  { path: '/impuestos',  icon: '<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m7-9a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Fiscal' }
];

const BOTTOM_NAV_CSS = `
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: var(--z-overlay, 500);
    background: rgba(255,255,255,0.92);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-top: 1px solid rgba(226,232,240,0.6);
    padding: 4px 0 calc(4px + env(safe-area-inset-bottom, 0px));
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 -4px 20px rgba(13,50,112,0.06);
  }
  .bottom-nav.hidden { transform: translateY(100%); }
  @media (max-width: 768px) {
    .bottom-nav { display: flex; justify-content: space-around; align-items: center; }
  }
  [data-theme="dark"] .bottom-nav {
    background: rgba(26,34,54,0.92);
    border-top-color: rgba(45,58,82,0.4);
    box-shadow: 0 -4px 20px rgba(0,0,0,0.2);
  }
  .bnav-tab {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 2px;
    flex: 1;
    padding: 6px 0;
    background: none; border: none;
    color: var(--text-soft, #64748b);
    cursor: pointer;
    transition: color 0.2s, transform 0.15s;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    position: relative;
    font-family: var(--font, 'Inter', sans-serif);
  }
  .bnav-tab:active { transform: scale(0.92); }
  .bnav-tab.active { color: var(--navy, #0d3270); }
  .bnav-tab.active::before {
    content: '';
    position: absolute;
    top: 0; left: 50%; transform: translateX(-50%);
    width: 24px; height: 3px;
    background: linear-gradient(90deg, var(--accent, #00c2a8), var(--blue-light, #2563c4));
    border-radius: 0 0 4px 4px;
    animation: bnav-indicator 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  @keyframes bnav-indicator {
    from { width: 0; opacity: 0; }
    to { width: 24px; opacity: 1; }
  }
  .bnav-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.2px;
    line-height: 1;
  }
  .bnav-tab.active .bnav-label { font-weight: 700; }

  /* CTA center button */
  .bnav-tab.bnav-cta {
    position: relative;
    color: #fff;
  }
  .bnav-cta-circle {
    width: 48px; height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent, #00c2a8), var(--accent-dark, #00a88f));
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 16px rgba(0,194,168,0.35);
    transition: all 0.2s;
    margin-top: -14px;
  }
  .bnav-tab.bnav-cta:active .bnav-cta-circle { transform: scale(0.9); box-shadow: 0 2px 8px rgba(0,194,168,0.25); }
  .bnav-tab.bnav-cta .bnav-label { color: var(--accent-dark, #00a88f); margin-top: 1px; }

  /* Bottom sheet for Nuevo CTA */
  .bnav-sheet-overlay {
    position: fixed; inset: 0;
    background: rgba(4,23,63,0.4);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 9998;
    opacity: 0;
    transition: opacity 0.25s;
  }
  .bnav-sheet-overlay.visible { opacity: 1; }
  .bnav-sheet {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 9999;
    background: var(--surface, #fff);
    border-radius: 20px 20px 0 0;
    padding: 8px 16px calc(16px + env(safe-area-inset-bottom, 0px));
    transform: translateY(100%);
    transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 -8px 32px rgba(0,0,0,0.12);
    font-family: var(--font, 'Inter', sans-serif);
  }
  .bnav-sheet.visible { transform: translateY(0); }
  .bnav-sheet-handle {
    width: 36px; height: 4px;
    border-radius: 4px;
    background: var(--border, #e2e8f0);
    margin: 0 auto 12px;
  }
  .bnav-sheet-title {
    font-size: 11px; font-weight: 700;
    color: var(--text-soft, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: 4px 4px 10px;
  }
  .bnav-sheet-btn {
    display: flex; align-items: center; gap: 14px;
    width: 100%; padding: 14px 8px;
    border: none; background: none;
    cursor: pointer; transition: background 0.15s;
    border-radius: 12px;
    font-family: inherit;
    text-align: left;
  }
  .bnav-sheet-btn:active { background: var(--surface-2, #f8f9fc); }
  .bnav-sheet-icon {
    width: 42px; height: 42px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .bnav-sheet-btn-label { font-size: 15px; font-weight: 700; color: var(--text, #1e293b); }
  .bnav-sheet-btn-sub { font-size: 12px; font-weight: 400; color: var(--text-soft, #64748b); margin-top: 2px; }
  [data-theme="dark"] .bnav-sheet { background: var(--surface, #1a2236); }
  [data-theme="dark"] .bnav-sheet-overlay { background: rgba(0,0,0,0.5); }
`;

let lastScrollY = 0;
let navHidden = false;

export function createBottomNav(activePath) {
  // Inject CSS once
  if (!document.getElementById('bottom-nav-styles')) {
    const style = document.createElement('style');
    style.id = 'bottom-nav-styles';
    style.textContent = BOTTOM_NAV_CSS;
    document.head.appendChild(style);
  }

  // Remove existing
  const existing = document.getElementById('bottom-nav');
  if (existing) existing.remove();

  const nav = document.createElement('nav');
  nav.id = 'bottom-nav';
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navegación principal');

  nav.innerHTML = BOTTOM_NAV_TABS.map(tab => {
    const isActive = tab.path && activePath && activePath.startsWith(tab.path);
    if (tab.isCta) {
      return `
        <button class="bnav-tab bnav-cta" data-action="cta" aria-label="${tab.label}">
          <div class="bnav-cta-circle">${tab.icon}</div>
          <span class="bnav-label">${tab.label}</span>
        </button>`;
    }
    return `
      <button class="bnav-tab ${isActive ? 'active' : ''}" data-path="${tab.path || ''}" data-action="${tab.isMenu ? 'menu' : 'nav'}" aria-label="${tab.label}">
        ${tab.icon}
        <span class="bnav-label">${tab.label}</span>
      </button>`;
  }).join('');

  document.body.appendChild(nav);

  // Event listeners
  nav.querySelectorAll('.bnav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (action === 'nav' && btn.dataset.path) {
        window.location.hash = btn.dataset.path;
      } else if (action === 'cta') {
        openNewDocSheet();
      }
    });
  });

  // Auto-hide on scroll down, show on scroll up
  setupScrollBehavior(nav);

  return nav;
}

export function updateBottomNavActive(activePath) {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  nav.querySelectorAll('.bnav-tab').forEach(btn => {
    const path = btn.dataset.path;
    if (path) {
      btn.classList.toggle('active', activePath && activePath.startsWith(path));
    }
  });
}

function setupScrollBehavior(nav) {
  const content = document.getElementById('view-content');
  if (!content) return;
  
  const handler = () => {
    const currentY = content.scrollTop || window.scrollY;
    const delta = currentY - lastScrollY;

    if (delta > 8 && !navHidden && currentY > 60) {
      // Scrolling down → hide
      nav.classList.add('hidden');
      navHidden = true;
    } else if (delta < -8 && navHidden) {
      // Scrolling up → show
      nav.classList.remove('hidden');
      navHidden = false;
    }
    lastScrollY = currentY;
  };

  window.addEventListener('scroll', handler, { passive: true });
  content.addEventListener('scroll', handler, { passive: true });
}

function openNewDocSheet() {
  const existingOverlay = document.getElementById('bnav-sheet-overlay');
  if (existingOverlay) existingOverlay.remove();
  const existingSheet = document.getElementById('bnav-sheet');
  if (existingSheet) existingSheet.remove();

  const overlay = document.createElement('div');
  overlay.id = 'bnav-sheet-overlay';
  overlay.className = 'bnav-sheet-overlay';

  const sheet = document.createElement('div');
  sheet.id = 'bnav-sheet';
  sheet.className = 'bnav-sheet';

  sheet.innerHTML = `
    <div class="bnav-sheet-handle"></div>
    <div class="bnav-sheet-title">Crear Nuevo Documento</div>
    
    <button class="bnav-sheet-btn" data-kind="orden">
      <div class="bnav-sheet-icon" style="background:#e0f2fe;color:#0284c7;">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
        </svg>
      </div>
      <div>
        <div class="bnav-sheet-btn-label">Orden de Trabajo (OT)</div>
        <div class="bnav-sheet-btn-sub">Registrar o dar seguimiento a un servicio</div>
      </div>
    </button>

    <button class="bnav-sheet-btn" data-kind="cotizacion">
      <div class="bnav-sheet-icon" style="background:#fef9c3;color:#a16207;">
        <svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path>
        </svg>
      </div>
      <div>
        <div class="bnav-sheet-btn-label">Cotización (COT)</div>
        <div class="bnav-sheet-btn-sub">Generar presupuesto para cliente</div>
      </div>
    </button>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(sheet);

  const closeSheet = () => {
    sheet.classList.remove('visible');
    overlay.classList.remove('visible');
    setTimeout(() => {
      overlay.remove();
      sheet.remove();
    }, 300);
  };

  overlay.addEventListener('click', closeSheet);

  sheet.querySelectorAll('.bnav-sheet-btn').forEach(b => {
    b.addEventListener('click', () => {
      const kind = b.dataset.kind;
      window.location.hash = `/documentos/nuevo/${kind}`;
      closeSheet();
    });
  });

  requestAnimationFrame(() => {
    overlay.classList.add('visible');
    sheet.classList.add('visible');
  });
}
