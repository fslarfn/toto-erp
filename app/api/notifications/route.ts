import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { NotificationRecord, NotificationSeverity } from "@/types";

// Catatan: route ini sengaja diletakkan di /app/api (bukan /app/dashboard/api)
// agar konsisten dengan route lain & middleware (matcher "/api/:path*"), yang
// mengembalikan JSON 401 saat sesi tidak valid — bukan redirect HTML.

const SELECT_COLS =
  "id, title, body, url, notification_type, severity, is_read, target_user_id, meta, created_at";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/** Filter: hanya notif broadcast (target NULL) atau yang ditujukan ke user ini. */
function scopeToUser<T>(query: T, userId: string | null): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  if (userId) return q.or(`target_user_id.is.null,target_user_id.eq.${userId}`);
  return q.is("target_user_id", null);
}

// ── GET: daftar notifikasi + unread_count + grouped by type ──
export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    const { searchParams } = new URL(req.url);
    const onlyUnread = searchParams.get("unread") === "1";
    const type = searchParams.get("type");
    const limit = Math.min(Number(searchParams.get("limit") ?? "50") || 50, 100);
    const offset = Math.max(Number(searchParams.get("offset") ?? "0") || 0, 0);

    const supabase = svc();

    let query = supabase
      .from("notifications")
      .select(SELECT_COLS)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    query = scopeToUser(query, userId);
    if (onlyUnread) query = query.eq("is_read", false);
    if (type) query = query.eq("notification_type", type);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as NotificationRecord[];

    // unread_count dihitung terpisah (tidak terbatas pagination)
    let unreadQuery = supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false);
    unreadQuery = scopeToUser(unreadQuery, userId);
    const { count: unreadCount } = await unreadQuery;

    const grouped = rows.reduce<Record<string, NotificationRecord[]>>((acc, n) => {
      (acc[n.notification_type] ??= []).push(n);
      return acc;
    }, {});

    return NextResponse.json({
      data: rows,
      unread_count: unreadCount ?? 0,
      grouped,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Tabel belum ada → balas kosong agar UI tidak crash
    if (/relation .*notifications.* does not exist|schema cache/i.test(message)) {
      return NextResponse.json({ data: [], unread_count: 0, grouped: {} });
    }
    console.error("[notifications GET]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── PATCH: tandai dibaca (single, bulk, atau semua) ──
export async function PATCH(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      ids?: string[];
      all?: boolean;
    };

    const supabase = svc();
    let query = supabase.from("notifications").update({ is_read: true });

    if (body.all) {
      query = query.eq("is_read", false);
    } else {
      const ids = body.ids ?? (body.id ? [body.id] : []);
      if (ids.length === 0) {
        return NextResponse.json({ error: "id atau ids wajib diisi" }, { status: 400 });
      }
      query = query.in("id", ids);
    }

    query = scopeToUser(query, userId);

    const { data, error } = await query.select("id");
    if (error) throw error;

    return NextResponse.json({ ok: true, updated: data?.length ?? 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications PATCH]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: insert notifikasi manual (mis. dari action user) ──
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      title?: string;
      body?: string;
      url?: string;
      notification_type?: string;
      severity?: NotificationSeverity;
      target_user_id?: string | null;
      meta?: Record<string, unknown>;
      dedupe_key?: string;
    };

    if (!body.title || !body.notification_type) {
      return NextResponse.json(
        { error: "title dan notification_type wajib diisi" },
        { status: 400 }
      );
    }

    const supabase = svc();
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        title: body.title,
        body: body.body ?? "",
        url: body.url ?? null,
        notification_type: body.notification_type,
        severity: body.severity ?? "info",
        target_user_id: body.target_user_id ?? null,
        meta: body.meta ?? {},
        dedupe_key: body.dedupe_key ?? null,
      })
      .select(SELECT_COLS)
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[notifications POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
