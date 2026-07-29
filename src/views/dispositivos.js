import { ensureShell } from '../components/shell.js';
import { esc, toast } from '../lib/utils.js';
import { FIELDS, FIELD_OPTIONS, getFilteredOptions } from '../data/equipos.js';
import { getSupabase, withTimeout } from '../lib/supabase.js';

const TEXT_FIELDS = ['NÚMERO DE SERIE', 'HOSTNAME'];

const GROUPS = [
  { title: 'General', icon: '🖥️', keys: ['DISPOSITIVO', 'FABRICANTE', 'MODELO', 'NÚMERO DE SERIE', 'IMPRESORA TIPO', 'S.O.', 'BIOS/UEFI', 'ESTADO'] },
  { title: 'Procesador & RAM', icon: '⚡', keys: ['CPU MARCA', 'CPU MODELO', 'RAM TIPO', 'RAM CAPACIDAD', 'RAM GEN', 'RAM VELOCIDAD'] },
  { title: 'Almacenamiento', icon: '💾', keys: ['DISCO TIPO', 'DISCO CAPACIDAD', 'DISCO MARCA'] },
  { title: 'Gráficos', icon: '🎮', keys: ['GPU MARCA', 'GPU MODELO'] },
  { title: 'Red & Conectividad', icon: '🌐', keys: ['CONECTIVIDAD', 'PUERTOS', 'HOSTNAME', 'DIRECCIÓN IP'] },
];

let selections = {};
let supabaseOptions = {};

async function loadSupabaseOptions() {
  const sb = await withTimeout(getSupabase(), 5000, null);
  if (!sb) return;
  const { data, error } = await sb.from('custom_field_options').select('field_name, option_value');
  if (error || !data) return;
  supabaseOptions = {};
  for (const row of data) {
    if (!supabaseOptions[row.field_name]) supabaseOptions[row.field_name] = [];
    if (!supabaseOptions[row.field_name].includes(row.option_value)) {
      supabaseOptions[row.field_name].push(row.option_value);
    }
  }
}

async function saveSupabaseOption(fieldName, value) {
  const sb = await withTimeout(getSupabase(), 5000, null);
  if (!sb) { toast('No se pudo guardar en la nube, guardado local', 'info'); return; }
  const { error } = await sb.from('custom_field_options').insert({ field_name: fieldName, option_value: value });
  if (error && error.code !== '23505') {
    toast('Error al guardar en la nube', 'error');
  }
}

function getAllCustomOptions(fieldName) {
  let local = [];
  try { local = JSON.parse(localStorage.getItem('innovio:custom_fields') || '{}')[fieldName] || []; } catch(e) {}
  const remote = supabaseOptions[fieldName] || [];
  return [...new Set([...local, ...remote])];
}

