-- ============================================================
-- 20260721_crm_unified.sql
-- CRM Terpadu — Tahap 1: skema untuk tab Per Marketing & Peta Wilayah.
--
-- SELURUHNYA ADITIF & IDEMPOTENT — aman dijalankan ulang, tidak ada
-- DROP kolom/tabel/data. Tabel & kolom lama tidak berubah perilaku.
--
-- Isi:
--   1. Kolom baru di customers: marketing_id, kota, provinsi, lat/lng.
--      (total_order / piutang / last_order_at TIDAK dibuat — tetap
--       diderivasi dari pesanan_rows, satu sumber kebenaran.)
--   2. Tabel referensi region_coords + seed 9 wilayah utama.
--   3. Tabel marketing_bonus (kunci bonus final per marketing per bulan).
--   4. Index pendukung.
--   5. RLS meniru pola 20260720_rls_customers.sql.
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

-- ========================
-- 1. KOLOM BARU customers
-- ========================
-- marketing_id: PIC marketing penanggung jawab customer.
-- Sengaja TEXT bebas (bukan enum/FK) agar menambah marketing baru
-- (mis. Dika yang belum punya akun app) tidak butuh migrasi lagi.
-- Nilai yang dipakai UI: 'toto' | 'faisal' | 'livia' | 'dika' | ''.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_id TEXT DEFAULT '';

-- kota: nama kota ternormalisasi utk agregasi peta (join ke region_coords).
-- provinsi: pelengkap tampilan/filter.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS kota     TEXT DEFAULT '';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS provinsi TEXT DEFAULT '';

-- lat/lng per customer: NULL = pakai koordinat kota dari region_coords.
-- Baru diisi kalau suatu saat mau titik presisi per customer.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS latitude  NUMERIC NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS longitude NUMERIC NULL;

-- ========================
-- 2. REGION_COORDS (referensi koordinat kota)
-- ========================
CREATE TABLE IF NOT EXISTS region_coords (
  kota      TEXT PRIMARY KEY,
  provinsi  TEXT NOT NULL DEFAULT '',
  lat       NUMERIC NOT NULL,
  lng       NUMERIC NOT NULL
);

-- Seed wilayah utama basis customer Toto. ON CONFLICT DO NOTHING →
-- jalan ulang aman; koreksi koordinat manual tidak akan tertimpa.
INSERT INTO region_coords (kota, provinsi, lat, lng) VALUES
  ('Bekasi',               'Jawa Barat',  -6.2383, 106.9756),
  ('Cikarang (Kab. Bekasi)','Jawa Barat', -6.2616, 107.1526),
  ('Jakarta Timur',        'DKI Jakarta', -6.2250, 106.9004),
  ('Jakarta Pusat',        'DKI Jakarta', -6.1865, 106.8340),
  ('Depok',                'Jawa Barat',  -6.4025, 106.7942),
  ('Bogor',                'Jawa Barat',  -6.5950, 106.8166),
  ('Tangerang',            'Banten',      -6.1783, 106.6319),
  ('Karawang',             'Jawa Barat',  -6.3227, 107.3376),
  ('Bandung',              'Jawa Barat',  -6.9175, 107.6191)
ON CONFLICT (kota) DO NOTHING;

-- ========================
-- 3. MARKETING_BONUS (kunci bonus final per bulan)
-- ========================
-- period format 'YYYY-MM' (mis. '2026-04') — cocok dgn rekap bulanan.
-- omset & bonus disimpan sebagai angka final saat dikunci (snapshot),
-- supaya perubahan data pesanan setelahnya tidak mengubah bonus tercatat.
CREATE TABLE IF NOT EXISTS marketing_bonus (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  marketing_id  TEXT NOT NULL,
  period        TEXT NOT NULL,            -- 'YYYY-MM'
  omset         NUMERIC NOT NULL DEFAULT 0,
  rate          NUMERIC NOT NULL DEFAULT 0.5,  -- persen, mis. 0.5 = 0,5%
  bonus         NUMERIC NOT NULL DEFAULT 0,
  locked_at     TIMESTAMPTZ DEFAULT now(),
  locked_by     TEXT DEFAULT ''           -- username yang mengunci (info)
);

-- Satu catatan final per marketing per bulan (kunci ulang = upsert).
CREATE UNIQUE INDEX IF NOT EXISTS idx_marketing_bonus_uniq
  ON marketing_bonus (marketing_id, period);

-- ========================
-- 4. INDEX PENDUKUNG
-- ========================
CREATE INDEX IF NOT EXISTS idx_customers_marketing ON customers (marketing_id);
CREATE INDEX IF NOT EXISTS idx_customers_kota      ON customers (kota);

-- ========================
-- 5. RLS (pola sama dgn 20260720_rls_customers.sql:
--    baca semua user login; tulis dibatasi via claim user_role)
-- ========================

-- region_coords: referensi publik-internal → baca semua yang login,
-- tulis hanya pengelola CRM (kalau mau menambah kota dari UI nanti).
ALTER TABLE region_coords ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "region_coords select authenticated" ON region_coords;
CREATE POLICY "region_coords select authenticated" ON region_coords
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "region_coords write crm" ON region_coords;
CREATE POLICY "region_coords write crm" ON region_coords
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance','sales') );

-- marketing_bonus: data finansial → baca semua yang login (marketing
-- boleh lihat bonusnya), tulis hanya owner/finance (sales tidak bisa
-- mengunci bonusnya sendiri).
ALTER TABLE marketing_bonus ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "marketing_bonus select authenticated" ON marketing_bonus;
CREATE POLICY "marketing_bonus select authenticated" ON marketing_bonus
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "marketing_bonus write finance" ON marketing_bonus;
CREATE POLICY "marketing_bonus write finance" ON marketing_bonus
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- Catatan: kolom baru customers otomatis ikut policy customers yang
-- sudah ada (RLS bekerja per-baris, bukan per-kolom) — tidak perlu
-- policy tambahan.

-- ============================================================
-- VERIFIKASI setelah run:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='customers'
--       AND column_name IN ('marketing_id','kota','provinsi','latitude','longitude');
--   SELECT * FROM region_coords ORDER BY kota;
--   SELECT * FROM marketing_bonus;
--
-- ROLLBACK (hanya bila benar-benar perlu — membuang data kolom/tabel baru):
--   ALTER TABLE customers DROP COLUMN IF EXISTS marketing_id;
--   ALTER TABLE customers DROP COLUMN IF EXISTS kota;
--   ALTER TABLE customers DROP COLUMN IF EXISTS provinsi;
--   ALTER TABLE customers DROP COLUMN IF EXISTS latitude;
--   ALTER TABLE customers DROP COLUMN IF EXISTS longitude;
--   DROP TABLE IF EXISTS marketing_bonus;
--   DROP TABLE IF EXISTS region_coords;
-- ============================================================
