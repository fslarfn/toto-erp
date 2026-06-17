-- ============================================================
-- 20260613_notifications.sql
-- Sistem Notifikasi ERP TOTO — tabel + index + RLS + realtime
-- + database functions untuk generate notifikasi otomatis.
--
-- Jalankan di Supabase Dashboard → SQL Editor → New Query → Run.
-- Aman dijalankan ulang (idempotent).
-- ============================================================

-- ========================
-- 1. TABEL NOTIFICATIONS
-- ========================
-- Catatan kompatibilitas: app/api/push/send/route.ts sudah meng-insert
-- { title, body, url, notification_type } ke tabel ini. Semua kolom lain
-- punya DEFAULT supaya insert lama tetap jalan tanpa perubahan.
CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  url TEXT,
  notification_type TEXT NOT NULL DEFAULT 'umum',
  -- tipe: 'piutang_jatuh_tempo' | 'stok_minimum' | 'pesanan_baru'
  --       | 'produksi_selesai' | 'absensi' | 'tagihan_jatuh_tempo' | dll
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'warning', 'danger')),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  target_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE,
  -- NULL = broadcast ke semua user
  meta JSONB NOT NULL DEFAULT '{}',
  -- dedupe_key: mencegah notif kembar untuk entitas yang sama selama
  -- notif lama masih belum dibaca (lihat partial unique index di bawah).
  dedupe_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kolom baru bila tabel sudah terlanjur dibuat versi minimal sebelumnya
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS meta JSONB NOT NULL DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- ========================
-- 2. INDEX
-- ========================
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_notifications_target ON notifications(target_user_id);

-- Dedup: selama sebuah notif (dedupe_key) masih BELUM dibaca, generator
-- tidak akan menyisipkan duplikat. Ini mengganti "ON CONFLICT DO NOTHING"
-- pada spec awal yang sebenarnya no-op (tidak ada unique target).
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_active
  ON notifications(dedupe_key)
  WHERE is_read = FALSE AND dedupe_key IS NOT NULL;

-- ========================
-- 3. RLS (mengikuti konvensi app: custom auth, anon key allow-all)
-- ========================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for notifications" ON notifications;
CREATE POLICY "Allow all for notifications" ON notifications
  FOR ALL USING (true) WITH CHECK (true);

-- ========================
-- 4. REALTIME
-- ========================
-- REPLICA IDENTITY FULL supaya payload UPDATE/DELETE (mis. mark as read)
-- membawa data lama untuk realtime subscription di client.
ALTER TABLE notifications REPLICA IDENTITY FULL;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;  -- sudah terdaftar
  WHEN undefined_object THEN NULL;  -- publication belum ada (env lokal)
END $$;

-- ============================================================
-- 5. FUNCTION: PIUTANG JATUH TEMPO (> 30 hari)
-- ------------------------------------------------------------
-- DIKOREKSI dari spec awal: data piutang ada di tabel `orders`
-- (bukan `payments`). Sisa tagihan = total_price - paid_amount,
-- jatuh tempo = orders.due_date (TEXT 'YYYY-MM-DD').
-- ============================================================
CREATE OR REPLACE FUNCTION generate_piutang_notifications()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  WITH src AS (
    SELECT
      o.id,
      o.customer_name,
      (o.total_price - o.paid_amount)            AS sisa,
      (CURRENT_DATE - o.due_date::date)          AS hari_telat
    FROM orders o
    WHERE o.payment_status <> 'lunas'
      AND o.due_date ~ '^\d{4}-\d{2}-\d{2}$'      -- abaikan due_date kosong/invalid
      AND o.due_date::date < CURRENT_DATE - INTERVAL '30 days'
      AND (o.total_price - o.paid_amount) > 0
  ),
  ins AS (
    INSERT INTO notifications (title, body, url, notification_type, severity, meta, dedupe_key)
    SELECT
      'Piutang Jatuh Tempo: ' || NULLIF(src.customer_name, ''),
      'Rp ' || replace(to_char(round(src.sisa), 'FM999,999,999,999'), ',', '.')
        || ' belum dibayar, telat ' || src.hari_telat || ' hari',
      '/dashboard/invoice',
      'piutang_jatuh_tempo',
      CASE
        WHEN src.hari_telat > 60 THEN 'danger'
        WHEN src.hari_telat > 30 THEN 'warning'
        ELSE 'info'
      END,
      jsonb_build_object(
        'order_id', src.id,
        'customer', src.customer_name,
        'nominal', src.sisa,
        'hari_telat', src.hari_telat
      ),
      'piutang:' || src.id
    FROM src
    WHERE NULLIF(src.customer_name, '') IS NOT NULL
    ON CONFLICT (dedupe_key) WHERE (is_read = FALSE AND dedupe_key IS NOT NULL)
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. FUNCTION: STOK MINIMUM
-- ------------------------------------------------------------
-- DIKOREKSI dari spec awal: kolom asli materials =
-- name / unit / current_stock / minimum_stock.
-- ============================================================
CREATE OR REPLACE FUNCTION generate_stok_notifications()
RETURNS integer AS $$
DECLARE
  inserted_count integer;
BEGIN
  WITH ins AS (
    INSERT INTO notifications (title, body, url, notification_type, severity, meta, dedupe_key)
    SELECT
      'Stok Menipis: ' || m.name,
      'Sisa ' || trim(to_char(m.current_stock, 'FM999,999,990.##')) || ' ' || COALESCE(NULLIF(m.unit, ''), 'unit')
        || ' (min ' || trim(to_char(m.minimum_stock, 'FM999,999,990.##')) || ')',
      '/dashboard/stok-bahan',
      'stok_minimum',
      CASE WHEN m.current_stock <= 0 THEN 'danger' ELSE 'warning' END,
      jsonb_build_object(
        'material_id', m.id,
        'material', m.name,
        'stok', m.current_stock,
        'min_stok', m.minimum_stock
      ),
      'stok:' || m.id
    FROM materials m
    WHERE m.minimum_stock > 0
      AND m.current_stock < m.minimum_stock
      AND NULLIF(m.name, '') IS NOT NULL
    ON CONFLICT (dedupe_key) WHERE (is_read = FALSE AND dedupe_key IS NOT NULL)
    DO NOTHING
    RETURNING 1
  )
  SELECT count(*) INTO inserted_count FROM ins;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. WRAPPER: generate semua notifikasi terjadwal
-- ------------------------------------------------------------
-- Dipanggil oleh Vercel cron route /api/cron/generate-notifications
-- via supabase.rpc('generate_all_notifications').
-- ============================================================
CREATE OR REPLACE FUNCTION generate_all_notifications()
RETURNS jsonb AS $$
DECLARE
  n_piutang integer;
  n_stok integer;
BEGIN
  SELECT generate_piutang_notifications() INTO n_piutang;
  SELECT generate_stok_notifications() INTO n_stok;
  RETURN jsonb_build_object(
    'piutang_jatuh_tempo', n_piutang,
    'stok_minimum', n_stok,
    'generated_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. (OPSIONAL) Jadwalkan via pg_cron — hanya jika extension aktif.
-- Defaultnya app memakai Vercel cron, jadi blok ini dibiarkan komentar.
-- Aktifkan kalau lebih suka penjadwalan di sisi database:
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--   SELECT cron.schedule(
--     'generate-notifications-daily',
--     '0 1 * * *',
--     $$ SELECT generate_all_notifications(); $$
--   );
-- ============================================================

-- ============================================================
-- SELESAI. Verifikasi cepat:
--   SELECT generate_all_notifications();
--   SELECT * FROM notifications ORDER BY created_at DESC LIMIT 20;
-- ============================================================
