-- ============================================================
-- 20260718_alucurv_rekonsiliasi_juli2026.sql
-- REKONSILIASI KEUANGAN ALUCURV — Juli 2026
--
-- Sumber kebenaran:
--   1. Excel "DATA UNTUK KEUANGAN ALUCURV.xlsx" (mutasi 1-18 Juli 2026)
--   2. Sheet SALDO AKUN = saldo riil per 18 Juli 2026
--
-- Yang dilakukan skrip ini (dibungkus SATU transaksi, aman di-review):
--   A. Hapus 1 baris salah input (SETOR TUNAI Sugiarto: uang customer
--      tidak pernah lewat kas laci) + 6 baris sisi-marketplace pencairan.
--   B. Pencairan Shopee/TikTok dikembalikan ke model Excel:
--      = Pemasukan PENDAPATAN E-COMMERCE di BCA (cash basis).
--   C. Perbaiki 2 nominal keliru (BENSIN 150rb->100rb, GAJI TORO 340rb->342,5rb).
--   D. Pasangkan transfer antar akun (tarik tunai sudah benar; tukar
--      cash, transfer ke JAGO/TABUNGAN/DIVIDEN dipasangkan transfer_group)
--      supaya TIDAK dihitung omzet/biaya di Laporan.
--   E. Tambah 10 transaksi yang belum terinput (17-18 Juli + sisi tujuan
--      transfer TABUNGAN/DIVIDEN).
--   F. Set saldo awal (opening_balance) per akun sehingga saldo app
--      = saldo riil per 18 Juli 2026, persis.
--
-- Jalankan di Supabase -> SQL Editor -> Run. Sesudahnya cek:
--   SELECT name, computed_balance FROM v_alu_account_balances ORDER BY name;
-- ============================================================

BEGIN;

-- ── A. HAPUS baris salah / sisi-marketplace pencairan ──
-- 2026-07-02 | Pengeluaran 5.000.000 | SETOR TUNAI PELUNASAN A.N SUGIARTO
--   alasan: salah: uang customer tidak pernah keluar dari kas laci
DELETE FROM alu_transactions WHERE id = 'bc0e1ed0-93e2-4203-b504-90e5cb4e5400';
-- 2026-07-01 | Pengeluaran 6.000.000 | PENCAIRAN SALDO SHOPEE
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = '431f4c19-8035-4a33-90fa-c13eaee320e7';
-- 2026-07-06 | Pengeluaran 22.000.000 | PENCAIRAN SALDO SHOPEE
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = '356b35e3-5560-46cb-8859-e0e350240a60';
-- 2026-07-10 | Pengeluaran 15.000.000 | PENCAIRAN SALDO SHOPEE
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = 'b170de5b-497e-464d-8925-a784eb5e1747';
-- 2026-07-15 | Pengeluaran 20.000.000 | PENCAIRAN SALDO SHOPEE
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = '075c9ac6-e8a9-4693-b913-3d76e28757b2';
-- 2026-07-01 | Pengeluaran 14.000.000 | PENCAIRAN SALDO TIKTOKSHOP
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = 'e97f1e23-6c79-4235-b44e-fc5a1f0800a5';
-- 2026-07-16 | Pengeluaran 12.000.000 | PENCAIRAN SALDO TIKTOKSHOP
--   alasan: sisi marketplace dari pencairan — model Excel: pencairan = pendapatan di BCA
DELETE FROM alu_transactions WHERE id = 'f0739560-2307-4b19-8a9e-cc9f4f0aa18d';

