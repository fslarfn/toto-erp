-- ============================================================
-- Kolom created_at di alu_orders — supaya daftar Order bisa
-- diurutkan sesuai urutan input (bukan diurut ulang berdasarkan
-- tanggal order manual).
-- Jalankan SETELAH supabase-migration-alucurv-tables.sql
-- ============================================================

ALTER TABLE alu_orders ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Baris lama (sebelum kolom ini ada) tidak punya created_at — isi
-- dengan urutan berdasarkan `date` yang ada supaya tidak semuanya
-- bertumpuk di waktu yang sama.
UPDATE alu_orders SET created_at = date::timestamptz WHERE created_at IS NULL;
