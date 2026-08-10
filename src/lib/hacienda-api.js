// Integración con APIs públicas de Hacienda CR y TSE
// En dev: usa proxies locales del servidor Vite
// En prod: usa múltiples proxies CORS públicos con fallback

const IS_DEV = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.port === '5173' || location.port === '5174';

// Lista de proxies CORS públicos (se prueban en orden hasta que uno funcione)
const CORS_PROXIES = [
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.codetabs.com/v1/proxy/?quest=' + url,
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
];

const API_HACIENDA_BASE = 'https://api.hacienda.go.cr/fe/ae';
const API_GOMETA_BASE = 'https://apis.gometa.org/cedulas';
const API_CORREO_BASE = 'https://api.hacienda.go.cr/fe/mifacturacorreo';

const API_HACIENDA = IS_DEV ? '/api/hacienda/ae' : API_HACIENDA_BASE;
const API_GOMETA = IS_DEV ? '/api/gometa/cedulas' : API_GOMETA_BASE;
const API_CORREO = IS_DEV ? '/api/hacienda/correo' : API_CORREO_BASE;

async function fetchWithProxy(targetUrl) {
  if (IS_DEV) {
    const resp = await fetch(targetUrl);
    if (!resp.ok) return null;
    return resp;
  }
  // Probar cada proxy CORS hasta que uno funcione
  for (const proxy of CORS_PROXIES) {
    try {
      const proxiedUrl = proxy(targetUrl);
      const resp = await fetch(proxiedUrl);
      if (resp.ok) return resp;
    } catch (e) {
      // Continuar con el siguiente proxy
    }
  }
  return null;
}

function buildTargetUrl(base, params) {
  const target = new URL(base);
  for (const [k, v] of Object.entries(params)) target.searchParams.set(k, v);
  return target.toString();
}

// Mapeo de tipos de identificación de Hacienda
const TIPO_ID_MAP = {
  '01': 'fisica',
  '02': 'juridica',
  '03': 'DIMEX',
  '04': 'NITE'
};

const TIPO_ID_LABEL = {
  '01': 'Física',
  '02': 'Jurídica',
  '03': 'DIMEX',
  '04': 'NITE'
};

/**
 * Consulta los datos fiscales de una persona física o jurídica
 * Combina Hacienda (datos tributarios) + Gometa/TSE (datos personales) + Yo Contribuyo (correo)
 * @param {string} identificacion - Número de cédula sin guiones
 * @returns {object|null} - Datos fiscales combinados o null si no se encuentra
 */
export async function consultarIdentificacionHacienda(identificacion) {
  const limpia = identificacion.replace(/[^0-9]/g, '');
  if (!limpia) return null;

  // Consultar las 3 APIs en paralelo via proxy CORS
  const [haciendaData, gometaData, correoData] = await Promise.allSettled([
    fetchHacienda(limpia),
    fetchGometa(limpia),
    fetchCorreo(limpia)
  ]);

  const h = haciendaData.status === 'fulfilled' ? haciendaData.value : null;
  const g = gometaData.status === 'fulfilled' ? gometaData.value : null;
  const correo = correoData.status === 'fulfilled' ? correoData.value : null;

  if (!h && !g) return null;

  // Combinar datos: Hacienda tiene prioridad para fiscales, Gometa para personales
  const tipoId = h?.tipoIdentificacion || g?.tipoIdentificacion || '';
  const regimen = h?.regimen || {};
  const situacion = h?.situacion || {};
  const actividades = h?.actividades || [];
  const actividadPrincipal = actividades.find(a => a.estado === 'A') || actividades[0] || null;

  // Nombre: Hacienda da el nombre fiscal completo, Gometa da nombre separado
  const nombre = h?.nombre || g?.fullname || '';
  const nombreCompleto = g ? {
    primerNombre: g.firstname1 || '',
    segundoNombre: g.firstname2 || '',
    primerApellido: g.lastname1 || '',
    segundoApellido: g.lastname2 || '',
    nombreCompleto: g.fullname || ''
  } : null;

  return {
    nombre,
    nombreCompleto,
    tipoIdentificacion: tipoId,
    tipoIdentificacionLabel: TIPO_ID_LABEL[tipoId] || tipoId,
    tipoIdNormalizado: TIPO_ID_MAP[tipoId] || (g?.guess_type || '').toLowerCase(),
    regimen: regimen.descripcion || '',
    regimenCodigo: regimen.codigo || null,
    estado: situacion.estado || '',
    moroso: situacion.moroso || '',
    omiso: situacion.omiso || '',
    administracionTributaria: situacion.administracionTributaria || '',
    actividadCodigo: actividadPrincipal?.codigo || '',
    actividadDescripcion: actividadPrincipal?.descripcion || '',
    actividades: actividades.map(a => ({
      codigo: a.codigo,
      descripcion: a.descripcion,
      estado: a.estado,
      tipo: a.tipo
    })),
    // Datos adicionales de Gometa/TSE
    rawCedula: g?.rawcedula || '',
    adminTSE: g?.admin || '',
    claseTSE: g?.class || '',
    // Correo de facturación (solo si el contribuyente está registrado en Yo Contribuyo)
    correo: correo || ''
  };
}

