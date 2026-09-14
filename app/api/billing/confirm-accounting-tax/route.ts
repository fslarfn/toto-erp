import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ACCOUNTING_TAX_BILLING } from "@/lib/billing/accounting-tax";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const callerRole = req.headers.get("x-user-role") ?? "";
  const callerUsername = req.headers.get("x-username") ?? "";
  const isFaisal = callerUsername.toLowerCase() === "faisal";

  if (!isFaisal && callerRole !== "owner") {
    return NextResponse.json({ error: "Hanya Faisal yang dapat mengonfirmasi pembayaran ini." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reportId = typeof body.reportId === "string" ? body.reportId : null;
    const supabase = getServiceSupabase();

    const { data: existing, error: existingError } = await supabase
      .from("billing_history")
      .select("*")
      .eq("order_id", ACCOUNTING_TAX_BILLING.orderId)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing) {
      if (reportId) {
        const { error: reportError } = await supabase
          .from("billing_manual_confirmations")
          .update({ status: "approved" })
          .eq("id", reportId);
        if (reportError) throw reportError;
      }
      return NextResponse.json({ invoice: existing, alreadyConfirmed: true });
    }

    const confirmedAt = new Date().toISOString();
    const { data: invoice, error: insertError } = await supabase
      .from("billing_history")
      .insert({
        order_id: ACCOUNTING_TAX_BILLING.orderId,
        amount: ACCOUNTING_TAX_BILLING.amount,
        payment_type: ACCOUNTING_TAX_BILLING.paymentType,
        status: "settlement",
        payment_method: "QRIS",
        gross_amount: ACCOUNTING_TAX_BILLING.amount,
        notes: ACCOUNTING_TAX_BILLING.title,
        transaction_time: confirmedAt,
        settlement_time: confirmedAt,
        raw_response: {
          source: "owner_confirmation",
          confirmed_by: callerUsername || "owner",
          invoice_number: ACCOUNTING_TAX_BILLING.invoiceNumber,
        },
        created_at: confirmedAt,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        const { data: racedInvoice, error: racedError } = await supabase
          .from("billing_history")
          .select("*")
          .eq("order_id", ACCOUNTING_TAX_BILLING.orderId)
          .single();
        if (racedError) throw racedError;
        return NextResponse.json({ invoice: racedInvoice, alreadyConfirmed: true });
      }
      throw insertError;
    }

    if (reportId) {
      const { error: reportError } = await supabase
        .from("billing_manual_confirmations")
        .update({ status: "approved" })
        .eq("id", reportId);
      if (reportError) throw reportError;
    }

    return NextResponse.json({ invoice, alreadyConfirmed: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonfirmasi pembayaran.";
    console.error("Accounting tax payment confirmation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
