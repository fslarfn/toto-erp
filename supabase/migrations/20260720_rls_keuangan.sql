-- ============================================================
-- 20260720_rls_keuangan.sql
-- Kunci RLS tabel KEUANGAN: cash_flow, bank_accounts, payments.
--
-- Keputusan owner: BACA dibuka untuk semua user login (Dashboard
-- menampilkan saldo ke produksi/barang juga — dipertahankan). TULIS hanya
-- owner/finance (semua tulis berasal dari menu Keuangan; RPC
-- sync_all_balances = SECURITY INVOKER, jalan sebagai pemanggil).
-- Anon (publishable key publik) diblokir total dari data keuangan.
--
-- Jalankan di Supabase → SQL Editor. Pola sama dgn payroll & customers
-- yang sudah terbukti di produksi.
-- ============================================================

-- ---- cash_flow ----------------------------------------------
ALTER TABLE cash_flow ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for cash_flow" ON cash_flow;
CREATE POLICY "cash_flow select authenticated" ON cash_flow
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "cash_flow insert finance" ON cash_flow
  FOR INSERT TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "cash_flow update finance" ON cash_flow
  FOR UPDATE TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "cash_flow delete finance" ON cash_flow
  FOR DELETE TO authenticated
  USING ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ---- bank_accounts ------------------------------------------
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for bank_accounts" ON bank_accounts;
CREATE POLICY "bank_accounts select authenticated" ON bank_accounts
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bank_accounts insert finance" ON bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "bank_accounts update finance" ON bank_accounts
  FOR UPDATE TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "bank_accounts delete finance" ON bank_accounts
  FOR DELETE TO authenticated
  USING ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ---- payments -----------------------------------------------
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for payments" ON payments;
CREATE POLICY "payments select authenticated" ON payments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "payments insert finance" ON payments
  FOR INSERT TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "payments update finance" ON payments
  FOR UPDATE TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );
CREATE POLICY "payments delete finance" ON payments
  FOR DELETE TO authenticated
  USING ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ============================================================
-- ROLLBACK (bila Keuangan/Dashboard/Laporan bermasalah):
--   -- ulang utk tiap tabel: cash_flow, bank_accounts, payments
--   DROP POLICY IF EXISTS "cash_flow select authenticated" ON cash_flow;
--   DROP POLICY IF EXISTS "cash_flow insert finance" ON cash_flow;
--   DROP POLICY IF EXISTS "cash_flow update finance" ON cash_flow;
--   DROP POLICY IF EXISTS "cash_flow delete finance" ON cash_flow;
--   CREATE POLICY "Allow all for cash_flow" ON cash_flow FOR ALL USING (true) WITH CHECK (true);
--   -- (bank_accounts & payments: pola sama)
-- ============================================================
