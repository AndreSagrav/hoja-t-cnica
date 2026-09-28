/**
 * command-palette.js
 * Buscador global y paleta de comandos ejecutiva (Ctrl + K / Cmd + K).
 * Permite navegación instantánea y ejecución de acciones rápidas sin mouse.
 */

import { toggleTheme, getThemeIcon } from '../lib/theme.js';
import { toast } from '../lib/utils.js';

const COMMANDS = [
  // Módulos de Navegación
  { id: 'nav-dashboard', category: 'Navegación', title: 'Ir al Panel de Control (Dashboard)', path: '/dashboard', icon: '📊' },
  { id: 'nav-clientes', category: 'Navegación', title: 'Ir a Directorio de Clientes', path: '/clientes', icon: '👥' },
  { id: 'nav-documentos', category: 'Navegación', title: 'Ir a Documentos y Facturación', path: '/documentos', icon: '📄' },
  { id: 'nav-agenda', category: 'Navegación', title: 'Ir a la Agenda de Citas', path: '/agenda', icon: '📅' },
  { id: 'nav-servicios', category: 'Navegación', title: 'Ir al Catálogo de Servicios', path: '/servicios', icon: '🛠️' },
  { id: 'nav-inventario', category: 'Navegación', title: 'Ir al Control de Inventario', path: '/inventario', icon: '📦' },
  { id: 'nav-tareas', category: 'Navegación', title: 'Ir a Gestión de Tareas y OT', path: '/tareas', icon: '✅' },
  { id: 'nav-dispositivos', category: 'Navegación', title: 'Ir a Equipos y Dispositivos', path: '/dispositivos', icon: '💻' },
  { id: 'nav-cuentas', category: 'Navegación', title: 'Ir a Cuentas y Conciliación SINPE', path: '/cuentas', icon: '🏦' },
  { id: 'nav-impuestos', category: 'Navegación', title: 'Ir a Liquidación Fiscal D-104', path: '/impuestos', icon: '⚖️' },
  { id: 'nav-configuracion', category: 'Navegación', title: 'Ir a Configuración e Identidad Visual', path: '/configuracion', icon: '⚙️' },

  // Acciones Rápidas
  { id: 'act-factura', category: 'Acciones Rápidas', title: 'Crear Nueva Factura / Cotización', action: () => { window.location.hash = '/documentos/nuevo/cotizacion'; }, icon: '➕' },
  { id: 'act-orden', category: 'Acciones Rápidas', title: 'Crear Nueva Orden de Trabajo (OT)', action: () => { window.location.hash = '/documentos/nuevo/orden'; }, icon: '🔧' },
  { id: 'act-cliente', category: 'Acciones Rápidas', title: 'Registrar Nuevo Cliente', path: '/clientes', icon: '👤' },
  { id: 'act-theme', category: 'Acciones Rápidas', title: 'Alternar Tema Claro / Oscuro', action: () => {
    toggleTheme();
    const icon = getThemeIcon();
    const btn = document.getElementById('topbar-theme-toggle');
    if (btn) btn.innerHTML = icon;
    toast('Tema visual actualizado', 'info');
  }, icon: '🌓' }
];

let isOpen = false;
let selectedIndex = 0;
let filteredCommands = [...COMMANDS];

