const https = require('https');

const tablesToProbe = ['tareas', 'tareas_data', 'tareas_checks', 'hojas_trabajo', 'trabajos_realizados'];

function probeTable(tableName) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path: `/rest/v1/${tableName}?select=*&limit=1`,
      method: 'GET',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({
          name: tableName,
          status: res.statusCode,
          body: body.substring(0, 100)
        });
      });
    });
    req.on('error', (e) => resolve({ name: tableName, error: e.message }));
    req.end();
  });
}

Promise.all(tablesToProbe.map(probeTable)).then(results => {
  console.log(JSON.stringify(results, null, 2));
});
