// ============================================================
// INNOVIO Tax Module — Fiscal Engine (Costa Rica)
// IVA (D-150) + Renta (D-101) calculations
// ============================================================

/**
 * Tarifas de IVA vigentes en Costa Rica (Ley 9635)
 */
export const IVA_RATES = [
  { value: 13,  label: '13% — General',               description: 'Tarifa general para bienes y servicios' },
  { value: 4,   label: '4% — Salud privada',           description: 'Servicios de salud privada, boletos aéreos' },
  { value: 2,   label: '2% — Medicamentos/Educación',  description: 'Medicamentos, educación privada, seguros personales' },
  { value: 1,   label: '1% — Canasta básica',          description: 'Productos de la canasta básica tributaria' },
  { value: 0.5, label: '0.5% — Orgánicos',             description: 'Productos orgánicos certificados' },
  { value: 0,   label: '0% — Exento/Exportación',      description: 'Exportaciones, servicios públicos, exentos' }
];

/**
 * Tramos de Renta 2026 — Persona Física con Actividad Lucrativa
 * Resolución DGT vigente
 */
export const RENTA_BRACKETS_2026 = {
  year: 2026,
  exento: 6244000,
  brackets: [
    { desde: 0,        hasta: 6244000,   tasa: 0  },
    { desde: 6244000,  hasta: 9324000,   tasa: 10 },
    { desde: 9324000,  hasta: 15540000,  tasa: 15 },
    { desde: 15540000, hasta: 31104000,  tasa: 20 },
    { desde: 31104000, hasta: Infinity,  tasa: 25 }
  ],
  creditos: {
    conyuge: 31080,   // Crédito anual por cónyuge
    hijo:    20520    // Crédito anual por hijo
  },
  deduccionUnica: 0.25, // 25% deducción única para profesionales
  pagos_parciales: {
    meses: [6, 9, 12], // Junio, Septiembre, Diciembre
    porcentaje: 25      // 25% del impuesto del periodo anterior
  }
};

/**
 * Tramos de Renta 2025 (fallback)
 */
export const RENTA_BRACKETS_2025 = {
  year: 2025,
  exento: 5872000,
  brackets: [
    { desde: 0,        hasta: 5872000,   tasa: 0  },
    { desde: 5872000,  hasta: 8772000,   tasa: 10 },
    { desde: 8772000,  hasta: 14616000,  tasa: 15 },
    { desde: 14616000, hasta: 29268000,  tasa: 20 },
    { desde: 29268000, hasta: Infinity,  tasa: 25 }
  ],
  creditos: {
    conyuge: 29220,
    hijo:    19320
  },
  deduccionUnica: 0.25,
  pagos_parciales: {
    meses: [6, 9, 12],
    porcentaje: 25
  }
};

function getBrackets(year) {
  if (year >= 2026) return RENTA_BRACKETS_2026;
  return RENTA_BRACKETS_2025;
}

// ─── IVA MENSUAL (D-150) ───────────────────────────────────

/**
 * Calcula el IVA mensual para declaración D-150
 * @param {Array} ingresos - [{monto_bruto, monto_iva, tarifa_iva, ...}]
 * @param {Array} gastos   - [{monto_bruto, monto_iva, tarifa_iva, deducible, ...}]
 * @param {number} saldoFavorAnterior - Saldo a favor de meses anteriores
 * @returns {Object} Resultado del cálculo IVA
 */
