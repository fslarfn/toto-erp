-- ============================================================
-- 20260617_balance_single_source.sql
-- Single source of truth untuk SALDO KAS.
--
-- Prinsip: saldo TIDAK disimpan dobel. bank_accounts.balance hanya
-- "cache" hasil hitung dari cash_flow. Sumber kebenaran =
--   initial_balance + SUM(income) - SUM(expense) per account_id
--   (mengecualikan entri is_test).
--
-- Aman dijalankan ulang (idempotent). TIDAK menghapus / mengubah
-- data transaksi historis — hanya menambah kolom & mengisi FK.
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

-- ============================================================
-- A. cash_flow.account_id  (FK ke bank_accounts.id)
-- ============================================================
ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS account_id TEXT REFERENCES bank_accounts(id);

-- G. Penanda entri non-riil (jangan hard-delete; cukup di-flag).
ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS is_adjustment BOOLEAN NOT NULL DEFAULT FALSE;

-- E. Penanda pasangan mutasi antar-kas (income di satu akun, expense di akun lain).
ALTER TABLE cash_flow ADD COLUMN IF NOT EXISTS transfer_group TEXT;

CREATE INDEX IF NOT EXISTS idx_cash_flow_account_id ON cash_flow(account_id);
CREATE INDEX IF NOT EXISTS idx_cash_flow_transfer_group ON cash_flow(transfer_group);

-- ============================================================
-- B. bank_accounts.initial_balance (saldo pembuka sebelum periode catat)
-- ============================================================
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- A (lanjutan). BACKFILL account_id dari nama lama (bank_account)
-- dengan normalisasi: trim + case-insensitive + alias umum.
-- Hanya mengisi baris yang account_id-nya masih NULL → idempotent.
-- ============================================================

-- 1) Cocokkan persis (setelah trim + lower)
UPDATE cash_flow cf
SET account_id = ba.id
FROM bank_accounts ba
WHERE cf.account_id IS NULL
  AND cf.bank_account IS NOT NULL
  AND lower(btrim(cf.bank_account)) = lower(btrim(ba.name));

-- 2) Alias kas tunai: "Cash" / "Tunai" / "Kas"
UPDATE cash_flow cf
SET account_id = ba.id
FROM bank_accounts ba
WHERE cf.account_id IS NULL
  AND lower(btrim(cf.bank_account)) IN ('cash', 'tunai', 'kas')
  AND lower(btrim(ba.name)) = 'cash';

-- 3) Cocokkan longgar: nama bank tercantum sebagai substring
--    (mis. "BCA Toto" → "Bank BCA Toto"), hanya bila unik.
UPDATE cash_flow cf
SET account_id = ba.id
FROM bank_accounts ba
WHERE cf.account_id IS NULL
  AND cf.bank_account IS NOT NULL
  AND (
        lower(btrim(ba.name)) LIKE '%' || lower(btrim(cf.bank_account)) || '%'
     OR lower(btrim(cf.bank_account)) LIKE '%' || lower(btrim(ba.name)) || '%'
      )
  AND (
        SELECT count(*) FROM bank_accounts ba2
        WHERE lower(btrim(ba2.name)) LIKE '%' || lower(btrim(cf.bank_account)) || '%'
           OR lower(btrim(cf.bank_account)) LIKE '%' || lower(btrim(ba2.name)) || '%'
      ) = 1;

-- ============================================================
-- LAPORAN: baris yang TIDAK ter-mapping (account_id masih NULL).
-- JANGAN dibuang. Jalankan query ini & tangani manual:
--
--   SELECT id, date, type, amount, bank_account, description
--   FROM cash_flow
--   WHERE account_id IS NULL
--   ORDER BY date DESC;
--
-- Setelah ditentukan tujuannya, set manual, contoh:
--   UPDATE cash_flow SET account_id = 'ba-3' WHERE id = '...';
-- ============================================================

-- ============================================================
-- G (lanjutan). Flag entri simulasi/preview yang sudah terlanjur masuk.
-- HANYA mem-flag (is_test = TRUE), tidak menghapus.
-- Sesuaikan pola bila perlu.
-- ============================================================
UPDATE cash_flow
SET is_test = TRUE
WHERE is_test = FALSE
  AND (
        upper(btrim(description)) LIKE 'SIMULASI%'
     OR upper(btrim(description)) LIKE 'PREIV%'
     OR upper(btrim(description)) LIKE '%[TEST]%'
      );

-- ============================================================
-- C. VIEW saldo TERHITUNG — satu rumus, dipakai bersama.
--    computed_balance = initial_balance + income - expense
--    (mengecualikan is_test). stored_balance = nilai cache saat ini.
-- ============================================================
CREATE OR REPLACE VIEW v_account_balances
WITH (security_invoker = true) AS
SELECT
  ba.id,
  ba.name,
  ba.initial_balance,
  ba.balance AS stored_balance,
  ba.initial_balance
    + COALESCE(SUM(CASE WHEN cf.type = 'income'  THEN cf.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END), 0)
    AS computed_balance,
  ba.balance
    - (
        ba.initial_balance
        + COALESCE(SUM(CASE WHEN cf.type = 'income'  THEN cf.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END), 0)
      ) AS diff
FROM bank_accounts ba
LEFT JOIN cash_flow cf
  ON cf.account_id = ba.id
 AND cf.is_test = FALSE
GROUP BY ba.id, ba.name, ba.initial_balance, ba.balance;

-- ============================================================
-- D. RPC sync_all_balances() — recompute SELURUH akun, tulis batch,
--    idempotent (klik 2x → hasil identik, diff jadi 0).
--    Mengembalikan ringkasan perubahan per akun.
-- ============================================================
CREATE OR REPLACE FUNCTION sync_all_balances()
RETURNS TABLE (
  account_id   TEXT,
  name         TEXT,
  old_balance  NUMERIC,
  new_balance  NUMERIC,
  diff         NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH computed AS (
    SELECT
      ba.id,
      ba.name AS nm,
      ba.balance AS old_bal,
      ba.initial_balance
        + COALESCE(SUM(CASE WHEN cf.type = 'income'  THEN cf.amount ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN cf.type = 'expense' THEN cf.amount ELSE 0 END), 0)
        AS new_bal
    FROM bank_accounts ba
    LEFT JOIN cash_flow cf
      ON cf.account_id = ba.id
     AND cf.is_test = FALSE
    GROUP BY ba.id, ba.name, ba.initial_balance, ba.balance
  ),
  upd AS (
    UPDATE bank_accounts ba
    SET balance = c.new_bal
    FROM computed c
    WHERE ba.id = c.id
      AND ba.balance IS DISTINCT FROM c.new_bal   -- idempotent: skip yang sudah sama
    RETURNING ba.id
  )
  SELECT c.id, c.nm, c.old_bal, c.new_bal, (c.new_bal - c.old_bal)
  FROM computed c
  ORDER BY c.nm;
END;
$$;

-- ============================================================
-- VERIFIKASI cepat:
--   SELECT * FROM v_account_balances;          -- lihat stored vs computed vs diff
--   SELECT * FROM sync_all_balances();         -- sinkronkan + ringkasan
--   SELECT * FROM sync_all_balances();         -- klik ke-2: semua diff = 0
--   SELECT * FROM cash_flow WHERE account_id IS NULL;  -- harus kosong / ditangani
-- ============================================================
