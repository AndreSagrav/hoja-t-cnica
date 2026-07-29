// ============================================================
// INNOVIO Tax Module — Document Generator (PDF + Excel)
// Uses jsPDF + SheetJS (xlsx) from CDN
// ============================================================

import { formatColones, MESES } from './tax-engine.js';

// ─── CDN LOADING ───────────────────────────────────────────

async function loadJsPDF() {
  if (window.jspdf) return window.jspdf;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.4/jspdf.plugin.autotable.min.js');
  return window.jspdf;
}

async function loadXLSX() {
  if (window.XLSX) return window.XLSX;
  await loadScript('https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js');
  return window.XLSX;
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load: ' + src));
    document.head.appendChild(s);
  });
}

// ─── COLORS (matching Innovio brand) ───────────────────────

const COLORS = {
  navy: [13, 50, 112],
  navyDeep: [7, 31, 80],
  blue: [26, 79, 160],
  accent: [0, 194, 168],
  green: [27, 94, 32],
  red: [192, 57, 43],
  gold: [240, 180, 41],
  textDark: [15, 23, 42],
  textMid: [71, 85, 105],
  textSoft: [148, 163, 184],
  white: [255, 255, 255],
  bgLight: [244, 246, 251],
  border: [226, 230, 240]
};

// ─── PDF GENERATORS ────────────────────────────────────────

/**
 * Generate IVA Monthly Report PDF
 */
export async function generarPDFIVA(calculo, periodo, ingresos, gastos) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  const mes = MESES[periodo.mes - 1];
  const title = `Reporte IVA — ${mes} ${periodo.anio}`;

  addHeader(doc, title);

  let y = 58;

  // KPIs summary
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.navy);
  doc.text('Resumen del Período', 14, y);
  y += 8;

  const summaryData = [
    ['Total Ingresos (sin IVA)', fmt(calculo.totalVentasNeto)],
    ['Débito Fiscal (IVA cobrado)', fmt(calculo.debitoFiscal)],
    ['Total Gastos Deducibles (sin IVA)', fmt(calculo.totalComprasNeto)],
    ['Crédito Fiscal (IVA pagado)', fmt(calculo.creditoFiscal)],
    ['Saldo a favor anterior', fmt(calculo.saldoFavorAnterior)],
    ['', ''],
    ['IVA A PAGAR', fmt(calculo.ivaPagar)],
    ['Saldo a favor (si aplica)', fmt(calculo.saldoFavor)]
  ];

  doc.autoTable({
    startY: y,
    head: [['Concepto', 'Monto (₡)']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold', fontSize: 10 },
    styles: { fontSize: 10, cellPadding: 5, lineColor: COLORS.border, lineWidth: 0.3 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.row.index === 6) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 245, 233];
      }
    }
  });

  y = doc.lastAutoTable.finalY + 12;

  // Desglose por tarifa
  if (Object.keys(calculo.ventasPorTarifa).length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text('Desglose de Ventas por Tarifa IVA', 14, y);
    y += 6;

    const tarifaData = Object.entries(calculo.ventasPorTarifa).map(([tarifa, vals]) => [
      `${tarifa}%`, String(vals.count), fmt(vals.base), fmt(vals.iva), fmt(vals.total)
    ]);

    doc.autoTable({
      startY: y,
      head: [['Tarifa', 'Cant.', 'Base', 'IVA', 'Total']],
      body: tarifaData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.blue, textColor: COLORS.white },
      styles: { fontSize: 9 },
      columnStyles: { 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });

    y = doc.lastAutoTable.finalY + 12;
  }

  // Ingresos detail
  if (ingresos.length > 0 && y < 240) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text('Detalle de Ingresos', 14, y);
    y += 6;

    const ingData = ingresos.map(i => [
      formatDate(i.fecha), i.descripcion?.slice(0, 30) || '', i.cliente || '',
      `${i.tarifa_iva}%`, fmt(i.monto_iva), fmt(i.monto_bruto)
    ]);

    doc.autoTable({
      startY: y,
      head: [['Fecha', 'Descripción', 'Cliente', 'IVA%', 'IVA', 'Total']],
      body: ingData,
      theme: 'striped',
      headStyles: { fillColor: COLORS.green, textColor: COLORS.white },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } }
    });
  }

  addFooter(doc, periodo);
  doc.save(`IVA_${mes}_${periodo.anio}.pdf`);
}


/**
 * Generate Renta Annual Report PDF
 */
