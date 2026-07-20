import { NextResponse } from "next/server";
import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Payload yang dikirim ke endpoint ini
export interface PushPayload {
  /** Kirim ke user tertentu */
  targetUserIds?: string[];
  /** Kirim ke semua user dengan role tertentu, mis. ["owner","finance"] */
  targetRoles?: string[];
  /** Jenis notifikasi — difilter dengan notification_prefs subscriber */
  notificationType: string;
  title: string;
  body: string;
  /** URL deep-link yang dibuka saat notifikasi diklik */
  url?: string;
  /** Tag untuk grouping (opsional) */
  tag?: string;
  /** Tingkat urgensi untuk panel notifikasi in-app (default: info) */
  severity?: "info" | "warning" | "danger";
}

function getVapidConfig() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error("VAPID environment variables tidak dikonfigurasi");
  }

  return { publicKey, privateKey, subject };
}

export async function POST(req: Request) {
  try {
    // Izinkan dari user terautentikasi (via middleware) ATAU dari cron job internal
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization");
    const isInternalCall = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isAuthenticatedUser = !!req.headers.get("x-user-id");

    if (!isInternalCall && !isAuthenticatedUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await req.json()) as PushPayload;

    if (!payload.notificationType || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
    }

    // Hardening (security review #2): endpoint ini bisa dipanggil user login
    // mana pun (notifikasi lahir dari aksi user berhak-rendah juga). Cegah
    // penyalahgunaan sbg phishing: `url` HARUS path internal (diawali satu "/"),
    // bukan tautan eksternal (//evil, https://…, javascript:). Plus batasi
    // panjang title/body agar tak dipakai spam payload besar.
    if (payload.url !== undefined && !/^\/(?!\/)/.test(payload.url)) {
      return NextResponse.json(
        { error: "url harus path internal (diawali '/')" },
        { status: 400 }
      );
    }
    if (payload.title.length > 200 || payload.body.length > 1000) {
      return NextResponse.json({ error: "Judul/isi terlalu panjang" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Resolve targetRoles → user IDs
    let resolvedUserIds: string[] = payload.targetUserIds ?? [];
    if (payload.targetRoles && payload.targetRoles.length > 0) {
      const { data: roleUsers } = await supabase
        .from("app_users")
        .select("id")
        .in("role", payload.targetRoles);
      const roleIds = roleUsers?.map((u: { id: string }) => u.id) ?? [];
      resolvedUserIds = [...new Set([...resolvedUserIds, ...roleIds])];
    }

    // ── 1) SIMPAN RIWAYAT PANEL DULU (di-AWAIT) ─────────────────
    // Panel notifikasi in-app TIDAK boleh bergantung pada web push:
    // sebelumnya insert ini fire-and-forget dan baru jalan SETELAH
    // getVapidConfig() — kalau env VAPID kosong, route 500 dan riwayat
    // tidak pernah tertulis → panel selalu kosong.
    const baseRow = {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard",
      notification_type: payload.notificationType,
      severity: payload.severity ?? "info",
    };
    let historySaved = false;
    if (resolvedUserIds.length > 0) {
      // Tertarget: satu baris per user agar scoping panel per-user benar.
      const { error: perUserErr } = await supabase
        .from("notifications")
        .insert(resolvedUserIds.map((uid) => ({ ...baseRow, target_user_id: uid })));
      if (perUserErr) {
        console.error("[push/send] insert riwayat per-user gagal:", perUserErr.message);
        // Fallback broadcast agar notifikasi tetap tampil (mis. FK/format id tak cocok).
        const { error: bcErr } = await supabase.from("notifications").insert(baseRow);
        if (bcErr) console.error("[push/send] insert riwayat broadcast gagal:", bcErr.message);
        else historySaved = true;
      } else historySaved = true;
    } else {
      const { error: bcErr } = await supabase.from("notifications").insert(baseRow);
      if (bcErr) console.error("[push/send] insert riwayat gagal:", bcErr.message);
      else historySaved = true;
    }

    // ── 2) WEB PUSH (best-effort) ───────────────────────────────
    // VAPID belum dikonfigurasi → lewati push, riwayat panel tetap tersimpan.
    let vapid: { publicKey: string; privateKey: string; subject: string } | null = null;
    try {
      vapid = getVapidConfig();
    } catch {
      return NextResponse.json({
        ok: true,
        sent: 0,
        history: historySaved,
        message: "VAPID belum dikonfigurasi — riwayat in-app tetap disimpan",
      });
    }
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    // Ambil subscriber yang relevan
    let query = supabase
      .from("push_subscriptions")
      .select("id, user_id, endpoint, p256dh, auth, notification_prefs");

    if (resolvedUserIds.length > 0) {
      query = query.in("user_id", resolvedUserIds);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, history: historySaved, message: "Tidak ada subscriber" });
    }

    // Filter berdasarkan notification_prefs
    const eligible = subscriptions.filter((sub) => {
      const prefs = sub.notification_prefs as Record<string, boolean> | null;
      if (!prefs) return true;
      return prefs[payload.notificationType] !== false;
    });

    const notificationData = {
      title: payload.title,
      body: payload.body,
      url: payload.url ?? "/dashboard",
      tag: payload.tag ?? payload.notificationType,
      icon: "/icons/icon-192x192.png",
      badge: "/icons/icon-192x192.png",
    };

    const results = await Promise.allSettled(
      eligible.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(notificationData),
          { TTL: 86400 }
        )
      )
    );

    // Hapus subscription yang sudah expired (status 410 Gone)
    const expiredEndpoints: string[] = [];
    results.forEach((result, index) => {
      if (
        result.status === "rejected" &&
        (result.reason as { statusCode?: number })?.statusCode === 410
      ) {
        expiredEndpoints.push(eligible[index].endpoint);
      }
    });

    if (expiredEndpoints.length > 0) {
      await supabase
        .from("push_subscriptions")
        .delete()
        .in("endpoint", expiredEndpoints);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return NextResponse.json({ ok: true, sent, failed, history: historySaved });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[push/send POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
