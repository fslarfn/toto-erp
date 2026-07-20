import { NextResponse } from "next/server";
import { SignJWT } from "jose";

/**
 * Menerbitkan token Supabase (HS256, ditandatangani Legacy JWT Secret) untuk
 * user yang SUDAH login via custom auth (erp_session). Browser memakai token
 * ini lewat opsi `accessToken` di lib/supabase-client, sehingga request ke
 * Supabase berjalan sebagai role `authenticated` — BUKAN anon publik.
 *
 * Ini fondasi untuk mengunci RLS: setelah semua klien membawa token ini,
 * policy tabel sensitif bisa diubah dari `allow all` → berbasis peran
 * (klaim `user_role`), memblokir akses anonim dari internet tanpa mematikan
 * realtime.
 *
 * SECRET tidak pernah keluar dari server. Identitas diambil dari header yang
 * disuntik middleware (bukan dari body) sehingga tidak bisa dipalsukan klien.
 */
export async function GET(req: Request) {
  const userId = req.headers.get("x-user-id");
  const userRole = req.headers.get("x-user-role") ?? "";
  const username = req.headers.get("x-username") ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) {
    // Belum dikonfigurasi → klien fallback ke publishable key (perilaku lama).
    return NextResponse.json({ error: "SUPABASE_JWT_SECRET belum di-set" }, { status: 503 });
  }

  const ttlSeconds = 60 * 60; // 1 jam; klien me-refresh menjelang kedaluwarsa
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;

  const token = await new SignJWT({
    role: "authenticated",     // dipakai PostgREST/Realtime untuk memilih role DB
    user_role: userRole,       // peran aplikasi (owner/finance/...) untuk RLS berbasis peran
    username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setAudience("authenticated")
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(secret));

  return NextResponse.json({ token, exp });
}
