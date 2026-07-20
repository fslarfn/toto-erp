-- ============================================================
-- 20260720_rls_pilot_payroll.sql
-- PILOT penutupan celah anon: kunci RLS tabel PAYROLL (gaji, kasbon).
--
-- Latar: seluruh tabel bisnis dulu pakai policy "allow all" (USING true)
-- yang berlaku untuk role `anon` → siapa pun dengan publishable key publik
-- bisa membaca/menulis gaji & kasbon langsung ke Supabase tanpa login.
--
-- Sesudah PR #30, browser user yang login membawa token `authenticated`
-- (klaim user_role). Migrasi ini mengganti "allow all" menjadi:
--   - HANYA role `authenticated` dengan user_role owner/finance yang boleh.
--   - `anon` tidak masuk klausa TO → SELECT anon = 0 baris, tulis anon = 403.
--
-- AMAN untuk halaman lain: /absen (kiosk publik) & Absensi memuat store
-- karyawan yang ikut men-select gaji/kasbon, TAPI penolakan RLS pada SELECT
-- menghasilkan array kosong (bukan error), dan halaman itu tidak menampilkan
-- payroll — jadi tetap berfungsi. Menu Karyawan (owner/finance) tetap penuh.
--
-- PRASYARAT: env SUPABASE_JWT_SECRET sudah aktif di Vercel (sudah, per uji
-- /api/auth/supabase-token di produksi). Jalankan di Supabase → SQL Editor.
--
-- ROLLBACK (jalankan blok paling bawah bila ada masalah).
-- ============================================================

-- RLS sudah ENABLE pada kedua tabel (dari schema awal). Aman diulang.
ALTER TABLE gaji   ENABLE ROW LEVEL SECURITY;
ALTER TABLE kasbon ENABLE ROW LEVEL SECURITY;

-- ── gaji ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for gaji" ON gaji;
CREATE POLICY "gaji owner-finance only" ON gaji
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ── kasbon ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all for kasbon" ON kasbon;
CREATE POLICY "kasbon owner-finance only" ON kasbon
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ============================================================
-- VERIFIKASI (opsional, di SQL editor sbg service_role — bypass RLS):
--   SELECT policyname, roles, cmd FROM pg_policies
--   WHERE tablename IN ('gaji','kasbon');
-- ============================================================

-- ============================================================
-- ROLLBACK — kembalikan ke allow-all bila menu Karyawan bermasalah:
--
--   DROP POLICY IF EXISTS "gaji owner-finance only" ON gaji;
--   CREATE POLICY "Allow all for gaji" ON gaji FOR ALL USING (true) WITH CHECK (true);
--   DROP POLICY IF EXISTS "kasbon owner-finance only" ON kasbon;
--   CREATE POLICY "Allow all for kasbon" ON kasbon FOR ALL USING (true) WITH CHECK (true);
-- ============================================================
