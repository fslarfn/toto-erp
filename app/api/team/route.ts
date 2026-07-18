import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Daftar anggota tim untuk Ruang Tim (assignee tugas, nama author, dsb).
// Harus lewat server: SELECT app_users dari anon key sengaja DIBLOKIR
// oleh RLS (supabase-rls-security.sql) demi melindungi password_hash.
// Route ini hanya mengembalikan kolom aman & butuh sesi valid
// (middleware menyuntik x-user-id).
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, role, avatar")
      .order("name");

    if (error) throw error;

    return NextResponse.json({ data: data ?? [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[team GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
