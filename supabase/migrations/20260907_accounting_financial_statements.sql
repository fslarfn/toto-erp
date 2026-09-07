-- Paket laporan keuangan CV Toto.
-- Menyatukan Keuangan, pesanan terkirim, HPP, tagihan bahan, jurnal, dan tutup buku.
-- Aman dijalankan berulang setelah seluruh migration 20260824-20260907 sebelumnya.

ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type IN ('manual','cash_flow','payroll','tax','hpp','invoice','supplier_bill','adjustment','opening'));

INSERT INTO accounting_accounts(workspace,code,name,account_type) VALUES
 ('toto','1202','Uang Muka dan Piutang Lain','asset'),
 ('toto','1401','Biaya Dibayar di Muka','asset'),
 ('toto','1502','Peralatan dan Mesin','asset'),
 ('toto','1591','Akumulasi Penyusutan','asset'),
 ('toto','2103','Beban yang Masih Harus Dibayar','liability'),
 ('toto','2301','Pinjaman Jangka Panjang','liability'),
 ('toto','3102','Prive Owner','equity'),
 ('toto','3103','Saldo Laba','equity'),
 ('toto','4201','Retur dan Potongan Penjualan','revenue'),
 ('toto','5102','Tenaga Kerja Langsung','expense'),
 ('toto','5103','Biaya Pewarnaan','expense'),
 ('toto','5104','Biaya Produksi Langsung','expense'),
 ('toto','5105','Ongkos Jalan Produksi','expense'),
 ('toto','6105','Beban Listrik dan Utilitas','expense'),
 ('toto','6106','Beban Administrasi dan Kantor','expense'),
 ('toto','6107','Beban Penjualan dan Pemasaran','expense'),
 ('toto','6108','Beban Sewa','expense'),
 ('toto','6109','Beban Penyusutan','expense'),
 ('toto','8201','Beban Pajak Penghasilan','expense')
ON CONFLICT(workspace,code) DO NOTHING;

-- Pembayaran invoice adalah pelunasan piutang, bukan omzet kedua.
INSERT INTO accounting_mappings(workspace,flow_type,source_category,account_id)
SELECT 'toto',v.flow_type,v.category,a.id FROM (VALUES
 ('income','Pembayaran Invoice','1201'),
 ('income','Setoran Modal','3101'),
 ('income','Penerimaan Pinjaman','2301'),
 ('expense','Pembayaran Supplier','2101'),
 ('expense','Prive Owner','3102'),
 ('expense','Pembelian Aset','1501'),
 ('expense','Pembayaran Pajak','2102'),
 ('expense','Cicilan Pinjaman','2301'),
 ('expense','Pewarnaan','5103'),
 ('expense','Ongkos Produksi','5104'),
 ('expense','Ongkos Jalan Produksi','5105'),
 ('expense','Administrasi dan Kantor','6106'),
 ('expense','Penjualan dan Pemasaran','6107'),
 ('expense','Sewa','6108'),
 ('income','Penyesuaian Saldo','3103'),
 ('expense','Penyesuaian Saldo','3103')
) AS v(flow_type,category,account_code)
JOIN accounting_accounts a ON a.workspace='toto' AND a.code=v.account_code
ON CONFLICT(workspace,flow_type,source_category) DO UPDATE SET account_id=EXCLUDED.account_id,updated_at=now();

CREATE TABLE IF NOT EXISTS accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  period text NOT NULL CHECK (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','review','closed')),
  notes text NOT NULL DEFAULT '',
  reviewed_by text NOT NULL DEFAULT '', reviewed_at timestamptz,
  closed_by text NOT NULL DEFAULT '', closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace,period)
);

CREATE TABLE IF NOT EXISTS accounting_source_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace text NOT NULL DEFAULT 'toto',
  source_kind text NOT NULL CHECK (source_kind IN ('sales_revenue','supplier_bill')),
  source_id text NOT NULL, posted_amount bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(workspace,source_kind,source_id)
);

CREATE INDEX IF NOT EXISTS idx_accounting_period_status ON accounting_periods(workspace,status,period);
CREATE INDEX IF NOT EXISTS idx_journal_entries_locked_date ON journal_entries(workspace,entry_date,status);

ALTER TABLE accounting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_source_balances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "accounting periods owner finance" ON accounting_periods;
CREATE POLICY "accounting periods owner finance" ON accounting_periods FOR ALL TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance')) WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "accounting source balances owner finance" ON accounting_source_balances;
CREATE POLICY "accounting source balances owner finance" ON accounting_source_balances FOR SELECT TO authenticated
 USING ((auth.jwt()->>'user_role') IN ('owner','finance'));
