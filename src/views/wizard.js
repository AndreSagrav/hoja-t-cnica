import { ensureShell } from '../components/shell.js';
import { toast, esc, debounce, fmtMoney, todayLocal } from '../lib/utils.js';
import { buscarClientes, obtenerCliente, guardarDocumentoCompleto, sugerirSiguienteNumero, CODE_TO_LABEL, KIND_TO_CODE } from '../data/documentos.js';
import { proyectarNumeroDocumento } from '../lib/hacienda.js';
import { getSupabase } from '../lib/supabase.js';
import { FIELDS, FIELD_OPTIONS, getFilteredOptions } from '../data/equipos.js';
import { TAREAS_DATA } from './tareas.js';
import { LOGO_DATA_URL } from '../assets/logo.js';

let wState = null;

function initWizardState(kind) {
  wState = {
    step: 1,
    docId: null,
    docKind: kind,
    docType: CODE_TO_LABEL[KIND_TO_CODE[kind]] || (kind === 'cotizacion' ? 'COTIZACIÓN' : 'ORDEN DE TRABAJO'),
    docNum: '',
    date: todayLocal(),
    estado: 'pendiente',
    clientId: null,
    clientName: '',
    mainContactName: '',
    clientCompany: '',
    clientType: 'residencial',
    clientPhone: '',
    clientEmail: '',
    clientCedula: '',
    clientFact: {}, // Datos de facturación electrónica
    authUsers: [], // Usuarios autorizados para clientes empresariales
    convertFactura: false,
    lines: [{ descripcion: '', cantidad: 1, precio: 0, codigo: '' }],
    discount: { enabled: false, value: 0 },
    iva: { enabled: false, value: 13 },
    currency: { code: 'CRC', symbol: '₡' },
    problem: '', diagnosis: '', observations: kind === 'cotizacion' ?
      '1. Precios válidos por 15 días naturales.\n2. Tiempo de entrega: 2-3 días hábiles, sujeto a disponibilidad de repuestos.\n3. Forma de pago: 50% anticipado, 50% contra entrega.\n4. Garantía de 30 días sobre el servicio realizado.\n5. Los precios no incluyen IVA a menos que se indique lo contrario.' :
      'El equipo queda sujeto a revisión y diagnóstico. El tiempo de reparación puede variar según disponibilidad de repuestos. Se notificará al cliente cualquier cambio en el presupuesto. La garantía del servicio es de 30 días.',
    tiempoEstimado: '',
    timeIn: '', timeOut: '',
    equipos: [],
    equipoData: {},
    tareasRealizadas: [],
    availableServices: []
  };
}

export async function wizardNuevoView(params = {}) {
  const kind = params.kind || 'orden';
  initWizardState(kind);
  wState.docNum = ''; // Se generará al guardar, no al abrir
  try {
    if (kind === 'orden') {
      const supabase = await getSupabase();
      const { data } = await supabase.from('catalogo_servicios').select('*').eq('activo', true).eq('tipo', 'servicio').order('nombre', { ascending: true });
      if (data) wState.availableServices = data;
    }
  } catch (e) {
    console.error("Error inicializando wizard:", e);
  }
  renderWizard();
}

function renderWizard() {
  const shell = ensureShell('/documentos');
  shell.setTitle(`Asistente Inteligente`);
  shell.setActions(`<button class="btn btn-ghost" onclick="window.location.hash='/documentos'" style="display:inline-flex;align-items:center;gap:6px;"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg> Cancelar</button>`);

  const c = shell.content();

  // Step icons (contextual SVGs)
  const stepIcons = {
    'Cliente': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>',
    'Equipos': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>',
    'Diagnóstico': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
    'Condiciones': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>',
    'Tareas': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>',
    'Servicios': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
    'Productos/Servicios': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>',
    'Revisión y Cierre': '<svg fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
  };

  const checkIcon = '<svg class="check-icon" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

  // Progress Bar
  const steps = [ { num: 1, title: 'Cliente' } ];
  if (wState.docKind === 'orden') {
    steps.push({ num: 2, title: 'Equipos' });
    steps.push({ num: 3, title: 'Diagnóstico' });
    steps.push({ num: 4, title: 'Tareas' });
    steps.push({ num: 5, title: 'Servicios' });
  } else {
    steps.push({ num: 2, title: 'Condiciones' });
    steps.push({ num: 3, title: 'Productos/Servicios' });
  }
  steps.push({ num: steps.length + 1, title: 'Revisión y Cierre' });

  const progressHtml = `
    <div class="wizard-stepper-container">
      <div class="wizard-stepper-line-bg"></div>
      <div class="wizard-stepper-line-active" style="width:${((wState.step - 1) / (steps.length - 1)) * 100}%"></div>
      ${steps.map(s => `
        <div class="wizard-stepper-item ${wState.step >= s.num ? 'active' : ''} ${wState.step > s.num ? 'completed' : ''}">
          <div class="wizard-stepper-circle">
            ${wState.step > s.num ? checkIcon : (stepIcons[s.title] || s.num)}
          </div>
          <span class="wizard-stepper-label">${s.title}</span>
        </div>
      `).join('')}
    </div>
  `;

  let stepContent = '';
  if (wState.step === 1) stepContent = renderStep1();
  else if (wState.docKind === 'orden') {
    if (wState.step === 2) stepContent = renderStepEquipos();
    else if (wState.step === 3) stepContent = renderStep2(); // Diagnóstico
    else if (wState.step === 4) stepContent = renderStepTareas(); // Tareas
    else if (wState.step === 5) stepContent = renderStep3(); // Servicios
    else if (wState.step === 6) stepContent = renderStep4(); // Revisión
  } else {
    if (wState.step === 2) stepContent = renderStep2(); // Condiciones
    else if (wState.step === 3) stepContent = renderStep3(); // Servicios
    else if (wState.step === 4) stepContent = renderStep4(); // Revisión
  }

  const arrowSvg = '<svg class="btn-arrow" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/></svg>';

  const navHtml = `
    <div class="wiz-nav">
      <button class="btn btn-ghost" id="btn-wiz-prev" ${wState.step === 1 ? 'style="visibility:hidden"' : ''}>
        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12"/></svg>
        Anterior
      </button>
      ${wState.step < steps.length 
        ? `<button class="wiz-btn-next" id="btn-wiz-next">Siguiente ${arrowSvg}</button>`
        : `<div style="display:flex; gap:12px; align-items:center;">
             <button class="btn btn-ghost" id="btn-wiz-preview" style="color:var(--navy); display:inline-flex; align-items:center; gap:8px;">
               <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
               Vista Previa
             </button>
             <button class="wiz-btn-save" id="btn-wiz-save">
               <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
               Emitir Documento
             </button>
           </div>`
      }
    </div>
  `;

  c.innerHTML = `
    <div class="wizard-container">
      <div class="wiz-header">
        <div class="wiz-header-title">Nueva ${wState.docType}</div>
        <div class="wiz-header-badge" id="wiz-header-badge">${wState.docNum || 'Se asignará al emitir'}</div>
      </div>
      ${progressHtml}
      <div class="wizard-card">
        <div class="wizard-step-content">
          ${stepContent}
        </div>
        ${navHtml}
      </div>
    </div>
  `;

  bindWizardEvents();

  // Proyectar número de documento para mostrar en el badge (sin consumir consecutivo)
  if (!wState.docNum && wState.clientId) {
    proyectarNumeroDocumento(wState.docKind, wState.clientId)
      .then(num => {
        if (num) {
          const badge = document.getElementById('wiz-header-badge');
          if (badge) badge.textContent = num;
        }
      })
      .catch(() => {});
  }
}

// -- Pasos --

function renderStep1() {
  const tieneFact = wState.clientId && Object.keys(wState.clientFact).length > 0 && wState.clientFact.fact_tipo_id;
  return `
    <div class="wiz-section-title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
      Datos del Cliente
    </div>
    <p class="wiz-section-subtitle">Busca en tu catálogo un cliente existente o ingresa uno nuevo.</p>
    
    <div class="wiz-spotlight-search">
      <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" class="wiz-spotlight-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
      <input class="wiz-spotlight-input" id="wiz-cli-search" placeholder="Buscar por nombre, teléfono o empresa..." autocomplete="off"/>
      <div id="wiz-cli-results" class="cli-results" style="display:none;"></div>
    </div>

    ${tieneFact ? `
      <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:6px 10px; border-radius:8px; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        <span style="color:#166534;"><svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg></span>
        <div style="font-size:11px; color:#166534;"><strong>Perfil fiscal detectado:</strong> Este cliente tiene datos de Facturación Electrónica guardados.</div>
      </div>
    ` : ''}

    <div class="wiz-form-grid">
      <div class="wiz-field wiz-field-name">
        <label class="wiz-label">${wState.clientType === 'empresarial' ? 'Solicitante *' : 'Nombre / Contacto *'}</label>
        ${wState.clientType === 'empresarial' ? `
          <div class="wiz-eq-select-wrap">
            <select class="wiz-eq-select" id="wiz-cli-name">
              <option value="">Seleccione solicitante...</option>
              ${wState.mainContactName ? `<option value="${esc(wState.mainContactName)}" ${wState.clientName === wState.mainContactName ? 'selected' : ''}>${esc(wState.mainContactName)} (Contacto Principal)</option>` : ''}
              ${(wState.authUsers||[]).map(u => {
                const name = typeof u === 'string' ? u : (u.nombre || u.name || '');
                if (name === wState.mainContactName) return '';
                return `<option value="${esc(name)}" ${wState.clientName === name ? 'selected' : ''}>${esc(name)}</option>`;
              }).join('')}
            </select>
            <div class="wiz-eq-select-arrow">▼</div>
          </div>
        ` : `
          <input class="wiz-input" id="wiz-cli-name" value="${esc(wState.clientName)}"/>
        `}
      </div>
      <div class="wiz-field wiz-field-company"><label class="wiz-label">Empresa (Opcional)</label><input class="wiz-input" id="wiz-cli-company" value="${esc(wState.clientCompany)}"/></div>
      <div class="wiz-field wiz-field-phone"><label class="wiz-label">Teléfono</label><input class="wiz-input" id="wiz-cli-phone" value="${esc(wState.clientPhone)}"/></div>
      <div class="wiz-field wiz-field-email"><label class="wiz-label">Email</label><input class="wiz-input" id="wiz-cli-email" value="${esc(wState.clientEmail)}"/></div>
      <div class="wiz-field wiz-field-type"><label class="wiz-label">Tipo de Cliente</label>
        <div class="wiz-eq-select-wrap">
          <select class="wiz-eq-select" id="wiz-cli-type">
            <option value="residencial" ${wState.clientType==='residencial'?'selected':''}>Residencial</option>
            <option value="empresarial" ${wState.clientType==='empresarial'?'selected':''}>Empresarial</option>
          </select>
          <div class="wiz-eq-select-arrow">▼</div>
        </div>
      </div>
    </div>
  `;
}

