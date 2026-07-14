-- ============================================================
-- Kolom tambahan di alu_invoices untuk nota cetak (order date,
-- diskon, franco/syarat pengiriman) — mengikuti template nota Alucurv.
-- Jalankan SETELAH supabase-migration-alucurv-tables.sql
-- ============================================================

ALTER TABLE alu_invoices ADD COLUMN IF NOT EXISTS order_date DATE;
ALTER TABLE alu_invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC;
ALTER TABLE alu_invoices ADD COLUMN IF NOT EXISTS franco TEXT;
