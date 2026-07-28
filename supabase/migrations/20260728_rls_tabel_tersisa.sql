-- ============================================================
-- 20260728_rls_tabel_tersisa.sql
-- Tindak lanjut email Supabase Security Advisor 26 Jul 2026:
-- "CRITICAL — Table publicly accessible (rls_disabled_in_public)"
-- di project totobasedata.
--
-- Menutup SEMUA tabel public yang belum ber-RLS. Melengkapi seri
-- 20260720_rls_* (payroll, customers, keuangan, alucurv) yang sudah
-- jalan di produksi, dengan pola yang sama:
--   - Klien browser login membawa token `authenticated` (klaim
--     user_role) via /api/auth/supabase-token.
--   - `anon` (publishable key publik) diblokir, KECUALI kebutuhan
--     halaman publik tanpa login:
--       /absen/[id]  → kiosk absensi: baca karyawan/izin_absensi,
--                      tulis absensi (masuk/pulang).
--       /invoice/[id] → baca billing_history.
--   - API routes server pakai SERVICE_ROLE_KEY → bypass RLS, aman.
--
-- Idempoten: tiap blok menghapus policy lama tabel tsb (termasuk
-- "Allow all" warisan schema awal) lalu membuat set policy final.
-- Tabel yang tidak ada di DB dilewati (guard to_regclass).
--
-- Jalankan di Supabase → SQL Editor. Setelah itu buka
-- Advisors → Security Advisor → Refresh untuk verifikasi.
-- ============================================================

-- ── VERIFIKASI AWAL (opsional, jalankan dulu untuk lihat tabel
--    yang masih terbuka — inilah yang dikeluhkan email Supabase):
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND NOT rowsecurity
--   ORDER BY tablename;

-- ------------------------------------------------------------
-- Helper: hapus semua policy lama sebuah tabel (dipakai inline
-- di tiap blok; policy lama umumnya "Allow all ..." USING true)
-- ------------------------------------------------------------

-- ============================================================
-- TIER 1 — Tabel ERP internal: HANYA user login (role apa pun).
-- Anon diblokir total. Konvensi sama dgn messages/notifications.
-- ============================================================
do $$
declare
  t text;
  p record;
begin
  for t in
    select unnest(array[
      'pesanan_rows','orders','materials','quotations',
      'surat_jalan','surat_jalan_items',
      'sj_bahan','sj_bahan_items',
      'tagihan_bahan','tagihan_bahan_items',
      'internal_notes','production_logs','finishing_checks'
    ])
  loop
    if to_regclass('public.' || t) is null then
      raise notice 'lewati % (tabel tidak ada)', t; continue;
    end if;
    execute format('alter table %I enable row level security;', t);
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on %I;', p.policyname, t);
    end loop;
    execute format(
      'create policy "authenticated all" on %I for all to authenticated '
      || 'using (true) with check (true);', t);
  end loop;
end $$;

-- ============================================================
-- TIER 2 — Tabel yang dibutuhkan kiosk publik /absen/[id]
-- (halaman absen karyawan berjalan TANPA login = role anon).
-- ============================================================

-- karyawan: kiosk hanya BACA daftar karyawan; tulis harus login.
do $$
declare p record;
begin
  if to_regclass('public.karyawan') is null then return; end if;
  alter table karyawan enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'karyawan' loop
    execute format('drop policy %I on karyawan;', p.policyname);
  end loop;
  create policy "karyawan select public" on karyawan
    for select to anon, authenticated using (true);
  create policy "karyawan write authenticated" on karyawan
    for insert to authenticated with check (true);
  create policy "karyawan update authenticated" on karyawan
    for update to authenticated using (true) with check (true);
  create policy "karyawan delete authenticated" on karyawan
    for delete to authenticated using (true);
end $$;

-- absensi: kiosk perlu BACA (cek sudah absen), INSERT (absen masuk),
-- UPDATE (absen pulang). DELETE hanya dari dashboard (login).
do $$
declare p record;
begin
  if to_regclass('public.absensi') is null then return; end if;
  alter table absensi enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'absensi' loop
    execute format('drop policy %I on absensi;', p.policyname);
  end loop;
  create policy "absensi select public" on absensi
    for select to anon, authenticated using (true);
  create policy "absensi insert public" on absensi
    for insert to anon, authenticated with check (true);
  create policy "absensi update public" on absensi
    for update to anon, authenticated using (true) with check (true);
  create policy "absensi delete authenticated" on absensi
    for delete to authenticated using (true);