-- ── B/C/D. UPDATE baris yang sudah ada ──
-- 2026-07-02 | Pemasukan 5.000.000 | SETOR TUNAI PELUNASAN A.N SUGIARTO
--   jadikan pemasukan penjualan offline biasa (bukan mutasi)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = '914cf8af-17d2-4e4d-be4e-2870c19c661e' WHERE id = 'e03962a7-5306-4d79-9318-685aa74c8163';
-- 2026-07-01 | Pemasukan 6.000.000 | PENCAIRAN SALDO SHOPEE
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = 'f97ba396-612b-498f-ab7c-f900356d13f6';
-- 2026-07-06 | Pemasukan 22.000.000 | PENCAIRAN SALDO SHOPEE
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = 'faddd7c0-0c40-44de-8775-e506743fc682';
-- 2026-07-10 | Pemasukan 15.000.000 | PENCAIRAN SALDO SHOPEE
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = '1dc64e31-d7fe-4893-87ec-9685737719d8';
-- 2026-07-15 | Pemasukan 20.000.000 | PENCAIRAN SALDO SHOPEE
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = '932804af-eafc-434b-9e4c-192cd3493201';
-- 2026-07-01 | Pemasukan 14.000.000 | PENCAIRAN SALDO TIKTOKSHOP
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = '6a8a7d16-d054-44cc-9666-4adafb4e60f4';
-- 2026-07-16 | Pemasukan 12.000.000 | PENCAIRAN SALDO TIKTOKSHOP
--   pencairan = Pemasukan PENDAPATAN E-COMMERCE (sesuai Excel)
UPDATE alu_transactions SET transfer_group = NULL, sub_category_id = 'bffc7b78-5519-48cb-b2a8-f575b818786b' WHERE id = 'a79dfbbe-6c23-4047-a33d-084df102c5d5';
-- 2026-07-11 | Pengeluaran 150.000 | BENSIN CUST ABIGAIL
--   Excel: 100.000 (terinput 150.000)
UPDATE alu_transactions SET amount = 100000 WHERE id = 'b0bbaf03-fafe-4a02-8e74-a2d40421d49f';
-- 2026-07-02 | Pengeluaran 340.000 | GAJI BANG TORO CUST SUGIARTO
--   Excel: 342.500 (terinput 340.000)
UPDATE alu_transactions SET amount = 342500 WHERE id = 'eca42cba-c0d1-46bc-8ab3-567308a23e75';
-- 2026-07-02 | Pemasukan 250.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-0207
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-01-tukar-cash-febri-0207', sub_category_id = NULL WHERE id = '1fed3dbe-2898-46ec-8aa5-92572b846803';
-- 2026-07-02 | Pengeluaran 250.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-0207
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-01-tukar-cash-febri-0207', sub_category_id = NULL WHERE id = 'e1970f5f-bea2-4227-88dd-35fc177fe8db';
-- 2026-07-04 | Pengeluaran 50.000 | NOVIT TUKAR CASH
--   pasangan mutasi: tukar-cash-novit-0407
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-02-tukar-cash-novit-0407', sub_category_id = NULL WHERE id = '1de65719-08e8-43b5-90f7-dfe55b3f3e81';
-- 2026-07-04 | Pemasukan 50.000 | NOVIT TUKAR CASH
--   pasangan mutasi: tukar-cash-novit-0407
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-02-tukar-cash-novit-0407', sub_category_id = NULL WHERE id = '1ec7a456-c6d9-43a2-823e-ef4dba730e65';
-- 2026-07-06 | Pengeluaran 300.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-0607
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-03-tukar-cash-febri-0607', sub_category_id = NULL WHERE id = 'f16e346a-c44b-4a84-93fb-945e69a691e1';
-- 2026-07-06 | Pemasukan 300.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-0607
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-03-tukar-cash-febri-0607', sub_category_id = NULL WHERE id = '6eec5f95-7c72-4635-a1ca-878d0cf853a6';
-- 2026-07-08 | Pengeluaran 50.000 | MAS ISAL TUKAR CASH
--   pasangan mutasi: tukar-cash-isal-0807
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-04-tukar-cash-isal-0807', sub_category_id = NULL WHERE id = '284aaf81-a973-43dc-a33f-7b684a46fee1';
-- 2026-07-09 | Pemasukan 50.000 | MAS ISAL TUKAR CASH  
--   pasangan mutasi: tukar-cash-isal-0807
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-04-tukar-cash-isal-0807', sub_category_id = NULL WHERE id = 'a80fb81d-ad75-4759-a38d-9a6ed6ea615a';
-- 2026-07-14 | Pengeluaran 300.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-1407
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-05-tukar-cash-febri-1407', sub_category_id = NULL WHERE id = '86b539fa-02b8-4033-8a36-44498d2fbb18';
-- 2026-07-14 | Pemasukan 300.000 | FEBRI TUKAR CASH
--   pasangan mutasi: tukar-cash-febri-1407
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-05-tukar-cash-febri-1407', sub_category_id = NULL WHERE id = '7d15c6bb-258a-4c2a-8b67-f4051903b7be';
-- 2026-07-02 | Pengeluaran 5.002.500 | TRANSFER KE OPR JAGO
--   pasangan mutasi: bca-ke-jago-0207
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-06-bca-ke-jago-0207', sub_category_id = NULL WHERE id = 'f054b14f-06d5-45c8-83bf-3c8355e9aedb';
-- 2026-07-02 | Pemasukan 5.000.000 | IVA TRANSFER OPR JAGO
--   pasangan mutasi: bca-ke-jago-0207
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-06-bca-ke-jago-0207', sub_category_id = NULL WHERE id = '058f30ba-e808-42e2-a4c7-6d512ebbddb2';
-- 2026-07-06 | Pengeluaran 5.000.000 | TF OPERASIONAL ALUCURV
--   pasangan mutasi: bca-ke-jago-0607
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-07-bca-ke-jago-0607', sub_category_id = NULL WHERE id = 'ff64f9dd-b7c2-4259-b03d-4a090b071060';
-- 2026-07-06 | Pemasukan 5.000.000 | IVA TRANSFER OPR JAGO
--   pasangan mutasi: bca-ke-jago-0607
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-07-bca-ke-jago-0607', sub_category_id = NULL WHERE id = '121faab1-dfdb-428b-bc2f-5217d4483777';
-- 2026-07-11 | Pengeluaran 5.000.000 | IVA TRANSFER KE OPR JAGO
--   pasangan mutasi: bca-ke-jago-1107
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-08-bca-ke-jago-1107', sub_category_id = NULL WHERE id = '76626c1a-e6df-4266-8a8a-ded2e6761f6d';
-- 2026-07-11 | Pemasukan 5.000.000 | IVA TRANSFER OPR JAGO
--   pasangan mutasi: bca-ke-jago-1107
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-08-bca-ke-jago-1107', sub_category_id = NULL WHERE id = '553af81d-f9f7-4b6d-be50-2d0294e788fe';
-- 2026-07-15 | Pengeluaran 10.000.000 | IVA TRANSFER KE OPR JAGO
--   pasangan mutasi: bca-ke-jago-1507
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-09-bca-ke-jago-1507', sub_category_id = NULL WHERE id = '03dd8641-1b17-4d6a-be9b-16dd97f4f0c4';
-- 2026-07-15 | Pemasukan 10.000.000 | IVA TRANSFER OPR JAGO
--   pasangan mutasi: bca-ke-jago-1507
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-09-bca-ke-jago-1507', sub_category_id = NULL WHERE id = '3897ce38-8db8-4122-b82b-ae97bddc1ff9';
-- 2026-07-06 | Pengeluaran 5.000.000 | TF TABUNGAN ALUCURV
--   mutasi ke TABUNGAN, bukan biaya
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-10-bca-ke-tabungan-0607', sub_category_id = NULL WHERE id = '58b8d5dd-4e65-4ebf-8dca-3b5a73c5cb84';
-- 2026-07-08 | Pengeluaran 20.000.000 | NABUNG DIVIDEN BOS
--   mutasi ke DIVIDEN, bukan biaya
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-11-bca-ke-dividen-0807', sub_category_id = NULL WHERE id = 'a4c90582-7f6a-4700-afb2-51494013414f';
-- 2026-07-16 | Pengeluaran 10.000.000 | NABUNG DIVIDEN BOS
--   mutasi ke DIVIDEN, bukan biaya
UPDATE alu_transactions SET transfer_group = 'mutasi-fix-12-bca-ke-dividen-1607', sub_category_id = NULL WHERE id = 'f08cb35e-98f3-4584-9905-db1b369a8268';

