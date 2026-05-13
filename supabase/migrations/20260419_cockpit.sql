
-- 1. Helper function to parse Indonesian numbers
DROP FUNCTION IF EXISTS fn_parse_id_num(text) CASCADE;
CREATE OR REPLACE FUNCTION fn_parse_id_num(val text) 
RETURNS numeric 
LANGUAGE plpgsql AS $$
DECLARE
    cleaned text;
BEGIN
    IF val IS NULL OR val = '' OR val = '—' THEN
        RETURN 0;
    END IF;
    cleaned := TRIM(val);
    
    -- If it contains a comma, it's definitely ID format (dot=thousands, comma=decimal)
    IF cleaned ~ ',' THEN
        RETURN CAST(REPLACE(REPLACE(cleaned, '.', ''), ',', '.') AS numeric);
    END IF;
    
    -- If it matches the pattern of thousands (e.g., 220.000 or 1.500.000)
    -- Pattern: 1-3 digits, then one or more chunks of (.3 digits)
    IF cleaned ~ '^\d{1,3}(\.\d{3})+$' THEN
        RETURN CAST(REPLACE(cleaned, '.', '') AS numeric);
    END IF;
    
    -- Otherwise, assume it's a standard number where dot might be decimal (1.6)
    -- Just remove anything non-numeric except the dot
    RETURN CAST(REGEXP_REPLACE(cleaned, '[^0-9.]', '', 'g') AS numeric);
EXCEPTION WHEN OTHERS THEN
    RETURN 0;
END;
$$;

-- 2. Add last_status_change column to pesanan_rows
ALTER TABLE pesanan_rows ADD COLUMN IF NOT EXISTS last_status_change timestamptz DEFAULT now();

-- 3. Trigger function to update last_status_change
DROP FUNCTION IF EXISTS fn_pesanan_touch_status() CASCADE;
CREATE OR REPLACE FUNCTION fn_pesanan_touch_status() RETURNS
trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.di_produksi IS DISTINCT FROM OLD.di_produksi OR 
     NEW.di_warna IS DISTINCT FROM OLD.di_warna OR
     NEW.siap_kirim IS DISTINCT FROM OLD.siap_kirim OR
     NEW.di_kirim IS DISTINCT FROM OLD.di_kirim THEN
    NEW.last_status_change := now();
  END IF;
  RETURN NEW;
END $$;

-- 4. Create Trigger
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pesanan_touch_status') THEN
    CREATE TRIGGER trg_pesanan_touch_status 
    BEFORE UPDATE ON pesanan_rows
    FOR EACH ROW EXECUTE FUNCTION fn_pesanan_touch_status();
  END IF;
END $$;

-- 5. Backfill initial values
UPDATE pesanan_rows SET last_status_change = COALESCE(
  last_status_change, 
  created_at, 
  now()
) WHERE last_status_change IS NULL;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pesanan_rows_last_status_change ON pesanan_rows(last_status_change);
CREATE INDEX IF NOT EXISTS idx_pesanan_rows_status ON pesanan_rows(di_produksi, di_warna, siap_kirim, di_kirim);

-- 7. View for Aging Piutang (using pesanan_rows)
DROP VIEW IF EXISTS v_cockpit_aging CASCADE;
CREATE OR REPLACE VIEW v_cockpit_aging AS
WITH invoice_totals AS (
    -- Group by invoice to deduplicate items from the same invoice
    -- Trim customer name to avoid duplicates with trailing spaces
    SELECT
        COALESCE(NULLIF(no_inv, ''), id::text) as inv_id,
        TRIM(customer) as customer_clean,
        tanggal,
        SUM(fn_parse_id_num(harga) * fn_parse_id_num(ukuran) * fn_parse_id_num(qty)) as total_price
    FROM pesanan_rows
    WHERE tanggal IS NOT NULL AND tanggal != ''
      AND NOT is_paid
    GROUP BY inv_id, customer_clean, tanggal
)
SELECT
  CASE
    WHEN (CURRENT_DATE - COALESCE(tanggal::date, CURRENT_DATE)) <= 30 THEN '0-30'
    WHEN (CURRENT_DATE - COALESCE(tanggal::date, CURRENT_DATE)) <= 60 THEN '31-60'
    WHEN (CURRENT_DATE - COALESCE(tanggal::date, CURRENT_DATE)) <= 90 THEN '61-90'
    ELSE '>90'
  END AS bucket,
  SUM(total_price) AS outstanding
FROM invoice_totals
WHERE total_price > 0
GROUP BY bucket;

-- 8. View for Top Debtors
DROP VIEW IF EXISTS v_cockpit_top_debtors CASCADE;
CREATE OR REPLACE VIEW v_cockpit_top_debtors AS
WITH invoice_totals AS (
    SELECT 
        TRIM(customer) as customer_clean,
        COALESCE(NULLIF(no_inv, ''), id::text) as inv_id,
        tanggal,
        SUM(fn_parse_id_num(harga) * fn_parse_id_num(ukuran) * fn_parse_id_num(qty)) as total_price
    FROM pesanan_rows
    WHERE NOT is_paid
    GROUP BY customer_clean, inv_id, tanggal
)
SELECT 
    customer_clean as customer_name,
    SUM(total_price) as total_outstanding,
    MAX(CURRENT_DATE - COALESCE(tanggal::date, CURRENT_DATE)) as oldest_days
