-- ============================================================
-- Tambah kolom "Harga Setelah Barang Datang" di alu_orders
-- Nominal bersih yang diterima Alucurv setelah settlement marketplace
-- (Shopee/TikTokShop) — beda dari kolom `price` (harga listing/jual).
-- Jalankan SETELAH supabase-migration-alucurv-tables.sql
-- ============================================================

ALTER TABLE alu_orders ADD COLUMN IF NOT EXISTS received_amount NUMERIC;