export function dispositivosView() {
  const shell = ensureShell('/dispositivos');
  shell.setTitle('Catálogo de Equipos');
  shell.setActions('');

  const c = shell.content();

  c.innerHTML = `
    <div style="max-width:1100px; margin:0 auto; padding:20px 0;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
        <div>
          <h2 style="color:var(--navy); margin:0 0 4px; font-size:20px; font-weight:800;">Catálogo de Equipos</h2>
          <p style="color:var(--text-soft); font-size:13px; margin:0;">Selecciona las especificaciones del equipo. Las opciones se filtran automáticamente según lo que vayas eligiendo.</p>
        </div>
        <div id="dev-progress" style="display:flex; align-items:center; gap:12px; background:var(--surface); border:1px solid var(--border-light); border-radius:10px; padding:10px 18px; box-shadow:var(--shadow-xs);">
          <div style="position:relative; width:44px; height:44px;">
            <svg width="44" height="44" viewBox="0 0 44 44" style="transform:rotate(-90deg);">
              <circle cx="22" cy="22" r="18" fill="none" stroke="var(--border-light)" stroke-width="4"/>
              <circle id="dev-progress-circle" cx="22" cy="22" r="18" fill="none" stroke="var(--accent)" stroke-width="4" stroke-dasharray="113" stroke-dashoffset="113" stroke-linecap="round" style="transition:stroke-dashoffset 0.4s ease;"/>
            </svg>
            <div id="dev-progress-text" style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); font-size:12px; font-weight:800; color:var(--navy);">0%</div>
          </div>
          <div>
            <div style="font-size:11px; font-weight:700; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.5px;">Campos</div>
            <div id="dev-progress-count" style="font-size:15px; font-weight:800; color:var(--navy);">0 / 23</div>
          </div>
        </div>
      </div>

      <div id="dev-summary" style="display:none; background:var(--grad-navy); border-radius:12px; padding:14px 20px; margin-bottom:20px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; box-shadow:0 4px 12px rgba(7,31,80,0.12);">
        <span style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.6); text-transform:uppercase; letter-spacing:1px; margin-right:4px;">Resumen:</span>
        <span id="dev-summary-text" style="font-size:13px; font-weight:600; color:#fff;"></span>
      </div>

      <div id="dev-groups"></div>

      <div style="display:flex; justify-content:center; margin-top:28px; padding-bottom:20px;">
        <button class="btn btn-ghost" id="dev-clear-btn" style="padding:12px 32px; font-size:14px; font-weight:700;">🔄 Nueva consulta</button>
      </div>
    </div>

    <div id="dev-modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.4); z-index:9999; align-items:center; justify-content:center;">
      <div style="background:var(--surface); border-radius:14px; padding:28px; width:90%; max-width:420px; box-shadow:var(--shadow-xl);">
        <div style="font-size:16px; font-weight:800; color:var(--navy); margin-bottom:16px;" id="dev-modal-title">Agregar nuevo valor</div>
        <input type="text" id="dev-modal-input" style="width:100%; padding:12px 16px; border:1px solid var(--border); border-radius:8px; font-size:14px; font-family:inherit; outline:none; margin-bottom:20px;" placeholder="Escriba el nuevo valor..." />
        <div style="display:flex; gap:12px; justify-content:flex-end;">
          <button class="btn btn-ghost" id="dev-modal-cancel">Cancelar</button>
          <button class="btn btn-primary" id="dev-modal-ok">Agregar</button>
        </div>
      </div>
    </div>
  `;

  renderGroups();
  bindEvents();
  loadSupabaseOptions().then(() => renderGroups());
}

