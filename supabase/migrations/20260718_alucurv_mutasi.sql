-- ============================================================
-- 20260718_alucurv_mutasi.sql
-- Mutasi antar akun untuk Alucurv (meniru pola Toto):
-- satu mutasi = SEPASANG baris alu_transactions (Pengeluaran di akun
-- sumber + Pemasukan di akun tujuan) dengan transfer_group yang sama,
-- sehingga saldo tetap seimbang TAPI tidak terhitung sebagai
-- pemasukan/pengeluaran operasional.
--
-- AMAN: hanya ADD COLUMN (aditif) + index. Tidak mengubah/menghapus
-- data apa pun. Idempotent (aman dijalankan ulang).
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

ALTER TABLE alu_transactions ADD COLUMN IF NOT EXISTS transfer_group TEXT;
CREATE INDEX IF NOT EXISTS idx_alu_transactions_transfer_group ON alu_transactions(transfer_group);

-- ============================================================
-- INVESTIGASI SALDO NEGATIF (CASH ALUCURV, OPR JAGO) — hanya SELECT,
-- jalankan manual & tinjau hasilnya. TIDAK mengubah data.
--
-- 1) Saldo terhitung per akun (butuh view dari 20260717):
--    SELECT * FROM v_alu_account_balances ORDER BY computed_balance;
--
-- 2) Riwayat kumulatif satu akun — cari sejak kapan minus:
--    SELECT t.date, t.description, t.type, t.amount,
--           SUM(CASE WHEN t.type = 'Pemasukan' THEN t.amount ELSE -t.amount END)
--             OVER (ORDER BY t.date, t.id)
--             + a.opening_balance AS saldo_berjalan
--    FROM alu_transactions t
--    JOIN alu_accounts a ON a.id = t.account_id
--    WHERE a.name ILIKE '%CASH ALUCURV%'
--    ORDER BY t.date, t.id;
--
-- 3) Kandidat penyebab umum: opening_balance masih 0 padahal akun
--    sudah punya uang sebelum mulai pencatatan. Bila benar, isi lewat:
--    UPDATE alu_accounts SET opening_balance = <nilai> WHERE id = '<id>';
--    (keputusan & eksekusi di tangan owner)
-- ============================================================
