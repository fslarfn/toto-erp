-- ============================================================
-- 20260720_rls_customers.sql
-- Kunci RLS tabel customers (PII: nama, telepon, alamat 2.200+ pelanggan).
--
-- Sebelum: "Allow all" → anon (publishable key publik) bisa scrape seluruh
-- PII pelanggan tanpa login.
--
-- Sesudah:
--   - BACA: semua user yang login (role authenticated). Nama pelanggan
--     tampil di Dashboard, Tagihan, Penawaran, Surat Jalan, CRM — dipakai
--     banyak peran, jadi baca dibuka untuk semua yang login. Anon diblokir.
--   - TULIS (insert/update/delete): hanya pengelola CRM
--     (owner/finance/sales). Semua tulis customers berasal dari menu CRM.
--
-- Jalankan di Supabase → SQL Editor. Migrasi RLS payroll (20260720) sudah
-- membuktikan mekanisme token→RLS bekerja di produksi.
-- ============================================================

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Buang policy allow-all lama (nama persis dari 20260623_crm_customers.sql).
DROP POLICY IF EXISTS "Allow all for customers" ON customers;

-- BACA: semua user login.
CREATE POLICY "customers select authenticated" ON customers
  FOR SELECT TO authenticated
  USING (true);

-- TULIS: hanya owner/finance/sales.
CREATE POLICY "customers insert crm" ON customers
  FOR INSERT TO authenticated
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') );

CREATE POLICY "customers update crm" ON customers
  FOR UPDATE TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') );

CREATE POLICY "customers delete crm" ON customers
  FOR DELETE TO authenticated
  USING ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') );

-- ============================================================
-- ROLLBACK bila CRM/Dashboard/Tagihan bermasalah:
--
--   DROP POLICY IF EXISTS "customers select authenticated" ON customers;
--   DROP POLICY IF EXISTS "customers insert crm" ON customers;
--   DROP POLICY IF EXISTS "customers update crm" ON customers;
--   DROP POLICY IF EXISTS "customers delete crm" ON customers;
--   CREATE POLICY "Allow all for customers" ON customers FOR ALL USING (true) WITH CHECK (true);
-- ============================================================
