const https = require('https');

const options = {
  hostname: 'qznxejukrtprtzxbkcan.supabase.co',
  path: '/rest/v1/',
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
      const tables = Object.keys(data.paths)
        .filter(path => path !== '/' && !path.includes('/rpc/'))
        .map(path => path.replace(/^\//, ''));
      console.log('Tables exposed in public schema:', [...new Set(tables)]);
    } catch (e) {
      console.log('Error parsing response:', e.message);
      console.log('Raw:', body);
    }
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.end();