function renderStepEquipos() {
  if (wState.equipos.length === 0) {
    wState.equipos.push({}); // Al menos un equipo por defecto
  }

  const GROUPS = [
    { title: 'General', color: '#0284c7', bg: '#e0f2fe', keys: ['DISPOSITIVO', 'FABRICANTE', 'MODELO', 'S.O.', 'BIOS/UEFI'] },
    { title: 'Procesador & RAM', color: '#059669', bg: '#d1fae5', keys: ['CPU MARCA', 'CPU MODELO', 'RAM TIPO', 'RAM CAPACIDAD', 'RAM GEN', 'RAM VELOCIDAD'] },
    { title: 'Almacenamiento', color: '#d97706', bg: '#fef3c7', keys: ['DISCO TIPO', 'DISCO CAPACIDAD', 'DISCO MARCA'] }
  ];

  const renderFields = (eqIdx) => {
    const eq = wState.equipos[eqIdx] || {};
    return GROUPS.map(g => {
      return g.keys.map(k => {
        const f = FIELDS.find(x => x.title === k);
        if (!f) return '';
        let customOptions = [];
        try { customOptions = JSON.parse(localStorage.getItem('innovio:custom_fields') || '{}')[f.title] || []; } catch(e) {}
        const allOptions = [...(FIELD_OPTIONS[f.title] || []), ...customOptions];
        const val = eq[f.title] || '';

        const filteredOptions = getFilteredOptions(f.title, eq, allOptions);
        const optionsToShow = (val && !filteredOptions.includes(val))
          ? [val, ...filteredOptions]
          : filteredOptions;

        return `
          <div class="wiz-eq-field">
            <label class="wiz-eq-label" style="color:${g.color};">
              <span class="wiz-eq-label-icon" style="background:${g.bg};">${f.icon}</span>
              ${esc(f.title)}
            </label>
            <div class="wiz-eq-select-wrap">
              <select class="wiz-eq-select" data-eq-idx="${eqIdx}" data-field="${esc(f.title)}">
                <option value="" ${val===''?'selected':''}>Seleccionar...</option>
                ${optionsToShow.map(opt => `<option value="${esc(opt)}" ${val===opt?'selected':''}>${esc(opt)}</option>`).join('')}
                <option value="__new__" style="font-weight:bold; color:var(--accent);">[ ➕ Nuevo... ]</option>
              </select>
              <div class="wiz-eq-select-arrow">▼</div>
            </div>
          </div>
        `;
      }).join('');
    }).join('');
  };

  return `
    <div class="wiz-section-title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
      Equipos a Intervenir
    </div>
    <p class="wiz-section-subtitle">Describe los dispositivos asociados a esta orden de trabajo (1 a N equipos).</p>
    
    <div id="wiz-equipos-container">
      ${wState.equipos.map((eq, i) => `
        <div class="wiz-equipo-card" data-idx="${i}">
          <div class="wiz-equipo-card-header">
            <div class="wiz-equipo-card-title">Equipo #${i + 1}</div>
            ${wState.equipos.length > 1 ? `<button class="btn btn-ghost btn-remove-equipo" data-idx="${i}" style="color:var(--red); padding:4px 10px; font-size:var(--fs-sm); border:none; background:transparent; cursor:pointer; min-height:auto;">✖ Quitar</button>` : ''}
          </div>
          <div class="wiz-equipo-card-body">
            <div class="wiz-equipo-grid">
              ${renderFields(i)}
            </div>
          </div>
        </div>
      `).join('')}
    </div>
    
    <button class="wiz-add-equipo-btn" id="wiz-add-equipo">＋ Añadir otro equipo a la orden</button>
  `;
}

function renderStep2() {
  if (wState.docKind === 'orden') {
    return `
      <div class="wiz-section-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
        Diagnóstico y Reparación
      </div>
      <p class="wiz-section-subtitle">Describe el problema reportado por el cliente y el trabajo a realizar.</p>
      
      <div class="wiz-form-grid" style="margin-top:0;">
        <div class="wiz-field" style="grid-column:span 12;">
          <label class="wiz-label">Problema Reportado por el Cliente</label>
          <textarea class="wiz-input" id="wiz-problem" rows="3" placeholder="Ej. La computadora no enciende o hace un ruido..." style="height:auto; padding:var(--sp-2) var(--sp-3); resize:vertical; line-height:var(--lh-normal); font-size:var(--fs-sm);">${esc(wState.problem)}</textarea>
        </div>
        <div class="wiz-field" style="grid-column:span 12;">
          <label class="wiz-label">Diagnóstico Técnico / Reparación</label>
          <textarea class="wiz-input" id="wiz-diagnosis" rows="4" placeholder="Ej. Se encontró falla en fuente de poder, se procede al reemplazo..." style="height:auto; padding:var(--sp-2) var(--sp-3); resize:vertical; line-height:var(--lh-normal); font-size:var(--fs-sm);">${esc(wState.diagnosis)}</textarea>
        </div>
        <div class="wiz-field" style="grid-column:span 4;">
          <label class="wiz-label">Fecha</label>
          <input type="date" class="wiz-input" id="wiz-cli-date" value="${esc(wState.date)}"/>
        </div>
        <div class="wiz-field" style="grid-column:span 4;">
          <label class="wiz-label">Hora Estimada Entrada</label>
          <input type="time" class="wiz-input" id="wiz-time-in" value="${esc(wState.timeIn)}"/>
        </div>
        <div class="wiz-field" style="grid-column:span 4;">
          <label class="wiz-label">Hora Estimada Salida</label>
          <input type="time" class="wiz-input" id="wiz-time-out" value="${esc(wState.timeOut)}"/>
        </div>
      </div>
    `;
  } else {
    return `
      <div class="wiz-section-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
        Condiciones y Observaciones
      </div>
      <p class="wiz-section-subtitle">Agrega términos de la cotización, tiempo de validez o notas especiales.</p>
      <div class="wiz-form-grid">
        <div class="wiz-field" style="grid-column:span 4;">
          <label class="wiz-label">Tiempo Estimado de Entrega</label>
          <div class="wiz-eq-select-wrap">
            <select class="wiz-eq-select" id="wiz-tiempo-estimado">
              <option value="" ${!wState.tiempoEstimado ? 'selected' : ''}>— Seleccionar —</option>
              <option value="1 día" ${wState.tiempoEstimado==='1 día'?'selected':''}>1 día</option>
              <option value="2 días" ${wState.tiempoEstimado==='2 días'?'selected':''}>2 días</option>
              <option value="3 días" ${wState.tiempoEstimado==='3 días'?'selected':''}>3 días</option>
              <option value="5 días" ${wState.tiempoEstimado==='5 días'?'selected':''}>5 días</option>
              <option value="1 semana" ${wState.tiempoEstimado==='1 semana'?'selected':''}>1 semana</option>
              <option value="2 semanas" ${wState.tiempoEstimado==='2 semanas'?'selected':''}>2 semanas</option>
              <option value="Por confirmar" ${wState.tiempoEstimado==='Por confirmar'?'selected':''}>Por confirmar</option>
            </select>
            <div class="wiz-eq-select-arrow">▼</div>
          </div>
        </div>
        <div class="wiz-field" style="grid-column:span 8;">
          <label class="wiz-label">Observaciones generales</label>
          <textarea class="wiz-input" id="wiz-observations" rows="5" placeholder="Condiciones comerciales, vigencia de cotización, tiempo de entrega, etc..." style="height:auto; padding:var(--sp-2) var(--sp-3); resize:vertical; line-height:var(--lh-normal); font-size:var(--fs-sm);">${esc(wState.observations)}</textarea>
        </div>
      </div>
    `;
  }
}

