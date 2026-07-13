-- ============================================================
-- SKEMA DATABASE ALUCURV ERP (Supabase / PostgreSQL)
-- Struktur 1:1 dengan lib/types.ts.
-- Jalankan di SQL Editor Supabase, lalu ganti implementasi
-- insert/update/remove di lib/store.tsx dengan panggilan
-- supabase.from(...).
-- ============================================================

-- ---------- Master ----------
create table if not exists accounts (
  id text primary key,
  name text not null,
  type text not null check (type in ('cash','bank','marketplace')),
  opening_balance numeric not null default 0
);

create table if not exists sub_categories (
  id text primary key,
  type text not null check (type in ('Pemasukan','Pengeluaran')),
  name text not null
);

create table if not exists suppliers (
  id text primary key,
  name text not null
);

create table if not exists employees (
  id text primary key,
  name text not null,
  role text,
  division text check (division in ('Produksi','Admin','Marketing')),
  weekly_base numeric not null default 0,
  active boolean not null default true
);

-- ---------- Keuangan ----------
create table if not exists transactions (
  id text primary key,
  date date not null,
  description text not null,
  type text not null check (type in ('Pemasukan','Pengeluaran')),
  sub_category_id text references sub_categories(id) on delete set null,
  amount numeric not null default 0,
  account_id text references accounts(id) on delete set null,
  note text
);
create index if not exists idx_transactions_date on transactions(date);
create index if not exists idx_transactions_account on transactions(account_id);

-- ---------- Order ----------
create table if not exists orders (
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
create table if not exists invoices (
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

create table if not exists invoice_items (
  id text primary key,
  invoice_id text not null references invoices(id) on delete cascade,
  description text not null,
  qty numeric not null default 1,
  unit_price numeric not null default 0
);

-- ---------- Surat Jalan ----------
create table if not exists delivery_notes (
  id text primary key,
  number text not null,
  date date not null,
  customer text not null
);

create table if not exists delivery_note_items (
  id text primary key,
  delivery_note_id text not null references delivery_notes(id) on delete cascade,
  description text not null,
  qty numeric not null default 1
);

-- ---------- HPP ----------
create table if not exists hpp_calculations (
  id text primary key,
  product_name text not null,
  market_cut_percent numeric not null default 0,
  current_price numeric not null default 0
);

create table if not exists hpp_components (
  id text primary key,
  hpp_id text not null references hpp_calculations(id) on delete cascade,
  name text not null,
  note text,
  cost numeric not null default 0,
  sell_price numeric not null default 0
);

-- ---------- Pengadaan ----------
create table if not exists purchases (
  id text primary key,
  date date not null,
  supplier_id text references suppliers(id) on delete set null,
  item_code text,
  item_name text not null,
  size text,
  unit_price numeric not null default 0,
  qty numeric not null default 1,
  qty_label text,
  total numeric not null default 0,
  account_id text references accounts(id) on delete set null
);

-- ---------- Stok ----------
create table if not exists stock_items (
  id text primary key,
  code text not null,
  name text not null,
  category text not null check (category in ('Produk','Consumable')),
  min_stock numeric not null default 0,
  opening_stock numeric not null default 0
);

create table if not exists stock_movements (
  id text primary key,
  date date not null,
  item_id text not null references stock_items(id) on delete cascade,
  type text not null check (type in ('masuk','keluar')),
  qty numeric not null default 0,
  note text
);

-- ---------- Bending ----------
create table if not exists bending_orders (
  id text primary key,
  date date not null,
  inv_no text not null,
  amount numeric not null default 0,
  status text not null check (status in ('LUNAS','BELUM')),
  note text
);

-- ---------- HR ----------
create table if not exists attendance (
  id text primary key,
  date date not null,
  employee_id text not null references employees(id) on delete cascade,
  status text not null check (status in ('MASUK','LIBUR','TIDAK MASUK')),
  regular_hours numeric not null default 0,
  overtime_hours numeric not null default 0
);

create table if not exists salaries (
  id text primary key,
  employee_id text not null references employees(id) on delete cascade,
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

create table if not exists cashbons (
  id text primary key,
  date date not null,
  employee_id text not null references employees(id) on delete cascade,
  amount numeric not null default 0,
  installment numeric not null default 0,
  note text
);

create table if not exists cashbon_payments (
  id text primary key,
  cashbon_id text not null references cashbons(id) on delete cascade,
  date date not null,
  amount numeric not null default 0
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- Contoh sederhana: aktifkan RLS dan izinkan hanya user login.
-- Sesuaikan dengan kebutuhan (mis. per-organisasi) sebelum produksi.
-- ============================================================
-- Aktifkan RLS untuk semua tabel:
--   alter table accounts enable row level security;
--   ... (ulangi untuk tiap tabel)
-- Lalu buat policy, contoh untuk user terautentikasi:
--   create policy "authenticated full access" on accounts
--     for all to authenticated using (true) with check (true);
--
-- Untuk demo cepat (TIDAK untuk produksi) kamu bisa pakai anon key
-- dengan policy using(true). Jangan lakukan ini bila data sensitif.
