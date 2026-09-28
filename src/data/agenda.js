const LOCAL_KEY_AGENDA = 'innovio_agenda_eventos_v3';
const LOCAL_KEY_NOTAS = 'innovio_agenda_notas_v1';

const DEFAULT_EVENTOS = [
  {
    id: 'evt-1',
    titulo: 'Visita Técnica: Mantenimiento de Servidor',
    tipo: 'cita', // SOLO 'cita' o 'recordatorio'
    servicio_id: 'srv-vt',
    servicio_nombre: 'Visita Técnica / Campo (VT)',
    tarea_id: null,
    cliente: 'Distribuidora Prisma Limitada',
    fecha: '2026-09-28',
    hora: '10:00',
    hora_fin: '12:00',
    duracion_min: 120,
    descripcion: 'Revisión periódica de servidor local y pruebas de enlace',
    completada: false,
    prioridad: 'alta'
  },
  {
    id: 'evt-2',
    titulo: 'Soporte en Sitio: Configuración Firewall',
    tipo: 'cita',
    servicio_id: 'srv-ir',
    servicio_nombre: 'Infraestructura y Redes (IR)',
    tarea_id: null,
    cliente: 'T. R. Constructores y Consultores',
    fecha: '2026-09-29',
    hora: '14:30',
    hora_fin: '16:30',
    duracion_min: 120,
    descripcion: 'Configuración de reglas perimetrales y prueba de VPN',
    completada: false,
    prioridad: 'media'
  },
  {
    id: 'evt-3',
    titulo: 'Confirmar renovación contrato de soporte',
    tipo: 'recordatorio',
    servicio_id: null,
    servicio_nombre: null,
    tarea_id: null,
    cliente: 'Suministros y Servicios Integrales SSI',
    fecha: '2026-09-28',
    hora: '15:00',
    hora_fin: '15:30',
    duracion_min: 30,
    descripcion: 'Llamar a administración para confirmar adenda anual',
    completada: false,
    prioridad: 'alta'
  }
];

const DEFAULT_NOTAS = [
  { id: 'not-1', titulo: 'Cotizar licencias Microsoft 365', texto: 'Verificar precios con mayorista para paquete Business Standard.', color: 'yellow', fecha: '2026-09-26' },
  { id: 'not-2', titulo: 'Contacto T.R. Constructores', texto: 'Llamar a Arq. Solís el martes para confirmar horario de visita técnica.', color: 'cyan', fecha: '2026-09-25' },
  { id: 'not-3', titulo: 'Pendiente copia de respaldo', texto: 'Clonar disco del servidor local antes del mantenimiento mensual.', color: 'green', fecha: '2026-09-24' }
];

export async function getEventos() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_AGENDA);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveEventos(DEFAULT_EVENTOS);
  return DEFAULT_EVENTOS;
}

export function saveEventos(eventos) {
  try {
    localStorage.setItem(LOCAL_KEY_AGENDA, JSON.stringify(eventos));
  } catch {}
}

export async function addEvento(evt) {
  const eventos = await getEventos();
  const durMin = Number(evt.duracion_min) || calculateDurationMinutes(evt.hora, evt.hora_fin) || 60;
  const horaFin = evt.hora_fin || addMinutesToTime(evt.hora || '09:00', durMin);

  const newEvt = {
    id: 'evt-' + Date.now(),
    titulo: evt.titulo.trim(),
    tipo: evt.tipo === 'recordatorio' ? 'recordatorio' : 'cita', // ESTRICTO: Solo 'cita' o 'recordatorio'
    servicio_id: evt.servicio_id || null,
    servicio_nombre: evt.servicio_nombre || '',
    tarea_id: evt.tarea_id || null,
    cliente: evt.cliente || '',
    fecha: evt.fecha || new Date().toISOString().slice(0, 10),
    hora: evt.hora || '09:00',
    hora_fin: horaFin,
    duracion_min: durMin,
    descripcion: evt.descripcion || '',
    completada: false,
    prioridad: evt.prioridad || 'media'
  };
  eventos.push(newEvt);
  saveEventos(eventos);
  return newEvt;
}

export async function toggleEventoCompletado(id) {
  const eventos = await getEventos();
  const evt = eventos.find(e => e.id === id);
  if (evt) {
    evt.completada = !evt.completada;
    saveEventos(eventos);
    return evt;
  }
  return null;
}

export async function deleteEvento(id) {
  const eventos = await getEventos();
  const filtered = eventos.filter(e => e.id !== id);
  saveEventos(filtered);
  return true;
}

export function calculateDurationMinutes(startTime, endTime) {
  if (!startTime || !endTime) return 60;
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  const diff = endMins - startMins;
  return diff > 0 ? diff : 60;
}

export function addMinutesToTime(startTime, minutes) {
  if (!startTime) return '10:00';
  const [h, m] = startTime.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const newH = Math.floor(total / 60) % 24;
  const newM = total % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// ── Notas Rápidas ──────────────────────────────────────────
export async function getNotas() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY_NOTAS);
    if (raw) return JSON.parse(raw);
  } catch {}
  saveNotas(DEFAULT_NOTAS);
  return DEFAULT_NOTAS;
}

export function saveNotas(notas) {
  try {
    localStorage.setItem(LOCAL_KEY_NOTAS, JSON.stringify(notas));
  } catch {}
}

export async function addNota(nota) {
  const notas = await getNotas();
  const newNota = {
    id: 'not-' + Date.now(),
    titulo: nota.titulo || 'Nota rápida',
    texto: nota.texto || '',
    color: nota.color || 'yellow',
    fecha: new Date().toISOString().slice(0, 10)
  };
  notas.unshift(newNota);
  saveNotas(notas);
  return newNota;
}

export async function deleteNota(id) {
  const notas = await getNotas();
  const filtered = notas.filter(n => n.id !== id);
  saveNotas(filtered);
  return true;
}