export async function generarPDFRenta(calculo) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  const title = `Impuesto sobre la Renta — Año ${calculo.year}`;

  addHeader(doc, title);

  let y = 58;

  // Income & deductions
  const summaryData = [
    ['Ingresos Brutos Anuales', fmt(calculo.ingresosBrutos)],
    [calculo.usarDeduccionUnica ? 'Deducción Única (25%)' : 'Gastos Deducibles', fmt(calculo.deduccionAplicada)],
    ['Renta Neta Gravable', fmt(calculo.rentaNeta)],
    ['', ''],
    ['Impuesto Bruto (por tramos)', fmt(calculo.impuestoBruto)],
    ['(-) Crédito por cónyuge', fmt(calculo.creditoConyuge)],
    ['(-) Crédito por hijos', fmt(calculo.creditoHijos)],
    ['(-) Pagos parciales realizados', fmt(calculo.pagosParcialesRealizados)],
    ['(-) Retenciones aplicadas', fmt(calculo.retencionesAplicadas)],
    ['', ''],
    ['IMPUESTO NETO A PAGAR', fmt(calculo.impuestoNeto)],
    ['Tasa efectiva', `${calculo.tasaEfectiva.toFixed(2)}%`]
  ];

  doc.autoTable({
    startY: y,
    head: [['Concepto', 'Monto (₡)']],
    body: summaryData,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 4 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      if (data.row.index === 10) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = [232, 245, 233];
      }
    }
  });

  y = doc.lastAutoTable.finalY + 12;

  // Tax brackets breakdown
  if (calculo.desgloseTrmos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text('Desglose por Tramos de Renta', 14, y);
    y += 6;

    const tramoData = calculo.desgloseTrmos.map(t => [
      `${t.tasa}%`,
      fmt(t.desde),
      t.hasta === Infinity ? 'En adelante' : fmt(t.hasta),
      fmt(t.baseGravable),
      fmt(t.impuesto)
    ]);

    doc.autoTable({
      startY: y,
      head: [['Tasa', 'Desde', 'Hasta', 'Base Gravable', 'Impuesto']],
      body: tramoData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.blue, textColor: COLORS.white },
      styles: { fontSize: 9 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
    });
  }

  addFooter(doc, { anio: calculo.year });
  doc.save(`Renta_${calculo.year}.pdf`);
}


/**
 * Generate Balance General PDF
 */
export async function generarPDFBalance(balance) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  addHeader(doc, `Balance General — ${balance.periodo}`);

  let y = 55;

  // Activos
  const activoData = [
    ['ACTIVO CORRIENTE', '', ''],
    ['  Efectivo y equivalentes', '', fmt(balance.activos.corriente.efectivo)],
    ['  Cuentas por cobrar', '', fmt(balance.activos.corriente.cuentasPorCobrar)],
    ['  Créditos fiscales', '', fmt(balance.activos.corriente.creditosFiscales)],
    ['  Total Activo Corriente', '', fmt(balance.activos.corriente.total)],
    ['', '', ''],
    ['ACTIVO NO CORRIENTE', '', ''],
    ['  Activos fijos', '', fmt(balance.activos.noCorriente.activosFijos)],
    ['  (-) Depreciación acumulada', '', fmt(balance.activos.noCorriente.depreciacionAcumulada)],
    ['  Total Activo No Corriente', '', fmt(balance.activos.noCorriente.total)],
    ['', '', ''],
    ['TOTAL ACTIVOS', '', fmt(balance.activos.total)],
    ['', '', ''],
    ['PASIVOS', '', ''],
    ['  Cuentas por pagar', '', fmt(balance.pasivos.corriente.cuentasPorPagar)],
    ['  Total Pasivos', '', fmt(balance.pasivos.total)],
    ['', '', ''],
    ['PATRIMONIO', '', ''],
    ['  Capital', '', fmt(balance.patrimonio.capital)],
    ['  Utilidad neta del período', '', fmt(balance.patrimonio.utilidadNeta)],
    ['', '', ''],
    ['TOTAL PASIVO + PATRIMONIO', '', fmt(balance.pasivos.total + balance.patrimonio.capital)]
  ];

  doc.autoTable({
    startY: y,
    head: [['Cuenta', '', 'Monto (₡)']],
    body: activoData,
    theme: 'plain',
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 2: { halign: 'right' } },
    didParseCell: (data) => {
      const text = data.cell.raw || '';
      if (text === text.toUpperCase() && text.length > 2) {
        data.cell.styles.fontStyle = 'bold';
      }
      if (text.includes('TOTAL')) {
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fillColor = COLORS.bgLight;
      }
    }
  });

  addFooter(doc, {});
  doc.save(`Balance_General_${balance.periodo.replace(/\s/g, '_')}.pdf`);
}