function renderStep3() {
  const isOrden = wState.docKind === 'orden';
  const titleText = isOrden ? 'Servicios Realizados' : 'Productos y Servicios';
  const subtitle = isOrden ? 'Selecciona los servicios de la base de datos o agrega uno manual.' : 'Busca por sección: servicios, productos o tareas. Haz clic para agregar.';

  if (!isOrden) {
    // ── COTIZACIÓN: Catálogo navegable por secciones (acordeón) ──
    return `
      <div class="wiz-section-title">
        <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
        ${titleText}
      </div>
      <p class="wiz-section-subtitle">${subtitle}</p>

      <!-- Buscador del catálogo -->
      <div style="margin-bottom:12px;">
        <input class="wiz-input" id="wiz-catalog-search" placeholder="🔍 Buscar en la sección abierta..." style="width:100%;"/>
      </div>

      <!-- Acordeón de secciones -->
      <div id="wiz-catalog-accordion" style="margin-bottom:16px;">
        <div class="wiz-cat-section" data-section="servicios">
          <div class="wiz-cat-header" id="wiz-cat-servicios-header">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">🔧</span>
              <span style="font-weight:700; font-size:var(--fs-sm);">Servicios</span>
              <span class="wiz-cat-count" id="wiz-cat-servicios-count"></span>
            </span>
            <span class="wiz-cat-arrow">▼</span>
          </div>
          <div class="wiz-cat-body" id="wiz-cat-servicios-body" style="display:none;"></div>
        </div>

        <div class="wiz-cat-section" data-section="productos">
          <div class="wiz-cat-header" id="wiz-cat-productos-header">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">📦</span>
              <span style="font-weight:700; font-size:var(--fs-sm);">Productos</span>
              <span class="wiz-cat-count" id="wiz-cat-productos-count"></span>
            </span>
            <span class="wiz-cat-arrow">▼</span>
          </div>
          <div class="wiz-cat-body" id="wiz-cat-productos-body" style="display:none;"></div>
        </div>

        <div class="wiz-cat-section" data-section="tareas">
          <div class="wiz-cat-header" id="wiz-cat-tareas-header">
            <span style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:16px;">📋</span>
              <span style="font-weight:700; font-size:var(--fs-sm);">Tareas</span>
              <span class="wiz-cat-count" id="wiz-cat-tareas-count"></span>
            </span>
            <span class="wiz-cat-arrow">▼</span>
          </div>
          <div class="wiz-cat-body" id="wiz-cat-tareas-body" style="display:none;"></div>
        </div>
      </div>

      <!-- Líneas agregadas -->
      <div style="margin-top:8px; border-top:1px solid var(--border-color); padding-top:12px;">
        <div style="font-weight:700; font-size:var(--fs-sm); color:var(--text); margin-bottom:8px;">Items agregados:</div>
        <div id="wiz-lines-container">
          ${wState.lines.map((line, i) => `
            <div class="wiz-line-row" data-idx="${i}">
              <div class="wiz-line-field wiz-line-field-desc">
                <label class="wiz-label" style="display:${i===0?'flex':'none'}">Descripción</label>
                <input class="wiz-input wiz-line-desc" value="${esc(line.descripcion || '')}" data-field="descripcion" placeholder="Descripción del item..."/>
              </div>
              <div class="wiz-line-field wiz-line-field-qty">
                <label class="wiz-label" style="display:${i===0?'flex':'none'}">Cant.</label>
                <input class="wiz-input" type="number" value="${esc(line.cantidad || '')}" data-field="cantidad" min="1"/>
              </div>
              <div class="wiz-line-field wiz-line-field-price">
                <label class="wiz-label" style="display:${i===0?'flex':'none'}">Precio (${wState.currency.symbol})</label>
                <input class="wiz-input" type="number" value="${esc(line.precio || '')}" data-field="precio"/>
              </div>
              <div class="wiz-line-field wiz-line-field-remove">
                <button class="btn btn-ghost btn-remove-line" style="color:var(--red); font-size:18px; padding:4px 12px; border:none; background:transparent; cursor:pointer; min-height:36px; min-width:36px; display:flex; align-items:center; justify-content:center; border-radius:var(--r-sm);" title="Eliminar fila">×</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="wiz-add-row">
        <button class="wiz-add-line-btn" id="wiz-add-line">＋ Agregar fila manual</button>
        <div class="wiz-totals-bar">
          <label class="wiz-iva-toggle">
            <input type="checkbox" id="wiz-chk-iva-step5" ${wState.iva.enabled ? 'checked' : ''}/>
            + IVA (13%)
          </label>
          <div class="wiz-disc-input">
            <label>Desc %</label>
            <input class="wiz-input" id="wiz-discount" type="number" value="${wState.discount.value}"/>
          </div>
          <div class="wiz-live-total" id="wiz-live-total">${fmtMoney(calcWizardTotal())}</div>
        </div>
      </div>
    `;
  }

  // ── ORDEN: Select dropdown (sin cambios) ──
  return `
    <div class="wiz-section-title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path></svg>
      ${titleText}
    </div>
    <p class="wiz-section-subtitle">${subtitle}</p>
    
    <div id="wiz-lines-container">
      ${wState.lines.map((line, i) => `
        <div class="wiz-line-row" data-idx="${i}">
          <div class="wiz-line-field wiz-line-field-desc">
            <label class="wiz-label" style="display:${i===0?'flex':'none'}">${isOrden ? 'Servicio' : 'Buscador / Descripción'}</label>
            ${isOrden ? `
              <div class="wiz-eq-select-wrap">
                <select class="wiz-eq-select wiz-service-select" data-field="descripcion" data-idx="${i}">
                  <option value="">Seleccionar un servicio...</option>
                  ${(wState.availableServices || []).map(svc => {
                    const isSelected = (line.descripcion === svc.nombre) ? 'selected' : '';
                    return `<option value="${esc(svc.id)}" ${isSelected}>${esc(svc.nombre)}</option>`;
                  }).join('')}
                  <option value="__new__" style="font-weight:bold; color:var(--accent);">[ ➕ Agregar Manual... ]</option>
                </select>
                <div class="wiz-eq-select-arrow">▼</div>
              </div>
              ${line.codigo === '__manual__' ? `<div style="margin-top:4px; font-weight:700; color:var(--navy); font-size:var(--fs-sm);">Manual: ${esc(line.descripcion)}</div>` : ''}
            ` : `
              <input class="wiz-input wiz-line-desc" value="${esc(line.descripcion || '')}" data-field="descripcion" placeholder="Escribe para buscar..."/>
              <div class="inv-results" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:20; background:#fff; border:2px solid #e2e8f0; border-radius:var(--r-md); box-shadow:var(--shadow-lg); max-height:200px; overflow-y:auto; margin-top:4px;"></div>
            `}
          </div>
          <div class="wiz-line-field wiz-line-field-qty">
            <label class="wiz-label" style="display:${i===0?'flex':'none'}">Cant.</label>
            <input class="wiz-input" type="number" value="${esc(line.cantidad || '')}" data-field="cantidad" min="1"/>
          </div>
          <div class="wiz-line-field wiz-line-field-price">
            <label class="wiz-label" style="display:${i===0?'flex':'none'}">Precio (${wState.currency.symbol})</label>
            <input class="wiz-input" type="number" value="${esc(line.precio || '')}" data-field="precio"/>
          </div>
          <div class="wiz-line-field wiz-line-field-remove">
            <button class="btn btn-ghost btn-remove-line" style="color:var(--red); font-size:18px; padding:4px 12px; border:none; background:transparent; cursor:pointer; min-height:36px; min-width:36px; display:flex; align-items:center; justify-content:center; border-radius:var(--r-sm);" title="Eliminar fila">×</button>
          </div>
        </div>
      `).join('')}
    </div>
    
    <div class="wiz-add-row">
      <button class="wiz-add-line-btn" id="wiz-add-line">＋ Agregar otra fila</button>
      <div class="wiz-totals-bar">
        <label class="wiz-iva-toggle">
          <input type="checkbox" id="wiz-chk-iva-step5" ${wState.iva.enabled ? 'checked' : ''}/>
          + IVA (13%)
        </label>
        <div class="wiz-disc-input">
          <label>Desc %</label>
          <input class="wiz-input" id="wiz-discount" type="number" value="${wState.discount.value}"/>
        </div>
        <div class="wiz-live-total" id="wiz-live-total">${fmtMoney(calcWizardTotal())}</div>
      </div>
    </div>
  `;
}

function renderStep4() {
  const total = calcWizardTotal();
  const title = wState.docKind === 'orden' ? 'Orden de Trabajo' : wState.docKind === 'cotizacion' ? 'Cotización' : 'Documento';
  
  const showFactFields = wState.convertFactura || wState.iva.enabled;

  return `
    <div class="wiz-review-container">
      <h2 class="wiz-review-title">Revisión Final</h2>
      <p class="wiz-review-subtitle">Verifica que todo esté correcto antes de emitir.</p>
      
      <label class="wiz-fact-toggle ${wState.convertFactura?'checked':''}">
        <input type="checkbox" id="wiz-chk-factura" ${wState.convertFactura ? 'checked' : ''}/>
        <div>
          <div class="wiz-fact-toggle-title">Generar Factura</div>
          <div class="wiz-fact-toggle-desc">El documento se emitirá formalmente para fines contables y fiscales.</div>
        </div>
      </label>

      ${showFactFields ? `
        <div class="wiz-fact-fields">
          <div class="wiz-fact-fields-title">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
            Datos Fiscales
          </div>
          <div class="wiz-form-grid">
            <div class="wiz-field" style="grid-column:span 6;">
              <label class="wiz-label">Tipo de Cédula</label>
              <div class="wiz-eq-select-wrap">
                <select class="wiz-eq-select" id="wiz-fact-tipo">
                  <option value="fisica" ${wState.clientFact?.fact_tipo_id==='fisica'?'selected':''}>Física (9 dígitos)</option>
                  <option value="juridica" ${wState.clientFact?.fact_tipo_id==='juridica'?'selected':''}>Jurídica (10 dígitos)</option>
                  <option value="DIMEX" ${wState.clientFact?.fact_tipo_id==='DIMEX'?'selected':''}>DIMEX</option>
                </select>
                <div class="wiz-eq-select-arrow">▼</div>
              </div>
            </div>
            <div class="wiz-field" style="grid-column:span 6;">
              <label class="wiz-label">Cédula</label>
              <input class="wiz-input" id="wiz-fact-cedula" value="${esc(wState.clientCedula || wState.clientFact?.fact_numero_id || '')}" placeholder="Sin guiones"/>
            </div>
            <div class="wiz-field" style="grid-column:span 12;">
              <label class="wiz-label">Correo para Factura</label>
              <input class="wiz-input" id="wiz-fact-email" value="${esc(wState.clientEmail || wState.clientFact?.fact_email || '')}"/>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="wiz-review-summary">
        <div class="wiz-review-summary-top">
          <div>
            <div class="wiz-review-label">Tipo de Emisión</div>
            <div class="wiz-review-type">${wState.convertFactura ? 'Factura Electrónica' : title}</div>
          </div>
          <div style="text-align:right;">
            <div class="wiz-review-label">Total a Cobrar</div>
            <div class="wiz-review-total">${fmtMoney(total)}</div>
          </div>
        </div>
        <div>
          <div class="wiz-review-label">Cliente</div>
          <div class="wiz-review-client">${esc(wState.clientName || 'Consumidor Final')} ${wState.clientCompany ? `<span class="wiz-review-company">(${esc(wState.clientCompany)})</span>` : ''}</div>
          <div class="wiz-review-items">${wState.lines.filter(l => l.descripcion).length} ítems en la orden.</div>
        </div>
      </div>
    </div>
  `;
}

function calcWizardTotal() {
  const sub = wState.lines.reduce((a,l) => a + (Number(l.precio)||0)*(Number(l.cantidad)||0), 0);
  const discVal = Number(wState.discount.value) || 0;
  const net = sub * (1 - discVal/100);
  return net * (1 + (wState.iva.enabled ? Number(wState.iva.value)/100 : 0));
}

// -- Eventos e Interacciones --

function bindWizardEvents() {
  const btnPrev = document.getElementById('btn-wiz-prev');
  const btnNext = document.getElementById('btn-wiz-next');
  const btnSave = document.getElementById('btn-wiz-save');

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      saveCurrentStepData();
      if (wState.step > 1) { wState.step--; renderWizard(); }
    });
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      saveCurrentStepData();
      
      if (wState.step === 1 && !wState.clientName.trim()) {
        toast('Debes ingresar al menos el nombre del cliente.', 'warn');
        document.getElementById('wiz-cli-name')?.focus();
        return;
      }
      
      const stepServicios = wState.docKind === 'orden' ? 5 : 3;
      if (wState.step === stepServicios && !wState.lines.some(l => l.descripcion.trim())) {
        toast('Debes ingresar al menos un servicio o producto.', 'warn');
        return;
      }

      const maxSteps = wState.docKind === 'orden' ? 6 : 4;
      if (wState.step < maxSteps) { wState.step++; renderWizard(); }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      saveCurrentStepData(); // Guardar lo de step 4

      const btn = btnSave;
      btn.disabled = true;
      btn.innerHTML = '<span class="boot-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px;"></span> Emitiendo...';
      
      try {
        // Generar número de documento al guardar (no antes)
        if (wState.convertFactura) {
          wState.docKind = 'factura';
          // Generar consecutivo y clave numérica de Hacienda para factura electrónica
          if (wState.clientId) {
            try {
              const { generarFacturaHacienda } = await import('../lib/hacienda.js');
              const facData = await generarFacturaHacienda(wState.clientId);
              wState.docNum = facData.consecutivo;
              wState.claveHacienda = facData.clave;
            } catch(e) {
              console.warn('No se pudo generar factura Hacienda:', e);
              // Fallback: usar número normal
              wState.docNum = await sugerirSiguienteNumero('factura', wState.clientId);
            }
          } else {
            wState.docNum = await sugerirSiguienteNumero('factura');
          }
        } else {
          // OT o COT: generar número con formato Hacienda si hay cliente
          if (wState.clientId) {
            wState.docNum = await sugerirSiguienteNumero(wState.docKind, wState.clientId);
          } else {
            wState.docNum = await sugerirSiguienteNumero(wState.docKind);
          }
        }

        wState.workItems = wState.tareasRealizadas.map((t, idx) => ({ tarea_num: idx + 1, descripcion: t, realizada: true }));

        const result = await guardarDocumentoCompleto(wState, null, wState.clientId);
        toast('Documento emitido correctamente ✨', 'success');
        window.location.hash = '/documentos/' + result.documentoId + '/comprobante';
      } catch (err) {
        btn.disabled = false;
        btn.innerHTML = '✨ Emitir Documento';
        toast('Error al guardar: ' + err.message, 'error');
      }
    });
  }

  if (wState.step === 1) bindStep1Events();
  if (wState.docKind === 'orden') {
    if (wState.step === 2) bindStepEquiposEvents();
    if (wState.step === 3) bindStep2Events();
    if (wState.step === 4) bindStepTareasEvents();
    if (wState.step === 5) bindStep3Events();
    if (wState.step === 6) bindStep4Events();
  } else {
    if (wState.step === 2) bindStep2Events();
    if (wState.step === 3) bindStep3Events();
    if (wState.step === 4) bindStep4Events();
  }
}

