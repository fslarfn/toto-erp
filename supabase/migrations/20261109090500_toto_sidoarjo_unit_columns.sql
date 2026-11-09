-- Tahap 2: penanda unit pada sumber data Toto. Semua data historis otomatis
-- tetap `toto_pusat`; tidak ada transaksi, nominal, atau status yang diubah.

ALTER TABLE public.pesanan_rows ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.cash_flow ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.bank_accounts ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.karyawan ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.gaji ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.kasbon ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.absensi ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.quotations ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.surat_jalan ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);
ALTER TABLE public.tagihan_bahan ADD COLUMN IF NOT EXISTS operating_unit text NOT NULL DEFAULT 'toto_pusat'
  REFERENCES public.operating_units(code);

CREATE INDEX IF NOT EXISTS idx_pesanan_rows_operating_unit_tanggal ON public.pesanan_rows (operating_unit, tanggal);
CREATE INDEX IF NOT EXISTS idx_cash_flow_operating_unit_date ON public.cash_flow (operating_unit, date);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_operating_unit ON public.bank_accounts (operating_unit);
CREATE INDEX IF NOT EXISTS idx_materials_operating_unit ON public.materials (operating_unit);
CREATE INDEX IF NOT EXISTS idx_karyawan_operating_unit ON public.karyawan (operating_unit);
CREATE INDEX IF NOT EXISTS idx_absensi_operating_unit_tanggal ON public.absensi (operating_unit, tanggal);

COMMENT ON COLUMN public.pesanan_rows.operating_unit IS 'Penanda unit operasional. Semua data historis Toto Pusat tetap toto_pusat.';
COMMENT ON COLUMN public.cash_flow.operating_unit IS 'Penanda unit kas/bank. Dipakai saat modul Keuangan Sidoarjo dirilis.';
