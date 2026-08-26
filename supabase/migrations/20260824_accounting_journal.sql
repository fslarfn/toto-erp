-- Fondasi akuntansi badan: daftar akun dan jurnal debit-kredit.
CREATE TABLE IF NOT EXISTS accounting_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace text NOT NULL DEFAULT 'toto',
  code text NOT NULL, name text NOT NULL, account_type text NOT NULL
    CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  is_active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace text NOT NULL DEFAULT 'toto',
  entry_date date NOT NULL, reference text NOT NULL DEFAULT '', description text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual','cash_flow','payroll','tax')),
  source_id text, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked')),
  created_by text NOT NULL DEFAULT '', locked_by text, locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '', debit bigint NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit bigint NOT NULL DEFAULT 0 CHECK (credit >= 0), line_no smallint NOT NULL,
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0)),
  UNIQUE(journal_entry_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(workspace, entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);

INSERT INTO accounting_accounts(workspace,code,name,account_type) VALUES
 ('toto','1101','Kas','asset'),('toto','1102','Bank','asset'),('toto','1201','Piutang Usaha','asset'),
 ('toto','1301','Persediaan','asset'),('toto','1501','Aset Tetap','asset'),('toto','2101','Utang Usaha','liability'),
 ('toto','2102','Utang Pajak','liability'),('toto','3101','Modal','equity'),('toto','4101','Penjualan','revenue'),
 ('toto','5101','Harga Pokok Penjualan','expense'),('toto','6101','Beban Gaji','expense'),
 ('toto','6102','Beban Operasional','expense'),('toto','7101','Pendapatan Lain','revenue'),('toto','8101','Beban Lain','expense')
ON CONFLICT(workspace,code) DO NOTHING;

ALTER TABLE accounting_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounts owner finance" ON accounting_accounts;
CREATE POLICY "accounts owner finance" ON accounting_accounts FOR ALL TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "journals owner finance" ON journal_entries;
CREATE POLICY "journals owner finance" ON journal_entries FOR ALL TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "journal lines owner finance" ON journal_lines;
CREATE POLICY "journal lines owner finance" ON journal_lines FOR ALL TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

CREATE OR REPLACE FUNCTION guard_locked_journal_entry() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_debit bigint; total_credit bigint; line_count int;
BEGIN
  IF OLD.status = 'locked' THEN RAISE EXCEPTION 'Jurnal terkunci tidak dapat diubah atau dihapus'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  IF NEW.status = 'locked' THEN
    SELECT COALESCE(sum(debit),0),COALESCE(sum(credit),0),count(*) INTO total_debit,total_credit,line_count
      FROM journal_lines WHERE journal_entry_id=OLD.id;
    IF line_count < 2 OR total_debit <= 0 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'Jurnal tidak seimbang atau kurang dari dua baris';
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS journal_entry_locked_guard ON journal_entries;
CREATE TRIGGER journal_entry_locked_guard BEFORE UPDATE OR DELETE ON journal_entries
 FOR EACH ROW EXECUTE FUNCTION guard_locked_journal_entry();

CREATE OR REPLACE FUNCTION guard_locked_journal_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_status text;
BEGIN
  SELECT status INTO parent_status FROM journal_entries WHERE id=COALESCE(NEW.journal_entry_id,OLD.journal_entry_id);
  IF parent_status='locked' THEN RAISE EXCEPTION 'Baris jurnal terkunci tidak dapat diubah atau dihapus'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS journal_line_locked_guard ON journal_lines;
CREATE TRIGGER journal_line_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON journal_lines
 FOR EACH ROW EXECUTE FUNCTION guard_locked_journal_line();
