-- ============================================================
-- KUESIONER TIM (meeting bulanan Juli 2026)
-- Link pribadi per orang (token unik) → jawaban hanya bisa
-- dibaca owner dari /dashboard/kuesioner.
-- Jalankan di Supabase SQL Editor.
-- ============================================================

create table if not exists kuesioner_responses (
  id uuid primary key default gen_random_uuid(),
  token uuid unique not null default gen_random_uuid(),
  nama text not null,
  bagian text not null,
  answers jsonb not null default '{}'::jsonb,
  submitted_at timestamptz,
  created_at timestamptz default now(),
  unique (nama, bagian)
);

-- RLS aktif TANPA policy apa pun:
-- anon & authenticated tidak bisa baca/tulis sama sekali;
-- semua akses lewat server route (service role) yang memvalidasi token.
alter table kuesioner_responses enable row level security;

-- Seed satu baris per orang (token dibuat otomatis)
insert into kuesioner_responses (nama, bagian) values
  ('Vira',   'admin_finance'),
  ('Yuni',   'admin_barang'),
  ('Fadly',  'pic_produksi'),
  ('Dika',   'pic_gudang'),
  ('Toto',   'marketing'),
  ('Livia',  'marketing'),
  ('Febri',  'marketing_alucurv'),
  ('Iva',    'admin_finance_alucurv'),
  ('Faisal', 'owner'),
  ('Fauzi',  'owner'),
  ('Toto',   'owner')
on conflict (nama, bagian) do nothing;
