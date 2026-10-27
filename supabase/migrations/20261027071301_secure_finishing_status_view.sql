-- Operator Finishing hanya boleh membaca Status Barang versi operasional.
-- Harga, invoice, nilai pembayaran, dan kolom audit sengaja tidak dikirim.
-- Tidak ada perubahan terhadap data pesanan yang sudah ada.

ALTER TABLE public.pesanan_rows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated all" ON public.pesanan_rows;
DROP POLICY IF EXISTS "pesanan_rows_select_non_finishing" ON public.pesanan_rows;
DROP POLICY IF EXISTS "pesanan_rows_insert_editor" ON public.pesanan_rows;
DROP POLICY IF EXISTS "pesanan_rows_update_editor" ON public.pesanan_rows;
DROP POLICY IF EXISTS "pesanan_rows_delete_editor" ON public.pesanan_rows;

-- Role Finishing tidak dapat membaca tabel dasar. Mereka hanya dapat memakai
-- RPC aman di bawah. Role lain mempertahankan akses baca seperti sebelumnya.
CREATE POLICY "pesanan_rows_select_non_finishing"
ON public.pesanan_rows FOR SELECT TO authenticated
USING (COALESCE(auth.jwt() ->> 'user_role', '') <> 'finishing');

CREATE POLICY "pesanan_rows_insert_editor"
ON public.pesanan_rows FOR INSERT TO authenticated
WITH CHECK (COALESCE(auth.jwt() ->> 'user_role', '') IN ('owner', 'finance', 'sales', 'produksi', 'barang'));

CREATE POLICY "pesanan_rows_update_editor"
ON public.pesanan_rows FOR UPDATE TO authenticated
USING (COALESCE(auth.jwt() ->> 'user_role', '') IN ('owner', 'finance', 'sales', 'produksi', 'barang'))
WITH CHECK (COALESCE(auth.jwt() ->> 'user_role', '') IN ('owner', 'finance', 'sales', 'produksi', 'barang'));

CREATE POLICY "pesanan_rows_delete_editor"
ON public.pesanan_rows FOR DELETE TO authenticated
USING (COALESCE(auth.jwt() ->> 'user_role', '') IN ('owner', 'finance', 'sales', 'produksi', 'barang'));

CREATE OR REPLACE FUNCTION public.get_finishing_status_barang(
  p_year integer,
  p_month integer DEFAULT NULL
)
RETURNS TABLE (
  id bigint,
  tanggal text,
  customer text,
  deskripsi text,
  ukuran text,
  qty text,
  di_produksi boolean,
  di_warna boolean,
  siap_kirim boolean,
  di_kirim boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() ->> 'user_role', '') <> 'finishing' THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF p_year NOT BETWEEN 2023 AND 2100 OR (p_month IS NOT NULL AND p_month NOT BETWEEN 1 AND 12) THEN
    RAISE EXCEPTION 'Periode tidak valid';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.tanggal,
    p.customer,
    p.deskripsi,
    p.ukuran,
    p.qty,
    COALESCE(p.di_produksi, false),
    COALESCE(p.di_warna, false),
    COALESCE(p.siap_kirim, false),
    COALESCE(p.di_kirim, false)
  FROM public.pesanan_rows AS p
  WHERE p.tanggal >= format('%s-01-01', p_year)
    AND p.tanggal <= format('%s-12-31', p_year)
    AND (p_month IS NULL OR p.tanggal >= format('%s-%s-01', p_year, lpad(p_month::text, 2, '0')))
    AND (p_month IS NULL OR p.tanggal <= (date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month - 1 day')::date::text)
  ORDER BY p.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_finishing_status_barang(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_finishing_status_barang(integer, integer) TO authenticated;
