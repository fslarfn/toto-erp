-- ============================================================
-- 20260728_rls_settings.sql
-- Susulan 20260728_rls_tabel_tersisa: verifikasi pasca-migrasi
-- menemukan SATU tabel lagi tanpa RLS di DB live: `settings`.
--
-- Tabel ini tidak direferensikan di mana pun dalam kode aplikasi
-- maupun file SQL repo (kemungkinan sisa lama dibuat manual).
-- Dikunci total: RLS ENABLE tanpa policy = anon & authenticated
-- ditolak; hanya service_role/SQL Editor yang bisa mengakses.
--
-- Jalankan di Supabase → SQL Editor.
-- ============================================================

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- VERIFIKASI (harus 0 baris):
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND NOT rowsecurity;

-- Bila tabel memang tak terpakai, boleh dihapus nanti setelah
-- isinya diperiksa (SELECT * FROM settings;):
--   -- DROP TABLE settings;

-- ROLLBACK:
--   ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
