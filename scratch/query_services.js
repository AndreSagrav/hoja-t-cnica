const https = require('https');

const options = {
  hostname: 'qznxejukrtprtzxbkcan.supabase.co',
  path: '/rest/v1/catalogo_servicios?tipo=eq.servicio',
  method: 'GET',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY',
    'Content-Type': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    try {
      const data = JSON.parse(body);
      console.log('Count:', data.length);
      console.log('Items:', data.map(i => ({ id: i.id, nombre: i.nombre, codigo: i.codigo, activo: i.activo })));
    } catch (e) {
      console.log('Raw:', body);
    }
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
