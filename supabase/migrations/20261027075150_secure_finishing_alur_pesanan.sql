-- Jalur aman untuk layar Alur Pesanan role Finishing.
-- Tabel pesanan_rows tetap tidak dapat dibaca langsung oleh role ini karena
-- memuat harga, invoice, pembayaran, dan data bisnis sensitif.

CREATE OR REPLACE FUNCTION public.get_finishing_alur_pesanan()
RETURNS TABLE (
    id bigint,
    tanggal text,
    customer text,
    deskripsi text,
    ukuran text,
    qty text,
    di_produksi boolean,
    di_warna boolean,
    di_kirim boolean,
    printed_at text,
    po_label text,
    production_note text,
    finishing_status text,
    finishing_operator text,
    finishing_at timestamptz,
    is_repair boolean
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
        COALESCE(p.di_kirim, false),
        p.printed_at,
        p.po_label,
        p.production_note,
        COALESCE(p.finishing_status, 'belum'),
        p.finishing_operator,
        p.finishing_at,
        COALESCE(p.is_repair, false)
    FROM public.pesanan_rows AS p
    ORDER BY p.id DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_finishing_alur_pesanan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_finishing_alur_pesanan() TO authenticated;

-- Perubahan operator hanya dibatasi pada status proses finishing; nominal dan
-- kolom pesanan lain tidak pernah diterima dari browser.
CREATE OR REPLACE FUNCTION public.update_finishing_status(
    p_id bigint,
    p_field text,
    p_checked boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    operator_value text := COALESCE(NULLIF(BTRIM(auth.jwt() ->> 'username'), ''), 'Finishing');
BEGIN
    IF COALESCE(auth.jwt() ->> 'user_role', '') <> 'finishing' THEN
        RAISE EXCEPTION 'Akses ditolak';
    END IF;

    IF p_field = 'produksi' THEN
        UPDATE public.pesanan_rows
        SET di_produksi = p_checked,
            finishing_operator = operator_value,
            finishing_at = NOW()
        WHERE id = p_id;
    ELSIF p_field = 'repair' THEN
        UPDATE public.pesanan_rows
        SET is_repair = p_checked,
            di_produksi = CASE WHEN p_checked THEN true ELSE di_produksi END,
            finishing_status = CASE WHEN p_checked THEN 'repair' WHEN di_warna THEN 'warna' ELSE 'belum' END,
            finishing_operator = CASE WHEN p_checked THEN operator_value ELSE '' END,
            finishing_at = CASE WHEN p_checked THEN NOW() ELSE NULL END
        WHERE id = p_id;
    ELSIF p_field = 'warna' THEN
        UPDATE public.pesanan_rows
        SET di_warna = p_checked,
            finishing_status = CASE WHEN p_checked THEN 'warna' WHEN is_repair THEN 'repair' ELSE 'belum' END,
            finishing_operator = CASE WHEN p_checked THEN operator_value ELSE '' END,
            finishing_at = CASE WHEN p_checked THEN NOW() ELSE NULL END
        WHERE id = p_id;
    ELSE
        RAISE EXCEPTION 'Status finishing tidak valid';
    END IF;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pesanan tidak ditemukan';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_finishing_status(bigint, text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_finishing_status(bigint, text, boolean) TO authenticated;
