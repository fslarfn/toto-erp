-- ============================================================
-- WORKSPACES (Toto x Alucurv) — akses lintas-bisnis untuk owner/manager
-- Jalankan di Supabase SQL Editor SETELAH supabase-migration-alucurv-tables.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS user_workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
    workspace TEXT NOT NULL CHECK (workspace IN ('toto', 'alucurv')),
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'finance', 'sales', 'produksi', 'barang')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, workspace)
);

-- Seed: setiap user existing dapat akses workspace 'toto' dengan role Toto mereka saat ini
-- (mempertahankan akses yang sudah ada — tidak ada yang kehilangan akses).
INSERT INTO user_workspaces (user_id, workspace, role)
SELECT id, 'toto', role FROM app_users
ON CONFLICT (user_id, workspace) DO NOTHING;

-- Seed: owner Toto otomatis dapat akses workspace 'alucurv' juga, sebagai owner di sana.
-- Kalau ada user "manager" (non-owner) yang perlu akses gabungan, tambahkan manual:
--   INSERT INTO user_workspaces (user_id, workspace, role) VALUES ('<user_id>', 'alucurv', 'manager');
--   INSERT INTO user_workspaces (user_id, workspace, role) VALUES ('<user_id>', 'toto', 'manager')
--     ON CONFLICT (user_id, workspace) DO UPDATE SET role = 'manager';
INSERT INTO user_workspaces (user_id, workspace, role)
SELECT id, 'alucurv', 'owner' FROM app_users WHERE role = 'owner'
ON CONFLICT (user_id, workspace) DO NOTHING;

ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for user_workspaces" ON user_workspaces FOR ALL USING (true) WITH CHECK (true);
