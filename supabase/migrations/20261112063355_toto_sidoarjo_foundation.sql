-- ============================================================
-- Fondasi Unit Operasional Toto Sidoarjo
-- Semua data historis tetap Toto Pusat; tidak ada transaksi dipindahkan.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.operating_units (
  code text PRIMARY KEY CHECK (code IN ('toto_pusat', 'toto_sidoarjo', 'alucurv')),
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.operating_units (code, name) VALUES
  ('toto_pusat', 'Toto Pusat'),
  ('toto_sidoarjo', 'Toto Sidoarjo'),
  ('alucurv', 'Alucurv')
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name;

ALTER TABLE public.operating_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "operating_units select authenticated" ON public.operating_units;
CREATE POLICY "operating_units select authenticated"
  ON public.operating_units FOR SELECT TO authenticated USING (true);

ALTER TABLE public.user_workspaces
  DROP CONSTRAINT IF EXISTS user_workspaces_workspace_check;
ALTER TABLE public.user_workspaces
  ADD CONSTRAINT user_workspaces_workspace_check
  CHECK (workspace = ANY (ARRAY['toto'::text, 'sidoarjo'::text, 'alucurv'::text]));

INSERT INTO public.user_workspaces (user_id, workspace, role)
SELECT id, 'sidoarjo', 'owner'
FROM public.app_users
WHERE role = 'owner'
ON CONFLICT (user_id, workspace) DO NOTHING;

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
