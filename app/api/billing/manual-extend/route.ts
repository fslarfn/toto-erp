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

    // Aktivasi Manual: set masa aktif LANGSUNG ke 10 Januari 2027
    // (skema bayar di muka 5 bulan s/d Desember 2026), bukan menambah X hari.
    const newExpiredAt = new Date("2027-01-10T23:59:59+07:00");

    const { error: updateErr } = await supabase
      .from("app_config")
      .update({ license_expired_at: newExpiredAt.toISOString(), is_setup_completed: true })
      .eq("id", 1);
    if (updateErr) throw updateErr;

    // Invoice/riwayat: pembayaran di muka 5 bulan = Rp 30.000.000
    const { error: historyErr } = await supabase.from("billing_history").insert({
      order_id: `ADMIN-MANUAL-${Date.now()}`,
      amount: 30000000,
      payment_type: "extend_5m",
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
