-- Tabla para opciones personalizadas del catálogo de equipos
-- Permite que las opciones agregadas con "+" se guarden en Supabase
-- y estén disponibles en cualquier dispositivo

CREATE TABLE IF NOT EXISTS public.custom_field_options (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  field_name TEXT NOT NULL,
  option_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(field_name, option_value)
);

-- Habilitar acceso público (anon) para lectura y escritura
ALTER TABLE public.custom_field_options ENABLE ROW LEVEL SECURITY;

-- Política: cualquiera puede leer
CREATE POLICY "Anyone can read custom_field_options"
  ON public.custom_field_options
  FOR SELECT
  USING (true);

-- Política: cualquiera puede insertar
CREATE POLICY "Anyone can insert custom_field_options"
  ON public.custom_field_options
  FOR INSERT
  WITH CHECK (true);

-- Política: cualquiera puede eliminar
CREATE POLICY "Anyone can delete custom_field_options"
  ON public.custom_field_options
  FOR DELETE
  USING (true);
