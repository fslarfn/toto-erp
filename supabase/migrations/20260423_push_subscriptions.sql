-- Web Push Subscriptions
-- Menyimpan subscription endpoint per user per device

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  -- Preferensi notifikasi per jenis event
  notification_prefs JSONB NOT NULL DEFAULT '{
    "pesanan_baru": true,
    "status_produksi": true,
    "status_bayar": true,
    "stok_minimum": true,
    "pesanan_stuck": true,
    "tagihan_jatuh_tempo": true,
    "kasbon": true,
    "absensi_terlambat": false
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

-- Index untuk query cepat berdasarkan user_id
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx ON push_subscriptions(user_id);
