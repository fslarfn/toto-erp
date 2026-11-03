-- Diskon disimpan per invoice. DP diisi otomatis dari alokasi transaksi
-- kategori `DP Invoice` yang ditautkan di Keuangan; tabel ini tidak membuat
-- kas, jurnal, atau perubahan status lunas.
CREATE TABLE IF NOT EXISTS public.invoice_adjustments (
  invoice_number text PRIMARY KEY,
  dp_amount bigint NOT NULL DEFAULT 0 CHECK (dp_amount >= 0),
  discount_amount bigint NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invoice_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice adjustments internal read" ON public.invoice_adjustments;
CREATE POLICY "invoice adjustments internal read"
  ON public.invoice_adjustments FOR SELECT TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner', 'finance', 'sales', 'produksi', 'barang'));

DROP POLICY IF EXISTS "invoice adjustments finance write" ON public.invoice_adjustments;
CREATE POLICY "invoice adjustments finance write"
  ON public.invoice_adjustments FOR ALL TO authenticated
  USING ((auth.jwt()->>'user_role') IN ('owner', 'finance'))
  WITH CHECK ((auth.jwt()->>'user_role') IN ('owner', 'finance'));

GRANT SELECT, INSERT, UPDATE ON public.invoice_adjustments TO authenticated;

CREATE OR REPLACE FUNCTION public.set_invoice_adjustments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.invoice_number := upper(btrim(COALESCE(NEW.invoice_number, '')));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_invoice_adjustments_updated_at ON public.invoice_adjustments;
CREATE TRIGGER set_invoice_adjustments_updated_at
  BEFORE INSERT OR UPDATE ON public.invoice_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.set_invoice_adjustments_updated_at();

REVOKE ALL ON FUNCTION public.set_invoice_adjustments_updated_at() FROM PUBLIC, anon, authenticated;

-- DP harus mengikuti alokasi pembayaran, bukan nilai yang diketik terpisah
-- pada Status Barang. Trigger berjalan di dalam transaksi alokasi, sehingga
-- apabila alokasi dibatalkan nominal DP kembali berkurang tanpa mengubah
-- cash_flow, saldo bank, atau jurnal yang sudah ada.
CREATE OR REPLACE FUNCTION public.sync_invoice_dp_from_receipt_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_receipt_id uuid;
  invoice_no text;
  allocation_amount bigint;
  cash_category text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    source_receipt_id := NEW.receipt_id;
    invoice_no := upper(btrim(COALESCE(NEW.invoice_number, '')));
    allocation_amount := round(COALESCE(NEW.amount, 0))::bigint;
  ELSE
    source_receipt_id := OLD.receipt_id;
    invoice_no := upper(btrim(COALESCE(OLD.invoice_number, '')));
    allocation_amount := round(COALESCE(OLD.amount, 0))::bigint;
  END IF;

  SELECT flow.category INTO cash_category
  FROM public.customer_receipts receipt
  JOIN public.cash_flow flow ON flow.id::text = receipt.cash_flow_id
  WHERE receipt.id = source_receipt_id;

  IF cash_category IS DISTINCT FROM 'DP Invoice' OR invoice_no = '' OR allocation_amount <= 0 THEN
    IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.invoice_adjustments (invoice_number, dp_amount)
    VALUES (invoice_no, allocation_amount)
    ON CONFLICT (invoice_number) DO UPDATE
      SET dp_amount = public.invoice_adjustments.dp_amount + EXCLUDED.dp_amount;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.invoice_adjustments
      SET dp_amount = GREATEST(dp_amount - allocation_amount, 0)
      WHERE invoice_number = invoice_no;
  END IF;

  IF TG_OP = 'INSERT' THEN RETURN NEW; END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS sync_invoice_dp_from_receipt_allocation ON public.customer_receipt_allocations;
CREATE TRIGGER sync_invoice_dp_from_receipt_allocation
  AFTER INSERT OR DELETE ON public.customer_receipt_allocations
  FOR EACH ROW EXECUTE FUNCTION public.sync_invoice_dp_from_receipt_allocation();

-- Ambil DP yang sebelumnya sudah dicatat dan dialokasikan ke invoice. Data
-- order, transaksi, saldo, serta jurnal lama tidak diubah.
INSERT INTO public.invoice_adjustments (invoice_number, dp_amount)
SELECT upper(btrim(allocation.invoice_number)), sum(round(allocation.amount))::bigint
FROM public.customer_receipt_allocations allocation
JOIN public.customer_receipts receipt ON receipt.id = allocation.receipt_id
JOIN public.cash_flow flow ON flow.id::text = receipt.cash_flow_id
WHERE flow.category = 'DP Invoice'
  AND upper(btrim(COALESCE(allocation.invoice_number, ''))) <> ''
GROUP BY upper(btrim(allocation.invoice_number))
ON CONFLICT (invoice_number) DO UPDATE
  SET dp_amount = EXCLUDED.dp_amount;

REVOKE ALL ON FUNCTION public.sync_invoice_dp_from_receipt_allocation() FROM PUBLIC, anon, authenticated;