GRANT SELECT,INSERT,UPDATE ON accounting_periods TO authenticated;
GRANT SELECT ON accounting_source_balances TO authenticated;

CREATE OR REPLACE FUNCTION guard_closed_accounting_period() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target_date date; target_workspace text; period_status text;
BEGIN
  IF TG_OP='DELETE' THEN target_date:=OLD.entry_date; target_workspace:=OLD.workspace;
  ELSE target_date:=NEW.entry_date; target_workspace:=NEW.workspace; END IF;
  SELECT status INTO period_status FROM accounting_periods
    WHERE workspace=target_workspace AND period=to_char(target_date,'YYYY-MM');
  IF period_status='closed' THEN RAISE EXCEPTION 'Periode % sudah ditutup',to_char(target_date,'YYYY-MM'); END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS journal_closed_period_guard ON journal_entries;
CREATE TRIGGER journal_closed_period_guard BEFORE INSERT OR UPDATE OR DELETE ON journal_entries
 FOR EACH ROW EXECUTE FUNCTION guard_closed_accounting_period();

CREATE OR REPLACE FUNCTION validate_accounting_period_close() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE start_day date; end_day date; problem_count int; should_validate boolean:=false;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF OLD.status='closed' AND NEW.status<>'closed' AND COALESCE(auth.jwt()->>'user_role','')<>'owner' THEN
     RAISE EXCEPTION 'Hanya owner yang dapat membuka kembali periode';
   END IF;
 END IF;
 IF TG_OP='INSERT' THEN should_validate:=NEW.status='closed';
 ELSIF TG_OP='UPDATE' THEN should_validate:=NEW.status='closed' AND OLD.status IS DISTINCT FROM NEW.status;
 END IF;
 IF should_validate THEN
   start_day:=(NEW.period||'-01')::date; end_day:=(start_day+interval '1 month'-interval '1 day')::date;
   SELECT count(*) INTO problem_count FROM journal_entries WHERE workspace=NEW.workspace AND entry_date BETWEEN start_day AND end_day AND status='draft';
   IF problem_count>0 THEN RAISE EXCEPTION 'Masih ada % jurnal draft',problem_count; END IF;
   SELECT count(*) INTO problem_count FROM cash_flow c WHERE c.date BETWEEN start_day::text AND end_day::text
    AND NOT COALESCE(c.is_test,false) AND c.transfer_group IS NULL
    AND NOT EXISTS(SELECT 1 FROM journal_entries j WHERE j.workspace=NEW.workspace AND j.source_type='cash_flow' AND j.source_id=c.id AND j.status='locked');
   IF problem_count>0 THEN RAISE EXCEPTION 'Masih ada % transaksi Keuangan belum masuk jurnal',problem_count; END IF;
   SELECT count(*) INTO problem_count FROM sales_hpp_recognitions WHERE workspace=NEW.workspace AND recognition_date BETWEEN start_day AND end_day AND status IN ('pending_mapping','blocked');
   IF problem_count>0 THEN RAISE EXCEPTION 'Masih ada % HPP barang belum selesai',problem_count; END IF;
 END IF;
 NEW.updated_at:=now(); RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS accounting_period_close_guard ON accounting_periods;
CREATE TRIGGER accounting_period_close_guard BEFORE INSERT OR UPDATE ON accounting_periods
 FOR EACH ROW EXECUTE FUNCTION validate_accounting_period_close();

