import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Reset lisensi ke trial — hanya faisal (owner)
export async function POST(req: Request) {
  const callerUsername = req.headers.get("x-username") ?? "";
  const callerRole = req.headers.get("x-user-role") ?? "";
  const isOwner = callerUsername === "faisal" || callerRole === "owner";

  if (!isOwner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("app_config")
      .update({ license_expired_at: "2026-04-25T23:59:59+07:00", is_setup_completed: false })
      .eq("id", 1);

    if (error) throw error;
    return NextResponse.json({ message: "Trial reset berhasil" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
