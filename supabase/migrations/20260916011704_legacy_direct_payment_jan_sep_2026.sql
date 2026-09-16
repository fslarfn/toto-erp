-- Masa transisi pelunasan historis:
-- - Riska/Rieska, Yuni, dan Vira boleh menandai lunas langsung untuk
--   pesanan tanggal 1 Januari s.d. 30 September 2026.
-- - Mulai 1 Oktober 2026 semua perubahan is_paid tetap wajib berasal dari
--   Rekonsiliasi Pembayaran.
-- - Pengecualian hanya mengizinkan false -> true. Pembatalan lunas tetap
--   melalui rekonsiliasi agar alokasi penerimaan tidak menjadi yatim.

CREATE OR REPLACE FUNCTION guard_manual_invoice_paid_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_username text := lower(btrim(COALESCE(auth.jwt()->>'username', '')));
  invoice_date text := left(btrim(COALESCE(OLD.tanggal::text, '')), 10);
  is_legacy_direct_mark boolean := false;
BEGIN
  is_legacy_direct_mark :=
    NOT COALESCE(OLD.is_paid, false)
    AND COALESCE(NEW.is_paid, false)
    AND actor_username IN ('riska', 'rieska', 'yuni', 'vira')
    AND invoice_date ~ '^\d{4}-\d{2}-\d{2}$'
    AND invoice_date BETWEEN '2026-01-01' AND '2026-09-30';

  IF NEW.is_paid IS DISTINCT FROM OLD.is_paid
    AND COALESCE(current_setting('app.payment_reconciliation_sync', true), '') <> 'on'
    AND NOT is_legacy_direct_mark THEN
    RAISE EXCEPTION 'Status pembayaran dikelola melalui Rekonsiliasi Pembayaran';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION guard_manual_invoice_paid_status() FROM PUBLIC;