function renderGroups() {
  const container = document.getElementById('dev-groups');
  if (!container) return;

  container.innerHTML = GROUPS.map(group => {
    return `
      <div class="dev-group" style="margin-bottom:20px; border-radius:14px; overflow:hidden; border:1px solid var(--border-light); box-shadow:var(--shadow-xs);">
        <div class="dev-group-header" style="padding:12px 20px; background:var(--surface); border-bottom:1px solid var(--border-light); display:flex; align-items:center; gap:10px;">
          <span style="font-size:18px;">${group.icon}</span>
          <span style="font-size:14px; font-weight:800; color:var(--navy);">${esc(group.title)}</span>
          <span class="dev-group-count" style="font-size:11px; font-weight:700; color:var(--text-soft); background:var(--surface-2); padding:2px 10px; border-radius:var(--r-full); margin-left:auto;" data-group="${esc(group.title)}">0/${group.keys.length}</span>
        </div>
        <div class="dev-group-fields" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:14px; padding:20px; background:var(--surface);">
          ${group.keys.map(k => renderField(k)).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function renderField(key) {
  const f = FIELDS.find(x => x.title === key);
  if (!f) return '';

  if (TEXT_FIELDS.includes(key)) {
    const isTextarea = key === 'OBSERVACIONES';
    return `
      <div class="field dev-field" data-field="${esc(key)}" style="margin:0;">
        <label class="field-label" style="font-size:11px; font-weight:700; color:var(--text-mid); display:flex; align-items:center; gap:6px; margin-bottom:6px;"><span style="color:var(--accent);">${f.icon}</span>${esc(f.title)}</label>
        ${isTextarea
          ? `<textarea class="dev-text-input" data-field="${esc(key)}" placeholder="Notas adicionales..." style="width:100%; min-height:60px; border:1px solid var(--border); border-radius:8px; padding:10px 12px; font-size:13px; font-family:inherit; outline:none; resize:vertical; transition:border-color 0.2s;"></textarea>`
          : `<input type="text" class="dev-text-input" data-field="${esc(key)}" placeholder="Ingrese valor..." style="width:100%; height:40px; border:1px solid var(--border); border-radius:8px; padding:0 12px; font-size:13px; font-family:inherit; outline:none; transition:border-color 0.2s;" />`
        }
      </div>
    `;
  }

  let customOptions = getAllCustomOptions(f.title);
  const allOptions = [...(FIELD_OPTIONS[f.title] || []), ...customOptions];
  const filtered = getFilteredOptions(f.title, selections, allOptions);

  return `
    <div class="field dev-field" data-field="${esc(key)}" style="margin:0;">
      <label class="field-label" style="font-size:11px; font-weight:700; color:var(--text-mid); display:flex; align-items:center; gap:6px; margin-bottom:6px;"><span style="color:var(--accent);">${f.icon}</span>${esc(f.title)}</label>
      <div class="dev-select-wrap" style="position:relative;">
        <select class="dev-select eq-select" data-field="${esc(f.title)}" style="height:40px; width:100%; border:1px solid var(--border); border-radius:8px; padding:0 32px 0 12px; appearance:none; font-size:13px; font-family:inherit; outline:none; cursor:pointer; transition:border-color 0.2s;">
          <option value="">Seleccionar...</option>
          ${filtered.map(opt => `<option value="${esc(opt)}" ${selections[f.title] === opt ? 'selected' : ''}>${esc(opt)}</option>`).join('')}
          <option value="__new__" style="font-weight:bold; color:var(--teal);">[ ➕ Agregar Nuevo... ]</option>
        </select>
        <div style="position:absolute; right:12px; top:50%; transform:translateY(-50%); pointer-events:none; font-size:10px; color:var(--text-soft);">▼</div>
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll('.eq-select').forEach(sel => {
    sel.addEventListener('change', onSelectChange);
  });
  document.querySelectorAll('.dev-text-input').forEach(inp => {
    inp.addEventListener('input', onTextChange);
    inp.addEventListener('focus', e => { e.target.style.borderColor = 'var(--accent)'; });
    inp.addEventListener('blur', e => { if (!e.target.value.trim()) e.target.style.borderColor = 'var(--border)'; });
  });
  document.getElementById('dev-clear-btn')?.addEventListener('click', limpiarTodo);
  document.getElementById('dev-modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('dev-modal-ok')?.addEventListener('click', confirmModal);
  document.getElementById('dev-modal-input')?.addEventListener('keydown', e => { if (e.key === 'Enter') confirmModal(); if (e.key === 'Escape') closeModal(); });
}

function onSelectChange(e) {
  const fieldName = e.target.getAttribute('data-field');
  const value = e.target.value;

  if (value === '__new__') {
    openModal(fieldName, e.target);
    return;
  }

  if (value) {
    selections[fieldName] = value;
    e.target.style.borderColor = 'var(--accent)';
    e.target.closest('.dev-field').style.background = 'rgba(0,194,168,0.03)';
  } else {
    delete selections[fieldName];
    e.target.style.borderColor = 'var(--border)';
    e.target.closest('.dev-field').style.background = 'transparent';
  }

  refreshDependentSelects();
  updateProgress();
  updateSummary();
}

function onTextChange(e) {
  const fieldName = e.target.getAttribute('data-field');
  const value = e.target.value.trim();
  if (value) {
    selections[fieldName] = value;
    e.target.style.borderColor = 'var(--accent)';
  } else {
    delete selections[fieldName];
    e.target.style.borderColor = 'var(--border)';
  }
  updateProgress();
  updateSummary();
}

function refreshDependentSelects() {
  document.querySelectorAll('.eq-select').forEach(sel => {
    const fieldName = sel.getAttribute('data-field');
    if (fieldName === '__new__') return;
    const f = FIELDS.find(x => x.title === fieldName);
    if (!f) return;

    let customOptions = getAllCustomOptions(f.title);
    const allOptions = [...(FIELD_OPTIONS[f.title] || []), ...customOptions];
    const filtered = getFilteredOptions(f.title, selections, allOptions);
    const currentVal = selections[fieldName] || '';

    let newHTML = `<option value="">Seleccionar...</option>`;
    filtered.forEach(opt => {
      newHTML += `<option value="${esc(opt)}" ${currentVal === opt ? 'selected' : ''}>${esc(opt)}</option>`;
    });
    newHTML += `<option value="__new__" style="font-weight:bold; color:var(--teal);">[ ➕ Agregar Nuevo... ]</option>`;
    sel.innerHTML = newHTML;
    sel.value = currentVal;

    if (currentVal && !filtered.includes(currentVal)) {
      delete selections[fieldName];
      sel.value = '';
      sel.style.borderColor = 'var(--border)';
      sel.closest('.dev-field').style.background = 'transparent';
    }
  });
}

function updateProgress() {
  const totalFields = FIELDS.length;
  const filledFields = Object.keys(selections).length;
  const pct = Math.round((filledFields / totalFields) * 100);

  const circle = document.getElementById('dev-progress-circle');
  const text = document.getElementById('dev-progress-text');
  const count = document.getElementById('dev-progress-count');
  if (circle) {
    const circumference = 113;
    circle.setAttribute('stroke-dashoffset', circumference - (circumference * pct / 100));
  }
  if (text) text.textContent = pct + '%';
  if (count) count.textContent = `${filledFields} / ${totalFields}`;

  GROUPS.forEach(group => {
    const filled = group.keys.filter(k => selections[k]).length;
    const el = document.querySelector(`[data-group="${CSS.escape(group.title)}"]`);
    if (el) el.textContent = `${filled}/${group.keys.length}`;
  });
}

function updateSummary() {
  const summary = document.getElementById('dev-summary');
  const text = document.getElementById('dev-summary-text');
  if (!summary || !text) return;

  const parts = [];
  if (selections['DISPOSITIVO']) parts.push(selections['DISPOSITIVO']);
  if (selections['FABRICANTE']) parts.push(selections['FABRICANTE']);
  if (selections['MODELO']) parts.push(selections['MODELO']);
  if (selections['CPU MARCA']) parts.push(selections['CPU MARCA']);
  if (selections['CPU MODELO']) parts.push(selections['CPU MODELO']);
  if (selections['RAM CAPACIDAD']) parts.push(selections['RAM CAPACIDAD']);
  if (selections['DISCO TIPO']) parts.push(selections['DISCO TIPO']);
  if (selections['DISCO CAPACIDAD']) parts.push(selections['DISCO CAPACIDAD']);

  if (parts.length > 0) {
    summary.style.display = 'flex';
    text.textContent = parts.join(' · ');
  } else {
    summary.style.display = 'none';
  }
}

let modalField = null;
let modalSelect = null;

function openModal(fieldName, selectEl) {
  modalField = fieldName;
  modalSelect = selectEl;
  const modal = document.getElementById('dev-modal');
  const title = document.getElementById('dev-modal-title');
  const input = document.getElementById('dev-modal-input');
  if (modal) modal.style.display = 'flex';
  if (title) title.textContent = `Agregar nuevo valor para ${fieldName}`;
  if (input) { input.value = ''; input.focus(); }
}

function closeModal() {
  const modal = document.getElementById('dev-modal');
  if (modal) modal.style.display = 'none';
  if (modalSelect) modalSelect.value = '';
  modalField = null;
  modalSelect = null;
}

function confirmModal() {
  const input = document.getElementById('dev-modal-input');
  if (!input || !modalField) return;
  const val = input.value.trim();
  if (!val) { toast('Ingrese un valor', 'error'); return; }

  const custom = JSON.parse(localStorage.getItem('innovio:custom_fields') || '{}');
  if (!custom[modalField]) custom[modalField] = [];
  if (!custom[modalField].includes(val)) {
    custom[modalField].push(val);
    localStorage.setItem('innovio:custom_fields', JSON.stringify(custom));
  }
  if (!supabaseOptions[modalField]) supabaseOptions[modalField] = [];
  if (!supabaseOptions[modalField].includes(val)) {
    supabaseOptions[modalField].push(val);
  }
  saveSupabaseOption(modalField, val);

  selections[modalField] = val;
  refreshDependentSelects();
  updateProgress();
  updateSummary();

  document.getElementById('dev-modal').style.display = 'none';
  toast('Opción agregada exitosamente', 'success');
  modalField = null;
  modalSelect = null;
}

function limpiarTodo() {
  selections = {};
  document.querySelectorAll('.eq-select').forEach(sel => {
    sel.value = '';
    sel.style.borderColor = 'var(--border)';
    sel.closest('.dev-field').style.background = 'transparent';
  });
  document.querySelectorAll('.dev-text-input').forEach(inp => {
    inp.value = '';
    inp.style.borderColor = 'var(--border)';
  });
  refreshDependentSelects();
  updateProgress();
  updateSummary();
}
