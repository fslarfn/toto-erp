-- Katalog HPP barang CV Toto: harga batang terbaru dibagi panjang bahan.
-- Migrasi ini bersifat aditif dan tidak menghapus tabel HPP per pesanan sebelumnya.
CREATE TABLE IF NOT EXISTS product_hpp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  product_name text NOT NULL CHECK (length(trim(product_name)) > 0),
  material_id text,
  source_invoice_id text,
  source_invoice_number text NOT NULL DEFAULT '',
  source_invoice_date date,
  purchase_price bigint NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  material_length numeric(14,3) NOT NULL DEFAULT 6 CHECK (material_length > 0),
  material_cost_per_meter bigint NOT NULL DEFAULT 0 CHECK (material_cost_per_meter >= 0),
  coloring_cost bigint NOT NULL DEFAULT 0 CHECK (coloring_cost >= 0),
  labor_cost bigint NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  production_cost bigint NOT NULL DEFAULT 0 CHECK (production_cost >= 0),
  transport_cost bigint NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  total_cost_per_meter bigint NOT NULL DEFAULT 0 CHECK (total_cost_per_meter >= 0),
  selling_price_per_meter bigint NOT NULL DEFAULT 0 CHECK (selling_price_per_meter >= 0),
  price_source text NOT NULL DEFAULT 'manual' CHECK (price_source IN ('invoice', 'manual')),
  notes text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace, product_name)
);

CREATE INDEX IF NOT EXISTS idx_product_hpp_name ON product_hpp(workspace, product_name);

ALTER TABLE product_hpp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "product hpp owner finance" ON product_hpp;
CREATE POLICY "product hpp owner finance" ON product_hpp FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner', 'finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner', 'finance'));

CREATE OR REPLACE FUNCTION set_product_hpp_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_hpp_updated_at ON product_hpp;
CREATE TRIGGER product_hpp_updated_at BEFORE UPDATE ON product_hpp
  FOR EACH ROW EXECUTE FUNCTION set_product_hpp_updated_at();
