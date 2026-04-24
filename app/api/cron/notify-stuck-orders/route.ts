import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STUCK_HOURS = 48; // pesanan stuck jika > 48 jam di status produksi aktif

/** GET /api/cron/notify-stuck-orders
 *
 * Dipanggil oleh Vercel Cron (vercel.json) setiap hari pukul 08:00 WIB.
 * Mengirim push notification untuk:
 * 1. Pesanan stuck di produksi > STUCK_HOURS jam
 * 2. Pesanan dengan due_date ≤ 3 hari ke depan yang belum lunas/kirim
 */
export async function GET(req: Request) {
  // Proteksi sederhana agar hanya bisa dipanggil dari Vercel Cron
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_HOURS * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // 1. Cari pesanan stuck di produksi
  const { data: stuckOrders } = await supabase
    .from("pesanan_rows")
    .select("id, customer_name, po_number, last_status_change, production_status")
    .in("production_status", ["di_produksi", "di_warna"])
    .lt("last_status_change", stuckThreshold.toISOString())
    .eq("delivery_status", "belum_kirim");

  // 2. Cari pesanan mendekati jatuh tempo yang belum lunas/kirim
  const { data: nearDueOrders } = await supabase
    .from("pesanan_rows")
    .select("id, customer_name, po_number, due_date, payment_status, delivery_status")
    .lte("due_date", threeDaysLater.toISOString().split("T")[0])
    .gte("due_date", now.toISOString().split("T")[0])
    .neq("payment_status", "lunas");

  const notifications: Promise<Response>[] = [];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  if (stuckOrders && stuckOrders.length > 0) {
    const hours = STUCK_HOURS;
    notifications.push(
      fetch(`${baseUrl}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationType: "pesanan_stuck",
          title: `⚠️ ${stuckOrders.length} Pesanan Stuck di Produksi`,
          body: stuckOrders
            .slice(0, 3)
            .map((o) => `• ${o.customer_name ?? o.po_number}`)
            .join("\n") + (stuckOrders.length > 3 ? `\n• ...+${stuckOrders.length - 3} lainnya` : ""),
          url: "/dashboard/pesanan",
          tag: "pesanan_stuck",
        }),
      })
    );
  }

  if (nearDueOrders && nearDueOrders.length > 0) {
    notifications.push(
      fetch(`${baseUrl}/api/push/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationType: "tagihan_jatuh_tempo",
          title: `🔔 ${nearDueOrders.length} Pesanan Jatuh Tempo`,
          body: nearDueOrders
            .slice(0, 3)
            .map((o) => `• ${o.customer_name ?? o.po_number} (${o.due_date})`)
            .join("\n") + (nearDueOrders.length > 3 ? `\n• ...+${nearDueOrders.length - 3} lainnya` : ""),
          url: "/dashboard/pesanan",
          tag: "tagihan_jatuh_tempo",
        }),
      })
    );
  }

  await Promise.allSettled(notifications);

  return NextResponse.json({
    ok: true,
    stuckOrders: stuckOrders?.length ?? 0,
    nearDueOrders: nearDueOrders?.length ?? 0,
  });
}
