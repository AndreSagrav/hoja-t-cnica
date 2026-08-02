// ============================================================
// INNOVIO — Cloud & Local Tax Data Sync
// Reads/Writes from Supabase `fiscal_facturas` table with fallback to /api/facturas XMLs
// ============================================================

import { getSupabase } from './supabase.js';
import { parseComprobanteXML, clasificarComprobante } from './xml-parser.js';

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 1000;

const CEDULA = '205390118';
const EMPTY = { ingresosMes: [], gastosMes: [], ingresosAnio: [], gastosAnio: [], allIngresos: [], allGastos: [], creditos: [], categorias: [] };

function xmlToRecord(f, parsed, tipo) {
  const bruto = parsed.totalComprobante || 0;
  const tarifa = parsed.tarifaIVA || 0;
  const iva = parsed.totalImpuesto || 0;
  const neto = bruto - iva;
  const fecha = parsed.fecha ? parsed.fecha.toISOString().split('T')[0] : null;
  const dateObj = parsed.fecha || new Date();

  return {
    id: parsed.clave || f.name,
    fecha,
    descripcion: parsed.descripcion || f.name,
    cliente: tipo === 'ingreso' ? (parsed.receptor?.nombre || '') : '',
    proveedor: tipo === 'gasto' ? (parsed.emisor?.nombre || '') : '',
    monto_bruto: bruto,
    tarifa_iva: tarifa,
    monto_iva: iva,
    monto_neto: neto,
    desgloseIVA: parsed.desgloseIVA || null,
    fuente: 'xml',
    xml_clave: parsed.clave || '',
    deducible: true,
    periodo_mes: dateObj.getMonth() + 1,
    periodo_anio: dateObj.getFullYear(),
    categoria_nombre: null,
    notas: ''
  };
}

export async function fetchTaxData(anio, mes, force = false) {
  if (!force && cache && (Date.now() - cacheTime < CACHE_TTL) && cache.anio === anio && cache.mes === mes) {
    return cache.data;
  }

  let allIngresos = [];
  let allGastos = [];
  let loadedFromCloud = false;

  // 1. Intentar cargar desde Supabase (fiscal_facturas)
  try {
    const supabase = await getSupabase();
    const { data: cloudData, error } = await supabase.from('fiscal_facturas').select('*');

    if (!error && cloudData && cloudData.length > 0) {
      loadedFromCloud = true;
      cloudData.forEach(row => {
        const rec = {
          id: row.id,
          fecha: row.fecha,
          descripcion: row.descripcion || '',
          cliente: row.cliente || '',
          proveedor: row.proveedor || '',
          monto_bruto: Number(row.monto_bruto || 0),
          tarifa_iva: Number(row.tarifa_iva || 0),
          monto_iva: Number(row.monto_iva || 0),
          monto_neto: Number(row.monto_neto || 0),
          desgloseIVA: row.desglose_iva || null,
          fuente: row.raw_xml ? 'xml' : 'manual',
          xml_clave: row.xml_clave || '',
          deducible: row.deducible !== false,
          periodo_mes: row.periodo_mes || (row.fecha ? new Date(row.fecha).getMonth() + 1 : 1),
          periodo_anio: row.periodo_anio || (row.fecha ? new Date(row.fecha).getFullYear() : anio),
          categoria_nombre: row.categoria_nombre || null,
          notas: row.notas || ''
        };

        if (row.tipo === 'ingreso') {
          allIngresos.push(rec);
        } else if (row.tipo === 'gasto') {
          allGastos.push(rec);
        }
      });
    }
  } catch (e) {
    console.warn('Supabase fiscal_facturas sync warning:', e);
  }

  // 2. Si Supabase está vacío o no disponible, intentar cargar desde /api/facturas (entorno local dev)
  if (!loadedFromCloud) {
    try {
      const res = await fetch('/api/facturas', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const metadata = data.metadata || {};
        const seenClaves = new Set();
        const allRecords = [];

        for (const f of data.files) {
          const parsed = parseComprobanteXML(f.xml);
          const tipo = clasificarComprobante(parsed, CEDULA);
          if (tipo === 'desconocido') continue;

          if (parsed.clave && seenClaves.has(parsed.clave)) continue;
          if (parsed.clave) seenClaves.add(parsed.clave);

          const record = xmlToRecord(f, parsed, tipo);
          const meta = metadata[record.id];
          if (meta) {
            if (typeof meta.deducible !== 'undefined') record.deducible = meta.deducible;
            if (meta.categoria_nombre) record.categoria_nombre = meta.categoria_nombre;
          }

          allRecords.push({ record, tipo, xml: f.xml });
        }

        allIngresos = allRecords.filter(r => r.tipo === 'ingreso').map(r => r.record);
        allGastos = allRecords.filter(r => r.tipo === 'gasto').map(r => r.record);

        // Auto-sembrar datos en Supabase en segundo plano si la tabla existe
        syncLocalRecordsToCloud(allRecords).catch(err => console.warn('Background fiscal cloud seed:', err));
      }
    } catch (_) {}
  }

  // 3. Filtrar por período
  const filterByPeriod = (arr) => {
    if (mes === 0) return arr.filter(r => r.periodo_anio === anio);
    return arr.filter(r => r.periodo_mes === mes && r.periodo_anio === anio);
  };

  const result = {
    ingresosMes: filterByPeriod(allIngresos),
    gastosMes: filterByPeriod(allGastos),
    ingresosAnio: allIngresos.filter(r => r.periodo_anio === anio),
    gastosAnio: allGastos.filter(r => r.periodo_anio === anio),
    allIngresos,
    allGastos,
    creditos: [],
    categorias: []
  };

  cache = { anio, mes, data: result };
  cacheTime = Date.now();
  return result;
}