function saveCurrentStepData() {
  if (wState.step === 1) {
    wState.date = document.getElementById('wiz-cli-date')?.value || wState.date;
    wState.clientName = document.getElementById('wiz-cli-name')?.value || '';
    wState.clientCompany = document.getElementById('wiz-cli-company')?.value || '';
    wState.clientPhone = document.getElementById('wiz-cli-phone')?.value || '';
    wState.clientEmail = document.getElementById('wiz-cli-email')?.value || '';
    wState.clientType = document.getElementById('wiz-cli-type')?.value || 'residencial';
  }
  else if (wState.docKind === 'orden' && wState.step === 2) {
    document.querySelectorAll('.wiz-eq-select').forEach(sel => {
      const val = sel.value;
      if (val === '__new__') return;
      const idx = parseInt(sel.getAttribute('data-eq-idx'), 10);
      const field = sel.getAttribute('data-field');
      if (!wState.equipos[idx]) wState.equipos[idx] = {};
      wState.equipos[idx][field] = val;
    });
  }
  else if ((wState.docKind === 'orden' && wState.step === 3) || (wState.docKind !== 'orden' && wState.step === 2)) {
    if (wState.docKind === 'orden') {
      wState.problem = document.getElementById('wiz-problem')?.value || '';
      wState.diagnosis = document.getElementById('wiz-diagnosis')?.value || '';
      wState.timeIn = document.getElementById('wiz-time-in')?.value || '';
      wState.timeOut = document.getElementById('wiz-time-out')?.value || '';
    } else {
      wState.observations = document.getElementById('wiz-observations')?.value || '';
      wState.tiempoEstimado = document.getElementById('wiz-tiempo-estimado')?.value || '';
    }
  }
  else if ((wState.docKind === 'orden' && wState.step === 5) || (wState.docKind !== 'orden' && wState.step === 3)) {
    // Guardar IVA y descuento del paso de servicios
    const chkIva = document.getElementById('wiz-chk-iva-step5');
    if (chkIva) {
      wState.iva.enabled = chkIva.checked;
      wState.iva.value = chkIva.checked ? 13 : 0;
    }
    const discInput = document.getElementById('wiz-discount');
    if (discInput) {
      wState.discount.value = parseFloat(discInput.value) || 0;
    }
  }
  else if ((wState.docKind === 'orden' && wState.step === 6) || (wState.docKind !== 'orden' && wState.step === 4)) {
    if (wState.convertFactura && wState.iva.enabled) {
      wState.clientFact.fact_tipo_id = document.getElementById('wiz-fact-tipo')?.value || '';
      wState.clientCedula = document.getElementById('wiz-fact-cedula')?.value || '';
      wState.clientEmail = document.getElementById('wiz-fact-email')?.value || '';
      // Validar cédula según tipo
      const tipoId = wState.clientFact.fact_tipo_id;
      const cedula = wState.clientCedula.replace(/\D/g, '');
      if (cedula) {
        const validLengths = { fisica: 9, juridica: 10, DIMEX: [11, 12] };
        const expected = validLengths[tipoId];
        if (expected) {
          const valid = Array.isArray(expected) ? expected.includes(cedula.length) : cedula.length === expected;
          if (!valid) {
            toast(`Cédula ${tipoId} debe tener ${Array.isArray(expected) ? expected.join(' o ') : expected} dígitos`, 'warn');
          }
        }
      }
    }
  }
}

function bindStepEquiposEvents() {
  document.querySelectorAll('.wiz-eq-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const eqIdx = parseInt(e.target.getAttribute('data-eq-idx'), 10);
      const fieldName = e.target.getAttribute('data-field');

      if (e.target.value === '__new__') {
        const newVal = prompt(`Ingrese el nuevo valor para ${fieldName}:`);
        if (newVal && newVal.trim() !== '') {
          const val = newVal.trim();
          const custom = JSON.parse(localStorage.getItem('innovio:custom_fields') || '{}');
          if (!custom[fieldName]) custom[fieldName] = [];
          if (!custom[fieldName].includes(val)) {
            custom[fieldName].push(val);
            localStorage.setItem('innovio:custom_fields', JSON.stringify(custom));
          }
          wState.equipos[eqIdx][fieldName] = val;
          toast('Opción agregada exitosamente', 'success');
        } else {
          e.target.value = '';
          wState.equipos[eqIdx][fieldName] = '';
        }
      } else {
        wState.equipos[eqIdx][fieldName] = e.target.value;
      }

      // Re-renderizar los selects de este equipo para actualizar opciones en cascada
      refreshEquipoSelects(eqIdx);
    });
  });

  document.getElementById('wiz-add-equipo')?.addEventListener('click', () => {
    saveCurrentStepData();
    wState.equipos.push({});
    renderWizard();
  });

  document.querySelectorAll('.btn-remove-equipo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      saveCurrentStepData();
      const idx = parseInt(e.target.dataset.idx, 10);
      wState.equipos.splice(idx, 1);
      renderWizard();
    });
  });
}

// Re-renderiza solo los selects de un equipo específico sin re-renderizar toda la página
function refreshEquipoSelects(eqIdx) {
  const GROUPS = [
    { keys: ['DISPOSITIVO', 'FABRICANTE', 'MODELO', 'S.O.', 'BIOS/UEFI'] },
    { keys: ['CPU MARCA', 'CPU MODELO', 'RAM TIPO', 'RAM CAPACIDAD', 'RAM GEN', 'RAM VELOCIDAD'] },
    { keys: ['DISCO TIPO', 'DISCO CAPACIDAD', 'DISCO MARCA'] }
  ];
  const allKeys = GROUPS.flatMap(g => g.keys);
  const eq = wState.equipos[eqIdx] || {};

  allKeys.forEach(k => {
    const sel = document.querySelector(`.wiz-eq-select[data-eq-idx="${eqIdx}"][data-field="${k}"]`);
    if (!sel) return;

    let customOptions = [];
    try { customOptions = JSON.parse(localStorage.getItem('innovio:custom_fields') || '{}')[k] || []; } catch(e) {}
    const allOptions = [...(FIELD_OPTIONS[k] || []), ...customOptions];
    const val = eq[k] || '';
    const filteredOptions = getFilteredOptions(k, eq, allOptions);
    const optionsToShow = (val && !filteredOptions.includes(val))
      ? [val, ...filteredOptions]
      : filteredOptions;

    // Preservar el focus si este select lo tenía
    const wasFocused = document.activeElement === sel;

    sel.innerHTML = `
      <option value="" ${val===''?'selected':''}>Seleccionar...</option>
      ${optionsToShow.map(opt => `<option value="${esc(opt)}" ${val===opt?'selected':''}>${esc(opt)}</option>`).join('')}
      <option value="__new__" style="font-weight:bold; color:var(--teal);">[ ➕ Nuevo... ]</option>
    `;

    if (wasFocused) sel.focus();
  });
}

function bindStep2Events() {
  // Empty since we moved inputs reading to saveCurrentStepData
}

