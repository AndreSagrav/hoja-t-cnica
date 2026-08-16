const https = require('https');

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY';

function request(method, path) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path, method,
      headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
    }, (res) => {
      let b = '';
      res.on('data', (c) => b += c);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const r = await request('GET', '/rest/v1/fiscal_facturas?periodo_mes=eq.7&periodo_anio=eq.2026&order=fecha.asc&select=tipo,fecha,descripcion,monto_bruto,monto_iva,monto_neto,tarifa_iva,deducible,xml_clave');
  const rows = JSON.parse(r.body);
  console.log('Registros julio 2026:', rows.length);

  const ingresos = rows.filter(x => x.tipo === 'ingreso');
  const gastos = rows.filter(x => x.tipo === 'gasto');

  console.log('\n--- INGRESOS ---');
  ingresos.forEach(x => console.log(x.fecha, '|', x.descripcion?.padEnd(40), '| bruto', x.monto_bruto, '| iva', x.monto_iva, '| neto', x.monto_neto, '| tarifa', x.tarifa_iva, '| clave', x.xml_clave));

  console.log('\n--- GASTOS ---');
  gastos.forEach(x => console.log(x.fecha, '|', x.descripcion?.padEnd(40), '| bruto', x.monto_bruto, '| iva', x.monto_iva, '| neto', x.monto_neto, '| tarifa', x.tarifa_iva, '| deducible', x.deducible, '| clave', x.xml_clave));

  const sumVentasBase = ingresos.reduce((s, x) => s + (x.monto_bruto - x.monto_iva), 0);
  const sumVentasIVA = ingresos.reduce((s, x) => s + x.monto_iva, 0);
  const sumComprasBase = gastos.filter(x => x.deducible !== false).reduce((s, x) => s + (x.monto_bruto - x.monto_iva), 0);
  const sumComprasIVA = gastos.filter(x => x.deducible !== false).reduce((s, x) => s + x.monto_iva, 0);
  const sumComprasTotal = gastos.reduce((s, x) => s + x.monto_bruto, 0);
  const sumGastosNoDeducibles = gastos.filter(x => x.deducible === false).reduce((s, x) => s + x.monto_bruto, 0);

  console.log('\n--- TOTALES ---');
  console.log('Ventas base netas:', sumVentasBase);
  console.log('Ventas IVA:', sumVentasIVA);
  console.log('Compras deducibles base:', sumComprasBase);
  console.log('Compras deducibles IVA:', sumComprasIVA);
  console.log('Total importe compras (bruto):', sumComprasTotal);
  console.log('Gastos no deducibles:', sumGastosNoDeducibles);
  console.log('Crédito fiscal deducible:', sumComprasIVA);
})().catch(e => console.error(e.message));
