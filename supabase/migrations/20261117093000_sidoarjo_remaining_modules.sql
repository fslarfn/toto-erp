-- Isolasi data cabang untuk modul yang sebelumnya belum memiliki penanda unit.
-- Semua data lama dipertahankan sebagai Toto Pusat; tidak ada penghapusan atau pemindahan data.

alter table public.sj_bahan
  add column if not exists operating_unit text not null default 'toto_pusat'
  references public.operating_units(code);

create index if not exists sj_bahan_operating_unit_tanggal_idx
  on public.sj_bahan (operating_unit, tanggal desc);

-- Tabel ini sudah memakai workspace, sehingga cabang menggunakan nilai `toto_sidoarjo`.
create index if not exists product_hpp_workspace_updated_idx
  on public.product_hpp (workspace, updated_at desc);

create index if not exists tax_transactions_workspace_period_idx
  on public.tax_transactions (workspace, tax_period desc);

comment on column public.sj_bahan.operating_unit is
  'Unit operasional pemilik surat jalan bahan. Data lama tetap toto_pusat.';
