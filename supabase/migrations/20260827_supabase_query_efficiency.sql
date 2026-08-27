-- Indeks untuk query yang paling sering dijalankan oleh dashboard/cockpit.
-- Semua memakai IF NOT EXISTS sehingga aman dijalankan ulang.

CREATE INDEX IF NOT EXISTS idx_alu_transactions_date
    ON public.alu_transactions (date);

CREATE INDEX IF NOT EXISTS idx_alu_transactions_account_date
    ON public.alu_transactions (account_id, date);

CREATE INDEX IF NOT EXISTS idx_alu_orders_date
    ON public.alu_orders (date);

CREATE INDEX IF NOT EXISTS idx_cash_flow_date
    ON public.cash_flow (date);

-- Cockpit hanya mengambil baris yang belum lunas lalu mengurutkan berdasarkan id.
-- Partial index lebih kecil daripada index seluruh tabel dan lebih murah dipelihara.
CREATE INDEX IF NOT EXISTS idx_pesanan_rows_unpaid_id
    ON public.pesanan_rows (id)
    WHERE is_paid = false;
