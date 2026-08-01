-- ============================================================
-- CORRECCIÓN DE SCHEMA SUPABASE v4
-- Fix: documento_consecutivos.cliente_id era bigint pero
-- el código pasa UUID (clientes.id) → insert falla → fallback COT-001
-- ============================================================

-- 1. Actualizar sucursal
UPDATE fiscal_config SET sucursal = '10001' WHERE sucursal = '001' OR sucursal IS NULL;

-- 2. Recrear documento_consecutivos con cliente_id UUID
DROP TABLE IF EXISTS documento_consecutivos;

CREATE TABLE documento_consecutivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id BIGINT REFERENCES clientes(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL,
  ultimo_consecutivo INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice único para optimistic locking
CREATE UNIQUE INDEX idx_doc_consec_cliente_tipo ON documento_consecutivos(cliente_id, doc_type);

-- Habilitar RLS
ALTER TABLE documento_consecutivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage consecutivos" ON documento_consecutivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
