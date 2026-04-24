import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// SQL untuk membuat tabel — dikembalikan ke client jika tabel belum ada
const MIGRATION_SQL = `-- Jalankan di Supabase Dashboard → SQL Editor
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  notification_prefs JSONB NOT NULL DEFAULT '{
    "pesanan_baru": true, "status_produksi": true,
    "status_bayar": true, "stok_minimum": true,
    "pesanan_stuck": true, "tagihan_jatuh_tempo": true,
    "kasbon": true, "absensi_terlambat": false
  }'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_id_idx
  ON push_subscriptions(user_id);`;

/** Ekstrak pesan dari error Supabase (objek biasa, bukan instanceof Error) */
function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string") return e.message;
    if (typeof e.details === "string") return e.details;
    if (typeof e.code === "string") return `DB error ${e.code}`;
  }
  return String(err);
}

/** Apakah ini error "tabel tidak ada"? */
function isTableMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as Record<string, unknown>;
  return e.code === "42P01";
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** POST /api/push/subscribe — simpan atau update subscription */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, subscription, oldEndpoint, notificationPrefs } = body as {
      userId: string;
      subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
      oldEndpoint?: string | null;
      notificationPrefs?: Record<string, boolean>;
    };

    if (!userId || !subscription?.endpoint || !subscription?.keys?.p256dh) {
      return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
    }

    const supabase = getSupabase();

    if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .eq("user_id", userId)
        .eq("endpoint", oldEndpoint);
    }

    const record = {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      updated_at: new Date().toISOString(),
      ...(notificationPrefs ? { notification_prefs: notificationPrefs } : {}),
    };

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(record, { onConflict: "user_id,endpoint" });

    if (error) {
      if (isTableMissing(error)) {
        // Kembalikan SQL supaya user bisa menjalankannya di Supabase Dashboard
        return NextResponse.json(
          {
            error: "Tabel 'push_subscriptions' belum ada di database.",
            errorCode: "TABLE_NOT_FOUND",
            sql: MIGRATION_SQL,
          },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = extractMessage(err);
    console.error("[push/subscribe POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/push/subscribe — hapus subscription */
export async function DELETE(req: Request) {
  try {
    const { userId, endpoint } = (await req.json()) as {
      userId: string;
      endpoint: string;
    };

    if (!userId || !endpoint) {
      return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = extractMessage(err);
    console.error("[push/subscribe DELETE]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** PATCH /api/push/subscribe — update preferensi notifikasi */
export async function PATCH(req: Request) {
  try {
    const { userId, endpoint, notificationPrefs } = (await req.json()) as {
      userId: string;
      endpoint: string;
      notificationPrefs: Record<string, boolean>;
    };

    if (!userId || !endpoint || !notificationPrefs) {
      return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
    }

    const supabase = getSupabase();
    const { error } = await supabase
      .from("push_subscriptions")
      .update({ notification_prefs: notificationPrefs, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("endpoint", endpoint);

    if (error) {
      if (isTableMissing(error)) {
        return NextResponse.json(
          { error: "Tabel belum ada.", errorCode: "TABLE_NOT_FOUND", sql: MIGRATION_SQL },
          { status: 503 }
        );
      }
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = extractMessage(err);
    console.error("[push/subscribe PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
