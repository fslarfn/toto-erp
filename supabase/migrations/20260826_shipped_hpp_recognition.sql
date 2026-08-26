-- Pengakuan HPP saat barang berubah menjadi Dikirim.
-- Jalankan setelah 20260825_product_hpp.sql dan fondasi Akuntansi & Pajak.

CREATE TABLE IF NOT EXISTS hpp_product_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  alias_name text NOT NULL CHECK (length(trim(alias_name)) > 0),
  product_hpp_id uuid NOT NULL REFERENCES product_hpp(id) ON DELETE CASCADE,
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hpp_product_alias_name
  ON hpp_product_aliases(workspace, lower(trim(alias_name)));

CREATE TABLE IF NOT EXISTS sales_hpp_recognitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace text NOT NULL DEFAULT 'toto',
  pesanan_id bigint NOT NULL,
  recognition_date date NOT NULL,
  order_reference text NOT NULL DEFAULT '',
  customer_name text NOT NULL DEFAULT '',
  order_product_name text NOT NULL DEFAULT '',
  product_hpp_id uuid REFERENCES product_hpp(id) ON DELETE RESTRICT,
  product_name_snapshot text NOT NULL DEFAULT '',
  quantity numeric(16,3) NOT NULL DEFAULT 0,
  size_meter numeric(16,3) NOT NULL DEFAULT 0,
  total_meter numeric(16,3) NOT NULL DEFAULT 0,
  selling_price_per_meter bigint NOT NULL DEFAULT 0,
  revenue_total bigint NOT NULL DEFAULT 0,
  material_cost_per_meter bigint NOT NULL DEFAULT 0,
  material_cost_total bigint NOT NULL DEFAULT 0,
  total_hpp_per_meter bigint NOT NULL DEFAULT 0,
  total_hpp bigint NOT NULL DEFAULT 0,
  margin_total bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending_mapping'
    CHECK (status IN ('pending_mapping','blocked','posted')),
  journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE RESTRICT,
  notes text NOT NULL DEFAULT '',
  processed_by text NOT NULL DEFAULT '',
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace, pesanan_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_hpp_recognition_date
  ON sales_hpp_recognitions(workspace, recognition_date, status);

ALTER TABLE hpp_product_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_hpp_recognitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hpp aliases owner finance" ON hpp_product_aliases;
CREATE POLICY "hpp aliases owner finance" ON hpp_product_aliases FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));
DROP POLICY IF EXISTS "sales hpp owner finance" ON sales_hpp_recognitions;
CREATE POLICY "sales hpp owner finance" ON sales_hpp_recognitions FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner','finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner','finance'));

-- Pastikan jurnal menerima sumber HPP meskipun migrasi HPP per-PO tidak pernah dijalankan.
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_source_type_check;
ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_source_type_check
  CHECK (source_type IN ('manual','cash_flow','payroll','tax','hpp'));

CREATE OR REPLACE FUNCTION parse_erp_numeric(p_value text)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE cleaned text;
BEGIN
  cleaned := regexp_replace(COALESCE(p_value,''), '[^0-9,.-]', '', 'g');
  IF cleaned = '' THEN RETURN 0; END IF;
  IF position(',' IN cleaned) > 0 THEN
    cleaned := replace(replace(cleaned, '.', ''), ',', '.');
  ELSIF cleaned ~ '^\d{1,3}(\.\d{3})+$' THEN
    cleaned := replace(cleaned, '.', '');
  END IF;
  RETURN GREATEST(COALESCE(cleaned::numeric, 0), 0);
EXCEPTION WHEN invalid_text_representation THEN RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION process_shipped_hpp(p_pesanan_id bigint, p_username text DEFAULT '')
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  order_row pesanan_rows%ROWTYPE;
  product product_hpp%ROWTYPE;
  recognition sales_hpp_recognitions%ROWTYPE;
  quantity_value numeric;
  size_value numeric;
  meter_value numeric;
  revenue_value bigint;
  material_value bigint;
  total_hpp_value bigint;
  recognition_day date;
  inventory_id uuid;
  hpp_id uuid;
  entry_id uuid;
