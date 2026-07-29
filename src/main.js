import { initAuth, isLoggedIn, onAuthChange } from './lib/auth.js';
import { createRouter } from './lib/router.js';
import { loginView } from './views/login.js';
import { dashboardView } from './views/dashboard.js';
import { documentosListView, documentoDetalleView } from './views/documentos.jsx';
import { clientesListView, clienteDetalleView } from './views/clientes.js';
import { serviciosView } from './views/servicios.js';
import { inventarioView } from './views/inventario.js';
import { cuentasView } from './views/cuentas.js';
import { tareasView } from './views/tareas.js';
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
  '/impuestos':                   lazy(() => import(/* @vite-ignore */ './views/impuestos.js')),
  '/impuestos/ingresos':          lazy(() => import(/* @vite-ignore */ './views/impuestos-ingresos.js')),
  '/impuestos/gastos':            lazy(() => import(/* @vite-ignore */ './views/impuestos-gastos.js')),
  '/impuestos/declaraciones':     lazy(() => import(/* @vite-ignore */ './views/impuestos-declaraciones.js')),
  '/impuestos/correo':            lazy(() => import(/* @vite-ignore */ './views/impuestos-correo.js'))
}, { fallback: '/dashboard' });

router.beforeEach(({ path }) => {
  const logged = isLoggedIn();
  console.log(`beforeEach: path=${path}, logged=${logged}`);
  if (!logged && path !== '/login') return '/login';
  if (logged && path === '/login') return '/dashboard';
});

(async function bootstrap() {
  try {
    // No bloquear el arranque: inicializar auth en segundo plano
    initAuth().catch(() => {});
  } catch (e) {
    console.error('Auth init error:', e);
  }

  if (!window.location.hash) {
    window.location.hash = '/login';
  }

  onAuthChange(() => router.go(window.location.hash.slice(1) || '/dashboard'));
  router.start();
  try { document.body.setAttribute('data-app-mounted', '1'); } catch {}
})();