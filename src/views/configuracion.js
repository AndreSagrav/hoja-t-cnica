import { LOGO_DATA_URL } from '../assets/logo.js';
import { ensureShell } from '../components/shell.js';
import { 
  getUsuarios, addUsuario, updateUsuario, deleteUsuario, 
  getRoles, updateRolePermisos, DEFAULT_MODULES,
  getBranding, saveBranding, applyThemeVariables 
} from '../data/configuracion.js';
import { esc, toast } from '../lib/utils.js';
import { removeBackgroundAdvanced, autoTrimImage } from '../lib/image-processor.js';
import { extractPaletteFromImage, generateSchemes } from '../lib/color-extractor.js';
import { buildComprobanteHTML, getComprobanteCSS, SAMPLE_COMPROBANTE_DATA } from './comprobante.js';

let activeTab = 'branding'; // Empezar directamente en branding o usuarios
let activeRoleId = 'admin';

export async function configuracionView() {
  const shell = ensureShell('/configuracion');
  shell.setTitle('Configuración del Sistema');
  shell.setActions('');

  const container = shell.content();
  renderConfigLayout(container);
  await refreshActiveTab(container);
}

function renderConfigLayout(container) {
  container.innerHTML = `
    <style>
      .cfg-nav-tabs { display: flex; gap: 8px; border-bottom: 2px solid var(--border-light); margin-bottom: var(--sp-6); flex-wrap: wrap; }
      .cfg-tab-btn { padding: 12px 20px; font-size: 14px; font-weight: 700; color: var(--text-mid); background: transparent; border: none; border-bottom: 3px solid transparent; cursor: pointer; transition: color 0.15s ease, border-color 0.15s ease; display: flex; align-items: center; gap: 8px; }
      .cfg-tab-btn:hover { color: var(--navy); }
      .cfg-tab-btn.active { color: var(--navy); border-bottom-color: var(--accent); }

      .cfg-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-xl); padding: var(--sp-6); box-shadow: var(--shadow-sm); margin-bottom: var(--sp-6); box-sizing: border-box; }
      .cfg-title { font-size: 17px; font-weight: 800; color: var(--navy); margin-bottom: 4px; letter-spacing: -0.01em; }
      .cfg-sub { font-size: 13px; color: var(--text-soft); margin-bottom: var(--sp-5); line-height: 1.45; }

      /* Roles matrix table */
      .perm-table { width: 100%; border-collapse: collapse; text-align: left; margin-top: 14px; }
      .perm-table th { padding: 12px 16px; font-size: 11px; font-weight: 800; color: var(--text-soft); text-transform: uppercase; border-bottom: 2px solid var(--border-light); background: var(--surface-2); }
      .perm-table td { padding: 12px 16px; border-bottom: 1px solid var(--border-light); font-size: 13px; color: var(--text); }
      .perm-check { width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent); }

      /* Format preview cards */
      .fmt-card { border: 2px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease; text-align: center; box-sizing: border-box; background: var(--surface); }
      .fmt-card:hover { border-color: var(--accent); }
      .fmt-card.selected { border-color: var(--accent); background: rgba(0,194,168,0.05); }

      /* Scheme preview boxes */
      .scheme-card { border: 2px solid var(--border); border-radius: 12px; padding: 16px; cursor: pointer; transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease; display: flex; flex-direction: column; gap: 10px; box-sizing: border-box; background: var(--surface); position: relative; }
      .scheme-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: var(--shadow-md); }
      .scheme-card.selected { border-color: var(--accent); background: rgba(0,194,168,0.04); box-shadow: 0 0 0 1px var(--accent); }

      /* Typography cards */
      .font-card { border: 2px solid var(--border); border-radius: 12px; padding: 14px 18px; cursor: pointer; transition: border-color 0.15s ease, background-color 0.15s ease; box-sizing: border-box; background: var(--surface); display: flex; align-items: center; justify-content: space-between; }
      .font-card:hover { border-color: var(--accent); }
      .font-card.selected { border-color: var(--accent); background: rgba(0,194,168,0.05); }

      /* Checkerboard pattern for transparency */
      .checkerboard-bg {
        background-color: #ffffff;
        background-image: linear-gradient(45deg, #f0f2f5 25%, transparent 25%), 
                          linear-gradient(-45deg, #f0f2f5 25%, transparent 25%), 
                          linear-gradient(45deg, transparent 75%, #f0f2f5 75%), 
                          linear-gradient(-45deg, transparent 75%, #f0f2f5 75%);
        background-size: 16px 16px;
        background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
      }
    </style>

    <!-- Top Navigation Tabs (Formalizado) -->
    <div class="cfg-nav-tabs" id="cfg-tabs">
      <button class="cfg-tab-btn ${activeTab === 'branding' ? 'active' : ''}" data-tab="branding">
        Identidad Visual
      </button>
      <button class="cfg-tab-btn ${activeTab === 'usuarios' ? 'active' : ''}" data-tab="usuarios">
        Usuarios
      </button>
      <button class="cfg-tab-btn ${activeTab === 'roles' ? 'active' : ''}" data-tab="roles">
        Roles y Permisos
      </button>
    </div>

    <!-- Active Tab Container -->
    <div id="cfg-tab-content"></div>
  `;

  container.querySelectorAll('.cfg-tab-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      container.querySelectorAll('.cfg-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.dataset.tab;
      await refreshActiveTab(container);
    });
  });
}

async function refreshActiveTab(container) {
  const content = document.getElementById('cfg-tab-content');
  if (!content) return;

  if (activeTab === 'usuarios') {
    await renderUsuariosTab(content);
  } else if (activeTab === 'roles') {
    await renderRolesTab(content);
  } else if (activeTab === 'branding') {
    await renderBrandingTab(content);
  }
}

