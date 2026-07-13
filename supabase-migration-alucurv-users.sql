-- ============================================================
-- USER KHUSUS WORKSPACE ALUCURV (tidak dapat akses Toto sama sekali)
-- Jalankan SETELAH supabase-migration-workspaces.sql
-- ============================================================

-- Lebarkan CHECK constraint role di app_users agar menerima 'alucurv'.
-- Nama constraint asli mungkin berbeda (mis. sudah pernah diubah manual
-- untuk menambahkan 'finishing') — DROP IF EXISTS aman, lalu ADD dengan
-- nama baru supaya tidak bentrok apa pun nama constraint sebelumnya.
ALTER TABLE app_users DROP CONSTRAINT IF EXISTS app_users_role_check;
ALTER TABLE app_users
    ADD CONSTRAINT app_users_role_check_v2
    CHECK (role IN ('owner', 'finance', 'sales', 'produksi', 'barang', 'finishing', 'alucurv'));

-- Password 'toto123' disimpan plain-text sementara, mengikuti pola user
-- lain (auto ter-hash bcrypt otomatis saat login pertama, lihat
-- app/api/auth/login/route.ts).
INSERT INTO app_users (name, username, password_hash, role) VALUES
    ('Iva', 'iva', 'toto123', 'alucurv'),
    ('Febri', 'febri', 'toto123', 'alucurv')
ON CONFLICT (username) DO NOTHING;

-- Hanya diberi akses workspace 'alucurv' — TIDAK ada baris 'toto' untuk
-- user ini, sehingga workspace guard di app/dashboard/layout.tsx akan
-- otomatis menolak akses ke halaman Toto dan mengarahkan balik ke
-- /dashboard/alucurv.
INSERT INTO user_workspaces (user_id, workspace, role)
SELECT id, 'alucurv', 'finance' FROM app_users WHERE username IN ('iva', 'febri')
ON CONFLICT (user_id, workspace) DO NOTHING;
