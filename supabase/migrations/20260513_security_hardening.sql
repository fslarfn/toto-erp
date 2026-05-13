-- ============================================================
-- MIGRATION: Security Hardening
-- Versi   : 20260513
-- Author  : Claude Security Audit
-- Terkait : Supabase Advisor — 4 security errors
-- ============================================================
-- RINGKASAN PERUBAHAN:
--   1. Adopsi DDL billing_manual_confirmations ke migration history
--      + aktifkan RLS deny-all (no policy = block semua non-service_role)
--   2. Eksplisitkan SECURITY INVOKER pada 3 view cockpit yang
--      diflag Advisor sebagai implicit SECURITY DEFINER
--
-- CATATAN ARSITEKTUR:
--   App ini menggunakan custom auth (tabel app_users), BUKAN Supabase Auth.
--   auth.uid() selalu NULL. Role 'authenticated' tidak pernah dipakai.
--   Semua operasi tulis ke tabel sensitif melalui service_role key
--   di Next.js API routes. service_role bypass RLS by design.
--
-- ROLLBACK (jalankan dalam urutan terbalik):
--   -- 2b. Kembalikan v_cockpit_stuck_orders / v_cockpit_stuck_order
--   ALTER VIEW IF EXISTS public.v_cockpit_stuck_orders SET (security_invoker = false);
--   ALTER VIEW IF EXISTS public.v_cockpit_stuck_order  SET (security_invoker = false);
--   -- 2a. Kembalikan view lain
--   ALTER VIEW IF EXISTS public.v_cockpit_top_debtors  SET (security_invoker = false);
--   ALTER VIEW IF EXISTS public.v_cockpit_aging         SET (security_invoker = false);
--   -- 1b. Nonaktifkan RLS (hati-hati: data jadi terbuka lagi)
--   ALTER TABLE public.billing_manual_confirmations DISABLE ROW LEVEL SECURITY;
--   -- 1a. Drop tabel hanya jika environment fresh (JANGAN di production)
--   -- DROP TABLE IF EXISTS public.billing_manual_confirmations;
-- ============================================================


-- ============================================================
-- BAGIAN 1 — billing_manual_confirmations
-- ============================================================

-- 1a. Adopsi DDL ke migration history (idempotent)
--     Tabel ini sebelumnya dibuat manual via Dashboard.
--     CREATE TABLE IF NOT EXISTS aman dijalankan ulang.
--     Akses hanya via service_role di Next.js API route.
--     App pakai custom auth, bukan Supabase Auth.
CREATE TABLE IF NOT EXISTS public.billing_manual_confirmations (
    id               uuid        NOT NULL DEFAULT gen_random_uuid(),
    created_at       timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    username         text,
    amount           numeric     NOT NULL,
    reference_number text        NOT NULL,
    status           text        NOT NULL DEFAULT 'pending'::text,
    bukti_url        text,
    notes            text,
    type             text                 DEFAULT 'perpanjang_web_app'::text,
    CONSTRAINT billing_manual_confirmations_pkey PRIMARY KEY (id)
);

-- Safety net: tambah kolom yang mungkin hilang karena drift dari Dashboard.
-- ADD COLUMN IF NOT EXISTS adalah no-op bila kolom sudah ada — idempotent.
-- Kolom NOT NULL tanpa default di production sudah berisi data, jadi kita
-- beri DEFAULT sementara agar perintah aman bila kolom benar-benar absen.
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS id               uuid        NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS created_at       timestamptz NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS username         text;
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS amount           numeric     NOT NULL DEFAULT 0;
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS reference_number text        NOT NULL DEFAULT '';
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS status           text        NOT NULL DEFAULT 'pending';
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS bukti_url        text;
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS notes            text;
ALTER TABLE public.billing_manual_confirmations ADD COLUMN IF NOT EXISTS type             text        DEFAULT 'perpanjang_web_app';

COMMENT ON TABLE public.billing_manual_confirmations IS
    'Konfirmasi pembayaran manual dari pengguna. '
    'Akses hanya via service_role di Next.js API route. '
    'App pakai custom auth, bukan Supabase Auth.';

-- 1b. Aktifkan RLS
--     Tanpa policy SELECT/INSERT/UPDATE/DELETE untuk anon maupun authenticated
--     = deny-all by default untuk semua non-service_role.
ALTER TABLE public.billing_manual_confirmations ENABLE ROW LEVEL SECURITY;

-- Bersihkan policy permissive yang mungkin terbuat via Dashboard
DROP POLICY IF EXISTS "Allow all for billing_manual_confirmations"
    ON public.billing_manual_confirmations;
DROP POLICY IF EXISTS "Allow all"
    ON public.billing_manual_confirmations;
DROP POLICY IF EXISTS "Enable read access for all users"
    ON public.billing_manual_confirmations;
DROP POLICY IF EXISTS "Allow read for all"
    ON public.billing_manual_confirmations;
-- Tidak membuat policy baru — no policy = deny-all = intended behavior


-- ============================================================
-- BAGIAN 2 — SECURITY INVOKER pada view cockpit
-- ============================================================
-- Supabase Advisor memflag view yang tidak eksplisit menyatakan
-- security_invoker, karena view yang dibuat oleh role postgres
-- (superuser Supabase) dapat berperilaku seperti SECURITY DEFINER
-- secara implisit di beberapa konfigurasi.
--
-- Dengan security_invoker = true, view SELALU dieksekusi dengan
-- hak akses caller (anon/service_role), bukan hak akses owner view.
-- Ini memastikan RLS pada tabel sumber tetap diterapkan.
--
-- Referensi: https://www.postgresql.org/docs/15/sql-alterview.html

-- 2a. v_cockpit_aging dan v_cockpit_top_debtors
--     (dibuat di migration 20260419_cockpit.sql, pasti ada)
ALTER VIEW IF EXISTS public.v_cockpit_aging
    SET (security_invoker = true);

ALTER VIEW IF EXISTS public.v_cockpit_top_debtors
    SET (security_invoker = true);

-- 2b. v_cockpit_stuck_orders (plural — nama resmi dari migration 20260419_cockpit.sql)
ALTER VIEW IF EXISTS public.v_cockpit_stuck_orders SET (security_invoker = true);

-- Safety net: v_cockpit_stuck_order (singular) — jika ada versi yang dibuat manual via Dashboard.
-- Pakai EXECUTE + EXCEPTION agar migration tidak gagal bila view tidak ada.
DO $$
BEGIN
    EXECUTE 'ALTER VIEW public.v_cockpit_stuck_order SET (security_invoker = true)';
EXCEPTION
    WHEN undefined_table THEN NULL;
END $$;
