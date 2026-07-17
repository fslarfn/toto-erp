-- ============================================================
-- 20260717_alucurv_dashboard_perf.sql
-- Saldo per akun Alucurv dihitung di DATABASE (view), bukan dengan
-- mengunduh seluruh alu_transactions ke browser.
--
-- Latar: Dashboard Alucurv memuat 7 tabel penuh sekaligus → freeze.
-- Selain lambat, client Supabase diam-diam membatasi 1000 baris,
-- sehingga saldo yang dihitung di browser bisa SALAH begitu
-- transaksi > 1000. View ini menghitung dari semua baris.
--
-- AMAN: hanya CREATE VIEW + GRANT. Tidak mengubah/menghapus data
-- apa pun. Idempotent (aman dijalankan ulang).
--
-- Jalankan di Supabase → SQL Editor → Run.
-- ============================================================

CREATE OR REPLACE VIEW v_alu_account_balances
WITH (security_invoker = true) AS
SELECT
  a.id,
  a.name,
  a.type,
  a.opening_balance,
  a.opening_balance
    + COALESCE(SUM(CASE WHEN t.type = 'Pemasukan'   THEN t.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN t.type = 'Pengeluaran' THEN t.amount ELSE 0 END), 0)
    AS computed_balance
FROM alu_accounts a
LEFT JOIN alu_transactions t ON t.account_id = a.id
GROUP BY a.id, a.name, a.type, a.opening_balance;

GRANT SELECT ON v_alu_account_balances TO anon, authenticated;

-- ============================================================
-- VERIFIKASI cepat:
--   SELECT * FROM v_alu_account_balances ORDER BY name;
--   -- bandingkan dengan kartu "Saldo per Akun" di Dashboard Alucurv.
-- ============================================================
