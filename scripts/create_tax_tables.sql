-- ============================================================
-- INNOVIO Tax Module — Supabase Tables
-- Costa Rica Fiscal Compliance (IVA D-150, Renta D-101)
-- ============================================================

-- 1. Configuración del contribuyente
CREATE TABLE IF NOT EXISTS tax_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cedula TEXT NOT NULL DEFAULT '20539018',
  nombre TEXT NOT NULL DEFAULT 'César',
  actividad TEXT DEFAULT '',
  regimen TEXT DEFAULT 'general', -- 'general' | 'simplificado'
  tiene_conyuge BOOLEAN DEFAULT FALSE,
  cantidad_hijos INT DEFAULT 0,
  correo_fiscal TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Categorías fiscales (catálogo IVA)
CREATE TABLE IF NOT EXISTS tax_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'gasto')),
  tarifa_iva NUMERIC(5,2) NOT NULL DEFAULT 13,
  deducible BOOLEAN DEFAULT TRUE,
  descripcion TEXT DEFAULT '',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Categorías predeterminadas
INSERT INTO tax_categories (nombre, tipo, tarifa_iva, deducible, descripcion) VALUES
  ('Servicios profesionales', 'ingreso', 13, TRUE, 'Honorarios, consultorías, reparaciones'),
  ('Venta de productos', 'ingreso', 13, TRUE, 'Venta de bienes y mercancías'),
  ('Venta canasta básica', 'ingreso', 1, TRUE, 'Productos de la canasta básica tributaria'),
  ('Servicios de salud', 'ingreso', 4, TRUE, 'Servicios médicos y de salud privada'),
  ('Exportaciones', 'ingreso', 0, TRUE, 'Exportación de bienes y servicios (tasa 0)'),
  ('Alquiler de local', 'gasto', 13, TRUE, 'Alquiler de oficina o taller'),
  ('Servicios públicos', 'gasto', 13, TRUE, 'Electricidad, agua, internet, teléfono'),
  ('Materiales y repuestos', 'gasto', 13, TRUE, 'Insumos para la operación'),
  ('Herramientas y equipo', 'gasto', 13, TRUE, 'Compra de herramientas y equipo menor'),
  ('Combustible', 'gasto', 13, TRUE, 'Gasolina y diesel para vehículo del negocio'),
  ('Seguros', 'gasto', 2, TRUE, 'Primas de seguros'),
  ('Servicios profesionales (gasto)', 'gasto', 13, TRUE, 'Contabilidad, legal, consultoría'),
  ('Publicidad y marketing', 'gasto', 13, TRUE, 'Publicidad, redes sociales, diseño'),
  ('Suministros de oficina', 'gasto', 13, TRUE, 'Papelería, tinta, accesorios'),
  ('Gastos bancarios', 'gasto', 0, FALSE, 'Comisiones bancarias (no deducibles IVA)'),
  ('Gastos personales', 'gasto', 0, FALSE, 'Gastos no vinculados a la actividad (no deducibles)'),
  ('Educación/capacitación', 'gasto', 2, TRUE, 'Cursos, capacitación profesional'),
  ('Medicamentos', 'gasto', 2, TRUE, 'Medicamentos e insumos médicos'),
  ('Depreciación', 'gasto', 0, TRUE, 'Depreciación de activos fijos'),
  ('Otros gastos deducibles', 'gasto', 13, TRUE, 'Otros gastos vinculados a la actividad');

