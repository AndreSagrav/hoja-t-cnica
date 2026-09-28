import { getSupabase, withTimeout } from '../lib/supabase.js';

const LOCAL_KEY_USERS = 'innovio_users_v1';
const LOCAL_KEY_ROLES = 'innovio_roles_v1';
const LOCAL_KEY_BRANDING = 'innovio_branding_v1';

const DEFAULT_USERS = [
  { id: 'usr-1', nombre: 'César', email: 'innoviocr@outlook.com', rol: 'admin', pin: '1234', activo: true, created_at: '2026-01-01' },
  { id: 'usr-2', nombre: 'Técnico Taller', email: 'taller@innovio.cr', rol: 'tecnico', pin: '5678', activo: true, created_at: '2026-03-15' },
  { id: 'usr-3', nombre: 'Ventas y Mostrador', email: 'ventas@innovio.cr', rol: 'ventas', pin: '0000', activo: true, created_at: '2026-05-10' }
];

export const DEFAULT_MODULES = [
  { id: 'dashboard',   label: 'Dashboard Principal', path: '/dashboard', icon: '📊' },
  { id: 'clientes',    label: 'Directorio de Clientes', path: '/clientes', icon: '👥' },
  { id: 'documentos',  label: 'Gestión de Documentos y Facturas', path: '/documentos', icon: '🧾' },
  { id: 'agenda',      label: 'Agenda y Calendario', path: '/agenda', icon: '📅' },
  { id: 'servicios',   label: 'Catálogo de Servicios', path: '/servicios', icon: '⚙️' },
  { id: 'inventario',  label: 'Inventario y Productos', path: '/inventario', icon: '📦' },
  { id: 'tareas',      label: 'Gestor de Tareas', path: '/tareas', icon: '✅' },
  { id: 'dispositivos',label: 'Control de Dispositivos', path: '/dispositivos', icon: '💻' },
  { id: 'cuentas',     label: 'Cuentas Bancarias y SINPE', path: '/cuentas', icon: '🏦' },
  { id: 'impuestos',   label: 'Panel Fiscal y Hacienda', path: '/impuestos', icon: '🏛️' }
];

