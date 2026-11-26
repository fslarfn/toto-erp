CREATE ROLE sidoarjo_manager NOLOGIN NOINHERIT NOBYPASSRLS;
GRANT sidoarjo_manager TO authenticator;
GRANT USAGE ON SCHEMA public, auth TO sidoarjo_manager;

ALTER TABLE public.app_users DROP CONSTRAINT app_users_role_check_v2;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_role_check_v2 CHECK (
  role IN ('owner', 'finance', 'sales', 'produksi', 'barang', 'finishing', 'alucurv', 'sidoarjo_manager')
);

CREATE TABLE public.sidoarjo_manager_credentials (
  user_id uuid PRIMARY KEY REFERENCES public.app_users(id) ON DELETE CASCADE,
  password_hash text NOT NULL
);
ALTER TABLE public.sidoarjo_manager_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sidoarjo_manager_credentials FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.sidoarjo_manager_credentials TO service_role;

GRANT SELECT ON public.user_workspaces TO sidoarjo_manager;
CREATE POLICY sidoarjo_manager_membership ON public.user_workspaces
  FOR SELECT TO sidoarjo_manager
  USING (user_id = (SELECT auth.uid()) AND workspace = 'sidoarjo' AND role = 'manager');

DO $branch$
DECLARE
  entry record;
  seq record;
BEGIN
  FOR entry IN
    SELECT * FROM (VALUES
      ('absensi', 'SELECT, INSERT, UPDATE, DELETE', $$operating_unit = 'toto_sidoarjo' AND EXISTS (SELECT 1 FROM public.karyawan k WHERE k.id = absensi.karyawan_id)$$),
      ('bank_accounts', 'SELECT, INSERT', $$operating_unit = 'toto_sidoarjo'$$),
      ('cash_flow', 'SELECT, INSERT', $$operating_unit = 'toto_sidoarjo' AND EXISTS (SELECT 1 FROM public.bank_accounts a WHERE a.id = cash_flow.account_id)$$),
      ('gaji', 'SELECT, INSERT', $$operating_unit = 'toto_sidoarjo' AND EXISTS (SELECT 1 FROM public.karyawan k WHERE k.id = gaji.karyawan_id)$$),
      ('invoice_adjustments', 'SELECT, INSERT, UPDATE', $$invoice_number LIKE 'SIDOARJO:%'$$),
      ('karyawan', 'SELECT, INSERT', $$operating_unit = 'toto_sidoarjo'$$),
      ('materials', 'SELECT, INSERT, UPDATE', $$operating_unit = 'toto_sidoarjo'$$),
      ('pesanan_rows', 'SELECT, INSERT, UPDATE', $$operating_unit = 'toto_sidoarjo'$$),
      ('surat_jalan', 'SELECT, INSERT, UPDATE', $$operating_unit = 'toto_sidoarjo'$$)
    ) AS allowed(table_name, privileges, row_filter)
  LOOP
    EXECUTE format('GRANT %s ON public.%I TO sidoarjo_manager', entry.privileges, entry.table_name);
    EXECUTE format(
      'CREATE POLICY sidoarjo_manager_scope ON public.%I AS RESTRICTIVE FOR ALL TO sidoarjo_manager USING ((%s) AND (SELECT EXISTS (SELECT 1 FROM public.user_workspaces)))',
      entry.table_name, entry.row_filter
    );
    EXECUTE format('CREATE POLICY sidoarjo_manager_rows ON public.%I FOR ALL TO sidoarjo_manager USING (true)', entry.table_name);
    FOR seq IN
      SELECT dep.objid::regclass AS sequence_name
      FROM pg_depend dep
      JOIN pg_class c ON c.oid = dep.objid AND c.relkind = 'S'
      WHERE dep.classid = 'pg_class'::regclass
        AND dep.refclassid = 'pg_class'::regclass
        AND dep.refobjid = to_regclass(format('public.%I', entry.table_name))
        AND dep.deptype IN ('a', 'i')
    LOOP
      EXECUTE format('GRANT USAGE ON SEQUENCE %s TO sidoarjo_manager', seq.sequence_name);
    END LOOP;
  END LOOP;
END;
$branch$;

