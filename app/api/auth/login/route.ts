import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { signSession } from "@/lib/session";

function getAdminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Kredensial tidak valid" }, { status: 401 });
    }

    const supabase = getAdminSupabase();

    const { data: user } = await supabase
      .from("app_users")
      .select("id, name, username, password_hash, role, avatar")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();

    // Delay konstan agar attacker tidak bisa deteksi username valid/tidak
    await new Promise((r) => setTimeout(r, 200));

    if (!user) {
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    // Cek apakah password sudah di-hash bcrypt atau masih plain text
    const isBcrypt = user.password_hash.startsWith("$2");
    let passwordMatch = false;

    if (isBcrypt) {
      passwordMatch = await bcrypt.compare(password, user.password_hash);
    } else {
      // Legacy: plain text — bandingkan langsung
      passwordMatch = user.password_hash === password;

      // Lazy migration: langsung hash dan simpan ke DB
      if (passwordMatch) {
        const hashed = await bcrypt.hash(password, 12);
        await supabase
          .from("app_users")
          .update({ password_hash: hashed })
          .eq("id", user.id);
      }
    }

    if (!passwordMatch) {
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    const token = await signSession({
      userId: user.id,
      username: user.username,
      role: user.role,
    });

    const userData = {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
      avatar: user.avatar ?? undefined,
    };

    const response = NextResponse.json({ ok: true, user: userData });
    response.cookies.set("erp_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 8, // 8 jam
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}
