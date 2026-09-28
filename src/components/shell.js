import { getCurrentCurrency, toggleGlobalCurrency, getExchangeRate } from '../lib/currency.js';
// App Shell: Executive Tier-1 Navigation System
// Modern Sidebar, Topbar with Command Palette (Ctrl+K), Live Status, and Currency Switcher.
import { signOut, getUser } from '../lib/auth.js';
import { initials, toast, esc } from '../lib/utils.js';
import { LOGO_DATA_URL } from '../assets/logo.js';
import { createBottomNav, updateBottomNavActive } from './bottom-nav.js';
import { initTheme, toggleTheme, getThemeIcon } from '../lib/theme.js';
import { initConnectivityBar } from './connectivity-bar.js';
import { initCommandPalette, openCommandPalette } from './command-palette.js';

const NAV_ITEMS = [
  { section: 'Gestión Principal', items: [
    { path: '/dashboard',     icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg>', label: 'Dashboard' },
    { path: '/clientes',      icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>', label: 'Clientes' },
    { path: '/documentos',    icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Documentos' },
    { path: '/agenda',        icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>', label: 'Agenda' }
  ]},
  { section: 'Operaciones & Catálogos', items: [
    { path: '/servicios',     icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Servicios' },
    { path: '/inventario',    icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>', label: 'Productos / Stock' },
    { path: '/tareas',        icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Tareas y OT' },
    { path: '/dispositivos',  icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>', label: 'Dispositivos' }
  ]},
  { section: 'Finanzas & Fiscal', items: [
    { path: '/cuentas',                icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"></path></svg>', label: 'Cuentas & SINPE' },
    { path: '/impuestos',              icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 7h6m0 10v-3m-3 3v-6m-3 6v-1m7-9a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Panel Fiscal' },
    { path: '/impuestos/ingresos',     icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>', label: 'Ingresos' },
    { path: '/impuestos/gastos',       icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"></path></svg>', label: 'Gastos' },
    { path: '/impuestos/declaraciones',icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>', label: 'Declaraciones' },
    { path: '/impuestos/correo',       icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>', label: 'Bandeja Facturas' }
  ]},
  { section: 'Sistema', items: [
    { path: '/configuracion',          icon: '<svg width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>', label: 'Configuración' }
  ]}
];

let currentCurrency = getCurrentCurrency();

export function ensureShell(activePath) {
  let branding = null;
  try {
    const raw = localStorage.getItem('innovio_branding');
    if (raw) branding = JSON.parse(raw);
  } catch {}
  const activeLogo = (branding && branding.logoUrl) ? branding.logoUrl : LOGO_DATA_URL;
  const companyName = (branding && branding.nombreComercial) ? branding.nombreComercial : 'INNOVIO';

  const root = document.getElementById('app');
  let shell = document.getElementById('app-shell');

  if (!shell) {
    root.innerHTML = `
      <div class="app-shell" id="app-shell">
        <div class="sidebar-overlay" id="sidebar-overlay"></div>
        
        <!-- SIDEBAR TIER-1 -->
        <aside class="sidebar" id="app-sidebar">
          
          <!-- Logotipo Corporativo Oficial -->
          <div class="sidebar-brand">
            <img src="${activeLogo}" alt="${esc(companyName)}" class="sidebar-brand-logo" id="sidebar-brand-logo-img" />
            <div class="sidebar-brand-mark" title="${esc(companyName)}">
              <span>IN</span>
            </div>
          </div>

          <!-- Acción Rápida: Nuevo Documento -->
          <button class="nav-cta" id="cta-nuevo">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            <span>Nuevo Documento</span>
          </button>

          <!-- Menú de Navegación Jerárquico -->
          <nav class="sidebar-menu" id="sidebar-menu"></nav>

          <!-- Footer con Perfil Ejecutivo -->
          <div class="sidebar-footer" id="sidebar-footer"></div>
        </aside>

        <!-- CONTENIDO PRINCIPAL -->
        <main class="main">
          
          <!-- TOPBAR EJECUTIVO -->
          <header class="topbar">
            
            <div class="topbar-left">
              <button class="sidebar-toggle-btn" id="btn-sidebar-toggle" title="Alternar barra lateral (Ctrl + B)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
              </button>
              <h1 class="topbar-title" id="view-title">—</h1>
            </div>

            <!-- Buscador Global Spotlight (Ctrl+K) -->
            <button class="topbar-spotlight-btn" id="btn-open-spotlight" title="Búsqueda global (Ctrl + K)">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span>Buscar en el sistema...</span>
              <span class="topbar-kbd">Ctrl K</span>
            </button>

            <!-- Utilidades del Sistema -->
            <div class="topbar-right">
              
              <!-- Indicador de Estatus en Vivo de Hacienda -->
              <div class="status-pill" title="Conexión en vivo con el Ministerio de Hacienda (Costa Rica)">
                <div class="status-dot-pulse"></div>
                <span>Hacienda Conectado</span>
              </div>

              <!-- Selector Rápido de Moneda (CRC / USD) -->
              <button class="currency-toggle-btn" id="btn-currency-toggle" title="Cambiar moneda principal (CRC / USD)">
                <span>${currentCurrency === 'CRC' ? '₡ CRC' : '$ USD'}</span>
              </button>

              <!-- Alternador de Tema Claro / Oscuro -->
              <button class="topbar-theme-toggle" id="topbar-theme-toggle" title="Alternar Modo Claro / Oscuro">
                ${getThemeIcon()}
              </button>

              <div class="topbar-actions" id="view-actions"></div>
            </div>
          </header>

          <section class="content" id="view-content"></section>
        </main>
      </div>
    `;
    shell = document.getElementById('app-shell');

    // Inicializar Paleta de Comandos Global (Ctrl+K)
    initCommandPalette();

    // Listener para el botón Spotlight del Topbar
    document.getElementById('btn-open-spotlight')?.addEventListener('click', () => {
      openCommandPalette();
    });

    // Smart Sidebar Toggle (Desktop collapse & Mobile drawer)
    const toggleSidebar = () => {
      const sb = document.getElementById('app-sidebar');
      const overlay = document.getElementById('sidebar-overlay');
      if (!sb) return;
      if (window.innerWidth <= 1024) {
        sb.classList.toggle('open');
        overlay?.classList.toggle('active');
      } else {
        sb.classList.toggle('collapsed');
        const isCollapsed = sb.classList.contains('collapsed');
        localStorage.setItem('innovio:sidebar-collapsed', isCollapsed ? '1' : '0');
      }
    };

    document.getElementById('btn-sidebar-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('active');
    });

    // Keyboard shortcut: Ctrl + B / Cmd + B to toggle sidebar
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Restore saved state
    if (localStorage.getItem('innovio:sidebar-collapsed') === '1') {
      document.getElementById('app-sidebar')?.classList.add('collapsed');
    }

    // Restaurar estado guardado de barra colapsada
    // Enforce clean, expanded enterprise sidebar
    localStorage.removeItem('innovio:sidebar-collapsed');
    document.getElementById('app-sidebar')?.classList.remove('collapsed');
  
    document.getElementById('btn-currency-toggle')?.addEventListener('click', () => {
      const next = toggleGlobalCurrency();
      const { bankRate } = getExchangeRate();
      const btn = document.getElementById('btn-currency-toggle');
      if (btn) btn.innerHTML = `<span>${next === 'CRC' ? '₡ CRC' : '$ USD'}</span>`;
      toast(`Moneda: ${next} (T.C. Efectivo BCCR+3%: ₡${bankRate})`, 'info');
    });

    // Topbar theme toggle
    document.getElementById('topbar-theme-toggle')?.addEventListener('click', () => {
      toggleTheme();
      const newIcon = getThemeIcon();
      document.getElementById('topbar-theme-toggle').innerHTML = newIcon;
    });

    // CTA Nuevo Documento Dropdown
    document.getElementById('cta-nuevo')?.addEventListener('click', (e) => {
      e.stopPropagation();
      const existing = document.getElementById('cta-menu');
      if (existing) { existing.remove(); return; }

      const btn = e.currentTarget;
      const rect = btn.getBoundingClientRect();
      const menu = document.createElement('div');
      menu.id = 'cta-menu';
      menu.style.cssText = `
        position: fixed;
        top: ${rect.bottom + 6}px;
        left: ${rect.left}px;
        width: 260px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(0,0,0,0.1));
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        z-index: 99999;
        overflow: hidden;
        font-family: var(--font, sans-serif);
        display: flex; flex-direction: column;
        animation: cmdFadeIn 0.15s ease-out;
      `;

      menu.innerHTML = `
        <div style="padding:10px 14px;font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid var(--border-light);">Tipo de Documento</div>
        <button data-kind="cotizacion" class="cta-drop-btn">
          <span style="font-size:18px;">📄</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">Factura / Cotización</div>
            <div style="font-size:11px;color:var(--text-soft);">Emisión con Hacienda v4.4</div>
          </div>
        </button>
        <button data-kind="orden" class="cta-drop-btn">
          <span style="font-size:18px;">🔧</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--text);">Orden de Trabajo (OT)</div>
            <div style="font-size:11px;color:var(--text-soft);">Hoja de servicio y taller</div>
          </div>
        </button>
      `;

      menu.querySelectorAll('.cta-drop-btn').forEach((b, idx) => {
        b.style.cssText = `
          display: flex; align-items: center; gap: 12px;
          padding: 12px 14px; border: none; background: transparent;
          cursor: pointer; text-align: left; transition: background 0.15s;
          border-bottom: ${idx === 0 ? '1px solid var(--border-light)' : 'none'};
        `;
        b.addEventListener('mouseenter', () => b.style.background = 'var(--surface-2)');
        b.addEventListener('mouseleave', () => b.style.background = 'transparent');
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

  // Menú dinámico con estilo Linear/Stripe
  const menu = document.getElementById('sidebar-menu');
  if (menu) {
    menu.innerHTML = NAV_ITEMS.map(group => `
      <div class="nav-section">
        <div class="nav-section-title">${group.section}</div>
        ${group.items.map(it => `
          <button class="nav-item ${activePath === it.path ? 'active' : ''}" data-path="${it.path}" data-tooltip="${it.label}">
            <span class="nav-item-icon">${it.icon}</span>
            <span>${it.label}</span>
          </button>
        `).join('')}
      </div>
    `).join('');

    menu.querySelectorAll('.nav-item').forEach(b => {
      b.addEventListener('click', () => {
        document.getElementById('app-sidebar')?.classList.remove('open');
        document.getElementById('sidebar-overlay')?.classList.remove('active');
        window.location.hash = b.dataset.path;
      });
    });
  }

  // Footer con Perfil Ejecutivo
  const user = getUser() || { user_metadata: { full_name: 'César' } };
  const footer = document.getElementById('sidebar-footer');
  if (footer) {
    const name = user.user_metadata?.full_name || 'César';
    footer.innerHTML = `
      <div class="sidebar-footer-inner">
        <div class="sidebar-user-info" id="user-profile-trigger">
          <div class="sidebar-user-avatar">
            ${initials(name)}
          </div>
          <div class="sidebar-user-meta">
            <div class="sidebar-user-name">${esc(name)}</div>
            <div class="sidebar-user-role">Administrador</div>
          </div>
        </div>
        <button id="btn-logout-exec" class="sidebar-logout-btn" title="Cerrar sesión">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    `;

    document.getElementById('btn-logout-exec')?.addEventListener('click', async () => {
      if (confirm('¿Desea cerrar la sesión actual?')) {
        await signOut();
        window.location.hash = '/login';
      }
    });
  }

  // Update bottom nav for mobile devices
  updateBottomNavActive(activePath);

  return {
    setTitle(title) {
      const el = document.getElementById('view-title');
      if (el) el.textContent = title;
      document.title = `${title} — INNOVIO`;
    },
    setActions(html) {
      const el = document.getElementById('view-actions');
      if (el) el.innerHTML = html;
    },
    content() {
      return document.getElementById('view-content');
    }
  };
}
