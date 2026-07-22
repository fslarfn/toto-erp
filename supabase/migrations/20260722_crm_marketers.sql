-- ============================================================
-- 20260722_crm_marketers.sql
-- Daftar marketing (PIC) pindah dari konstanta kode → tabel, supaya
-- owner bisa menambah/menonaktifkan marketing dari UI tanpa rilis kode.
--
-- Sekalian: Dika DIHAPUS dari daftar marketing (keputusan owner
-- 22 Jul 2026) — tidak di-seed, dan customer yang terlanjur di-assign
-- ke 'dika' dikembalikan ke "belum di-assign".
--
-- ADITIF & IDEMPOTENT — aman dijalankan ulang.
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_marketers (
  id          TEXT PRIMARY KEY,            -- slug: 'toto', 'faisal', ...
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#7A5C3A',
  active      BOOLEAN NOT NULL DEFAULT true,  -- nonaktif = disembunyikan dr UI,
                                              -- riwayat bonus tetap utuh
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed marketing aktif saat ini (warna sama dgn yang dipakai UI selama ini).
INSERT INTO crm_marketers (id, name, color) VALUES
  ('toto',   'Toto',   '#4E6B57'),
  ('faisal', 'Faisal', '#7A5C3A'),
  ('livia',  'Livia',  '#8A5A6B')
ON CONFLICT (id) DO NOTHING;

-- Dika keluar dari marketing → customer binaannya jadi "belum di-assign"
-- (bisa di-reassign lewat tab Direktori). Idempotent.
UPDATE customers SET marketing_id = '' WHERE marketing_id = 'dika';

-- RLS pola sama dgn tabel CRM lain: baca semua user login,
-- kelola daftar hanya owner/finance.
ALTER TABLE crm_marketers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_marketers select authenticated" ON crm_marketers;
CREATE POLICY "crm_marketers select authenticated" ON crm_marketers
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "crm_marketers write finance" ON crm_marketers;
CREATE POLICY "crm_marketers write finance" ON crm_marketers
  FOR ALL TO authenticated
  USING      ( (auth.jwt() ->> 'user_role') IN ('owner','finance') )
  WITH CHECK ( (auth.jwt() ->> 'user_role') IN ('owner','finance') );

-- ============================================================
-- VERIFIKASI:
--   SELECT * FROM crm_marketers ORDER BY created_at;   -- 3 baris, tanpa dika
--   SELECT count(*) FROM customers WHERE marketing_id = 'dika';  -- 0
-- ============================================================
