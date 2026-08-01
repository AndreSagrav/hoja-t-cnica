-- Verificar columnas de trabajos_realizados y hojas_trabajo
SELECT column_name, data_type, is_nullable FROM information_schema.columns 
WHERE table_name = 'trabajos_realizados' ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable FROM information_schema.columns 
WHERE table_name = 'hojas_trabajo' ORDER BY ordinal_position;
