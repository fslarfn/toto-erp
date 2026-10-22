-- Absensi Alucurv memakai tabel dan bucket foto yang sama dengan Toto.
-- Karyawan Alucurv tetap dipisahkan secara eksplisit melalui workspace + alu_employee_id.

alter table public.absensi
  add column if not exists workspace text not null default 'toto',
  add column if not exists alu_employee_id text;

alter table public.absensi
  alter column karyawan_id drop not null;

alter table public.absensi
  drop constraint if exists absensi_workspace_employee_check;

alter table public.absensi
  add constraint absensi_workspace_employee_check check (
    (workspace = 'toto' and karyawan_id is not null and alu_employee_id is null)
    or
    (workspace = 'alucurv' and alu_employee_id is not null)
  );

alter table public.alu_employees
  add column if not exists attendance_token uuid not null default gen_random_uuid();

create unique index if not exists alu_employees_attendance_token_key
  on public.alu_employees (attendance_token);

create index if not exists idx_absensi_alucurv_employee_tanggal
  on public.absensi (alu_employee_id, tanggal desc)
  where workspace = 'alucurv';

create unique index if not exists uq_absensi_alucurv_employee_hari
  on public.absensi (alu_employee_id, tanggal)
  where workspace = 'alucurv';

-- Kiosk Toto lama tetap publik, tetapi tidak boleh membuka absensi Alucurv.
drop policy if exists "absensi select public" on public.absensi;
drop policy if exists "absensi insert public" on public.absensi;
drop policy if exists "absensi update public" on public.absensi;
drop policy if exists "absensi delete authenticated" on public.absensi;

create policy "absensi kiosk toto select" on public.absensi
  for select to anon, authenticated using (workspace = 'toto');
create policy "absensi kiosk toto insert" on public.absensi
  for insert to anon, authenticated with check (workspace = 'toto');
create policy "absensi kiosk toto update" on public.absensi
  for update to anon, authenticated using (workspace = 'toto') with check (workspace = 'toto');
create policy "absensi toto delete authenticated" on public.absensi
  for delete to authenticated using (workspace = 'toto');
create policy "absensi alucurv manager select" on public.absensi
  for select to authenticated
  using (workspace = 'alucurv' and (auth.jwt() ->> 'user_role') in ('owner', 'alucurv'));
