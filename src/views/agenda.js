import { ensureShell } from '../components/shell.js';
import { getEventos, addEvento, toggleEventoCompletado, deleteEvento, getNotas, addNota, deleteNota, calculateDurationMinutes, addMinutesToTime } from '../data/agenda.js';
import { getSupabase } from '../lib/supabase.js';
import { esc, toast, fmtDate } from '../lib/utils.js';

// Estado global de la vista
let currentViewMode = 'dia'; // 'dia' (por horas) o 'mes'
let activeDate = new Date();
let selectedDateStr = new Date().toISOString().slice(0, 10);
let activeFilter = 'todos'; // 'todos', 'cita', 'recordatorio'
let cachedEventos = [];
let cachedNotas = [];
let cachedServicios = [];
let cachedOTs = [];

const HOURS_TIMELINE = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'
];

export async function agendaView() {
  const shell = ensureShell('/agenda');
  shell.setTitle('');
  shell.setActions('');
  const container = shell.content();

  // Plantilla base Tier-1
  container.innerHTML = `
    <div class="t1-agenda-container">
      
      <!-- ENCABEZADO EJECUTIVO (CERO TARJETAS INFLADAS) -->
      <div class="t1-agenda-header">
        <div class="t1-agenda-title-group">
          <h1 class="t1-agenda-title">Agenda Operativa</h1>
          <div class="t1-ledger-stat-strip">
            <span class="t1-stat-pill"><strong id="stat-agenda-date">—</strong></span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill" style="color: #059669;"><strong id="stat-citas-count">0</strong> citas hoy</span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill" style="color: #d97706;"><strong id="stat-recordatorios-count">0</strong> recordatorios</span>
            <span class="t1-stat-sep">•</span>
            <span class="t1-stat-pill" style="color: var(--muted-color);"><strong id="stat-total-count">0</strong> total activos</span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- Selector de Modo de Vista: Día (Horario) vs Mes -->
          <div class="t1-view-switcher">
            <button class="t1-view-btn active" id="btn-view-dia" data-view="dia">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Día (Por Horas)
            </button>
            <button class="t1-view-btn" id="btn-view-mes" data-view="mes">
              <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Mes Completo
            </button>
          </div>

          <button class="t1-btn-primary" id="btn-nueva-cita-top">
            <svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
            Nuevo Compromiso
          </button>
        </div>
      </div>

      <!-- CUERPO PRINCIPAL -->
      <div id="agenda-main-view-wrap"></div>

    </div>
  `;

  document.getElementById('btn-view-dia').addEventListener('click', () => switchViewMode('dia'));
  document.getElementById('btn-view-mes').addEventListener('click', () => switchViewMode('mes'));
  document.getElementById('btn-nueva-cita-top').addEventListener('click', () => showCompromisoModal(selectedDateStr));

  // Cargar datos
  await loadAgendaData();
}

function switchViewMode(mode) {
  currentViewMode = mode;
  document.getElementById('btn-view-dia').classList.toggle('active', mode === 'dia');
  document.getElementById('btn-view-mes').classList.toggle('active', mode === 'mes');
  renderCurrentView();
}

async function loadAgendaData() {
  cachedEventos = await getEventos();
  cachedNotas = await getNotas();
  await loadCatalogoServicios();
  await loadActiveOTs();
  updateHeaderStrip();
  renderCurrentView();
}

// ── Carga Dinámica en Tiempo Real del Catálogo de Servicios ──────────────────
async function loadCatalogoServicios() {
  let list = [];
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('catalogo_servicios').select('*').eq('tipo', 'servicio').order('nombre');
    if (!error && data && data.length) {
      list = data;
    }
  } catch (err) {}

  if (!list.length) {
    try {
      const local = JSON.parse(localStorage.getItem('local_servicios_overrides') || '[]');
      if (local.length) list = local;
    } catch {}
  }

  // Si no hay datos aún, usar catálogo profesional con duraciones preestablecidas
  if (!list.length) {
    list = [
      { id: 'srv-vt', nombre: 'Visita Técnica / Campo', codigo: 'VT', duracion_horas: 2 },
      { id: 'srv-st', nombre: 'Soporte Técnico en Sitio', codigo: 'ST', duracion_horas: 2 },
      { id: 'srv-sr', nombre: 'Soporte Remoto / Llamada', codigo: 'SR', duracion_horas: 1 },
      { id: 'srv-dg', nombre: 'Diagnóstico e Inspección', codigo: 'DG', duracion_horas: 1 },
      { id: 'srv-mp', nombre: 'Mantenimiento Preventivo', codigo: 'MP', duracion_horas: 2 },
      { id: 'srv-ic', nombre: 'Instalación y Configuración', codigo: 'IC', duracion_horas: 3 },
      { id: 'srv-ir', nombre: 'Infraestructura y Redes', codigo: 'IR', duracion_horas: 3 },
      { id: 'srv-cs', nombre: 'Consultoría Técnica', codigo: 'CS', duracion_horas: 1 }
    ];
  }

  cachedServicios = list;
}

