
import { createClient } from '@supabase/supabase-js';
const url = 'https://qznxejukrtprtzxbkcan.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY';
const supabase = createClient(url, key);

async function check() {
  // Probar RPC
  const { data, error } = await supabase.rpc('obtener_dispositivos');
  console.log('RPC obtener_dispositivos:', error ? `Error: ${error.message}` : `OK: ${data?.length || 0} registros`);
  
  // Probar consulta directa a la tabla
  const { data: d2, error: e2 } = await supabase.from('catalogo_dispositivos').select('*').limit(1);
  console.log('Tabla catalogo_dispositivos:', e2 ? `Error: ${e2.message}` : `OK: ${d2?.length || 0} registros`);
}
check();
