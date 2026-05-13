import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_ROLES = ["owner", "finance"];

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const callerRole = req.headers.get("x-user-role") ?? "";
  const callerUsername = req.headers.get("x-username") ?? "";
  const isAdmin = ADMIN_ROLES.includes(callerRole) || callerUsername === "faisal";

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { reportId } = await req.json();
    const supabase = getServiceSupabase();

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

    if (reportId) {
      const { error: updateErr } = await supabase
        .from("billing_manual_confirmations")
        .update({ status: "approved" })
        .eq("id", reportId);
      if (updateErr) throw updateErr;
    }

    return NextResponse.json({ message: "Absensi activated successfully" });
  } catch (error: any) {
    console.error("Activate absensi error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
