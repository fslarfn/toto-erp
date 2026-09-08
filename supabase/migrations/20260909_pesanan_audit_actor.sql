-- ============================================================
-- Audit pembuat dan pengedit pesanan_rows
-- Nama diambil dari sesi ERP/Supabase JWT, bukan input bebas dari browser.
-- Baris historis tidak ditebak identitasnya dan tetap kosong sampai diedit.
-- ============================================================

ALTER TABLE public.pesanan_rows
  ADD COLUMN IF NOT EXISTS created_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

CREATE OR REPLACE FUNCTION public.stamp_pesanan_row_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor_username text := COALESCE(auth.jwt() ->> 'username', '');
  actor_name text := '';
BEGIN
  IF actor_username <> '' THEN
    SELECT COALESCE(NULLIF(btrim(u.name), ''), u.username)
      INTO actor_name
    FROM public.app_users u
    WHERE lower(u.username) = lower(actor_username)
    LIMIT 1;
  END IF;

  actor_name := COALESCE(NULLIF(btrim(actor_name), ''), NULLIF(initcap(actor_username), ''), 'Sistem');

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := actor_name;
    NEW.updated_by := '';
    NEW.updated_at := NULL;
  ELSE
    -- Identitas pembuat tidak boleh berubah ketika baris diedit.
    NEW.created_by := OLD.created_by;
    NEW.updated_by := actor_name;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pesanan_row_audit ON public.pesanan_rows;
CREATE TRIGGER trg_pesanan_row_audit
BEFORE INSERT OR UPDATE ON public.pesanan_rows
FOR EACH ROW EXECUTE FUNCTION public.stamp_pesanan_row_audit();

COMMENT ON COLUMN public.pesanan_rows.created_by IS 'Nama user ERP yang membuat baris; kosong pada data historis sebelum audit aktif.';
COMMENT ON COLUMN public.pesanan_rows.updated_by IS 'Nama user ERP yang terakhir mengedit baris.';
COMMENT ON COLUMN public.pesanan_rows.updated_at IS 'Waktu perubahan terakhir yang dilakukan setelah audit aktif.';