export function initCommandPalette() {
  if (document.getElementById('cmd-palette-root')) return;

  // Insertar contenedor modal en body
  const root = document.createElement('div');
  root.id = 'cmd-palette-root';
  root.style.display = 'none';

  root.innerHTML = `
    <style>
      .cmd-overlay {
        position: fixed; inset: 0;
        background: rgba(9, 13, 22, 0.65);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 99999;
        display: flex; align-items: flex-start; justify-content: center;
        padding-top: 14vh;
        animation: cmdFadeIn 0.15s ease-out;
      }
      @keyframes cmdFadeIn {
        from { opacity: 0; transform: scale(0.98); }
        to { opacity: 1; transform: scale(1); }
      }
      .cmd-modal {
        width: 100%; max-width: 600px;
        background: var(--surface, #ffffff);
        border: 1px solid var(--border, rgba(255,255,255,0.12));
        border-radius: 16px;
        box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35), 0 4px 16px rgba(0, 0, 0, 0.15);
        overflow: hidden;
        display: flex; flex-direction: column;
        margin: 0 16px;
        font-family: var(--font, sans-serif);
      }
      .cmd-header {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--border-light, #edf0f7);
      }
      .cmd-input {
        flex: 1; border: none; background: transparent;
        font-size: 16px; font-weight: 600; color: var(--text, #0f172a);
        outline: none; font-family: inherit;
      }
      .cmd-input::placeholder { color: var(--text-soft, #94a3b8); font-weight: 400; }
      .cmd-badge {
        font-size: 11px; font-weight: 700; font-family: monospace;
        padding: 3px 6px; border-radius: 6px;
        background: var(--surface-2, #f1f5f9); color: var(--text-soft, #64748b);
        border: 1px solid var(--border, #e2e8f0);
      }
      .cmd-list {
        max-height: 380px; overflow-y: auto;
        padding: 8px;
      }
      .cmd-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 14px; border-radius: 10px;
        cursor: pointer; transition: all 0.1s ease;
        margin-bottom: 2px;
      }
      .cmd-item:hover, .cmd-item.selected {
        background: var(--surface-2, #f1f5f9);
      }
      [data-theme="dark"] .cmd-item:hover, [data-theme="dark"] .cmd-item.selected {
        background: rgba(255, 255, 255, 0.08);
      }
      .cmd-item-left {
        display: flex; align-items: center; gap: 12px;
      }
      .cmd-item-icon {
        width: 32px; height: 32px; border-radius: 8px;
        background: var(--surface-3, #e2e8f0);
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; flex-shrink: 0;
      }
      [data-theme="dark"] .cmd-item-icon {
        background: rgba(255, 255, 255, 0.06);
      }
      .cmd-item-title {
        font-size: 14px; font-weight: 600; color: var(--text, #0f172a);
      }
      .cmd-item-cat {
        font-size: 11px; font-weight: 700; text-transform: uppercase;
        color: var(--text-soft, #94a3b8); letter-spacing: 0.5px;
      }
      .cmd-footer {
        padding: 10px 20px;
        background: var(--surface-2, #f8fafc);
        border-top: 1px solid var(--border-light, #edf0f7);
        display: flex; align-items: center; justify-content: space-between;
        font-size: 12px; color: var(--text-soft, #64748b);
      }
      .cmd-shortcuts {
        display: flex; align-items: center; gap: 14px;
      }
      .cmd-sc-item { display: flex; align-items: center; gap: 4px; }
    </style>

    <div class="cmd-overlay" id="cmd-overlay">
      <div class="cmd-modal" id="cmd-modal">
        <div class="cmd-header">
          <svg width="20" height="20" fill="none" stroke="var(--text-soft)" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input type="text" class="cmd-input" id="cmd-search-input" placeholder="Buscar módulo, cliente o ejecutar acción..." autofocus />
          <span class="cmd-badge">ESC</span>
        </div>
        <div class="cmd-list" id="cmd-list"></div>
        <div class="cmd-footer">
          <div class="cmd-shortcuts">
            <span class="cmd-sc-item"><span class="cmd-badge">↑↓</span> Navegar</span>
            <span class="cmd-sc-item"><span class="cmd-badge">↵</span> Seleccionar</span>
          </div>
          <span>INNOVIO Spotlight</span>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);

  // Eventos de teclado global (Ctrl + K y Cmd + K)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    } else if (e.key === 'Escape' && isOpen) {
      closeCommandPalette();
    } else if (isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % filteredCommands.length;
        renderList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
        renderList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      }
    }
  });

  // Evento clic en overlay para cerrar
  document.getElementById('cmd-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'cmd-overlay') closeCommandPalette();
  });

  // Búsqueda reactiva
  const input = document.getElementById('cmd-search-input');
  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    if (!q) {
      filteredCommands = [...COMMANDS];
    } else {
      filteredCommands = COMMANDS.filter(c => 
        c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)
      );
    }
    selectedIndex = 0;
    renderList();
  });
}

export function openCommandPalette() {
  const root = document.getElementById('cmd-palette-root');
  if (!root) {
    initCommandPalette();
  }
  const rootEl = document.getElementById('cmd-palette-root');
  if (rootEl) rootEl.style.display = 'block';
  isOpen = true;
  selectedIndex = 0;
  filteredCommands = [...COMMANDS];

  const input = document.getElementById('cmd-search-input');
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 50);
  }
  renderList();
}

export function closeCommandPalette() {
  const root = document.getElementById('cmd-palette-root');
  if (root) root.style.display = 'none';
  isOpen = false;
}

export function toggleCommandPalette() {
  if (isOpen) closeCommandPalette();
  else openCommandPalette();
}

function renderList() {
  const container = document.getElementById('cmd-list');
  if (!container) return;

  if (filteredCommands.length === 0) {
    container.innerHTML = `
      <div style="padding:32px 20px;text-align:center;color:var(--text-soft);font-size:13px;">
        No se encontraron comandos o pantallas para esa búsqueda.
      </div>
    `;
    return;
  }

  container.innerHTML = filteredCommands.map((c, i) => `
    <div class="cmd-item ${i === selectedIndex ? 'selected' : ''}" data-index="${i}">
      <div class="cmd-item-left">
        <div class="cmd-item-icon">${c.icon}</div>
        <div>
          <div class="cmd-item-title">${c.title}</div>
          <div class="cmd-item-cat">${c.category}</div>
        </div>
      </div>
      <span class="cmd-badge" style="opacity:${i === selectedIndex ? '1' : '0'};">↵</span>
    </div>
  `).join('');

  container.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => {
      selectedIndex = parseInt(el.dataset.index, 10);
      executeSelected();
    });
  });

  // Asegurar scroll visible del item seleccionado
  const selectedEl = container.querySelector('.cmd-item.selected');
  if (selectedEl) selectedEl.scrollIntoView({ block: 'nearest' });
}

function executeSelected() {
  const cmd = filteredCommands[selectedIndex];
  if (!cmd) return;
  closeCommandPalette();

  if (cmd.path) {
    window.location.hash = cmd.path;
  } else if (cmd.action) {
    cmd.action();
  }
}
