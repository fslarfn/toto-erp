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
      .select("id, password_hash, role")
      .eq("id", userId)
      .single();

    if (!user) {
      return NextResponse.json({ error: "User tidak ditemukan" }, { status: 404 });
    }

    const isSidoarjoManager = user.role === "sidoarjo_manager";
    let passwordHash = user.password_hash;
    if (isSidoarjoManager) {
      const { data: credentials, error } = await supabase
        .from("sidoarjo_manager_credentials")
        .select("password_hash")
        .eq("user_id", userId)
        .single();
      if (error || !credentials?.password_hash.startsWith("$2")) {
        return NextResponse.json({ error: "Kredensial tidak tersedia" }, { status: 503 });
      }
      passwordHash = credentials.password_hash;
    }

    const isBcrypt = passwordHash.startsWith("$2");
    let isMatch = false;

    if (isBcrypt) {
      isMatch = await bcrypt.compare(currentPassword, passwordHash);
    } else {
      isMatch = user.password_hash === currentPassword;
    }

    if (!isMatch) {
      return NextResponse.json({ error: "Password lama tidak benar" }, { status: 400 });
    }

    const hashedNew = await bcrypt.hash(newPassword, 12);

    const { error } = await supabase
      .from(isSidoarjoManager ? "sidoarjo_manager_credentials" : "app_users")
      .update({ password_hash: hashedNew })
      .eq(isSidoarjoManager ? "user_id" : "id", userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
