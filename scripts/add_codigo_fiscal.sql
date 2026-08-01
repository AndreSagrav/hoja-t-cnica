-- ============================================================
-- Agregar columna codigo_fiscal a tabla clientes
-- Código fiscal = terminal en el consecutivo de Hacienda (5 dígitos)
-- Auto-asignación secuencial empezando en 00001
-- ============================================================

-- 1. Agregar columna
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_fiscal INT;

-- 2. Auto-asignar códigos a clientes existentes que no tengan uno
-- Asigna en orden alfabético empezando desde 1
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY nombre) AS rn
  FROM clientes
  WHERE codigo_fiscal IS NULL
)
UPDATE clientes
SET codigo_fiscal = ranked.rn
FROM ranked
WHERE clientes.id = ranked.id;

-- 3. Crear índice único para evitar duplicados
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_codigo_fiscal
  ON clientes (codigo_fiscal)
  WHERE codigo_fiscal IS NOT NULL;

-- 4. Tabla para controlar consecutivos por cliente + tipo de documento
CREATE TABLE IF NOT EXISTS documento_consecutivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT NOT NULL REFERENCES clientes(id),
  doc_type TEXT NOT NULL,  -- 'OT', 'COT', 'FAC'
  ultimo_consecutivo INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(cliente_id, doc_type)
);

-- 5. Tabla para configuración fiscal del emisor
CREATE TABLE IF NOT EXISTS fiscal_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal INT NOT NULL DEFAULT 10001,
  cedula_emisor TEXT NOT NULL DEFAULT '002053901800',
  nombre_emisor TEXT NOT NULL DEFAULT 'César',
  codigo_actividad TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insertar configuración por defecto si no existe
INSERT INTO fiscal_config (sucursal, cedula_emisor, nombre_emisor)
SELECT 10001, '002053901800', 'César'
WHERE NOT EXISTS (SELECT 1 FROM fiscal_config LIMIT 1);
