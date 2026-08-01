// Script para crear la tabla catalogo_dispositivos en Supabase
// Ejecutar con: node _crear_tabla_dispositivos.js
import { createClient } from '@supabase/supabase-js';

const url = 'https://qznxejukrtprtzxbkcan.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF6bnhlanVrcnRwcnR6eGJrY2FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4Njk4ODAsImV4cCI6MjA5MTQ0NTg4MH0.wePQV8l04rMNynO-S598thR51L4YmgD-2xxiDxjl1TY';
const supabase = createClient(url, key);

async function checkTable() {
  const { data, error } = await supabase.from('catalogo_dispositivos').select('*').limit(1);
  if (error) {
    console.log('❌ La tabla NO existe. Error:', error.message);
    console.log('\n👉 Ve al SQL Editor de Supabase y pega el SQL que está en el comentario de abajo.');
  } else {
    console.log('✅ La tabla catalogo_dispositivos YA EXISTE.');
    console.log(`   Registros encontrados: ${data.length}`);
  }
}

checkTable();

/*
SQL PARA SUPABASE SQL EDITOR:

CREATE TABLE IF NOT EXISTS catalogo_dispositivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fabricante TEXT,
  modelo TEXT,
  bios TEXT,
  cpu_marca TEXT,
  cpu_modelo TEXT,
  ram_tipo TEXT,
  ram_capacidad TEXT,
  ram_gen TEXT,
  ram_velocidad TEXT,
  disco_tipo TEXT,
  disco_capacidad TEXT,
  disco_marca TEXT,
  so TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_catalogo_dispositivos_updated_at ON catalogo_dispositivos;
CREATE TRIGGER update_catalogo_dispositivos_updated_at
  BEFORE UPDATE ON catalogo_dispositivos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO catalogo_dispositivos (fabricante, modelo, bios, cpu_marca, cpu_modelo, ram_tipo, ram_capacidad, ram_gen, ram_velocidad, disco_tipo, disco_capacidad, disco_marca, so) VALUES
  ('Dell', 'Latitude 5440', 'UEFI', 'Intel', 'Core i5-1345U', 'DDR5', '16GB', '5', '4800', 'NVMe', '512GB', 'Samsung', 'Windows 11'),
  ('HP', 'ProBook 450 G10', 'UEFI', 'Intel', 'Core i7-1355U', 'DDR4', '8GB', '4', '3200', 'SSD SATA', '256GB', 'WD', 'Windows 10'),
  ('Lenovo', 'ThinkPad X1 Carbon Gen 11', 'UEFI', 'Intel', 'Core i7-1365U', 'LPDDR5', '32GB', '5', '6400', 'NVMe', '1TB', 'Samsung', 'Windows 11'),
  ('ASUS', 'ZenBook 14 UX3404', 'UEFI', 'Intel', 'Core i5-1340P', 'LPDDR5', '16GB', '5', '5200', 'NVMe', '512GB', 'Samsung', 'Windows 11'),
  ('Apple', 'MacBook Pro 14" M3 Pro', 'UEFI', 'Apple', 'M3 Pro', 'LPDDR5', '18GB', '5', '6400', 'NVMe', '512GB', 'Apple', 'macOS'),
  ('Samsung', 'Galaxy Book3 Pro 360', 'UEFI', 'Intel', 'Core i7-1360P', 'LPDDR5', '16GB', '5', '5200', 'NVMe', '512GB', 'Samsung', 'Windows 11'),
  ('Dell', 'OptiPlex 7010', 'UEFI+Legacy', 'Intel', 'Core i5-13500', 'DDR4', '16GB', '4', '3200', 'SSD SATA', '512GB', 'Crucial', 'Windows 11'),
  ('HP', 'EliteDesk 800 G9', 'UEFI', 'Intel', 'Core i7-13700', 'DDR5', '32GB', '5', '4800', 'NVMe', '1TB', 'Samsung', 'Windows 11'),
  ('Lenovo', 'ThinkCentre M75q Gen 2', 'UEFI', 'AMD', 'Ryzen 5 5650GE', 'DDR4', '16GB', '4', '3200', 'NVMe', '512GB', 'WD', 'Windows 10'),
  ('MSI', 'Stealth 15M B12U', 'UEFI', 'Intel', 'Core i7-1260P', 'DDR4', '16GB', '4', '3200', 'NVMe', '1TB', 'Samsung', 'Windows 11'),
  ('Acer', 'Aspire 5 A515-57', 'UEFI', 'Intel', 'Core i5-1235U', 'DDR4', '8GB', '4', '3200', 'NVMe', '512GB', 'Kingston', 'Windows 11'),
  ('Huawei', 'MateBook 14', 'UEFI', 'Intel', 'Core i5-1240P', 'LPDDR4', '16GB', '4', '3733', 'NVMe', '512GB', 'Samsung', 'Windows 11'),
  ('Apple', 'Mac Mini M2 Pro', 'UEFI', 'Apple', 'M2 Pro', 'LPDDR5', '16GB', '5', '6400', 'NVMe', '512GB', 'Apple', 'macOS'),
  ('Dell', 'PowerEdge R750xs', 'UEFI', 'Intel', 'Xeon Silver 4310', 'DDR5', '64GB', '5', '4800', 'NVMe', '2TB', 'Samsung', 'Windows Server 2022'),
  ('HP', 'ZBook Fury 16 G10', 'UEFI', 'Intel', 'Core i9-13950HX', 'DDR5', '64GB', '5', '4800', 'NVMe', '2TB', 'Samsung', 'Windows 11')
ON CONFLICT DO NOTHING;
*/
