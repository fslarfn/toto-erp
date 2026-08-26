-- Fondasi modul Akuntansi & Pajak. Aman dijalankan berulang.
CREATE TABLE IF NOT EXISTS tax_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  legal_name text NOT NULL DEFAULT '', npwp text NOT NULL DEFAULT '', nitku text NOT NULL DEFAULT '',
  legal_form text NOT NULL DEFAULT 'CV', business_type text NOT NULL DEFAULT '', address text NOT NULL DEFAULT '',
  pkp_status boolean NOT NULL DEFAULT false, pkp_since date, fiscal_year_start smallint NOT NULL DEFAULT 1,
  tax_regime text NOT NULL DEFAULT 'general', regime_effective_from date, regime_effective_to date,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace)
);

CREATE TABLE IF NOT EXISTS employee_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), karyawan_id bigint NOT NULL REFERENCES karyawan(id) ON DELETE CASCADE,
  nik text NOT NULL DEFAULT '', npwp text NOT NULL DEFAULT '', ptkp_status text NOT NULL DEFAULT 'TK/0'
    CHECK (ptkp_status IN ('TK/0','TK/1','TK/2','TK/3','K/0','K/1','K/2','K/3')),
  tax_method text NOT NULL DEFAULT 'gross' CHECK (tax_method IN ('gross','gross_up','net')),
  effective_from date NOT NULL DEFAULT CURRENT_DATE, effective_to date, is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(karyawan_id, effective_from)
);

CREATE TABLE IF NOT EXISTS payroll_tax_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), karyawan_id bigint NOT NULL REFERENCES karyawan(id) ON DELETE RESTRICT,
  tax_year smallint NOT NULL, tax_month smallint NOT NULL CHECK (tax_month BETWEEN 1 AND 12),
  ptkp_status text NOT NULL, ter_category text NOT NULL, gross_income bigint NOT NULL DEFAULT 0,
  employee_bpjs bigint NOT NULL DEFAULT 0, ter_rate numeric(8,6) NOT NULL DEFAULT 0,
  tax_withheld bigint NOT NULL DEFAULT 0, annual_tax bigint, prior_withholding bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked')),
  calculation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb, locked_at timestamptz, locked_by text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(karyawan_id, tax_year, tax_month)
);

CREATE INDEX IF NOT EXISTS idx_employee_tax_profiles_active ON employee_tax_profiles(karyawan_id, is_active);
CREATE INDEX IF NOT EXISTS idx_payroll_tax_periods_year_month ON payroll_tax_periods(tax_year, tax_month);

CREATE OR REPLACE FUNCTION prevent_locked_payroll_tax_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Masa pajak yang sudah dikunci tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payroll_tax_periods_locked_guard ON payroll_tax_periods;
CREATE TRIGGER payroll_tax_periods_locked_guard
BEFORE UPDATE OR DELETE ON payroll_tax_periods
FOR EACH ROW EXECUTE FUNCTION prevent_locked_payroll_tax_change();

ALTER TABLE tax_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_tax_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax owner finance" ON tax_entities;
CREATE POLICY "tax owner finance" ON tax_entities FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "employee tax owner finance" ON employee_tax_profiles;
CREATE POLICY "employee tax owner finance" ON employee_tax_profiles FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "payroll tax owner finance" ON payroll_tax_periods;
CREATE POLICY "payroll tax owner finance" ON payroll_tax_periods FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
