-- ============================================================
-- CREACIÓN DE TABLAS PARA EL MÓDULO FISCAL Y FACTURAS XML
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabla principal de facturas electrónicas e impuestos (Ingresos y Gastos)
CREATE TABLE IF NOT EXISTS public.fiscal_facturas (
  id VARCHAR(200) PRIMARY KEY, -- Clave de Hacienda o Nombre de Archivo
  tipo VARCHAR(50) NOT NULL, -- 'ingreso' o 'gasto'
  fecha DATE,
  descripcion TEXT,
  cliente TEXT,
  proveedor TEXT,
  monto_bruto NUMERIC DEFAULT 0,
  tarifa_iva NUMERIC DEFAULT 0,
  monto_iva NUMERIC DEFAULT 0,
  monto_neto NUMERIC DEFAULT 0,
  desglose_iva JSONB,
  xml_clave VARCHAR(100),
  deducible BOOLEAN DEFAULT true,
  periodo_mes INTEGER,
  periodo_anio INTEGER,
  categoria_nombre TEXT,
  notas TEXT,
  raw_xml TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de configuración fiscal (Saldos anteriores, créditos fiscales, etc.)
CREATE TABLE IF NOT EXISTS public.fiscal_config (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Desactivar Row Level Security (RLS) para permitir acceso público desde web y móvil
ALTER TABLE public.fiscal_facturas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fiscal_config DISABLE ROW LEVEL SECURITY;