function bindStep1Events() {
  const cliSearch = document.getElementById('wiz-cli-search');
  const cliResults = document.getElementById('wiz-cli-results');
  
  if (cliSearch && cliResults) {
    cliSearch.addEventListener('input', debounce(async (e) => {
      const q = e.target.value.trim();
      cliResults.style.display = 'none';
      cliResults.innerHTML = '';
      if (q.length < 2) return;
      try {
        const found = await buscarClientes(q, 5);
        if (!found.length) return;
        cliResults.innerHTML = found.map(c => {
          const initial = (c.nombre || '?')[0].toUpperCase();
          return `
          <div class="cli-result-item" data-id="${c.id}">
            <div class="cli-result-avatar">${initial}</div>
            <div class="cli-result-info">
              <div class="cli-result-name">${esc(c.nombre)}</div>
              <div class="cli-result-detail">${esc(c.empresa || '')} ${c.telefono ? '• '+esc(c.telefono) : ''}</div>
            </div>
          </div>
        `}).join('');
        cliResults.querySelectorAll('.cli-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            const id = item.dataset.id;
            try {
              // Buscar perfil completo con datos de facturación
              const fullProfile = await obtenerCliente(id);
              if (!fullProfile) return;
              
              wState.clientId = fullProfile.id;
              wState.clientName = fullProfile.nombre || '';
              wState.mainContactName = fullProfile.nombre || '';
              wState.clientCompany = fullProfile.empresa || '';
              wState.clientPhone = fullProfile.telefono || '';
              wState.clientEmail = fullProfile.email || '';
              wState.clientCedula = fullProfile.cedula || '';
              wState.clientType = fullProfile.tipo_cliente || 'residencial';
              wState.authUsers = Array.isArray(fullProfile.usuarios_autorizados) ? fullProfile.usuarios_autorizados : [];
              
              // Extraer datos de facturación explícitamente
              wState.clientFact = {
                fact_tipo_id: fullProfile.fact_tipo_id || '',
                fact_numero_id: fullProfile.fact_numero_id || fullProfile.cedula || '',
                fact_nombre: fullProfile.fact_nombre || '',
                fact_email: fullProfile.fact_email || fullProfile.email || '',
                fact_telefono: fullProfile.fact_telefono || '',
                fact_regimen: fullProfile.fact_regimen || '',
                fact_actividad: fullProfile.fact_actividad || '',
                fact_provincia: fullProfile.fact_provincia || '',
                fact_canton: fullProfile.fact_canton || '',
                fact_distrito: fullProfile.fact_distrito || '',
                fact_otras_senas: fullProfile.fact_otras_senas || ''
              };

              // El número se generará al emitir el documento
              toast('Perfil de cliente cargado', 'success');
              renderWizard(); // Re-render para mostrar el check verde si tiene datos fact.
            } catch(e) {
              console.error("Error al obtener perfil:", e);
              toast('No se pudo cargar el perfil completo', 'error');
            }
          });
        });
        cliResults.style.display = 'block';
      } catch (err) {}
    }, 300));

    document.addEventListener('click', (ev) => { 
      if (!cliSearch.contains(ev.target) && !cliResults.contains(ev.target)) cliResults.style.display = 'none'; 
    });
  }

  // Refrescar al cambiar el tipo para actualizar el label
  document.getElementById('wiz-cli-type')?.addEventListener('change', (e) => {
    saveCurrentStepData();
    wState.clientType = e.target.value;
    renderWizard();
  });

  // Autocompletado de Email y Teléfono al seleccionar Usuario Autorizado
  const cliNameInput = document.getElementById('wiz-cli-name');
  if (cliNameInput) {
    cliNameInput.addEventListener('input', (e) => {
      const selectedName = e.target.value.trim();
      if (wState.clientType === 'empresarial' && wState.authUsers && wState.authUsers.length > 0) {
        const foundUser = wState.authUsers.find(u => 
          (typeof u === 'string' ? u : (u.nombre || u.name || '')) === selectedName
        );
        
        if (foundUser && typeof foundUser === 'object') {
          const phoneInput = document.getElementById('wiz-cli-phone');
          const emailInput = document.getElementById('wiz-cli-email');
          
          let updated = false;
          if (foundUser.telefono && phoneInput) {
            phoneInput.value = foundUser.telefono;
            wState.clientPhone = foundUser.telefono;
            updated = true;
          }
          if (foundUser.email && emailInput) {
            emailInput.value = foundUser.email;
            wState.clientEmail = foundUser.email;
            updated = true;
          }
          if (updated) {
            toast('Contacto autocompletado ✨', 'success');
          }
        }
      }
    });
  }
}

function bindStep3Events() {
  const container = document.getElementById('wiz-lines-container');
  if (container) {
    // Escuchar dropdown de servicios en OT
    document.querySelectorAll('.wiz-service-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const idx = parseInt(e.target.dataset.idx, 10);
        const val = e.target.value;
        if (val === '__new__') {
          const desc = prompt("Descripción del servicio manual:");
          if (desc && desc.trim() !== '') {
            wState.lines[idx].descripcion = desc.trim();
            wState.lines[idx].codigo = '__manual__';
            // Dejar el precio intacto para que el usuario lo escriba
          } else {
            wState.lines[idx].descripcion = '';
            wState.lines[idx].codigo = '';
            wState.lines[idx].precio = 0;
          }
          renderWizard();
        } else if (val !== '') {
          const svc = wState.availableServices.find(s => String(s.id) === val);
          if (svc) {
            wState.lines[idx].descripcion = svc.nombre;
            wState.lines[idx].codigo = svc.codigo || '';
            const precioFinal = wState.clientType === 'empresarial' 
              ? (svc.precio_empresarial || svc.precio_residencial || svc.precio || 0)
              : (svc.precio_residencial || svc.precio || 0);
            wState.lines[idx].precio = precioFinal;
            renderWizard();
          }
        }
      });
    });

    // Escuchar inputs manuales
    container.addEventListener('input', (e) => {
      if (e.target.classList.contains('wiz-line-desc')) {
        handleInventarioAutocomplete(e.target);
      }
      
      const row = e.target.closest('.wiz-line-row');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      const field = e.target.dataset.field;
      if (idx >= 0 && field && !e.target.classList.contains('wiz-service-select')) {
        const val = field === 'descripcion' ? e.target.value : parseFloat(e.target.value) || 0;
        wState.lines[idx][field] = val;
        updateLiveTotal();
      }
    });

    // Mostrar resultados al hacer focus si ya hay texto
    container.addEventListener('focusin', (e) => {
      if (e.target.classList.contains('wiz-line-desc') && e.target.value.trim().length >= 2) {
        handleInventarioAutocomplete(e.target);
      }
    });

    // Cerrar resultados con Escape
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.classList.contains('wiz-line-desc')) {
        const row = e.target.closest('.wiz-line-row');
        const resultsDiv = row?.querySelector('.inv-results');
        if (resultsDiv) resultsDiv.style.display = 'none';
      }
    });

    // Eliminar línea

    // Eliminar línea
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove-line');
      if (!btn) return;
      const row = btn.closest('.wiz-line-row');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      if (wState.lines.length === 1) {
        wState.lines[0] = { descripcion: '', cantidad: 1, precio: 0, codigo: '' };
      } else {
        wState.lines.splice(idx, 1);
      }
      renderWizard(); 
    });
  }

  document.getElementById('wiz-add-line')?.addEventListener('click', () => {
    wState.lines.push({ descripcion: '', cantidad: 1, precio: 0, codigo: '' });
    renderWizard(); 
  });

  document.getElementById('wiz-discount')?.addEventListener('input', (e) => {
    wState.discount.value = parseFloat(e.target.value) || 0;
    updateLiveTotal();
  });

  // ── Acordeón de catálogo (solo cotización) ──
  const accordion = document.getElementById('wiz-catalog-accordion');
  if (accordion) {
    const catDataCache = { servicios: null, productos: null, tareas: null };
    const catLoaded = { servicios: false, productos: false, tareas: false };

    async function loadCatalogSection(section) {
      if (catLoaded[section]) return catDataCache[section];
      catLoaded[section] = true;
      try {
        const supabase = await getSupabase();
        if (section === 'tareas') {
          const tipoCliente = wState.clientType === 'empresarial' ? 'empresarial' : 'residencial';
          const tareasList = TAREAS_DATA[tipoCliente] || [];
          const allTareas = [];
          for (const cat of tareasList) {
            for (const child of (cat.children || [])) {
              allTareas.push({ nombre: child, categoria: cat.title, esTarea: true });
            }
          }
          catDataCache[section] = allTareas;
        } else {
          const tipoFilter = section === 'productos' ? 'producto' : 'servicio';
          const { data } = await supabase.from('catalogo_servicios')
            .select('*')
            .eq('activo', true)
            .eq('tipo', tipoFilter)
            .order('nombre');
          catDataCache[section] = data || [];
        }
      } catch(e) {
        console.warn('Error cargando catálogo:', e);
        catDataCache[section] = [];
      }
      return catDataCache[section];
    }

    function renderCatalogItems(section, items, query) {
      const body = document.getElementById(`wiz-cat-${section}-body`);
      const count = document.getElementById(`wiz-cat-${section}-count`);
      if (!body) return;

      let filtered = items;
      if (query) {
        const q = query.toLowerCase();
        filtered = items.filter(item => {
          const nombre = (item.nombre || '').toLowerCase();
          const codigo = (item.codigo || '').toLowerCase();
          const categoria = (item.categoria || '').toLowerCase();
          return nombre.includes(q) || codigo.includes(q) || categoria.includes(q);
        });
      }

      if (count) count.textContent = filtered.length > 0 ? `(${filtered.length})` : '';

      if (filtered.length === 0) {
        body.innerHTML = '<div class="wiz-cat-empty">No se encontraron resultados</div>';
        return;
      }

      // Agrupar por categoría si existe
      const hasCategories = filtered.some(i => i.categoria);
      if (hasCategories) {
        const groups = {};
        filtered.forEach(item => {
          const cat = item.categoria || 'Sin categoría';
          if (!groups[cat]) groups[cat] = [];
          groups[cat].push(item);
        });
        body.innerHTML = Object.entries(groups).map(([catName, catItems]) => `
          <div class="wiz-cat-group-title">${esc(catName)}</div>
          ${catItems.map(item => renderItemHTML(item, section)).join('')}
        `).join('');
      } else {
        body.innerHTML = filtered.map(item => renderItemHTML(item, section)).join('');
      }

      // Bind clicks
      body.querySelectorAll('.wiz-cat-item').forEach(el => {
        el.addEventListener('click', () => {
          const id = el.dataset.id;
          const tareaNombre = el.dataset.tarea;
          const isTarea = !!tareaNombre;

          if (isTarea) {
            wState.lines.push({ descripcion: tareaNombre, cantidad: 1, precio: 0, codigo: '' });
          } else {
            const item = catDataCache[section]?.find(x => String(x.id) === id);
            if (!item) return;
            const precioFinal = wState.clientType === 'empresarial'
              ? (item.precio_empresarial || item.precio_residencial || item.precio || 0)
              : (item.precio_residencial || item.precio || 0);
            wState.lines.push({
              descripcion: item.nombre,
              cantidad: 1,
              precio: precioFinal,
              codigo: item.codigo || ''
            });
          }
          renderWizard();
          toast('Item agregado', 'success');
        });
      });
    }

    function renderItemHTML(item, section) {
      const isTarea = item.esTarea === true;
      const badgeClass = isTarea ? 'wiz-cat-badge-task'
        : section === 'productos' ? 'wiz-cat-badge-prod'
        : 'wiz-cat-badge-svc';
      const badgeText = isTarea ? '📋 Tarea'
        : section === 'productos' ? '📦 Producto'
        : '🔧 Servicio';
      const precio = isTarea ? 0 : (wState.clientType === 'empresarial'
        ? (item.precio_empresarial || item.precio_residencial || item.precio || 0)
        : (item.precio_residencial || item.precio || 0));
      const precioHTML = isTarea
        ? '<span style="font-size:10px; color:var(--text-soft);">Sin precio</span>'
        : `<span class="wiz-cat-item-price">${fmtMoney(precio)}</span>`;
      const dataAttr = isTarea ? `data-tarea="${esc(item.nombre)}"` : `data-id="${item.id}"`;
      const codigoInfo = !isTarea && item.codigo ? `[${esc(item.codigo)}] ` : '';
      const stockInfo = !isTarea && item.stock != null && section === 'productos'
        ? ` · ${item.stock > 0 ? item.stock + ' en stock' : 'Sin stock'}`
        : '';
      return `
        <div class="wiz-cat-item" ${dataAttr}>
          <div class="wiz-cat-item-info">
            <div class="wiz-cat-item-name">${esc(item.nombre)}</div>
            <div class="wiz-cat-item-meta">
              <span class="wiz-cat-badge ${badgeClass}">${badgeText}</span>
              ${codigoInfo}${stockInfo}
            </div>
          </div>
          ${precioHTML}
        </div>`;
    }

    // Toggle secciones
    ['servicios', 'productos', 'tareas'].forEach(section => {
      const header = document.getElementById(`wiz-cat-${section}-header`);
      if (!header) return;
      header.addEventListener('click', async () => {
        const body = document.getElementById(`wiz-cat-${section}-body`);
        const sectionEl = header.closest('.wiz-cat-section');
        const isOpen = body.style.display !== 'none';

        // Cerrar todas
        ['servicios', 'productos', 'tareas'].forEach(s => {
          const b = document.getElementById(`wiz-cat-${s}-body`);
          const se = document.getElementById(`wiz-cat-${s}-header`)?.closest('.wiz-cat-section');
          if (b) b.style.display = 'none';
          if (se) se.classList.remove('open');
        });

        if (!isOpen) {
          // Abrir esta
          sectionEl.classList.add('open');
          body.style.display = 'block';
          body.innerHTML = '<div class="wiz-cat-empty">Cargando...</div>';
          const items = await loadCatalogSection(section);
          const searchInput = document.getElementById('wiz-catalog-search');
          const query = searchInput?.value?.trim() || '';
          renderCatalogItems(section, items, query);
        }
      });
    });

    // Buscador
    const searchInput = document.getElementById('wiz-catalog-search');
    if (searchInput) {
      let searchTimeout;
      searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          const query = e.target.value.trim();
          // Encontrar la sección abierta
          for (const section of ['servicios', 'productos', 'tareas']) {
            const body = document.getElementById(`wiz-cat-${section}-body`);
            if (body && body.style.display !== 'none') {
              const items = catDataCache[section] || [];
              renderCatalogItems(section, items, query);
              break;
            }
          }
        }, 200);
      });
    }
  }

  const chkIvaStep5 = document.getElementById('wiz-chk-iva-step5');
  if (chkIvaStep5) {
    chkIvaStep5.addEventListener('change', (e) => {
      saveCurrentStepData();
      wState.iva.enabled = e.target.checked;
      wState.iva.value = 13;
      if (wState.iva.enabled) {
        wState.convertFactura = true;
        // Auto-llenar datos de facturación desde el perfil del cliente
        if (wState.clientFact?.fact_tipo_id) {
          wState.clientCedula = wState.clientFact.fact_numero_id || wState.clientCedula || '';
          wState.clientEmail = wState.clientFact.fact_email || wState.clientEmail || '';
          toast('Datos de facturación cargados del perfil del cliente', 'success');
        } else if (wState.clientId) {
          toast('El cliente no tiene datos fiscales completos en su perfil', 'error');
        } else {
          toast('Seleccione un cliente para auto-completar datos fiscales', 'error');
        }
      }
      updateLiveTotal();
    });
  }
}

