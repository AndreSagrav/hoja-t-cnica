import { initAuth, isLoggedIn, onAuthChange } from './lib/auth.js';
import { getSupabase, withTimeout } from './lib/supabase.js';
import { createRouter } from './lib/router.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { documentosListView, documentoDetalleView } from './views/documentos.jsx';
import { clientesListView, clienteDetalleView } from './views/clientes.js';
import { serviciosView } from './views/servicios.js';
import { inventarioView } from './views/inventario.js';
import { cuentasView } from './views/cuentas.js';
import { tareasView, initTareasData } from './views/tareas.js';
import { dispositivosView } from './views/dispositivos.js';
import { editorNuevoView, editorEditarView } from './views/editor.js';
import { wizardNuevoView } from './views/wizard.js';
import { comprobantePreviewView, comprobanteDocumentoView } from './views/comprobante.js';
import { asistenteOTView } from './views/asistente-ot.js';

// Lazy-load tax module views — only downloaded when user navigates there
const lazy = (loader) => async (...args) => {
  const mod = await loader();
  const fn = Object.values(mod).find(v => typeof v === 'function');
  return fn(...args);
};

const router = createRouter({
  '/login':                       () => loginView({ onSuccess: () => router.go('/dashboard') }),
  '/dashboard':                   dashboardView,
  '/documentos':                  documentosListView,
  '/documentos/nuevo':            () => wizardNuevoView({ kind: 'orden' }),
  '/documentos/nuevo/:kind':      ({ kind }) => wizardNuevoView({ kind }),
  '/documentos/:id':              documentoDetalleView,
  '/documentos/:id/editar':       editorEditarView,
  '/documentos/:id/comprobante':  comprobanteDocumentoView,
  '/comprobante/preview':         comprobantePreviewView,
  '/clientes':                    clientesListView,
  '/clientes/:id':                clienteDetalleView,
  '/servicios':                   serviciosView,
  '/inventario':                  inventarioView,
  '/cuentas':                     cuentasView,
  '/tareas':                      tareasView,
  '/dispositivos':                dispositivosView,
  '/asistente-ot':              asistenteOTView,
  '/impuestos':                   lazy(() => import('./views/impuestos.js')),
  '/impuestos/ingresos':          lazy(() => import('./views/impuestos-ingresos.js')),
  '/impuestos/gastos':            lazy(() => import('./views/impuestos-gastos.js')),
  '/impuestos/declaraciones':     lazy(() => import('./views/impuestos-declaraciones.js')),
  '/impuestos/correo':            lazy(() => import('./views/impuestos-correo.js'))
}, { fallback: '/login' });

router.beforeEach(({ path }) => {
  const logged = isLoggedIn();
  if (!logged && path !== '/login') return '/login';
});

(async function bootstrap() {
  try { document.body.setAttribute('data-app-mounted', '1'); } catch {}

  try {
    await initAuth();
    // Pre-cargar tareas en segundo plano
    initTareasData().catch(err => console.warn('Failed pre-loading tasks:', err));
  } catch (e) {
    console.error('Auth init error:', e);
  }

  // Force login view on fresh load / refresh
  window.location.hash = '/login';

  onAuthChange((user) => {
    if (user) router.go('/dashboard');
  });
  router.start();
  router.go('/login');



  // ── Keep-Alive Heartbeat ─────────────────────────────────
  // Ping Supabase every 4 mins to keep session & DB warm
  let keepAliveTimer = null;

  async function pingKeepAlive() {
    if (!isLoggedIn() || document.visibilityState === 'hidden') return;
    try {
      const supabase = await getSupabase();
      await withTimeout(supabase.from('clientes').select('id', { count: 'exact', head: true }).limit(1), 4000);
    } catch (_) {}
  }

  function startKeepAlive() {
    if (keepAliveTimer) clearInterval(keepAliveTimer);
    keepAliveTimer = setInterval(pingKeepAlive, 4 * 60 * 1000);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      pingKeepAlive();
      startKeepAlive();
    } else if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
    }
  });

  startKeepAlive();
})();