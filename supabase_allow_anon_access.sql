-- ============================================================
-- SCRIPT SUPABASE: Permitir lectura/escritura pública y autenticada
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Esto garantiza que cualquier cambio guardado desde el sistema
-- (local o web) se sincronice directamente a la base de datos de la nube.
-- ============================================================

-- Deshabilitar RLS temporalmente o permitir acceso anon/authenticated en catalogo_servicios y clientes
ALTER TABLE public.catalogo_servicios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos DISABLE ROW LEVEL SECURITY;

-- Asegurar que las columnas clave existan en Supabase Cloud DB
ALTER TABLE public.catalogo_servicios ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'Hora';
ALTER TABLE public.catalogo_servicios ADD COLUMN IF NOT EXISTS codigo TEXT;

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_provincia TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_canton TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_distrito TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_barrio TEXT;
