-- Samakan perilaku ceklis Finishing dengan Status Barang:
-- Warna => Produksi + Warna; Repair => Produksi saja.
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
            di_warna = CASE WHEN p_checked THEN false ELSE di_warna END,
            finishing_status = CASE WHEN p_checked THEN 'repair' WHEN di_warna THEN 'warna' ELSE 'belum' END,
            finishing_operator = CASE WHEN p_checked THEN operator_value ELSE '' END,
            finishing_at = CASE WHEN p_checked THEN NOW() ELSE NULL END
        WHERE id = p_id;
    ELSIF p_field = 'warna' THEN
        UPDATE public.pesanan_rows
        SET di_produksi = CASE WHEN p_checked THEN true ELSE di_produksi END,
            di_warna = p_checked,
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
