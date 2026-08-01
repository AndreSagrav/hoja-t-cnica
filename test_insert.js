const https = require('https');

const data = JSON.stringify({ nombre: 'TEST_DELETE', tipo: 'servicio', precio: 0 });
const options = {
  hostname: 'qznxejukrtprtzxbkcan.supabase.co',
  path: '/rest/v1/catalogo_servicios',
  method: 'POST',
  headers: {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY',
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