BEGIN
  SELECT * INTO order_row FROM pesanan_rows WHERE id = p_pesanan_id;
  IF NOT FOUND OR NOT COALESCE(order_row.di_kirim, false) THEN RETURN 'not_shipped'; END IF;

  SELECT * INTO recognition FROM sales_hpp_recognitions
    WHERE workspace = 'toto' AND pesanan_id = p_pesanan_id FOR UPDATE;
  IF FOUND AND recognition.status = 'posted' THEN RETURN 'already_posted'; END IF;

  SELECT p.* INTO product
  FROM hpp_product_aliases a JOIN product_hpp p ON p.id = a.product_hpp_id
  WHERE a.workspace = 'toto' AND lower(trim(a.alias_name)) = lower(trim(order_row.deskripsi))
  LIMIT 1;
  IF NOT FOUND THEN
    SELECT * INTO product FROM product_hpp
      WHERE workspace = 'toto' AND lower(trim(product_name)) = lower(trim(order_row.deskripsi))
      LIMIT 1;
  END IF;

  recognition_day := COALESCE(
    (order_row.shipped_at AT TIME ZONE 'Asia/Jakarta')::date,
    (now() AT TIME ZONE 'Asia/Jakarta')::date
  );
  IF NOT FOUND THEN
    INSERT INTO sales_hpp_recognitions(
      workspace,pesanan_id,recognition_date,order_reference,customer_name,order_product_name,status,notes
    ) VALUES (
      'toto',order_row.id,recognition_day,
      COALESCE(NULLIF(order_row.po_label,''),NULLIF(order_row.no_inv,''),'PO-'||order_row.id),
      COALESCE(order_row.customer,''),COALESCE(order_row.deskripsi,''),'pending_mapping',
      'Nama barang belum terhubung ke katalog HPP'
    ) ON CONFLICT(workspace,pesanan_id) DO UPDATE SET
      recognition_date=EXCLUDED.recognition_date,order_reference=EXCLUDED.order_reference,
      customer_name=EXCLUDED.customer_name,order_product_name=EXCLUDED.order_product_name,
      status='pending_mapping',notes=EXCLUDED.notes,updated_at=now();
    RETURN 'pending_mapping';
  END IF;

  quantity_value := GREATEST(parse_erp_numeric(order_row.qty), 1);
  size_value := GREATEST(parse_erp_numeric(order_row.ukuran), 1);
  meter_value := quantity_value * size_value;
  revenue_value := round(parse_erp_numeric(order_row.harga) * meter_value)::bigint;
  material_value := round(product.material_cost_per_meter * meter_value)::bigint;
  total_hpp_value := round(product.total_cost_per_meter * meter_value)::bigint;

  IF EXISTS (
    SELECT 1 FROM corporate_tax_returns
    WHERE workspace='toto' AND tax_year=EXTRACT(YEAR FROM recognition_day) AND status='locked'
  ) THEN
    INSERT INTO sales_hpp_recognitions(
      workspace,pesanan_id,recognition_date,order_reference,customer_name,order_product_name,
      product_hpp_id,product_name_snapshot,quantity,size_meter,total_meter,selling_price_per_meter,
      revenue_total,material_cost_per_meter,material_cost_total,total_hpp_per_meter,total_hpp,margin_total,
      status,notes,processed_by,processed_at
    ) VALUES (
      'toto',order_row.id,recognition_day,COALESCE(NULLIF(order_row.po_label,''),NULLIF(order_row.no_inv,''),'PO-'||order_row.id),
      COALESCE(order_row.customer,''),COALESCE(order_row.deskripsi,''),product.id,product.product_name,
      quantity_value,size_value,meter_value,parse_erp_numeric(order_row.harga)::bigint,revenue_value,
      product.material_cost_per_meter,material_value,product.total_cost_per_meter,total_hpp_value,
      revenue_value-total_hpp_value,'blocked','Tahun pajak sudah terkunci',COALESCE(p_username,''),now()
    ) ON CONFLICT(workspace,pesanan_id) DO UPDATE SET
      product_hpp_id=EXCLUDED.product_hpp_id,product_name_snapshot=EXCLUDED.product_name_snapshot,
      quantity=EXCLUDED.quantity,size_meter=EXCLUDED.size_meter,total_meter=EXCLUDED.total_meter,
      revenue_total=EXCLUDED.revenue_total,material_cost_per_meter=EXCLUDED.material_cost_per_meter,
      material_cost_total=EXCLUDED.material_cost_total,total_hpp_per_meter=EXCLUDED.total_hpp_per_meter,
      total_hpp=EXCLUDED.total_hpp,margin_total=EXCLUDED.margin_total,status='blocked',
      notes=EXCLUDED.notes,processed_by=EXCLUDED.processed_by,processed_at=now(),updated_at=now();
    RETURN 'blocked';
  END IF;

  SELECT id INTO inventory_id FROM accounting_accounts WHERE workspace='toto' AND code='1301' AND is_active;
  SELECT id INTO hpp_id FROM accounting_accounts WHERE workspace='toto' AND code='5101' AND is_active;
  IF inventory_id IS NULL OR hpp_id IS NULL THEN RAISE EXCEPTION 'Akun Persediaan 1301 atau HPP 5101 belum tersedia'; END IF;

  SELECT id INTO entry_id FROM journal_entries
    WHERE workspace='toto' AND source_type='hpp' AND source_id='sale-hpp:'||order_row.id LIMIT 1;
  IF entry_id IS NULL THEN
    INSERT INTO journal_entries(workspace,entry_date,reference,description,source_type,source_id,status,created_by)
    VALUES('toto',recognition_day,'HPP-KIRIM-'||order_row.id,
      'HPP bahan terjual '||COALESCE(NULLIF(order_row.deskripsi,''),'Pesanan '||order_row.id),
      'hpp','sale-hpp:'||order_row.id,'draft',COALESCE(p_username,'') ) RETURNING id INTO entry_id;
    INSERT INTO journal_lines(journal_entry_id,account_id,description,debit,credit,line_no) VALUES
      (entry_id,hpp_id,'HPP bahan saat barang dikirim',material_value,0,1),
      (entry_id,inventory_id,'Pengurangan persediaan saat barang dikirim',0,material_value,2);
    UPDATE journal_entries SET status='locked',locked_by=COALESCE(p_username,''),locked_at=now() WHERE id=entry_id;
  END IF;

  INSERT INTO sales_hpp_recognitions(
    workspace,pesanan_id,recognition_date,order_reference,customer_name,order_product_name,
    product_hpp_id,product_name_snapshot,quantity,size_meter,total_meter,selling_price_per_meter,
    revenue_total,material_cost_per_meter,material_cost_total,total_hpp_per_meter,total_hpp,margin_total,
    status,journal_entry_id,notes,processed_by,processed_at
  ) VALUES (
    'toto',order_row.id,recognition_day,COALESCE(NULLIF(order_row.po_label,''),NULLIF(order_row.no_inv,''),'PO-'||order_row.id),
    COALESCE(order_row.customer,''),COALESCE(order_row.deskripsi,''),product.id,product.product_name,
    quantity_value,size_value,meter_value,parse_erp_numeric(order_row.harga)::bigint,revenue_value,
    product.material_cost_per_meter,material_value,product.total_cost_per_meter,total_hpp_value,
    revenue_value-total_hpp_value,'posted',entry_id,'Snapshot HPP saat barang ditandai Dikirim',
    COALESCE(p_username,''),now()
  ) ON CONFLICT(workspace,pesanan_id) DO UPDATE SET
    recognition_date=EXCLUDED.recognition_date,order_reference=EXCLUDED.order_reference,
    customer_name=EXCLUDED.customer_name,order_product_name=EXCLUDED.order_product_name,
    product_hpp_id=EXCLUDED.product_hpp_id,product_name_snapshot=EXCLUDED.product_name_snapshot,
    quantity=EXCLUDED.quantity,size_meter=EXCLUDED.size_meter,total_meter=EXCLUDED.total_meter,
    selling_price_per_meter=EXCLUDED.selling_price_per_meter,revenue_total=EXCLUDED.revenue_total,
    material_cost_per_meter=EXCLUDED.material_cost_per_meter,material_cost_total=EXCLUDED.material_cost_total,
    total_hpp_per_meter=EXCLUDED.total_hpp_per_meter,total_hpp=EXCLUDED.total_hpp,
    margin_total=EXCLUDED.margin_total,status='posted',journal_entry_id=EXCLUDED.journal_entry_id,
    notes=EXCLUDED.notes,processed_by=EXCLUDED.processed_by,processed_at=now(),updated_at=now();
  RETURN 'posted';
