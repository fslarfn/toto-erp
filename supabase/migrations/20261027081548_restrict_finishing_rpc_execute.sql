-- Supabase memberi anon/authenticated EXECUTE melalui grant per-role bawaan;
-- REVOKE dari PUBLIC saja tidak mencabut grant tersebut.
REVOKE ALL ON FUNCTION public.get_finishing_alur_pesanan() FROM anon;
REVOKE ALL ON FUNCTION public.update_finishing_status(bigint, text, boolean) FROM anon;

-- Hanya sesi login yang dapat memanggil RPC. Validasi role Finishing tetap
-- dilakukan di dalam kedua fungsi sebagai lapisan pengaman kedua.
GRANT EXECUTE ON FUNCTION public.get_finishing_alur_pesanan() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_finishing_status(bigint, text, boolean) TO authenticated;
