-- ============================================================
-- 20260618_tagihan_bahan_partial_payment.sql
-- Pembayaran bertahap (cicilan) untuk Tagihan Bahan Baku.
-- Tambah kolom paid_amount; status diturunkan: Belum / Sebagian / Lunas.
-- Aman dijalankan ulang. Tidak menghapus data.
-- ============================================================

ALTER TABLE tagihan_bahan ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;

-- Backfill: tagihan yang sudah ditandai lunas → anggap sudah dibayar penuh.
UPDATE tagihan_bahan
SET paid_amount = grand_total
WHERE is_paid = TRUE AND paid_amount = 0;

-- Verifikasi:
--   SELECT no_invoice, grand_total, paid_amount, is_paid,
--          (grand_total - paid_amount) AS sisa
--   FROM tagihan_bahan ORDER BY tanggal DESC;
