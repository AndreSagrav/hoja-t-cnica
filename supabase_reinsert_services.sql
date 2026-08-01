-- ============================================================
-- Reinsertar servicios que se perdieron al limpiar duplicados
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

INSERT INTO catalogo_servicios (nombre, tipo, codigo, categoria, unidad, precio_residencial, precio_empresarial, precio, garantia, activo)
VALUES
  ('Diagnóstico', 'servicio', 'DG', 'Diagnóstico', 'Servicio', 10000, 12000, 10000, '30 días', true),
  ('Servicio Técnico', 'servicio', 'ST', 'Soporte Técnico', 'Hora', 12000, 15000, 12000, '30 días', true),
  ('Mantenimiento Completo', 'servicio', 'SM', 'Mantenimiento', 'Servicio', 25000, 30000, 25000, '30 días', true),
  ('Visita Técnica a Domicilio', 'servicio', 'VT', 'Visita Técnica', 'Servicio', 30000, 35000, 30000, '30 días', true),
  ('Soporte Remoto', 'servicio', 'SR', 'Soporte Técnico', 'Hora', 10000, 12000, 10000, '30 días', true)
ON CONFLICT DO NOTHING;
