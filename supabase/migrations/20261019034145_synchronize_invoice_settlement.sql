-- No existing order, cash, or journal rows are modified by this migration.
-- Version aligned with the migration timestamp returned by Supabase.
-- Ignore only the known trailing PO CUSTOM/COSTOM annotation, never fuzzy names.
CREATE OR REPLACE FUNCTION public.mark_customer_invoice_paid(p_invoice text, p_customer text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  affected integer;
  customer_key text := regexp_replace(upper(btrim(regexp_replace(coalesce(p_customer,''), '[[:space:]]+', ' ', 'g'))), ' PO (CUSTOM|COSTOM)$', '');
BEGIN
  IF NOT (
    coalesce(auth.jwt()->>'user_role','') IN ('owner','finance')
    OR lower(btrim(coalesce(auth.jwt()->>'username',''))) IN ('riska','rieska','yuni','vira')
  ) THEN
    RAISE EXCEPTION 'Tidak berwenang menandai invoice lunas';
  END IF;
  IF nullif(btrim(p_invoice),'') IS NULL OR nullif(customer_key,'') IS NULL THEN
    RAISE EXCEPTION 'Invoice dan customer wajib diisi';
  END IF;
  -- Lock the full invoice, not just rows loaded on the current browser page.
  PERFORM id FROM public.pesanan_rows
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice)) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice tidak ditemukan'; END IF;
  IF EXISTS (SELECT 1 FROM public.pesanan_rows
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice))
      AND regexp_replace(upper(btrim(regexp_replace(coalesce(customer,''), '[[:space:]]+', ' ', 'g'))), ' PO (CUSTOM|COSTOM)$', '') IS DISTINCT FROM customer_key)
  THEN RAISE EXCEPTION 'Nomor invoice digunakan customer berbeda. Periksa data sebelum melunasi.'; END IF;
  UPDATE public.pesanan_rows SET is_paid=true
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice)) AND NOT coalesce(is_paid,false);
  GET DIAGNOSTICS affected = ROW_COUNT;
  -- RLS can suppress updates without an error. Never report partial success.
  IF EXISTS (SELECT 1 FROM public.pesanan_rows
    WHERE upper(btrim(no_inv))=upper(btrim(p_invoice)) AND NOT coalesce(is_paid,false))
  THEN RAISE EXCEPTION 'Pelunasan tidak tersimpan untuk seluruh invoice. Periksa hak akses.'; END IF;
  RETURN affected;
END $$;
REVOKE ALL ON FUNCTION public.mark_customer_invoice_paid(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_customer_invoice_paid(text,text) TO authenticated;

-- Aggregate ALL invoice lines before testing whether the invoice is open.
CREATE OR REPLACE FUNCTION public.load_open_customer_invoices()
 RETURNS TABLE(invoice_key text, invoice_number text, customer_name text, invoice_date text, total_amount bigint, allocated_amount bigint, outstanding_amount bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  RETURN QUERY
  WITH invoice_rows AS (
    SELECT
      canonical_customer_invoice_key(p.no_inv,p.id) AS key_value,
      max(COALESCE(p.no_inv,'')) AS number_value,
      max(COALESCE(p.customer,'')) AS customer_value,
      min(COALESCE(p.tanggal::text,'')) AS date_value,
      round(COALESCE(sum(
        fn_parse_id_num(p.harga)*fn_parse_id_num(p.qty)*fn_parse_id_num(p.ukuran)
      ),0))::bigint AS total_value
    FROM pesanan_rows p
    WHERE NULLIF(btrim(COALESCE(p.customer,'')),'') IS NOT NULL
    GROUP BY canonical_customer_invoice_key(p.no_inv,p.id)
    HAVING NOT bool_and(coalesce(p.is_paid,false))
  ), allocation_totals AS (
    SELECT a.invoice_key AS key_value,COALESCE(sum(a.amount),0)::bigint AS allocated_value
    FROM customer_receipt_allocations a WHERE a.workspace='toto' GROUP BY a.invoice_key
  )
  SELECT i.key_value,i.number_value,i.customer_value,i.date_value,i.total_value,
    COALESCE(a.allocated_value,0)::bigint,
    GREATEST(i.total_value-COALESCE(a.allocated_value,0),0)::bigint
  FROM invoice_rows i LEFT JOIN allocation_totals a ON a.key_value=i.key_value
  WHERE i.total_value>COALESCE(a.allocated_value,0)
  ORDER BY i.date_value,i.number_value;
END; $function$
