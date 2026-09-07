-- Workspace pekerjaan admin akuntansi.
-- Menyimpan kebijakan akuntansi dan status pekerjaan tanpa menggandakan transaksi Keuangan.

CREATE TABLE IF NOT EXISTS accounting_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  reporting_standard text NOT NULL DEFAULT 'SAK_EP'
    CHECK (reporting_standard IN ('SAK_EP', 'SAK_EMKM', 'SAK_INDONESIA')),
  accounting_basis text NOT NULL DEFAULT 'accrual'
    CHECK (accounting_basis IN ('accrual')),
  functional_currency text NOT NULL DEFAULT 'IDR',
  fiscal_year_start_month smallint NOT NULL DEFAULT 1
    CHECK (fiscal_year_start_month BETWEEN 1 AND 12),
  inventory_method text NOT NULL DEFAULT ''
    CHECK (inventory_method IN ('', 'fifo', 'weighted_average')),
  depreciation_method text NOT NULL DEFAULT ''
    CHECK (depreciation_method IN ('', 'straight_line', 'declining_balance')),
  consultant_approved boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace)
);

CREATE TABLE IF NOT EXISTS accounting_work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  work_period text NOT NULL CHECK (work_period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  task_key text NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('daily', 'weekly', 'monthly')),
  category text NOT NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'todo'
    CHECK (status IN ('todo', 'in_progress', 'waiting_review', 'done')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'high')),
  assigned_to text NOT NULL DEFAULT '',
  due_date date,
  document_reference text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  completed_by text NOT NULL DEFAULT '',
  completed_at timestamptz,
  reviewed_by text NOT NULL DEFAULT '',
  reviewed_at timestamptz,
  updated_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace, work_period, task_key)
);

CREATE INDEX IF NOT EXISTS idx_accounting_work_items_period_status
  ON accounting_work_items(workspace, work_period, status);

ALTER TABLE accounting_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_work_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting policies owner finance" ON accounting_policies;
CREATE POLICY "accounting policies owner finance" ON accounting_policies FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

DROP POLICY IF EXISTS "accounting work owner finance" ON accounting_work_items;
CREATE POLICY "accounting work owner finance" ON accounting_work_items FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

GRANT SELECT, INSERT, UPDATE ON accounting_policies TO authenticated;
GRANT SELECT, INSERT, UPDATE ON accounting_work_items TO authenticated;
