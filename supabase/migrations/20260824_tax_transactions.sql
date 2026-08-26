-- Ledger transaksi pajak. Jalankan setelah 20260824_pajak_foundation.sql.
CREATE TABLE IF NOT EXISTS tax_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('cash_flow','invoice','manual')),
  source_id text,
  transaction_date date NOT NULL,
  tax_period text NOT NULL CHECK (tax_period ~ '^\d{4}-\d{2}$'),
  flow_type text NOT NULL CHECK (flow_type IN ('income','expense')),
  category text NOT NULL DEFAULT '', description text NOT NULL DEFAULT '',
  counterparty_name text NOT NULL DEFAULT '', document_number text NOT NULL DEFAULT '',
  tax_code text NOT NULL DEFAULT 'non_tax' CHECK (tax_code IN ('non_tax','ppn','pph21','pph23','pph_final','other')),
  tax_direction text NOT NULL DEFAULT 'none' CHECK (tax_direction IN ('none','output','input','withheld_by_us','withheld_from_us','borne_by_company')),
  gross_amount bigint NOT NULL DEFAULT 0, dpp_amount bigint NOT NULL DEFAULT 0,
  tax_rate numeric(8,6) NOT NULL DEFAULT 0, tax_amount bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reviewed' CHECK (status IN ('reviewed','locked')),
  notes text NOT NULL DEFAULT '', reviewed_by text NOT NULL DEFAULT '', reviewed_at timestamptz NOT NULL DEFAULT now(),
  locked_by text, locked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_tax_transactions_period ON tax_transactions(workspace, tax_period, tax_code);

ALTER TABLE tax_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax transactions owner finance" ON tax_transactions;
CREATE POLICY "tax transactions owner finance" ON tax_transactions FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

CREATE OR REPLACE FUNCTION prevent_locked_tax_transaction_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Transaksi pajak yang sudah dikunci tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS tax_transactions_locked_guard ON tax_transactions;
CREATE TRIGGER tax_transactions_locked_guard BEFORE UPDATE OR DELETE ON tax_transactions
FOR EACH ROW EXECUTE FUNCTION prevent_locked_tax_transaction_change();
