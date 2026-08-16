-- Agregar campos para detección automática de crédito fiscal
ALTER TABLE fiscal_facturas
  ADD COLUMN IF NOT EXISTS aplica_credito_fiscal boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS credito_fiscal_metodo text DEFAULT 'no_detectado',
  ADD COLUMN IF NOT EXISTS credito_fiscal_confianza integer DEFAULT 0;
