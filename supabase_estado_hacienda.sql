-- Agregar columna estado_hacienda a la tabla documentos
-- Ejecutar en: Supabase Dashboard > SQL Editor
ALTER TABLE public.documentos
ADD COLUMN IF NOT EXISTS estado_hacienda TEXT DEFAULT 'sin_enviar';