// Sincroniza registros locales XML a Supabase
async function syncLocalRecordsToCloud(allRecords) {
  try {
    const supabase = await getSupabase();
    const rows = allRecords.map(({ record, tipo, xml }) => ({
      id: record.id,
      tipo,
      fecha: record.fecha,
      descripcion: record.descripcion,
      cliente: record.cliente,
      proveedor: record.proveedor,
      monto_bruto: record.monto_bruto,
      tarifa_iva: record.tarifa_iva,
      monto_iva: record.monto_iva,
      monto_neto: record.monto_neto,
      desglose_iva: record.desgloseIVA,
      xml_clave: record.xml_clave,
      deducible: record.deducible,
      periodo_mes: record.periodo_mes,
      periodo_anio: record.periodo_anio,
      categoria_nombre: record.categoria_nombre,
      notas: record.notas,
      raw_xml: xml || null
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      await supabase.from('fiscal_facturas').upsert(chunk);
    }
  } catch (err) {
    console.warn('Could not sync local records to Supabase:', err);
  }
}

export async function saveSingleTaxRecord(record, tipo, rawXml = null) {
  try {
    const supabase = await getSupabase();
    const row = {
      id: record.id,
      tipo,
      fecha: record.fecha,
      descripcion: record.descripcion,
      cliente: record.cliente,
      proveedor: record.proveedor,
      monto_bruto: record.monto_bruto,
      tarifa_iva: record.tarifa_iva,
      monto_iva: record.monto_iva,
      monto_neto: record.monto_neto,
      desglose_iva: record.desgloseIVA || null,
      xml_clave: record.xml_clave || '',
      deducible: record.deducible !== false,
      periodo_mes: record.periodo_mes,
      periodo_anio: record.periodo_anio,
      categoria_nombre: record.categoria_nombre || null,
      notas: record.notas || '',
      raw_xml: rawXml
    };
    await supabase.from('fiscal_facturas').upsert([row]);
  } catch (err) {
    console.warn('Cloud save tax record error:', err);
  }
  invalidateTaxCache();
}

export async function updateTaxMetadata(id, updates) {
  try {
    const supabase = await getSupabase();
    const payload = {};
    if (typeof updates.deducible !== 'undefined') payload.deducible = updates.deducible;
    if (updates.categoria_nombre) payload.categoria_nombre = updates.categoria_nombre;
    if (typeof updates.notas !== 'undefined') payload.notas = updates.notas;

    await supabase.from('fiscal_facturas').update(payload).eq('id', id);
  } catch (_) {}

  try {
    await fetch('/api/facturas/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates })
    });
  } catch (_) {}

  invalidateTaxCache();
}

export function invalidateTaxCache() {
  cache = null;
}
