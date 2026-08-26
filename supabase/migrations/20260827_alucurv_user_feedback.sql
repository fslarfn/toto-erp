-- Penyempurnaan data Alucurv berdasarkan masukan pengguna.

ALTER TABLE alu_delivery_note_items ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE alu_delivery_note_items ADD COLUMN IF NOT EXISTS qty numeric NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_alu_delivery_note_items_note ON alu_delivery_note_items(delivery_note_id);