// ════════════════════════════════════════════════════════════
// TAB 1: GESTIÓN DE USUARIOS
// ════════════════════════════════════════════════════════════
async function renderUsuariosTab(box) {
  const users = await getUsuarios();

  box.innerHTML = `
    <div class="cfg-card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:var(--sp-4);">
        <div>
          <div class="cfg-title">Usuarios del Sistema</div>
          <div class="cfg-sub">Administre las cuentas con acceso, sus contraseñas, PINs de mostrador y estados de actividad.</div>
        </div>
        <button class="btn btn-primary" id="btn-nuevo-usuario" style="display:flex;align-items:center;gap:6px;">
          <span>＋</span> Agregar Usuario
        </button>
      </div>

      <div style="overflow-x:auto;">
        <table class="perm-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Correo Electrónico</th>
              <th>Rol Asignado</th>
              <th>PIN Rápido</th>
              <th>Estado</th>
              <th>Registrado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const rolLabel = u.rol === 'admin' ? 'Administrador' : (u.rol === 'tecnico' ? 'Técnico Taller' : (u.rol === 'ventas' ? 'Ventas' : 'Contador'));
              const rolBadgeColor = u.rol === 'admin' ? '#0284c7' : (u.rol === 'tecnico' ? '#10b981' : '#f59e0b');

              return `
                <tr>
                  <td style="font-weight:700;color:var(--navy);">
                    <div style="display:flex;align-items:center;gap:10px;">
                      <div style="width:34px;height:34px;border-radius:50%;background:rgba(0,194,168,0.15);color:var(--accent-dark);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;">
                        ${u.nombre.slice(0, 2).toUpperCase()}
                      </div>
                      <span>${esc(u.nombre)}</span>
                    </div>
                  </td>
                  <td style="color:var(--text-mid);">${esc(u.email)}</td>
                  <td>
                    <span style="font-size:11px;font-weight:800;padding:3px 8px;border-radius:6px;background:rgba(0,0,0,0.05);color:${rolBadgeColor};text-transform:uppercase;">
                      ${rolLabel}
                    </span>
                  </td>
                  <td style="font-family:monospace;font-size:13px;letter-spacing:2px;color:var(--text-soft);">
                    ${u.pin ? '•••• (' + u.pin + ')' : 'Sin PIN'}
                  </td>
                  <td>
                    <span style="font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px;background:${u.activo ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'};color:${u.activo ? '#10b981' : '#ef4444'};">
                      ${u.activo ? '✓ Activo' : '✕ Suspendido'}
                    </span>
                  </td>
                  <td style="color:var(--text-soft);font-size:12px;">${u.created_at || '—'}</td>
                  <td style="text-align:right;">
                    <div style="display:flex;justify-content:flex-end;gap:6px;">
                      <button class="btn btn-sm btn-secondary usr-toggle-btn" data-id="${u.id}" data-activo="${u.activo}" title="Cambiar estado">
                        ${u.activo ? 'Suspender' : 'Activar'}
                      </button>
                      <button class="btn btn-sm btn-secondary usr-delete-btn" data-id="${u.id}" style="color:#ef4444;" title="Eliminar usuario">
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Listeners de Usuarios
  box.querySelectorAll('.usr-toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const current = btn.dataset.activo === 'true';
      await updateUsuario(id, { activo: !current });
      toast('Estado de usuario actualizado', 'info');
      await renderUsuariosTab(box);
    });
  });

  box.querySelectorAll('.usr-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('¿Desea eliminar este usuario?')) {
        await deleteUsuario(btn.dataset.id);
        toast('Usuario eliminado', 'info');
        await renderUsuariosTab(box);
      }
    });
  });

  document.getElementById('btn-nuevo-usuario')?.addEventListener('click', async () => {
    const nombre = prompt('Nombre completo del usuario:');
    if (!nombre) return;
    const email = prompt('Correo electrónico:');
    if (!email) return;
    const rol = prompt('Rol (admin, tecnico, ventas, contador):', 'tecnico');
    const pin = prompt('PIN numérico de 4 dígitos:', '1234');

    await addUsuario({ nombre, email, rol, pin, activo: true });
    toast('Usuario agregado exitosamente', 'success');
    await renderUsuariosTab(box);
  });
}

