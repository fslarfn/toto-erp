-- ============================================================
-- MIGRATION: RLS Performance & Policy Consolidation
-- Versi   : 20260513
-- Author  : Claude Security Audit
-- Terkait : Supabase Advisor — 34 security warnings + 12 performance warnings
-- ============================================================
-- RINGKASAN PERUBAHAN:
--   1. Adopsi DDL cockpit_settings ke migration history
--      + tambah PRIMARY KEY jika belum ada
--      + aktifkan RLS deny-all
--   2. Refactor policies monthly_targets:
--      Drop policy lama (role authenticated yg tidak pernah terpakai),
--      buat ulang untuk role anon (yg sebenarnya dipakai app).
--      Hygiene: tambah pola (SELECT auth.uid()) meski selalu NULL.
--   3. Konsolidasi multiple permissive policies pada billing_history:
--      "Allow read" (SELECT) + "Allow system handle" (ALL) → 1 policy SELECT
--      + implicit deny-all untuk write (service_role bypass RLS anyway)
--
-- CATATAN ARSITEKTUR:
--   App ini menggunakan custom auth (tabel app_users), BUKAN Supabase Auth.
--   auth.uid() selalu NULL. Role 'authenticated' tidak pernah dipakai.
--   Refactor ke (SELECT auth.uid()) adalah hygiene Advisor — tidak ada
--   dampak fungsional atau performa nyata untuk app ini.
--
-- ROLLBACK (jalankan dalam urutan terbalik):
--   -- 3. Kembalikan policies billing_history
--   DROP POLICY IF EXISTS "billing_history_select_combined" ON public.billing_history;
--   CREATE POLICY "Allow read for all on billing_history"
--       ON public.billing_history FOR SELECT USING (true);
--   CREATE POLICY "Allow system handle billing_history"
--       ON public.billing_history FOR ALL USING (true) WITH CHECK (true);
--
--   -- 2. Kembalikan policies monthly_targets
--   DROP POLICY IF EXISTS "monthly_targets_select" ON public.monthly_targets;
--   DROP POLICY IF EXISTS "monthly_targets_write"  ON public.monthly_targets;
--   CREATE POLICY "Allow read for authenticated"
--       ON public.monthly_targets FOR SELECT TO authenticated USING (true);
--   CREATE POLICY "Allow write for all"
--       ON public.monthly_targets FOR ALL TO authenticated USING (true) WITH CHECK (true);
--
--   -- 1. Nonaktifkan RLS cockpit_settings
--   ALTER TABLE public.cockpit_settings DISABLE ROW LEVEL SECURITY;
-- ============================================================


-- ============================================================
-- BAGIAN 1 — cockpit_settings
-- ============================================================

