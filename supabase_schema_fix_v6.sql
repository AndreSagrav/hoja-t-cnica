-- Desactivar RLS en tablas internas
ALTER TABLE fiscal_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE documento_consecutivos DISABLE ROW LEVEL SECURITY;

-- Verificar que las tablas existen y tienen datos
SELECT * FROM fiscal_config;
SELECT * FROM documento_consecutivos;
