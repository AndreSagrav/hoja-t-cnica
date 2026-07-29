import { ensureShell } from '../components/shell.js';
import { getSupabase } from '../lib/supabase.js';
import { esc, fmtMoney, toast, debounce, todayLocal } from '../lib/utils.js';
import {
  buscarClientes, obtenerCliente,
  guardarDocumentoCompleto, obtenerDocumentoCompleto,
  sugerirSiguienteNumero, dbToFormData, CODE_TO_LABEL, KIND_TO_CODE
} from '../data/documentos.js';
import { calcTotals } from '../lib/comprobante.js';

// Estado interno del editor
let state = null;

function estadoVacio(kind = 'orden') {
  return {
    docId: null,
    docKind: kind,
    docType: CODE_TO_LABEL[KIND_TO_CODE[kind]] || 'ORDEN DE TRABAJO',
    docNum: '',
    date: todayLocal(),
    estado: 'pendiente',
    clientId: null,
    clientName: '',
    clientCompany: '',
    clientType: 'residencial',
    clientCargo: '',
    clientPhone: '',
    clientEmail: '',
    clientAddress: '',
    clientCedula: '',
    factElectronica: null,
    usuariosAutorizados: [],
    lines: [],
    discount: { enabled: false, value: 0 },
    iva:      { enabled: false, value: 13 },
    currency: { code: 'CRC', symbol: '₡' },
    problem: '', diagnosis: '', observations: kind === 'cotizacion' ?
      '1. Precios válidos por 15 días naturales.\n2. Tiempo de entrega: 2-3 días hábiles, sujeto a disponibilidad de repuestos.\n3. Forma de pago: 50% anticipado, 50% contra entrega.\n4. Garantía de 30 días sobre el servicio realizado.\n5. Los precios no incluyen IVA a menos que se indique lo contrario.' :
      'El equipo queda sujeto a revisión y diagnóstico. El tiempo de reparación puede variar según disponibilidad de repuestos. Se notificará al cliente cualquier cambio en el presupuesto. La garantía del servicio es de 30 días.',
    tiempoEstimado: '',
    timeIn: '', timeOut: '',
    workItems: [],
    contact: { address: 'Cartago, La Unión', phone: '(506) 62 777 500', email: 'innoviocr@outlook.com' }
  };
}

// ─── Vistas: nuevo / editar ──────────────────────────────────────────────
export async function editorNuevoView(params = {}) {
  const kind = params.kind || 'orden';
  state = estadoVacio(kind);
  state.docNum = ''; // Se generará al guardar
  renderEditor();
}

export async function editorEditarView({ id }) {
  const shell = ensureShell('/documentos');
  shell.setTitle('Cargando documento…');
  shell.content().innerHTML = `<div class="card"><div class="empty-state">Cargando…</div></div>`;

  try {
    const completo = await obtenerDocumentoCompleto(id);
    state = dbToFormData(completo);
    state.docId = completo.doc.id;
    renderEditor();
  } catch (e) {
    console.error(e);
    shell.content().innerHTML = `<div class="card"><div class="empty-state" style="color:var(--red);">Error: ${esc(e.message || '')}</div></div>`;
  }
}

// ─── Render ──────────────────────────────────────────────────────────────
function renderEditor() {
  const isEdit = !!state.docId;
  const shell = ensureShell('/documentos');
  shell.setTitle(isEdit ? `Editar ${state.docType}` : `Nuevo ${state.docType}`);
  shell.setActions(`
    <button class="btn btn-ghost" id="btn-cancel">Cancelar</button>
    <button class="btn btn-ghost" id="btn-preview"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg> Vista previa</button>
    <button class="btn btn-primary" id="btn-save"><svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Guardar</button>
  `);

  shell.content().innerHTML = `
    <div class="editor-grid">
      <div class="editor-main">
        ${cardTipo()}
        ${cardCliente()}
        ${state.docKind === 'orden' ? cardOT() : ''}
        ${cardLineas()}
        ${cardObservaciones()}
      </div>
      <aside class="editor-side">
        ${cardTotales()}
      </aside>
    </div>
  `;

  bindEvents();
  refreshTotalsBox();
}

