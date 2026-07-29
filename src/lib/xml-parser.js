// ============================================================
// INNOVIO Tax Module — XML Parser for Costa Rica e-invoices
// Parses Hacienda CR electronic voucher XML format
// ============================================================

/**
 * Parse a Costa Rica electronic invoice XML string
 * Supports: FE (Factura Electrónica), NC (Nota Crédito),
 *           ND (Nota Débito), TE (Tiquete Electrónico),
 *           CCE (Confirmación Comprobante)
 *
 * @param {string} xmlString - Raw XML content
 * @returns {Object} Parsed invoice data
 */
export function parseComprobanteXML(xmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // Check for parse errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      throw new Error('XML inválido: ' + parseError.textContent.slice(0, 200));
    }

    // Detect document type from root element
    const root = doc.documentElement;
    const rootName = root.localName || root.nodeName;
    const tipoDocumento = detectTipoDocumento(rootName);

    // Helper to get text from element (namespace-agnostic)
    const getText = (parent, tagName) => {
      // Try direct child first
      const el = parent.getElementsByTagNameNS('*', tagName)[0]
              || parent.getElementsByTagName(tagName)[0];
      return el?.textContent?.trim() || '';
    };

    const getNum = (parent, tagName) => {
      const val = getText(parent, tagName);
      return val ? Number(val) : 0;
    };

    // ─── Clave numérica ───
    const clave = getText(root, 'Clave') || getText(root, 'NumeroConsecutivo') || '';

    // ─── Fecha ───
    const fechaStr = getText(root, 'FechaEmision');
    const fecha = fechaStr ? new Date(fechaStr) : null;

    // ─── Emisor ───
    const emisorEl = root.getElementsByTagNameNS('*', 'Emisor')[0];
    const emisor = emisorEl ? {
      nombre: getText(emisorEl, 'Nombre'),
      cedula: getText(emisorEl, 'Numero'),
      tipoCedula: getText(emisorEl, 'Tipo'),
      correo: getText(emisorEl, 'CorreoElectronico'),
      telefono: getText(emisorEl, 'NumTelefono'),
    } : { nombre: '', cedula: '', tipoCedula: '', correo: '', telefono: '' };

    // ─── Receptor ───
    const receptorEl = root.getElementsByTagNameNS('*', 'Receptor')[0];
    const receptor = receptorEl ? {
      nombre: getText(receptorEl, 'Nombre'),
      cedula: getText(receptorEl, 'Numero'),
      tipoCedula: getText(receptorEl, 'Tipo'),
      correo: getText(receptorEl, 'CorreoElectronico'),
    } : { nombre: '', cedula: '', tipoCedula: '', correo: '' };

    // ─── Líneas de detalle ───
    const lineas = [];
    const detalleEl = root.getElementsByTagNameNS('*', 'DetalleServicio')[0];
    if (detalleEl) {
      const lineaEls = detalleEl.getElementsByTagNameNS('*', 'LineaDetalle');
      for (const lineaEl of lineaEls) {
        const impuestoEls = lineaEl.getElementsByTagNameNS('*', 'Impuesto');
        const impuestos = [];
        let totalImpuestoLinea = 0;

        for (const impEl of impuestoEls) {
          const codigo = getText(impEl, 'Codigo');
          const codigoTarifa = getText(impEl, 'CodigoTarifa');
          const tarifa = getNum(impEl, 'Tarifa');
          const monto = getNum(impEl, 'Monto');
          impuestos.push({ codigo, codigoTarifa, tarifa, monto });
          totalImpuestoLinea += monto;
        }

        lineas.push({
          numero: getNum(lineaEl, 'NumeroLinea'),
          codigo: getText(lineaEl, 'Codigo'),
          codigoCabys: getText(lineaEl, 'CodigoCabys') || getText(lineaEl, 'Codigo'),
          cantidad: getNum(lineaEl, 'Cantidad'),
          unidad: getText(lineaEl, 'UnidadMedida'),
          detalle: getText(lineaEl, 'Detalle'),
          precioUnitario: getNum(lineaEl, 'PrecioUnitario'),
          montoTotal: getNum(lineaEl, 'MontoTotal'),
          descuento: getNum(lineaEl, 'MontoDescuento'),
          subtotal: getNum(lineaEl, 'SubTotal'),
          impuestos,
          totalImpuesto: totalImpuestoLinea,
          montoTotalLinea: getNum(lineaEl, 'MontoTotalLinea')
        });
      }
    }

    // ─── Resumen de impuestos ───
    const resumenEl = root.getElementsByTagNameNS('*', 'ResumenFactura')[0];
    const moneda = resumenEl ? getText(resumenEl, 'CodigoTipoMoneda')
                            || getText(resumenEl, 'CodigoMoneda') || 'CRC' : 'CRC';
    const tipoCambio = resumenEl ? getNum(resumenEl, 'TipoCambio') || 1 : 1;

    const totalVenta = resumenEl ? getNum(resumenEl, 'TotalVenta') : 0;
    const totalDescuentos = resumenEl ? getNum(resumenEl, 'TotalDescuentos') : 0;
    const totalVentaNeta = resumenEl ? getNum(resumenEl, 'TotalVentaNeta') : 0;
    const totalImpuesto = resumenEl ? getNum(resumenEl, 'TotalImpuesto') : 0;
    const totalComprobante = resumenEl ? getNum(resumenEl, 'TotalComprobante') : 0;

    // ─── Desglose Exacto de IVA por Tarifa (D-104) ───
    let tarifaIVA = 13; // Default fallback
    const desgloseIVA = {}; // { '13': { base: 0, iva: 0 }, '4': ... }
    
    for (const l of lineas) {
      let isIVA = false;
      let tarifaLinea = 0;
      let montoIVALinea = 0;
      
      for (const imp of l.impuestos) {
        if (imp.codigo === '01' || imp.codigo === '07') { // IVA
          isIVA = true;
          tarifaLinea = imp.tarifa;
          montoIVALinea += imp.monto;
        }
      }
      
      const tKey = isIVA ? String(tarifaLinea) : '0'; // 0 para exentos/sin IVA
      if (!desgloseIVA[tKey]) {
        desgloseIVA[tKey] = { base: 0, iva: 0 };
      }
      // Subtotal es la base imponible
      desgloseIVA[tKey].base += l.subtotal;
      desgloseIVA[tKey].iva += montoIVALinea;
    }

    // Mantener tarifaIVA predominante por compatibilidad con UI vieja
    let maxBase = 0;
    for (const [t, vals] of Object.entries(desgloseIVA)) {
      if (vals.base > maxBase && t !== '0') {
        maxBase = vals.base;
        tarifaIVA = Number(t);
      }
    }

    // ─── Descripción automática ───
    const descripcionAuto = lineas.length > 0
      ? lineas.map(l => l.detalle).filter(Boolean).join(', ').slice(0, 200)
      : `Comprobante ${tipoDocumento} de ${emisor.nombre}`;

    return {
      success: true,
      clave,
      tipoDocumento,
      emisor,
      receptor,
      fecha,
      fechaStr: fecha ? fecha.toISOString() : '',
      moneda,
      tipoCambio,
      lineas,
      totalVenta: round2(totalVenta),
      totalDescuentos: round2(totalDescuentos),
      totalVentaNeta: round2(totalVentaNeta),
      totalImpuesto: round2(totalImpuesto),
      totalComprobante: round2(totalComprobante),
      desgloseIVA,
      descripcion: descripcionAuto,
      cantidadLineas: lineas.length,
      xmlRaw: xmlString
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Error al parsear XML',
      clave: '',
      tipoDocumento: '',
      emisor: {},
      receptor: {},
      fecha: null,
      lineas: [],
      totalComprobante: 0,
      totalImpuesto: 0,
      xmlRaw: xmlString
    };
  }
}

