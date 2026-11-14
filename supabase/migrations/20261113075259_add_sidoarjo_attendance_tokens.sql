-- Personal, opaque attendance links for the Sidoarjo operating unit.
-- Existing employee and attendance data are not modified.
ALTER TABLE public.karyawan
  ADD COLUMN IF NOT EXISTS attendance_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_karyawan_attendance_token_unique
  ON public.karyawan (attendance_token)
  WHERE attendance_token IS NOT NULL;

UPDATE public.karyawan
SET attendance_token = gen_random_uuid()::text
WHERE operating_unit = 'toto_sidoarjo'
  AND attendance_token IS NULL;

CREATE OR REPLACE FUNCTION public.assign_sidoarjo_attendance_token()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.operating_unit = 'toto_sidoarjo' AND NEW.attendance_token IS NULL THEN
    NEW.attendance_token := gen_random_uuid()::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_sidoarjo_attendance_token ON public.karyawan;
CREATE TRIGGER trg_assign_sidoarjo_attendance_token
  BEFORE INSERT OR UPDATE OF operating_unit, attendance_token ON public.karyawan
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_sidoarjo_attendance_token();

-- A Sidoarjo employee can have only one attendance row per day.
CREATE UNIQUE INDEX IF NOT EXISTS idx_absensi_sidoarjo_employee_day
  ON public.absensi (operating_unit, karyawan_id, tanggal)
  WHERE operating_unit = 'toto_sidoarjo'
    AND karyawan_id IS NOT NULL;
