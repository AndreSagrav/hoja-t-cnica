-- ============================================================
-- CORRECCIÓN DE SCHEMA SUPABASE v2
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Alinea las columnas con lo que espera el código (hacienda.js, documentos.js)
-- ============================================================

-- 1. clientes.codigo_fiscal — requerido por getCodigoFiscalCliente (numeración Hacienda)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_fiscal INTEGER;

-- 2. documento_consecutivos — el código usa: cliente_id, doc_type, ultimo_consecutivo, updated_at
--    (el SQL anterior creó tipo_documento y consecutivo por error)
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS doc_type VARCHAR(10);
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS ultimo_consecutivo INTEGER DEFAULT 0;
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrar datos si venían de las columnas viejas
UPDATE documento_consecutivos SET doc_type = tipo_documento WHERE doc_type IS NULL AND tipo_documento IS NOT NULL;
UPDATE documento_consecutivos SET ultimo_consecutivo = CAST(consecutivo AS INTEGER) WHERE ultimo_consecutivo = 0 AND consecutivo IS NOT NULL AND consecutivo ~ '^\d+$';

-- Índice único para optimistic locking (evita duplicados por cliente+tipo)
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_consec_cliente_tipo ON documento_consecutivos(cliente_id, doc_type);

-- 3. lineas_documento — asegurar que TODAS las columnas esperadas existan
--    (si la tabla ya existía con otros nombres, el retry borraba 'precio' y quedaba en 0)
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS documento_id UUID;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS linea_num INTEGER;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS descripcion TEXT;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS cantidad NUMERIC DEFAULT 1;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS precio NUMERIC DEFAULT 0;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;

-- 4. documentos.equipos — guardar los equipos seleccionados del documento (no solo los del cliente)
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS equipos JSONB;

-- 5. fiscal_config — alinear con lo que lee getFiscalConfig (sucursal, cedula_emisor, nombre_emisor)
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS cedula_emisor VARCHAR(20);
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS nombre_emisor VARCHAR(200);

-- Insertar fila inicial de config fiscal si la tabla está vacía
INSERT INTO fiscal_config (sucursal, cedula_emisor, nombre_emisor)
SELECT 10001, '002053901800', 'César'
WHERE NOT EXISTS (SELECT 1 FROM fiscal_config);

-- ============================================================
-- VERIFICACIÓN (opcional): ejecutar para ver las columnas reales
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'lineas_documento';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'documento_consecutivos';
-- ============================================================