-- ── E. INSERT transaksi yang belum ada ──
-- 2026-07-06 | TABUNGAN | Pemasukan 5.000.000 | TF TABUNGAN ALUCURV  (sisi masuk mutasi dari BCA (bca-ke-tabungan-0607))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-06', 'TF TABUNGAN ALUCURV', 'Pemasukan', NULL, 5000000, '1cb68c86-d800-4c17-badc-8fecb1a747c3', NULL, 'mutasi-fix-10-bca-ke-tabungan-0607');
-- 2026-07-08 | DIVIDEN | Pemasukan 20.000.000 | NABUNG DIVIDEN BOS  (sisi masuk mutasi dari BCA (bca-ke-dividen-0807))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-08', 'NABUNG DIVIDEN BOS', 'Pemasukan', NULL, 20000000, '81c071f6-3016-4672-a309-7a994e39410f', NULL, 'mutasi-fix-11-bca-ke-dividen-0807');
-- 2026-07-16 | DIVIDEN | Pemasukan 10.000.000 | NABUNG DIVIDEN BOS  (sisi masuk mutasi dari BCA (bca-ke-dividen-1607))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-16', 'NABUNG DIVIDEN BOS', 'Pemasukan', NULL, 10000000, '81c071f6-3016-4672-a309-7a994e39410f', NULL, 'mutasi-fix-12-bca-ke-dividen-1607');
-- 2026-07-17 | BCA | Pemasukan 1.035.000 | PELUNASAN A.N ARFANNIUM FRAME  (belum terinput)
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-17', 'PELUNASAN A.N ARFANNIUM FRAME', 'Pemasukan', '914cf8af-17d2-4e4d-be4e-2870c19c661e', 1035000, 'a3dc2883-e913-4e41-a47e-324b446b81b3', NULL, NULL);
-- 2026-07-17 | BCA | Pemasukan 2.500.000 | DP A.N RIZQI MUJIZAH  (belum terinput)
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-17', 'DP A.N RIZQI MUJIZAH', 'Pemasukan', '914cf8af-17d2-4e4d-be4e-2870c19c661e', 2500000, 'a3dc2883-e913-4e41-a47e-324b446b81b3', NULL, NULL);
-- 2026-07-18 | CASH | Pengeluaran 200.000 | FEBRI TUKAR CASH  (belum terinput (pasangan mutasi))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-18', 'FEBRI TUKAR CASH', 'Pengeluaran', NULL, 200000, 'b38b3f27-b0c4-45ad-b127-58498c68017b', NULL, 'mutasi-fix-13-tukar-cash-febri-1807');
-- 2026-07-18 | BCA | Pemasukan 200.000 | FEBRI TUKAR CASH  (belum terinput (pasangan mutasi))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-18', 'FEBRI TUKAR CASH', 'Pemasukan', NULL, 200000, 'a3dc2883-e913-4e41-a47e-324b446b81b3', NULL, 'mutasi-fix-13-tukar-cash-febri-1807');
-- 2026-07-18 | BCA | Pengeluaran 5.002.500 | IVA TRANSFER KE OPR JAGO  (belum terinput (pasangan mutasi, incl. admin 2.500))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-18', 'IVA TRANSFER KE OPR JAGO', 'Pengeluaran', NULL, 5002500, 'a3dc2883-e913-4e41-a47e-324b446b81b3', NULL, 'mutasi-fix-14-bca-ke-jago-1807');
-- 2026-07-18 | JAGO | Pemasukan 5.000.000 | IVA TRANSFER OPR JAGO  (belum terinput (pasangan mutasi))
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-18', 'IVA TRANSFER OPR JAGO', 'Pemasukan', NULL, 5000000, '9799f1e3-24e9-4eb1-951d-2b0db1feec30', NULL, 'mutasi-fix-14-bca-ke-jago-1807');
-- 2026-07-18 | JAGO | Pengeluaran 2.833.000 | GAJI MINGGUAN  (belum terinput)
INSERT INTO alu_transactions (id, date, description, type, sub_category_id, amount, account_id, note, transfer_group)
VALUES (gen_random_uuid()::text, '2026-07-18', 'GAJI MINGGUAN', 'Pengeluaran', '0a7ff5a7-4ce7-4eee-a5e0-3aaac8fe5835', 2833000, '9799f1e3-24e9-4eb1-951d-2b0db1feec30', NULL, NULL);

