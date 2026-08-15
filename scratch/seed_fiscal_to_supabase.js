const fs = require('fs');
const path = require('path');
const https = require('https');

const CEDULA = '205390118';
const FACTURAS_DIR = path.join(__dirname, '..', 'facturas');

// Basic regex-based XML parser for Node environment without DOMParser
function parseXML(xmlStr) {
  const getTag = (tag) => {
    const match = xmlStr.match(new RegExp(`< (?:[a-zA-Z0-9_-]+:)?${tag}[^>]*>([^<]*)</`, 'i')) ||
                  xmlStr.match(new RegExp(`<${tag}[^>]*>([^<]*)</`, 'i'));
    return match ? match[1].trim() : '';
  };
  const getNum = (tag) => Number(getTag(tag)) || 0;

  const clave = getTag('Clave') || getTag('NumeroConsecutivo');
  const fechaStr = getTag('FechaEmision');
  const fecha = fechaStr ? fechaStr.split('T')[0] : null;

  // Emisor & Receptor
  const emisorNombre = xmlStr.match(/<Emisor[^>]*>[\s\S]*?<Nombre>([^<]+)<\/Nombre>/i)?.[1] || '';
  const receptorNombre = xmlStr.match(/<Receptor[^>]*>[\s\S]*?<Nombre>([^<]+)<\/Nombre>/i)?.[1] || '';

  const totalComprobante = getNum('TotalComprobante') || getNum('TotalVentaNeta') || 0;
  const totalImpuesto = getNum('TotalImpuesto') || 0;

  return { clave, fecha, emisorNombre, receptorNombre, totalComprobante, totalImpuesto };
}

function classify(emisorCedula, receptorCedula, filename) {
  if (filename.includes('MH-') || filename.includes('respuesta') || filename.includes('_resp') || filename.includes('_H.')) {
    return 'desconocido';
  }
  if (filename.includes('-FE-') || filename.includes('-TE-') || filename.includes('Factura_Electronica') || filename.includes('Comprobante-')) {
    return 'gasto';
  }
  return 'gasto';
}

async function uploadToSupabase(rows) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(rows);
    const options = {
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path: `/rest/v1/fiscal_facturas`,
      method: 'POST',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY',
        'Prefer': 'resolution=merge-duplicates',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    const req = https.request(options, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  if (!fs.existsSync(FACTURAS_DIR)) {
    console.log('No facturas dir found');
    return;
  }
  const files = fs.readdirSync(FACTURAS_DIR).filter(f => f.endsWith('.xml'));
  console.log(`Found ${files.length} XML files`);

  const seen = new Set();
  const rows = [];

  for (const f of files) {
    if (f.includes('respuesta') || f.includes('_H.') || f.includes('-MH-') || f.includes('_resp')) continue;
    const content = fs.readFileSync(path.join(FACTURAS_DIR, f), 'utf8');
    const parsed = parseXML(content);

    const id = parsed.clave || f;
    if (seen.has(id)) continue;
    seen.add(id);

    const dateObj = parsed.fecha ? new Date(parsed.fecha) : new Date();
    const bruto = parsed.totalComprobante;
    const iva = parsed.totalImpuesto;
    const neto = bruto - iva;

    rows.push({
      id,
      tipo: 'gasto',
      fecha: parsed.fecha,
      descripcion: f,
      cliente: parsed.receptorNombre,
      proveedor: parsed.emisorNombre || 'Proveedor XML',
      monto_bruto: bruto,
      tarifa_iva: bruto > 0 ? Math.round((iva / (bruto - iva)) * 100) : 0,
      monto_iva: iva,
      monto_neto: neto,
      xml_clave: parsed.clave,
      deducible: true,
      periodo_mes: dateObj.getMonth() + 1,
      periodo_anio: dateObj.getFullYear(),
      raw_xml: content
    });
  }

  console.log(`Prepared ${rows.length} valid invoice records for Supabase`);

  for (let i = 0; i < rows.length; i += 30) {
    const chunk = rows.slice(i, i + 30);
    const res = await uploadToSupabase(chunk);
    console.log(`Uploaded batch ${i} - ${i + chunk.length}: Status ${res.status}`);
  }
}

run();