CREATE OR REPLACE FUNCTION post_accounting_journal(
 p_entry_date date,p_reference text,p_description text,p_source_type text,p_source_id text,p_created_by text,p_lines jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE entry_id uuid; item jsonb; debit_total bigint:=0; credit_total bigint:=0; line_count int:=0;
BEGIN
 IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
 IF p_source_type NOT IN ('manual','cash_flow','payroll','tax','hpp','invoice','supplier_bill','adjustment','opening') THEN RAISE EXCEPTION 'Sumber jurnal tidak valid'; END IF;
 IF jsonb_typeof(p_lines)<>'array' THEN RAISE EXCEPTION 'Baris jurnal tidak valid'; END IF;
 FOR item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   IF COALESCE((item->>'debit')::bigint,0)<0 OR COALESCE((item->>'credit')::bigint,0)<0
      OR (COALESCE((item->>'debit')::bigint,0)>0 AND COALESCE((item->>'credit')::bigint,0)>0)
      OR NOT EXISTS(SELECT 1 FROM accounting_accounts a WHERE a.id=(item->>'account_id')::uuid AND a.workspace='toto' AND a.is_active)
   THEN RAISE EXCEPTION 'Baris jurnal atau akun tidak valid'; END IF;
   debit_total:=debit_total+COALESCE((item->>'debit')::bigint,0);
   credit_total:=credit_total+COALESCE((item->>'credit')::bigint,0); line_count:=line_count+1;
 END LOOP;
 IF line_count<2 OR debit_total<=0 OR debit_total<>credit_total THEN RAISE EXCEPTION 'Jurnal harus seimbang dan minimal dua baris'; END IF;
 INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
 VALUES('toto',p_entry_date,COALESCE(p_reference,''),p_description,p_source_type,NULLIF(p_source_id,''),'draft',COALESCE(p_created_by,''))
 RETURNING id INTO entry_id;
 FOR item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
   INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no)
   VALUES(entry_id,(item->>'account_id')::uuid,COALESCE(item->>'description',''),COALESCE((item->>'debit')::bigint,0),COALESCE((item->>'credit')::bigint,0),(item->>'line_no')::smallint);
 END LOOP;
 UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_created_by,''),locked_at=now() WHERE id=entry_id;
 RETURN entry_id;
