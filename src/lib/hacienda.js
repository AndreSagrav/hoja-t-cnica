// Generadores de consecutivos y clave numérica para Hacienda CR
// Consecutivo: 20 dígitos (TTT SSSSS TTTTT CCCCCCC)
// Clave numérica: 50 dígitos (506 DD MM AA CCCCCCCCCCCC CCCCCCCCCCCCCCCCCCCC S CCCCCCCC)

import { getSupabase } from './supabase.js';

// Tipos de comprobante de Hacienda
export const TIPO_COMPROBANTE = {
  FACTURA_ELECTRONICA: '001',
  TIQUETE_ELECTRONICO: '002',
  NOTA_CREDITO: '003',
  NOTA_DEBITO: '004',
  FACTURA_COMPRA: '005',
  FACTURA_EXPORTACION: '006',
  RECIBO_PAGO: '007'
};

// Sucursal fija del sistema (10001 para no conflictuar con otros sistemas que usan 00001)
const SUCURSAL_DEFAULT = 10001;

/**
 * Obtiene la configuración fiscal del emisor desde la BD
 */
export async function getFiscalConfig() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('fiscal_config').select('*').limit(1).single();
  if (error || !data) {
    return { sucursal: SUCURSAL_DEFAULT, cedula_emisor: '002053901800', nombre_emisor: 'César' };
  }
  return data;
}

/**
 * Obtiene el código fiscal de un cliente desde la BD
 * Si no tiene, lo auto-asigna
 */
export async function getCodigoFiscalCliente(clienteId) {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('clientes')
    .select('codigo_fiscal')
    .eq('id', clienteId)
    .single();
  if (error || !data) return null;
  if (data.codigo_fiscal) return data.codigo_fiscal;
  return await asignarCodigoFiscal(clienteId);
}

/**
 * Auto-asigna un código fiscal secuencial a un cliente
 */
export async function asignarCodigoFiscal(clienteId) {
  const supabase = await getSupabase();
  const { data: maxData } = await supabase.from('clientes')
    .select('codigo_fiscal')
    .order('codigo_fiscal', { ascending: false })
    .limit(1)
    .not('codigo_fiscal', 'is', null);
  const nextCode = (maxData?.[0]?.codigo_fiscal || 0) + 1;
  const { error } = await supabase.from('clientes')
    .update({ codigo_fiscal: nextCode })
    .eq('id', clienteId);
  if (error) throw error;
  return nextCode;
}

/**
 * Genera el consecutivo de Hacienda (20 dígitos)
 * TTT SSSSS TTTTT CCCCCCC
 */
export function generarConsecutivo(tipo, sucursal, codigoCliente, secuencia) {
  const t = String(tipo).padStart(3, '0');
  const s = String(sucursal).padStart(5, '0');
  const c = String(codigoCliente).padStart(5, '0');
  const n = String(secuencia).padStart(7, '0');
  return `${t}${s}${c}${n}`;
}

/**
 * Genera la clave numérica de Hacienda (50 dígitos)
 * 506 DD MM AA CCCCCCCCCCCC CCCCCCCCCCCCCCCCCCCC S CCCCCCCC
 */
export function generarClaveNumerica(fecha, cedulaEmisor, consecutivo, situacion = '1') {
  const d = String(fecha.getDate()).padStart(2, '0');
  const m = String(fecha.getMonth() + 1).padStart(2, '0');
  const a = String(fecha.getFullYear()).slice(-2);
  const cedula = String(cedulaEmisor).padStart(12, '0');
  const codigoSeguridad = String(Math.floor(Math.random() * 90000000) + 10000000);
  return `506${d}${m}${a}${cedula}${consecutivo}${situacion}${codigoSeguridad}`;
}

/**
 * Genera el número interno para OT o COT
 * Formato: PREFIJO-SUCURSAL-CLIENTE-CONSECUTIVO
 */
export function generarNumeroInterno(prefijo, sucursal, codigoCliente, secuencia) {
  const s = String(sucursal).padStart(5, '0');
  const c = String(codigoCliente).padStart(5, '0');
  const n = String(secuencia).padStart(4, '0');
  return `${prefijo}-${s}-${c}-${n}`;
}

