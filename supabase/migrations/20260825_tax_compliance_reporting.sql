-- Checklist pembayaran/pelaporan pajak. Semua tanggal dapat diubah oleh finance.
CREATE TABLE IF NOT EXISTS tax_compliance_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace text NOT NULL DEFAULT 'toto',
 tax_period text NOT NULL CHECK(tax_period ~ '^\d{4}-\d{2}$'),
 tax_code text NOT NULL CHECK(tax_code IN('pph21','pph23','ppn','pph_badan')),
 amount bigint NOT NULL DEFAULT 0,payment_due_date date,filing_due_date date,
 payment_status text NOT NULL DEFAULT 'pending' CHECK(payment_status IN('pending','paid','not_applicable')),
 filing_status text NOT NULL DEFAULT 'pending' CHECK(filing_status IN('pending','filed','not_applicable')),
 payment_reference text NOT NULL DEFAULT '',filing_reference text NOT NULL DEFAULT '',notes text NOT NULL DEFAULT '',
 paid_at timestamptz,filed_at timestamptz,updated_by text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace,tax_period,tax_code)
);
CREATE INDEX IF NOT EXISTS idx_tax_compliance_period ON tax_compliance_items(workspace,tax_period);
ALTER TABLE tax_compliance_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tax compliance owner finance" ON tax_compliance_items;
CREATE POLICY "tax compliance owner finance" ON tax_compliance_items FOR ALL TO authenticated
 USING((auth.jwt()->>'user_role') IN('owner','finance')) WITH CHECK((auth.jwt()->>'user_role') IN('owner','finance'));
