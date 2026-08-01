-- Verificar columnas reales de trabajos_realizados
SELECT column_name, data_type, is_nullable FROM information_schema.columns 
WHERE table_name = 'trabajos_realizados' ORDER BY ordinal_position;

-- Verificar si la tabla existe
SELECT EXISTS (SELECT FROM pg_tables WHERE tablename = 'trabajos_realizados');