-- ── F. SALDO AWAL per akun (dihitung: saldo riil 18 Juli - net mutasi tercatat) ──
UPDATE alu_accounts SET opening_balance = 17354265 WHERE id = 'a3dc2883-e913-4e41-a47e-324b446b81b3'; -- BCA IVA
UPDATE alu_accounts SET opening_balance = 1334500 WHERE id = 'b38b3f27-b0c4-45ad-b127-58498c68017b'; -- CASH ALUCURV
UPDATE alu_accounts SET opening_balance = 3151270 WHERE id = '9799f1e3-24e9-4eb1-951d-2b0db1feec30'; -- OPR JAGO IVA
UPDATE alu_accounts SET opening_balance = 52092533 WHERE id = 'd4b0cb3e-87d1-43f4-90d1-49b63b5526e6'; -- SALDO PENDING SHOPEE
UPDATE alu_accounts SET opening_balance = 6156562 WHERE id = '6418ccac-16b2-4e26-8f81-9cd4d100b987'; -- SALDO PENDING TIKTOKSHOP
UPDATE alu_accounts SET opening_balance = 16626324 WHERE id = 'cd1455e4-c717-4b40-896a-ec0a5872b98b'; -- SALDO SHOPEE
UPDATE alu_accounts SET opening_balance = 1091433 WHERE id = '7cff3d58-0ba4-4504-9323-b5515e8ab4bf'; -- SALDO TIKTOKSHOP
UPDATE alu_accounts SET opening_balance = 20008547 WHERE id = '1cb68c86-d800-4c17-badc-8fecb1a747c3'; -- TABUNGAN JAGO ALUCURV
UPDATE alu_accounts SET opening_balance = 54957 WHERE id = '81c071f6-3016-4672-a309-7a994e39410f'; -- DIVIDEN BOS

COMMIT;

-- ============================================================
-- VERIFIKASI (jalankan setelah COMMIT) — harus persis begini:
--   BCA IVA                  = 34.221.383
--   CASH ALUCURV             =    558.500
--   OPR JAGO IVA             =  2.874.270
--   SALDO SHOPEE             = 16.293.324
--   SALDO PENDING SHOPEE     = 52.092.533
--   SALDO TIKTOKSHOP         =  1.091.433
--   SALDO PENDING TIKTOKSHOP =  6.156.562
--   TABUNGAN JAGO ALUCURV    = 25.008.547 (tidak berubah)
--   DIVIDEN BOS              = 30.054.957 (tidak berubah)
--
--   SELECT name, computed_balance FROM v_alu_account_balances ORDER BY name;
-- ============================================================
