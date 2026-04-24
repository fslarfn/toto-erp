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
    const payload = (await req.json()) as PushPayload;

    if (!payload.notificationType || !payload.title || !payload.body) {
      return NextResponse.json({ error: "Payload tidak lengkap" }, { status: 400 });
    }

    const { publicKey, privateKey, subject } = getVapidConfig();

    webpush.setVapidDetails(subject, publicKey, privateKey);

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
      return NextResponse.json({ ok: true, sent: 0, message: "Tidak ada subscriber" });
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

    return NextResponse.json({ ok: true, sent, failed });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[push/send POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
