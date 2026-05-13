import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_ROLES = ["owner", "finance"];

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  const callerRole = req.headers.get("x-user-role") ?? "";
  const callerUsername = req.headers.get("x-username") ?? "";
  const isAdmin = ADMIN_ROLES.includes(callerRole) || callerUsername === "faisal";

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("billing_manual_confirmations")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (error: any) {
    console.error("Confirmations fetch error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const callerRole = req.headers.get("x-user-role") ?? "";
  const callerUsername = req.headers.get("x-username") ?? "";
  const isAdmin = ADMIN_ROLES.includes(callerRole) || callerUsername === "faisal";

  if (!isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ error: "id dan status diperlukan" }, { status: 400 });
    }

    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("billing_manual_confirmations")
      .update({ status })
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ message: "Status updated" });
  } catch (error: any) {
    console.error("Confirmation update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