async function loadActiveOTs() {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.from('documentos')
      .select('id, doc_num, cliente_id, clientes(nombre, empresa)')
      .eq('doc_type', 'OT')
      .order('created_at', { ascending: false })
      .limit(30);
    cachedOTs = data || [];
  } catch (e) {
    cachedOTs = [];
  }
}

function updateHeaderStrip() {
  const [y, m, d] = selectedDateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const options = { weekday: 'short', day: 'numeric', month: 'short' };
  const dateFmt = dateObj.toLocaleDateString('es-CR', options);

  const dateEl = document.getElementById('stat-agenda-date');
  const citasEl = document.getElementById('stat-citas-count');
  const recordatoriosEl = document.getElementById('stat-recordatorios-count');
  const totalEl = document.getElementById('stat-total-count');

  if (dateEl) dateEl.textContent = dateFmt.charAt(0).toUpperCase() + dateFmt.slice(1);
  if (citasEl) citasEl.textContent = cachedEventos.filter(e => e.fecha === selectedDateStr && e.tipo === 'cita' && !e.completada).length;
  if (recordatoriosEl) recordatoriosEl.textContent = cachedEventos.filter(e => e.fecha === selectedDateStr && e.tipo === 'recordatorio' && !e.completada).length;
  if (totalEl) totalEl.textContent = cachedEventos.filter(e => !e.completada).length;
}

function renderCurrentView() {
  const wrap = document.getElementById('agenda-main-view-wrap');
  if (!wrap) return;

  if (currentViewMode === 'dia') {
    renderDailyHourlyView(wrap);
  } else {
    renderMonthlyCalendarView(wrap);
  }
}