/**
 * Obtiene el siguiente consecutivo para un cliente y tipo de documento
 * Consulta y actualiza la tabla documento_consecutivos
 * Usa optimistic locking con retry para evitar race conditions
 */
export async function siguienteConsecutivo(clienteId, docType) {
  const supabase = await getSupabase();
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase.from('documento_consecutivos')
      .select('ultimo_consecutivo')
      .eq('cliente_id', clienteId)
      .eq('doc_type', docType)
      .maybeSingle();

    if (error) throw error;

    const currentVal = data?.ultimo_consecutivo || 0;
    const next = currentVal + 1;

    if (data) {
      // Optimistic locking: only update if the value hasn't changed
      const { error: updError, count } = await supabase.from('documento_consecutivos')
        .update({ ultimo_consecutivo: next, updated_at: new Date().toISOString() })
        .eq('cliente_id', clienteId)
        .eq('doc_type', docType)
        .eq('ultimo_consecutivo', currentVal);
      if (updError) throw updError;
      // If count is 0, someone else updated it — retry
      if (count === 0) continue;
    } else {
      const { error: insError } = await supabase.from('documento_consecutivos')
        .insert({ cliente_id: clienteId, doc_type: docType, ultimo_consecutivo: next });
      if (insError) {
 // Another process may have inserted — retry
 if (insError.code === '23505') continue;
        throw insError;
      }
    }

    return next;
  }

  throw new Error('No se pudo obtener consecutivo tras varios intentos (race condition)');
}

/**
 * Proyecta el número del próximo documento SIN consumir el consecutivo
 * Solo lectura — para vista previa
 */
export async function proyectarNumeroDocumento(kind, clienteId) {
  const config = await getFiscalConfig();
  const codigoCliente = clienteId ? await getCodigoFiscalCliente(clienteId) : null;

  const prefijo = kind === 'orden' ? 'OT' : kind === 'cotizacion' ? 'COT' : kind === 'factura' ? 'FAC' : kind === 'proforma' ? 'PRO' : null;
  if (!prefijo) return null;

  if (!codigoCliente) {
    // Sin cliente: usar fallback simple
    return `${prefijo}-000`;
  }

  const supabase = await getSupabase();
  const { data } = await supabase.from('documento_consecutivos')
    .select('ultimo_consecutivo')
    .eq('cliente_id', clienteId)
    .eq('doc_type', prefijo)
    .maybeSingle();

  const nextSeq = (data?.ultimo_consecutivo || 0) + 1;
  return generarNumeroInterno(prefijo, config.sucursal, codigoCliente, nextSeq);
}

/**
 * Genera el número completo para un documento OT o COT
 * Incluye consecutivo de Hacienda si es factura
 */
export async function generarNumeroDocumento(kind, clienteId) {
  const config = await getFiscalConfig();
  const codigoCliente = await getCodigoFiscalCliente(clienteId);
  if (!codigoCliente) throw new Error('No se pudo obtener el código fiscal del cliente');

  const prefijo = kind === 'orden' ? 'OT' : kind === 'cotizacion' ? 'COT' : kind === 'factura' ? 'FAC' : kind === 'proforma' ? 'PRO' : null;
  if (!prefijo) throw new Error(`Tipo de documento no soportado: ${kind}`);

  const seq = await siguienteConsecutivo(clienteId, prefijo);
  return generarNumeroInterno(prefijo, config.sucursal, codigoCliente, seq);
}

/**
 * Genera el consecutivo completo de factura electrónica para Hacienda
 */
export async function generarFacturaHacienda(clienteId) {
  const config = await getFiscalConfig();
  const codigoCliente = await getCodigoFiscalCliente(clienteId);
  if (!codigoCliente) throw new Error('No se pudo obtener el código fiscal del cliente');

  const seq = await siguienteConsecutivo(clienteId, 'FAC');
  const consecutivo = generarConsecutivo(
    TIPO_COMPROBANTE.FACTURA_ELECTRONICA,
    config.sucursal,
    codigoCliente,
    seq
  );
  const clave = generarClaveNumerica(
    new Date(),
    config.cedula_emisor,
    consecutivo,
    '1'
  );

  return {
    consecutivo,
    clave,
    secuencia: seq,
    tipo: TIPO_COMPROBANTE.FACTURA_ELECTRONICA,
    sucursal: config.sucursal,
    codigoCliente
  };
}
