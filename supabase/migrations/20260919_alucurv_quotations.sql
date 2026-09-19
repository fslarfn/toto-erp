-- Penawaran harga khusus workspace Alucurv.
-- Item disimpan sebagai JSONB agar satu dokumen hanya membutuhkan satu query.

create table if not exists public.alu_quotations (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  date date not null,
  customer text not null,
  status text not null default 'DRAFT'
    check (status in ('DRAFT', 'DIKIRIM', 'DISETUJUI', 'DIBATALKAN')),
  items jsonb not null default '[]'::jsonb
    check (jsonb_typeof(items) = 'array'),
  subtotal numeric(16,2) not null default 0 check (subtotal >= 0),
  discount_amount numeric(16,2) not null default 0 check (discount_amount >= 0),
  grand_total numeric(16,2) not null default 0 check (grand_total >= 0),
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_alu_quotations_date
  on public.alu_quotations (date desc);
create index if not exists idx_alu_quotations_customer
  on public.alu_quotations (lower(customer));

create or replace function public.set_alu_quotation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_alu_quotations_updated_at on public.alu_quotations;
create trigger trg_alu_quotations_updated_at
before update on public.alu_quotations
for each row execute function public.set_alu_quotation_updated_at();

alter table public.alu_quotations enable row level security;

revoke all on table public.alu_quotations from anon, authenticated;
grant select, insert, update, delete on table public.alu_quotations to authenticated;

drop policy if exists "alu quotations owner-alucurv" on public.alu_quotations;
create policy "alu quotations owner-alucurv"
on public.alu_quotations
for all
to authenticated
using ((auth.jwt() ->> 'user_role') in ('owner', 'alucurv'))
with check ((auth.jwt() ->> 'user_role') in ('owner', 'alucurv'));

comment on table public.alu_quotations is
  'Surat penawaran harga Alucurv; bukan invoice, omzet, atau tagihan.';
