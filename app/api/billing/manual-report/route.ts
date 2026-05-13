import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { username, amount, reference_number, bukti_url, notes, type } = body;

    if (!username || !amount || !reference_number) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const isAbsensi = type === "aktivasi_absensi";

    const { data, error } = await supabase
      .from("billing_manual_confirmations")
      .insert({
        username,
        amount: Number(amount),
        reference_number,
        bukti_url: bukti_url || null,
        notes: notes || null,
        type: type || "perpanjang_web_app",
        status: isAbsensi ? "auto_approved" : "pending",
      })
      .select()
      .single();

    if (error) throw error;

    if (isAbsensi) {
      const nextPaymentAt = new Date();
      nextPaymentAt.setFullYear(nextPaymentAt.getFullYear() + 1);

      const [configErr, historyErr] = await Promise.all([
        supabase
          .from("app_config")
          .update({ is_absensi_aktif: true, absensi_next_payment_at: nextPaymentAt.toISOString() })
          .eq("id", 1)
          .then((r) => r.error),
        supabase
          .from("billing_history")
          .insert({
            order_id: `ABSENSI-${Date.now()}`,
            amount: 6100000,
            payment_type: "absensi_activation",
            status: "settlement",
            payment_method: "QRIS",
            created_at: new Date().toISOString(),
          })
          .then((r) => r.error),
      ]);
      if (configErr) throw configErr;
      if (historyErr) throw historyErr;
    }

    return NextResponse.json({ message: "Report submitted successfully", data });
  } catch (error: any) {
    console.error("Manual report error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
