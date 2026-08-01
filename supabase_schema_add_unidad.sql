-- SQL Script para agregar la columna 'unidad' a la tabla 'catalogo_servicios' en Supabase

ALTER TABLE public.catalogo_servicios ADD COLUMN IF NOT EXISTS unidad TEXT DEFAULT 'Hora';
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_provincia TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_canton TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_distrito TEXT;
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fact_barrio TEXT;
