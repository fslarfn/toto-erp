-- ============================================================
-- 20260722_gaji_absensi.sql
-- Integrasi Gaji ⇄ Absensi — Tahap skema (ADITIF & IDEMPOTENT).
--
-- Keputusan owner (22 Jul 2026):
--   - Minggu gajian = Senin s.d. Sabtu (gajian Sabtu; geser Jumat bila libur)
--   - Setengah hari bila pulang jam 12 siang
--   - Telat tidak dipotong, hanya keterangan di slip
--   - Lembur semi-otomatis dari absensi (bisa diedit)
--   - Bulanan juga dihitung dari total hari masuk (bukan pro-rata)
--   - Saat gaji disimpan, pengeluaran bisa dicatat ke Keuangan (cash_flow)
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

-- ========================
-- 1. KARYAWAN: tipe gajian + tarif lembur opsional
--    ('' = otomatis: punya gaji_harian → mingguan, selain itu bulanan)
-- ========================
ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS periode_gaji TEXT DEFAULT '';
ALTER TABLE karyawan ADD COLUMN IF NOT EXISTS tarif_lembur NUMERIC DEFAULT 0;

-- CATATAN DATA-FIX (sudah dijalankan 22 Jul 2026, satu kali via skrip):
-- kedua kolom di atas ternyata SUDAH ada dari eksperimen lama dan seluruh
-- baris terisi periode_gaji='bulanan' rata (blanket default, bukan setelan
-- sengaja) — sehingga daftar Mingguan kosong. Sudah direset ke '' (otomatis)
-- utk 22 karyawan bergaji harian. TIDAK dimasukkan sebagai statement di sini
-- agar run ulang migrasi tidak menimpa setelan sengaja di masa depan.

-- ========================
-- 2. GAJI: periode berbasis rentang tanggal + info absensi + tautan Keuangan
--    Kolom lama (periode 'YYYY-MM-Wn', hari_kerja, dst.) TIDAK berubah —
--    format periode baru: 'YYYY-MM-DD~YYYY-MM-DD' (mulai~selesai).
-- ========================
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS periode_mulai   TEXT DEFAULT '';
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS periode_selesai TEXT DEFAULT '';
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS tanggal_gajian  TEXT DEFAULT '';
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS telat_count     INT  DEFAULT 0;   -- keterangan slip
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS telat_menit     INT  DEFAULT 0;
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS sumber_hitung   TEXT DEFAULT '';  -- 'absensi' | 'manual'
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS cash_flow_id    TEXT DEFAULT '';  -- anti dobel catat ke Keuangan

CREATE INDEX IF NOT EXISTS idx_gaji_periode ON gaji (periode);

-- RLS gaji & kasbon sudah dikunci owner/finance (20260720_rls_pilot_payroll)
-- — kolom baru otomatis ikut policy per-baris yang ada.

-- ============================================================
-- VERIFIKASI:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='gaji'
--       AND column_name IN ('periode_mulai','periode_selesai','tanggal_gajian',
--                           'telat_count','telat_menit','sumber_hitung','cash_flow_id');
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='karyawan' AND column_name IN ('periode_gaji','tarif_lembur');
-- ============================================================
