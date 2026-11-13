-- Every operational table remains in the shared database, but reads and writes
-- are restricted to the caller's assigned workspace. Existing role policies
-- continue to decide what the user can do; this RESTRICTIVE policy adds the
-- non-bypassable business-unit boundary.

CREATE OR REPLACE FUNCTION public.can_access_operating_unit(unit_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, auth
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.user_workspaces uw
      WHERE uw.user_id = (select auth.uid())
        AND uw.workspace = CASE unit_code
          WHEN 'toto_pusat' THEN 'toto'
          WHEN 'toto_sidoarjo' THEN 'sidoarjo'
          WHEN 'alucurv' THEN 'alucurv'
          ELSE NULL
        END
    );
$$;

REVOKE ALL ON FUNCTION public.can_access_operating_unit(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_operating_unit(text) TO authenticated;

DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'pesanan_rows', 'cash_flow', 'bank_accounts', 'materials', 'customers',
    'karyawan', 'gaji', 'kasbon', 'absensi', 'quotations', 'surat_jalan',
    'tagihan_bahan'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('DROP POLICY IF EXISTS operating_unit_membership_gate ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY operating_unit_membership_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.can_access_operating_unit(operating_unit)) WITH CHECK (public.can_access_operating_unit(operating_unit))',
      target_table
    );
  END LOOP;
END
$$;

-- The public Toto attendance kiosk only needs Pusat employees. Keeping this
-- explicit prevents future Sidoarjo employee records from leaking anonymously.
DROP POLICY IF EXISTS "karyawan select public" ON public.karyawan;
CREATE POLICY "karyawan select public"
  ON public.karyawan
  FOR SELECT
  TO anon, authenticated
  USING (operating_unit = 'toto_pusat');