export function calcularIVAMensual(ingresos = [], gastos = [], saldoFavorAnterior = 0) {
  // Desglose de ventas por tarifa
  const ventasPorTarifa = {};
  let totalVentasNeto = 0;
  let debitoFiscal = 0;

  for (const ing of ingresos) {
    if (ing.desgloseIVA && Object.keys(ing.desgloseIVA).length > 0) {
      for (const [t, vals] of Object.entries(ing.desgloseIVA)) {
        const tarifa = Number(t);
        if (!ventasPorTarifa[tarifa]) {
          ventasPorTarifa[tarifa] = { base: 0, iva: 0, total: 0, count: 0 };
        }
        ventasPorTarifa[tarifa].base += vals.base;
        ventasPorTarifa[tarifa].iva += vals.iva;
        ventasPorTarifa[tarifa].total += (vals.base + vals.iva);
        ventasPorTarifa[tarifa].count++; // Counts occurrences of the rate
        totalVentasNeto += vals.base;
        debitoFiscal += vals.iva;
      }
    } else {
      // Fallback para registros viejos sin desglose
      const tarifa = Number(ing.tarifa_iva) || 0;
      const bruto = Number(ing.monto_bruto) || 0;
      const iva = Number(ing.monto_iva) || 0;
      const neto = bruto - iva;

      if (!ventasPorTarifa[tarifa]) {
        ventasPorTarifa[tarifa] = { base: 0, iva: 0, total: 0, count: 0 };
      }
      ventasPorTarifa[tarifa].base += neto;
      ventasPorTarifa[tarifa].iva += iva;
      ventasPorTarifa[tarifa].total += bruto;
      ventasPorTarifa[tarifa].count++;

      totalVentasNeto += neto;
      debitoFiscal += iva;
    }
  }

  // Desglose de compras/gastos deducibles por tarifa
  const comprasPorTarifa = {};
  let totalComprasNeto = 0;
  let creditoFiscal = 0;
  let totalGastosNoDeducibles = 0;

  for (const gasto of gastos) {
    const deducible = gasto.deducible !== false;
    
    if (gasto.desgloseIVA && Object.keys(gasto.desgloseIVA).length > 0) {
      for (const [t, vals] of Object.entries(gasto.desgloseIVA)) {
        const tarifa = Number(t);
        if (!comprasPorTarifa[tarifa]) {
          comprasPorTarifa[tarifa] = { base: 0, iva: 0, total: 0, count: 0 };
        }
        comprasPorTarifa[tarifa].base += vals.base;
        comprasPorTarifa[tarifa].iva += vals.iva;
        comprasPorTarifa[tarifa].total += (vals.base + vals.iva);
        comprasPorTarifa[tarifa].count++;
        
        totalComprasNeto += vals.base;
        
        if (deducible && tarifa > 0) {
          creditoFiscal += vals.iva;
        } else if (!deducible) {
          totalGastosNoDeducibles += (vals.base + vals.iva);
        }
      }
    } else {
      // Fallback
      const tarifa = Number(gasto.tarifa_iva) || 0;
      const bruto = Number(gasto.monto_bruto) || 0;
      const iva = Number(gasto.monto_iva) || 0;
      const neto = bruto - iva;

      if (!comprasPorTarifa[tarifa]) {
        comprasPorTarifa[tarifa] = { base: 0, iva: 0, total: 0, count: 0 };
      }
      comprasPorTarifa[tarifa].base += neto;
      comprasPorTarifa[tarifa].iva += iva;
      comprasPorTarifa[tarifa].total += bruto;
      comprasPorTarifa[tarifa].count++;

      totalComprasNeto += neto;

      if (deducible && tarifa > 0) {
        creditoFiscal += iva;
      } else if (!deducible) {
        totalGastosNoDeducibles += bruto;
      }
    }
  }

  // Proporcionalidad: si hay ventas exentas, el crédito se reduce proporcionalmente
  const ventasGravadas = Object.entries(ventasPorTarifa)
    .filter(([t]) => Number(t) > 0)
    .reduce((sum, [, v]) => sum + v.base, 0);
  const ventasExentas = ventasPorTarifa[0]?.base || 0;
  const totalVentas = ventasGravadas + ventasExentas;

  let factorProporcionalidad = 1;
  if (totalVentas > 0 && ventasExentas > 0) {
    factorProporcionalidad = ventasGravadas / totalVentas;
    creditoFiscal = creditoFiscal * factorProporcionalidad;
  }

  // Aplicar saldo a favor anterior
  const creditoTotal = creditoFiscal + saldoFavorAnterior;
  const diferencia = debitoFiscal - creditoTotal;
  const ivaPagar = Math.max(0, diferencia);
  const saldoFavor = Math.max(0, -diferencia);

  return {
    // Ventas
    totalVentasNeto: round2(totalVentasNeto),
    debitoFiscal: round2(debitoFiscal),
    ventasPorTarifa,

    // Compras
    totalComprasNeto: round2(totalComprasNeto),
    creditoFiscalBruto: round2(creditoFiscal / (factorProporcionalidad || 1)),
    factorProporcionalidad: round4(factorProporcionalidad),
    creditoFiscal: round2(creditoFiscal),
    totalGastosNoDeducibles: round2(totalGastosNoDeducibles),

    // Saldo anterior
    saldoFavorAnterior: round2(saldoFavorAnterior),
    creditoTotal: round2(creditoTotal),

    // Resultado
    ivaPagar: round2(ivaPagar),
    saldoFavor: round2(saldoFavor),

    // Compras desglose
    comprasPorTarifa,

    // Meta
    cantidadIngresos: ingresos.length,
    cantidadGastos: gastos.length
  };
}