const DEFAULT_ROLES = [
  {
    id: 'admin',
    nombre: 'Administrador General',
    descripcion: 'Acceso total y sin restricciones a todos los módulos y ajustes',
    permisos: {
      dashboard:   { ver: true, crear: true, editar: true, eliminar: true },
      clientes:    { ver: true, crear: true, editar: true, eliminar: true },
      documentos:  { ver: true, crear: true, editar: true, eliminar: true },
      agenda:      { ver: true, crear: true, editar: true, eliminar: true },
      servicios:   { ver: true, crear: true, editar: true, eliminar: true },
      inventario:  { ver: true, crear: true, editar: true, eliminar: true },
      tareas:      { ver: true, crear: true, editar: true, eliminar: true },
      dispositivos:{ ver: true, crear: true, editar: true, eliminar: true },
      cuentas:     { ver: true, crear: true, editar: true, eliminar: true },
      impuestos:   { ver: true, crear: true, editar: true, eliminar: true }
    }
  },
  {
    id: 'tecnico',
    nombre: 'Técnico de Taller',
    descripcion: 'Enfocado en diagnóstico, reparación de equipos y agenda de taller',
    permisos: {
      dashboard:   { ver: true, crear: false, editar: false, eliminar: false },
      clientes:    { ver: true, crear: true, editar: true, eliminar: false },
      documentos:  { ver: true, crear: true, editar: true, eliminar: false },
      agenda:      { ver: true, crear: true, editar: true, eliminar: true },
      servicios:   { ver: true, crear: false, editar: false, eliminar: false },
      inventario:  { ver: true, crear: false, editar: false, eliminar: false },
      tareas:      { ver: true, crear: true, editar: true, eliminar: true },
      dispositivos:{ ver: true, crear: true, editar: true, eliminar: false },
      cuentas:     { ver: false, crear: false, editar: false, eliminar: false },
      impuestos:   { ver: false, crear: false, editar: false, eliminar: false }
    }
  },
  {
    id: 'ventas',
    nombre: 'Ventas y Facturación',
    descripcion: 'Emisión de comprobantes, gestión de clientes y catálogo',
    permisos: {
      dashboard:   { ver: true, crear: false, editar: false, eliminar: false },
      clientes:    { ver: true, crear: true, editar: true, eliminar: false },
      documentos:  { ver: true, crear: true, editar: true, eliminar: false },
      agenda:      { ver: true, crear: true, editar: true, eliminar: false },
      servicios:   { ver: true, crear: false, editar: false, eliminar: false },
      inventario:  { ver: true, crear: false, editar: false, eliminar: false },
      tareas:      { ver: true, crear: true, editar: false, eliminar: false },
      dispositivos:{ ver: true, crear: false, editar: false, eliminar: false },
      cuentas:     { ver: true, crear: false, editar: false, eliminar: false },
      impuestos:   { ver: false, crear: false, editar: false, eliminar: false }
    }
  },
  {
    id: 'contador',
    nombre: 'Contador / Auditor',
    descripcion: 'Supervisión de finanzas, cuentas por cobrar y declaraciones fiscales',
    permisos: {
      dashboard:   { ver: true, crear: false, editar: false, eliminar: false },
      clientes:    { ver: true, crear: false, editar: false, eliminar: false },
      documentos:  { ver: true, crear: false, editar: false, eliminar: false },
      agenda:      { ver: false, crear: false, editar: false, eliminar: false },
      servicios:   { ver: true, crear: false, editar: false, eliminar: false },
      inventario:  { ver: true, crear: false, editar: false, eliminar: false },
      tareas:      { ver: false, crear: false, editar: false, eliminar: false },
      dispositivos:{ ver: false, crear: false, editar: false, eliminar: false },
      cuentas:     { ver: true, crear: true, editar: true, eliminar: false },
      impuestos:   { ver: true, crear: true, editar: true, eliminar: true }
    }
  }
];

export const DEFAULT_BRANDING = {
  logoUrl: '',
  logoSize: 120, // en px (60px a 220px)
  nombreComercial: 'INNOVIO',
  subtitulo: 'Sistema de Gestión Empresarial y Facturación',
  telefono: '8888-8888',
  email: 'contacto@innovio.cr',
  direccion: 'San José, Costa Rica',
  tipografia: 'Inter', // 'Inter', 'Plus Jakarta Sans', 'Outfit', 'JetBrains Mono'
  paletaActiva: 'ejecutivo', // 'ejecutivo', 'contraste', 'slate_dark', 'minimalista'
  sidebarBg: 'linear-gradient(180deg, #071f50 0%, #0d3270 50%, #092455 100%)',
  colores: {
    primario: '#00c2a8',
    secundario: '#0d3270',
    acento: '#10b981',
    fondo: '#07162c'
  },
  muestrasExtraidas: [], // Se puebla ÚNICAMENTE cuando el usuario sube una imagen real de logotipo
  formatoComprobante: 'carta', // 'carta', 'media_carta', 'pos_termico'
  plantillaEstilo: 'primario', // 'primario', 'contraste', 'minimalista'
  anchoTicketMm: 80,
  pieComprobante: 'Gracias por confiar en nuestros servicios. Garantía de 30 días.'
};

// ── Métodos de Usuarios ─────────────────────────────────────
export async function getUsuarios() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_USERS);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveUsuarios(DEFAULT_USERS);
  return DEFAULT_USERS;
}

export function saveUsuarios(users) {
  try {
    localStorage.setItem(LOCAL_KEY_USERS, JSON.stringify(users));
  } catch {}
}

