-- Integrasi idempotent Keuangan -> Jurnal. Jalankan setelah accounting_journal.sql.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='journal_entries_source_unique') THEN
    ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_unique UNIQUE(workspace,source_type,source_id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS accounting_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace text NOT NULL DEFAULT 'toto',
  flow_type text NOT NULL CHECK (flow_type IN ('income','expense')),
  source_category text NOT NULL, account_id uuid NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace,flow_type,source_category)
);
ALTER TABLE accounting_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "account mappings owner finance" ON accounting_mappings;
CREATE POLICY "account mappings owner finance" ON accounting_mappings FOR ALL TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

INSERT INTO accounting_accounts(workspace,code,name,account_type) VALUES
 ('toto','2201','Uang Muka Pelanggan','liability'),('toto','6103','Beban Transportasi','expense'),
 ('toto','6104','Beban Perawatan Mesin','expense')
ON CONFLICT(workspace,code) DO NOTHING;

INSERT INTO accounting_mappings(workspace,flow_type,source_category,account_id)
SELECT 'toto',v.flow_type,v.category,a.id FROM (VALUES
 ('income','Pembayaran Invoice','4101'),('income','DP Invoice','2201'),('income','Penjualan','4101'),('income','Lainnya','7101'),
 ('expense','Bahan Baku','1301'),('expense','Gaji','6101'),('expense','Operasional','6102'),
 ('expense','Transportasi','6103'),('expense','Perawatan Mesin','6104'),('expense','Lainnya','8101')
) AS v(flow_type,category,account_code)
JOIN accounting_accounts a ON a.workspace='toto' AND a.code=v.account_code
ON CONFLICT(workspace,flow_type,source_category) DO NOTHING;
