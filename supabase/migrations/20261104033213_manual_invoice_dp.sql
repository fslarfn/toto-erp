-- DP manual hanya untuk pembayaran lama yang tidak pernah dicatat pada
-- Keuangan. Nilai ini dijumlahkan dengan DP dari transaksi Keuangan saat
-- menampilkan invoice/tagihan, tanpa mengubah cash_flow, saldo, atau jurnal.
ALTER TABLE public.invoice_adjustments
  ADD COLUMN IF NOT EXISTS manual_dp_amount bigint NOT NULL DEFAULT 0
  CHECK (manual_dp_amount >= 0);

COMMENT ON COLUMN public.invoice_adjustments.dp_amount IS
  'DP dari alokasi transaksi kategori DP Invoice di Keuangan';
COMMENT ON COLUMN public.invoice_adjustments.manual_dp_amount IS
  'DP lama/manual yang belum tercatat di Keuangan';
