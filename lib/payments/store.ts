import { supabase } from "@/lib/supabase-client";

const CUSTOMER_RECEIPT_CATEGORIES = [
  "Penerimaan Belum Teridentifikasi",
  "Pembayaran Invoice",
  "DP Invoice",
  "Penjualan",
  "Lainnya",
];

export type PaymentCashFlowRow = {
  id: string;
  amount: number;
  date: string;
  description: string;
  category: string;
  bank_account: string;
  account_id: string | null;
  created_by: string;
};

export type CustomerReceiptRow = {
  id: string;
  cash_flow_id: string;
  receipt_date: string;
  amount: number;
  bank_account_name: string;
  payer_name: string;
  bank_reference: string;
  bank_description: string;
  status: "unidentified" | "partially_applied" | "applied";
  created_by: string;
};

export type CustomerReceiptAllocationRow = {
  id: string;
  receipt_id: string;
  invoice_key: string;
  invoice_number: string;
  customer_name: string;
  amount: number;
  allocated_by: string;
  allocated_at: string;
};

export type OpenCustomerInvoiceRow = {
  invoice_key: string;
  invoice_number: string;
  customer_name: string;
  invoice_date: string;
  total_amount: number;
  allocated_amount: number;
  outstanding_amount: number;
};

const POSTGREST_PAGE_SIZE = 1000;

export async function createCustomerPaymentCashFlow(input: {
  type: "income";
  category: string;
  amount: number;
  description: string;
  date: string;
  bankAccount: string;
  accountId: string | null;
  createdBy: string;
}) {
  const id = crypto.randomUUID();
  const { error } = await supabase.from("cash_flow").insert({
    id,
    type: input.type,
    category: input.category,
    amount: input.amount,
    description: input.description,
    date: input.date,
    bank_account: input.bankAccount,
    account_id: input.accountId,
    created_by: input.createdBy,
    is_test: false,
    is_adjustment: false,
    transfer_group: null,
  });
  if (error) throw error;
  return { id };
}

export async function loadOpenCustomerInvoices() {
  const rows: OpenCustomerInvoiceRow[] = [];
  for (let from = 0; ; from += POSTGREST_PAGE_SIZE) {
    const { data, error } = await supabase.rpc("load_open_customer_invoices")
      .range(from, from + POSTGREST_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as OpenCustomerInvoiceRow[];
    rows.push(...page);
    if (page.length < POSTGREST_PAGE_SIZE) break;
  }
  return rows;
}

async function loadAllocations(receiptIds: string[]) {
  const rows: CustomerReceiptAllocationRow[] = [];
  for (let index = 0; index < receiptIds.length; index += 100) {
    const ids = receiptIds.slice(index, index + 100);
    const { data, error } = await supabase.from("customer_receipt_allocations")
      .select("id,receipt_id,invoice_key,invoice_number,customer_name,amount,allocated_by,allocated_at")
      .in("receipt_id", ids).order("allocated_at", { ascending: false });
    if (error) throw error;
    rows.push(...((data ?? []) as CustomerReceiptAllocationRow[]));
  }
  return rows;
}

export async function loadPaymentReconciliation(startDate: string, endDate: string) {
  const [flowResult, receiptResult, invoices] = await Promise.all([
    supabase.from("cash_flow")
      .select("id,amount,date,description,category,bank_account,account_id,created_by")
      .eq("type", "income").eq("is_test", false).is("transfer_group", null)
      .in("category", CUSTOMER_RECEIPT_CATEGORIES)
      .gte("date", startDate).lte("date", endDate).order("date", { ascending: false }),
    supabase.from("customer_receipts")
      .select("id,cash_flow_id,receipt_date,amount,bank_account_name,payer_name,bank_reference,bank_description,status,created_by")
      .eq("workspace", "toto").gte("receipt_date", startDate).lte("receipt_date", endDate)
      .order("receipt_date", { ascending: false }),
    loadOpenCustomerInvoices(),
  ]);
  const error = flowResult.error || receiptResult.error;
  if (error) throw error;
  const receipts = (receiptResult.data ?? []) as CustomerReceiptRow[];
  const allocations = receipts.length ? await loadAllocations(receipts.map(receipt => receipt.id)) : [];
  return {
    cashFlows: (flowResult.data ?? []) as PaymentCashFlowRow[],
    receipts,
    allocations,
    invoices,
  };
}

export async function registerCustomerReceipt(input: { cashFlowId: string; payerName: string; bankReference: string; username: string }) {
  const { data, error } = await supabase.rpc("register_customer_receipt", {
    p_cash_flow_id: input.cashFlowId,
    p_payer_name: input.payerName,
    p_bank_reference: input.bankReference,
    p_username: input.username,
  });
  if (error) throw error;
  return data as string;
}

export async function allocateCustomerReceipt(input: {
  receiptId: string;
  invoiceKey: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  username: string;
}) {
  const { data, error } = await supabase.rpc("allocate_customer_receipt", {
    p_receipt_id: input.receiptId,
    p_invoice_key: input.invoiceKey,
    p_invoice_number: input.invoiceNumber,
    p_customer_name: input.customerName,
    p_amount: Math.round(input.amount),
    p_username: input.username,
  });
  if (error) throw error;
  return data as string;
}

export async function removeCustomerReceiptAllocation(allocationId: string, username: string) {
  const { error } = await supabase.rpc("remove_customer_receipt_allocation", {
    p_allocation_id: allocationId,
    p_username: username,
  });
  if (error) throw error;
}
