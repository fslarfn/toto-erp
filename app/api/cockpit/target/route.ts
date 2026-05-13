import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { year, month, target } = await req.json();
    if (!year || !month || target === undefined) {
      return NextResponse.json({ error: "year, month, target diperlukan" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase.from("monthly_targets").upsert({
      year,
      month,
      target_profit: target,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    return NextResponse.json({ message: "Target updated" });
  } catch (error: any) {
    console.error("Set monthly target error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
