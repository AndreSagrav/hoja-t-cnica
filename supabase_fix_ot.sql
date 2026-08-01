-- Crear trabajos_realizados si no existe
CREATE TABLE IF NOT EXISTS trabajos_realizados (
  id BIGSERIAL PRIMARY KEY,
  hoja_trabajo_id BIGINT REFERENCES hojas_trabajo(id) ON DELETE CASCADE,
  tarea_num INTEGER DEFAULT 1,
  descripcion TEXT,
  realizada BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desactivar RLS en tablas de OT
ALTER TABLE hojas_trabajo DISABLE ROW LEVEL SECURITY;
ALTER TABLE trabajos_realizados DISABLE ROW LEVEL SECURITY;
