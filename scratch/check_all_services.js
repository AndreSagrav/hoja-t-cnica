const https = require('https');

const options = {
  hostname: 'qznxejukrtprtzxbkcan.supabase.co',
  path: `/rest/v1/catalogo_servicios?select=*`,
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
      const data = JSON.parse(body);
      console.log('Total items in DB:', data.length);
      data.forEach(item => {
        if (item.nombre && (item.nombre.toLowerCase().includes('soporte') || item.nombre.toLowerCase().includes('remoto') || item.nombre.toLowerCase().includes('tecnico') || item.tipo === 'servicio')) {
          console.log('--- SERVICE ITEM ---');
          console.log(JSON.stringify(item, null, 2));
        }
      });
    } catch(e) {
      console.log('Raw response:', body);
    }
  });
});
req.on('error', (e) => console.error(e));
req.end();
