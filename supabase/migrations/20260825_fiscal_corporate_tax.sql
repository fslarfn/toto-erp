-- Rekonsiliasi fiskal dan kertas kerja PPh Badan.
CREATE TABLE IF NOT EXISTS fiscal_adjustments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace text NOT NULL DEFAULT 'toto',tax_year smallint NOT NULL,
 direction text NOT NULL CHECK(direction IN ('positive','negative')),category text NOT NULL DEFAULT '',
 description text NOT NULL,amount bigint NOT NULL CHECK(amount>0),legal_basis text NOT NULL DEFAULT '',
 is_temporary boolean NOT NULL DEFAULT false,created_by text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fiscal_adjustments_year ON fiscal_adjustments(workspace,tax_year,direction);

CREATE TABLE IF NOT EXISTS corporate_tax_returns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace text NOT NULL DEFAULT 'toto',tax_year smallint NOT NULL,
 turnover bigint NOT NULL DEFAULT 0,commercial_profit bigint NOT NULL DEFAULT 0,
 positive_corrections bigint NOT NULL DEFAULT 0,negative_corrections bigint NOT NULL DEFAULT 0,
 taxable_income bigint NOT NULL DEFAULT 0,facility_taxable_income bigint NOT NULL DEFAULT 0,
 standard_taxable_income bigint NOT NULL DEFAULT 0,tax_due bigint NOT NULL DEFAULT 0,
 credit_pph22 bigint NOT NULL DEFAULT 0,credit_pph23 bigint NOT NULL DEFAULT 0,
 credit_pph25 bigint NOT NULL DEFAULT 0,credit_other bigint NOT NULL DEFAULT 0,
 tax_balance bigint NOT NULL DEFAULT 0,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','locked')),
 calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,created_by text NOT NULL DEFAULT '',
 locked_by text,locked_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace,tax_year)
);

ALTER TABLE fiscal_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_tax_returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fiscal adjustments owner finance" ON fiscal_adjustments;
CREATE POLICY "fiscal adjustments owner finance" ON fiscal_adjustments FOR ALL TO authenticated
 USING((auth.jwt()->>'user_role') IN('owner','finance')) WITH CHECK((auth.jwt()->>'user_role') IN('owner','finance'));
DROP POLICY IF EXISTS "corporate tax owner finance" ON corporate_tax_returns;
CREATE POLICY "corporate tax owner finance" ON corporate_tax_returns FOR ALL TO authenticated
 USING((auth.jwt()->>'user_role') IN('owner','finance')) WITH CHECK((auth.jwt()->>'user_role') IN('owner','finance'));

CREATE OR REPLACE FUNCTION guard_locked_corporate_tax() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.status='locked' THEN RAISE EXCEPTION 'Kertas kerja pajak badan yang terkunci tidak dapat diubah atau dihapus';END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS corporate_tax_locked_guard ON corporate_tax_returns;
CREATE TRIGGER corporate_tax_locked_guard BEFORE UPDATE OR DELETE ON corporate_tax_returns
 FOR EACH ROW EXECUTE FUNCTION guard_locked_corporate_tax();

CREATE OR REPLACE FUNCTION guard_fiscal_adjustment_locked_year() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE record_year smallint;record_workspace text;
BEGIN
 IF TG_OP='DELETE' THEN record_year=OLD.tax_year;record_workspace=OLD.workspace;
 ELSE record_year=NEW.tax_year;record_workspace=NEW.workspace;END IF;
 IF EXISTS(SELECT 1 FROM corporate_tax_returns WHERE workspace=record_workspace AND tax_year=record_year AND status='locked') THEN
  RAISE EXCEPTION 'Koreksi fiskal tidak dapat diubah karena tahun pajak telah dikunci';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS fiscal_adjustment_year_guard ON fiscal_adjustments;
CREATE TRIGGER fiscal_adjustment_year_guard BEFORE INSERT OR UPDATE OR DELETE ON fiscal_adjustments
 FOR EACH ROW EXECUTE FUNCTION guard_fiscal_adjustment_locked_year();