// ─── RENTA ANUAL (D-101) ───────────────────────────────────

/**
 * Calcula el Impuesto sobre la Renta anual (D-101)
 * @param {Object} params
 * @param {number} params.year - Año fiscal
 * @param {number} params.ingresosBrutos - Total de ingresos brutos anuales
 * @param {number} params.gastosDeducibles - Total de gastos deducibles anuales
 * @param {boolean} params.usarDeduccionUnica - Usar 25% deducción única
 * @param {number} params.hijos - Cantidad de hijos
 * @param {boolean} params.tieneConyuge - Tiene cónyuge
 * @param {number} params.pagosParcialesRealizados - Suma de pagos parciales ya realizados
 * @param {number} params.retencionesAplicadas - Retenciones de renta aplicadas
 * @returns {Object} Resultado del cálculo de renta
 */
export function calcularRentaAnual({
  year = 2026,
  ingresosBrutos = 0,
  gastosDeducibles = 0,
  usarDeduccionUnica = false,
  hijos = 0,
  tieneConyuge = false,
  pagosParcialesRealizados = 0,
  retencionesAplicadas = 0
} = {}) {
  const config = getBrackets(year);

  // Gastos: deducción real vs deducción única 25%
  let deduccion = gastosDeducibles;
  let deduccionUnicaMonto = 0;
  if (usarDeduccionUnica) {
    deduccionUnicaMonto = ingresosBrutos * config.deduccionUnica;
    deduccion = deduccionUnicaMonto;
  }

  // Renta neta
  const rentaNeta = Math.max(0, ingresosBrutos - deduccion);

  // Cálculo por tramos
  let impuestoBruto = 0;
  const desgloseTrmos = [];
  let restante = rentaNeta;

  for (const tramo of config.brackets) {
    if (restante <= 0) break;
    const rangoTramo = tramo.hasta === Infinity ? restante : (tramo.hasta - tramo.desde);
    const baseGravable = Math.min(restante, rangoTramo);

    if (baseGravable > 0 && tramo.tasa > 0) {
      const impuestoTramo = baseGravable * (tramo.tasa / 100);
      impuestoBruto += impuestoTramo;
      desgloseTrmos.push({
        desde: tramo.desde,
        hasta: tramo.hasta === Infinity ? tramo.desde + baseGravable : tramo.hasta,
        tasa: tramo.tasa,
        baseGravable: round2(baseGravable),
        impuesto: round2(impuestoTramo)
      });
    } else if (baseGravable > 0) {
      desgloseTrmos.push({
        desde: tramo.desde,
        hasta: tramo.hasta,
        tasa: 0,
        baseGravable: round2(baseGravable),
        impuesto: 0
      });
    }
    restante -= baseGravable;
  }

  // Créditos fiscales
  const creditoConyuge = tieneConyuge ? config.creditos.conyuge : 0;
  const creditoHijos = hijos * config.creditos.hijo;
  const totalCreditos = creditoConyuge + creditoHijos;

  // Impuesto neto
  const impuestoConCreditos = Math.max(0, impuestoBruto - totalCreditos);
  const impuestoNeto = Math.max(0, impuestoConCreditos - pagosParcialesRealizados - retencionesAplicadas);

  // Tasa efectiva
  const tasaEfectiva = ingresosBrutos > 0 ? (impuestoNeto / ingresosBrutos) * 100 : 0;

  return {
    year,
    ingresosBrutos: round2(ingresosBrutos),
    gastosDeducibles: round2(gastosDeducibles),
    usarDeduccionUnica,
    deduccionUnicaMonto: round2(deduccionUnicaMonto),
    deduccionAplicada: round2(deduccion),
    rentaNeta: round2(rentaNeta),
    impuestoBruto: round2(impuestoBruto),
    creditoConyuge: round2(creditoConyuge),
    creditoHijos: round2(creditoHijos),
    totalCreditos: round2(totalCreditos),
    impuestoConCreditos: round2(impuestoConCreditos),
    pagosParcialesRealizados: round2(pagosParcialesRealizados),
    retencionesAplicadas: round2(retencionesAplicadas),
    impuestoNeto: round2(impuestoNeto),
    tasaEfectiva: round2(tasaEfectiva),
    desgloseTrmos,
    config: {
      exento: config.exento,
      creditoConyuge: config.creditos.conyuge,
      creditoHijo: config.creditos.hijo,
      deduccionUnicaPct: config.deduccionUnica * 100
    }
  };
}


