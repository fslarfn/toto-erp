import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel cron → memanggil database function generate_all_notifications()
// yang men-generate notifikasi piutang jatuh tempo & stok minimum.
// Dijadwalkan di vercel.json. Dilindungi CRON_SECRET (pola sama dengan
// /api/cron/notify-stuck-orders).
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase.rpc("generate_all_notifications");

  if (error) {
    console.error("[cron/generate-notifications]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, result: data });
}
