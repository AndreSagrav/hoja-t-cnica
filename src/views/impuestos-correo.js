// ============================================================
// INNOVIO — Bandeja de Facturas (Premium Redesign)
// Importación automática de XMLs vía correo IMAP
// ============================================================

import { ensureShell } from '../components/shell.js';
import { parseComprobanteXML, clasificarComprobante } from '../lib/xml-parser.js';
import { calcularMontos, formatColones } from '../lib/tax-engine.js';
import { toast } from '../lib/utils.js';
import { fetchTaxData, saveSingleTaxRecord } from '../lib/tax-data.js';

let facturas = [];
let eventSource = null;
let filterTipo = 'todos'; // 'todos' | 'ingreso' | 'gasto'
let searchQuery = '';
let currentPage = 1;
const PAGE_SIZE = 15;
let autoRefreshTimer = null;
let sseReconnectTimer = null;
let sortDirection = 'desc'; // 'desc' = más reciente primero, 'asc' = más antiguo primero

export function impuestosCorreoView() {
  // Reset filters on every navigation to this view
  searchQuery = '';
  filterTipo = 'todos';
  currentPage = 1;
  sortDirection = 'desc';

  const shell = ensureShell('/impuestos/correo');
  shell.setTitle('Bandeja de Facturas');
  shell.setActions('');
  const content = shell.content();

  content.innerHTML = `
    <style>
      /* ── Premium Bandeja Styles v3 ── */
      .bf-container { padding: 16px 20px; max-width: 1280px; }
      
      /* Header */
      .bf-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
      .bf-title { font-size: 18px; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.5px; }
      .bf-subtitle { color: var(--text-soft); margin: 2px 0 0; font-size: 11px; letter-spacing: 0.1px; }
      .bf-actions { display: flex; gap: 8px; align-items: center; }
      .bf-btn { height: 32px; padding: 0 14px; border-radius: var(--r-md); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.25s var(--ease-spring); display: flex; align-items: center; gap: 6px; border: none; font-family: var(--font); position: relative; overflow: hidden; }
      .bf-btn::before { content: ''; position: absolute; top: 0; left: -100%; width: 100%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); transition: left 0.5s ease; }
      .bf-btn:hover::before { left: 100%; }
      .bf-btn-primary { background: var(--grad-accent); color: white; box-shadow: 0 2px 10px rgba(0,194,168,0.25); }
      .bf-btn-primary:hover { box-shadow: 0 6px 20px rgba(0,194,168,0.35); transform: translateY(-2px); }
      .bf-btn-ghost { background: var(--surface); color: var(--text-mid); border: 1px solid var(--border); }
      .bf-btn-ghost:hover { background: var(--bg-subtle); border-color: var(--accent); color: var(--accent); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
      
      /* KPI Strip */
      .bf-kpi-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 12px; }
      .bf-kpi { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); padding: 12px 14px; position: relative; overflow: hidden; transition: all 0.3s var(--ease-spring); animation: bfKpiEnter 0.5s var(--ease-out) backwards; }
      .bf-kpi:nth-child(1) { animation-delay: 0.05s; }
      .bf-kpi:nth-child(2) { animation-delay: 0.1s; }
      .bf-kpi:nth-child(3) { animation-delay: 0.15s; }
      .bf-kpi:nth-child(4) { animation-delay: 0.2s; }
      @keyframes bfKpiEnter { from { opacity: 0; transform: translateY(12px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .bf-kpi:hover { box-shadow: var(--shadow-md); transform: translateY(-3px); }
      .bf-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; border-radius: var(--r-lg) var(--r-lg) 0 0; transition: height 0.3s ease; }
      .bf-kpi:hover::before { height: 4px; }
      .bf-kpi.kpi-total::before { background: var(--grad-navy); }
      .bf-kpi.kpi-ingreso::before { background: linear-gradient(90deg, #1b5e20, #66bb6a); }
      .bf-kpi.kpi-gasto::before { background: linear-gradient(90deg, #c0392b, #ef5350); }
      .bf-kpi.kpi-iva::before { background: var(--grad-accent); }
      .bf-kpi-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-soft); margin-bottom: 5px; }
      .bf-kpi-value { font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -0.5px; line-height: 1; font-variant-numeric: tabular-nums; }
      .bf-kpi-count { font-size: 9px; color: var(--text-soft); margin-top: 4px; }
      
      /* Status + Search Bar */
      .bf-toolbar { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
      .bf-status-pill { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: var(--r-full); font-size: 10px; font-weight: 600; background: var(--surface); border: 1px solid var(--border); white-space: nowrap; transition: all 0.2s ease; }
      .bf-status-pill:hover { box-shadow: var(--shadow-sm); }
      .bf-pulse { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; position: relative; }
      .bf-pulse.online { background: #43a047; }
      .bf-pulse.online::after { content: ''; position: absolute; inset: -3px; border-radius: 50%; background: rgba(67,160,71,0.3); animation: bf-pulse-ring 2s ease-out infinite; }
      .bf-pulse.offline { background: #c0392b; }
      @keyframes bf-pulse-ring { 0% { transform: scale(0.8); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
      
      .bf-search-wrap { flex: 1; position: relative; }
      .bf-search { width: 100%; height: 30px; padding: 0 12px 0 32px; border-radius: var(--r-md); border: 1.5px solid var(--border); background: var(--surface); font-size: 11px; font-family: var(--font); color: var(--text); transition: all 0.25s ease; outline: none; }
      .bf-search:focus { border-color: var(--accent); box-shadow: var(--focus); background: white; }
      .bf-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--text-soft); pointer-events: none; }
      
      .bf-filter-group { display: flex; background: var(--surface-3); border-radius: var(--r-md); padding: 2px; gap: 2px; }
      .bf-filter-btn { padding: 5px 12px; font-size: 10px; font-weight: 600; background: transparent; color: var(--text-mid); cursor: pointer; border: none; font-family: var(--font); transition: all 0.25s var(--ease-spring); border-radius: var(--r-sm); }
      .bf-filter-btn.active { background: var(--surface); color: var(--navy); box-shadow: var(--shadow-sm); font-weight: 700; }
      .bf-filter-btn:hover:not(.active) { color: var(--text); background: rgba(255,255,255,0.5); }
      
      .bf-sort-btn { display: flex; align-items: center; gap: 5px; padding: 5px 10px; font-size: 10px; font-weight: 600; background: var(--surface); color: var(--text-mid); cursor: pointer; border: 1px solid var(--border); font-family: var(--font); border-radius: var(--r-md); transition: all 0.2s ease; white-space: nowrap; }
      .bf-sort-btn:hover { border-color: var(--accent); color: var(--accent); }
      
      /* Drop zone — compact collapsible */
      .bf-drop-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 0; font-size: 12px; color: var(--text-soft); cursor: pointer; transition: color 0.2s ease; margin-bottom: 8px; font-weight: 500; }
      .bf-drop-toggle:hover { color: var(--accent); }
      .bf-drop-toggle svg { transition: transform 0.25s var(--ease-spring); }
      .bf-drop-toggle.open svg { transform: rotate(90deg); }
      .bf-drop-zone { display: none; border: 2px dashed var(--border); border-radius: var(--r-lg); padding: 20px 16px; text-align: center; margin-bottom: 12px; transition: all 0.3s var(--ease-spring); cursor: pointer; background: linear-gradient(135deg, rgba(244,246,251,0.5), var(--surface)); }
      .bf-drop-zone.visible { display: block; animation: bfDropEnter 0.3s var(--ease-spring); }
      @keyframes bfDropEnter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      .bf-drop-zone.dragover { border-color: var(--accent); background: rgba(0,194,168,0.06); transform: scale(1.01); box-shadow: 0 0 24px rgba(0,194,168,0.1); }
      .bf-drop-zone p { margin: 0; font-size: 12px; color: var(--text-soft); }
      .bf-drop-zone .drop-icon { font-size: 24px; margin-bottom: 6px; filter: saturate(0.8); }
      
      /* Table */
      .bf-table { width: 100%; border-collapse: separate; border-spacing: 0; }
      .bf-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); overflow-x: auto; box-shadow: var(--shadow-xs); }
      .bf-table thead th { padding: 8px 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-soft); background: linear-gradient(180deg, var(--surface-2), var(--surface-3)); text-align: left; border-bottom: 2px solid var(--border); white-space: nowrap; }
      .bf-table thead th:last-child { text-align: right; }
      .bf-table tbody tr { transition: all 0.2s ease; }
      .bf-table tbody tr:hover { background: rgba(0,194,168,0.04); }
      .bf-table tbody tr:nth-child(even) { background: rgba(244,246,251,0.4); }
      .bf-table tbody tr:nth-child(even):hover { background: rgba(0,194,168,0.06); }
      .bf-table tbody tr:not(:last-child) td { border-bottom: 1px solid var(--border-light); }
      .bf-table td { padding: 8px 12px; font-size: 12px; color: var(--text); vertical-align: middle; }
      .bf-table td:last-child { text-align: right; }
      
      .bf-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: var(--r-full); font-size: 10px; font-weight: 700; position: relative; overflow: hidden; }
      .bf-badge::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 1px 0 rgba(255,255,255,0.3); pointer-events: none; }
      .bf-badge.ingreso { background: linear-gradient(135deg, rgba(27,94,32,0.12), rgba(76,175,80,0.06)); color: #1b5e20; }
      .bf-badge.gasto { background: linear-gradient(135deg, rgba(192,57,43,0.12), rgba(239,83,80,0.06)); color: #c0392b; }
      .bf-badge.desconocido { background: var(--surface-3); color: var(--text-soft); }
      
      .bf-tipo-doc { display: inline-block; padding: 2px 8px; border-radius: var(--r-sm); font-size: 9px; font-weight: 700; letter-spacing: 0.5px; background: linear-gradient(135deg, rgba(26,79,160,0.08), rgba(26,79,160,0.04)); color: var(--blue); }
      
      .bf-emisor { font-weight: 600; color: var(--text); display: block; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .bf-file-name { font-size: 10px; color: var(--text-soft); display: block; max-width: 280px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px; }
      
      .bf-amount { font-size: 13px; font-weight: 800; color: var(--text); letter-spacing: -0.3px; font-variant-numeric: tabular-nums; }
      .bf-amount.ingreso { color: #1b5e20; }
      .bf-amount.gasto { color: #c0392b; }
      .bf-iva-small { font-size: 10px; color: var(--text-soft); display: block; margin-top: 2px; font-variant-numeric: tabular-nums; }
      
      /* Empty state */
      .bf-empty { text-align: center; padding: 40px 20px; }
      .bf-empty-icon { width: 48px; height: 48px; border-radius: var(--r-lg); background: linear-gradient(135deg, var(--bg-subtle), var(--surface-3)); display: flex; align-items: center; justify-content: center; font-size: 22px; margin: 0 auto 10px; }
      .bf-empty h3 { font-size: 14px; font-weight: 700; color: var(--text); margin: 0 0 4px; }
      .bf-empty p { font-size: 11px; color: var(--text-soft); margin: 0; line-height: 1.5; }
      
      /* Config Modal */
      .bf-modal-overlay { display: none; position: fixed; inset: 0; z-index: var(--z-modal); background: rgba(4,23,63,0.5); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); align-items: center; justify-content: center; animation: bf-fade-in 0.2s ease; }
      .bf-modal-overlay.show { display: flex; }
      @keyframes bf-fade-in { from { opacity: 0; } to { opacity: 1; } }
      .bf-modal { background: var(--surface); border-radius: var(--r-xl); padding: 20px; max-width: 520px; width: 92%; box-shadow: 0 24px 64px rgba(4,23,63,0.25), 0 8px 24px rgba(4,23,63,0.1); animation: bf-slide-up 0.35s var(--ease-spring); }
      @keyframes bf-slide-up { from { transform: translateY(24px) scale(0.97); opacity: 0; } to { transform: translateY(0) scale(1); opacity: 1; } }
      .bf-modal h2 { font-size: 17px; font-weight: 800; color: var(--text); margin: 0 0 4px; }
      .bf-modal .bf-modal-sub { font-size: 12px; color: var(--text-soft); margin: 0 0 20px; }
      .bf-modal-step { background: linear-gradient(135deg, var(--bg-subtle), var(--surface)); border: 1px solid var(--border-light); border-radius: var(--r-md); padding: 10px 14px; margin-bottom: 8px; transition: all 0.2s ease; }
      .bf-modal-step:hover { border-color: var(--accent); box-shadow: var(--shadow-xs); }
      .bf-modal-step h4 { font-size: 11px; font-weight: 700; color: var(--accent-dark); margin: 0 0 6px; text-transform: uppercase; letter-spacing: 0.5px; }
      .bf-modal-step p { font-size: 12px; color: var(--text-mid); margin: 0; line-height: 1.5; }
      .bf-modal-step code { background: rgba(0,194,168,0.1); color: var(--accent-dark); padding: 2px 6px; border-radius: var(--r-xs); font-size: 10px; font-weight: 600; }
      .bf-input { width: 100%; height: 34px; padding: 0 12px; border-radius: var(--r-md); border: 1.5px solid var(--border); background: var(--surface); color: var(--text); font-family: var(--font); font-size: 12px; transition: all 0.25s ease; outline: none; box-sizing: border-box; }
      .bf-input:focus { border-color: var(--accent); box-shadow: var(--focus); background: white; }
      .bf-modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 14px; }
      
      /* Responsive */
      @media (max-width: 900px) {
        .bf-kpi-strip { grid-template-columns: repeat(2, 1fr); }
        .bf-toolbar { flex-wrap: wrap; }
      }
      @media (max-width: 600px) {
        .bf-kpi-strip { grid-template-columns: 1fr; }
        .bf-container { padding: 12px; }
      }
      
      /* Pagination */
      .bf-pagination { display: flex; align-items: center; gap: 6px; margin-top: 10px; padding: 0 4px; flex-wrap: wrap; }
      .bf-page-btn { min-width: 28px; height: 28px; padding: 0 6px; border-radius: var(--r-sm); border: 1px solid var(--border); background: var(--surface); color: var(--text-mid); font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; font-family: var(--font); display: flex; align-items: center; justify-content: center; }
      .bf-page-btn:hover:not(:disabled):not(.active) { border-color: var(--accent); color: var(--accent); background: rgba(0,194,168,0.04); }
      .bf-page-btn.active { background: var(--navy); color: #fff; border-color: var(--navy); }
      .bf-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .bf-page-ellipsis { color: var(--text-soft); font-size: 12px; padding: 0 4px; }
      .bf-page-info { font-size: 11px; color: var(--text-soft); margin-left: auto; white-space: nowrap; }
    </style>
    
    <div class="bf-container">
      <!-- Header -->
      <div class="bf-header">
        <div>
          <h1 class="bf-title">Bandeja de Facturas</h1>
          <p class="bf-subtitle">Importación automática vía correo electrónico</p>
        </div>
        <div class="bf-actions">
          <button id="btn-sync" class="bf-btn bf-btn-primary">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
            Sincronizar
          </button>
          <button id="btn-config" class="bf-btn bf-btn-ghost">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>
            Configurar
          </button>
        </div>
      </div>
      
      <!-- KPI Strip -->
      <div class="bf-kpi-strip" id="kpi-strip">
        <div class="bf-kpi kpi-total">
          <div class="bf-kpi-label">Total Facturas</div>
          <div class="bf-kpi-value" id="kpi-total-val">—</div>
          <div class="bf-kpi-count" id="kpi-total-count">cargando...</div>
        </div>
        <div class="bf-kpi kpi-ingreso">
          <div class="bf-kpi-label">Ingresos</div>
          <div class="bf-kpi-value" id="kpi-ingreso-val">—</div>
          <div class="bf-kpi-count" id="kpi-ingreso-count"></div>
        </div>
        <div class="bf-kpi kpi-gasto">
          <div class="bf-kpi-label">Gastos</div>
          <div class="bf-kpi-value" id="kpi-gasto-val">—</div>
          <div class="bf-kpi-count" id="kpi-gasto-count"></div>
        </div>
        <div class="bf-kpi kpi-iva">
          <div class="bf-kpi-label">IVA Neto</div>
          <div class="bf-kpi-value" id="kpi-iva-val">—</div>
          <div class="bf-kpi-count" id="kpi-iva-count">débito − crédito</div>
        </div>
      </div>
      
      <!-- Toolbar: Status + Search + Filters -->
      <div class="bf-toolbar">
        <div class="bf-status-pill">
          <div class="bf-pulse" id="sync-dot"></div>
          <span id="sync-text">Conectando...</span>
        </div>
        <div class="bf-search-wrap">
          <span class="bf-search-icon">🔍</span>
          <input type="search" class="bf-search" id="search-input" name="facturas-q-noautofill" autocomplete="off" spellcheck="false" placeholder="Buscar por nombre, cédula, monto...">
        </div>
        <div class="bf-filter-group">
          <button class="bf-filter-btn active" data-filter="todos">Todos</button>
          <button class="bf-filter-btn" data-filter="ingreso">Ingresos</button>
          <button class="bf-filter-btn" data-filter="gasto">Gastos</button>
        </div>
        <button class="bf-sort-btn" id="btn-sort" title="Ordenar por fecha">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M9 18h6"/></svg>
          <span id="sort-label">Reciente</span>
        </button>
      </div>
      
      <!-- Collapsible drop zone -->
      <div class="bf-drop-toggle" id="drop-toggle">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="9 18 15 12 9 6"/></svg>
        Importar archivos manualmente
      </div>
      <div class="bf-drop-zone" id="drop-zone">
        <div class="drop-icon">📂</div>
        <p style="font-weight:600;color:var(--text-mid);margin-bottom:4px;">Arrastrá archivos XML, .eml o .msg (Outlook) aquí</p>
        <p>O hacé clic para seleccionar</p>
        <input type="file" id="file-input" multiple accept=".xml,.eml,.msg" style="display:none;" />
      </div>
      
      <!-- Table -->
      <div id="facturas-list"></div>
      
      <!-- Config Modal -->
      <div class="bf-modal-overlay" id="config-modal">
        <div class="bf-modal">
          <h2>⚙️ Puente Gmail</h2>
          <p class="bf-modal-sub">Conectá tu correo para importar facturas automáticamente.</p>
          
          <div class="bf-modal-step">
            <h4>Paso 1 — Gmail Puente</h4>
            <p>Creá una cuenta de Gmail gratuita solo para esto (ej. <code>facturas.innovio@gmail.com</code>).</p>
          </div>
          <div class="bf-modal-step">
            <h4>Paso 2 — Reenvío</h4>
            <p>En <code>factura.e@outlook.com</code> → Configuración → Reenvío, activá el reenvío hacia tu Gmail.</p>
          </div>
          <div class="bf-modal-step">
            <h4>Paso 3 — Contraseña App</h4>
            <p>En Google → Seguridad → Verificación en 2 pasos → <strong>Contraseñas de aplicación</strong>. Generá una y pegala abajo:</p>
          </div>
          
          <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
            <input type="email" id="gmail-user" class="bf-input" placeholder="tu-correo@gmail.com">
            <input type="password" id="gmail-pass" class="bf-input" placeholder="Contraseña de aplicación (16 caracteres)">
          </div>
          
          <div class="bf-modal-actions">
            <button id="btn-close-config" class="bf-btn bf-btn-ghost">Cancelar</button>
            <button id="btn-save-creds" class="bf-btn bf-btn-primary">Conectar</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Pre-llenar credenciales si existen en localStorage
  const savedUser = localStorage.getItem('gmail_imap_user');
  const savedPass = localStorage.getItem('gmail_imap_pass');
  if (savedUser) document.getElementById('gmail-user').value = savedUser;
  if (savedPass) document.getElementById('gmail-pass').value = savedPass;
  
  initEventHandlers();
  loadFacturas();
  startWatcher();
  startAutoRefresh();
  checkImapStatus();

  // Safety net: browsers sometimes autocomplete AFTER our JS runs.
  // Check after 200ms and clear any phantom text the browser injected.
  setTimeout(() => {
    const searchEl = document.getElementById('search-input');
    if (searchEl && searchEl.value && searchEl.value !== searchQuery) {
      searchEl.value = '';
      searchQuery = '';
      renderFacturas();
    }
  }, 200);
}

function startAutoRefresh() {
  if (autoRefreshTimer) clearInterval(autoRefreshTimer);
  // Auto-refresh every 30 seconds to catch any missed updates
  autoRefreshTimer = setInterval(() => {
    loadFacturas();
  }, 30000);
}

async function checkImapStatus() {
  try {
    const res = await fetch('/api/facturas/status');
    if (!res.ok) return;
    const data = await res.json();
    if (!data.hasCredentials) {
      toast('⚠️ No hay credenciales de Gmail configuradas. Ve a Configuración e ingresa tu correo y contraseña de aplicación.', 'warning');
      updateStatus(false);
    } else if (!data.imapReady) {
      toast('⚠️ IMAP no está conectado. Reintentando...', 'warning');
      updateStatus(false);
    }
  } catch {}
}

function stopAutoRefresh() {
  if (autoRefreshTimer) { clearInterval(autoRefreshTimer); autoRefreshTimer = null; }
  if (eventSource) { eventSource.close(); eventSource = null; }
  if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }
}

function initEventHandlers() {
  // Sync
  document.getElementById('btn-sync').addEventListener('click', async () => {
    const btn = document.getElementById('btn-sync');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Sincronizando...';
    try {
      const res = await fetch('/api/facturas/sync', { method: 'POST' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.ok === false) {
          toast('⚠️ ' + (data.error || 'No se pudo sincronizar'), 'warning');
        }
      }
      // Wait 3s for IMAP to fetch new emails
      await new Promise(r => setTimeout(r, 3000));
    } catch (e) {
      toast('❌ Error de conexión con el servidor', 'error');
    }
    await loadFacturas();
    btn.disabled = false;
    btn.innerHTML = originalText;
    toast('✅ Sincronización completada', 'success');
  });

  // Config modal
  document.getElementById('btn-config').addEventListener('click', () => {
    document.getElementById('config-modal').classList.add('show');
  });
  document.getElementById('btn-close-config').addEventListener('click', () => {
    document.getElementById('config-modal').classList.remove('show');
  });
  document.getElementById('config-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.classList.remove('show');
  });

  // Save creds
  document.getElementById('btn-save-creds').addEventListener('click', async () => {
    const user = document.getElementById('gmail-user').value.trim();
    const pass = document.getElementById('gmail-pass').value.trim();
    if (!user || !pass) return toast('Completá ambos campos', 'warning');

    const btn = document.getElementById('btn-save-creds');
    btn.textContent = 'Conectando...';
    btn.disabled = true;

    try {
      // Guardar en localStorage para pre-llenar el form la próxima vez
      localStorage.setItem('gmail_imap_user', user);
      localStorage.setItem('gmail_imap_pass', pass);
      
      const res = await fetch('/api/facturas/creds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass })
      });
      if (!res.ok) throw new Error('Error');
      toast('✅ Credenciales guardadas. Monitor reiniciado.', 'success');
      setTimeout(() => document.getElementById('config-modal').classList.remove('show'), 800);
      // Verificar estado despues de 2s
      setTimeout(() => checkImapStatus(), 2000);
    } catch {
      toast('❌ Error al guardar', 'error');
    } finally {
      btn.textContent = 'Conectar';
      btn.disabled = false;
    }
  });

  // Drop zone toggle
  document.getElementById('drop-toggle').addEventListener('click', function() {
    this.classList.toggle('open');
    document.getElementById('drop-zone').classList.toggle('visible');
  });

  // Drop zone interactions
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  // Prevent default drag behaviors globally so the browser doesn't open the Save As dialog
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    document.body.addEventListener(eventName, e => e.preventDefault(), false);
  });

  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    currentPage = 1;
    renderFacturas();
  });

  // Filter buttons
  document.querySelectorAll('.bf-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.bf-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTipo = btn.dataset.filter;
      currentPage = 1;
      renderFacturas();
    });
  });

  // Sort button
  const btnSort = document.getElementById('btn-sort');
  if (btnSort) {
    btnSort.addEventListener('click', () => {
      sortDirection = sortDirection === 'desc' ? 'asc' : 'desc';
      document.getElementById('sort-label').textContent = sortDirection === 'desc' ? 'Reciente' : 'Antiguo';
      renderFacturas();
    });
  }
}

async function handleFiles(fileList) {
  for (const file of fileList) {
    const isXml = file.name.toLowerCase().endsWith('.xml');
    const isEml = file.name.toLowerCase().endsWith('.eml');
    const isMsg = file.name.toLowerCase().endsWith('.msg');

    if (!isXml && !isEml && !isMsg) {
      toast(`${file.name} — formato no soportado`, 'warning');
      continue;
    }

    if (file.size === 0) {
      toast(`❌ Error: ${file.name} está vacío. Si arrastró directo de Outlook, por favor guarde los correos en una carpeta primero y arrástrelos desde ahí.`, 'error', 6000);
      continue;
    }
    
    // Convertir de forma segura a base64 sin colapsar la memoria (FileReader)
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    try {
      const res = await fetch('/api/facturas/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, content: base64, encoding: 'base64' })
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Error al subir');
      }
      toast(`✅ ${file.name} procesado`, 'success');
    } catch (e) {
      toast(`❌ Error: ${file.name} - ${e.message}`, 'error');
    }
  }
  loadFacturas();
}

async function loadFacturas() {
  try {
    const taxData = await fetchTaxData(0, 0, true);
    const all = [...(taxData.allIngresos || []), ...(taxData.allGastos || [])];

    const uniqueFacturas = [];
    const seenClaves = new Set();

    all.forEach(rec => {
      const clave = rec.xml_clave || rec.id;
      if (clave && seenClaves.has(clave)) return;
      if (clave) seenClaves.add(clave);

      let parsed = null;
      if (rec.raw_xml) {
        try { parsed = parseComprobanteXML(rec.raw_xml); } catch (_) {}
      }

      if (!parsed) {
        parsed = {
          clave: rec.xml_clave || rec.id,
          fecha: rec.fecha ? new Date(rec.fecha) : new Date(),
          totalComprobante: rec.monto_bruto || 0,
          totalImpuesto: rec.monto_iva || 0,
          tarifaIVA: rec.tarifa_iva || 0,
          emisor: { nombre: rec.proveedor || '' },
          receptor: { nombre: rec.cliente || '' },
          descripcion: rec.descripcion || ''
        };
      }

      const tipo = rec.tipo || (rec.proveedor ? 'gasto' : 'ingreso');
      uniqueFacturas.push({
        name: rec.descripcion || rec.id,
        xml: rec.raw_xml || '',
        parsed,
        tipo
      });
    });

    facturas = uniqueFacturas;
    renderFacturas();
    updateKPIs();
    updateStatus(true);
  } catch (err) {
    console.warn('Error loading facturas:', err);
    updateStatus(false);
  }
}

function startWatcher() {
  if (eventSource) eventSource.close();
  if (sseReconnectTimer) { clearTimeout(sseReconnectTimer); sseReconnectTimer = null; }
  
  eventSource = new EventSource('/api/facturas/watch');
  eventSource.onmessage = (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.event === 'connected') {
        updateStatus(true);
      } else if (data.event === 'new_file') {
        toast(`📄 ${data.filename}`, 'success');
        const parsed = parseComprobanteXML(data.xml);
        const tipo = clasificarComprobante(parsed, '205390118');
        
        // Ignorar mensajes de confirmación de Hacienda
        if (tipo === 'desconocido') return;
        
        // Anti-duplicate logic for real-time events
        if (parsed.clave && facturas.some(f => f.parsed.clave === parsed.clave)) {
          return; // Already have this invoice
        }
        
        facturas.unshift({ name: data.filename, xml: data.xml, parsed, tipo });
        renderFacturas();
        updateKPIs();
        updateStatus(true);
      }
    } catch {}
  };
  eventSource.onerror = (err) => {
    updateStatus(false);
    if (eventSource) eventSource.close();
    eventSource = null;
    // Auto-reconnect after 5 seconds
    sseReconnectTimer = setTimeout(() => {
      console.log('[SSE] Reconectando...');
      startWatcher();
    }, 5000);
  };
}

function updateStatus(connected) {
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  if (!dot) return;

  if (connected) {
    dot.className = 'bf-pulse online';
    text.textContent = `Sincronizado · ${facturas.length} factura${facturas.length !== 1 ? 's' : ''}`;
  } else {
    dot.className = 'bf-pulse offline';
    text.textContent = 'Sin conexión';
  }
}

function updateKPIs() {
  const ingresos = facturas.filter(f => f.tipo === 'ingreso');
  const gastos = facturas.filter(f => f.tipo === 'gasto');
  
  const sumIngresos = ingresos.reduce((s, f) => s + (f.parsed.totalComprobante || 0), 0);
  const sumGastos = gastos.reduce((s, f) => s + (f.parsed.totalComprobante || 0), 0);
  const ivaIngresos = ingresos.reduce((s, f) => s + (f.parsed.totalImpuesto || 0), 0);
  const ivaGastos = gastos.reduce((s, f) => s + (f.parsed.totalImpuesto || 0), 0);

  const el = (id) => document.getElementById(id);
  el('kpi-total-val').textContent = formatColones(sumIngresos + sumGastos);
  el('kpi-total-count').textContent = `${facturas.length} documentos`;
  el('kpi-ingreso-val').textContent = formatColones(sumIngresos);
  el('kpi-ingreso-count').textContent = `${ingresos.length} factura${ingresos.length !== 1 ? 's' : ''}`;
  el('kpi-gasto-val').textContent = formatColones(sumGastos);
  el('kpi-gasto-count').textContent = `${gastos.length} factura${gastos.length !== 1 ? 's' : ''}`;
  el('kpi-iva-val').textContent = formatColones(ivaIngresos - ivaGastos);
  el('kpi-iva-count').textContent = `${formatColones(ivaIngresos)} − ${formatColones(ivaGastos)}`;
}

function renderFacturas() {
  const container = document.getElementById('facturas-list');
  if (!container) return;

  // ALWAYS read the real value from the DOM — never trust the cached variable
  // Chrome re-injects autocomplete values at unpredictable times
  const searchEl = document.getElementById('search-input');
  if (searchEl) {
    // If browser injected an email address, nuke it
    if (searchEl.value.includes('@')) {
      searchEl.value = '';
    }
    searchQuery = searchEl.value.toLowerCase();
  }

  // Apply filters
  let filtered = facturas;
  if (filterTipo !== 'todos') {
    filtered = filtered.filter(f => f.tipo === filterTipo);
  }
  if (searchQuery) {
    filtered = filtered.filter(f => {
      const p = f.parsed;
      const haystack = [
        p.emisor?.nombre, p.emisor?.cedula,
        p.receptor?.nombre, p.receptor?.cedula,
        f.name, p.descripcion,
        String(p.totalComprobante)
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(searchQuery);
    });
  }

  // Sort by date
  filtered.sort((a, b) => {
    const da = a.parsed?.fecha ? new Date(a.parsed.fecha) : new Date(0);
    const db = b.parsed?.fecha ? new Date(b.parsed.fecha) : new Date(0);
    return sortDirection === 'desc' ? db - da : da - db;
  });

  if (filtered.length === 0) {
    const msg = facturas.length === 0
      ? { icon: '📭', title: 'Sin facturas aún', sub: 'Las facturas llegarán automáticamente desde tu correo.' }
      : { icon: '🔍', title: 'Sin resultados', sub: 'Intentá con otro filtro o término de búsqueda.' };
    container.innerHTML = `
      <div class="bf-empty">
        <div class="bf-empty-icon">${msg.icon}</div>
        <h3>${msg.title}</h3>
        <p>${msg.sub}</p>
      </div>
    `;
    return;
  }

  // Pagination
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  // Build page numbers (show max 7 pages with ellipsis)
  let pageNumbers = [];
  if (totalPages <= 7) {
    pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    pageNumbers = [1];
    if (currentPage > 3) pageNumbers.push('...');
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pageNumbers.push(i);
    if (currentPage < totalPages - 2) pageNumbers.push('...');
    pageNumbers.push(totalPages);
  }

  const paginationHtml = totalPages > 1 ? `
    <div class="bf-pagination">
      <button class="bf-page-btn" id="bf-page-prev" ${currentPage === 1 ? 'disabled' : ''}>‹</button>
      ${pageNumbers.map(n => 
        n === '...' 
          ? '<span class="bf-page-ellipsis">…</span>'
          : `<button class="bf-page-btn ${n === currentPage ? 'active' : ''}" data-page="${n}">${n}</button>`
      ).join('')}
      <button class="bf-page-btn" id="bf-page-next" ${currentPage === totalPages ? 'disabled' : ''}>›</button>
      <span class="bf-page-info">${startIdx + 1}–${Math.min(startIdx + PAGE_SIZE, filtered.length)} de ${filtered.length}</span>
    </div>
  ` : '';

  container.innerHTML = `
    <div class="bf-table-wrap">
      <table class="bf-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Doc</th>
            <th>Fecha</th>
            <th>Entidad</th>
            <th>Monto</th>
          </tr>
        </thead>
        <tbody>
          ${pageItems.map(f => {
            const p = f.parsed;
            const ok = p.success;
            const tipoClass = f.tipo === 'ingreso' ? 'ingreso' : f.tipo === 'gasto' ? 'gasto' : 'desconocido';
            const tipoLabel = f.tipo === 'ingreso' ? '↗ Ingreso' : f.tipo === 'gasto' ? '↙ Gasto' : '? N/A';
            const fecha = p.fecha ? p.fecha.toLocaleDateString('es-CR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
            const entidad = f.tipo === 'ingreso' ? (p.receptor?.nombre || '—') : (p.emisor?.nombre || '—');
            const total = ok ? formatColones(p.totalComprobante) : '—';
            const iva = ok ? formatColones(p.totalImpuesto) : '';
            const tipoDoc = p.tipoDocumento || '—';

            return `
              <tr>
                <td><span class="bf-badge ${tipoClass}">${tipoLabel}</span></td>
                <td><span class="bf-tipo-doc">${tipoDoc}</span></td>
                <td style="white-space:nowrap;color:var(--text-mid);font-size:11px;">${fecha}</td>
                <td>
                  <span class="bf-emisor">${entidad}</span>
                  <span class="bf-file-name">${f.name}</span>
                </td>
                <td>
                  <span class="bf-amount ${tipoClass}">${f.tipo === 'ingreso' ? '+' : f.tipo === 'gasto' ? '−' : ''}${total}</span>
                  ${iva ? `<span class="bf-iva-small">IVA ${iva}</span>` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
    ${paginationHtml}
  `;

  // Bind pagination events
  const prevBtn = document.getElementById('bf-page-prev');
  const nextBtn = document.getElementById('bf-page-next');
  if (prevBtn) prevBtn.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderFacturas(); } });
  if (nextBtn) nextBtn.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderFacturas(); } });
  document.querySelectorAll('.bf-page-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page, 10);
      renderFacturas();
    });
  });
}
