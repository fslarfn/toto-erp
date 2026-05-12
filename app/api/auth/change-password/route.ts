import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: "Password lama dan baru wajib diisi" }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Password baru minimal 6 karakter" }, { status: 400 });
    }

    const supabase = getAdminSupabase();

    const { data: user } = await supabase
      .from("app_users")
      .select("id, password_hash")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    // Verifikasi password lama (support bcrypt dan plain text legacy)
    const isBcrypt = user.password_hash.startsWith("$2");
    let isMatch = false;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    } else {
      isMatch = user.password_hash === currentPassword;
    }

    if (!isMatch) {
      return NextResponse.json({ error: "Password lama tidak benar" }, { status: 400 });
    }

    const hashedNew = await bcrypt.hash(newPassword, 12);

    const { error } = await supabase
      .from("app_users")
      .update({ password_hash: hashedNew })
      .eq("id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
