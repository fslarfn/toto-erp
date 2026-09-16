-- Kalender operasional CV Toto.
-- Referensi hari libur nasional/cuti bersama disimpan terkunci di aplikasi;
-- tabel ini hanya menyimpan keputusan dan agenda internal perusahaan.

create table if not exists public.company_calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace text not null default 'toto' check (workspace = 'toto'),
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '',
  category text not null check (category in (
    'libur_perusahaan','thr_payroll','gathering','maintenance',
    'rapat','deadline','operasional_lain'
  )),
  status text not null default 'rencana' check (status in ('rencana','dikonfirmasi','dibatalkan')),
  start_date date not null,
  end_date date not null,
  audience text not null default 'Semua tim',
  created_by_username text not null default '',
  updated_by_username text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_calendar_events_valid_dates check (end_date >= start_date)
);

create index if not exists company_calendar_events_date_range_idx
  on public.company_calendar_events (start_date, end_date);
create index if not exists company_calendar_events_status_idx
  on public.company_calendar_events (status, start_date);

create or replace function public.stamp_company_calendar_event()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  actor text := coalesce(nullif(auth.jwt() ->> 'username', ''), 'sistem');
begin
  if tg_op = 'INSERT' then
    new.created_by_username := actor;
  else
    new.created_by_username := old.created_by_username;
    new.created_at := old.created_at;
  end if;
  new.updated_by_username := actor;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists company_calendar_events_audit on public.company_calendar_events;
create trigger company_calendar_events_audit
before insert or update on public.company_calendar_events
for each row execute function public.stamp_company_calendar_event();

alter table public.company_calendar_events enable row level security;

drop policy if exists "calendar select authenticated" on public.company_calendar_events;
drop policy if exists "calendar insert faisal" on public.company_calendar_events;
drop policy if exists "calendar update faisal" on public.company_calendar_events;
drop policy if exists "calendar delete faisal" on public.company_calendar_events;

create policy "calendar select authenticated" on public.company_calendar_events
  for select to authenticated using (workspace = 'toto');

create policy "calendar insert faisal" on public.company_calendar_events
  for insert to authenticated
  with check (workspace = 'toto' and lower(auth.jwt() ->> 'username') = 'faisal');

create policy "calendar update faisal" on public.company_calendar_events
  for update to authenticated
  using (workspace = 'toto' and lower(auth.jwt() ->> 'username') = 'faisal')
  with check (workspace = 'toto' and lower(auth.jwt() ->> 'username') = 'faisal');

create policy "calendar delete faisal" on public.company_calendar_events
  for delete to authenticated
  using (workspace = 'toto' and lower(auth.jwt() ->> 'username') = 'faisal');

revoke all on table public.company_calendar_events from anon, authenticated;
grant select, insert, update, delete on table public.company_calendar_events to authenticated;

comment on table public.company_calendar_events is
  'Agenda operasional internal CV Toto. Hanya akun Faisal dapat mengubah; semua user ERP terautentikasi dapat membaca.';