// ─── Cards ──
function cardTipo() {
  const opts = [
    { k: 'orden',      lbl: 'Orden de Trabajo' },
    { k: 'proforma',    lbl: 'Proforma' },
    { k: 'factura',    lbl: 'Factura' },
    { k: 'cotizacion', lbl: 'Cotización' }
  ].map(o => `<option value="${o.k}" ${state.docKind===o.k?'selected':''}>${o.lbl}</option>`).join('');

  return `
    <div class="card">
      <div class="ed-row">
        <div class="field">
          <label class="field-label">Tipo</label>
          <select class="select" id="f-kind">${opts}</select>
        </div>
        <div class="field">
          <label class="field-label">N° Documento</label>
          <input class="input" id="f-num" value="${esc(state.docNum)}" />
        </div>
        <div class="field">
          <label class="field-label">Fecha</label>
          <input class="input" id="f-date" type="date" value="${esc(state.date)}" />
        </div>
        <div class="field">
          <label class="field-label">Estado</label>
          <select class="select" id="f-estado">
            ${['pendiente','en_proceso','completado','facturado','cancelado']
              .map(s => `<option value="${s}" ${state.estado===s?'selected':''}>${s}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label class="field-label">Moneda</label>
          <select class="select" id="f-cur">
            <option value="CRC" ${state.currency.code==='CRC'?'selected':''}>₡ CRC</option>
            <option value="USD" ${state.currency.code==='USD'?'selected':''}>$ USD</option>
          </select>
        </div>
      </div>
    </div>
  `;
}

function cardCliente() {
  const isEmp = state.clientType === 'empresarial';
  const nameLabel = isEmp ? 'Contacto (nombre)' : 'Nombre';
  const companyLabel = isEmp ? 'Empresa (cliente)' : 'Empresa (opcional)';
  const companyPlaceholder = isEmp ? 'Nombre de la empresa' : 'Si aplica';

  return `
    <div class="card">
      <div class="card-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg> Cliente</div>
      <div class="ed-row">
        <div class="field" style="flex:2; position:relative;">
          <label class="field-label">Buscar cliente existente</label>
          <input class="input" id="cli-search" placeholder="Empezá a escribir nombre, empresa o teléfono…" autocomplete="off"/>
          <div id="cli-results" class="cli-results" style="display:none;"></div>
        </div>
        <div class="field">
          <label class="field-label">Tipo</label>
          <select class="select" id="cli-type">
            <option value="residencial" ${state.clientType==='residencial'?'selected':''}>Residencial</option>
            <option value="empresarial" ${state.clientType==='empresarial'?'selected':''}>Empresarial</option>
          </select>
        </div>
      </div>
      <div class="ed-row">
        <div class="field"><label class="field-label">${esc(nameLabel)}</label>
          <input class="input" id="cli-name" value="${esc(state.clientName)}"/>
        </div>
        <div class="field"><label class="field-label">${esc(companyLabel)}</label>
          <input class="input" id="cli-company" value="${esc(state.clientCompany)}" placeholder="${esc(companyPlaceholder)}"/>
        </div>
        <div class="field"><label class="field-label">Teléfono</label>
          <input class="input" id="cli-phone" value="${esc(state.clientPhone)}"/>
        </div>
        <div class="field"><label class="field-label">Email</label>
          <input class="input" id="cli-email" value="${esc(state.clientEmail)}"/>
        </div>
        <div class="field"><label class="field-label">Cédula</label>
          <input class="input" id="cli-cedula" value="${esc(state.clientCedula)}"/>
        </div>
      </div>
    </div>
  `;
}

function cardOT() {
  return `
    <div class="card">
      <div class="card-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> Diagnóstico y Trabajo</div>
      <div class="ed-row">
        <div class="field"><label class="field-label">Problema reportado</label>
          <textarea class="input" id="f-problem" rows="2">${esc(state.problem)}</textarea>
        </div>
        <div class="field"><label class="field-label">Diagnóstico</label>
          <textarea class="input" id="f-diagnosis" rows="3">${esc(state.diagnosis)}</textarea>
        </div>
        <div class="ed-row">
          <div class="field"><label class="field-label">Hora de entrada</label>
            <input class="input" id="f-time-in" type="time" value="${esc(state.timeIn)}"/>
          </div>
          <div class="field"><label class="field-label">Hora de salida</label>
            <input class="input" id="f-time-out" type="time" value="${esc(state.timeOut)}"/>
          </div>
        </div>
      </div>
    </div>
  `;
}

function cardLineas() {
  return `
    <div class="card">
      <div class="card-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg> Líneas del documento</div>
      <div id="lineas-container">
        ${state.lines.map((line, i) => `
          <div class="ed-row line-row" data-idx="${i}">
            <div class="field" style="flex:3"><label class="field-label">Descripción</label>
              <input class="input" value="${esc(line.descripcion || '')}" data-field="descripcion"/>
            </div>
            <div class="field" style="flex:1;min-width:90px"><label class="field-label">Cant.</label>
              <input class="input" type="number" value="${esc(line.cantidad || '')}" data-field="cantidad"/>
            </div>
            <div class="field" style="flex:1;min-width:110px"><label class="field-label">Precio</label>
              <input class="input" type="number" value="${esc(line.precio || '')}" data-field="precio"/>
            </div>
            <div class="field" style="flex:none;display:flex;align-items:flex-end;">
              <button class="btn btn-ghost btn-remove-line" style="color:var(--red);font-size:18px;padding:6px 8px;" title="Eliminar">×</button>
            </div>
          </div>
        `).join('')}
      </div>
      <button class="btn btn-ghost" id="btn-add-line">＋ Agregar línea</button>
    </div>
  `;
}

function cardObservaciones() {
  const isCot = state.docKind === 'cotizacion';
  return `
    <div class="card">
      <div class="card-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg> ${isCot ? 'Condiciones y Observaciones' : 'Observaciones'}</div>
      ${isCot ? `
      <div class="ed-row" style="margin-bottom:12px;">
        <label style="font-size:var(--fs-sm); font-weight:var(--fw-bold); color:var(--text); margin-bottom:4px; display:block;">Tiempo Estimado de Entrega</label>
        <select class="input" id="f-tiempo-estimado" style="max-width:280px;">
          <option value="" ${!state.tiempoEstimado ? 'selected' : ''}>— Seleccionar —</option>
          <option value="1 día" ${state.tiempoEstimado==='1 día'?'selected':''}>1 día</option>
          <option value="2 días" ${state.tiempoEstimado==='2 días'?'selected':''}>2 días</option>
          <option value="3 días" ${state.tiempoEstimado==='3 días'?'selected':''}>3 días</option>
          <option value="5 días" ${state.tiempoEstimado==='5 días'?'selected':''}>5 días</option>
          <option value="1 semana" ${state.tiempoEstimado==='1 semana'?'selected':''}>1 semana</option>
          <option value="2 semanas" ${state.tiempoEstimado==='2 semanas'?'selected':''}>2 semanas</option>
          <option value="Por confirmar" ${state.tiempoEstimado==='Por confirmar'?'selected':''}>Por confirmar</option>
        </select>
      </div>
      ` : ''}
      <div class="ed-row">
        <textarea class="input" id="f-observations" rows="4">${esc(state.observations)}</textarea>
      </div>
    </div>
  `;
}

function cardTotales() {
  const sub = state.lines.reduce((a,l) => a + (Number(l.precio)||0)*(Number(l.cantidad)||0), 0);
  const discVal = Number(state.discount.value) || 0;
  const ivaVal  = Number(state.iva.value) || 0;
  const net = sub * (1 - discVal/100);
  const total = net * (1 + ivaVal/100);
  return `
    <div class="card">
      <div class="card-title"><svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:bottom;margin-right:6px;"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> Totales</div>
      <div class="ed-row" style="flex-direction:column;gap:8px;">
        <div class="field"><label class="field-label">Subtotal</label>
          <input class="input" id="f-subtotal" readonly value="${esc(fmtMoney(sub))}"/>
        </div>
        <div class="field" style="display:flex;align-items:center;gap:8px;">
          <label class="field-label" style="flex:none;margin:0;">Descuento %</label>
          <input class="input" id="f-discount" type="number" style="flex:1;" value="${esc(state.discount.value)}"/>
        </div>
        <div class="field" style="display:flex;align-items:center;gap:8px;">
          <label class="field-label" style="flex:none;margin:0;">IVA %</label>
          <input class="input" id="f-iva" type="number" style="flex:1;" value="${esc(state.iva.value)}"/>
        </div>
        <div class="field"><label class="field-label" style="color:var(--green-mid);font-size:var(--fs-sm);">Total</label>
          <input class="input" id="f-total" readonly style="font-weight:800;font-size:var(--fs-md);color:var(--green-mid);" value="${esc(fmtMoney(total))}"/>
        </div>
      </div>
    </div>
  `;
}

// ─── Eventos ──
function bindEvents() {
  // Eventos para los botones de acción
  document.getElementById('btn-cancel').addEventListener('click', () => {
    if (confirm('¿Estás seguro que deseas cancelar? Los cambios no guardados se perderán.')) {
      window.location.hash = '/documentos';
    }
  });

  document.getElementById('btn-preview').addEventListener('click', () => {
    if (!state.docId) {
      toast('Guardá el documento primero para previsualizar', 'warn');
      return;
    }
    window.open('#/documentos/' + state.docId + '/comprobante', '_blank');
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    try {
      // Generar número al guardar si es nuevo documento
      if (!state.docId) {
        if (state.clientId) {
          state.docNum = await sugerirSiguienteNumero(state.docKind, state.clientId);
        } else {
          state.docNum = await sugerirSiguienteNumero(state.docKind);
        }
      }
      const result = await guardarDocumentoCompleto(state, state.docId, state.clientId);
      toast('Documento guardado correctamente', 'success');
      window.location.hash = '/documentos/' + result.documentoId;
    } catch (e) {
      toast('Error al guardar: ' + e.message, 'error');
      console.error(e);
    }
  });

  // Eventos para los campos del formulario
  document.getElementById('f-kind').addEventListener('change', (e) => {
    state.docKind = e.target.value;
    renderEditor();
  });

  document.getElementById('f-num').addEventListener('input', (e) => {
    state.docNum = e.target.value;
  });

  document.getElementById('f-date').addEventListener('input', (e) => {
    state.date = e.target.value;
  });

  document.getElementById('f-estado').addEventListener('change', (e) => {
    state.estado = e.target.value;
  });

  document.getElementById('f-cur').addEventListener('change', (e) => {
    state.currency.code = e.target.value;
    state.currency.symbol = e.target.value === 'CRC' ? '₡' : '$';
  });

  // Eventos para cliente
  const cliSearch = document.getElementById('cli-search');
  const cliResults = document.getElementById('cli-results');
  if (cliSearch && cliResults) {
    cliSearch.addEventListener('input', debounce(async (e) => {
      const q = e.target.value.trim();
      cliResults.style.display = 'none';
      cliResults.innerHTML = '';
      if (q.length < 2) return;
      try {
        const found = await buscarClientes(q, 8);
        if (!found.length) return;
        cliResults.innerHTML = found.map(c => `
          <div class="cli-result-item" data-id="${c.id}" style="padding:6px 8px;cursor:pointer;border-bottom:1px solid #eef2f7;font-size:var(--fs-sm);"
               onmouseenter="this.style.background='#f0f6ff'" onmouseleave="this.style.background='transparent'">
            <strong>${esc(c.nombre)}</strong> ${c.empresa ? '(' + esc(c.empresa) + ')' : ''}
            <span style="color:var(--text-soft);font-size:11px;">${esc(c.telefono || '')}</span>
          </div>
        `).join('');
        cliResults.querySelectorAll('.cli-result-item').forEach(item => {
          item.addEventListener('click', async () => {
            const id = item.dataset.id;
            const c = found.find(x => String(x.id) === id);
            if (!c) return;
            state.clientId = c.id;
            state.clientName = c.nombre || '';
            state.clientCompany = c.empresa || '';
            state.clientType = c.tipo_cliente || 'residencial';
            state.clientPhone = c.telefono || '';
            state.clientEmail = c.email || '';
            state.clientAddress = c.direccion || '';
            state.clientCedula = c.cedula || '';
            cliSearch.value = '';
            cliResults.style.display = 'none';
            // El número se generará al guardar el documento
            renderEditor();
          });
        });
        cliResults.style.display = 'block';
      } catch (err) { console.error(err); }
    }, 250));
    cliSearch.addEventListener('focus', () => { if (cliResults.children.length) cliResults.style.display = 'block'; });
    document.addEventListener('click', (ev) => { if (!cliSearch.contains(ev.target) && !cliResults.contains(ev.target)) cliResults.style.display = 'none'; });
  }

  document.getElementById('cli-type').addEventListener('change', (e) => {
    state.clientType = e.target.value;
    renderEditor();
  });

  document.getElementById('cli-name').addEventListener('input', (e) => {
    state.clientName = e.target.value;
  });

  document.getElementById('cli-company').addEventListener('input', (e) => {
    state.clientCompany = e.target.value;
  });

  document.getElementById('cli-phone').addEventListener('input', (e) => {
    state.clientPhone = e.target.value;
  });

  document.getElementById('cli-email').addEventListener('input', (e) => {
    state.clientEmail = e.target.value;
  });

  document.getElementById('cli-cedula').addEventListener('input', (e) => {
    state.clientCedula = e.target.value;
  });

  // Eventos para campos de OT
  document.getElementById('f-problem').addEventListener('input', (e) => {
    state.problem = e.target.value;
  });

  document.getElementById('f-diagnosis').addEventListener('input', (e) => {
    state.diagnosis = e.target.value;
  });

  document.getElementById('f-time-in').addEventListener('input', (e) => {
    state.timeIn = e.target.value;
  });

  document.getElementById('f-time-out').addEventListener('input', (e) => {
    state.timeOut = e.target.value;
  });

  // Eventos para líneas
  const lineasContainer = document.getElementById('lineas-container');
  if (lineasContainer) {
    lineasContainer.addEventListener('input', (e) => {
      const row = e.target.closest('.line-row');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      const field = e.target.dataset.field;
      if (idx >= 0 && field) {
        const val = field === 'descripcion' ? e.target.value : parseFloat(e.target.value) || 0;
        state.lines[idx][field] = val;
        refreshTotalsBox();
      }
    });
    lineasContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-remove-line');
      if (!btn) return;
      const row = btn.closest('.line-row');
      if (!row) return;
      const idx = parseInt(row.dataset.idx, 10);
      state.lines.splice(idx, 1);
      renderEditor();
    });
  }
  document.getElementById('btn-add-line').addEventListener('click', () => {
    state.lines.push({ descripcion: '', cantidad: 1, precio: 0 });
    renderEditor();
  });

  // Eventos para observaciones
  document.getElementById('f-observations').addEventListener('input', (e) => {
    state.observations = e.target.value;
  });

  // Evento para tiempo estimado (cotización)
  const tiempoEst = document.getElementById('f-tiempo-estimado');
  if (tiempoEst) {
    tiempoEst.addEventListener('change', (e) => {
      state.tiempoEstimado = e.target.value;
    });
  }

  // Eventos para totales
  document.getElementById('f-discount').addEventListener('input', (e) => {
    state.discount.value = parseFloat(e.target.value) || 0;
    refreshTotalsBox();
  });

  document.getElementById('f-iva').addEventListener('input', (e) => {
    state.iva.value = parseFloat(e.target.value) || 0;
    refreshTotalsBox();
  });
}

function refreshTotalsBox() {
  const subtotal = state.lines.reduce((sum, line) => sum + (Number(line.precio)||0) * (Number(line.cantidad)||0), 0);
  const discount = Number(state.discount.value) || 0;
  const iva = Number(state.iva.value) || 0;
  const net = subtotal * (1 - discount / 100);
  const total = net * (1 + iva / 100);
  const elSub = document.getElementById('f-subtotal');
  const elTot = document.getElementById('f-total');
  if (elSub) elSub.value = fmtMoney(subtotal);
  if (elTot) elTot.value = fmtMoney(total);
}