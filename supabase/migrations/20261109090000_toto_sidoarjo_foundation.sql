-- ============================================================
-- Fondasi Unit Operasional Toto Sidoarjo
--
-- Prinsip keselamatan:
-- 1. Data operasional lama TIDAK dipindahkan dan tidak diubah nominalnya.
-- 2. Semua baris lama hanya diberi penanda `toto_pusat`.
-- 3. Sidoarjo belum menerima data sampai modul masing-masing sudah memakai
--    filter unit dan kebijakan RLS lintas-unit diterapkan.
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

-- Workspace existing Toto dipertahankan sebagai kode historis. Workspace
-- `sidoarjo` ditambahkan agar hak akses cabang dapat diatur dari tabel yang
-- sama, tanpa mengganggu membership Toto dan Alucurv yang sudah berjalan.
ALTER TABLE public.user_workspaces
  DROP CONSTRAINT IF EXISTS user_workspaces_workspace_check;
ALTER TABLE public.user_workspaces
  ADD CONSTRAINT user_workspaces_workspace_check
  CHECK (workspace = ANY (ARRAY['toto'::text, 'sidoarjo'::text, 'alucurv'::text]));

-- Owner saat ini diberi akses awal untuk setup dan pengawasan cabang.
-- Tidak ada user operasional baru yang dibuat oleh migrasi ini.
INSERT INTO public.user_workspaces (user_id, workspace, role)
SELECT id, 'sidoarjo', 'owner'
FROM public.app_users
WHERE role = 'owner'
ON CONFLICT (user_id, workspace) DO NOTHING;

