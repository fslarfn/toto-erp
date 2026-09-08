-- ============================================================
-- created_by pesanan_rows mengikuti user terakhir yang mengubah data
--
-- Migrasi ini mengoreksi aturan audit sebelumnya. created_by tetap diisi
-- saat INSERT, tetapi pada UPDATE nilainya juga diganti dengan nama user
-- terakhir agar kolom tersebut langsung mencerminkan pelaku perubahan.
-- updated_by dan updated_at tetap dipertahankan untuk kompatibilitas UI.
-- ============================================================

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

  actor_name := COALESCE(
    NULLIF(btrim(actor_name), ''),
    NULLIF(initcap(actor_username), ''),
    'Sistem'
  );

  IF TG_OP = 'INSERT' THEN
    NEW.created_by := actor_name;
    NEW.updated_by := '';
    NEW.updated_at := NULL;
  ELSIF NEW IS DISTINCT FROM OLD THEN
    NEW.created_by := actor_name;
    NEW.updated_by := actor_name;
    NEW.updated_at := now();
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON COLUMN public.pesanan_rows.created_by IS
  'Nama user ERP yang membuat atau terakhir mengubah baris; data historis tetap kosong sampai diperbarui.';
