-- ═══════════════════════════════════════════════════════════════════════
-- KEEP-ALIVE REAL PARA SUPABASE (escritura en la BD, no solo lectura)
-- Ejecutar UNA vez en Supabase > SQL Editor después de restaurar el proyecto.
-- ═══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.keepalive (
  id INT PRIMARY KEY DEFAULT 1,
  last_ping TIMESTAMPTZ NOT NULL DEFAULT now(),
  ping_count BIGINT NOT NULL DEFAULT 0
);

ALTER TABLE public.keepalive ENABLE ROW LEVEL SECURITY;

INSERT INTO public.keepalive (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Función que hace un UPDATE real (actividad de escritura en Postgres)
CREATE OR REPLACE FUNCTION public.ping_keepalive()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.keepalive
     SET last_ping = now(), ping_count = ping_count + 1
   WHERE id = 1
  RETURNING last_ping;
$$;

GRANT EXECUTE ON FUNCTION public.ping_keepalive() TO anon, authenticated;