// Búsqueda inteligente en el catálogo + tareas
let invTimeout;
async function handleInventarioAutocomplete(inputEl) {
  const row = inputEl.closest('.wiz-line-row');
  const resultsDiv = row.querySelector('.inv-results');
  const idx = parseInt(row.dataset.idx, 10);
  const q = inputEl.value.trim().toLowerCase();
  
  if (q.length < 2) {
    resultsDiv.style.display = 'none';
    return;
  }

  const safeQ = q.replace(/[%_]/g, m => '\\' + m);

  clearTimeout(invTimeout);
  invTimeout = setTimeout(async () => {
    try {
      const supabase = await getSupabase();
      // Buscar en catálogo (productos y servicios)
      const { data } = await supabase.from('catalogo_servicios')
        .select('*')
        .eq('activo', true)
        .or(`nombre.ilike.%${safeQ}%,codigo.ilike.%${safeQ}%`)
        .limit(6);

      // Buscar en TAREAS_DATA localmente
      const tipoCliente = wState.clientType === 'empresarial' ? 'empresarial' : 'residencial';
      const tareasList = TAREAS_DATA[tipoCliente] || [];
      const tareasMatch = [];
      for (const cat of tareasList) {
        if (cat.title.toLowerCase().includes(q)) {
          tareasMatch.push({ nombre: cat.title, categoria: cat.title, esTarea: true });
        }
        for (const child of (cat.children || [])) {
          if (child.toLowerCase().includes(q)) {
            tareasMatch.push({ nombre: child, categoria: cat.title, esTarea: true });
          }
        }
      }
      const tareasTop = tareasMatch.slice(0, 4);

      const allResults = [...(data || []), ...tareasTop];

      if (!allResults.length) {
        resultsDiv.style.display = 'none';
        return;
      }

      resultsDiv.innerHTML = allResults.map(item => {
        const isTarea = item.esTarea === true;
        const isProduct = !isTarea && item.tipo === 'producto';
        const isService = !isTarea && !isProduct;
        const badgeStyle = isTarea
          ? 'background:#fef3c7;color:#92400e;'
          : isProduct
          ? 'background:#e0f2fe;color:#0284c7;'
          : 'background:#dcfce7;color:#166534;';
        const badgeText = isTarea ? '📋 Tarea' : isProduct ? '📦 Producto' : '🔧 Servicio';
        const stockInfo = isProduct && item.stock != null
          ? ` · ${item.stock > 0 ? item.stock + ' en stock' : 'Sin stock'}`
          : '';
        const precio = isTarea ? 0 : (wState.clientType === 'empresarial'
          ? (item.precio_empresarial || item.precio_residencial || item.precio || 0)
          : (item.precio_residencial || item.precio || 0));
        const precioHTML = isTarea
          ? '<span style="font-size:10px; color:var(--text-soft); font-weight:500;">Sin precio</span>'
          : `<span style="font-weight:700; color:var(--navy); font-size:var(--fs-sm);">${fmtMoney(precio)}</span>`;
        const dataAttr = isTarea ? `data-tarea="${esc(item.nombre)}"` : `data-id="${item.id}"`;
        return `
        <div class="inv-result-item" ${dataAttr} style="padding:6px 10px; cursor:pointer; border-bottom:1px solid #eef2f7; display:flex; justify-content:space-between; align-items:center;"
             onmouseenter="this.style.background='#f0f6ff'" onmouseleave="this.style.background='transparent'">
          <div>
            <div style="font-weight:700; color:var(--text); font-size:var(--fs-sm);">${esc(item.nombre)}</div>
            <div style="font-size:10px; color:var(--text-soft);">
              <span style="display:inline-block; padding:1px 6px; border-radius:4px; font-weight:700; font-size:9px; ${badgeStyle}">${badgeText}</span>
              ${!isTarea && item.codigo ? `[${esc(item.codigo)}] ` : ''}${esc(item.categoria || '')}${stockInfo}
            </div>
          </div>
          ${precioHTML}
        </div>`;
      }).join('');

      resultsDiv.querySelectorAll('.inv-result-item').forEach(li => {
        li.addEventListener('click', () => {
          const tareaNombre = li.dataset.tarea;
          if (tareaNombre) {
            wState.lines[idx].descripcion = tareaNombre;
            wState.lines[idx].codigo = '';
            wState.lines[idx].precio = 0;
            resultsDiv.style.display = 'none';
            renderWizard();
            toast('Tarea agregada', 'success');
            return;
          }
          const id = li.dataset.id;
          const selectedItem = (data || []).find(x => String(x.id) === id);
          if (!selectedItem) return;
          
          const precioFinal = wState.clientType === 'empresarial' 
              ? (selectedItem.precio_empresarial || selectedItem.precio_residencial || selectedItem.precio || 0)
              : (selectedItem.precio_residencial || selectedItem.precio || 0);

          wState.lines[idx].descripcion = selectedItem.nombre;
          wState.lines[idx].codigo = selectedItem.codigo || '';
          wState.lines[idx].precio = precioFinal;
          
          resultsDiv.style.display = 'none';
          renderWizard();
          toast('Producto/Servicio agregado', 'success');
        });
      });
      resultsDiv.style.display = 'block';
      
      document.addEventListener('click', function closeInv(ev) { 
        if (!inputEl.contains(ev.target) && !resultsDiv.contains(ev.target)) {
          resultsDiv.style.display = 'none'; 
          document.removeEventListener('click', closeInv);
        }
      });
    } catch(e) {
      console.error(e);
    }
  }, 250);
}