END; $$;
REVOKE ALL ON FUNCTION post_accounting_journal(date,text,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION post_accounting_journal(date,text,text,text,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION sync_shipped_sales_revenue(p_pesanan_id bigint,p_username text DEFAULT '')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE order_row pesanan_rows%ROWTYPE; revenue_value bigint; old_value bigint; delta bigint;
 recognition_day date; receivable_id uuid; sales_id uuid; entry_id uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance','barang','finishing') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
 SELECT * INTO order_row FROM pesanan_rows WHERE id=p_pesanan_id;
 IF NOT FOUND OR NOT COALESCE(order_row.di_kirim,false) THEN RETURN 'not_shipped'; END IF;
 revenue_value:=round(parse_erp_numeric(order_row.harga)*parse_erp_numeric(order_row.qty)*parse_erp_numeric(order_row.ukuran))::bigint;
 recognition_day:=COALESCE((order_row.shipped_at AT TIME ZONE 'Asia/Jakarta')::date,(now() AT TIME ZONE 'Asia/Jakarta')::date);
 IF EXISTS(SELECT 1 FROM accounting_periods WHERE workspace='toto' AND period=to_char(recognition_day,'YYYY-MM') AND status='closed') THEN RETURN 'period_closed'; END IF;
 INSERT INTO accounting_source_balances(workspace,source_kind,source_id,posted_amount) VALUES('toto','sales_revenue',p_pesanan_id::text,0)
 ON CONFLICT(workspace,source_kind,source_id) DO NOTHING;
 SELECT posted_amount INTO old_value FROM accounting_source_balances WHERE workspace='toto' AND source_kind='sales_revenue' AND source_id=p_pesanan_id::text FOR UPDATE;
 delta:=revenue_value-old_value; IF delta=0 THEN RETURN 'already_posted'; END IF;
 SELECT id INTO receivable_id FROM accounting_accounts WHERE workspace='toto' AND code='1201' AND is_active;
 SELECT id INTO sales_id FROM accounting_accounts WHERE workspace='toto' AND code='4101' AND is_active;
 INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
 VALUES('toto',recognition_day,'JUAL-KIRIM-'||order_row.id,'Penjualan barang terkirim '||COALESCE(NULLIF(order_row.deskripsi,''),'Pesanan '||order_row.id),
  'invoice','sale-revenue:'||order_row.id||':'||gen_random_uuid(),'draft',COALESCE(p_username,'')) RETURNING id INTO entry_id;
 IF delta>0 THEN
  INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
   (entry_id,receivable_id,'Piutang penjualan barang terkirim',delta,0,1),(entry_id,sales_id,'Pendapatan penjualan barang terkirim',0,delta,2);
 ELSE
  INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
   (entry_id,sales_id,'Koreksi pendapatan barang terkirim',-delta,0,1),(entry_id,receivable_id,'Koreksi piutang barang terkirim',0,-delta,2);
 END IF;
 UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=entry_id;
 UPDATE accounting_source_balances SET posted_amount=revenue_value,updated_at=now() WHERE workspace='toto' AND source_kind='sales_revenue' AND source_id=p_pesanan_id::text;
 RETURN 'posted';
END; $$;

CREATE OR REPLACE FUNCTION trigger_sync_shipped_sales_revenue() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.di_kirim IS TRUE THEN
   IF TG_OP='INSERT' THEN
     PERFORM sync_shipped_sales_revenue(NEW.id,'status_barang');
   ELSIF OLD.di_kirim IS DISTINCT FROM NEW.di_kirim OR OLD.harga IS DISTINCT FROM NEW.harga OR OLD.qty IS DISTINCT FROM NEW.qty OR OLD.ukuran IS DISTINCT FROM NEW.ukuran THEN
     PERFORM sync_shipped_sales_revenue(NEW.id,'status_barang');
   END IF;
 END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS recognize_revenue_when_shipped ON pesanan_rows;
CREATE TRIGGER recognize_revenue_when_shipped AFTER INSERT OR UPDATE OF di_kirim,harga,qty,ukuran ON pesanan_rows
 FOR EACH ROW EXECUTE FUNCTION trigger_sync_shipped_sales_revenue();

CREATE OR REPLACE FUNCTION sync_supplier_bill(p_tagihan_id text,p_username text DEFAULT '')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE bill tagihan_bahan%ROWTYPE; old_value bigint; new_value bigint; delta bigint; bill_day date;
 inventory_id uuid; payable_id uuid; entry_id uuid;
BEGIN
 IF auth.uid() IS NOT NULL AND COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
 SELECT * INTO bill FROM tagihan_bahan WHERE id=p_tagihan_id; IF NOT FOUND THEN RETURN 'not_found'; END IF;
 new_value:=round(GREATEST(COALESCE(bill.grand_total,0),0))::bigint;
 bill_day:=CASE WHEN COALESCE(bill.tanggal::text,'') ~ '^\d{4}-\d{2}-\d{2}' THEN left(bill.tanggal::text,10)::date ELSE CURRENT_DATE END;
 IF EXISTS(SELECT 1 FROM accounting_periods WHERE workspace='toto' AND period=to_char(bill_day,'YYYY-MM') AND status='closed') THEN RETURN 'period_closed'; END IF;
 INSERT INTO accounting_source_balances(workspace,source_kind,source_id,posted_amount) VALUES('toto','supplier_bill',p_tagihan_id,0)
 ON CONFLICT(workspace,source_kind,source_id) DO NOTHING;
 SELECT posted_amount INTO old_value FROM accounting_source_balances WHERE workspace='toto' AND source_kind='supplier_bill' AND source_id=p_tagihan_id FOR UPDATE;
 delta:=new_value-old_value; IF delta=0 THEN RETURN 'already_posted'; END IF;
 SELECT id INTO inventory_id FROM accounting_accounts WHERE workspace='toto' AND code='1301' AND is_active;
 SELECT id INTO payable_id FROM accounting_accounts WHERE workspace='toto' AND code='2101' AND is_active;
 INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
 VALUES('toto',bill_day,COALESCE(NULLIF(bill.no_invoice,''),'TAGIHAN-'||bill.id),'Tagihan bahan '||COALESCE(NULLIF(bill.supplier,''),'Supplier'),
  'supplier_bill','supplier-bill:'||bill.id||':'||gen_random_uuid(),'draft',COALESCE(p_username,'')) RETURNING id INTO entry_id;
 IF delta>0 THEN
  INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
   (entry_id,inventory_id,'Pembelian persediaan dari tagihan bahan',delta,0,1),(entry_id,payable_id,'Utang kepada supplier',0,delta,2);
 ELSE
  INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
   (entry_id,payable_id,'Koreksi utang supplier',-delta,0,1),(entry_id,inventory_id,'Koreksi pembelian persediaan',0,-delta,2);
 END IF;
 UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=entry_id;
 UPDATE accounting_source_balances SET posted_amount=new_value,updated_at=now() WHERE workspace='toto' AND source_kind='supplier_bill' AND source_id=p_tagihan_id;
 RETURN 'posted';
END; $$;

CREATE OR REPLACE FUNCTION trigger_sync_supplier_bill() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' OR EXISTS(SELECT 1 FROM accounting_source_balances WHERE workspace='toto' AND source_kind='supplier_bill' AND source_id=NEW.id::text) THEN
  PERFORM sync_supplier_bill(NEW.id::text,'tagihan_bahan');
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS recognize_supplier_bill ON tagihan_bahan;
CREATE TRIGGER recognize_supplier_bill AFTER INSERT OR UPDATE OF grand_total ON tagihan_bahan
 FOR EACH ROW EXECUTE FUNCTION trigger_sync_supplier_bill();

REVOKE ALL ON FUNCTION sync_shipped_sales_revenue(bigint,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION sync_supplier_bill(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION sync_shipped_sales_revenue(bigint,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_supplier_bill(text,text) TO authenticated;

-- Koreksi satu kali: jurnal penerimaan invoice lama dipindah dari Penjualan ke Piutang.
DO $$ DECLARE rec record; sales_id uuid; receivable_id uuid; entry_id uuid; amount_value bigint;
BEGIN
 SELECT id INTO sales_id FROM accounting_accounts WHERE workspace='toto' AND code='4101';
 SELECT id INTO receivable_id FROM accounting_accounts WHERE workspace='toto' AND code='1201';
 FOR rec IN SELECT j.id,j.entry_date,j.source_id,j.created_by FROM journal_entries j JOIN cash_flow c ON c.id=j.source_id
  WHERE j.workspace='toto' AND j.source_type='cash_flow' AND j.status='locked' AND c.category='Pembayaran Invoice'
  AND NOT EXISTS(SELECT 1 FROM journal_entries x WHERE x.workspace='toto' AND x.source_type='adjustment' AND x.source_id='receipt-reclass:'||j.source_id)
 LOOP
  SELECT COALESCE(sum(l.credit-l.debit),0) INTO amount_value FROM journal_lines l WHERE l.journal_entry_id=rec.id AND l.account_id=sales_id;
  IF amount_value>0 THEN
   INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
   VALUES('toto',rec.entry_date,'REKLAS-'||left(rec.source_id,8),'Reklasifikasi penerimaan invoice ke piutang','adjustment','receipt-reclass:'||rec.source_id,'draft',rec.created_by) RETURNING id INTO entry_id;
   INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
    (entry_id,sales_id,'Membalik omzet berbasis penerimaan kas',amount_value,0,1),(entry_id,receivable_id,'Mengurangi piutang atas pembayaran customer',0,amount_value,2);
   UPDATE journal_entries SET status='locked',locked_by='migration',locked_at=now() WHERE id=entry_id;
  END IF;
 END LOOP;
END $$;

-- Saldo awal kas/bank sebelum transaksi ERP menjadi jurnal pembukaan satu kali.
DO $$ DECLARE rec record; cash_id uuid; capital_id uuid; entry_id uuid; opening_day date;
BEGIN
 SELECT id INTO capital_id FROM accounting_accounts WHERE workspace='toto' AND code='3101';
 FOR rec IN SELECT id,name,round(COALESCE(initial_balance,0))::bigint AS amount FROM bank_accounts WHERE COALESCE(initial_balance,0)<>0 LOOP
  SELECT id INTO cash_id FROM accounting_accounts WHERE workspace='toto' AND code=CASE WHEN rec.name ~* '(cash|kas|dompet)' THEN '1101' ELSE '1102' END;
  SELECT COALESCE(min(CASE WHEN date ~ '^\d{4}-\d{2}-\d{2}' THEN left(date,10)::date END)-1,date '2026-01-01') INTO opening_day FROM cash_flow WHERE account_id=rec.id;
  IF NOT EXISTS(SELECT 1 FROM journal_entries WHERE workspace='toto' AND source_type='opening' AND source_id='opening-bank:'||rec.id) THEN
   INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
   VALUES('toto',opening_day,'SALDO-AWAL','Saldo awal '||rec.name,'opening','opening-bank:'||rec.id,'draft','migration') RETURNING id INTO entry_id;
   IF rec.amount>0 THEN INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES(entry_id,cash_id,'Saldo awal kas/bank',rec.amount,0,1),(entry_id,capital_id,'Modal saldo awal',0,rec.amount,2);
   ELSE INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES(entry_id,capital_id,'Koreksi saldo awal',-rec.amount,0,1),(entry_id,cash_id,'Saldo awal negatif',0,-rec.amount,2); END IF;
   UPDATE journal_entries SET status='locked',locked_by='migration',locked_at=now() WHERE id=entry_id;
  END IF;
 END LOOP;
END $$;

-- Backfill penjualan terkirim lama karena sumbernya dapat ditelusuri pasti ke pesanan.
-- Tagihan supplier lama sengaja tidak dibukukan otomatis: pembayaran historis belum
-- memiliki tagihan_id sehingga auto-pairing berisiko menggandakan persediaan/utang.
DO $$ DECLARE rec record; BEGIN
 FOR rec IN SELECT id FROM pesanan_rows WHERE di_kirim IS TRUE LOOP PERFORM sync_shipped_sales_revenue(rec.id,'migration'); END LOOP;
END $$;
