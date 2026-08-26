-- Checklist tutup buku bersama untuk admin finance dan konsultan pajak.

CREATE TABLE IF NOT EXISTS tax_monthly_closing_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  tax_period text NOT NULL CHECK (tax_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  task_key text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_by text NOT NULL DEFAULT '',
  completed_at timestamptz,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace, tax_period, task_key)
);

ALTER TABLE tax_monthly_closing_checklists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax checklist owner finance" ON tax_monthly_closing_checklists;
CREATE POLICY "tax checklist owner finance" ON tax_monthly_closing_checklists FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

GRANT SELECT, INSERT, UPDATE ON tax_monthly_closing_checklists TO authenticated;
