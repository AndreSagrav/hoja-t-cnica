const https = require('https');

function deleteProveedorXML() {
  return new Promise((resolve) => {
    const options = {
      hostname: 'qznxejukrtprtzxbkcan.supabase.co',
      path: `/rest/v1/fiscal_facturas?proveedor=eq.${encodeURIComponent('Proveedor XML')}`,
      method: 'DELETE',
      headers: {
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY'
      }
    };

    const req = https.request(options, (res) => {
      resolve(res.statusCode);
    });
    req.on('error', (e) => resolve(e.message));
    req.end();
  });
}

async function run() {
  const status = await deleteProveedorXML();
  console.log('Delete status for Proveedor XML rows:', status);
}

run();