async function showVistaPreviaModal() {
  const total = calcWizardTotal();
  const sub = wState.lines.reduce((a,l) => a + (Number(l.precio)||0)*(Number(l.cantidad)||0), 0);
  const desc = sub * (Number(wState.discount.value) || 0) / 100;
  const net = sub - desc;
  const iva = wState.iva.enabled ? (net * Number(wState.iva.value) / 100) : 0;
  
  const title = wState.docKind === 'orden' ? 'ORDEN DE TRABAJO' : wState.docKind === 'cotizacion' ? 'COTIZACIÓN' : 'DOCUMENTO';
  const cNombre = wState.clientCompany || wState.clientName || 'Consumidor Final';
  const cSub = wState.clientCompany ? wState.clientName : '';
  const cId = wState.clientCedula || wState.clientFact?.fact_numero_id || '';
  const cTel = wState.clientPhone || '';
  const cEmail = wState.clientEmail || '';
  const docDateStr = wState.date || new Date().toISOString().split('T')[0];
  const factBadge = '';
  
  // Proyectar número de documento para la vista previa (sin consumir consecutivo)
  let previewDocNum = wState.docNum;
  if (!previewDocNum) {
    try {
      previewDocNum = await proyectarNumeroDocumento(wState.docKind, wState.clientId);
    } catch(e) {
      console.warn('No se pudo proyectar número:', e);
    }
  }
  
  // Si no tiene datos de facturacion
  const warningBadge = (!cId || cId === '000000000') ? '<div style="background:#fef08a; color:#b45309; font-size:10px; padding:3px 8px; border-radius:4px; font-weight:800; display:inline-block; margin-top:6px;">⚠️ SIN DATOS DE FACTURACIÓN ELECTRÓNICA</div>' : factBadge;

  const sym = '₡';
  function fmtMoney(n) { return sym + ' ' + (n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2 }); }

  const css = `
    :root {
      --brand-blue: #0b244e;
      --brand-blue-light: #114188;
      --text-main: #2d3748;
      --text-muted: #718096;
      --text-light: #a0aec0;
      --border-color: #e2e8f0;
      --green: #16a34a;
      --red: #dc2626;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', 'Segoe UI', sans-serif; background: #e6eaf0; font-size: 13px; color: var(--text-main); line-height: 1.5; }
    .a4-sheet { background: #fff; padding: 0; font-size: 13px; color: var(--text-main); }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #0b244e 0%, #0d3266 40%, #114188 100%);
      color: #fff;
      padding: 36px 44px;
      position: relative;
      overflow: hidden;
    }
    .header::before {
      content: ''; position: absolute; right: -40px; top: -40px; width: 300px; height: 300px;
      background: radial-gradient(circle, rgba(255,255,255,0.04) 0%, transparent 70%); z-index: 1;
    }
    .header::after {
      content: ''; position: absolute; left: 0; bottom: 0; width: 100%; height: 3px;
      background: linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 50%, transparent 100%); z-index: 2;
    }
    .header-content { position: relative; z-index: 3; display: flex; width: 100%; justify-content: space-between; align-items: flex-start; gap: 30px; }
    .header-left { display: flex; flex-direction: column; gap: 14px; }
    .logo-container { display: flex; align-items: center; }
    .logo-container img { height: 80px; width: auto; max-width: 280px; object-fit: contain; filter: drop-shadow(0 3px 10px rgba(0,0,0,0.2)); }
    .contact-info { display: flex; flex-wrap: wrap; align-items: center; gap: 0; font-size: 11px; color: #cbd5e1; font-weight: 500; letter-spacing: 0.3px; }
    .contact-info .ci-item { display: flex; align-items: center; gap: 5px; padding: 0 14px; }
    .contact-info .ci-item:first-child { padding-left: 0; }
    .contact-info .ci-sep { width: 1px; height: 12px; background: rgba(255,255,255,0.2); }
    
    .header-right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 6px; min-width: 200px; }
    .doc-type { border: 1px solid rgba(255,255,255,0.25); padding: 5px 16px; border-radius: 4px; font-size: 11px; font-weight: 700; letter-spacing: 2.5px; text-transform: uppercase; color: #e2e8f0; }
    .doc-number { font-size: 22px; font-weight: 800; line-height: 1.1; color: #fff; letter-spacing: 0.5px; }
    .doc-date { font-size: 11px; color: #94a3b8; font-weight: 500; letter-spacing: 0.5px; }

    /* Content Body */
    .content-body { padding: 30px 40px; }
    
    .top-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .card { border: 1px solid var(--border-color); padding: 16px 20px; background: #f8fafc; }
    .card-title { font-size: 10px; font-weight: 700; color: var(--text-light); letter-spacing: 1.5px; margin-bottom: 8px; text-transform: uppercase; }
    .client-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
    .client-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 4px; }
    .client-contact { margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; flex-direction: column; gap: 4px; }
    
    .device-name { font-size: 16px; font-weight: 800; color: var(--text-main); }
    .device-sub { font-size: 13px; color: var(--text-muted); margin-bottom: 12px; }
    .device-tags { display: flex; flex-wrap: wrap; gap: 6px; }
    .device-tag { font-size: 10px; padding: 3px 8px; border: 1px solid var(--border-color); border-radius: 4px; background: #fff; color: var(--text-muted); }

    .section-title-wrap { display: flex; align-items: center; margin-bottom: 20px; margin-top: 20px;}
    .section-title { font-size: 11px; font-weight: 800; color: var(--text-light); letter-spacing: 2px; text-transform: uppercase; padding-right: 15px; white-space: nowrap; }
    .section-line { height: 1px; background: var(--border-color); flex-grow: 1; }

    .tarea-category { margin-bottom: 20px; }
    .cat-title { font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
    .cat-line { height: 1px; border-bottom: 1px dashed var(--border-color); flex-grow: 1; }
    
    .tarea-group { margin-bottom: 10px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0; border: 1px solid var(--border-color); border-top: none; border-left: none; }
    .group-title { font-size: 13px; font-weight: 700; color: var(--text-main); margin-bottom: 6px; position: relative; }
    .group-title::before { content: 'o'; position: absolute; left: -15px; color: var(--text-muted); font-size: 10px; top: 2px; }
    .tarea-item { font-size: 11px; padding: 6px 10px; display: flex; align-items: center; gap: 6px; border-top: 1px solid var(--border-color); border-left: 1px solid var(--border-color); line-height: 1.3; }
    .tarea-item.checked { color: var(--green); font-weight: 500; }
    .tarea-item.checked::before { content: '✔'; font-weight: 800; font-size: 10px; }
    .tarea-item.unchecked { color: var(--text-light); text-decoration: line-through; }
    .tarea-item.unchecked::before { content: '—'; }

    .writable-box {
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 16px;
      min-height: 100px;
      background: #f8fafc;
      color: #94a3b8;
      font-style: italic;
      font-size: 12px;
      margin-bottom: 20px;
    }
    .text-box {
      font-size: 13px; color: var(--text-main); margin-bottom: 20px; white-space: pre-wrap;
    }

    .tariff-table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
    .tariff-table th { background: #f8fafc; color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; padding: 10px; border-bottom: 2px solid var(--border-color); text-align: left; }
    .tariff-table td { padding: 12px 10px; border-bottom: 1px solid var(--border-color); color: var(--text-main); }
    .tariff-table th.right, .tariff-table td.right { text-align: right; }
    
    .totals-area { display: flex; justify-content: flex-end; margin-top: 20px; }
    .totals-box { width: 300px; }
    .total-line { display: flex; justify-content: space-between; padding: 6px 0; color: var(--text-muted); font-size: 13px; }
    .total-line.grand { font-size: 18px; font-weight: 800; color: var(--brand-blue); border-top: 2px solid var(--brand-blue); padding-top: 12px; margin-top: 6px; }
    
    .signatures { display: flex; justify-content: space-between; margin-top: 60px; padding: 0 40px; }
    .sig-block { width: 220px; text-align: center; }
    .sig-line { border-top: 1px solid var(--text-muted); margin-bottom: 8px; }
    .sig-label { font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }

    @media print {
      body { background: white; margin: 0; padding: 0; }
      .header, .header::before, .header::after, .card, .warning-badge { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .a4-sheet { padding: 0; }
      .content-body { padding: 30px; }
    }
  `;

  // Equipos (Iterate over all devices) — solo info básica en comprobante
  const equiposHtml = (wState.equipos && wState.equipos.length > 0) ? wState.equipos.map((eq, i) => `
    ${i > 0 ? '<div style="height:1px; background:var(--border-color); margin: 16px 0;"></div>' : ''}
    <div class="device-name">${esc(eq['DISPOSITIVO'] || 'Equipo')}</div>
    <div class="device-sub">${esc(eq['FABRICANTE'] || '')}${eq['FABRICANTE'] && eq['MODELO'] ? ' ' : ''}${esc(eq['MODELO'] || '')}</div>
    ${eq['S.O.'] ? `<div class="device-tags"><span class="device-tag">SO: ${esc(eq['S.O.'])}</span></div>` : ''}
  `).join('') : `
    <div class="device-name">Equipo No Especificado</div>
  `;

  // Trabajos Realizados
  let trabajosHtml = '';
  if (wState.tareasRealizadas && wState.tareasRealizadas.length > 0) {
    // Para simplificar, listaremos todas las tareas seleccionadas en una sola categoría "Trabajos", o agrupadas si podemos.
    // Como wState.tareasRealizadas es un array de strings (ej: "Mantenimiento Preventivo - Limpieza"), podemos agruparlas.
    trabajosHtml = `
      <div class="tarea-category">
        <div class="cat-title">🔧 TRABAJOS <div class="cat-line"></div></div>
        <div class="tarea-group">
          ${wState.tareasRealizadas.map(t => `<div class="tarea-item checked">${esc(t)}</div>`).join('')}
        </div>
      </div>
    `;
  } else {
    trabajosHtml = `<div class="text-box" style="color:var(--text-muted); font-style:italic;">No hay trabajos marcados.</div>`;
  }

  // Tariff lines
  const linesHTML = wState.lines.filter(l => l.descripcion).map(l => {
    const ltot = (Number(l.cantidad)||0) * (Number(l.precio)||0);
    return `<tr><td>${esc(l.descripcion)}</td><td class="right">${esc(l.cantidad)}</td><td class="right">${fmtMoney(l.precio)}</td><td class="right">${fmtMoney(ltot)}</td></tr>`;
  }).join('');

  const iframeSrc = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8"/>
      <style>${css}</style>
    </head>
    <body>
      <main class="a4-sheet">
        
        <div class="header">
          <div class="header-content">
            <div class="header-left">
              <div class="logo-container">
                <img src="${LOGO_DATA_URL}" alt="INNOVIO" />
              </div>
              <div class="contact-info">
                <span class="ci-item">📍 Cartago, La Unión</span>
                <span class="ci-sep"></span>
                <span class="ci-item">📱 (506) 6277 7500</span>
                <span class="ci-sep"></span>
                <span class="ci-item">✉️ innoviocr@outlook.es</span>
              </div>
            </div>
            <div class="header-right">
              <div class="doc-type">${title}</div>
              <div class="doc-number">${previewDocNum || (wState.docKind === 'cotizacion' ? 'COT-YYYY-XXX' : 'OT-YYYY-XXX')}</div>
              <div class="doc-date">${esc(docDateStr)}</div>
            </div>
          </div>
        </div>

        <div class="content-body">
          <div class="top-cards">
            <div class="card">
              <div class="card-title">CLIENTE</div>
              <div class="client-name">${esc(cNombre)}</div>
              ${cSub ? `<div class="client-sub">${esc(cSub)}</div>` : ''}
              ${warningBadge}
              <div class="client-contact">
                ${cTel ? `<div>📱 ${esc(cTel)}</div>` : ''}
                ${cEmail ? `<div>✉️ ${esc(cEmail)}</div>` : ''}
              </div>
            </div>
            ${wState.docKind === 'orden' ? `
            <div class="card">
              <div class="card-title">EQUIPO</div>
              ${equiposHtml}
            </div>
            ` : wState.tiempoEstimado ? `
            <div class="card">
              <div class="card-title">TIEMPO DE ENTREGA</div>
              <div class="client-name" style="font-size:16px;">${esc(wState.tiempoEstimado)}</div>
            </div>
            ` : ''}
          </div>

          ${wState.docKind === 'orden' ? `
          <div class="section-title-wrap">
            <div class="section-title">TRABAJOS REALIZADOS</div>
            <div class="section-line"></div>
          </div>
          
          ${trabajosHtml}

          <div class="section-title-wrap">
            <div class="section-title">DIAGNÓSTICO / OBSERVACIONES</div>
            <div class="section-line"></div>
          </div>
          
          ${(wState.diagnosis || wState.observations || wState.problem) ? `
            <div class="text-box">
              ${wState.problem ? `<strong>Problema Reportado:</strong>\n${esc(wState.problem)}\n\n` : ''}
              ${wState.diagnosis ? `<strong>Diagnóstico:</strong>\n${esc(wState.diagnosis)}\n\n` : ''}
              ${wState.observations ? `<strong>Observaciones:</strong>\n${esc(wState.observations)}` : ''}
            </div>
          ` : `
            <div class="writable-box">
              Espacio para notas, diagnóstico u observaciones del técnico...
            </div>
          `}
          ` : `
          <div class="section-title-wrap">
            <div class="section-title">CONDICIONES Y OBSERVACIONES</div>
            <div class="section-line"></div>
          </div>
          
          ${wState.observations ? `
            <div class="text-box">
              ${esc(wState.observations).replace(/\n/g, '<br>')}
            </div>
          ` : `
            <div class="writable-box">
              Espacio para condiciones y observaciones...
            </div>
          `}
          `}

          ${wState.lines && wState.lines.filter(l => l.descripcion).length > 0 ? `
            <table class="tariff-table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th class="right" style="width:80px">Cant.</th>
                  <th class="right" style="width:120px">Precio Unit.</th>
                  <th class="right" style="width:120px">Total</th>
                </tr>
              </thead>
              <tbody>${linesHTML}</tbody>
            </table>
            
            ${wState.docKind === 'orden' && wState.timeIn && wState.timeOut ? `
            <div style="margin-top:16px; margin-bottom:8px; padding:10px 16px; background:#f5f5f0; border:1px solid #d8d8d0; border-radius:8px; display:inline-block;">
              <div style="font-size:9px; font-weight:600; opacity:0.6; letter-spacing:2px; text-transform:uppercase;">⏱ Tiempo Laborado</div>
              <div style="font-size:18px; font-weight:800; color:#0a0e1a; font-family:'Syne',sans-serif;">${(() => {
                const tIn = new Date(`2000-01-01T${wState.timeIn}`);
                const tOut = new Date(`2000-01-01T${wState.timeOut}`);
                let diffMs = tOut - tIn;
                if (diffMs < 0) diffMs += 24*60*60*1000;
                const hrs = Math.floor(diffMs/3600000);
                const mins = Math.floor((diffMs%3600000)/60000);
                return `${hrs}h ${mins.toString().padStart(2,'0')}min`;
              })()}</div>
              <div style="font-size:10px; opacity:0.5; color:#4a5270;">${esc(wState.timeIn)} → ${esc(wState.timeOut)}</div>
            </div>
            ` : ''}

            <div class="totals-area" style="display:flex; justify-content:flex-end; margin-top:16px;">
              <div class="totals-box" style="min-width:240px;">
                <div class="total-line"><span>Subtotal</span><span>${fmtMoney(sub)}</span></div>
                ${desc > 0 ? `<div class="total-line"><span>Descuento (${wState.discount.value}%)</span><span>- ${fmtMoney(desc)}</span></div>` : ''}
                ${iva > 0 ? `<div class="total-line"><span>IVA (${wState.iva.value}%)</span><span>${fmtMoney(iva)}</span></div>` : ''}
                <div class="total-line grand"><span>TOTAL</span><span>${fmtMoney(net + iva)}</span></div>
              </div>
            </div>
          ` : ''}

          ${wState.docKind === 'orden' ? `
          <div class="signatures" style="justify-content:flex-start;">
            <div class="sig-block">
              <div class="sig-line"></div>
              <div class="sig-label">Firma del Técnico</div>
            </div>
          </div>
          ` : ''}

        </div>
      </main>
    </body>
    </html>
  `;

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0'; overlay.style.left = '0'; overlay.style.right = '0'; overlay.style.bottom = '0';
  overlay.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
  overlay.style.backdropFilter = 'blur(6px)';
  overlay.style.zIndex = '9999';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.padding = '20px';

  overlay.innerHTML = `
    <div style="background:#fff; border-radius:12px; width:100%; max-width:850px; height:90vh; box-shadow:0 25px 50px -12px rgba(0,0,0,0.5); display:flex; flex-direction:column; position:relative;">
      <div style="padding:12px 24px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:#f1f5f9; position:sticky; top:0; z-index:10; border-radius: 12px 12px 0 0;">
        <div style="font-weight:700; color:var(--text-muted); font-size:13px;">Vista Previa (Diseño Original V2)</div>
        <div style="display:flex; gap:12px; align-items:center;">
          <button onclick="document.getElementById('preview-iframe').contentWindow.print()" style="background:var(--brand-blue); color:white; border:none; padding:6px 16px; border-radius:6px; font-weight:600; cursor:pointer; font-size:13px; display:flex; gap:6px; align-items:center;">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
            Imprimir
          </button>
          <button id="close-preview-modal" style="background:none; border:none; font-size:24px; line-height:1; cursor:pointer; color:var(--text-muted); padding:0; margin-left:8px;">&times;</button>
        </div>
      </div>
      <iframe id="preview-iframe" srcdoc="${iframeSrc.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" style="flex:1; width:100%; border:none; border-radius:0 0 12px 12px; background:#e8e8e4;"></iframe>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#close-preview-modal').addEventListener('click', () => {
    overlay.remove();
  });
}


