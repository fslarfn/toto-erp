-- Rekonsiliasi pembayaran customer berbasis mutasi Keuangan.
-- Jalankan setelah 20260907_accounting_financial_statements.sql.

INSERT INTO accounting_accounts(workspace,code,name,account_type) VALUES
  ('toto','2202','Penerimaan Customer Belum Dialokasikan','liability')
ON CONFLICT(workspace,code) DO NOTHING;

INSERT INTO accounting_mappings(workspace,flow_type,source_category,account_id)
SELECT 'toto','income','Penerimaan Belum Teridentifikasi',a.id
FROM accounting_accounts a WHERE a.workspace='toto' AND a.code='2202'
ON CONFLICT(workspace,flow_type,source_category)
DO UPDATE SET account_id=EXCLUDED.account_id,updated_at=now();

CREATE TABLE IF NOT EXISTS customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  cash_flow_id text NOT NULL,
  receipt_date date NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  bank_account_name text NOT NULL DEFAULT '',
  payer_name text NOT NULL DEFAULT '',
  bank_reference text NOT NULL DEFAULT '',
  bank_description text NOT NULL DEFAULT '',
  source_account_id uuid REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  normalization_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'unidentified'
    CHECK (status IN ('unidentified','partially_applied','applied')),
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace,cash_flow_id)
);

ALTER TABLE customer_receipts ADD COLUMN IF NOT EXISTS source_account_id uuid REFERENCES accounting_accounts(id) ON DELETE RESTRICT;
ALTER TABLE customer_receipts ADD COLUMN IF NOT EXISTS normalization_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS customer_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  receipt_id uuid NOT NULL REFERENCES customer_receipts(id) ON DELETE RESTRICT,
  invoice_key text NOT NULL,
  invoice_number text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  amount bigint NOT NULL CHECK (amount > 0),
  source_account_id uuid REFERENCES accounting_accounts(id) ON DELETE RESTRICT,
  reclassification_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT,
  allocated_by text NOT NULL DEFAULT '',
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(receipt_id,invoice_key)
);

CREATE INDEX IF NOT EXISTS idx_customer_receipts_date_status
  ON customer_receipts(workspace,receipt_date DESC,status);
CREATE INDEX IF NOT EXISTS idx_customer_receipt_allocations_invoice
  ON customer_receipt_allocations(workspace,invoice_key);
