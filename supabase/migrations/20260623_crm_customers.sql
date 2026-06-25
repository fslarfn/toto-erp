-- ============================================================
-- 20260623_crm_customers.sql
-- CRM Fase 1 — Master Customer.
-- Tabel baru (aditif) untuk menyimpan kontak & profil customer.
-- TIDAK mengubah tabel/transaksi lain. Aman dijalankan ulang.
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT DEFAULT '',          -- nomor WA/HP (untuk klik-chat)
  address     TEXT DEFAULT '',
  type        TEXT DEFAULT 'retail'
              CHECK (type IN ('retail','proyek','kontraktor','reseller','lainnya')),
  pic         TEXT DEFAULT '',          -- nama kontak / PIC
  notes       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Satu customer per nama (ternormalisasi) → cegah duplikat saat import.
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_name_uniq ON customers (lower(btrim(name)));

-- RLS mengikuti konvensi app (custom auth, anon allow-all).
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for customers" ON customers;
CREATE POLICY "Allow all for customers" ON customers FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER TABLE customers REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE customers;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

-- Verifikasi:
--   SELECT * FROM customers ORDER BY name;
-- ============================================================
