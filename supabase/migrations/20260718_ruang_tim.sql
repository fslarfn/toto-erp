-- ============================================================
-- 20260718_ruang_tim.sql
-- "Ruang Tim" — chat + papan tugas dalam satu alur pesan.
--
-- Tipe pesan: 'info' | 'tugas' | 'pengumuman'.
-- Pesan 'tugas' punya assignee, deadline (teks bebas), prioritas,
-- dan status selesai.
--
-- PENYESUAIAN dari spec awal (mengikuti sistem yang berjalan):
--   * FK ke app_users(id) — app ini pakai auth custom (bukan
--     Supabase Auth), jadi auth.users/profiles tidak ada.
--     "profiles" = app_users (sudah punya name, role, avatar).
--   * RLS allow-all (konvensi seluruh tabel app ini: semua request
--     lewat anon key + middleware session). Pembatasan
--     "UPDATE hanya author/assignee" ditegakkan di lapisan aplikasi.
--
-- AMAN: hanya CREATE TABLE/INDEX/POLICY baru. Tabel chat lama
-- (internal_notes) TIDAK disentuh. Idempotent.
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  author_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('info', 'tugas', 'pengumuman')),
  body TEXT NOT NULL,
  -- ── khusus type = 'tugas' ──
  assignee_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
  due_text TEXT,                                        -- deadline teks bebas ("Kamis 16:00")
  priority TEXT CHECK (priority IN ('sedang', 'tinggi')),
  done BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
-- Panel "Tugas berjalan": tugas yang belum selesai.
CREATE INDEX IF NOT EXISTS idx_messages_open_tasks
  ON messages(assignee_id) WHERE type = 'tugas' AND done = FALSE;

-- ── RLS (konvensi app: custom auth, anon key allow-all) ──
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for messages" ON messages;
CREATE POLICY "Allow all for messages" ON messages
  FOR ALL USING (true) WITH CHECK (true);

-- ── REALTIME ──
ALTER TABLE messages REPLICA IDENTITY FULL;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;   -- sudah terdaftar
  WHEN undefined_object THEN NULL;   -- publication belum ada (env lokal)
END $$;

-- ── Query join nama author & assignee (dipakai data layer) ──
-- Data layer memetakan nama dari app_users di client; view ini
-- disediakan untuk kebutuhan inspeksi/laporan manual:
CREATE OR REPLACE VIEW v_messages_named
WITH (security_invoker = true) AS
SELECT
  m.*,
  a.name  AS author_name,
  a.role  AS author_role,
  s.name  AS assignee_name
FROM messages m
LEFT JOIN app_users a ON a.id = m.author_id
LEFT JOIN app_users s ON s.id = m.assignee_id;

GRANT SELECT ON v_messages_named TO anon, authenticated;

-- ============================================================
-- VERIFIKASI cepat:
--   INSERT INTO messages (author_id, type, body)
--     SELECT id, 'info', 'tes ruang tim' FROM app_users LIMIT 1;
--   SELECT * FROM v_messages_named ORDER BY created_at DESC LIMIT 5;
--   DELETE FROM messages WHERE body = 'tes ruang tim';  -- bersihkan tes
-- ============================================================
