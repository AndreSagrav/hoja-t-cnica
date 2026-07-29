let client = null;

export async function getSupabase() {
  if (client) return client;
  let createClientFn;
  try {
    const mod = await import('@supabase/supabase-js');
    createClientFn = mod.createClient;
  } catch (_) {
    const mod = await import('https://esm.sh/@supabase/supabase-js@2');
    createClientFn = mod.createClient;
  }

  const url = 'https://qznxejukrtprtzxbkcan.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY';
  client = createClientFn(url, key);
  return client;
}

/**
 * Wrap a promise with a timeout. If the promise doesn't resolve within `ms`,
 * return the `fallback` value instead of hanging forever.
 */
export function withTimeout(promise, ms = 5000, fallback = null) {
  return Promise.race([
    promise,
    new Promise(resolve => setTimeout(() => resolve(fallback), ms))
  ]);
}
