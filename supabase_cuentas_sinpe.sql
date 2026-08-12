-- ============================================================
-- Crear tablas para Cuentas Bancarias y SINPE Móvil
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Tabla: cuentas_bancarias
CREATE TABLE IF NOT EXISTS public.cuentas_bancarias (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  banco TEXT NOT NULL,
  titular TEXT NOT NULL,
  iban TEXT,
  tipo TEXT DEFAULT 'corriente',
  moneda TEXT DEFAULT 'CRC',
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla: sinpe_config (una sola fila, configuración global)
CREATE TABLE IF NOT EXISTS public.sinpe_config (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero TEXT NOT NULL,
  titular TEXT,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS (Row Level Security)
ALTER TABLE public.cuentas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sinpe_config ENABLE ROW LEVEL SECURITY;

-- Políticas para cuentas_bancarias (acceso público con anon key)
CREATE POLICY "Allow all on cuentas_bancarias" ON public.cuentas_bancarias
  FOR ALL USING (true) WITH CHECK (true);

-- Políticas para sinpe_config
CREATE POLICY "Allow all on sinpe_config" ON public.sinpe_config
  FOR ALL USING (true) WITH CHECK (true);

-- Comentar si ya existen las políticas (para re-ejecución segura)
-- DROP POLICY IF EXISTS "Allow all on cuentas_bancarias" ON public.cuentas_bancarias;
-- DROP POLICY IF EXISTS "Allow all on sinpe_config" ON public.sinpe_config;
