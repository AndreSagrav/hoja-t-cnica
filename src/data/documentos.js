// Helpers CRUD para documentos, líneas y hojas de trabajo.
// Trabaja con las MISMAS tablas de v1 sin mutar el esquema.
import { getSupabase } from '../lib/supabase.js';

// Mapa interno docKind → docTypeCode usado en BD
export const KIND_TO_CODE = { orden: 'OT', proforma: 'PRO', factura: 'FAC', cotizacion: 'COT' };
export const CODE_TO_KIND = { OT: 'orden', PRO: 'proforma', FAC: 'factura', COT: 'cotizacion' };
export const CODE_TO_LABEL = { OT: 'ORDEN DE TRABAJO', PRO: 'PROFORMA', FAC: 'FACTURA', COT: 'COTIZACIÓN' };

// ── Cliente: buscar/crear/actualizar ─────────────────────────────────────
// IMPORTANTE: la tabla `clientes` tiene muchos más campos que los básicos:
//   - cargo (puesto del contacto)
//   - fact_* (datos completos de facturación electrónica de Hacienda)
//   - usuarios_autorizados (JSON: lista de personas autorizadas en clientes empresariales)
// Cuando se actualiza un cliente desde el editor de documento, SOLO se tocan los
// campos básicos para NO PISAR la información rica de facturación / personal.

const CAMPOS_BASICOS_CLIENTE = [
  'nombre', 'empresa', 'tipo_cliente', 'cargo',
  'telefono', 'email', 'direccion', 'cedula', 'notas',
  'fact_tipo_id', 'fact_numero_id', 'fact_nombre', 'fact_email', 'fact_telefono', 'fact_regimen', 'fact_actividad', 'fact_provincia', 'fact_canton', 'fact_distrito', 'fact_barrio', 'fact_otras_senas'
];