// ── VISTA DIARIA POR HORAS (PREDETERMINADA) ──────────────────────────────────
function renderDailyHourlyView(wrap) {
  const [y, m, d] = selectedDateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const longOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  const dateLongStr = dateObj.toLocaleDateString('es-CR', longOptions);
  const dateDisplay = dateLongStr.charAt(0).toUpperCase() + dateLongStr.slice(1);

  // Filtrar eventos del día
  let dayEvts = cachedEventos.filter(e => e.fecha === selectedDateStr);
  if (activeFilter !== 'todos') {
    dayEvts = dayEvts.filter(e => e.tipo === activeFilter);
  }

  // Eventos sin hora específica
  const unassignedEvts = dayEvts.filter(e => !e.hora || !HOURS_TIMELINE.some(h => e.hora.startsWith(h.slice(0, 2))));

  wrap.innerHTML = `
    <div class="t1-agenda-layout">
      
      <!-- COLUMNA PRINCIPAL: CRONOGRAMA POR HORAS -->
      <div class="t1-timeline-card">
        
        <!-- Barra de navegación de fecha y filtros estrictos: Todos, Citas, Recordatorios -->
        <div class="t1-timeline-topbar">
          <div class="t1-day-nav-group">
            <button class="t1-nav-arrow-btn" id="btn-day-prev" title="Día anterior">‹</button>
            <button class="t1-nav-today-btn" id="btn-day-today">Hoy</button>
            <button class="t1-nav-arrow-btn" id="btn-day-next" title="Día siguiente">›</button>
            <span class="t1-day-headline">${dateDisplay}</span>
          </div>

          <!-- Filtros estrictos: Cita y Recordatorio -->
          <div class="t1-ledger-filter-group" id="timeline-filters">
            <button class="t1-ledger-filter-btn ${activeFilter === 'todos' ? 'active' : ''}" data-filter="todos">Todos (${cachedEventos.filter(e => e.fecha === selectedDateStr).length})</button>
            <button class="t1-ledger-filter-btn ${activeFilter === 'cita' ? 'active' : ''}" data-filter="cita">📅 Citas (${cachedEventos.filter(e => e.fecha === selectedDateStr && e.tipo === 'cita').length})</button>
            <button class="t1-ledger-filter-btn ${activeFilter === 'recordatorio' ? 'active' : ''}" data-filter="recordatorio">⏰ Recordatorios (${cachedEventos.filter(e => e.fecha === selectedDateStr && e.tipo === 'recordatorio').length})</button>
          </div>
        </div>

        ${unassignedEvts.length > 0 ? `
          <div style="padding: 8px 16px; background: rgba(0, 194, 168, 0.05); border-bottom: 1px solid var(--panel-border); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--innovio-teal); letter-spacing: 0.04em;">Sin hora fija:</span>
            ${unassignedEvts.map(e => renderTimelineEvent(e)).join('')}
          </div>
        ` : ''}

        <!-- Línea de tiempo horaria (07:00 a 20:00) -->
        <div class="t1-hourly-timeline" id="timeline-scroll-container">
          ${HOURS_TIMELINE.map(hour => {
            const hourPrefix = hour.slice(0, 2);
            const hourNum = parseInt(hourPrefix, 10);

            // Eventos que inician en esta hora
            const startEvts = dayEvts.filter(e => e.hora && e.hora.startsWith(hourPrefix));

            // Eventos en curso que reservan esta hora (ej. 10:00 a 12:00 ocupa 11:00)
            const ongoingEvts = dayEvts.filter(e => {
              if (!e.hora || !e.hora_fin) return false;
              const startH = parseInt(e.hora.slice(0, 2), 10);
              const endH = parseInt(e.hora_fin.slice(0, 2), 10);
              return hourNum > startH && hourNum < endH;
            });

            return `
              <div class="t1-hour-slot" data-hour="${hour}">
                <div class="t1-hour-time">${hour}</div>
                <div class="t1-hour-content">
                  ${startEvts.map(e => renderTimelineEvent(e)).join('')}
                  ${ongoingEvts.map(oe => `
                    <div class="t1-timeline-ongoing" title="Compromiso en curso hasta las ${oe.hora_fin}">
                      <span>⏳</span>
                      <span>En curso: <strong>${esc(oe.titulo)}</strong> (hasta las ${oe.hora_fin})</span>
                    </div>
                  `).join('')}
                  <button class="t1-slot-quick-add" data-hour="${hour}">
                    <svg width="10" height="10" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                    Programar a las ${hour}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

      </div>

      <!-- BARRA LATERAL CONTENIDA: MINI-CALENDARIO + MEMOS QUE NUNCA SE DESBORDAN -->
      <div class="t1-agenda-sidebar">
        
        <!-- Mini-Calendario Navegador -->
        <div class="t1-sidebar-card">
          <div class="t1-mini-cal-header">
            <span class="t1-mini-cal-title" id="mini-cal-month-title">Septiembre 2026</span>
            <div style="display: flex; gap: 4px;">
              <button class="t1-nav-arrow-btn" id="mini-cal-prev" style="width: 22px; height: 22px; font-size: 11px;">‹</button>
              <button class="t1-nav-arrow-btn" id="mini-cal-next" style="width: 22px; height: 22px; font-size: 11px;">›</button>
            </div>
          </div>
          <div class="t1-mini-weekdays">
            <div>D</div><div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div>
          </div>
          <div class="t1-mini-days-grid" id="mini-cal-days-box"></div>
        </div>

        <!-- Memos y Notas Rápidas de Mostrador (Altura fija con scroll interno) -->
        <div class="t1-sidebar-card">
          <div class="t1-memos-header">
            <div class="t1-memos-title">
              <span>📝</span> Notas Rápidas (${cachedNotas.length})
            </div>
          </div>

          <div class="t1-memo-add-form">
            <input type="text" id="quick-memo-input" class="t1-memo-input" placeholder="Nueva nota rápida y Enter..." />
            <button class="t1-memo-btn" id="btn-quick-memo-add" title="Agregar nota">＋</button>
          </div>

          <div class="t1-memos-list" id="memos-list-container">
            ${cachedNotas.length === 0 ? `
              <div style="padding: 16px; text-align: center; color: var(--muted-color); font-size: 11.5px;">
                No hay notas pendientes de mostrador.
              </div>
            ` : cachedNotas.map(n => `
              <div class="t1-memo-item ${n.color || 'yellow'}">
                <div class="t1-memo-title-row">
                  <span>${esc(n.titulo)}</span>
                  <button class="t1-memo-del-btn" data-id="${n.id}" title="Eliminar nota">✕</button>
                </div>
                ${n.texto ? `<div class="t1-memo-body">${esc(n.texto)}</div>` : ''}
                <div class="t1-memo-footer">${n.fecha}</div>
              </div>
            `).join('')}
          </div>
        </div>

      </div>

    </div>
  `;

  // Bind navegación diaria
  document.getElementById('btn-day-prev').addEventListener('click', () => changeSelectedDay(-1));
  document.getElementById('btn-day-next').addEventListener('click', () => changeSelectedDay(1));
  document.getElementById('btn-day-today').addEventListener('click', () => {
    selectedDateStr = new Date().toISOString().slice(0, 10);
    activeDate = new Date();
    updateHeaderStrip();
    renderDailyHourlyView(wrap);
  });

  // Bind filtros
  document.querySelectorAll('#timeline-filters .t1-ledger-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      renderDailyHourlyView(wrap);
    });
  });

  // Bind Quick Add en horas
  wrap.querySelectorAll('.t1-slot-quick-add').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      showCompromisoModal(selectedDateStr, btn.dataset.hour);
    });
  });

  // Bind Event actions (check, click to edit, delete)
  bindEventInteractions(wrap);

  // Render Mini Calendar
  renderMiniCalendar();

  // Bind Quick Memos
  bindMemoInteractions(wrap);
}

function renderTimelineEvent(e) {
  const isCita = e.tipo === 'cita';
  const icon = isCita ? '📅' : '⏰';
  const tipoLabel = isCita ? 'Cita' : 'Recordatorio';
  const prioridadClass = e.prioridad || 'media';

  const timeRange = e.hora_fin ? `${e.hora} - ${e.hora_fin}` : (e.hora || 'S/H');
  const durLabel = e.duracion_min ? `(${Math.round(e.duracion_min / 60 * 10) / 10}h)` : '';

  return `
    <div class="t1-timeline-event ${prioridadClass} ${e.completada ? 'done' : ''}" data-id="${e.id}">
      <div class="t1-timeline-event-left">
        <input type="checkbox" class="evt-item-check" data-id="${e.id}" ${e.completada ? 'checked' : ''} style="cursor: pointer; accent-color: var(--innovio-teal);" onclick="event.stopPropagation();" />
        
        <span class="t1-timeline-time-badge">${timeRange}</span>
        ${durLabel ? `<span class="t1-dur-pill">${durLabel}</span>` : ''}
        
        <span style="font-size: 10px; font-weight: 700; padding: 1.5px 5px; border-radius: 3px; background: rgba(0,0,0,0.06); color: var(--heading-color); text-transform: uppercase;">${icon} ${tipoLabel}</span>

        <span class="t1-timeline-title">${esc(e.titulo)}</span>

        ${e.servicio_nombre ? `<span style="font-size: 11px; color: var(--innovio-teal); font-weight: 600;">[🔧 ${esc(e.servicio_nombre)}]</span>` : ''}
        ${e.cliente ? `<span class="t1-timeline-client">• ${esc(e.cliente)}</span>` : ''}
      </div>
      <div style="display: flex; align-items: center; gap: 6px;" onclick="event.stopPropagation();">
        <button class="t1-memo-del-btn btn-del-evt" data-id="${e.id}" title="Eliminar compromiso">✕</button>
      </div>
    </div>
  `;
}

function bindEventInteractions(wrap) {
  wrap.querySelectorAll('.evt-item-check').forEach(ck => {
    ck.addEventListener('change', async () => {
      await toggleEventoCompletado(ck.dataset.id);
      await loadAgendaData();
    });
  });

  wrap.querySelectorAll('.btn-del-evt').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('¿Eliminar este compromiso de la agenda?')) {
        await deleteEvento(btn.dataset.id);
        await loadAgendaData();
      }
    });
  });

  wrap.querySelectorAll('.t1-timeline-event').forEach(card => {
    card.addEventListener('click', () => {
      const evt = cachedEventos.find(ev => ev.id === card.dataset.id);
      if (evt) showCompromisoModal(evt.fecha, evt.hora, evt);
    });
  });
}

function changeSelectedDay(delta) {
  const [y, m, d] = selectedDateStr.split('-');
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  dateObj.setDate(dateObj.getDate() + delta);
  selectedDateStr = dateObj.toISOString().slice(0, 10);
  activeDate = new Date(dateObj);
  updateHeaderStrip();
  renderCurrentView();
}

// ── MINI CALENDARIO EN BARRA LATERAL ────────────────────────────────────────
function renderMiniCalendar() {
  const titleEl = document.getElementById('mini-cal-month-title');
  const box = document.getElementById('mini-cal-days-box');
  if (!titleEl || !box) return;

  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  titleEl.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().slice(0, 10);

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="t1-mini-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dayStr === todayStr;
    const isSelected = dayStr === selectedDateStr;
    const dayEvts = cachedEventos.filter(e => e.fecha === dayStr && !e.completada);
    const hasEvent = dayEvts.length > 0;
    const hasHigh = dayEvts.some(e => e.prioridad === 'alta');

    html += `
      <div class="t1-mini-day ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''} ${hasEvent ? 'has-event' : ''} ${hasHigh ? 'has-high' : ''}" data-date="${dayStr}">
        ${d}
      </div>
    `;
  }

  box.innerHTML = html;

  box.querySelectorAll('.t1-mini-day:not(.empty)').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDateStr = cell.dataset.date;
      updateHeaderStrip();
      renderCurrentView();
    });
  });

  document.getElementById('mini-cal-prev')?.addEventListener('click', () => {
    activeDate.setMonth(activeDate.getMonth() - 1);
    renderMiniCalendar();
  });
  document.getElementById('mini-cal-next')?.addEventListener('click', () => {
    activeDate.setMonth(activeDate.getMonth() + 1);
    renderMiniCalendar();
  });
}

// ── MEMOS Y NOTAS RÁPIDAS DE MOSTRADOR ──────────────────────────────────────
function bindMemoInteractions(wrap) {
  const input = document.getElementById('quick-memo-input');
  const btnAdd = document.getElementById('btn-quick-memo-add');

  const handleAdd = async () => {
    const val = input.value.trim();
    if (!val) return;
    await addNota({
      titulo: val,
      texto: '',
      color: 'yellow'
    });
    input.value = '';
    toast('Nota rápida guardada', 'success');
    await loadAgendaData();
  };

  if (btnAdd) btnAdd.onclick = handleAdd;
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAdd();
      }
    };
  }

  wrap.querySelectorAll('.t1-memo-del-btn').forEach(btn => {
    btn.onclick = async (e) => {
      e.stopPropagation();
      await deleteNota(btn.dataset.id);
      await loadAgendaData();
    };
  });
}

// ── VISTA MENSUAL COMPLETA ──────────────────────────────────────────────────
function renderMonthlyCalendarView(wrap) {
  const year = activeDate.getFullYear();
  const month = activeDate.getMonth();
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const todayStr = new Date().toISOString().slice(0, 10);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let cellsHtml = '';
  for (let i = 0; i < firstDay; i++) {
    cellsHtml += '<div class="t1-month-day-cell" style="opacity: 0.25; background: transparent; cursor: default;"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = dayStr === todayStr;
    const isSelected = dayStr === selectedDateStr;
    const dayEvts = cachedEventos.filter(e => e.fecha === dayStr);

    cellsHtml += `
      <div class="t1-month-day-cell ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${dayStr}">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span class="t1-month-day-num">${d}</span>
          ${dayEvts.length > 0 ? `<span style="font-size: 10px; font-weight: 700; color: var(--innovio-teal);">${dayEvts.length}</span>` : ''}
        </div>
        <div style="display: flex; flex-direction: column; gap: 2px; overflow: hidden; margin-top: 2px;">
          ${dayEvts.slice(0, 3).map(e => `
            <div class="t1-month-event-pill" title="${esc(e.titulo)}">
              <span>${e.hora || '—'}</span>
              <strong style="overflow: hidden; text-overflow: ellipsis;">${esc(e.titulo)}</strong>
            </div>
          `).join('')}
          ${dayEvts.length > 3 ? `<span style="font-size: 9px; color: var(--muted-color); font-weight: 600;">+${dayEvts.length - 3} más</span>` : ''}
        </div>
      </div>
    `;
  }

  wrap.innerHTML = `
    <div class="t1-month-view-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <button class="t1-nav-arrow-btn" id="btn-month-prev">‹</button>
          <button class="t1-nav-today-btn" id="btn-month-today">Hoy</button>
          <button class="t1-nav-arrow-btn" id="btn-month-next">›</button>
          <span style="font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--heading-color);">${monthNames[month]} ${year}</span>
        </div>
        <div style="font-size: 12px; color: var(--muted-color);">
          Haga clic en cualquier día para abrir su cronograma diario por horas.
        </div>
      </div>

      <div class="t1-mini-weekdays" style="font-size: 11px; margin-bottom: 8px;">
        <div>Domingo</div><div>Lunes</div><div>Martes</div><div>Miércoles</div><div>Jueves</div><div>Viernes</div><div>Sábado</div>
      </div>

      <div class="t1-month-grid">
        ${cellsHtml}
      </div>
    </div>
  `;

  document.getElementById('btn-month-prev').addEventListener('click', () => {
    activeDate.setMonth(activeDate.getMonth() - 1);
    renderMonthlyCalendarView(wrap);
  });
  document.getElementById('btn-month-next').addEventListener('click', () => {
    activeDate.setMonth(activeDate.getMonth() + 1);
    renderMonthlyCalendarView(wrap);
  });
  document.getElementById('btn-month-today').addEventListener('click', () => {
    activeDate = new Date();
    selectedDateStr = new Date().toISOString().slice(0, 10);
    renderMonthlyCalendarView(wrap);
  });

  wrap.querySelectorAll('.t1-month-day-cell[data-date]').forEach(cell => {
    cell.addEventListener('click', () => {
      selectedDateStr = cell.dataset.date;
      switchViewMode('dia');
    });
  });
}

// ── MODAL NUEVO / EDITAR COMPROMISO (SOLO CITA Y RECORDATORIO + SERVICIOS DINÁMICOS) ──
function showCompromisoModal(defaultDate = null, defaultHour = '09:00', existingEvt = null) {
  const modal = document.createElement('div');
  modal.className = 't1-drawer-overlay open';
  modal.style.display = 'flex';
  modal.style.alignItems = 'center';
  modal.style.justifyContent = 'center';
  modal.style.zIndex = '99999';

  const isEdit = !!existingEvt;
  const currentTipo = existingEvt?.tipo || 'cita';
  const startHour = existingEvt?.hora || defaultHour;
  let durMin = existingEvt?.duracion_min || 60;
  let endHour = existingEvt?.hora_fin || addMinutesToTime(startHour, durMin);

  // Generar opciones dinámicas del catálogo de servicios
  const serviceOptions = cachedServicios.map(s => {
    const isSelected = existingEvt?.servicio_id === s.id || existingEvt?.servicio_nombre === s.nombre;
    const durH = s.duracion_horas || (s.nombre.toLowerCase().includes('visita') || s.nombre.toLowerCase().includes('sitio') ? 2 : 1);
    return `<option value="${s.id || s.codigo}" data-nombre="${esc(s.nombre)}" data-dur="${durH}" ${isSelected ? 'selected' : ''}>${esc(s.nombre)} (${durH}h)</option>`;
  }).join('');

  // Generar opciones de OTs abiertas
  const otOptions = cachedOTs.map(ot => {
    const cli = ot.clientes?.empresa || ot.clientes?.nombre || 'Cliente';
    const isSelected = existingEvt?.tarea_id === ot.id;
    return `<option value="${ot.id}" data-cliente="${esc(cli)}" ${isSelected ? 'selected' : ''}>OT #${ot.doc_num || ot.id} - ${esc(cli)}</option>`;
  }).join('');

  modal.innerHTML = `
    <div style="background: var(--panel-bg); border-radius: 14px; width: 100%; max-width: 470px; padding: 22px; border: 1px solid var(--panel-border); box-shadow: 0 20px 48px rgba(0,0,0,0.25);">
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <h3 style="font-size: 16px; font-weight: 800; color: var(--heading-color); margin: 0;">
          ${isEdit ? 'Editar Compromiso' : 'Nuevo Compromiso'}
        </h3>
        <button id="modal-evt-close" style="background: transparent; border: none; font-size: 16px; color: var(--muted-color); cursor: pointer;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 12px;">
        
        <!-- TIPO DE COMPROMISO: ESTRICTO SOLO CITA O RECORDATORIO -->
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Tipo de Compromiso</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 4px;">
            <button type="button" class="t1-dur-selector-btn ${currentTipo === 'cita' ? 'active' : ''}" id="btn-tipo-cita" style="padding: 7px; text-align: center; font-size: 12px; font-weight: 700;">
              📅 Cita
            </button>
            <button type="button" class="t1-dur-selector-btn ${currentTipo === 'recordatorio' ? 'active' : ''}" id="btn-tipo-rec" style="padding: 7px; text-align: center; font-size: 12px; font-weight: 700;">
              ⏰ Recordatorio
            </button>
          </div>
          <input type="hidden" id="modal-evt-tipo" value="${currentTipo}" />
        </div>

        <!-- VINCULACIÓN CON CATÁLOGO DE SERVICIOS DINÁMICO -->
        <div id="wrap-servicio-select">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Servicio Asociado (Catálogo)</label>
            <span style="font-size: 10.5px; color: var(--innovio-teal); font-weight: 600;">Auto-ajusta horario</span>
          </div>
          <select id="modal-evt-servicio" style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12.5px;">
            <option value="">(Ninguno / Título personalizado)</option>
            ${serviceOptions}
          </select>
        </div>

        <!-- TÍTULO -->
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Título / Asunto</label>
          <input type="text" id="modal-evt-titulo" value="${existingEvt ? esc(existingEvt.titulo) : ''}" placeholder="Ej: Visita técnica en sitio o llamada de soporte" style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12.5px;" />
        </div>

        <!-- FECHA, HORARIOS Y GESTIÓN DE DURACIÓN (SIEMPRE EDITABLE) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Fecha</label>
            <input type="date" id="modal-evt-fecha" value="${existingEvt ? existingEvt.fecha : (defaultDate || selectedDateStr)}" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Hora Inicio</label>
            <input type="time" id="modal-evt-hora" value="${startHour}" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Hora Fin</label>
            <input type="time" id="modal-evt-horafin" value="${endHour}" style="width: 100%; padding: 7px 8px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
        </div>

        <!-- SELECTOR RÁPIDO DE DURACIÓN (GESTIONABLE SIEMPRE) -->
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10.5px; font-weight: 600; color: var(--muted-color);">Ajustar duración de la cita:</span>
            <span id="dur-calc-label" style="font-family: var(--font-mono); font-size: 11px; font-weight: 700; color: var(--innovio-teal);">${Math.round(durMin / 60 * 10) / 10} horas (${durMin} min)</span>
          </div>
          <div style="display: flex; gap: 5px; flex-wrap: wrap;" id="dur-quick-pills">
            <button type="button" class="t1-dur-selector-btn ${durMin === 30 ? 'active' : ''}" data-mins="30">30 min</button>
            <button type="button" class="t1-dur-selector-btn ${durMin === 60 ? 'active' : ''}" data-mins="60">1 hora</button>
            <button type="button" class="t1-dur-selector-btn ${durMin === 90 ? 'active' : ''}" data-mins="90">1.5 hrs</button>
            <button type="button" class="t1-dur-selector-btn ${durMin === 120 ? 'active' : ''}" data-mins="120">2 horas</button>
            <button type="button" class="t1-dur-selector-btn ${durMin === 180 ? 'active' : ''}" data-mins="180">3 horas</button>
            <button type="button" class="t1-dur-selector-btn ${durMin === 240 ? 'active' : ''}" data-mins="240">4 horas</button>
          </div>
        </div>

        <!-- VINCULAR ORDEN DE TRABAJO / TAREA (OPCIONAL) -->
        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Vincular Tarea / Orden de Trabajo (Opcional)</label>
          <select id="modal-evt-ot" style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;">
            <option value="">(Ninguna)</option>
            ${otOptions}
          </select>
        </div>

        <!-- CLIENTE Y PRIORIDAD -->
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Cliente</label>
            <input type="text" id="modal-evt-cliente" value="${existingEvt?.cliente ? esc(existingEvt.cliente) : ''}" placeholder="Ej: Distribuidora Prisma" style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;" />
          </div>
          <div>
            <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Prioridad</label>
            <select id="modal-evt-prioridad" style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; font-size: 12px;">
              <option value="alta" ${existingEvt?.prioridad === 'alta' ? 'selected' : ''}>🔴 Alta</option>
              <option value="media" ${!existingEvt || existingEvt?.prioridad === 'media' ? 'selected' : ''}>🟡 Media</option>
              <option value="baja" ${existingEvt?.prioridad === 'baja' ? 'selected' : ''}>🔵 Baja</option>
            </select>
          </div>
        </div>

        <div>
          <label style="font-size: 11px; font-weight: 700; color: var(--muted-color); text-transform: uppercase;">Detalles / Notas Internas</label>
          <textarea id="modal-evt-desc" rows="2" placeholder="Notas sobre el soporte, dirección o requerimientos..." style="width: 100%; padding: 8px 10px; border: 1px solid var(--panel-border); border-radius: 6px; background: var(--panel-subtle); color: var(--heading-color); margin-top: 4px; box-sizing: border-box; resize: vertical; font-size: 12px;">${existingEvt?.descripcion ? esc(existingEvt.descripcion) : ''}</textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
          <button id="modal-evt-cancel" style="padding: 7px 14px; font-size: 12px; font-weight: 600; border-radius: 6px; border: 1px solid var(--panel-border); background: var(--panel-bg); color: var(--muted-color); cursor: pointer;">Cancelar</button>
          <button id="modal-evt-save" class="t1-btn-primary" style="padding: 7px 16px;">Guardar Compromiso</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const tipoInput = modal.querySelector('#modal-evt-tipo');
  const btnCita = modal.querySelector('#btn-tipo-cita');
  const btnRec = modal.querySelector('#btn-tipo-rec');
  const srvSelect = modal.querySelector('#modal-evt-servicio');
  const otSelect = modal.querySelector('#modal-evt-ot');
  const tituloInput = modal.querySelector('#modal-evt-titulo');
  const clienteInput = modal.querySelector('#modal-evt-cliente');
  const horaStartInput = modal.querySelector('#modal-evt-hora');
  const horaEndInput = modal.querySelector('#modal-evt-horafin');
  const durLabel = modal.querySelector('#dur-calc-label');

  // Toggle Tipo (Cita vs Recordatorio)
  btnCita.onclick = () => {
    tipoInput.value = 'cita';
    btnCita.classList.add('active');
    btnRec.classList.remove('active');
    modal.querySelector('#wrap-servicio-select').style.display = 'block';
  };
  btnRec.onclick = () => {
    tipoInput.value = 'recordatorio';
    btnRec.classList.add('active');
    btnCita.classList.remove('active');
    modal.querySelector('#wrap-servicio-select').style.display = 'none';
  };

  // Cambio en Catálogo de Servicios -> Autocompleta Título y Horario estimado
  srvSelect.onchange = () => {
    const opt = srvSelect.options[srvSelect.selectedIndex];
    if (opt && opt.value) {
      const srvName = opt.dataset.nombre;
      const srvDurH = parseFloat(opt.dataset.dur) || 1;
      if (!tituloInput.value || tituloInput.value.startsWith('Visita') || tituloInput.value.startsWith('Soporte')) {
        tituloInput.value = srvName;
      }
      durMin = Math.round(srvDurH * 60);
      horaEndInput.value = addMinutesToTime(horaStartInput.value, durMin);
      updateDurUI();
    }
  };

  // Cambio en OT -> Autocompleta Cliente
  otSelect.onchange = () => {
    const opt = otSelect.options[otSelect.selectedIndex];
    if (opt && opt.value && opt.dataset.cliente) {
      clienteInput.value = opt.dataset.cliente;
    }
  };

  // Gestión de tiempo siempre dinámica:
  function updateDurUI() {
    durMin = calculateDurationMinutes(horaStartInput.value, horaEndInput.value);
    durLabel.textContent = `${Math.round(durMin / 60 * 10) / 10} horas (${durMin} min)`;
    modal.querySelectorAll('#dur-quick-pills .t1-dur-selector-btn').forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.mins, 10) === durMin);
    });
  }

  horaStartInput.onchange = () => {
    horaEndInput.value = addMinutesToTime(horaStartInput.value, durMin);
    updateDurUI();
  };

  horaEndInput.onchange = () => {
    updateDurUI();
  };

  modal.querySelectorAll('#dur-quick-pills .t1-dur-selector-btn').forEach(btn => {
    btn.onclick = () => {
      durMin = parseInt(btn.dataset.mins, 10);
      horaEndInput.value = addMinutesToTime(horaStartInput.value, durMin);
      updateDurUI();
    };
  });

  const closeModal = () => modal.remove();
  modal.querySelector('#modal-evt-close').onclick = closeModal;
  modal.querySelector('#modal-evt-cancel').onclick = closeModal;

  modal.querySelector('#modal-evt-save').onclick = async () => {
    const titulo = tituloInput.value.trim();
    if (!titulo) {
      toast('Por favor ingrese el título del compromiso', 'error');
      return;
    }
    const fecha = modal.querySelector('#modal-evt-fecha').value;
    const hora = horaStartInput.value;
    const hora_fin = horaEndInput.value;
    const tipo = tipoInput.value; // Estricto 'cita' o 'recordatorio'
    const prioridad = modal.querySelector('#modal-evt-prioridad').value;
    const cliente = clienteInput.value.trim();
    const descripcion = modal.querySelector('#modal-evt-desc').value.trim();

    const selectedSrvOpt = srvSelect.options[srvSelect.selectedIndex];
    const servicio_id = selectedSrvOpt?.value || null;
    const servicio_nombre = selectedSrvOpt?.dataset.nombre || null;
    const tarea_id = otSelect.value || null;

    if (isEdit) {
      existingEvt.titulo = titulo;
      existingEvt.tipo = tipo;
      existingEvt.fecha = fecha;
      existingEvt.hora = hora;
      existingEvt.hora_fin = hora_fin;
      existingEvt.duracion_min = durMin;
      existingEvt.servicio_id = servicio_id;
      existingEvt.servicio_nombre = servicio_nombre;
      existingEvt.tarea_id = tarea_id;
      existingEvt.prioridad = prioridad;
      existingEvt.cliente = cliente;
      existingEvt.descripcion = descripcion;
      
      const eventos = await getEventos();
      const idx = eventos.findIndex(e => e.id === existingEvt.id);
      if (idx !== -1) eventos[idx] = existingEvt;
      localStorage.setItem('innovio_agenda_eventos_v3', JSON.stringify(eventos));
      toast('Compromiso actualizado con éxito', 'success');
    } else {
      await addEvento({
        titulo,
        tipo,
        fecha,
        hora,
        hora_fin,
        duracion_min: durMin,
        servicio_id,
        servicio_nombre,
        tarea_id,
        prioridad,
        cliente,
        descripcion
      });
      toast(`${tipo === 'cita' ? 'Cita' : 'Recordatorio'} programado con éxito`, 'success');
    }

    selectedDateStr = fecha;
    closeModal();
    await loadAgendaData();
  };
}
