-- ============================================================
-- 20260722_bersihkan_tanggal_pesanan.sql
-- Pembersihan tanggal typo di pesanan_rows (data-fix, bukan skema).
--
-- Hasil pindai 22 Jul 2026 atas 14.535 baris:
--   - 14.438 baris ISO benar (YYYY-MM-DD)          → tidak disentuh
--   -     92 baris format DD-MM-YYYY (semua 2026)  → dikonversi ke ISO
--   -      2 baris "0002-04-23" (id 8307, 8308)    → baris KOSONG tanpa
--            customer/deskripsi/invoice → tanggal dikosongkan (tidak dihapus)
--   -      1 baris "2,2" (id 6631, JAJUZ)          → created_at 14 Apr 2026,
--            tetangga id 13-15 Apr → dikoreksi ke 2026-04-14
--   -      2 baris tanggal kosong berisi order riil (id 10386, 10682)
--            → diisi dari tanggal created_at
--
-- IDEMPOTENT: semua UPDATE dijaga kondisi pola/nilai lama — jalan ulang
-- tidak mengubah apa pun. TIDAK ada DELETE.
-- Catatan: UPDATE memicu event realtime ke app yang sedang terbuka —
-- jalankan saat jam sepi bila memungkinkan (hanya ~97 baris, ringan).
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

-- ========================
-- 1. KONVERSI DD-MM-YYYY (juga DD/MM/YYYY, DD.MM.YYYY) → YYYY-MM-DD
--    Hanya bila bulan 1-12 & hari 1-31; selain itu dibiarkan utk laporan #4.
-- ========================
UPDATE pesanan_rows
SET tanggal =
      lpad(split_part(translate(tanggal, '/.', '--'), '-', 3), 4, '0') || '-'
   || lpad(split_part(translate(tanggal, '/.', '--'), '-', 2), 2, '0') || '-'
   || lpad(split_part(translate(tanggal, '/.', '--'), '-', 1), 2, '0')
WHERE translate(tanggal, '/.', '--') ~ '^\d{1,2}-\d{1,2}-\d{4}$'
  AND split_part(translate(tanggal, '/.', '--'), '-', 2)::int BETWEEN 1 AND 12
  AND split_part(translate(tanggal, '/.', '--'), '-', 1)::int BETWEEN 1 AND 31;

-- ========================
-- 2. KOREKSI BARIS SPESIFIK (hasil inspeksi manual — lihat header)
-- ========================
-- Baris kosong tak berisi order → kosongkan tanggal typo "0002-04-23".
UPDATE pesanan_rows SET tanggal = ''
WHERE id IN (8307, 8308) AND tanggal = '0002-04-23';

-- "2,2" → 2026-04-14 (dari created_at & baris tetangga).
UPDATE pesanan_rows SET tanggal = '2026-04-14'
WHERE id = 6631 AND tanggal = '2,2';

-- Order riil tanpa tanggal → isi dari tanggal dibuat.
UPDATE pesanan_rows SET tanggal = '2026-06-02'
WHERE id = 10386 AND (tanggal IS NULL OR tanggal = '');
UPDATE pesanan_rows SET tanggal = '2026-06-04'
WHERE id = 10682 AND (tanggal IS NULL OR tanggal = '');

-- ========================
-- 3. VERIFIKASI — harus 0 baris setelah run:
-- ========================
--   SELECT id, tanggal FROM pesanan_rows
--   WHERE tanggal IS NOT NULL AND tanggal <> ''
--     AND tanggal !~ '^\d{4}-\d{2}-\d{2}$';
--
--   SELECT id, tanggal FROM pesanan_rows
--   WHERE tanggal ~ '^\d{4}-\d{2}-\d{2}$'
--     AND (substring(tanggal from 1 for 4)::int NOT BETWEEN 2020 AND 2026
--       OR substring(tanggal from 6 for 2)::int NOT BETWEEN 1 AND 12
--       OR substring(tanggal from 9 for 2)::int NOT BETWEEN 1 AND 31);

-- ========================
-- 4. LAPORAN utk ADMIN (tidak mengubah data): tanggal ISO valid tapi
--    DICURIGAI bulan-hari tertukar — beda > 45 hari dari created_at.
--    Contoh nyata: id 8304-8306 bertanggal "2026-04-05"/"2026-06-05" di
--    tengah deretan baris 4-5 Mei. Perlu mata manusia, koreksi via app.
-- ========================
--   SELECT id, tanggal, created_at::date AS dibuat, customer, no_inv
--   FROM pesanan_rows
--   WHERE tanggal ~ '^\d{4}-\d{2}-\d{2}$'
--     AND abs(tanggal::date - created_at::date) > 45
--   ORDER BY abs(tanggal::date - created_at::date) DESC;
-- ============================================================