export async function buscarClientes(search = '', limit = 20) {
  const supabase = await getSupabase();
  let q = supabase.from('clientes')
    .select('id, nombre, empresa, tipo_cliente, cargo, telefono, email, cedula, direccion')
    .order('nombre').limit(limit);
  if (search) {
    const s = search.replace(/[%]/g, '');
    q = q.or(`nombre.ilike.%${s}%,empresa.ilike.%${s}%,telefono.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).filter(c => !/^_+dup_/.test(c.nombre || ''));
}

// Parsea usuarios_autorizados (puede venir como string JSON o array)
export function parseUsuarios(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
  }
  return [];
}

export async function obtenerCliente(id) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
  if (error) throw error;
  data.usuarios_autorizados = parseUsuarios(data.usuarios_autorizados);
  return data;
}

// Crea o actualiza cliente. Si existe (id, teléfono o nombre), SOLO actualiza
// los campos básicos para preservar fact_* y usuarios_autorizados.
export async function crearOActualizarCliente(datos, currentClienteId = null) {
  const supabase = await getSupabase();
  const clienteData = {
    nombre: datos.nombre,
    empresa: datos.empresa || null,
    tipo_cliente: datos.tipo_cliente || 'residencial',
    cargo: datos.cargo || null,
    telefono: datos.telefono || null,
    email: datos.email || null,
    direccion: datos.direccion || null,
    cedula: datos.cedula || null,
    notas: datos.notas || null
  };
  if (datos.equipos && Array.isArray(datos.equipos) && datos.equipos.length > 0) {
    clienteData.equipos = datos.equipos;
  }
  
  if (datos.codigo_fiscal !== undefined) clienteData.codigo_fiscal = datos.codigo_fiscal;
  
  // Agregar campos de facturación solo si tienen valor real (no vacío)
  if (datos.fact_tipo_id) clienteData.fact_tipo_id = datos.fact_tipo_id;
  if (datos.fact_numero_id) clienteData.fact_numero_id = datos.fact_numero_id;
  if (datos.fact_nombre) clienteData.fact_nombre = datos.fact_nombre;
  if (datos.fact_email) clienteData.fact_email = datos.fact_email;
  if (datos.fact_telefono) clienteData.fact_telefono = datos.fact_telefono;
  if (datos.fact_regimen) clienteData.fact_regimen = datos.fact_regimen;
  if (datos.fact_actividad) clienteData.fact_actividad = datos.fact_actividad;
  if (datos.fact_provincia) clienteData.fact_provincia = datos.fact_provincia;
  if (datos.fact_canton) clienteData.fact_canton = datos.fact_canton;
  if (datos.fact_distrito) clienteData.fact_distrito = datos.fact_distrito;
  if (datos.fact_barrio) clienteData.fact_barrio = datos.fact_barrio;
  if (datos.fact_otras_senas) clienteData.fact_otras_senas = datos.fact_otras_senas;

  let existingId = currentClienteId;
  if (!existingId && datos.telefono) {
    const { data } = await supabase.from('clientes').select('id').eq('telefono', datos.telefono).maybeSingle();
    if (data) existingId = data.id;
  }
  if (!existingId && datos.nombre && datos.tipo_cliente === 'residencial') {
    const { data } = await supabase.from('clientes').select('id').eq('nombre', datos.nombre).maybeSingle();
    if (data) existingId = data.id;
  }
  // Para empresarial: buscar por nombre de empresa (caso ya existante)
  if (!existingId && datos.empresa && datos.tipo_cliente === 'empresarial') {
    const { data } = await supabase.from('clientes').select('id').eq('empresa', datos.empresa).maybeSingle();
    if (data) existingId = data.id;
  }

  let success = false;
  let maxRetries = 15;
  let finalData = null;
  
  if (!existingId && datos.tipo_cliente === 'empresarial') {
    clienteData.usuarios_autorizados = [];
  }

  while (!success && maxRetries > 0) {
    maxRetries--;
    const { data, error } = existingId 
      ? await supabase.from('clientes').update(clienteData).eq('id', existingId).select().single()
      : await supabase.from('clientes').insert([clienteData]).select().single();
      
    if (error) {
      if (error.message && error.message.includes("Could not find the") && error.message.includes("column")) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          const badCol = match[1];
          delete clienteData[badCol];
          console.warn(`Columna faltante detectada en Wizard: ${badCol}. Reintentando sin ella...`);
          continue;
        }
      }
      throw error;
    }
    finalData = data;
    success = true;
  }

  if (!success) throw new Error("No se pudo guardar el cliente en BD.");
  finalData.usuarios_autorizados = parseUsuarios(finalData.usuarios_autorizados);

  // Auto-asignar codigo_fiscal si es cliente nuevo y no lo tiene
  if (!existingId && !finalData.codigo_fiscal) {
    try {
      const { asignarCodigoFiscal } = await import('../lib/hacienda.js');
      finalData.codigo_fiscal = await asignarCodigoFiscal(finalData.id);
    } catch(e) {
      console.warn('No se pudo auto-asignar codigo_fiscal:', e);
    }
  }

  return finalData;
}

// ── Documento completo (con líneas y hoja de trabajo) ────────────────────
export async function obtenerDocumentoCompleto(id) {
  const supabase = await getSupabase();
  const { data: doc, error } = await supabase
    .from('documentos')
    .select('*, clientes(*), lineas_documento(*), hojas_trabajo(*)')
    .eq('id', id)
    .single();
  if (error) throw error;

  const lineas = (doc.lineas_documento || []).sort((a, b) => a.linea_num - b.linea_num);
  const hoja = (doc.hojas_trabajo && doc.hojas_trabajo[0]) || null;

  let trabajos = [];
  if (hoja) {
    const { data } = await supabase
      .from('trabajos_realizados')
      .select('*')
      .eq('hoja_trabajo_id', hoja.id)
      .order('tarea_num');
    trabajos = data || [];
  }

  return { doc, cliente: doc.clientes, lineas, hoja, trabajos };
}

// Guarda (crea o actualiza) un documento completo + sus líneas + hoja de trabajo.
// Devuelve { documentoId, clienteId }.
export async function guardarDocumentoCompleto(formData, currentDocumentoId = null, currentClienteId = null) {
  const supabase = await getSupabase();
  const code = KIND_TO_CODE[formData.docKind] || 'OT';

  if (!formData.date) formData.date = new Date().toLocaleDateString('en-CA');

  // Merge equipos si existen
  let clientEquipos = formData.equipos || [];
  if (currentClienteId && clientEquipos.length > 0) {
    try {
      const existingClient = await obtenerCliente(currentClienteId);
      if (existingClient && Array.isArray(existingClient.equipos)) {
        clientEquipos = [...existingClient.equipos, ...clientEquipos];
      }
    } catch(e) {}
  }

  // 1. Cliente
  const cliente = await crearOActualizarCliente({
    nombre: formData.clientName,
    empresa: formData.clientCompany,
    tipo_cliente: formData.clientType || 'residencial',
    cargo: formData.clientCargo,
    telefono: formData.clientPhone,
    email: formData.clientEmail,
    direccion: formData.clientAddress,
    cedula: formData.clientCedula,
    equipos: clientEquipos,
    ...(formData.clientFact || {}) // Pasa todos los campos fact_*
  }, currentClienteId);

  // 2. Calcular totales
  const lines = formData.lines || [];
  const gross = lines.reduce((sum, line) => sum + (line.precio || 0) * (line.cantidad || 0), 0);
  const net = formData.discount.enabled
    ? gross * (1 - (formData.discount.value / 100))
    : gross;
  const total = formData.iva.enabled
    ? net * (1 + (formData.iva.value / 100))
    : net;

  // 3. Guardar/actualizar documento
  const docData = {
    doc_type: code,
    doc_num: formData.docNum,
    fecha: formData.date,
    cliente_id: cliente.id,
    subtotal: gross,
    descuento: formData.discount.enabled ? formData.discount.value : 0,
    iva: formData.iva.enabled ? formData.iva.value : 0,
    total,
    estado: formData.estado,
    moneda: formData.currency.code,
    tipo_cambio: formData.currency.rate || 1,
    observaciones: formData.observations || ''
  };
  if (formData.tiempoEstimado) docData.tiempo_estimado = formData.tiempoEstimado;
  if (formData.docKind === 'orden' && Array.isArray(formData.equipos) && formData.equipos.length > 0) {
    docData.equipos = formData.equipos;
  }

  let docId = currentDocumentoId;
  let docRetry = 5;
  let docSaved = false;
  while (!docSaved && docRetry > 0) {
    docRetry--;
    let result;
    if (currentDocumentoId) {
      result = await supabase.from('documentos').update(docData).eq('id', currentDocumentoId).select('id');
    } else {
      result = await supabase.from('documentos').insert([docData]).select('id').single();
    }
    const { data, error } = result;
    if (error) {
      if (error.message && error.message.includes("Could not find the") && error.message.includes("column")) {
        const match = error.message.match(/Could not find the '([^']+)' column/);
        if (match && match[1]) {
          delete docData[match[1]];
          console.warn(`Columna faltante en documentos: ${match[1]}. Reintentando sin ella...`);
          continue;
        }
      }
      throw error;
    }
    docId = data.id;
    docSaved = true;
  }
  if (!docSaved) throw new Error("No se pudo guardar el documento en BD.");

  // 4. Guardar líneas
  const lineasData = lines.map((line, i) => ({
    documento_id: docId,
    linea_num: i + 1,
    descripcion: line.descripcion,
    cantidad: line.cantidad,
    precio_unitario: line.precio,
    total_linea: line.precio * line.cantidad
  }));

  // Siempre borrar líneas existentes antes (incluso si ahora no hay líneas)
  const { error: delError } = await supabase.from('lineas_documento').delete().eq('documento_id', docId);
  if (delError) throw delError;
  if (lineasData.length) {
    let lineasRetry = 5;
    let lineasSaved = false;
    let currentLineasData = [...lineasData];
    while (!lineasSaved && lineasRetry > 0) {
      lineasRetry--;
      const { error: insertError } = await supabase.from('lineas_documento').insert(currentLineasData);
      if (insertError) {
        if (insertError.message && insertError.message.includes("Could not find the") && insertError.message.includes("column")) {
          const match = insertError.message.match(/Could not find the '([^']+)' column/);
          if (match && match[1]) {
            const badCol = match[1];
            currentLineasData = currentLineasData.map(l => { delete l[badCol]; return l; });
            console.warn(`Columna faltante en lineas_documento: ${badCol}. Reintentando sin ella...`);
            continue;
          }
        }
        throw insertError;
      }
      lineasSaved = true;
    }
    if (!lineasSaved) throw new Error("No se pudieron guardar las líneas del documento.");
  }

  // 5. Guardar hoja de trabajo si aplica
  if (formData.docKind === 'orden') {
    const hojaData = {
      documento_id: docId,
      problema_reportado: formData.problem || '',
      diagnostico: formData.diagnosis || '',
      observaciones: formData.observations || '',
      hora_entrada: formData.timeIn || null,
      hora_salida: formData.timeOut || null
    };

    let hojaId;
    const { data: existingHoja } = await supabase.from('hojas_trabajo').select('id').eq('documento_id', docId).maybeSingle();
    if (existingHoja) {
      const { data, error } = await supabase.from('hojas_trabajo').update(hojaData).eq('id', existingHoja.id).select('id').single();
      if (error) throw error;
      hojaId = data.id;
    } else {
      const { data, error } = await supabase.from('hojas_trabajo').insert([hojaData]).select('id').single();
      if (error) throw error;
      hojaId = data.id;
    }

    if (formData.workItems && formData.workItems.length) {
      const { error: delError } = await supabase.from('trabajos_realizados').delete().eq('hoja_trabajo_id', hojaId);
      if (delError) throw delError;

      const trabajosData = formData.workItems.map(w => ({
        hoja_trabajo_id: hojaId,
        tarea_num: w.tarea_num,
        descripcion: w.descripcion,
        realizada: w.realizada
      }));
      const { error: insError } = await supabase.from('trabajos_realizados').insert(trabajosData);
      if (insError) throw insError;
    }
  }

  return { documentoId: docId, clienteId: cliente.id };
}

// Convierte un documento (OT/COT) en Factura: simplemente cambia el tipo a FAC
// en el mismo documento (mismo ID), manteniendo el mismo consecutivo, solo cambia el prefijo.
export async function convertirAFactura(documentoId) {
  const supabase = await getSupabase();
  const { data: doc, error } = await supabase
    .from('documentos')
    .select('doc_num')
    .eq('id', documentoId)
    .single();
  if (error) throw error;

  // Mantener el mismo consecutivo, solo cambiar el prefijo a FAC
  const oldNum = doc.doc_num || '';
  const newNum = oldNum.replace(/^[A-Z]+/, 'FAC');

  const { error: updError } = await supabase
    .from('documentos')
    .update({ doc_type: 'FAC', doc_num: newNum })
    .eq('id', documentoId);
  if (updError) throw updError;

  return documentoId;
}

// ── Funciones auxiliares para el editor ───────────────────────────────────
export function dbToFormData(completo) {
  const { doc, cliente, lineas, hoja, trabajos } = completo;
  return {
    docId: doc.id,
    docKind: CODE_TO_KIND[doc.doc_type] || 'orden',
    docType: CODE_TO_LABEL[doc.doc_type] || 'ORDEN DE TRABAJO',
    docNum: doc.doc_num,
    date: doc.fecha,
    estado: doc.estado,
    clientId: cliente?.id,
    clientName: cliente?.nombre || '',
    clientCompany: cliente?.empresa || '',
    clientType: cliente?.tipo_cliente || 'residencial',
    clientCargo: cliente?.cargo || '',
    clientPhone: cliente?.telefono || '',
    clientEmail: cliente?.email || '',
    clientAddress: cliente?.direccion || '',
    clientCedula: cliente?.cedula || '',
    lines: lineas.map(l => ({ descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precio_unitario || l.precio })),
    discount: { enabled: (doc.descuento || 0) > 0, value: doc.descuento || 0 },
    iva:      { enabled: (doc.iva || 0) > 0, value: doc.iva || 0 },
    currency: { code: doc.moneda || 'CRC', symbol: doc.moneda === 'CRC' ? '₡' : '$', rate: doc.tipo_cambio || 1 },
    problem: hoja?.problema_reportado || '',
    diagnosis: hoja?.diagnostico || '',
    observations: hoja?.observaciones || doc.observaciones || '',
    tiempoEstimado: doc.tiempo_estimado || '',
    timeIn: hoja?.hora_entrada || '',
    timeOut: hoja?.hora_salida || '',
    workItems: trabajos || [],
    tareasRealizadas: trabajos ? trabajos.map(t => t.descripcion) : []
  };
}

export async function sugerirSiguienteNumero(kind, clienteId = null) {
  if (clienteId) {
    try {
      const { generarNumeroDocumento } = await import('../lib/hacienda.js');
      return await generarNumeroDocumento(kind, clienteId);
    } catch (err) {
      console.warn('Hacienda gen falló, usando fallback:', err);
    }
  }
  const supabase = await getSupabase();
  const code = KIND_TO_CODE[kind] || 'OT';
  const { data, error } = await supabase.from('documentos')
    .select('doc_num')
    .eq('doc_type', code)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return `${code}-001`;
  const lastNum = data.doc_num;
  if (!lastNum) return `${code}-001`;
  const match = lastNum.match(/-(\d+)$/);
  if (!match) return `${code}-001`;
  const next = parseInt(match[1]) + 1;
  return `${code}-${String(next).padStart(3, '0')}`;
}