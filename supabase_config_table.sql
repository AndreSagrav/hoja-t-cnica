-- Crear tabla config para guardar credenciales y configuración global
-- Ejecutar en: Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS public.config (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;

-- Política: permitir acceso anónimo (la app usa anon key)
CREATE POLICY "Allow anon all on config" ON public.config
  FOR ALL USING (true) WITH CHECK (true);
