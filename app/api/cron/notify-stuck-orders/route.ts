import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const STUCK_HOURS = 48;

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Wajib ada CRON_SECRET dan harus cocok
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const stuckThreshold = new Date(now.getTime() - STUCK_HOURS * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: stuckOrders } = await supabase
    .from("pesanan_rows")
    .select("id, customer_name, po_number, last_status_change, production_status")
    .in("production_status", ["di_produksi", "di_warna"])
    .lt("last_status_change", stuckThreshold.toISOString())
    .eq("delivery_status", "belum_kirim");

  const { data: nearDueOrders } = await supabase
    .from("pesanan_rows")
    .select("id, customer_name, po_number, due_date, payment_status, delivery_status")
    .lte("due_date", threeDaysLater.toISOString().split("T")[0])
    .gte("due_date", now.toISOString().split("T")[0])
    .neq("payment_status", "lunas");

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  // Header internal agar push/send menerima request dari cron
  const internalHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${cronSecret}`,
  };

  const notifications: Promise<Response>[] = [];

  if (stuckOrders && stuckOrders.length > 0) {
    notifications.push(
      fetch(`${baseUrl}/api/push/send`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({
          notificationType: "pesanan_stuck",
          title: `⚠️ ${stuckOrders.length} Pesanan Stuck di Produksi`,
          body:
            stuckOrders
              .slice(0, 3)
              .map((o) => `• ${o.customer_name ?? o.po_number}`)
              .join("\n") +
            (stuckOrders.length > 3 ? `\n• ...+${stuckOrders.length - 3} lainnya` : ""),
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
        headers: internalHeaders,
        body: JSON.stringify({
          notificationType: "tagihan_jatuh_tempo",
          title: `🔔 ${nearDueOrders.length} Pesanan Jatuh Tempo`,
          body:
            nearDueOrders
              .slice(0, 3)
              .map((o) => `• ${o.customer_name ?? o.po_number} (${o.due_date})`)
              .join("\n") +
            (nearDueOrders.length > 3 ? `\n• ...+${nearDueOrders.length - 3} lainnya` : ""),
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