FROM invoice_totals
WHERE total_price > 0
GROUP BY customer_clean
ORDER BY total_outstanding DESC
LIMIT 5;

-- 9. View for Stuck Orders (> 7 days)
DROP VIEW IF EXISTS v_cockpit_stuck_orders CASCADE;
CREATE OR REPLACE VIEW v_cockpit_stuck_orders AS
SELECT 
    id, 
    no_inv as no_invoice, 
    customer as customer_name, 
    CASE 
        WHEN di_kirim THEN 'Sudah Kirim'
        WHEN siap_kirim THEN 'Siap Kirim'
        WHEN di_warna THEN 'Warna'
        WHEN di_produksi THEN 'Produksi'
        ELSE 'Belum Produksi'
    END as status,
    age(now(), last_status_change) as age,
    EXTRACT(DAY FROM (now() - last_status_change))::int as age_days
FROM pesanan_rows
WHERE (NOT di_kirim)
  AND (now() - last_status_change) > interval '7 days';

-- 10. RPC for Cash-Flow Projection (14 days)
DROP FUNCTION IF EXISTS fn_cockpit_cashflow_14d() CASCADE;
CREATE OR REPLACE FUNCTION fn_cockpit_cashflow_14d()
RETURNS TABLE(forecast_date date, inflow bigint, outflow bigint, saldo_proyeksi bigint)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_current_saldo bigint;
    v_daily_outflow bigint;
    v_target_date date;
BEGIN
    -- Get current total bank balance
    v_current_saldo := (SELECT COALESCE(SUM(balance), 0) FROM bank_accounts);
    
    -- Estimate daily outflow (avg last 30 days)
    v_daily_outflow := (
        SELECT COALESCE(SUM(amount) / 30, 0) 
        FROM cash_flow 
        WHERE type = 'expense' 
          AND NULLIF(cash_flow.date, '')::date > (CURRENT_DATE - interval '30 days')
          AND cash_flow.date ~ '^\d{4}-\d{2}-\d{2}'
    );

    FOR i IN 0..13 LOOP
        v_target_date := (CURRENT_DATE + i);
        
        -- Inflow: Sum of unpaid invoices where (tanggal + 30 days) == target_date
        -- Deduplicated per invoice
        inflow := (
            WITH daily_invoices AS (
                SELECT 
                    COALESCE(NULLIF(no_inv, ''), id::text) as inv_id,
                    tanggal,
                    SUM(fn_parse_id_num(harga) * fn_parse_id_num(ukuran) * fn_parse_id_num(qty)) as inv_total
                FROM pesanan_rows
                WHERE NOT is_paid
                  AND tanggal ~ '^\d{4}-\d{2}-\d{2}'
                GROUP BY inv_id, tanggal
            )
            SELECT COALESCE(SUM(inv_total), 0)
            FROM daily_invoices
            WHERE (tanggal::date + interval '30 days')::date = v_target_date
        );

        outflow := v_daily_outflow;
        v_current_saldo := v_current_saldo + inflow - outflow;
        forecast_date := v_target_date;
        saldo_proyeksi := v_current_saldo;
        
        RETURN NEXT;
    END LOOP;
END;
$$;

-- 11. RPC for Balance Delta (7 days)
DROP FUNCTION IF EXISTS fn_cockpit_balance_delta_7d() CASCADE;
CREATE OR REPLACE FUNCTION fn_cockpit_balance_delta_7d()
RETURNS TABLE(total_now bigint, total_7d_ago bigint, delta bigint) 
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_bal_now bigint;
    v_cf_delta bigint;
BEGIN
    v_bal_now := (SELECT COALESCE(SUM(balance), 0) FROM bank_accounts);
    
    -- Cash flow in last 7 days: SUM(income - expense)
    v_cf_delta := (
        SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)
        FROM cash_flow
        WHERE NULLIF(date, '')::date > (CURRENT_DATE - interval '7 days')
          AND date ~ '^\d{4}-\d{2}-\d{2}'
    );

    total_now := v_bal_now;
    total_7d_ago := v_bal_now - v_cf_delta;
    delta := v_cf_delta;
    
    RETURN NEXT;
END;
$$;

-- 12. Monthly Targets Table
CREATE TABLE IF NOT EXISTS monthly_targets (
    year int, 
    month int, 
    target_profit bigint NOT NULL,
    updated_by uuid, 
    updated_at timestamptz DEFAULT now(),
    PRIMARY KEY(year, month)
);

-- 13. Grants
GRANT SELECT ON v_cockpit_aging TO authenticated;
GRANT SELECT ON v_cockpit_top_debtors TO authenticated;
GRANT SELECT ON v_cockpit_stuck_orders TO authenticated;
GRANT SELECT ON monthly_targets TO authenticated;

-- Avoid RLS complex policy if not using app_users correctly in auth.uid()
-- But keeping them as simple read for authenticated users for now
ALTER TABLE monthly_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read for authenticated" ON monthly_targets;
CREATE POLICY "Allow read for authenticated" ON monthly_targets FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Allow write for all" ON monthly_targets;
CREATE POLICY "Allow write for all" ON monthly_targets FOR ALL TO authenticated USING (true);
