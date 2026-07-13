-- ============================================================
-- SKEMA ALUCURV ERP — diadaptasi dari alucurv-legacy/supabase/schema.sql
-- Semua tabel diberi prefix alu_ agar terisolasi total dari tabel Toto
-- yang sudah berjalan di production (tidak ada nama yang bentrok).
-- Jalankan di Supabase SQL Editor (project yang sama dengan Toto).
-- ============================================================

-- ---------- Master ----------
create table if not exists alu_accounts (
  id text primary key,
  name text not null,
  type text not null check (type in ('cash','bank','marketplace')),
  opening_balance numeric not null default 0
);

create table if not exists alu_sub_categories (
  id text primary key,
  type text not null check (type in ('Pemasukan','Pengeluaran')),
  name text not null
);

create table if not exists alu_suppliers (
  id text primary key,
  name text not null
);

-- Karyawan Alucurv sengaja TERPISAH dari tabel karyawan Toto (keputusan bisnis).
create table if not exists alu_employees (
  id text primary key,
  name text not null,
  role text,
  division text check (division in ('Produksi','Admin','Marketing')),
  weekly_base numeric not null default 0,
  active boolean not null default true
);

-- ---------- Keuangan ----------
create table if not exists alu_transactions (
  id text primary key,
  date date not null,
  description text not null,
  type text not null check (type in ('Pemasukan','Pengeluaran')),
  sub_category_id text references alu_sub_categories(id) on delete set null,
  amount numeric not null default 0,
  account_id text references alu_accounts(id) on delete set null,
  note text
);
create index if not exists idx_alu_transactions_date on alu_transactions(date);
create index if not exists idx_alu_transactions_account on alu_transactions(account_id);

-- ---------- Order ----------
create table if not exists alu_orders (
  id text primary key,
  date date not null,
  invoice_id text,
  customer text not null,
  description text,
  channel text not null check (channel in ('Shopee','TikTokShop','Offline')),
  deadline date,
  price numeric not null default 0,
  expedition text,
  produksi boolean not null default false,
  perakitan boolean not null default false,
  packing boolean not null default false,
  dikirim boolean not null default false,
  sampai boolean not null default false
);

-- ---------- Invoice ----------
create table if not exists alu_invoices (
  id text primary key,
  number text not null,
  date date not null,
  customer text not null,
  status text not null check (status in ('LUNAS','DP','BELUM')),
  dp_amount numeric,
  paid_date date,
  payment text check (payment in ('TRANSFER','CASH')),
  note text
);

create table if not exists alu_invoice_items (
  id text primary key,
  invoice_id text not null references alu_invoices(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0
);

-- ---------- Surat Jalan ----------
create table if not exists alu_delivery_notes (
  id text primary key,
  number text not null,
  date date not null,
  customer text not null
);

create table if not exists alu_delivery_note_items (
  id text primary key,
  delivery_note_id text not null references alu_delivery_notes(id) on delete cascade,
  description text not null,
  qty numeric not null default 1
);

-- ---------- HPP ----------
create table if not exists alu_hpp_calculations (
  id text primary key,
  product_name text not null,
  market_cut_percent numeric not null default 0,
  current_price numeric not null default 0
);

create table if not exists alu_hpp_components (
  id text primary key,
  hpp_id text not null references alu_hpp_calculations(id) on delete cascade,
  name text not null,
  note text,
  cost numeric not null default 0,
  sell_price numeric not null default 0
);

-- ---------- Pengadaan ----------
create table if not exists alu_purchases (
  id text primary key,
  date date not null,
  supplier_id text references alu_suppliers(id) on delete set null,
  item_code text,
  item_name text not null,
  size text,
  unit_price numeric not null default 0,
  qty numeric not null default 1,
  qty_label text,
  total numeric not null default 0,
  account_id text references alu_accounts(id) on delete set null
);

-- ---------- Stok ----------
create table if not exists alu_stock_items (
  id text primary key,
  code text not null,
  name text not null,
  category text not null check (category in ('Produk','Consumable')),
  min_stock numeric not null default 0,
  opening_stock numeric not null default 0
);

create table if not exists alu_stock_movements (
  id text primary key,
  date date not null,
  item_id text not null references alu_stock_items(id) on delete cascade,
  type text not null check (type in ('masuk','keluar')),
  qty numeric not null default 0,
  note text
);

-- ---------- Bending (CV Toto adalah vendor bending Alucurv) ----------
create table if not exists alu_bending_orders (
  id text primary key,
  date date not null,
  inv_no text not null,
  amount numeric not null default 0,
  status text not null check (status in ('LUNAS','BELUM')),
  note text
);

-- ---------- HR (terpisah dari karyawan Toto) ----------
create table if not exists alu_attendance (
  id text primary key,
  date date not null,
  employee_id text not null references alu_employees(id) on delete cascade,
  status text not null check (status in ('MASUK','LIBUR','TIDAK MASUK')),
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0
);

create table if not exists alu_salaries (
  id text primary key,
  employee_id text not null references alu_employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  base numeric not null default 0,
  overtime numeric not null default 0,
  meal numeric not null default 0,
  jht numeric not null default 0,
  bpjs numeric not null default 0,
  bon_deduction numeric not null default 0,
  note text
);

create table if not exists alu_cashbons (
  id text primary key,
  date date not null,
  employee_id text not null references alu_employees(id) on delete cascade,
  amount numeric not null default 0,
  installment numeric not null default 0,
  note text
);

create table if not exists alu_cashbon_payments (
  id text primary key,
  cashbon_id text not null references alu_cashbons(id) on delete cascade,
  date date not null,
  amount numeric not null default 0
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Mengikuti pola yang sudah dipakai Toto (app_users, user_workspaces):
-- RLS aktif tapi permissive — otorisasi sesungguhnya ditegakkan di
-- application layer (middleware + session), bukan di level Postgres.
-- ============================================================
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'alu_accounts','alu_sub_categories','alu_suppliers','alu_employees',
      'alu_transactions','alu_orders','alu_invoices','alu_invoice_items',
      'alu_delivery_notes','alu_delivery_note_items','alu_hpp_calculations',
      'alu_hpp_components','alu_purchases','alu_stock_items','alu_stock_movements',
      'alu_bending_orders','alu_attendance','alu_salaries','alu_cashbons',
      'alu_cashbon_payments'
    ])
  loop
    execute format('alter table %I enable row level security;', t);
    execute format(
      'drop policy if exists "Allow all" on %I;', t
    );
    execute format(
      'create policy "Allow all" on %I for all using (true) with check (true);', t
    );
  end loop;
end $$;
