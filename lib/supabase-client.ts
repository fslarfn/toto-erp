"use client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Token Supabase (role `authenticated`) di-mint server dari sesi erp_session
 * lewat /api/auth/supabase-token. Di-cache di memori & di-refresh menjelang
 * kedaluwarsa. Dipakai supabase-js untuk REST *dan* Realtime.
 *
 * Kalau gagal (belum login, atau SUPABASE_JWT_SECRET belum di-set) → null,
 * dan supabase-js otomatis fallback ke publishable/anon key (perilaku lama).
 * Ini membuat peralihan aman: tanpa RLS berubah, tidak ada yang rusak.
 */
let cached: { token: string; exp: number } | null = null;
let inflight: Promise<string | null> | null = null;

async function getSupabaseToken(): Promise<string | null> {
  const nowSec = Date.now() / 1000;
  if (cached && cached.exp - nowSec > 60) return cached.token;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetch("/api/auth/supabase-token", { cache: "no-store" });
      if (!res.ok) { cached = null; return null; }
      const json = (await res.json()) as { token: string; exp: number };
      cached = { token: json.token, exp: json.exp };
      return json.token;
    } catch {
      cached = null;
      return null;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Buang token cache saat logout supaya sesi berikutnya mint token baru. */
export function clearSupabaseToken() {
  cached = null;
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  accessToken: getSupabaseToken,
});
