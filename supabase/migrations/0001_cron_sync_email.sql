-- Habilitar pg_cron si no está habilitado
create extension if not exists pg_cron;

-- Programar la sincronización cada hora
-- Llama la Edge Function sync-email via pg_net
select cron.schedule(
  'sync-email-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qznxejukrtprtzxbkcan.supabase.co/functions/v1/sync-email',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