// ════════════════════════════════════════════════════════════
// TAB 2: MATRIZ DE ROLES Y PERMISOS
// ════════════════════════════════════════════════════════════
async function renderRolesTab(box) {
  const roles = await getRoles();
  const currentRole = roles.find(r => r.id === activeRoleId) || roles[0];

  box.innerHTML = `
    <div class="cfg-card">
      <div class="cfg-title">Matriz de Control de Acceso (RBAC)</div>
      <div class="cfg-sub">Configure los privilegios de visualización y modificación por módulo para cada perfil corporativo.</div>

      <div style="display:flex;gap:8px;margin-bottom:var(--sp-4);flex-wrap:wrap;">
        ${roles.map(r => `
          <button class="btn ${r.id === activeRoleId ? 'btn-primary' : 'btn-secondary'} role-selector-btn" data-id="${r.id}">
            ${esc(r.nombre)}
          </button>
        `).join('')}
      </div>

      <div style="background:var(--surface-2);border-radius:12px;padding:16px;margin-bottom:var(--sp-5);">
        <div style="font-weight:700;font-size:14px;color:var(--navy);margin-bottom:2px;">${esc(currentRole.nombre)}</div>
        <div style="font-size:12px;color:var(--text-soft);">${esc(currentRole.descripcion)}</div>
      </div>

      <div style="overflow-x:auto;">
        <table class="perm-table">
          <thead>
            <tr>
              <th>Módulo</th>
              <th style="text-align:center;">Acceso / Lectura</th>
              <th style="text-align:center;">Creación y Modificación</th>
            </tr>
          </thead>
          <tbody>
            ${DEFAULT_MODULES.map(m => {
              const perm = currentRole.permisos[m.id] || { ver: false, editar: false };
              return `
                <tr>
                  <td style="font-weight:600;color:var(--navy);">${esc(m.label)}</td>
                  <td style="text-align:center;">
                    <input type="checkbox" class="perm-check perm-ver" data-mod="${m.id}" ${perm.ver ? 'checked' : ''} ${currentRole.id === 'admin' ? 'disabled' : ''} />
                  </td>
                  <td style="text-align:center;">
                    <input type="checkbox" class="perm-check perm-edit" data-mod="${m.id}" ${perm.editar ? 'checked' : ''} ${currentRole.id === 'admin' ? 'disabled' : ''} />
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${currentRole.id !== 'admin' ? `
        <div style="margin-top:var(--sp-5);display:flex;justify-content:flex-end;">
          <button class="btn btn-primary" id="btn-save-roles" style="padding:10px 20px;">
            Guardar Permisos del Rol
          </button>
        </div>
      ` : ''}
    </div>
  `;

  box.querySelectorAll('.role-selector-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      activeRoleId = btn.dataset.id;
      await renderRolesTab(box);
    });
  });

  document.getElementById('btn-save-roles')?.addEventListener('click', async () => {
    const updatedPerms = {};
    DEFAULT_MODULES.forEach(m => {
      const verCheck = box.querySelector(`.perm-ver[data-mod="${m.id}"]`);
      const editCheck = box.querySelector(`.perm-edit[data-mod="${m.id}"]`);
      updatedPerms[m.id] = {
        ver: verCheck ? verCheck.checked : false,
        editar: editCheck ? editCheck.checked : false
      };
    });

    await updateRolePermisos(activeRoleId, updatedPerms);
    toast(`Permisos actualizados para ${currentRole.nombre}`, 'success');
  });
}

// ════════════════════════════════════════════════════════════
// TAB 3: IDENTIDAD CORPORATIVA Y MARCA BLANCA (WHITE-LABEL)
// ════════════════════════════════════════════════════════════
async function renderBrandingTab(box) {
  const branding = await getBranding();
  const initialSnapshot = JSON.parse(JSON.stringify(branding));
  let rawUploadedImage = branding.logoUrl || LOGO_DATA_URL;
  if (!branding.logoSize) branding.logoSize = 120;
  if (!branding.formatoComprobante) branding.formatoComprobante = 'carta';
  if (!branding.plantillaEstilo) branding.plantillaEstilo = 'primario';
  if (!Array.isArray(branding.muestrasExtraidas)) branding.muestrasExtraidas = [];

  let activeDocFormatTab = branding.formatoComprobante || 'carta';

  // Extraer esquemas iniciales basados en los colores guardados
  let schemes = generateSchemes(branding.colores || { primario: '#00c2a8', secundario: '#0d3270', acento: '#10b981' });

  function renderView() {
    const hasMuestras = branding.muestrasExtraidas && branding.muestrasExtraidas.length > 0;

    box.innerHTML = `
      <!-- ENCABEZADO CON ACCIÓN RÁPIDA DE GUARDADO -->
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-5);flex-wrap:wrap;gap:12px;">
        <div>
          <h2 style="font-size:20px;font-weight:800;color:var(--navy);margin:0 0 4px 0;">Identidad Visual</h2>
          <div style="font-size:13px;color:var(--text-soft);">Configuración de logotipo, paleta de colores, tipografía y comprobantes.</div>
        </div>
        <button class="btn btn-secondary" id="btn-restore-snapshot-top" style="padding:10px 18px;font-weight:600;display:inline-flex;align-items:center;gap:6px;" title="Restaurar versión previa"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4M3 10l4-4m-4 4l4 4"/></svg>Restaurar Versión Anterior</button>
        <button class="btn btn-primary" id="btn-save-branding-top" style="padding:10px 22px;font-weight:700;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,194,168,0.25);">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
          Guardar Cambios
        </button>
      </div>

      <!-- SECCIÓN 1: PROCESAMIENTO Y GESTIÓN DE TAMAÑO DE LOGOTIPO -->
      <div class="cfg-card">
        <div class="cfg-title">1. Logotipo</div>
        <div class="cfg-sub">Archivo gráfico institucional, escala y remoción de fondo.</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-6);margin-bottom:var(--sp-4);">
          
          <!-- Contenedor de Previsualización Amplio con Fondo Damero -->
          <div style="border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:250px;background:#f8fafc;" class="checkerboard-bg">
            <div style="display:flex;align-items:center;justify-content:center;width:100%;height:180px;overflow:hidden;">
              <img id="branding-logo-preview" src="${branding.logoUrl || LOGO_DATA_URL}" style="height:${branding.logoSize}px;max-height:175px;max-width:90%;object-fit:contain;transition:all 0.15s ease;filter:drop-shadow(0 3px 10px rgba(0,0,0,0.12));" onerror="this.onerror=null;" />
            </div>
            <div style="font-weight:700;font-size:12px;color:var(--text-mid);margin-top:10px;">Vista previa</div>
            <div style="font-size:11px;color:var(--text-soft);" id="logo-status-tag">Escala: ${branding.logoSize}px</div>
          </div>

          <!-- Controles de Procesamiento y Tamaño -->
          <div style="display:flex;flex-direction:column;justify-content:center;gap:14px;">
            <input type="file" id="branding-file-input" accept="image/*" style="display:none;" />
            
            <div style="display:flex;gap:10px;">
              <button class="btn btn-secondary" id="btn-trigger-upload" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;">
                <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                Subir Logotipo
              </button>
              <button class="btn btn-secondary" id="btn-reset-logo" style="display:flex;align-items:center;justify-content:center;" title="Restablecer logotipo">
                Restablecer
              </button>
            </div>

            <!-- CONTROL DE TAMAÑO / ESCALA VISUAL DEL LOGO -->
            <div style="background:var(--surface-2);border:1px solid var(--border-light);border-radius:12px;padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:700;font-size:12.5px;color:var(--navy);">Tamaño del Logotipo</span>
                <span id="logo-size-val" style="font-size:12px;font-weight:800;font-family:monospace;color:var(--accent);">${branding.logoSize}px</span>
              </div>
              <input type="range" id="logo-size-slider" min="60" max="220" value="${branding.logoSize}" style="width:100%;margin-bottom:8px;accent-color:var(--accent);" />
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn-logo-size-preset" data-size="80" style="padding:3px 9px;font-size:10.5px;font-weight:600;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Compacto (80px)</button>
                <button class="btn-logo-size-preset" data-size="120" style="padding:3px 9px;font-size:10.5px;font-weight:600;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Estándar (120px)</button>
                <button class="btn-logo-size-preset" data-size="160" style="padding:3px 9px;font-size:10.5px;font-weight:600;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Grande (160px)</button>
                <button class="btn-logo-size-preset" data-size="200" style="padding:3px 9px;font-size:10.5px;font-weight:600;border:1px solid var(--border);border-radius:6px;background:var(--surface);cursor:pointer;">Máximo (200px)</button>
              </div>
            </div>

            <!-- Botón de Remoción de Fondo con Inteligencia de Cavidades -->
            <div style="background:var(--surface-2);border:1px solid var(--border-light);border-radius:12px;padding:14px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-weight:700;font-size:12.5px;color:var(--navy);">Remoción de Fondo</span>
                <span id="tolerance-val" style="font-size:11px;font-family:monospace;color:var(--text-soft);">Tolerancia: 32</span>
              </div>
              <input type="range" id="tolerance-slider" min="15" max="65" value="32" style="width:100%;margin-bottom:10px;accent-color:var(--accent);" />
              
              <button class="btn btn-primary" id="btn-remove-bg" style="width:100%;display:flex;align-items:center;justify-content:center;gap:8px;font-weight:700;padding:8px 14px;font-size:12.5px;">
                Remover Fondo
              </button>
              <div style="font-size:11px;color:var(--text-soft);margin-top:6px;line-height:1.4;">
                Detección automática de transparencia para encabezados e impresión.
              </div>
            </div>
          </div>

        </div>
      </div>

      <!-- SECCIÓN 2: PALETA CROMÁTICA EXTRAÍDA DE LA MARCA (SE EXTRAE DE LA IMAGEN SUBIDA) -->
      <div class="cfg-card">
        <div class="cfg-title">2. Paleta de Colores</div>
        <div class="cfg-sub">Definición de color primario, secundario y acento del sistema.</div>

        ${hasMuestras ? `
        <!-- Barra de Muestras Detectadas -->
        <div style="background:var(--surface-2);border:1px solid var(--border-light);border-radius:10px;padding:12px 16px;margin-bottom:var(--sp-4);" id="swatches-box-container">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-mid);">Muestras extraídas del logotipo:</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;" id="swatches-extracted-row">
              ${branding.muestrasExtraidas.map(hex => `
                <div class="swatch-chip" data-hex="${hex}" style="display:inline-flex;align-items:center;gap:6px;background:var(--surface);padding:4px 9px;border-radius:6px;border:1px solid var(--border);cursor:pointer;font-size:11.5px;font-family:monospace;color:var(--text);font-weight:600;" title="Asignar a Color Primario">
                  <span style="width:14px;height:14px;border-radius:3px;background:${hex};border:1px solid rgba(0,0,0,0.15);"></span>
                  <span>${hex}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        ` : ''}

        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:var(--sp-4);margin-bottom:var(--sp-4);" id="extracted-colors-box">
          
          <!-- Color Primario -->
          <div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface-2);text-align:center;">
            <div style="height:44px;border-radius:8px;background:${branding.colores.primario};margin-bottom:8px;border:1px solid rgba(0,0,0,0.1);" id="box-col-prim"></div>
            <div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:2px;">Color Primario</div>
            <div style="font-size:10.5px;color:var(--text-soft);margin-bottom:8px;">Acciones principales y acentos</div>
            
            ${hasMuestras ? `
              <select id="sel-col-prim" style="width:100%;padding:5px 6px;font-size:11.5px;border-radius:6px;border:1px solid var(--border);background:var(--surface);margin-bottom:8px;font-weight:600;">
                ${renderColorSelectOptions(branding.muestrasExtraidas, branding.colores.primario)}
              </select>
            ` : ''}

            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <input type="color" id="picker-col-prim" value="${branding.colores.primario}" style="width:26px;height:26px;border:none;background:none;cursor:pointer;" />
              <input type="text" id="val-col-prim" value="${branding.colores.primario}" style="width:80px;font-size:11px;font-family:monospace;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);" />
            </div>
          </div>

          <!-- Color Secundario -->
          <div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface-2);text-align:center;">
            <div style="height:44px;border-radius:8px;background:${branding.colores.secundario};margin-bottom:8px;border:1px solid rgba(0,0,0,0.1);" id="box-col-sec"></div>
            <div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:2px;">Color Secundario</div>
            <div style="font-size:10.5px;color:var(--text-soft);margin-bottom:8px;">Estructura y encabezados</div>
            
            ${hasMuestras ? `
              <select id="sel-col-sec" style="width:100%;padding:5px 6px;font-size:11.5px;border-radius:6px;border:1px solid var(--border);background:var(--surface);margin-bottom:8px;font-weight:600;">
                ${renderColorSelectOptions(branding.muestrasExtraidas, branding.colores.secundario)}
              </select>
            ` : ''}

            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <input type="color" id="picker-col-sec" value="${branding.colores.secundario}" style="width:26px;height:26px;border:none;background:none;cursor:pointer;" />
              <input type="text" id="val-col-sec" value="${branding.colores.secundario}" style="width:80px;font-size:11px;font-family:monospace;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);" />
            </div>
          </div>

          <!-- Color Acento -->
          <div style="border:1px solid var(--border);border-radius:12px;padding:14px;background:var(--surface-2);text-align:center;">
            <div style="height:44px;border-radius:8px;background:${branding.colores.acento};margin-bottom:8px;border:1px solid rgba(0,0,0,0.1);" id="box-col-acento"></div>
            <div style="font-size:12px;font-weight:800;color:var(--navy);margin-bottom:2px;">Color de Acento</div>
            <div style="font-size:10.5px;color:var(--text-soft);margin-bottom:8px;">Indicadores de estado</div>
            
            ${hasMuestras ? `
              <select id="sel-col-acento" style="width:100%;padding:5px 6px;font-size:11.5px;border-radius:6px;border:1px solid var(--border);background:var(--surface);margin-bottom:8px;font-weight:600;">
                ${renderColorSelectOptions(branding.muestrasExtraidas, branding.colores.acento)}
              </select>
            ` : ''}

            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <input type="color" id="picker-col-acento" value="${branding.colores.acento}" style="width:26px;height:26px;border:none;background:none;cursor:pointer;" />
              <input type="text" id="val-col-acento" value="${branding.colores.acento}" style="width:80px;font-size:11px;font-family:monospace;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:6px;background:var(--surface);" />
            </div>
          </div>

        </div>
      </div>

      <!-- SECCIÓN 3: ESQUEMAS VISUALES GLOBALES -->
      <div class="cfg-card">
        <div class="cfg-title">3. Tema del Sistema</div>
        <div class="cfg-sub">Combinaciones preconfiguradas para la navegación y paneles.</div>

        <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:var(--sp-4);margin-bottom:var(--sp-4);" id="schemes-container">
          ${renderSchemesCards(schemes, branding.paletaActiva)}
        </div>
      </div>

      <!-- SECCIÓN 4: CATÁLOGO TIPOGRÁFICO EMPRESARIAL (DESPLEGABLE LIMPIO Y COMPACTO) -->
      <div class="cfg-card">
        <div class="cfg-title">4. Tipografía</div>
        <div class="cfg-sub">Familia tipográfica para la plataforma y documentos.</div>

        <div style="display:flex;flex-direction:column;gap:12px;max-width:540px;">
          <div>
            <label style="font-size:11px;font-weight:700;color:var(--text-soft);text-transform:uppercase;margin-bottom:4px;display:block;">Familia Tipográfica</label>
            <select id="sel-typography" style="width:100%;padding:10px 14px;font-size:13.5px;font-weight:700;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--navy);cursor:pointer;outline:none;">
              <option value="Inter" ${(branding.tipografia || 'Inter') === 'Inter' ? 'selected' : ''}>Inter (Recomendada)</option>
              <option value="Plus Jakarta Sans" ${branding.tipografia === 'Plus Jakarta Sans' ? 'selected' : ''}>Plus Jakarta Sans</option>
              <option value="Outfit" ${branding.tipografia === 'Outfit' ? 'selected' : ''}>Outfit</option>
              <option value="Poppins" ${branding.tipografia === 'Poppins' ? 'selected' : ''}>Poppins</option>
              <option value="Montserrat" ${branding.tipografia === 'Montserrat' ? 'selected' : ''}>Montserrat</option>
              <option value="Roboto" ${branding.tipografia === 'Roboto' ? 'selected' : ''}>Roboto</option>
              <option value="Open Sans" ${branding.tipografia === 'Open Sans' ? 'selected' : ''}>Open Sans</option>
              <option value="Lato" ${branding.tipografia === 'Lato' ? 'selected' : ''}>Lato</option>
              <option value="Raleway" ${branding.tipografia === 'Raleway' ? 'selected' : ''}>Raleway</option>
              <option value="JetBrains Mono" ${branding.tipografia === 'JetBrains Mono' ? 'selected' : ''}>JetBrains Mono</option>
            </select>
          </div>

          <div style="padding:14px 18px;border-radius:10px;background:var(--surface-2);border:1px solid var(--border-light);">
            <div style="font-size:11px;font-weight:700;color:var(--text-soft);margin-bottom:6px;text-transform:uppercase;">Muestra:</div>
            <div id="typography-sample-text" style="font-size:15px;color:var(--navy);font-weight:700;line-height:1.4;font-family:'${branding.tipografia || 'Inter'}', sans-serif;">
              Aa Bb Gg 123 · Factura Electrónica #FAC-2026 · INNOVIO Costa Rica
            </div>
            <div style="font-size:12px;color:var(--text-mid);margin-top:4px;">
              Órdenes de servicio, comprobantes y analítica operativa. Total: ₡125.000,00
            </div>
          </div>
        </div>
      </div>

      <!-- SECCIÓN 5: COMPROBANTES Y FACTURACIÓN (CARTA, MEDIA PÁGINA Y POS - 3 OPCIONES REALES CADA UNO) -->
      <div class="cfg-card">
        <div class="cfg-title">5. Formatos de Comprobante</div>
        <div class="cfg-sub">Plantillas de salida para Carta, Media Página y Tiquete POS (80mm).</div>

        <!-- Pestañas de Formato de Documento -->
        <div style="display:flex;gap:8px;margin-bottom:var(--sp-4);border-bottom:1px solid var(--border);padding-bottom:10px;">
          <button class="doc-format-tab-btn ${activeDocFormatTab === 'carta' ? 'active' : ''}" data-fmt="carta" style="padding:8px 16px;font-size:13px;font-weight:700;border-radius:8px;border:1px solid ${activeDocFormatTab === 'carta' ? 'var(--accent)' : 'var(--border)'};background:${activeDocFormatTab === 'carta' ? 'rgba(0,194,168,0.1)' : 'var(--surface)'};color:${activeDocFormatTab === 'carta' ? 'var(--navy)' : 'var(--text-mid)'};cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            Carta (8.5" x 11")
          </button>
          <button class="doc-format-tab-btn ${activeDocFormatTab === 'media_carta' ? 'active' : ''}" data-fmt="media_carta" style="padding:8px 16px;font-size:13px;font-weight:700;border-radius:8px;border:1px solid ${activeDocFormatTab === 'media_carta' ? 'var(--accent)' : 'var(--border)'};background:${activeDocFormatTab === 'media_carta' ? 'rgba(0,194,168,0.1)' : 'var(--surface)'};color:${activeDocFormatTab === 'media_carta' ? 'var(--navy)' : 'var(--text-mid)'};cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            Media Página (5.5" x 8.5")
          </button>
          <button class="doc-format-tab-btn ${activeDocFormatTab === 'pos_termico' ? 'active' : ''}" data-fmt="pos_termico" style="padding:8px 16px;font-size:13px;font-weight:700;border-radius:8px;border:1px solid ${activeDocFormatTab === 'pos_termico' ? 'var(--accent)' : 'var(--border)'};background:${activeDocFormatTab === 'pos_termico' ? 'rgba(0,194,168,0.1)' : 'var(--surface)'};color:${activeDocFormatTab === 'pos_termico' ? 'var(--navy)' : 'var(--text-mid)'};cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            POS Térmico (80mm)
          </button>
        </div>

        <!-- Grid de 3 Opciones Cromáticas para el Formato Activo -->
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:18px;margin-bottom:var(--sp-6);" id="receipt-options-grid">
          ${renderReceiptStyleCards(activeDocFormatTab, branding)}
        </div>

        <!-- Barra de Acción Final -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:var(--sp-5);flex-wrap:wrap;gap:12px;">
          <div style="font-size:12px;color:var(--text-soft);">Parámetros sincronizados con los comprobantes y órdenes.</div>
          <button class="btn btn-secondary" id="btn-restore-snapshot-bottom" style="padding:12px 20px;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:6px;"><svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 10h10a5 5 0 015 5v2m0 0l-4-4m4 4l4-4M3 10l4-4m-4 4l4 4"/></svg>Restaurar Versión Anterior</button>
          <button class="btn btn-primary" id="btn-save-branding" style="padding:12px 28px;font-size:14px;font-weight:700;box-shadow:0 4px 14px rgba(0,194,168,0.25);">
            Guardar Cambios
          </button>
        </div>
      </div>
    `;

    attachAllEventListeners();
  }

  function renderColorSelectOptions(muestras, selectedHex) {
    if (!muestras || muestras.length === 0) return '';
    let opts = muestras.map((hex, idx) => `
      <option value="${hex}" ${hex.toLowerCase() === (selectedHex || '').toLowerCase() ? 'selected' : ''}>
        Color ${hex}
      </option>
    `).join('');

    const isCustom = !muestras.some(m => m.toLowerCase() === (selectedHex || '').toLowerCase());
    opts += `<option value="${selectedHex}" ${isCustom ? 'selected' : ''}>Personalizado: ${selectedHex}</option>`;
    return opts;
  }

  function attachAllEventListeners() {
    // Subida de imagen
    document.getElementById('btn-trigger-upload')?.addEventListener('click', () => {
      document.getElementById('branding-file-input').click();
    });

    document.getElementById('branding-file-input')?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (ev) => {
        let imgData = ev.target.result;
        try {
          imgData = await autoTrimImage(imgData);
        } catch (e) {
          console.warn('Trim fallback:', e);
        }
        rawUploadedImage = imgData;
        branding.logoUrl = imgData;
        document.getElementById('branding-logo-preview').src = imgData;
        document.getElementById('logo-status-tag').textContent = 'Imagen cargada y ajustada';

        // Extraer paleta automáticamente 100% de la imagen
        await processAndExtractPalette(imgData);
        applyThemeVariables(branding);
        updateReceiptPreviews();
      };
      reader.readAsDataURL(file);
    });

    // Control de tamaño de logotipo (Slider y Botones Preset)
    const logoSlider = document.getElementById('logo-size-slider');
    const logoImg = document.getElementById('branding-logo-preview');
    const logoVal = document.getElementById('logo-size-val');

    logoSlider?.addEventListener('input', (e) => {
      const size = parseInt(e.target.value, 10);
      branding.logoSize = size;
      if (logoImg) logoImg.style.height = size + 'px';
      if (logoVal) logoVal.textContent = size + 'px';
      applyThemeVariables(branding);
      updateReceiptPreviews();
    });

    box.querySelectorAll('.btn-logo-size-preset').forEach(btn => {
      btn.onclick = () => {
        const size = parseInt(btn.dataset.size, 10);
        branding.logoSize = size;
        if (logoSlider) logoSlider.value = size;
        if (logoImg) logoImg.style.height = size + 'px';
        if (logoVal) logoVal.textContent = size + 'px';
        applyThemeVariables(branding);
        updateReceiptPreviews();
      };
    });

    // Slider de tolerancia
    const slider = document.getElementById('tolerance-slider');
    slider?.addEventListener('input', (e) => {
      document.getElementById('tolerance-val').textContent = `Tolerancia: ${e.target.value}`;
    });

    // Botón de remoción inteligente de fondo
    document.getElementById('btn-remove-bg')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-remove-bg');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = 'Procesando contornos y cavidades...';

      try {
        const tolerance = parseInt(slider.value, 10) || 32;
        const cleanDataUrl = await removeBackgroundAdvanced(rawUploadedImage, { tolerance });
        
        branding.logoUrl = cleanDataUrl;
        document.getElementById('branding-logo-preview').src = cleanDataUrl;
        document.getElementById('logo-status-tag').textContent = 'Fondo removido con cavidades limpias';
        toast('Fondo removido exitosamente sin bordes pixelados', 'success');

        // Re-extraer colores del logo limpio
        await processAndExtractPalette(cleanDataUrl);

        applyThemeVariables(branding);
        updateReceiptPreviews();
      } catch (err) {
        toast('Error al procesar la imagen: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });

    // Botón de restablecer
    document.getElementById('btn-reset-logo')?.addEventListener('click', () => {
      branding.logoUrl = LOGO_DATA_URL;
      rawUploadedImage = LOGO_DATA_URL;
      branding.muestrasExtraidas = [];
      document.getElementById('branding-logo-preview').src = LOGO_DATA_URL;
      document.getElementById('logo-status-tag').textContent = 'Logotipo original de INNOVIO';
      renderView();
      applyThemeVariables(branding);
      toast('Logotipo restablecido al valor predeterminado', 'info');
    });

    // Muestras clickeables de la paleta
    box.querySelectorAll('.swatch-chip').forEach(chip => {
      chip.onclick = () => {
        const hex = chip.dataset.hex;
        branding.colores.primario = hex;
        document.getElementById('box-col-prim').style.background = hex;
        document.getElementById('picker-col-prim').value = hex;
        document.getElementById('val-col-prim').value = hex;
        schemes = generateSchemes(branding.colores);
        document.getElementById('schemes-container').innerHTML = renderSchemesCards(schemes, branding.paletaActiva);
        attachSchemeListeners();
        applyThemeVariables(branding);
        updateReceiptPreviews();
        toast(`Color ${hex} asignado a Color Primario`, 'info');
      };
    });

    // Selectores desplegables de color
    wireColorSelect('sel-col-prim', 'picker-col-prim', 'val-col-prim', 'box-col-prim', 'primario');
    wireColorSelect('sel-col-sec', 'picker-col-sec', 'val-col-sec', 'box-col-sec', 'secundario');
    wireColorSelect('sel-col-acento', 'picker-col-acento', 'val-col-acento', 'box-col-acento', 'acento');

    // Inputs de color manuales
    attachColorInput('picker-col-prim', 'val-col-prim', 'box-col-prim', 'primario', 'sel-col-prim');
    attachColorInput('picker-col-sec', 'val-col-sec', 'box-col-sec', 'secundario', 'sel-col-sec');
    attachColorInput('picker-col-acento', 'val-col-acento', 'box-col-acento', 'acento', 'sel-col-acento');

    // Esquemas cromáticos
    attachSchemeListeners();

    // Tipografía: Desplegable reactivo
    const selTypo = document.getElementById('sel-typography');
    selTypo?.addEventListener('change', (e) => {
      const selectedFont = e.target.value;
      branding.tipografia = selectedFont;
      
      const sampleText = document.getElementById('typography-sample-text');
      if (sampleText) {
        sampleText.style.fontFamily = `'${selectedFont}', sans-serif`;
      }
      
      applyThemeVariables(branding);
      updateReceiptPreviews();
      toast(`Tipografía '${selectedFont}' aplicada en todo el sistema`, 'info');
    });

    // Pestañas de Formato de Comprobante (Carta, Media Página, POS)
    box.querySelectorAll('.doc-format-tab-btn').forEach(btn => {
      btn.onclick = () => {
        activeDocFormatTab = btn.dataset.fmt;
        branding.formatoComprobante = activeDocFormatTab;
        box.querySelectorAll('.doc-format-tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = 'var(--border)';
          b.style.background = 'var(--surface)';
          b.style.color = 'var(--text-mid)';
        });
        btn.classList.add('active');
        btn.style.borderColor = 'var(--accent)';
        btn.style.background = 'rgba(0,194,168,0.1)';
        btn.style.color = 'var(--navy)';
        
        updateReceiptPreviews();
      };
    });

    wireReceiptCardActions();

    // Guardado persistente
    const doSave = () => {
      const currentSaved = getBranding();
      if (currentSaved) {
        localStorage.setItem('innovio_branding_backup', JSON.stringify(currentSaved));
      }
      saveBranding(branding);
      applyThemeVariables(branding);
      toast('Identidad corporativa, paleta y plantillas guardadas con éxito', 'success');
    };
    document.getElementById('btn-save-branding')?.addEventListener('click', doSave);
    document.getElementById('btn-save-branding-top')?.addEventListener('click', doSave);

    // Botones de Restaurar Versión Anterior
    const doRestoreSnapshot = () => {
      let backup = null;
      try {
        const raw = localStorage.getItem('innovio_branding_backup');
        if (raw) backup = JSON.parse(raw);
      } catch (e) {}

      if (!backup) backup = initialSnapshot;

      if (!backup) {
        toast('No hay versión previa para restaurar', 'warn');
        return;
      }

      Object.keys(branding).forEach(k => delete branding[k]);
      Object.assign(branding, JSON.parse(JSON.stringify(backup)));
      saveBranding(branding);
      applyThemeVariables(branding);
      renderView();
      toast('Configuración restaurada al estado anterior', 'info');
    };
    document.getElementById('btn-restore-snapshot-top')?.addEventListener('click', doRestoreSnapshot);
    document.getElementById('btn-restore-snapshot-bottom')?.addEventListener('click', doRestoreSnapshot);
  }

  function wireColorSelect(selectId, pickerId, valId, boxId, colorKey) {
    const sel = document.getElementById(selectId);
    sel?.addEventListener('change', (e) => {
      const hex = e.target.value;
      document.getElementById(valId).value = hex;
      document.getElementById(pickerId).value = hex;
      document.getElementById(boxId).style.background = hex;
      branding.colores[colorKey] = hex;
      schemes = generateSchemes(branding.colores);
      document.getElementById('schemes-container').innerHTML = renderSchemesCards(schemes, branding.paletaActiva);
      attachSchemeListeners();
      applyThemeVariables(branding);
      updateReceiptPreviews();
    });
  }

  function attachColorInput(pickerId, valId, boxId, colorKey, selectId) {
    const picker = document.getElementById(pickerId);
    const valInput = document.getElementById(valId);
    const boxEl = document.getElementById(boxId);
    const sel = document.getElementById(selectId);

    picker?.addEventListener('input', (e) => {
      const hex = e.target.value;
      valInput.value = hex;
      boxEl.style.background = hex;
      branding.colores[colorKey] = hex;
      if (sel) sel.value = hex;
      schemes = generateSchemes(branding.colores);
      document.getElementById('schemes-container').innerHTML = renderSchemesCards(schemes, branding.paletaActiva);
      attachSchemeListeners();
      applyThemeVariables(branding);
      updateReceiptPreviews();
    });

    valInput?.addEventListener('change', (e) => {
      const hex = e.target.value;
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        picker.value = hex;
        boxEl.style.background = hex;
        branding.colores[colorKey] = hex;
        if (sel) sel.value = hex;
        schemes = generateSchemes(branding.colores);
        document.getElementById('schemes-container').innerHTML = renderSchemesCards(schemes, branding.paletaActiva);
        attachSchemeListeners();
        applyThemeVariables(branding);
        updateReceiptPreviews();
      }
    });
  }

  function attachSchemeListeners() {
    box.querySelectorAll('.scheme-card').forEach(sc => {
      sc.addEventListener('click', () => {
        box.querySelectorAll('.scheme-card').forEach(c => c.classList.remove('selected'));
        sc.classList.add('selected');

        const schemeId = sc.dataset.scheme;
        branding.paletaActiva = schemeId;
        const currentScheme = schemes[schemeId];
        if (currentScheme) {
          branding.sidebarBg = currentScheme.sidebarBg;
          branding.colores.primario = currentScheme.accent;
          branding.colores.secundario = currentScheme.navy;
        }

        applyThemeVariables(branding);
        updateReceiptPreviews();
      });
    });
  }

  async function processAndExtractPalette(imgSource) {
    const res = await extractPaletteFromImage(imgSource);
    branding.colores = res.colores;
    branding.muestrasExtraidas = res.muestras || [res.colores.primario, res.colores.secundario, res.colores.acento];
    schemes = res.esquemas;

    // Re-renderizamos para actualizar chips y dropdowns basados en la imagen real
    renderView();
    applyThemeVariables(branding);
    updateReceiptPreviews();
    toast(`Paleta extraída exitosamente: ${branding.muestrasExtraidas.length} muestras detectadas`, 'success');
  }

  function updateReceiptPreviews() {
    const grid = document.getElementById('receipt-options-grid');
    if (grid) {
      grid.innerHTML = renderReceiptStyleCards(activeDocFormatTab, branding);
      wireReceiptCardActions();
    }
  }

  function wireReceiptCardActions() {
    // Selección de estilo
    box.querySelectorAll('.btn-select-receipt-style').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        branding.formatoComprobante = activeDocFormatTab;
        branding.plantillaEstilo = btn.dataset.style;
        updateReceiptPreviews();
        toast(`Plantilla '${btn.dataset.style}' seleccionada`, 'success');
      };
    });

    // Clic en la miniatura interactiva abre directamente el visor 1:1
    box.querySelectorAll('.receipt-miniature-container').forEach(cont => {
      cont.onclick = () => {
        openReceiptFullModal(activeDocFormatTab, cont.dataset.style, branding);
      };
    });

    // Vista previa en pantalla completa
    box.querySelectorAll('.btn-preview-receipt-modal').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        openReceiptFullModal(activeDocFormatTab, btn.dataset.style, branding);
      };
    });

    // Renderizar iframes con el comprobante oficial real aislado en modo escritorio 100%
    box.querySelectorAll('.receipt-card-iframe').forEach(iframe => {
      const stId = iframe.dataset.style;
      const styleBranding = { ...branding, plantillaEstilo: stId };
      const css = getComprobanteCSS(styleBranding);
      const bodyHtml = buildComprobanteHTML(SAMPLE_COMPROBANTE_DATA, styleBranding);

      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (doc) {
          doc.open();
          doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${css}
    /* Forzar modo escritorio completo en miniatura para evitar colapso a 1 columna */
    body { margin:0; padding:8px 0; background:#e6eaf0; display:flex; justify-content:center; overflow:hidden; }
    .comp-v2-page { min-height:auto; padding:0; background:transparent; width:850px; min-width:850px; transform:scale(0.27); transform-origin:top center; }
    .header-content { flex-direction: row !important; justify-content: space-between !important; }
    .header-right { text-align: right !important; align-items: flex-end !important; }
    .top-cards { grid-template-columns: 1fr 1fr !important; gap: 12px !important; }
    .tarea-group { grid-template-columns: repeat(4, 1fr) !important; }
    .totals-box { width: 300px !important; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`);
          doc.close();
        }
      } catch (err) {
        console.error('Error rendering receipt card preview:', err);
      }
    });
  }

  renderView();
}

// ── Renderizado de las 3 Opciones Cromáticas para el Comprobante Oficial ─────
function renderReceiptStyleCards(format, branding) {
  const styles = [
    {
      id: 'primario',
      nombre: 'Identidad Institucional',
      sub: 'Cabecera en degradado corporativo con colores del logo',
      tag: 'Recomendado'
    },
    {
      id: 'secundario',
      nombre: 'Contraste de Marca',
      sub: 'Cabecera profunda con el color secundario del logo',
      tag: 'Oficial'
    },
    {
      id: 'contraste',
      nombre: 'Moderno Bicolor',
      sub: 'Fondo blanco limpio editorial con líneas y detalles del logo',
      tag: 'Ecológico'
    }
  ];

  const activeStyle = branding.plantillaEstilo || 'primario';

  return styles.map(st => {
    const isSelected = (activeStyle === st.id);

    return `
      <div style="border:2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};border-radius:14px;padding:16px;background:var(--surface);display:flex;flex-direction:column;gap:12px;box-shadow:${isSelected ? '0 4px 16px rgba(0,194,168,0.18)' : 'var(--shadow-sm)'};transition:all 0.15s ease;">
        
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:13.5px;font-weight:800;color:var(--navy);">${st.nombre}</div>
            <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${st.sub}</div>
          </div>
          <span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:9999px;background:${isSelected ? 'var(--accent)' : 'var(--surface-2)'};color:${isSelected ? '#fff' : 'var(--text-soft)'};">
            ${isSelected ? 'Activa' : st.tag}
          </span>
        </div>

        <!-- Miniatura del Documento Oficial Real (Aislado en iframe) -->
        <div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;background:#e6eaf0;height:240px;position:relative;cursor:pointer;display:flex;justify-content:center;" class="receipt-miniature-container" data-style="${st.id}" title="Haga clic para ver documento a escala real (1:1)">
          <iframe class="receipt-card-iframe" data-style="${st.id}" style="width:100%;height:100%;border:none;pointer-events:none;background:#e6eaf0;"></iframe>
        </div>

        <!-- Botones de Acción -->
        <div style="display:flex;gap:8px;margin-top:auto;">
          <button class="btn ${isSelected ? 'btn-primary' : 'btn-secondary'} btn-select-receipt-style" data-style="${st.id}" style="flex:1;padding:7px 10px;font-size:11.5px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:4px;">
            ${isSelected ? 'Seleccionada' : 'Seleccionar'}
          </button>
          <button class="btn btn-secondary btn-preview-receipt-modal" data-style="${st.id}" style="padding:7px 10px;font-size:11.5px;font-weight:600;display:inline-flex;align-items:center;gap:4px;" title="Ver documento en pantalla completa">
            Vista previa
          </button>
        </div>

      </div>
    `;
  }).join('');
}

// ── Visor a Escala Real 1:1 Oficial (Hoja de Servicio / Orden de Trabajo Real) ─────
function openReceiptFullModal(initialFormat, initialStyleId, branding) {
  let currentSt = initialStyleId || branding.plantillaEstilo || 'primario';

  const modal = document.createElement('div');
  modal.className = 't1-drawer-overlay open';
  modal.style.display = 'flex';
  modal.style.flexDirection = 'column';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '999999';
  modal.style.background = 'rgba(15, 23, 42, 0.85)';
  modal.style.backdropFilter = 'blur(8px)';
  modal.style.padding = '16px';
  modal.style.position = 'fixed';
  modal.style.inset = '0';

  const styleNames = {
    primario: 'Identidad Institucional',
    secundario: 'Contraste de Marca',
    contraste: 'Moderno Bicolor'
  };

  function renderModalContent() {
    const styleBranding = {
      ...branding,
      plantillaEstilo: currentSt
    };
    const css = getComprobanteCSS(styleBranding);
    const bodyHtml = buildComprobanteHTML(SAMPLE_COMPROBANTE_DATA, styleBranding);

    modal.innerHTML = `
      <div style="background:var(--panel-bg);border-radius:14px;max-width:920px;width:100%;height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);border:1px solid var(--border);overflow:hidden;position:relative;">
        
        <!-- Barra Superior de Control del Visor 1:1 -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-bottom:1px solid var(--border);background:var(--surface);flex-wrap:wrap;gap:12px;">
          <div>
            <div style="font-size:11px;font-weight:800;color:var(--accent);text-transform:uppercase;letter-spacing:0.5px;">Vista Previa Oficial (Hoja de Servicio / Orden de Trabajo)</div>
            <div style="font-size:15px;font-weight:800;color:var(--navy);">
              ${styleNames[currentSt] || currentSt}
            </div>
          </div>

          <!-- Selector de estilo rápido dentro del visor -->
          <div style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-sm ${currentSt === 'primario' ? 'btn-primary' : 'btn-secondary'} btn-modal-style" data-style="primario" style="font-size:11.5px;padding:6px 12px;">Institucional</button>
            <button class="btn btn-sm ${currentSt === 'secundario' ? 'btn-primary' : 'btn-secondary'} btn-modal-style" data-style="secundario" style="font-size:11.5px;padding:6px 12px;">Contraste Marca</button>
            <button class="btn btn-sm ${currentSt === 'contraste' ? 'btn-primary' : 'btn-secondary'} btn-modal-style" data-style="contraste" style="font-size:11.5px;padding:6px 12px;">Moderno Bicolor</button>
            <button id="modal-receipt-close" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-soft);margin-left:12px;padding:0 4px;" title="Cerrar">✕</button>
          </div>
        </div>

        <!-- Área Central con Documento Oficial 1:1 Aislado -->
        <div style="flex:1;overflow:hidden;background:#e6eaf0;">
          <iframe id="modal-full-receipt-iframe" style="width:100%;height:100%;border:none;background:#e6eaf0;"></iframe>
        </div>

        <!-- Barra Inferior de Acciones del Visor -->
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid var(--border);background:var(--surface);flex-wrap:wrap;gap:12px;">
          <div style="font-size:12px;color:var(--text-soft);">
            Mostrando el comprobante oficial con tipografía y paleta seleccionada.
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button id="modal-receipt-confirm" class="btn btn-secondary" style="padding:9px 16px;font-weight:600;">
              Cerrar
            </button>
            <button id="modal-receipt-select-apply" class="btn btn-primary" style="padding:9px 20px;font-weight:700;">
              Usar Esta Plantilla
            </button>
          </div>
        </div>

      </div>
    `;

    // Render iframe content
    const iframe = modal.querySelector('#modal-full-receipt-iframe');
    if (iframe) {
      setTimeout(() => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    ${css}
    body { margin:0; padding:20px 0; background:#e6eaf0; display:flex; justify-content:center; }
    .comp-v2-page { min-height:auto; padding:0; background:transparent; width:100%; max-width:850px; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`);
            doc.close();
          }
        } catch (e) {
          console.error('Error writing modal iframe:', e);
        }
      }, 0);
    }

    // Modal listeners
    modal.querySelectorAll('.btn-modal-style').forEach(b => {
      b.onclick = () => {
        currentSt = b.dataset.style;
        renderModalContent();
      };
    });

    modal.querySelector('#modal-receipt-close').onclick = () => modal.remove();
    modal.querySelector('#modal-receipt-confirm').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

    modal.querySelector('#modal-receipt-select-apply').onclick = () => {
      branding.plantillaEstilo = currentSt;
      updateReceiptPreviews();
      toast(`Plantilla '${styleNames[currentSt]}' seleccionada y guardada`, 'success');
      modal.remove();
    };
  }

  renderModalContent();
  document.body.appendChild(modal);
}

function renderSchemesCards(schemes, activeId = 'ejecutivo') {
  return Object.values(schemes).map(s => `
    <div class="scheme-card ${s.id === activeId ? 'selected' : ''}" data-scheme="${s.id}">
      <div style="height:38px;border-radius:8px;background:${s.sidebarBg};display:flex;align-items:center;padding:0 12px;gap:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.1);">
        <div style="width:10px;height:10px;border-radius:50%;background:${s.accent};"></div>
        <div style="width:50px;height:5px;border-radius:3px;background:rgba(255,255,255,0.4);"></div>
      </div>
      <div>
        <div style="font-weight:800;font-size:13px;color:var(--navy);">${s.nombre}</div>
        <div style="font-size:11px;color:var(--text-soft);margin-top:2px;">${s.descripcion}</div>
      </div>
    </div>
  `).join('');
}
