-- Pencarian invoice di Keuangan harus selalu menelusuri seluruh invoice
-- terbuka, tidak bergantung pada daftar awal di browser atau batas halaman.
CREATE OR REPLACE FUNCTION public.search_customer_invoices(p_query text)
RETURNS TABLE(
  invoice_key text,
  invoice_number text,
  customer_name text,
  invoice_date text,
  total_amount bigint,
  allocated_amount bigint,
  outstanding_amount bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  query_value text := lower(btrim(COALESCE(p_query, '')));
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF query_value = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH invoice_rows AS (
    SELECT
      canonical_customer_invoice_key(p.no_inv, p.id) AS key_value,
      max(COALESCE(p.no_inv, '')) AS number_value,
      max(COALESCE(p.customer, '')) AS customer_value,
      min(COALESCE(p.tanggal::text, '')) AS date_value,
      round(COALESCE(sum(
        fn_parse_id_num(p.harga) * fn_parse_id_num(p.qty) * fn_parse_id_num(p.ukuran)
      ), 0))::bigint AS total_value,
      bool_and(COALESCE(p.is_paid, false)) AS paid_value
    FROM public.pesanan_rows p
    WHERE NULLIF(btrim(COALESCE(p.customer, '')), '') IS NOT NULL
    GROUP BY canonical_customer_invoice_key(p.no_inv, p.id)
  ), allocation_totals AS (
    SELECT allocation.invoice_key AS key_value, COALESCE(sum(allocation.amount), 0)::bigint AS allocated_value
    FROM public.customer_receipt_allocations allocation
    WHERE allocation.workspace = 'toto'
    GROUP BY allocation.invoice_key
  )
  SELECT
    invoice_rows.key_value,
    invoice_rows.number_value,
    invoice_rows.customer_value,
    invoice_rows.date_value,
    invoice_rows.total_value,
    COALESCE(allocation_totals.allocated_value, 0)::bigint,
    GREATEST(invoice_rows.total_value - COALESCE(allocation_totals.allocated_value, 0), 0)::bigint
  FROM invoice_rows
  LEFT JOIN allocation_totals ON allocation_totals.key_value = invoice_rows.key_value
  WHERE NOT invoice_rows.paid_value
    AND invoice_rows.total_value > COALESCE(allocation_totals.allocated_value, 0)
    AND (
      lower(invoice_rows.number_value) LIKE '%' || query_value || '%'
      OR lower(invoice_rows.customer_value) LIKE '%' || query_value || '%'
    )
  ORDER BY invoice_rows.date_value DESC, invoice_rows.number_value DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.search_customer_invoices(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_customer_invoices(text) TO authenticated;