// ─── PAGOS PARCIALES ───────────────────────────────────────

/**
 * Calcula los pagos parciales de renta
 * @param {number} impuestoAnterior - Impuesto del período anterior
 * @param {number} year - Año en curso
 * @returns {Object} Desglose de pagos parciales
 */
export function calcularPagosParciales(impuestoAnterior = 0, year = 2026) {
  const config = getBrackets(year);
  const montoPorPago = impuestoAnterior * (config.pagos_parciales.porcentaje / 100);

  return {
    impuestoAnterior: round2(impuestoAnterior),
    montoPorPago: round2(montoPorPago),
    pagos: config.pagos_parciales.meses.map(mes => ({
      mes,
      mesNombre: MESES[mes - 1],
      fecha_limite: `15/${mes.toString().padStart(2, '0')}/${year}`,
      monto: round2(montoPorPago)
    })),
    totalPagos: round2(montoPorPago * config.pagos_parciales.meses.length)
  };
}


// ─── BALANCE GENERAL ───────────────────────────────────────

/**
 * Genera un Balance General simplificado
 * @param {Object} params
 * @returns {Object} Balance General
 */
export function generarBalanceGeneral({
  ingresos = [],
  gastos = [],
  creditosFiscales = [],
  periodo = '',
  saldoBancario = 0,
  cuentasPorCobrar = 0,
  cuentasPorPagar = 0,
  activosFijos = 0,
  depreciacionAcumulada = 0
} = {}) {
  const totalIngresos = ingresos.reduce((s, i) => s + Number(i.monto_bruto || 0), 0);
  const totalGastos = gastos.reduce((s, g) => s + Number(g.monto_bruto || 0), 0);
  const utilidadNeta = totalIngresos - totalGastos;

  const totalCreditosFiscales = creditosFiscales
    .filter(c => c.estado === 'disponible')
    .reduce((s, c) => s + Number(c.monto_disponible || 0), 0);

  // Activos
  const activoCorriente = saldoBancario + cuentasPorCobrar + totalCreditosFiscales;
  const activoNoCorriente = activosFijos - depreciacionAcumulada;
  const totalActivos = activoCorriente + activoNoCorriente;

  // Pasivos
  const pasivoCorriente = cuentasPorPagar;
  const totalPasivos = pasivoCorriente;

  // Patrimonio
  const capital = totalActivos - totalPasivos;

  return {
    periodo,
    activos: {
      corriente: {
        efectivo: round2(saldoBancario),
        cuentasPorCobrar: round2(cuentasPorCobrar),
        creditosFiscales: round2(totalCreditosFiscales),
        total: round2(activoCorriente)
      },
      noCorriente: {
        activosFijos: round2(activosFijos),
        depreciacionAcumulada: round2(depreciacionAcumulada),
        total: round2(activoNoCorriente)
      },
      total: round2(totalActivos)
    },
    pasivos: {
      corriente: {
        cuentasPorPagar: round2(cuentasPorPagar),
        total: round2(pasivoCorriente)
      },
      total: round2(totalPasivos)
    },
    patrimonio: {
      capital: round2(capital),
      utilidadNeta: round2(utilidadNeta),
      total: round2(capital)
    },
    cuadra: Math.abs(totalActivos - (totalPasivos + capital)) < 0.01
  };
}


// ─── ESTADO DE RESULTADOS ──────────────────────────────────

/**
 * Genera un Estado de Resultados (Pérdidas y Ganancias)
 * @param {Array} ingresos
 * @param {Array} gastos
 * @param {string} periodo
 * @returns {Object} Estado de Resultados
 */