/**
 * Detect document type from XML root element name
 */
function detectTipoDocumento(rootName) {
  const name = (rootName || '').toLowerCase();
  if (name.includes('factura') && !name.includes('nota')) return 'FE';
  if (name.includes('notacredito') || (name.includes('nota') && name.includes('credito'))) return 'NC';
  if (name.includes('notadebito') || (name.includes('nota') && name.includes('debito'))) return 'ND';
  if (name.includes('tiquete')) return 'TE';
  if (name.includes('confirmacion') || name.includes('mensaje')) return 'CCE';
  return 'FE'; // Default
}

/**
 * Read an XML file from a File input
 * @param {File} file - File object from <input type="file">
 * @returns {Promise<Object>} Parsed invoice
 */
export async function parseXMLFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = parseComprobanteXML(e.target.result);
      result.fileName = file.name;
      result.fileSize = file.size;
      resolve(result);
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file);
  });
}

/**
 * Parse XML from base64 string (for email attachments)
 * @param {string} base64 - Base64 encoded XML
 * @returns {Object} Parsed invoice
 */
export function parseXMLFromBase64(base64) {
  try {
    const xmlString = atob(base64);
    return parseComprobanteXML(xmlString);
  } catch (err) {
    return {
      success: false,
      error: 'Error al decodificar base64: ' + err.message
    };
  }
}

/**
 * Validate a Costa Rica e-invoice clave numérica (50 digits)
 * @param {string} clave
 * @returns {Object} Validation result with decoded info
 */
export function validarClave(clave) {
  if (!clave || clave.length !== 50) {
    return { valid: false, error: 'La clave numérica debe tener 50 dígitos' };
  }

  if (!/^\d{50}$/.test(clave)) {
    return { valid: false, error: 'La clave numérica solo debe contener dígitos' };
  }

  // Decode structure: https://www.hacienda.go.cr/docs/5a5fad0c6afa2_Anexos%20y%20estructuras_V4.3.pdf
  const paisCode = clave.substring(0, 3);   // 506
  const dia = clave.substring(3, 5);
  const mes = clave.substring(5, 7);
  const anio = clave.substring(7, 9);
  const cedulaEmisor = clave.substring(9, 21);
  const consecutivo = clave.substring(21, 41);
  const situacion = clave.substring(41, 42);
  const codigoSeguridad = clave.substring(42, 50);

  return {
    valid: paisCode === '506',
    pais: paisCode,
    fecha: `${dia}/${mes}/20${anio}`,
    cedulaEmisor: cedulaEmisor.replace(/^0+/, ''),
    consecutivo,
    situacion: situacion === '1' ? 'Normal' : situacion === '2' ? 'Contingencia' : 'Sin internet',
    codigoSeguridad
  };
}

/**
 * Determine if a parsed XML is an income or expense based on the user's cédula
 * @param {Object} parsed - Parsed XML result
 * @param {string} miCedula - User's cédula
 * @returns {'ingreso' | 'gasto' | 'desconocido'}
 */
export function clasificarComprobante(parsed, miCedula = '205390118') {
  if (!parsed.success) return 'desconocido';

  const emisorCedula = (parsed.emisor?.cedula || '').replace(/^0+/, '');
  const receptorCedula = (parsed.receptor?.cedula || '').replace(/^0+/, '');
  const mi = miCedula.replace(/^0+/, '');

  // If I'm the emisor → it's my income
  if (emisorCedula === mi) return 'ingreso';
  // If I'm the receptor → it's my expense
  if (receptorCedula === mi) return 'gasto';

  return 'desconocido';
}

function round2(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }
