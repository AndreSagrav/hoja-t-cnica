// ============================================================
// INNOVIO — Local Tax Data (reads from /api/facturas instead of Supabase)
// Provides the same interface as tax-data.js but uses local XML files
// ============================================================

import { parseComprobanteXML, clasificarComprobante } from './xml-parser.js';
import { calcularMontos } from './tax-engine.js';

let cache = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 1000; // 5 seconds — short cache so new XMLs appear quickly

const CEDULA = '205390118';

const EMPTY = { ingresosMes: [], gastosMes: [], ingresosAnio: [], gastosAnio: [], creditos: [], categorias: [] };

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
    tax_categories: null,
    notas: ''
  };
}

export async function fetchTaxData(anio, mes, force = false) {
  if (!force && cache && (Date.now() - cacheTime < CACHE_TTL) && cache.anio === anio && cache.mes === mes) {
    return cache.data;
  }

  try {
    const res = await fetch('/api/facturas', { cache: 'no-store' });
    const data = await res.json();
    const metadata = data.metadata || {};
    
    const seenClaves = new Set();
    const allRecords = [];
    
    for (const f of data.files) {
      const parsed = parseComprobanteXML(f.xml);
      
      const tipo = clasificarComprobante(parsed, CEDULA);
      
      // Ignorar mensajes de confirmación de Hacienda u otros XMLs desconocidos
      // para que no bloqueen a la factura real en el filtro anti-duplicados.
      if (tipo === 'desconocido') continue;

      // Filtro Anti-Duplicados por Clave Oficial de Hacienda
      if (parsed.clave && seenClaves.has(parsed.clave)) {
        continue;
      }
      if (parsed.clave) {
        seenClaves.add(parsed.clave);
      }

      const record = xmlToRecord(f, parsed, tipo);
      
      // Apply metadata overrides
      const meta = metadata[record.id];
      if (meta) {
        if (typeof meta.deducible !== 'undefined') record.deducible = meta.deducible;
        if (meta.categoria_nombre) record.categoria_nombre = meta.categoria_nombre;
      }
      
      allRecords.push({ record, tipo, parsed });
    }

    const ingresos = allRecords.filter(r => r.tipo === 'ingreso').map(r => r.record);
    const gastos = allRecords.filter(r => r.tipo === 'gasto').map(r => r.record);

    // mes=0 means "all months"
    const filterByPeriod = (arr) => {
      if (mes === 0) return arr.filter(r => r.periodo_anio === anio);
      return arr.filter(r => r.periodo_mes === mes && r.periodo_anio === anio);
    };

    const result = {
      ingresosMes: filterByPeriod(ingresos),
      gastosMes: filterByPeriod(gastos),
      ingresosAnio: ingresos.filter(r => r.periodo_anio === anio),
      gastosAnio: gastos.filter(r => r.periodo_anio === anio),
      allIngresos: ingresos,
      allGastos: gastos,
      creditos: [],
      categorias: []
    };

    cache = { anio, mes, data: result };
    cacheTime = Date.now();
    return result;
  } catch {
    return EMPTY;
  }
}

export async function updateTaxMetadata(id, updates) {
  try {
    await fetch('/api/facturas/metadata', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates })
    });
    invalidateTaxCache();
  } catch (err) {
    console.error('Error updating metadata:', err);
  }
}

export function invalidateTaxCache() {
  cache = null;
}
