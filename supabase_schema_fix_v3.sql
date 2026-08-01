-- ============================================================
-- CORRECCIÓN DE SCHEMA SUPABASE v3
-- Alinea las columnas con lo que espera el código
-- ============================================================

-- 1. clientes.codigo_fiscal — requerido por numeración Hacienda
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS codigo_fiscal INTEGER;

-- 2. documento_consecutivos — el código usa: doc_type, ultimo_consecutivo, updated_at
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS doc_type VARCHAR(10);
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS ultimo_consecutivo INTEGER DEFAULT 0;
ALTER TABLE documento_consecutivos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Índice único para optimistic locking
CREATE UNIQUE INDEX IF NOT EXISTS idx_doc_consec_cliente_tipo ON documento_consecutivos(cliente_id, doc_type);

-- 3. lineas_documento — la tabla tiene precio_unitario/total_linea, el código usa precio/total
--    Agregar las columnas que el código espera (no borrar las existentes)
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS precio NUMERIC DEFAULT 0;
ALTER TABLE lineas_documento ADD COLUMN IF NOT EXISTS total NUMERIC DEFAULT 0;

-- 4. documentos.equipos — guardar equipos del documento
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS equipos JSONB;

-- 5. fiscal_config — alinear con getFiscalConfig
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS cedula_emisor VARCHAR(20);
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS nombre_emisor VARCHAR(200);
ALTER TABLE fiscal_config ADD COLUMN IF NOT EXISTS sucursal INTEGER DEFAULT 10001;

-- Insertar fila inicial si está vacía
INSERT INTO fiscal_config (sucursal, cedula_emisor, nombre_emisor)
SELECT 10001, '002053901800', 'César'
WHERE NOT EXISTS (SELECT 1 FROM fiscal_config);