/**
 * Generate Estado de Resultados PDF
 */
export async function generarPDFEstadoResultados(estado) {
  const { jsPDF } = await loadJsPDF();
  const doc = new jsPDF();
  addHeader(doc, `Estado de Resultados — ${estado.periodo}`);

  let y = 55;

  const rows = [
    ['INGRESOS', '', ''],
  ];

  for (const [cat, monto] of Object.entries(estado.ingresos.porCategoria)) {
    rows.push(['  ' + cat, '', fmt(monto)]);
  }
  rows.push(['  Total Ingresos Netos', '', fmt(estado.ingresos.totalNeto)]);
  rows.push(['', '', '']);
  rows.push(['GASTOS OPERATIVOS', '', '']);

  for (const [cat, monto] of Object.entries(estado.gastos.porCategoria)) {
    rows.push(['  ' + cat, '', fmt(monto)]);
  }
  rows.push(['  Total Gastos', '', fmt(estado.gastos.totalNeto)]);
  rows.push(['    De los cuales, deducibles:', '', fmt(estado.gastos.deducibles)]);
  rows.push(['    De los cuales, no deducibles:', '', fmt(estado.gastos.noDeducibles)]);
  rows.push(['', '', '']);
  rows.push(['UTILIDAD BRUTA', '', fmt(estado.utilidadBruta)]);
  rows.push(['Margen bruto', '', `${estado.margenBruto.toFixed(1)}%`]);

  doc.autoTable({
    startY: y,
    head: [['Concepto', '', 'Monto (₡)']],
    body: rows,
    theme: 'plain',
    headStyles: { fillColor: COLORS.navy, textColor: COLORS.white, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 2: { halign: 'right' } },
    didParseCell: (data) => {
      const text = data.cell.raw || '';
      if (text === text.toUpperCase() && text.length > 2) {
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  addFooter(doc, {});
  doc.save(`Estado_Resultados_${estado.periodo.replace(/\s/g, '_')}.pdf`);
}


// ─── EXCEL GENERATORS ──────────────────────────────────────

/**
 * Generate IVA Monthly Report Excel
 */
export async function generarExcelIVA(calculo, periodo, ingresos, gastos) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();
  const mes = MESES[periodo.mes - 1];

  // Summary sheet
  const summaryRows = [
    [`Reporte IVA — ${mes} ${periodo.anio}`],
    [],
    ['Concepto', 'Monto (₡)'],
    ['Total Ingresos (sin IVA)', calculo.totalVentasNeto],
    ['Débito Fiscal (IVA cobrado)', calculo.debitoFiscal],
    ['Total Gastos Deducibles (sin IVA)', calculo.totalComprasNeto],
    ['Crédito Fiscal (IVA pagado)', calculo.creditoFiscal],
    ['Saldo a favor anterior', calculo.saldoFavorAnterior],
    [],
    ['IVA A PAGAR', calculo.ivaPagar],
    ['Saldo a favor', calculo.saldoFavor]
  ];

  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  // Ingresos sheet
  if (ingresos.length > 0) {
    const ingRows = [['Fecha', 'Descripción', 'Cliente', 'Monto Neto', 'IVA%', 'IVA', 'Total']];
    for (const i of ingresos) {
      ingRows.push([
        formatDate(i.fecha), i.descripcion, i.cliente,
        Number(i.monto_neto), Number(i.tarifa_iva), Number(i.monto_iva), Number(i.monto_bruto)
      ]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(ingRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Ingresos');
  }

  // Gastos sheet
  if (gastos.length > 0) {
    const gastRows = [['Fecha', 'Descripción', 'Proveedor', 'Monto Neto', 'IVA%', 'IVA', 'Total', 'Deducible']];
    for (const g of gastos) {
      gastRows.push([
        formatDate(g.fecha), g.descripcion, g.proveedor,
        Number(g.monto_neto), Number(g.tarifa_iva), Number(g.monto_iva), Number(g.monto_bruto),
        g.deducible ? 'Sí' : 'No'
      ]);
    }
    const ws3 = XLSX.utils.aoa_to_sheet(gastRows);
    XLSX.utils.book_append_sheet(wb, ws3, 'Gastos');
  }

  XLSX.writeFile(wb, `IVA_${mes}_${periodo.anio}.xlsx`);
}


/**
 * Generate Renta Annual Report Excel
 */
export async function generarExcelRenta(calculo) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    [`Impuesto sobre la Renta — Año ${calculo.year}`],
    [],
    ['Concepto', 'Monto (₡)'],
    ['Ingresos Brutos Anuales', calculo.ingresosBrutos],
    [calculo.usarDeduccionUnica ? 'Deducción Única (25%)' : 'Gastos Deducibles', calculo.deduccionAplicada],
    ['Renta Neta Gravable', calculo.rentaNeta],
    [],
    ['Impuesto Bruto', calculo.impuestoBruto],
    ['(-) Crédito por cónyuge', calculo.creditoConyuge],
    ['(-) Crédito por hijos', calculo.creditoHijos],
    ['(-) Pagos parciales', calculo.pagosParcialesRealizados],
    ['(-) Retenciones', calculo.retencionesAplicadas],
    [],
    ['IMPUESTO NETO A PAGAR', calculo.impuestoNeto],
    ['Tasa efectiva', `${calculo.tasaEfectiva.toFixed(2)}%`]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Renta');

  // Tramos
  if (calculo.desgloseTrmos.length > 0) {
    const tramoRows = [['Tasa', 'Desde', 'Hasta', 'Base Gravable', 'Impuesto']];
    for (const t of calculo.desgloseTrmos) {
      tramoRows.push([`${t.tasa}%`, t.desde, t.hasta === Infinity ? 'En adelante' : t.hasta, t.baseGravable, t.impuesto]);
    }
    const ws2 = XLSX.utils.aoa_to_sheet(tramoRows);
    XLSX.utils.book_append_sheet(wb, ws2, 'Tramos');
  }

  XLSX.writeFile(wb, `Renta_${calculo.year}.xlsx`);
}


/**
 * Generate Balance General Excel
 */
export async function generarExcelBalance(balance) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    [`Balance General — ${balance.periodo}`],
    [],
    ['ACTIVOS', ''],
    ['Activo Corriente', ''],
    ['  Efectivo y equivalentes', balance.activos.corriente.efectivo],
    ['  Cuentas por cobrar', balance.activos.corriente.cuentasPorCobrar],
    ['  Créditos fiscales', balance.activos.corriente.creditosFiscales],
    ['  Total Activo Corriente', balance.activos.corriente.total],
    [],
    ['Activo No Corriente', ''],
    ['  Activos fijos', balance.activos.noCorriente.activosFijos],
    ['  (-) Depreciación', balance.activos.noCorriente.depreciacionAcumulada],
    ['  Total Activo No Corriente', balance.activos.noCorriente.total],
    [],
    ['TOTAL ACTIVOS', balance.activos.total],
    [],
    ['PASIVOS', ''],
    ['  Cuentas por pagar', balance.pasivos.corriente.cuentasPorPagar],
    ['  Total Pasivos', balance.pasivos.total],
    [],
    ['PATRIMONIO', ''],
    ['  Capital', balance.patrimonio.capital],
    ['  Utilidad neta', balance.patrimonio.utilidadNeta],
    [],
    ['TOTAL PASIVO + PATRIMONIO', balance.pasivos.total + balance.patrimonio.capital]
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Balance');
  XLSX.writeFile(wb, `Balance_General_${balance.periodo.replace(/\s/g, '_')}.xlsx`);
}


/**
 * Generate Estado de Resultados Excel
 */
export async function generarExcelEstadoResultados(estado) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  const rows = [
    [`Estado de Resultados — ${estado.periodo}`],
    [],
    ['INGRESOS', ''],
  ];

  for (const [cat, monto] of Object.entries(estado.ingresos.porCategoria)) {
    rows.push(['  ' + cat, monto]);
  }
  rows.push(['Total Ingresos Netos', estado.ingresos.totalNeto]);
  rows.push([]);
  rows.push(['GASTOS', '']);
  for (const [cat, monto] of Object.entries(estado.gastos.porCategoria)) {
    rows.push(['  ' + cat, monto]);
  }
  rows.push(['Total Gastos', estado.gastos.totalNeto]);
  rows.push(['  Deducibles', estado.gastos.deducibles]);
  rows.push(['  No deducibles', estado.gastos.noDeducibles]);
  rows.push([]);
  rows.push(['UTILIDAD BRUTA', estado.utilidadBruta]);
  rows.push(['Margen bruto', `${estado.margenBruto.toFixed(1)}%`]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
  XLSX.writeFile(wb, `Estado_Resultados_${estado.periodo.replace(/\s/g, '_')}.xlsx`);
}


/**
 * Generate Libro de Ingresos y Egresos Excel
 */
export async function generarExcelLibro(ingresos, gastos, periodo) {
  const XLSX = await loadXLSX();
  const wb = XLSX.utils.book_new();

  // All movements combined, sorted by date
  const movimientos = [
    ...ingresos.map(i => ({ ...i, tipo: 'Ingreso' })),
    ...gastos.map(g => ({ ...g, tipo: 'Gasto' }))
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

  const rows = [
    [`Libro de Ingresos y Egresos — ${periodo}`],
    [],
    ['Fecha', 'Tipo', 'Descripción', 'Detalle', 'Monto Neto', 'IVA', 'Total', 'Deducible']
  ];

  let sumIngresos = 0, sumGastos = 0;
  for (const m of movimientos) {
    const bruto = Number(m.monto_bruto || 0);
    rows.push([
      formatDate(m.fecha), m.tipo, m.descripcion,
      m.cliente || m.proveedor || '',
      Number(m.monto_neto || 0), Number(m.monto_iva || 0), bruto,
      m.tipo === 'Gasto' ? (m.deducible !== false ? 'Sí' : 'No') : 'N/A'
    ]);
    if (m.tipo === 'Ingreso') sumIngresos += bruto;
    else sumGastos += bruto;
  }

  rows.push([]);
  rows.push(['', '', '', 'Total Ingresos:', sumIngresos, '', '', '']);
  rows.push(['', '', '', 'Total Gastos:', sumGastos, '', '', '']);
  rows.push(['', '', '', 'Utilidad:', sumIngresos - sumGastos, '', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'Libro');
  XLSX.writeFile(wb, `Libro_Ingresos_Egresos_${periodo.replace(/\s/g, '_')}.xlsx`);
}


// ─── HELPERS ───────────────────────────────────────────────

function addHeader(doc, title) {
  // Deep navy gradient header (simulated with two-tone fill)
  doc.setFillColor(7, 31, 80);  // navy-deep
  doc.rect(0, 0, 210, 42, 'F');
  
  // Lighter navy overlay for gradient effect
  doc.setFillColor(13, 50, 112);  // navy
  doc.rect(105, 0, 105, 42, 'F');

  // Accent stripe
  doc.setFillColor(...COLORS.accent);
  doc.rect(0, 42, 210, 2.5, 'F');

  // Brand mark: small accent bar on top-left
  doc.setFillColor(...COLORS.accent);
  doc.rect(14, 10, 3, 18, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLORS.white);
  doc.text(title, 22, 20);

  // Subtitle line 1
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 230);  // softer white
  doc.text('INNOVIO — Sistema de Gesti\u00f3n Tributaria', 22, 28);
  
  // Subtitle line 2 - right aligned
  doc.setFontSize(8);
  doc.text(`C\u00e9dula: 205390118  |  Generado: ${new Date().toLocaleDateString('es-CR', { day: '2-digit', month: 'long', year: 'numeric' })}`, 22, 35);
  
  // Right side: INNOVIO text brand
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('INNOVIO', 196, 15, { align: 'right' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(200, 210, 230);
  doc.text('v2.0', 196, 20, { align: 'right' });
}

function addFooter(doc, periodo) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    
    // Separator line
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(14, 285, 196, 285);
    
    // Left side: disclaimer
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textSoft);
    doc.text(
      'Este documento es informativo y no sustituye la declaraci\u00f3n oficial ante Hacienda (TRIBU-CR)',
      14, 289
    );
    
    // Center: generated by
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.textMid);
    doc.text('Generado por INNOVIO', 105, 293, { align: 'center' });
    
    // Right side: page number
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.navy);
    doc.text(`${i} / ${pageCount}`, 196, 289, { align: 'right' });
    
    // Bottom accent stripe
    doc.setFillColor(...COLORS.accent);
    doc.rect(0, 295, 210, 1.5, 'F');
  }
}

function fmt(n) {
  return '₡' + Number(n || 0).toLocaleString('es-CR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('es-CR');
}
