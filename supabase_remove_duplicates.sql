-- ============================================================
-- SCRIPT SUPABASE: Eliminar servicios duplicados por nombre
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- Mantiene el registro más antiguo (id menor) y elimina los duplicados
-- ============================================================

-- 1. Ver duplicados antes de borrar (verificación)
-- SELECT nombre, tipo, COUNT(*) FROM catalogo_servicios GROUP BY nombre, tipo HAVING COUNT(*) > 1;

-- 2. Eliminar duplicados: mantener solo el de menor id por cada nombre+tipo
DELETE FROM catalogo_servicios
WHERE id NOT IN (
  SELECT MIN(id) FROM catalogo_servicios GROUP BY nombre, tipo
);

-- 3. Eliminar también duplicados en clientes (si los hay)
DELETE FROM clientes
WHERE id NOT IN (
  SELECT MIN(id) FROM clientes GROUP BY nombre
);