END;
$$;

CREATE OR REPLACE FUNCTION trigger_recognize_shipped_hpp()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.di_kirim IS TRUE AND (TG_OP='INSERT' OR OLD.di_kirim IS DISTINCT FROM NEW.di_kirim) THEN
    PERFORM process_shipped_hpp(NEW.id, 'status_barang');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS recognize_hpp_when_shipped ON pesanan_rows;
CREATE TRIGGER recognize_hpp_when_shipped AFTER INSERT OR UPDATE OF di_kirim ON pesanan_rows
  FOR EACH ROW EXECUTE FUNCTION trigger_recognize_shipped_hpp();

CREATE OR REPLACE FUNCTION map_and_process_sales_hpp(p_recognition_id uuid,p_product_id uuid,p_alias text,p_username text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE order_id bigint; current_status text;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  SELECT pesanan_id,status INTO order_id,current_status FROM sales_hpp_recognitions WHERE id=p_recognition_id;
  IF order_id IS NULL THEN RAISE EXCEPTION 'Pengakuan HPP tidak ditemukan'; END IF;
  IF current_status='posted' THEN RAISE EXCEPTION 'HPP penjualan sudah dibukukan'; END IF;
  INSERT INTO hpp_product_aliases(workspace,alias_name,product_hpp_id,created_by)
    VALUES('toto',trim(p_alias),p_product_id,COALESCE(p_username,''))
    ON CONFLICT DO NOTHING;
  UPDATE hpp_product_aliases SET product_hpp_id=p_product_id,created_by=COALESCE(p_username,'')
    WHERE workspace='toto' AND lower(trim(alias_name))=lower(trim(p_alias));
  RETURN process_shipped_hpp(order_id,p_username);
END;
$$;

CREATE OR REPLACE FUNCTION sync_existing_shipped_hpp(p_username text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE row_item record; result text; posted_count int:=0; pending_count int:=0; blocked_count int:=0;
BEGIN
  IF COALESCE(auth.jwt()->>'user_role','') NOT IN ('owner','finance') THEN RAISE EXCEPTION 'Akses ditolak'; END IF;
  FOR row_item IN SELECT id FROM pesanan_rows p WHERE p.di_kirim IS TRUE
    AND NOT EXISTS(SELECT 1 FROM sales_hpp_recognitions r WHERE r.workspace='toto' AND r.pesanan_id=p.id)
  LOOP
    result:=process_shipped_hpp(row_item.id,p_username);
    IF result='posted' THEN posted_count:=posted_count+1;
    ELSIF result='blocked' THEN blocked_count:=blocked_count+1;
    ELSE pending_count:=pending_count+1; END IF;
  END LOOP;
  RETURN jsonb_build_object('posted',posted_count,'pending',pending_count,'blocked',blocked_count);
END;
$$;

REVOKE ALL ON FUNCTION process_shipped_hpp(bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_shipped_hpp(bigint,text) FROM anon,authenticated;
REVOKE ALL ON FUNCTION map_and_process_sales_hpp(uuid,uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION sync_existing_shipped_hpp(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION map_and_process_sales_hpp(uuid,uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION sync_existing_shipped_hpp(text) TO authenticated;
