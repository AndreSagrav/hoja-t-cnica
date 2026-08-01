-- ============================================================
-- CORRECCIÓN DE SCHEMA SUPABASE
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Columnas faltantes en tabla documentos
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS descuento NUMERIC DEFAULT 0;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS iva NUMERIC DEFAULT 0;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC DEFAULT 1;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS tiempo_estimado TEXT;

-- 2. Columna equipos en clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS equipos JSONB;

-- 3. Tabla fiscal_config (para numeración de Hacienda)
CREATE TABLE IF NOT EXISTS fiscal_config (
  id SERIAL PRIMARY KEY,
  sucursal VARCHAR(3) DEFAULT '001',
  terminal VARCHAR(5) DEFAULT '00001',
  tipo_documento VARCHAR(2) DEFAULT '01',
  consecutivo INTEGER DEFAULT 1,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Tabla documento_consecutivos (para consecutivos por cliente/tipo)
CREATE TABLE IF NOT EXISTS documento_consecutivos (
  id SERIAL PRIMARY KEY,
  cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_documento VARCHAR(10) NOT NULL,
  consecutivo VARCHAR(50) NOT NULL,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Habilitar RLS en tablas nuevas
ALTER TABLE fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE documento_consecutivos ENABLE ROW LEVEL SECURITY;

-- 6. Políticas RLS para fiscal_config (acceso para usuarios autenticados)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fiscal_config' AND policyname = 'auth_select_fiscal_config') THEN
    CREATE POLICY auth_select_fiscal_config ON fiscal_config FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fiscal_config' AND policyname = 'auth_insert_fiscal_config') THEN
    CREATE POLICY auth_insert_fiscal_config ON fiscal_config FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'fiscal_config' AND policyname = 'auth_update_fiscal_config') THEN
    CREATE POLICY auth_update_fiscal_config ON fiscal_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 7. Políticas RLS para documento_consecutivos
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documento_consecutivos' AND policyname = 'auth_select_consecutivos') THEN
    CREATE POLICY auth_select_consecutivos ON documento_consecutivos FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documento_consecutivos' AND policyname = 'auth_insert_consecutivos') THEN
    CREATE POLICY auth_insert_consecutivos ON documento_consecutivos FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'documento_consecutivos' AND policyname = 'auth_update_consecutivos') THEN
    CREATE POLICY auth_update_consecutivos ON documento_consecutivos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 8. Verificar que lineas_documento tenga las columnas correctas
-- (Si la tabla no existe, crearla)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'lineas_documento') THEN
    CREATE TABLE lineas_documento (
      id SERIAL PRIMARY KEY,
      documento_id UUID REFERENCES documentos(id) ON DELETE CASCADE,
      linea_num INTEGER NOT NULL,
      descripcion TEXT,
      cantidad NUMERIC DEFAULT 1,
      precio NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0
    );
    ALTER TABLE lineas_documento ENABLE ROW LEVEL SECURITY;
    CREATE POLICY auth_select_lineas ON lineas_documento FOR SELECT TO authenticated USING (true);
    CREATE POLICY auth_insert_lineas ON lineas_documento FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY auth_update_lineas ON lineas_documento FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY auth_delete_lineas ON lineas_documento FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 9. Verificar que hojas_trabajo exista
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hojas_trabajo') THEN
    CREATE TABLE hojas_trabajo (
      id SERIAL PRIMARY KEY,
      documento_id UUID REFERENCES documentos(id) ON DELETE CASCADE,
      diagnostico TEXT,
      hora_entrada TIME,
      hora_salida TIME
    );
    ALTER TABLE hojas_trabajo ENABLE ROW LEVEL SECURITY;
    CREATE POLICY auth_select_hojas ON hojas_trabajo FOR SELECT TO authenticated USING (true);
    CREATE POLICY auth_insert_hojas ON hojas_trabajo FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY auth_update_hojas ON hojas_trabajo FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY auth_delete_hojas ON hojas_trabajo FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

-- 10. Verificar que trabajos_realizados exista
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trabajos_realizados') THEN
    CREATE TABLE trabajos_realizados (
      id SERIAL PRIMARY KEY,
      hoja_trabajo_id UUID REFERENCES hojas_trabajo(id) ON DELETE CASCADE,
      tarea_num INTEGER,
      descripcion TEXT,
      realizada BOOLEAN DEFAULT true
    );
    ALTER TABLE trabajos_realizados ENABLE ROW LEVEL SECURITY;
    CREATE POLICY auth_select_trabajos ON trabajos_realizados FOR SELECT TO authenticated USING (true);
    CREATE POLICY auth_insert_trabajos ON trabajos_realizados FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY auth_update_trabajos ON trabajos_realizados FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    CREATE POLICY auth_delete_trabajos ON trabajos_realizados FOR DELETE TO authenticated USING (true);
  END IF;
END $$;
