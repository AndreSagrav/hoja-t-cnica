-- ============================================================
-- CREACIÓN DE TABLAS PARA EL PANEL DE TAREAS
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Tabla para guardar categorías de tareas (empresariales, residenciales o personalizadas)
CREATE TABLE IF NOT EXISTS public.tareas_data (
  id VARCHAR(100) PRIMARY KEY,
  icon VARCHAR(10) NOT NULL,
  title VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'empresarial' o 'residencial'
  children TEXT[] DEFAULT '{}', -- lista de subtareas
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla para guardar el estado de los checkboxes marcados
CREATE TABLE IF NOT EXISTS public.tareas_checks (
  id VARCHAR(200) PRIMARY KEY, -- formato: 'id_categoria-indice' (ej: 'emp-equipos-3')
  checked BOOLEAN DEFAULT true,
  creado_en TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Desactivar Row Level Security (RLS) para permitir lectura/escritura pública
ALTER TABLE public.tareas_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tareas_checks DISABLE ROW LEVEL SECURITY;
