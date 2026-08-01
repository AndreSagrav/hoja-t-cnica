-- ============================================================
-- FIX RLS policies — fiscal_config y documento_consecutivos
-- ============================================================

-- fiscal_config: permitir lectura/escritura a usuarios autenticados
ALTER TABLE fiscal_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read fiscal_config" ON fiscal_config;
CREATE POLICY "Users can read fiscal_config" ON fiscal_config
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users can write fiscal_config" ON fiscal_config;
CREATE POLICY "Users can write fiscal_config" ON fiscal_config
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- documento_consecutivos: re-aplicar policies (por si el DROP/CREATE las perdió)
ALTER TABLE documento_consecutivos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage consecutivos" ON documento_consecutivos;
CREATE POLICY "Users can manage consecutivos" ON documento_consecutivos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
