import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Rekap kuesioner — KHUSUS owner (dipakai /dashboard/kuesioner).
// Route ini TIDAK ada di PUBLIC_PREFIXES middleware, jadi selalu lewat sesi;
// identitas dikirim middleware via header x-user-role / x-username.

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isOwner(req: Request) {
  return (
    req.headers.get("x-user-role") === "owner" ||
    req.headers.get("x-username") === "faisal"
  );
}

export async function GET(req: Request) {
  if (!isOwner(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("kuesioner_responses")
      .select("id, token, nama, bagian, answers, submitted_at, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return NextResponse.json({ data: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
