const https = require('https');

function checkTable(tableName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path: `/rest/v1/${tableName}?select=*&limit=5`,
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ table: tableName, status: res.statusCode, count: Array.isArray(json) ? json.length : 0, sample: Array.isArray(json) ? json[0] : json });
        } catch(e) {
          resolve({ table: tableName, status: res.statusCode, error: body });
        }
      });
    });
    req.on('error', (e) => resolve({ table: tableName, error: e.message }));
    req.end();
  });
}

async function checkAll() {
  const tables = [
    'documentos',
    'facturas_ingresos',
    'facturas_gastos',
    'gastos',
    'declaraciones',
    'declaraciones_iva',
    'impuestos_config',
    'correos_facturas'
  ];
  for (const t of tables) {
    const res = await checkTable(t);
    console.log(`=== Table: ${t} ===`);
    console.log(JSON.stringify(res, null, 2));
  }
}

checkAll();