end $$;

-- izin_absensi: kiosk ikut membacanya (absensi-store); tulis login.
do $$
declare p record;
begin
  if to_regclass('public.izin_absensi') is null then return; end if;
  alter table izin_absensi enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'izin_absensi' loop
    execute format('drop policy %I on izin_absensi;', p.policyname);
  end loop;
  create policy "izin select public" on izin_absensi
    for select to anon, authenticated using (true);
  create policy "izin write authenticated" on izin_absensi
    for insert to authenticated with check (true);
  create policy "izin update authenticated" on izin_absensi
    for update to authenticated using (true) with check (true);
  create policy "izin delete authenticated" on izin_absensi
    for delete to authenticated using (true);
end $$;

-- ============================================================
-- TIER 3 — Tabel sensitif / khusus.
-- ============================================================

-- app_users: berisi password_hash → paling kritis.
-- BACA hanya user login (dipakai ChatOrderBox: select id,name +
-- join name,avatar). TULIS tidak ada policy = hanya server
-- (login, change-password, profile lewat service_role).
-- Kolom password_hash di-REVOKE dari anon & authenticated agar
-- user login pun tidak bisa menarik hash lewat REST.
do $$
declare p record;
begin
  if to_regclass('public.app_users') is null then return; end if;
  alter table app_users enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'app_users' loop
    execute format('drop policy %I on app_users;', p.policyname);
  end loop;
  create policy "app_users select authenticated" on app_users
    for select to authenticated using (true);
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'app_users'
               and column_name = 'password_hash') then
    revoke select (password_hash) on app_users from anon, authenticated;
  end if;
end $$;

-- app_config: info lisensi. BACA user login (LicenseProvider);
-- di halaman publik gagal baca → license null, tidak masalah
-- (gating lisensi hanya di /dashboard). TULIS server-only.
do $$
declare p record;
begin
  if to_regclass('public.app_config') is null then return; end if;
  alter table app_config enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'app_config' loop
    execute format('drop policy %I on app_config;', p.policyname);
  end loop;
  create policy "app_config select authenticated" on app_config
    for select to authenticated using (true);
end $$;

-- billing_history: /invoice/[id] adalah halaman publik (bukti
-- pembayaran) → SELECT tetap terbuka utk anon. TULIS server-only.
do $$
declare p record;
begin
  if to_regclass('public.billing_history') is null then return; end if;
  alter table billing_history enable row level security;
  for p in select policyname from pg_policies
           where schemaname = 'public' and tablename = 'billing_history' loop
    execute format('drop policy %I on billing_history;', p.policyname);
  end loop;
  create policy "billing_history select public" on billing_history
    for select to anon, authenticated using (true);
end $$;

-- push_subscriptions: endpoint push + kunci p256dh/auth per user.
-- HANYA diakses API routes (service_role) → RLS tanpa policy =
-- deny-all untuk anon & authenticated (pola billing_manual_confirmations).
do $$
begin
  if to_regclass('public.push_subscriptions') is null then return; end if;
  alter table push_subscriptions enable row level security;
end $$;

-- ============================================================
-- VERIFIKASI AKHIR:
--   1) Tidak boleh ada baris:
--      SELECT tablename FROM pg_tables
--      WHERE schemaname = 'public' AND NOT rowsecurity;
--   2) Cek policy:
--      SELECT tablename, policyname, roles, cmd FROM pg_policies
--      WHERE schemaname = 'public' ORDER BY tablename, policyname;
--   3) Uji anon (harus 0 baris / 401):
--      curl "https://jsezyvrxhgpdbitxaezn.supabase.co/rest/v1/app_users?select=id" \
--        -H "apikey: <ANON_KEY>"
-- ============================================================

-- ============================================================
-- ROLLBACK (bila ada halaman bermasalah — kembalikan per tabel):
--   -- contoh utk satu tabel:
--   -- DROP POLICY IF EXISTS "authenticated all" ON pesanan_rows;
--   -- CREATE POLICY "Allow all" ON pesanan_rows
--   --   FOR ALL USING (true) WITH CHECK (true);
--   -- (JANGAN disable RLS — cukup pasang policy allow-all sementara)
--   -- Khusus app_users bila join nama/avatar bermasalah:
--   -- GRANT SELECT (password_hash) ON app_users TO authenticated; -- TIDAK disarankan
-- ============================================================
