import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const OWNER_ROLES = ["owner"];

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const callerRole = req.headers.get("x-user-role") ?? "";
  const callerUsername = req.headers.get("x-username") ?? "";
  const isOwner = OWNER_ROLES.includes(callerRole) || callerUsername === "faisal";

  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();

    const { data: config, error: configErr } = await supabase
      .from("app_config")
      .select("license_expired_at, is_setup_completed")
      .eq("id", 1)
      .single();
    if (configErr) throw configErr;

    const isInitial = !config.is_setup_completed;
    const daysToAdd = isInitial ? 90 : 30;

    let baseDate = new Date();
    if (config.license_expired_at) {
      const currentExpired = new Date(config.license_expired_at);
      if (currentExpired > baseDate) baseDate = currentExpired;
    }

    const newExpiredAt = new Date(baseDate);
    newExpiredAt.setDate(newExpiredAt.getDate() + daysToAdd);

    const { error: updateErr } = await supabase
      .from("app_config")
      .update({ license_expired_at: newExpiredAt.toISOString(), is_setup_completed: true })
      .eq("id", 1);
    if (updateErr) throw updateErr;

    const { error: historyErr } = await supabase.from("billing_history").insert({
      order_id: `ADMIN-MANUAL-${Date.now()}`,
      amount: isInitial ? 20800000 : 6200000,
      payment_type: isInitial ? "initial" : "monthly",
      status: "settlement",
      payment_method: "ADMIN_DIRECT",
      created_at: new Date().toISOString(),
    });
    if (historyErr) throw historyErr;

    return NextResponse.json({ message: "License extended", newExpiredAt: newExpiredAt.toISOString() });
  } catch (error: any) {
    console.error("Manual extend error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