export function generarEstadoResultados(ingresos = [], gastos = [], periodo = '') {
  // Agrupar ingresos por categoría
  const ingresosPorCategoria = {};
  let totalIngresosNeto = 0;
  let totalIVACobrado = 0;

  for (const ing of ingresos) {
    const cat = ing.categoria_nombre || 'Sin categoría';
    if (!ingresosPorCategoria[cat]) ingresosPorCategoria[cat] = 0;
    const neto = Number(ing.monto_bruto || 0) - Number(ing.monto_iva || 0);
    ingresosPorCategoria[cat] += neto;
    totalIngresosNeto += neto;
    totalIVACobrado += Number(ing.monto_iva || 0);
  }

  // Agrupar gastos por categoría
  const gastosPorCategoria = {};
  let totalGastosNeto = 0;
  let totalIVAPagado = 0;
  let totalGastosDeducibles = 0;
  let totalGastosNoDeducibles = 0;

  for (const g of gastos) {
    const cat = g.categoria_nombre || 'Sin categoría';
    if (!gastosPorCategoria[cat]) gastosPorCategoria[cat] = 0;
    const neto = Number(g.monto_bruto || 0) - Number(g.monto_iva || 0);
    gastosPorCategoria[cat] += neto;
    totalGastosNeto += neto;
    totalIVAPagado += Number(g.monto_iva || 0);

    if (g.deducible !== false) {
      totalGastosDeducibles += neto;
    } else {
      totalGastosNoDeducibles += neto;
    }
  }

  const utilidadBruta = totalIngresosNeto - totalGastosNeto;
  const margenBruto = totalIngresosNeto > 0 ? (utilidadBruta / totalIngresosNeto) * 100 : 0;

  return {
    periodo,
    ingresos: {
      porCategoria: ingresosPorCategoria,
      totalNeto: round2(totalIngresosNeto),
      totalIVA: round2(totalIVACobrado),
      totalBruto: round2(totalIngresosNeto + totalIVACobrado)
    },
    gastos: {
      porCategoria: gastosPorCategoria,
      totalNeto: round2(totalGastosNeto),
      totalIVA: round2(totalIVAPagado),
      totalBruto: round2(totalGastosNeto + totalIVAPagado),
      deducibles: round2(totalGastosDeducibles),
      noDeducibles: round2(totalGastosNoDeducibles)
    },
    utilidadBruta: round2(utilidadBruta),
    margenBruto: round2(margenBruto),
    utilidadNeta: round2(utilidadBruta), // Simplificado (no hay impuestos descontados aún)
    cantidadIngresos: ingresos.length,
    cantidadGastos: gastos.length
  };
}


// ─── HELPERS ───────────────────────────────────────────────

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

export function mesActual() {
  const d = new Date();
  return { mes: d.getMonth() + 1, anio: d.getFullYear() };
}

export function formatColones(amount) {
  return '₡' + Number(amount || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
function round4(n) { return Math.round((n + Number.EPSILON) * 10000) / 10000; }

/**
 * Determina si un gasto es deducible según las reglas de Hacienda CR
 * @param {Object} gasto
 * @returns {Object} {deducible, razon}
 */
export function evaluarDeducibilidad(gasto) {
  // Gastos personales nunca son deducibles
  if (gasto.categoria_nombre?.toLowerCase().includes('personal')) {
    return { deducible: false, razon: 'Gastos personales no son deducibles (Art. 9 Ley 7092)' };
  }

  // Gastos sin comprobante electrónico
  if (!gasto.xml_clave && gasto.fuente === 'manual') {
    return {
      deducible: true,
      razon: 'Deducible, pero se recomienda tener comprobante electrónico para respaldo ante Hacienda',
      advertencia: true
    };
  }

  // Gastos bancarios (comisiones) no generan crédito IVA pero sí son deducibles para renta
  if (gasto.categoria_nombre?.toLowerCase().includes('bancari')) {
    return {
      deducible: true,
      razon: 'Deducible para Renta, pero sin crédito fiscal IVA (exento)',
      sinCreditoIVA: true
    };
  }

  return { deducible: true, razon: 'Gasto vinculado a la actividad económica — deducible' };
}

/**
 * Calcula automáticamente los montos de IVA según tarifa
 */
export function calcularMontos(montoIngresado, tarifaIVA, esMontoConIVA = true) {
  const tarifa = Number(tarifaIVA) / 100;
  let bruto, neto, iva;

  if (esMontoConIVA) {
    bruto = Number(montoIngresado);
    neto = bruto / (1 + tarifa);
    iva = bruto - neto;
  } else {
    neto = Number(montoIngresado);
    iva = neto * tarifa;
    bruto = neto + iva;
  }

  return {
    monto_bruto: round2(bruto),
    monto_neto: round2(neto),
    monto_iva: round2(iva)
  };
}