-- 3. Ingresos
CREATE TABLE IF NOT EXISTS tax_income (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  cliente TEXT DEFAULT '',
  monto_bruto NUMERIC(14,2) NOT NULL,
  tarifa_iva NUMERIC(5,2) NOT NULL DEFAULT 13,
  monto_iva NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_neto NUMERIC(14,2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES tax_categories(id),
  fuente TEXT DEFAULT 'manual', -- 'manual' | 'xml' | 'correo'
  xml_clave TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  periodo_mes INT NOT NULL, -- 1-12
  periodo_anio INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Gastos/Egresos
CREATE TABLE IF NOT EXISTS tax_expense (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fecha DATE NOT NULL,
  descripcion TEXT NOT NULL,
  proveedor TEXT DEFAULT '',
  monto_bruto NUMERIC(14,2) NOT NULL,
  tarifa_iva NUMERIC(5,2) NOT NULL DEFAULT 13,
  monto_iva NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_neto NUMERIC(14,2) NOT NULL DEFAULT 0,
  category_id UUID REFERENCES tax_categories(id),
  deducible BOOLEAN DEFAULT TRUE,
  fuente TEXT DEFAULT 'manual',
  xml_clave TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  periodo_mes INT NOT NULL,
  periodo_anio INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. XMLs de comprobantes electrónicos
CREATE TABLE IF NOT EXISTS tax_invoices_xml (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clave_numerica TEXT UNIQUE NOT NULL,
  tipo_documento TEXT NOT NULL, -- 'FE' | 'NC' | 'ND' | 'TE' | 'CCE'
  emisor_cedula TEXT DEFAULT '',
  emisor_nombre TEXT DEFAULT '',
  receptor_cedula TEXT DEFAULT '',
  receptor_nombre TEXT DEFAULT '',
  fecha_emision TIMESTAMPTZ,
  total_venta NUMERIC(14,2) DEFAULT 0,
  total_impuesto NUMERIC(14,2) DEFAULT 0,
  total_comprobante NUMERIC(14,2) DEFAULT 0,
  moneda TEXT DEFAULT 'CRC',
  xml_raw TEXT, -- XML completo para auditoría
  parsed_data JSONB DEFAULT '{}',
  vinculado_a TEXT DEFAULT '', -- 'income:{id}' | 'expense:{id}'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Adjuntos de correo
CREATE TABLE IF NOT EXISTS tax_email_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id TEXT NOT NULL,
  message_subject TEXT DEFAULT '',
  message_from TEXT DEFAULT '',
  message_date TIMESTAMPTZ,
  attachment_name TEXT NOT NULL,
  attachment_type TEXT DEFAULT '',
  attachment_size INT DEFAULT 0,
  content_base64 TEXT DEFAULT '',
  procesado BOOLEAN DEFAULT FALSE,
  vinculado_a TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. Declaraciones IVA mensuales
CREATE TABLE IF NOT EXISTS tax_iva_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_mes INT NOT NULL,
  periodo_anio INT NOT NULL,
  total_ingresos NUMERIC(14,2) DEFAULT 0,
  debito_fiscal NUMERIC(14,2) DEFAULT 0,
  total_gastos NUMERIC(14,2) DEFAULT 0,
  credito_fiscal NUMERIC(14,2) DEFAULT 0,
  iva_a_pagar NUMERIC(14,2) DEFAULT 0,
  saldo_favor NUMERIC(14,2) DEFAULT 0,
  desglose JSONB DEFAULT '{}', -- desglose por tarifa
  estado TEXT DEFAULT 'borrador', -- 'borrador' | 'guardado' | 'presentado'
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(periodo_mes, periodo_anio)
);

-- 8. Declaraciones Renta anuales
CREATE TABLE IF NOT EXISTS tax_renta_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  periodo_anio INT NOT NULL UNIQUE,
  ingresos_brutos NUMERIC(14,2) DEFAULT 0,
  gastos_deducibles NUMERIC(14,2) DEFAULT 0,
  renta_neta NUMERIC(14,2) DEFAULT 0,
  impuesto_bruto NUMERIC(14,2) DEFAULT 0,
  credito_conyugal NUMERIC(14,2) DEFAULT 0,
  credito_hijos NUMERIC(14,2) DEFAULT 0,
  otros_creditos NUMERIC(14,2) DEFAULT 0,
  impuesto_neto NUMERIC(14,2) DEFAULT 0,
  usa_deduccion_unica BOOLEAN DEFAULT FALSE,
  desglose JSONB DEFAULT '{}',
  estado TEXT DEFAULT 'borrador',
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. Créditos fiscales
CREATE TABLE IF NOT EXISTS tax_fiscal_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL, -- 'iva_saldo_favor' | 'pago_parcial' | 'retencion'
  periodo_origen TEXT DEFAULT '',
  monto NUMERIC(14,2) NOT NULL DEFAULT 0,
  monto_aplicado NUMERIC(14,2) DEFAULT 0,
  monto_disponible NUMERIC(14,2) DEFAULT 0,
  aplicado_en TEXT DEFAULT '',
  estado TEXT DEFAULT 'disponible', -- 'disponible' | 'aplicado' | 'vencido'
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para rendimiento
CREATE INDEX IF NOT EXISTS idx_tax_income_periodo ON tax_income(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_tax_expense_periodo ON tax_expense(periodo_anio, periodo_mes);
CREATE INDEX IF NOT EXISTS idx_tax_invoices_clave ON tax_invoices_xml(clave_numerica);
CREATE INDEX IF NOT EXISTS idx_tax_iva_decl_periodo ON tax_iva_declarations(periodo_anio, periodo_mes);

-- Insertar configuración inicial
INSERT INTO tax_config (cedula, nombre) VALUES ('20539018', 'César')
ON CONFLICT DO NOTHING;
