// App Shell: sidebar + topbar + content area (Premium Redesign)
// Views render inside #view-content.
import { signOut, getUser } from '../lib/auth.js';
import { initials, toast } from '../lib/utils.js';
import { LOGO_DATA_URL } from '../assets/logo.js';

const NAV_ITEMS = [
  { section: 'Gestión Principal', items: [
    { path: '/dashboard',     icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>', label: 'Dashboard' },
    { path: '/clientes',      icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>', label: 'Clientes' },
    { path: '/documentos',    icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Documentos' }
  ]},
  { section: 'Catálogos', items: [
    { path: '/servicios',     icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Servicios' },
    { path: '/inventario',    icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>', label: 'Productos' },
    { path: '/tareas',        icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Tareas' },
    { path: '/dispositivos',  icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>', label: 'Dispositivos' }
  ]},
  { section: 'Finanzas', items: [
    { path: '/cuentas',       icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg>', label: 'Cuentas y SINPE' }
  ]},
  { section: 'Impuestos', items: [
    { path: '/impuestos',              icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m7-9a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Panel Fiscal' },
    { path: '/impuestos/ingresos',     icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Ingresos' },
    { path: '/impuestos/gastos',       icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"></path></svg>', label: 'Gastos' },
    { path: '/impuestos/declaraciones',icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Declaraciones' },
    { path: '/impuestos/correo',       icon: '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>', label: 'Bandeja Facturas' }
  ]}
];

export function ensureShell(activePath) {
  const root = document.getElementById('app');
  let shell = document.getElementById('app-shell');

  if (!shell) {
    root.innerHTML = `
      <div class="app-shell" id="app-shell">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        <aside class="sidebar" id="app-sidebar">
          <div class="sidebar-brand">
            <img src="${LOGO_DATA_URL}" alt="INNOVIO" class="sidebar-brand-logo" id="sidebar-brand-logo-img" />
          </div>

          <button class="nav-cta" id="cta-nuevo">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4"/></svg>
            <span>Nuevo Documento</span>
          </button>

          <nav class="sidebar-menu" id="sidebar-menu"></nav>

          <div class="sidebar-footer" id="sidebar-footer"></div>
        </aside>

        <main class="main">
          <header class="topbar">
            <div style="display:flex;align-items:center;gap:12px;">
              <button class="topbar-toggle" id="topbar-toggle" title="Menú">
                <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <h1 class="topbar-title" id="view-title">—</h1>
            </div>
            <div class="topbar-actions" id="view-actions"></div>
          </header>
          <section class="content" id="view-content"></section>
        </main>
      </div>
    `;
    shell = document.getElementById('app-shell');

    // Inject sidebar overlay + toggle styles
    if (!document.getElementById('shell-extra-styles')) {
      const style = document.createElement('style');
      style.id = 'shell-extra-styles';
      style.textContent = `
        .sidebar-overlay {
          display: none;
          position: fixed; inset: 0;
          background: rgba(4,23,63,0.4);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          z-index: 499;
          transition: opacity 0.3s;
        }
        @media (max-width: 768px) {
          .sidebar-overlay.active { display: block; }
        }
        .topbar-toggle {
          display: none;
          align-items: center; justify-content: center;
          width: 38px; height: 38px;
          border-radius: 8px;
          border: 1.5px solid var(--border);
          background: var(--surface-2);
          color: var(--text-mid);
          cursor: pointer;
          transition: all 0.15s;
        }
        .topbar-toggle:hover { background: var(--surface); color: var(--navy); border-color: var(--text-soft); }
        @media (max-width: 768px) {
          .topbar-toggle { display: flex; }
        }
      `;
      document.head.appendChild(style);
    }

    // Mobile sidebar toggle
    document.getElementById('topbar-toggle').addEventListener('click', () => {
      const sidebar = document.getElementById('app-sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('active');
    });
    document.getElementById('sidebar-overlay').addEventListener('click', () => {
      document.getElementById('app-sidebar').classList.remove('open');
      document.getElementById('sidebar-overlay').classList.remove('active');
    });

    // CTA Nuevo Documento
    document.getElementById('cta-nuevo').addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById('cta-menu');
      if (existing) { existing.remove(); return; }

      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.id = 'cta-menu';

      menu.innerHTML = `
        <div style="padding:12px 18px;font-size:10px;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid var(--border-light);">Seleccionar Tipo</div>
        <button data-kind="orden" class="cta-menu-btn">
          <div style="margin-right:14px;display:flex;align-items:center;justify-content:center;background:#e0f2fe;color:#0284c7;width:38px;height:38px;border-radius:10px;"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg></div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">Orden de Trabajo</span>
            <span style="font-size:11px;font-weight:400;color:var(--text-soft);margin-top:1px;">Registrar un nuevo servicio</span>
          </div>
        </button>
        <button data-kind="cotizacion" class="cta-menu-btn">
          <div style="margin-right:14px;display:flex;align-items:center;justify-content:center;background:#fef9c3;color:#a16207;width:38px;height:38px;border-radius:10px;"><svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"></path></svg></div>
          <div style="display:flex;flex-direction:column;align-items:flex-start;">
            <span style="font-size:13.5px;font-weight:700;color:var(--text);">Cotización</span>
            <span style="font-size:11px;font-weight:400;color:var(--text-soft);margin-top:1px;">Generar un presupuesto</span>
          </div>
        </button>
      `;

      if (!document.getElementById('cta-menu-styles')) {
        const style = document.createElement('style');
        style.id = 'cta-menu-styles';
        style.textContent = `
          @keyframes ctaMenuFadeIn {
            from { opacity: 0; transform: translateY(-8px) scale(0.96); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `;
        document.head.appendChild(style);
      }

      menu.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.bottom + 10}px;
        width: 290px;
        background: var(--surface, #fff);
        border: 1px solid var(--border-light, #edf0f7);
        border-radius: 16px;
        box-shadow: 0 20px 48px rgba(13, 50, 112, 0.16), 0 8px 16px rgba(0,0,0,0.04);
        z-index: 99999;
        overflow: hidden;
        font-family: var(--font, 'Inter', sans-serif);
        animation: ctaMenuFadeIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        display: flex;
        flex-direction: column;
      `;

      menu.querySelectorAll('.cta-menu-btn').forEach((b, index) => {
        b.style.cssText = `
          display: flex;
          align-items: center;
          width: 100%;
          padding: 14px 18px;
          border: none;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition: all 0.15s;
          border-bottom: ${index === 0 ? '1px solid var(--border-light, #edf0f7)' : 'none'};
        `;
        b.addEventListener('mouseenter', () => { b.style.background = 'var(--surface-2, #f8f9fc)'; });
        b.addEventListener('mouseleave', () => { b.style.background = 'transparent'; });
        b.addEventListener('click', () => {
          window.location.hash = '/documentos/nuevo/' + b.dataset.kind;
          menu.remove();
        });
      });

      document.body.appendChild(menu);
      const closeMenu = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    });
  }

  // Dynamic nav menu with active state
  const menu = document.getElementById('sidebar-menu');
  menu.innerHTML = NAV_ITEMS.map(group => `
    <div class="nav-section">
      <div class="nav-section-title">${group.section}</div>
      ${group.items.map(it => `
        <button class="nav-item ${activePath === it.path ? 'active' : ''}" data-path="${it.path}">
          <span class="nav-item-icon">${it.icon}</span>
          <span>${it.label}</span>
        </button>
      `).join('')}
    </div>
  `).join('');
  menu.querySelectorAll('.nav-item').forEach(b => {
    b.addEventListener('click', () => {
      // Close mobile sidebar on nav
      document.getElementById('app-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('active');
      window.location.hash = b.dataset.path;
    });
  });

  // Footer with user
  const user = getUser();
  const footer = document.getElementById('sidebar-footer');
  if (user) {
    const name = user.user_metadata?.full_name || user.email || 'Usuario';
    footer.innerHTML = `
      <div class="user-chip">
        <div class="user-avatar">${initials(name)}</div>
        <div style="min-width:0; flex:1;">
          <div class="user-name">${name}</div>
          <div class="user-mail">${user.email || ''}</div>
        </div>
        <button class="btn-logout" id="btn-logout" title="Cerrar sesión">
          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    `;
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await signOut();
      window.location.hash = '/login';
    });
  } else {
    footer.innerHTML = '';
  }

  return {
    setTitle(t)   { document.getElementById('view-title').textContent = t; },
    setActions(html) { document.getElementById('view-actions').innerHTML = html || ''; },
    content:      () => document.getElementById('view-content')
  };
}
 