-- HPP per pesanan CV Toto. Jalankan setelah seluruh migrasi Akuntansi & Pajak.
CREATE TABLE IF NOT EXISTS order_hpp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  pesanan_id bigint NOT NULL,
  order_date date NOT NULL,
  order_reference text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  product_name text NOT NULL DEFAULT '',
  quantity numeric(14,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  selling_price bigint NOT NULL DEFAULT 0 CHECK (selling_price >= 0),
  material_cost bigint NOT NULL DEFAULT 0 CHECK (material_cost >= 0),
  coloring_cost bigint NOT NULL DEFAULT 0 CHECK (coloring_cost >= 0),
  labor_cost bigint NOT NULL DEFAULT 0 CHECK (labor_cost >= 0),
  production_cost bigint NOT NULL DEFAULT 0 CHECK (production_cost >= 0),
  transport_cost bigint NOT NULL DEFAULT 0 CHECK (transport_cost >= 0),
  total_cost bigint NOT NULL DEFAULT 0 CHECK (total_cost >= 0),
  notes text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'posted')),
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT,
  created_by text NOT NULL DEFAULT '',
  posted_by text,
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace, pesanan_id)
);

CREATE TABLE IF NOT EXISTS order_hpp_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hpp_id uuid NOT NULL REFERENCES order_hpp(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  material_id text,
  source_invoice_id text,
  quantity numeric(14,3) NOT NULL CHECK (quantity > 0),
  unit_price bigint NOT NULL CHECK (unit_price >= 0),
  total_cost bigint NOT NULL CHECK (total_cost >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_hpp_period ON order_hpp(workspace, order_date, status);
CREATE INDEX IF NOT EXISTS idx_order_hpp_materials_hpp ON order_hpp_materials(hpp_id);

ALTER TABLE order_hpp ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_hpp_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "order hpp owner finance" ON order_hpp;
CREATE POLICY "order hpp owner finance" ON order_hpp FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner', 'finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner', 'finance'));
DROP POLICY IF EXISTS "order hpp materials owner finance" ON order_hpp_materials;
CREATE POLICY "order hpp materials owner finance" ON order_hpp_materials FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner', 'finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner', 'finance'));

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type IN ('manual', 'cash_flow', 'payroll', 'tax', 'hpp'));

CREATE OR REPLACE FUNCTION guard_posted_order_hpp() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'posted' THEN
    RAISE EXCEPTION 'HPP yang sudah dibukukan tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_hpp_posted_guard ON order_hpp;
CREATE TRIGGER order_hpp_posted_guard BEFORE UPDATE OR DELETE ON order_hpp
  FOR EACH ROW EXECUTE FUNCTION guard_posted_order_hpp();

CREATE OR REPLACE FUNCTION guard_posted_order_hpp_material() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN parent_id = OLD.hpp_id; ELSE parent_id = NEW.hpp_id; END IF;
  IF EXISTS (SELECT 1 FROM order_hpp WHERE id = parent_id AND status = 'posted') THEN
    RAISE EXCEPTION 'Bahan HPP yang sudah dibukukan tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS order_hpp_material_posted_guard ON order_hpp_materials;
CREATE TRIGGER order_hpp_material_posted_guard BEFORE INSERT OR UPDATE OR DELETE ON order_hpp_materials
  FOR EACH ROW EXECUTE FUNCTION guard_posted_order_hpp_material();

CREATE OR REPLACE FUNCTION post_order_hpp(p_hpp_id uuid, p_username text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  h order_hpp%ROWTYPE;
  inventory_id uuid;
  expense_id uuid;
  entry_id uuid;
  actual_material_cost bigint;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role', '') NOT IN ('owner', 'finance') THEN
    RAISE EXCEPTION 'Hanya owner atau finance yang dapat membukukan HPP';
  END IF;

  SELECT * INTO h FROM order_hpp WHERE id = p_hpp_id AND workspace = 'toto' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Data HPP tidak ditemukan'; END IF;
  IF h.status = 'posted' THEN RETURN h.journal_entry_id; END IF;

  IF EXISTS (
    SELECT 1 FROM corporate_tax_returns
    WHERE workspace = h.workspace AND tax_year = EXTRACT(YEAR FROM h.order_date)
      AND status = 'locked'
  ) THEN
    RAISE EXCEPTION 'HPP tidak dapat dibukukan karena tahun pajak sudah terkunci';
  END IF;

  SELECT COALESCE(sum(total_cost), 0) INTO actual_material_cost
    FROM order_hpp_materials WHERE hpp_id = h.id;
  IF actual_material_cost <= 0 OR actual_material_cost <> h.material_cost THEN
    RAISE EXCEPTION 'Nilai bahan HPP tidak cocok atau belum diisi';
  END IF;
  IF h.total_cost <> h.material_cost + h.coloring_cost + h.labor_cost + h.production_cost + h.transport_cost THEN
    RAISE EXCEPTION 'Total komponen HPP tidak seimbang';
  END IF;

  SELECT id INTO inventory_id FROM accounting_accounts
    WHERE workspace = h.workspace AND code = '1301' AND is_active;
  SELECT id INTO expense_id FROM accounting_accounts
    WHERE workspace = h.workspace AND code = '5101' AND is_active;
  IF inventory_id IS NULL OR expense_id IS NULL THEN
    RAISE EXCEPTION 'Akun Persediaan 1301 atau HPP 5101 belum tersedia';
  END IF;

  INSERT INTO journal_entries (
    workspace, entry_date, reference, description, source_type, source_id, status, created_by
  ) VALUES (
    h.workspace, h.order_date, 'HPP-' || h.pesanan_id,
    'Pemakaian bahan ' || COALESCE(NULLIF(h.order_reference, ''), h.product_name),
    'hpp', h.id::text, 'draft', COALESCE(p_username, '')
  ) RETURNING id INTO entry_id;

  INSERT INTO journal_lines (journal_entry_id, account_id, description, debit, credit, line_no)
  VALUES
    (entry_id, expense_id, 'Harga pokok bahan terpakai', actual_material_cost, 0, 1),
    (entry_id, inventory_id, 'Pemakaian persediaan bahan', 0, actual_material_cost, 2);

  UPDATE journal_entries
    SET status = 'locked', locked_by = COALESCE(p_username, ''), locked_at = now()
    WHERE id = entry_id;

  UPDATE order_hpp
    SET status = 'posted', journal_entry_id = entry_id,
      posted_by = COALESCE(p_username, ''), posted_at = now()
    WHERE id = h.id;

  RETURN entry_id;
END;
$$;

REVOKE ALL ON FUNCTION post_order_hpp(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION post_order_hpp(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION post_order_hpp(uuid, text) TO authenticated;
