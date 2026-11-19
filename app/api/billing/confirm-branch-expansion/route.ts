import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { BRANCH_EXPANSION_BILLING } from "@/lib/billing/branch-expansion";

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
    return NextResponse.json({ error: "Hanya owner yang dapat mengonfirmasi pembayaran ini." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const reportId = typeof body.reportId === "string" ? body.reportId : null;
    const supabase = getServiceSupabase();

    const { data: existing, error: existingError } = await supabase
      .from("billing_history")
      .select("*")
      .eq("order_id", BRANCH_EXPANSION_BILLING.orderId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      if (reportId) {
        const { error } = await supabase
          .from("billing_manual_confirmations")
          .update({ status: "approved" })
          .eq("id", reportId);
        if (error) throw error;
      }
      return NextResponse.json({ invoice: existing, alreadyConfirmed: true });
    }

    const confirmedAt = new Date().toISOString();
    const { data: invoice, error: insertError } = await supabase
      .from("billing_history")
      .insert({
        order_id: BRANCH_EXPANSION_BILLING.orderId,
        amount: BRANCH_EXPANSION_BILLING.amount,
        payment_type: BRANCH_EXPANSION_BILLING.paymentType,
        status: "settlement",
        payment_method: "Transfer / QRIS",
        gross_amount: BRANCH_EXPANSION_BILLING.amount,
        notes: BRANCH_EXPANSION_BILLING.title,
        transaction_time: confirmedAt,
        settlement_time: confirmedAt,
        raw_response: {
          source: "owner_confirmation",
          confirmed_by: callerUsername || "owner",
          invoice_number: BRANCH_EXPANSION_BILLING.invoiceNumber,
        },
        created_at: confirmedAt,
      })
      .select("*")
      .single();
    if (insertError) throw insertError;

    if (reportId) {
      const { error } = await supabase
        .from("billing_manual_confirmations")
        .update({ status: "approved" })
        .eq("id", reportId);
      if (error) throw error;
    }

    return NextResponse.json({ invoice, alreadyConfirmed: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal mengonfirmasi pembayaran.";
    console.error("Branch expansion payment confirmation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
