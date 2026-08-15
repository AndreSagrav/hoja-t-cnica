const https = require('https');

function fetchTable(table) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path: `/rest/v1/${table}?select=*&order=creado_en.desc&limit=5`,
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
          resolve({ table, data: JSON.parse(body) });
        } catch {
          resolve({ table, error: 'Could not parse JSON', raw: body });
        }
      });
    });
    req.on('error', (e) => resolve({ table, error: e.message }));
    req.end();
  });
}

Promise.all([
  fetchTable('tareas_data'),
  fetchTable('catalogo_servicios')
]).then(results => {
  console.log(JSON.stringify(results, null, 2));
});
