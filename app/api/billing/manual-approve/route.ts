import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_ROLES = ["owner", "finance"];

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    // Identitas diambil dari header yang diset middleware (bukan dari body)
    const callerRole = req.headers.get("x-user-role") ?? "";
    const callerUsername = req.headers.get("x-username") ?? "";

    const isAdmin =
      ADMIN_ROLES.includes(callerRole) || callerUsername === "faisal";

    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { confirmationId } = await req.json();
    if (!confirmationId) {
      return NextResponse.json({ error: "confirmationId diperlukan" }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: confirmation, error: fetchErr } = await supabase
      .from("billing_manual_confirmations")
      .select("*")
      .eq("id", confirmationId)
      .single();

    if (fetchErr || !confirmation) throw new Error("Confirmation report not found");
    if (confirmation.status === "approved") throw new Error("Already approved");

    const { data: config, error: configErr } = await supabase
      .from("app_config")
      .select("*")
      .eq("id", 1)
      .single();

    if (configErr) throw configErr;

    const isInitial = !config.is_setup_completed;
    const daysToAdd = isInitial ? 60 : 30;

    let baseDate = new Date();
    const currentExpired = new Date(config.license_expired_at);
    if (currentExpired > baseDate) baseDate = currentExpired;

    const newExpiredAt = new Date(baseDate);
    newExpiredAt.setDate(newExpiredAt.getDate() + daysToAdd);

    const { error: err1 } = await supabase
      .from("app_config")
      .update({ license_expired_at: newExpiredAt.toISOString(), is_setup_completed: true })
      .eq("id", 1);
    if (err1) throw err1;

    const { error: err2 } = await supabase
      .from("billing_manual_confirmations")
      .update({ status: "approved" })
      .eq("id", confirmationId);
    if (err2) throw err2;

    const orderId = `MANUAL-${Date.now()}`;
    const { error: err3 } = await supabase
      .from("billing_history")
      .insert({
        order_id: orderId,
        amount: confirmation.amount,
        payment_type: isInitial ? "initial" : "monthly",
        status: "settlement",
        payment_method: "MANUAL_TRANSFER",
        gross_amount: confirmation.amount,
        created_at: new Date().toISOString(),
      });
    if (err3) throw err3;

    return NextResponse.json({
      message: "License activated successfully",
      newExpiredAt: newExpiredAt.toISOString(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Manual approval error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
