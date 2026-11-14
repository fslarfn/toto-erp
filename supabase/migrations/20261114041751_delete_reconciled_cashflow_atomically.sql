-- Menghapus mutasi keuangan Toto secara atomik. Jalur ini dipakai dari menu
-- Keuangan ketika transaksi sudah memiliki rekonsiliasi maupun jurnal sumber.
-- Periode yang telah ditutup tetap tidak dapat disentuh.

CREATE OR REPLACE FUNCTION public.guard_reconciled_cash_flow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  receipt_row public.customer_receipts%ROWTYPE;
BEGIN
  -- Hanya RPC delete_cash_flow_with_dependents yang mengaktifkan konteks ini
  -- pada transaksi database yang sama. Penghapusan biasa dari client tetap
  -- terlindungi.
  IF TG_OP = 'DELETE'
     AND current_setting('app.cash_flow_delete_cascade', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT * INTO receipt_row
  FROM public.customer_receipts
  WHERE workspace = 'toto' AND cash_flow_id = OLD.id::text
  FOR UPDATE;

  IF NOT FOUND THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Mutasi sudah masuk rekonsiliasi dan tidak dapat dihapus';
  END IF;

  IF (
    NEW.type IS DISTINCT FROM OLD.type OR NEW.amount IS DISTINCT FROM OLD.amount OR
    NEW.date IS DISTINCT FROM OLD.date OR NEW.category IS DISTINCT FROM OLD.category OR
    NEW.bank_account IS DISTINCT FROM OLD.bank_account OR NEW.account_id IS DISTINCT FROM OLD.account_id OR
    NEW.is_test IS DISTINCT FROM OLD.is_test OR NEW.transfer_group IS DISTINCT FROM OLD.transfer_group
  ) THEN
    RAISE EXCEPTION 'Mutasi sudah masuk rekonsiliasi. Data utama tidak dapat diubah';
  END IF;

  UPDATE public.customer_receipts
  SET receipt_date = left(NEW.date::text, 10)::date,
      amount = round(NEW.amount)::bigint,
      bank_account_name = coalesce(NEW.bank_account, ''),
      bank_description = coalesce(NEW.description, ''),
      updated_at = now()
  WHERE id = receipt_row.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_cash_flow_journal_description()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.cash_flow_delete_cascade', true) = 'on' THEN
    RETURN OLD;
  END IF;

  PERFORM id
  FROM public.journal_entries
  WHERE workspace = 'toto' AND source_type = 'cash_flow' AND source_id = OLD.id::text
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE workspace = 'toto' AND source_type = 'cash_flow'
      AND source_id = OLD.id::text AND status = 'locked'
  ) THEN
    RAISE EXCEPTION 'Transaksi masuk jurnal terkunci. Gunakan koreksi, bukan edit atau hapus.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.journal_entries
      WHERE workspace = 'toto' AND source_type = 'cash_flow' AND source_id = OLD.id::text
    ) THEN
      RAISE EXCEPTION 'Hapus draft jurnal terkait sebelum menghapus transaksi.';
    END IF;
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.journal_entries
    WHERE workspace = 'toto' AND source_type = 'cash_flow' AND source_id = OLD.id::text
  ) AND (to_jsonb(NEW) - 'description') IS DISTINCT FROM (to_jsonb(OLD) - 'description') THEN
    RAISE EXCEPTION 'Transaksi memiliki draft jurnal. Hapus draft sebelum mengubah data selain keterangan.';
  END IF;

  IF NEW.description IS DISTINCT FROM OLD.description THEN
    UPDATE public.journal_entries
    SET description = coalesce(NEW.description, ''), updated_at = now()
    WHERE workspace = 'toto' AND source_type = 'cash_flow'
      AND source_id = NEW.id::text AND status = 'draft';

    UPDATE public.journal_lines
    SET description = coalesce(NEW.description, '')
    WHERE journal_entry_id IN (
      SELECT id FROM public.journal_entries
      WHERE workspace = 'toto' AND source_type = 'cash_flow'
        AND source_id = NEW.id::text AND status = 'draft'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_locked_journal_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  total_debit bigint;
  total_credit bigint;
  line_count int;
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.cash_flow_delete_cascade', true) = 'on' THEN
    RETURN OLD;
  END IF;

  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Jurnal terkunci tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW.status = 'locked' THEN
    SELECT coalesce(sum(debit), 0), coalesce(sum(credit), 0), count(*)
    INTO total_debit, total_credit, line_count
    FROM public.journal_lines
    WHERE journal_entry_id = OLD.id;
    IF line_count < 2 OR total_debit <= 0 OR total_debit <> total_credit THEN
      RAISE EXCEPTION 'Jurnal tidak seimbang atau kurang dari dua baris';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_locked_journal_line()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_status text;
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('app.cash_flow_delete_cascade', true) = 'on' THEN
    RETURN OLD;
  END IF;

  SELECT status INTO parent_status
  FROM public.journal_entries
  WHERE id = coalesce(NEW.journal_entry_id, OLD.journal_entry_id);
  IF parent_status = 'locked' THEN
    RAISE EXCEPTION 'Baris jurnal terkunci tidak dapat diubah atau dihapus';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_cash_flow_with_dependents(p_cash_flow_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  flow_row public.cash_flow%ROWTYPE;
  receipt_row public.customer_receipts%ROWTYPE;
  allocation_invoice_keys text[] := ARRAY[]::text[];
  allocation_source_ids text[] := ARRAY[]::text[];
  related_journal_ids uuid[] := ARRAY[]::uuid[];
  affected_invoice_key text;
  deleted_allocations integer := 0;
  deleted_journals integer := 0;
BEGIN
  IF coalesce(auth.jwt()->>'user_role', '') NOT IN ('owner', 'finance') THEN
    RAISE EXCEPTION 'Akses ditolak untuk menghapus transaksi keuangan';
  END IF;

  SELECT * INTO flow_row
  FROM public.cash_flow
  WHERE id = p_cash_flow_id AND operating_unit = 'toto_pusat'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi Keuangan Toto tidak ditemukan';
  END IF;

  SELECT * INTO receipt_row
  FROM public.customer_receipts
  WHERE workspace = 'toto' AND cash_flow_id = flow_row.id::text
  FOR UPDATE;

  IF FOUND THEN
    SELECT
      coalesce(array_agg(invoice_key), ARRAY[]::text[]),
      coalesce(array_agg('receipt-allocation:' || id::text), ARRAY[]::text[])
    INTO allocation_invoice_keys, allocation_source_ids
    FROM public.customer_receipt_allocations
    WHERE receipt_id = receipt_row.id;
  END IF;

  SELECT coalesce(array_agg(DISTINCT journal_id), ARRAY[]::uuid[])
  INTO related_journal_ids
  FROM (
    SELECT entry.id AS journal_id
    FROM public.journal_entries entry
    WHERE entry.workspace = 'toto'
      AND entry.source_type = 'cash_flow'
      AND entry.source_id = flow_row.id::text

    UNION

    SELECT entry.id
    FROM public.journal_entries entry
    WHERE receipt_row.id IS NOT NULL
      AND entry.workspace = 'toto'
      AND (
        entry.id = receipt_row.normalization_entry_id
        OR entry.source_id = 'receipt-normalize:' || receipt_row.id::text
        OR entry.source_id = ANY(allocation_source_ids)
      )
  ) related;

  IF EXISTS (
    SELECT 1
    FROM public.journal_entries entry
    JOIN public.accounting_periods period
      ON period.workspace = entry.workspace
      AND period.period = to_char(entry.entry_date, 'YYYY-MM')
      AND period.status = 'closed'
    WHERE entry.id = ANY(related_journal_ids)
  ) THEN
    RAISE EXCEPTION 'Periode jurnal sudah ditutup. Buka kembali periode tersebut sebelum menghapus transaksi.';
  END IF;

  -- Konteks ini hanya berlaku hingga transaksi database berakhir. Trigger
  -- tetap menolak hapus langsung dari browser atau jalur lain.
  PERFORM set_config('app.cash_flow_delete_cascade', 'on', true);

  IF receipt_row.id IS NOT NULL THEN
    DELETE FROM public.customer_receipt_allocations
    WHERE receipt_id = receipt_row.id;
    GET DIAGNOSTICS deleted_allocations = ROW_COUNT;

    -- Kembalikan status pelunasan invoice berdasarkan alokasi yang tersisa.
    FOREACH affected_invoice_key IN ARRAY allocation_invoice_keys LOOP
      PERFORM public.refresh_customer_invoice_paid_status(affected_invoice_key);
    END LOOP;

    DELETE FROM public.customer_receipts WHERE id = receipt_row.id;
  END IF;

  -- Lepaskan tautan pencatatan gaji bila transaksi yang dihapus adalah catatan
  -- pengeluaran gaji; data gaji tidak ikut dihapus.
  UPDATE public.gaji
  SET cash_flow_id = NULL
  WHERE cash_flow_id = flow_row.id::text;

  DELETE FROM public.journal_lines
  WHERE journal_entry_id = ANY(related_journal_ids);

  DELETE FROM public.journal_entries
  WHERE id = ANY(related_journal_ids);
  GET DIAGNOSTICS deleted_journals = ROW_COUNT;

  DELETE FROM public.cash_flow WHERE id = flow_row.id;

  RETURN jsonb_build_object(
    'cash_flow_id', flow_row.id,
    'deleted_allocations', deleted_allocations,
    'deleted_journals', deleted_journals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.delete_cash_flow_with_dependents(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_cash_flow_with_dependents(text) TO authenticated;
