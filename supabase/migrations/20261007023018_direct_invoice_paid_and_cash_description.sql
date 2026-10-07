-- Manual settlement changes status only. It never inserts cash or journal entries.
CREATE OR REPLACE FUNCTION public.guard_manual_invoice_paid_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  allowed_actor boolean :=
    coalesce(auth.jwt()->>'user_role','') IN ('owner','finance')
    OR lower(btrim(coalesce(auth.jwt()->>'username',''))) IN ('riska','rieska','yuni','vira');
BEGIN
  IF NEW.is_paid IS DISTINCT FROM OLD.is_paid
     AND coalesce(current_setting('app.payment_reconciliation_sync',true),'') <> 'on'
     AND NOT (allowed_actor AND NOT coalesce(OLD.is_paid,false) AND coalesce(NEW.is_paid,false))
  THEN
    RAISE EXCEPTION 'Hanya admin berwenang dapat menandai lunas. Pembatalan memerlukan koreksi pembayaran.';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.mark_customer_invoice_paid(p_invoice text, p_customer text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  affected integer;
BEGIN
  IF NOT (
    coalesce(auth.jwt()->>'user_role','') IN ('owner','finance')
    OR lower(btrim(coalesce(auth.jwt()->>'username',''))) IN ('riska','rieska','yuni','vira')
  ) THEN
    RAISE EXCEPTION 'Tidak berwenang menandai invoice lunas';
  END IF;
  IF nullif(btrim(p_invoice),'') IS NULL OR p_customer IS NULL THEN
    RAISE EXCEPTION 'Invoice dan customer wajib diisi';
  END IF;
  -- Lock the full invoice, not just rows loaded on the current browser page.
  PERFORM id FROM public.pesanan_rows
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
  IF EXISTS (SELECT 1 FROM public.pesanan_rows
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice))
      AND coalesce(customer,'') IS DISTINCT FROM p_customer)
  THEN RAISE EXCEPTION 'Nomor invoice digunakan customer berbeda. Periksa data sebelum melunasi.'; END IF;
  UPDATE public.pesanan_rows SET is_paid=true
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice)) AND NOT coalesce(is_paid,false);
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.mark_customer_invoice_paid(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_customer_invoice_paid(text,text) TO authenticated;

-- Keep locked accounting records immutable; description correction policy is
-- intentionally not relaxed by this migration.
CREATE OR REPLACE FUNCTION public.sync_cash_flow_journal_description()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  -- Lock linked journal rows so posting and editing cannot race.
  PERFORM id FROM public.journal_entries
    WHERE workspace='toto' AND source_type='cash_flow' AND source_id=OLD.id::text
    FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.journal_entries
    WHERE workspace='toto' AND source_type='cash_flow' AND source_id=OLD.id::text AND status='locked')
  THEN RAISE EXCEPTION 'Transaksi masuk jurnal terkunci. Gunakan koreksi, bukan edit atau hapus.'; END IF;
  IF TG_OP='DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.journal_entries WHERE workspace='toto'
      AND source_type='cash_flow' AND source_id=OLD.id::text)
    THEN RAISE EXCEPTION 'Hapus draft jurnal terkait sebelum menghapus transaksi.'; END IF;
    RETURN OLD;
  END IF;
  IF EXISTS (SELECT 1 FROM public.journal_entries WHERE workspace='toto'
      AND source_type='cash_flow' AND source_id=OLD.id::text)
    AND (to_jsonb(NEW) - 'description') IS DISTINCT FROM (to_jsonb(OLD) - 'description')
  THEN RAISE EXCEPTION 'Transaksi memiliki draft jurnal. Hapus draft sebelum mengubah data selain keterangan.'; END IF;
  IF NEW.description IS DISTINCT FROM OLD.description THEN
    UPDATE public.journal_entries SET description=coalesce(NEW.description,''),updated_at=now()
      WHERE workspace='toto' AND source_type='cash_flow' AND source_id=NEW.id::text AND status='draft';
    UPDATE public.journal_lines SET description=coalesce(NEW.description,'')
      WHERE journal_entry_id IN (SELECT id FROM public.journal_entries WHERE workspace='toto'
        AND source_type='cash_flow' AND source_id=NEW.id::text AND status='draft');
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_cash_flow_journal_description() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_cash_flow_description BEFORE UPDATE OR DELETE ON public.cash_flow
  FOR EACH ROW EXECUTE FUNCTION public.sync_cash_flow_journal_description();