function updateLiveTotal() {
  const totalEl = document.getElementById('wiz-live-total');
  if (totalEl) totalEl.innerHTML = fmtMoney(calcWizardTotal());
}

function bindStep4Events() {
  const chkFactura = document.getElementById('wiz-chk-factura');
  
  if (chkFactura) {
    chkFactura.addEventListener('change', (e) => {
      saveCurrentStepData(); // Guardar campos en memoria
      wState.convertFactura = e.target.checked;
      renderWizard();
    });
  }

  const btnPreview = document.getElementById('btn-wiz-preview');
  if (btnPreview) {
    btnPreview.addEventListener('click', () => {
      showVistaPreviaModal();
    });
  }

  const chkIva = document.getElementById('wiz-chk-iva');
  if (chkIva) {
    chkIva.addEventListener('change', (e) => {
      saveCurrentStepData();
      wState.iva.enabled = e.target.checked;
      if (wState.iva.enabled) wState.iva.value = 13; // default
      else wState.iva.value = 0;
      renderWizard();
    });
  }
}

function renderStepTareas() {
  const tData = wState.clientType === 'empresarial' ? TAREAS_DATA.empresarial : TAREAS_DATA.residencial;
  if (typeof wState.activeTareaCategoryIndex === 'undefined') {
    wState.activeTareaCategoryIndex = 0;
  }
  const activeIdx = wState.activeTareaCategoryIndex;
  
  const COLORS = [
    { bg: '#dbeafe', fg: '#1e40af' }, { bg: '#dcfce7', fg: '#166534' },
    { bg: '#fae8ff', fg: '#86198f' }, { bg: '#fef3c7', fg: '#b45309' },
    { bg: '#fee2e2', fg: '#991b1b' }, { bg: '#ccfbf1', fg: '#115e59' },
    { bg: '#e0e7ff', fg: '#3730a3' }, { bg: '#ffedd5', fg: '#c2410c' }
  ];
  const col = COLORS[activeIdx % COLORS.length];

  return `
    <div class="wiz-section-title">
      <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
      Tareas Realizadas
    </div>
    <p class="wiz-section-subtitle">Selecciona la categoría y marca las tareas ejecutadas. Tus selecciones se guardan automáticamente al cambiar de categoría.</p>

    <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--r-md); padding:var(--sp-3); box-shadow:var(--shadow-xs);">
      
      <!-- Category Dropdown -->
      <div class="field" style="margin-bottom:12px; max-width:360px;">
        <label class="field-label" style="font-size:11px; color:var(--navy);">Categoría de Tareas</label>
        <div class="dev-select-wrap" style="position:relative;">
          <select class="dev-select wiz-tarea-category-select" style="height:34px; padding:0 10px; font-size:var(--fs-sm); border:1px solid var(--border); border-radius:var(--r-sm); width:100%; appearance:none; background:var(--surface-2); font-weight:600; color:var(--navy);">
            ${tData.map((cat, i) => `
              <option value="${i}" ${i === activeIdx ? 'selected' : ''}>${esc(cat.title)}</option>
            `).join('')}
          </select>
          <div class="dev-select-arrow" style="position:absolute; right:10px; top:50%; transform:translateY(-50%); pointer-events:none; font-size:10px; color:var(--text-soft);">▼</div>
        </div>
      </div>
      
      <!-- Tasks Grid -->
      <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:var(--r-sm); padding:var(--sp-3);">
        <div style="margin-bottom:10px; font-size:var(--fs-sm); font-weight:800; color:var(--navy); display:flex; align-items:center; gap:6px;">
          <span style="background:${col.bg}; color:${col.fg}; width:24px; height:24px; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:12px;">${tData[activeIdx].icon}</span>
          ${esc(tData[activeIdx].title)}
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:8px 12px;">
          ${tData[activeIdx].children.map(task => {
            const checked = wState.tareasRealizadas.includes(task) ? 'checked' : '';
            return `
              <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:var(--fs-sm); color:var(--text); padding:4px; border-radius:var(--r-xs); transition:background 0.2s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" class="wiz-tarea-chk" value="${esc(task)}" style="margin:0; accent-color:var(--accent); width:15px; height:15px; flex-shrink:0;" ${checked} />
                <span style="line-height:1.2;">${esc(task)}</span>
              </label>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Selected Tasks Summary -->
      ${wState.tareasRealizadas.length > 0 ? `
        <div style="margin-top:12px; padding-top:10px; border-top:1px dashed var(--border);">
          <div style="font-size:10px; font-weight:700; color:var(--text-soft); text-transform:uppercase; margin-bottom:6px;">Tareas Seleccionadas (${wState.tareasRealizadas.length})</div>
          <div style="display:flex; flex-wrap:wrap; gap:4px;">
            ${wState.tareasRealizadas.map(t => `
              <span style="background:#e0f2fe; color:#0284c7; padding:3px 7px; border-radius:4px; font-size:10px; font-weight:600;">${esc(t)}</span>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </div>
  `;
}

function bindStepTareasEvents() {
  document.querySelectorAll('.wiz-tarea-chk').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const val = e.target.value;
      if (e.target.checked) {
        if (!wState.tareasRealizadas.includes(val)) wState.tareasRealizadas.push(val);
      } else {
        wState.tareasRealizadas = wState.tareasRealizadas.filter(t => t !== val);
      }
      renderWizard(); // Re-render to update the summary tags
    });
  });

  const catSelect = document.querySelector('.wiz-tarea-category-select');
  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      wState.activeTareaCategoryIndex = parseInt(e.target.value, 10);
      renderWizard();
    });
  }
}