CREATE INDEX IF NOT EXISTS idx_customer_receipt_allocations_receipt
  ON customer_receipt_allocations(receipt_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_customer_receipt_queue
  ON cash_flow(date DESC) WHERE type='income' AND NOT COALESCE(is_test,false) AND transfer_group IS NULL;
CREATE INDEX IF NOT EXISTS idx_pesanan_rows_invoice_key
  ON pesanan_rows(upper(btrim(COALESCE(no_inv,'')))) WHERE NOT COALESCE(is_paid,false);

ALTER TABLE customer_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_receipt_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer receipts owner finance read" ON customer_receipts;
CREATE POLICY "customer receipts owner finance read" ON customer_receipts FOR SELECT TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "customer allocations owner finance read" ON customer_receipt_allocations;
CREATE POLICY "customer allocations owner finance read" ON customer_receipt_allocations FOR SELECT TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'));

GRANT SELECT ON customer_receipts,customer_receipt_allocations TO authenticated;

CREATE OR REPLACE FUNCTION canonical_customer_invoice_key(p_invoice text,p_row_id bigint DEFAULT NULL)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN NULLIF(btrim(COALESCE(p_invoice,'')),'') IS NOT NULL
    THEN 'INV:'||upper(btrim(p_invoice))
    ELSE 'ROW:'||COALESCE(p_row_id::text,'') END
$$;

CREATE OR REPLACE FUNCTION refresh_customer_receipt_status(p_receipt_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt_amount bigint; applied_amount bigint;
BEGIN
  SELECT amount INTO receipt_amount FROM customer_receipts WHERE id=p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(sum(amount),0) INTO applied_amount
    FROM customer_receipt_allocations WHERE receipt_id=p_receipt_id;
  UPDATE customer_receipts SET
    status=CASE WHEN applied_amount<=0 THEN 'unidentified'
                WHEN applied_amount<receipt_amount THEN 'partially_applied'
                ELSE 'applied' END,
    updated_at=now()
  WHERE id=p_receipt_id;
END; $$;

CREATE OR REPLACE FUNCTION load_open_customer_invoices()
RETURNS TABLE(
  invoice_key text,invoice_number text,customer_name text,invoice_date text,
  total_amount bigint,allocated_amount bigint,outstanding_amount bigint
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  RETURN QUERY
  WITH invoice_rows AS (
    SELECT
      canonical_customer_invoice_key(p.no_inv,p.id) AS key_value,
      max(COALESCE(p.no_inv,'')) AS number_value,
      max(COALESCE(p.customer,'')) AS customer_value,
      min(COALESCE(p.tanggal::text,'')) AS date_value,
      round(COALESCE(sum(
        fn_parse_id_num(p.harga)*fn_parse_id_num(p.qty)*fn_parse_id_num(p.ukuran)
      ),0))::bigint AS total_value
    FROM pesanan_rows p
    WHERE NULLIF(btrim(COALESCE(p.customer,'')),'') IS NOT NULL AND NOT COALESCE(p.is_paid,false)
    GROUP BY canonical_customer_invoice_key(p.no_inv,p.id)
  ), allocation_totals AS (
    SELECT a.invoice_key AS key_value,COALESCE(sum(a.amount),0)::bigint AS allocated_value
    FROM customer_receipt_allocations a WHERE a.workspace='toto' GROUP BY a.invoice_key
  )
  SELECT i.key_value,i.number_value,i.customer_value,i.date_value,i.total_value,
    COALESCE(a.allocated_value,0)::bigint,
    GREATEST(i.total_value-COALESCE(a.allocated_value,0),0)::bigint
  FROM invoice_rows i LEFT JOIN allocation_totals a ON a.key_value=i.key_value
  WHERE i.total_value>COALESCE(a.allocated_value,0)
  ORDER BY i.date_value,i.number_value;
END; $$;

CREATE OR REPLACE FUNCTION refresh_customer_invoice_paid_status(p_invoice_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invoice_total bigint:=0; allocated_total bigint:=0; row_id bigint; invoice_value text;
BEGIN
  IF p_invoice_key LIKE 'INV:%' THEN
    invoice_value:=substr(p_invoice_key,5);
    SELECT round(COALESCE(sum(
      fn_parse_id_num(harga)*fn_parse_id_num(qty)*fn_parse_id_num(ukuran)
    ),0))::bigint INTO invoice_total
    FROM pesanan_rows WHERE upper(btrim(COALESCE(no_inv,'')))=invoice_value;
  ELSIF p_invoice_key LIKE 'ROW:%' AND substr(p_invoice_key,5) ~ '^\d+$' THEN
    row_id:=substr(p_invoice_key,5)::bigint;
    SELECT round(COALESCE(
      fn_parse_id_num(harga)*fn_parse_id_num(qty)*fn_parse_id_num(ukuran),0
    ))::bigint INTO invoice_total FROM pesanan_rows WHERE id=row_id;
  ELSE
    RAISE EXCEPTION 'Kunci invoice tidak valid';
  END IF;

  SELECT COALESCE(sum(amount),0) INTO allocated_total
    FROM customer_receipt_allocations
    WHERE workspace='toto' AND invoice_key=p_invoice_key;

  PERFORM set_config('app.payment_reconciliation_sync','on',true);
  IF p_invoice_key LIKE 'INV:%' THEN
    UPDATE pesanan_rows SET is_paid=(invoice_total>0 AND allocated_total>=invoice_total)
    WHERE upper(btrim(COALESCE(no_inv,'')))=invoice_value;
  ELSE
    UPDATE pesanan_rows SET is_paid=(invoice_total>0 AND allocated_total>=invoice_total)
    WHERE id=row_id;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION guard_manual_invoice_paid_status()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF NEW.is_paid IS DISTINCT FROM OLD.is_paid
    AND COALESCE(current_setting('app.payment_reconciliation_sync',true),'')<>'on' THEN
    RAISE EXCEPTION 'Status pembayaran dikelola melalui Rekonsiliasi Pembayaran';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS protect_invoice_paid_status ON pesanan_rows;
CREATE TRIGGER protect_invoice_paid_status BEFORE UPDATE OF is_paid ON pesanan_rows
  FOR EACH ROW EXECUTE FUNCTION guard_manual_invoice_paid_status();

CREATE OR REPLACE FUNCTION register_customer_receipt(
  p_cash_flow_id text,p_payer_name text DEFAULT '',p_bank_reference text DEFAULT '',p_username text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE flow_row record; receipt_id uuid;
  source_account uuid; receivable_account uuid; clearing_account uuid; normalization_entry uuid;
  flow_category text; journal_day date;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT id::text AS id,type,amount,description,date,bank_account,is_test,transfer_group
  INTO flow_row FROM cash_flow WHERE id::text=p_cash_flow_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mutasi Keuangan tidak ditemukan'; END IF;
  IF flow_row.type<>'income' OR COALESCE(flow_row.is_test,false) OR flow_row.transfer_group IS NOT NULL OR COALESCE(flow_row.amount,0)<=0 THEN
    RAISE EXCEPTION 'Hanya pemasukan riil non-transfer yang dapat direkonsiliasi';
  END IF;
  SELECT id INTO receivable_account FROM accounting_accounts WHERE workspace='toto' AND code='1201' AND is_active;
  SELECT id INTO clearing_account FROM accounting_accounts WHERE workspace='toto' AND code='2202' AND is_active;
  IF EXISTS(SELECT 1 FROM journal_entries j WHERE j.workspace='toto' AND j.source_type='adjustment'
    AND j.source_id='receipt-reclass:'||flow_row.id AND j.status='locked') THEN
    source_account:=receivable_account;
  ELSE
    SELECT jl.account_id INTO source_account
    FROM journal_entries j JOIN journal_lines jl ON jl.journal_entry_id=j.id
    JOIN accounting_accounts a ON a.id=jl.account_id
    WHERE j.workspace='toto' AND j.source_type='cash_flow' AND j.source_id=flow_row.id
      AND j.status='locked' AND jl.credit>0 AND a.code NOT IN ('1101','1102')
    ORDER BY jl.credit DESC LIMIT 1;
  END IF;
  IF source_account IS NULL THEN
    SELECT category INTO flow_category FROM cash_flow WHERE id::text=flow_row.id;
    SELECT m.account_id INTO source_account FROM accounting_mappings m
    WHERE m.workspace='toto' AND m.flow_type='income' AND m.source_category=flow_category;
  END IF;
  IF source_account IS NULL OR clearing_account IS NULL OR receivable_account IS NULL THEN
    RAISE EXCEPTION 'Mapping akun penerimaan belum lengkap';
  END IF;
  INSERT INTO customer_receipts(
    workspace,cash_flow_id,receipt_date,amount,bank_account_name,payer_name,bank_reference,bank_description,source_account_id,created_by
  ) VALUES (
    'toto',flow_row.id,left(flow_row.date::text,10)::date,round(flow_row.amount)::bigint,
    COALESCE(flow_row.bank_account,''),COALESCE(p_payer_name,''),COALESCE(p_bank_reference,''),
    COALESCE(flow_row.description,''),source_account,COALESCE(p_username,'')
  ) ON CONFLICT(workspace,cash_flow_id) DO UPDATE SET
    payer_name=CASE WHEN EXCLUDED.payer_name<>'' THEN EXCLUDED.payer_name ELSE customer_receipts.payer_name END,
    bank_reference=CASE WHEN EXCLUDED.bank_reference<>'' THEN EXCLUDED.bank_reference ELSE customer_receipts.bank_reference END,
    source_account_id=COALESCE(customer_receipts.source_account_id,EXCLUDED.source_account_id),
    updated_at=now()
  RETURNING id INTO receipt_id;
  IF source_account<>clearing_account AND NOT EXISTS(
    SELECT 1 FROM customer_receipts WHERE id=receipt_id AND normalization_entry_id IS NOT NULL
  ) THEN
    journal_day:=left(flow_row.date::text,10)::date;
    IF EXISTS(SELECT 1 FROM accounting_periods WHERE workspace='toto' AND period=to_char(journal_day,'YYYY-MM') AND status='closed') THEN
      journal_day=(now() AT TIME ZONE 'Asia/Jakarta')::date;
    END IF;
    INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
    VALUES('toto',journal_day,'TERIMA-'||left(receipt_id::text,8),'Penerimaan customer menunggu alokasi invoice',
      'adjustment','receipt-normalize:'||receipt_id,'draft',COALESCE(p_username,'')) RETURNING id INTO normalization_entry;
    INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
      (normalization_entry,source_account,'Memindahkan klasifikasi penerimaan awal',round(flow_row.amount)::bigint,0,1),
      (normalization_entry,clearing_account,'Penerimaan belum dialokasikan',0,round(flow_row.amount)::bigint,2);
    UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=normalization_entry;
    UPDATE customer_receipts SET normalization_entry_id=normalization_entry WHERE id=receipt_id;
  END IF;
  RETURN receipt_id;
END; $$;

CREATE OR REPLACE FUNCTION allocate_customer_receipt(
  p_receipt_id uuid,p_invoice_key text,p_invoice_number text,p_customer_name text,p_amount bigint,p_username text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt_row customer_receipts%ROWTYPE; already_applied bigint; invoice_total bigint; invoice_applied bigint;
  source_account uuid; receivable_account uuid; entry_id uuid; allocation_id uuid; allocation_day date;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  IF p_amount<=0 THEN RAISE EXCEPTION 'Nominal alokasi harus lebih dari nol'; END IF;
  SELECT * INTO receipt_row FROM customer_receipts WHERE id=p_receipt_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Penerimaan tidak ditemukan'; END IF;
  SELECT COALESCE(sum(amount),0) INTO already_applied FROM customer_receipt_allocations WHERE receipt_id=p_receipt_id;
  IF already_applied+p_amount>receipt_row.amount THEN RAISE EXCEPTION 'Alokasi melebihi sisa penerimaan'; END IF;

  IF p_invoice_key LIKE 'INV:%' THEN
    SELECT round(COALESCE(sum(fn_parse_id_num(harga)*fn_parse_id_num(qty)*fn_parse_id_num(ukuran)),0))::bigint
    INTO invoice_total FROM pesanan_rows WHERE upper(btrim(COALESCE(no_inv,'')))=substr(p_invoice_key,5);
  ELSIF p_invoice_key LIKE 'ROW:%' AND substr(p_invoice_key,5) ~ '^\d+$' THEN
    SELECT round(COALESCE(fn_parse_id_num(harga)*fn_parse_id_num(qty)*fn_parse_id_num(ukuran),0))::bigint
    INTO invoice_total FROM pesanan_rows WHERE id=substr(p_invoice_key,5)::bigint;
  ELSE RAISE EXCEPTION 'Kunci invoice tidak valid'; END IF;
  IF COALESCE(invoice_total,0)<=0 THEN RAISE EXCEPTION 'Invoice tidak ditemukan atau nilainya nol'; END IF;
  SELECT COALESCE(sum(amount),0) INTO invoice_applied FROM customer_receipt_allocations WHERE workspace='toto' AND invoice_key=p_invoice_key;
  IF invoice_applied+p_amount>invoice_total THEN RAISE EXCEPTION 'Alokasi melebihi sisa tagihan invoice'; END IF;

  SELECT a.id INTO receivable_account FROM accounting_accounts a
  WHERE a.workspace='toto' AND a.code='1201' AND a.is_active;
  SELECT a.id INTO source_account FROM accounting_accounts a
  WHERE a.workspace='toto' AND a.code='2202' AND a.is_active;
  IF source_account IS NULL OR receivable_account IS NULL THEN RAISE EXCEPTION 'Mapping akun penerimaan belum lengkap'; END IF;

  INSERT INTO customer_receipt_allocations(
    workspace,receipt_id,invoice_key,invoice_number,customer_name,amount,source_account_id,allocated_by
  ) VALUES ('toto',p_receipt_id,p_invoice_key,COALESCE(p_invoice_number,''),COALESCE(p_customer_name,''),p_amount,source_account,COALESCE(p_username,''))
  RETURNING id INTO allocation_id;

  IF source_account<>receivable_account THEN
    allocation_day:=receipt_row.receipt_date;
    IF EXISTS(SELECT 1 FROM accounting_periods WHERE workspace='toto' AND period=to_char(allocation_day,'YYYY-MM') AND status='closed') THEN
      allocation_day=(now() AT TIME ZONE 'Asia/Jakarta')::date;
    END IF;
    INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
    VALUES('toto',allocation_day,'ALOK-'||left(allocation_id::text,8),
      'Alokasi penerimaan ke invoice '||COALESCE(NULLIF(p_invoice_number,''),p_invoice_key),
      'adjustment','receipt-allocation:'||allocation_id,'draft',COALESCE(p_username,'')) RETURNING id INTO entry_id;
    INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
      (entry_id,source_account,'Reklasifikasi sumber penerimaan',p_amount,0,1),
      (entry_id,receivable_account,'Pelunasan piutang customer',0,p_amount,2);
    UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=entry_id;
    UPDATE customer_receipt_allocations SET reclassification_entry_id=entry_id WHERE id=allocation_id;
  END IF;

  PERFORM refresh_customer_receipt_status(p_receipt_id);
  PERFORM refresh_customer_invoice_paid_status(p_invoice_key);
  RETURN allocation_id;
END; $$;

CREATE OR REPLACE FUNCTION remove_customer_receipt_allocation(p_allocation_id uuid,p_username text DEFAULT '')
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE allocation_row customer_receipt_allocations%ROWTYPE; receipt_row customer_receipts%ROWTYPE;
  receivable_account uuid; reversal_entry uuid; reversal_day date;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT * INTO allocation_row FROM customer_receipt_allocations WHERE id=p_allocation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Alokasi tidak ditemukan'; END IF;
  SELECT * INTO receipt_row FROM customer_receipts WHERE id=allocation_row.receipt_id;
  SELECT id INTO receivable_account FROM accounting_accounts WHERE workspace='toto' AND code='1201' AND is_active;
  reversal_day:=receipt_row.receipt_date;
  IF EXISTS(SELECT 1 FROM accounting_periods WHERE workspace='toto' AND period=to_char(reversal_day,'YYYY-MM') AND status='closed') THEN
    reversal_day=(now() AT TIME ZONE 'Asia/Jakarta')::date;
  END IF;
  IF allocation_row.reclassification_entry_id IS NOT NULL AND allocation_row.source_account_id<>receivable_account THEN
    INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
    VALUES('toto',reversal_day,'BATAL-'||left(allocation_row.id::text,8),
      'Pembatalan alokasi invoice '||COALESCE(NULLIF(allocation_row.invoice_number,''),allocation_row.invoice_key),
      'adjustment','receipt-unallocation:'||allocation_row.id,'draft',COALESCE(p_username,'')) RETURNING id INTO reversal_entry;
    INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
      (reversal_entry,receivable_account,'Mengembalikan saldo piutang',allocation_row.amount,0,1),
      (reversal_entry,allocation_row.source_account_id,'Mengembalikan sumber penerimaan',0,allocation_row.amount,2);
    UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=reversal_entry;
  END IF;
  DELETE FROM customer_receipt_allocations WHERE id=p_allocation_id;
  PERFORM refresh_customer_receipt_status(allocation_row.receipt_id);
  PERFORM refresh_customer_invoice_paid_status(allocation_row.invoice_key);
END; $$;

CREATE OR REPLACE FUNCTION guard_reconciled_cash_flow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE receipt_row customer_receipts%ROWTYPE;
BEGIN
  SELECT * INTO receipt_row FROM customer_receipts
  WHERE workspace='toto' AND cash_flow_id=OLD.id::text FOR UPDATE;
  IF NOT FOUND THEN
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Mutasi sudah masuk rekonsiliasi dan tidak dapat dihapus'; END IF;
  IF (
    NEW.type IS DISTINCT FROM OLD.type OR NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.date IS DISTINCT FROM OLD.date OR NEW.category IS DISTINCT FROM OLD.category OR
    NEW.bank_account IS DISTINCT FROM OLD.bank_account OR NEW.account_id IS DISTINCT FROM OLD.account_id OR
    NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.transfer_group IS DISTINCT FROM OLD.transfer_group
  ) THEN RAISE EXCEPTION 'Mutasi sudah masuk rekonsiliasi. Data utama tidak dapat diubah'; END IF;
  UPDATE customer_receipts SET receipt_date=left(NEW.date::text,10)::date,
    amount=round(NEW.amount)::bigint,bank_account_name=COALESCE(NEW.bank_account,''),
    bank_description=COALESCE(NEW.description,''),updated_at=now()
  WHERE id=receipt_row.id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS protect_reconciled_cash_flow ON cash_flow;
CREATE TRIGGER protect_reconciled_cash_flow BEFORE UPDATE OR DELETE ON cash_flow
  FOR EACH ROW EXECUTE FUNCTION guard_reconciled_cash_flow();

REVOKE ALL ON FUNCTION register_customer_receipt(text,text,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION allocate_customer_receipt(uuid,text,text,text,bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION remove_customer_receipt_allocation(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION load_open_customer_invoices() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION refresh_customer_receipt_status(uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION refresh_customer_invoice_paid_status(text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION guard_reconciled_cash_flow() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION guard_manual_invoice_paid_status() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION register_customer_receipt(text,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION allocate_customer_receipt(uuid,text,text,text,bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_customer_receipt_allocation(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION load_open_customer_invoices() TO authenticated;