export async function addUsuario(user) {
  const users = await getUsuarios();
  const newUser = {
    id: 'usr-' + Date.now(),
    nombre: user.nombre.trim(),
    email: user.email.trim(),
    rol: user.rol || 'tecnico',
    pin: user.pin || '1234',
    activo: user.activo !== false,
    created_at: new Date().toISOString().slice(0, 10)
  };
  users.push(newUser);
  saveUsuarios(users);
  return newUser;
}

export async function updateUsuario(id, updates) {
  const users = await getUsuarios();
  const idx = users.findIndex(u => u.id === id);
  if (idx !== -1) {
    users[idx] = { ...users[idx], ...updates };
    saveUsuarios(users);
    return users[idx];
  }
  return null;
}

export async function deleteUsuario(id) {
  const users = await getUsuarios();
  const filtered = users.filter(u => u.id !== id);
  saveUsuarios(filtered);
  return true;
}

// ── Métodos de Roles y Permisos ─────────────────────────────
export async function getRoles() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_ROLES);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveRoles(DEFAULT_ROLES);
  return DEFAULT_ROLES;
}

export function saveRoles(roles) {
  try {
    localStorage.setItem(LOCAL_KEY_ROLES, JSON.stringify(roles));
  } catch {}
}

export async function updateRolePermisos(roleId, permisos) {
  const roles = await getRoles();
  const role = roles.find(r => r.id === roleId);
  if (role) {
    role.permisos = permisos;
    saveRoles(roles);
    return role;
  }
  return null;
}

// ── Métodos de Identidad Visual y Comprobantes ─────────────
export async function getBranding() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_BRANDING);
    if (raw) {
      const parsed = JSON.parse(raw);
      applyThemeVariables(parsed);
      return parsed;
    }
  } catch {}
  saveBranding(DEFAULT_BRANDING);
  return DEFAULT_BRANDING;
}

export function saveBranding(branding) {
  try {
    localStorage.setItem(LOCAL_KEY_BRANDING, JSON.stringify(branding));
    applyThemeVariables(branding);
  } catch {}
}

export function applyThemeVariables(branding) {
  if (!branding) return;
  const root = document.documentElement;

  // 1. Tipografía Corporativa (aplica a todo el sistema, fuentes primarias y de visualización)
  if (branding.tipografia) {
    const fontName = branding.tipografia;
    const isMono = fontName.includes('Mono');
    const fontVal = isMono 
      ? `'${fontName}', 'SF Mono', monospace` 
      : `'${fontName}', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif`;

    root.style.setProperty('--font', fontVal);
    root.style.setProperty('--font-main', fontVal);
    root.style.setProperty('--font-display', fontVal);
    if (document.body) {
      document.body.style.fontFamily = fontVal;
    }
  }

  // 2. Fondo de Barra Lateral y Gradientes
  if (branding.sidebarBg) {
    root.style.setProperty('--sidebar-bg', branding.sidebarBg);
  }

  // 3. Colores Clave del Sistema
  if (branding.colores) {
    if (branding.colores.primario) {
      root.style.setProperty('--accent', branding.colores.primario);
      root.style.setProperty('--innovio-teal', branding.colores.primario);
      root.style.setProperty('--accent-dark', branding.colores.secundario || branding.colores.primario);
    }
    if (branding.colores.secundario) {
      root.style.setProperty('--navy', branding.colores.secundario);
      root.style.setProperty('--innovio-navy', branding.colores.secundario);
    }
    if (branding.colores.acento) {
      root.style.setProperty('--accent-alt', branding.colores.acento);
    }
  }

  // 4. Logotipo en la barra lateral (fijo y adaptado sin empujar la barra ni los botones)
  const sideLogo = document.getElementById('sidebar-brand-logo-img');
  if (sideLogo) {
    if (branding.logoUrl && sideLogo.src !== branding.logoUrl) {
      sideLogo.src = branding.logoUrl;
    }
    sideLogo.style.removeProperty('height');
    sideLogo.style.maxHeight = '52px';
  }
}