async function fetchHacienda(limpia) {
  const targetUrl = IS_DEV
    ? `${API_HACIENDA}?identificacion=${limpia}`
    : buildTargetUrl(API_HACIENDA_BASE, { identificacion: limpia });
  const resp = await fetchWithProxy(targetUrl);
  if (!resp) return null;
  const data = await resp.json();
  if (!data || !data.nombre) return null;
  return data;
}

async function fetchGometa(limpia) {
  const targetUrl = `${API_GOMETA_BASE}/${limpia}`;
  const resp = await fetchWithProxy(IS_DEV ? `${API_GOMETA}/${limpia}` : targetUrl);
  if (!resp) return null;
  const data = await resp.json();
  if (!data || !data.results || !data.results.length) return null;
  const r = data.results[0];
  return {
    fullname: r.fullname || data.nombre || '',
    firstname1: r.firstname1 || '',
    firstname2: r.firstname2 || '',
    lastname1: r.lastname1 || '',
    lastname2: r.lastname2 || '',
    firstname: r.firstname || '',
    lastname: r.lastname || '',
    tipoIdentificacion: data.tipoIdentificacion || r.guess_type_num || '',
    guess_type: r.guess_type || '',
    rawcedula: r.rawcedula || '',
    admin: r.admin || '',
    class: r.class || ''
  };
}

async function fetchCorreo(limpia) {
  // Yo Contribuyo - solo retorna datos si el contribuyente se ha registrado
  const targetUrl = IS_DEV
    ? `${API_CORREO}?identificacion=${limpia}`
    : buildTargetUrl(API_CORREO_BASE, { identificacion: limpia });
  const resp = await fetchWithProxy(targetUrl);
  if (!resp) return null;
  const data = await resp.json();
  if (!data || !data.Resultado || !data.Resultado.Correo) return null;
  return data.Resultado.Correo;
}

/**
 * Consulta y mapea directamente a los campos de la BD del cliente
 * @param {string} identificacion 
 * @returns {object} - Campos fact_* listos para guardar
 */
export async function consultarYMapearCliente(identificacion) {
  const data = await consultarIdentificacionHacienda(identificacion);
  if (!data) return null;

  return {
    fact_tipo_id: data.tipoIdNormalizado,
    fact_numero_id: identificacion.replace(/[^0-9]/g, ''),
    fact_nombre: data.nombre,
    fact_regimen: data.regimenCodigo === 1 ? 'contribuyente_general' : data.regimen.toLowerCase().replace(/\s+/g, '_'),
    fact_actividad: data.actividadCodigo,
    _estado: data.estado,
    _actividadDescripcion: data.actividadDescripcion,
    _todasActividades: data.actividades,
    _moroso: data.moroso,
    _omiso: data.omiso,
    _adminTributaria: data.administracionTributaria,
    _nombreCompleto: data.nombreCompleto
  };
}
