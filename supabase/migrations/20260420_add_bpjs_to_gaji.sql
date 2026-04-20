
-- Add BPJS columns to gaji table
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS bpjs_tk bigint DEFAULT 0;
ALTER TABLE gaji ADD COLUMN IF NOT EXISTS bpjs_kes bigint DEFAULT 0;

-- Comment for clarity
COMMENT ON COLUMN gaji.bpjs_tk IS 'BPJS Ketenagakerjaan deduction for this period';
COMMENT ON COLUMN gaji.bpjs_kes IS 'BPJS Kesehatan deduction for this period';