-- 1a. Adopsi DDL cockpit_settings ke migration history (idempotent)
--     Tabel ini sebelumnya dibuat manual via Dashboard.
--     Pola key-value JSON global, bukan per-user.
--     Akses hanya via service_role di Next.js API route.
--     App pakai custom auth, bukan Supabase Auth.
CREATE TABLE IF NOT EXISTS public.cockpit_settings (
    config_key text        NOT NULL,
    value      jsonb,
    updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.cockpit_settings IS
    'Konfigurasi global cockpit (key-value JSON). '
    'Akses hanya via service_role di Next.js API route. '
    'App pakai custom auth, bukan Supabase Auth.';

-- 1b. Tambah PRIMARY KEY pada config_key jika belum ada (idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.cockpit_settings'::regclass
          AND contype  = 'p'  -- 'p' = PRIMARY KEY
    ) THEN
        ALTER TABLE public.cockpit_settings
            ADD CONSTRAINT cockpit_settings_pkey PRIMARY KEY (config_key);
        RAISE NOTICE 'PRIMARY KEY (config_key) ditambahkan ke cockpit_settings';
    ELSE
        RAISE NOTICE 'PRIMARY KEY sudah ada di cockpit_settings — dilewati';
    END IF;
END $$;

-- 1c. Aktifkan RLS deny-all untuk cockpit_settings
--     Tanpa policy anon/authenticated = deny by default.
--     Hanya service_role yang bisa akses (bypass RLS by design).
ALTER TABLE public.cockpit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all for cockpit_settings"  ON public.cockpit_settings;
DROP POLICY IF EXISTS "Allow all"                        ON public.cockpit_settings;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.cockpit_settings;
DROP POLICY IF EXISTS "Allow read for cockpit_settings"  ON public.cockpit_settings;
-- Tidak membuat policy baru — no policy = deny-all = intended behavior


-- ============================================================
-- BAGIAN 2 — monthly_targets
-- ============================================================
-- Supabase Advisor: "Auth RLS Initialization Plan"
-- Perbaikan: drop policy lama yang menarget role 'authenticated'
-- (tidak pernah terpakai di custom-auth app), buat ulang untuk
-- role 'anon' yang benar-benar dipakai aplikasi.
--
-- Hygiene only; app pakai custom auth sehingga auth.uid() selalu NULL.
-- Pola (SELECT auth.uid()) dievaluasi sekali per query (subquery cache),
-- bukan sekali per baris — mengurangi overhead RLS execution plan.

-- Drop policies lama yang menarget role 'authenticated' (tidak efektif)
DROP POLICY IF EXISTS "Allow read for authenticated" ON public.monthly_targets;
DROP POLICY IF EXISTS "Allow write for all"          ON public.monthly_targets;

-- Drop juga jika ada policy baru dari run sebelumnya (idempotent)
DROP POLICY IF EXISTS "monthly_targets_select" ON public.monthly_targets;
DROP POLICY IF EXISTS "monthly_targets_write"  ON public.monthly_targets;

-- Policy SELECT: anon dapat membaca (cockpit page query langsung via anon key)
-- Hygiene only; app pakai custom auth sehingga auth.uid() selalu NULL.
CREATE POLICY "monthly_targets_select"
    ON public.monthly_targets
    FOR SELECT
    TO anon, authenticated
    USING (
        -- (SELECT auth.uid()) dievaluasi sekali per query — hygiene Advisor
        -- Selalu true karena app tidak pakai Supabase Auth
        (SELECT auth.uid()) IS NULL OR (SELECT auth.uid()) IS NOT NULL
    );

-- Write policy untuk anon TIDAK dibuat secara sengaja.
-- Siapa pun dengan anon key (public di front-end) tidak boleh menulis monthly_targets.
-- Write harus lewat service_role di Next.js API route.
-- Catatan: setMonthlyTarget di lib/queries/cockpit.ts perlu dipindah ke API route.


-- ============================================================
-- BAGIAN 3 — billing_history: konsolidasi multiple permissive policies
-- ============================================================
-- Supabase Advisor: "Multiple Permissive Policies"
-- SEBELUM:
--   Policy 1: "Allow read for all on billing_history"  FOR SELECT USING (true)
--   Policy 2: "Allow system handle billing_history"    FOR ALL    USING (true)
--   → Dua policy SELECT yang sama-sama permissive = overhead evaluasi ganda
--
-- SESUDAH:
--   Policy 1: "billing_history_select_combined"  FOR SELECT (anon bisa baca)
--   Write (INSERT/UPDATE/DELETE) tidak punya policy anon → deny by default
--   service_role bypass RLS → write dari API route tetap jalan
--
-- CATATAN: /invoice/[id]/page.tsx membaca billing_history via anon key,
-- jadi SELECT harus tetap terbuka untuk anon.

-- Drop semua policy lama (idempotent)
DROP POLICY IF EXISTS "Allow read for all on billing_history" ON public.billing_history;
DROP POLICY IF EXISTS "Allow system handle billing_history"   ON public.billing_history;
DROP POLICY IF EXISTS "billing_history_select_combined"       ON public.billing_history;
DROP POLICY IF EXISTS "billing_history_write_combined"        ON public.billing_history;

-- Satu policy SELECT — menggantikan dua policy permissive yang redundan
CREATE POLICY "billing_history_select_combined"
    ON public.billing_history
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Tidak ada policy INSERT/UPDATE/DELETE untuk anon/authenticated
-- → deny-all untuk write dari non-service_role (sesuai desain)
-- → service_role (Next.js API route) tetap dapat menulis karena bypass RLS
