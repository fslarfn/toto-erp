"use client";

/** Error khusus ketika tabel Supabase belum dibuat — membawa SQL migration */
export class PushSetupError extends Error {
  constructor(message: string, public readonly sql: string) {
    super(message);
    this.name = "PushSetupError";
  }
}

export type NotificationPrefKey =
  | "pesanan_baru"
  | "status_produksi"
  | "status_bayar"
  | "stok_minimum"
  | "pesanan_stuck"
  | "tagihan_jatuh_tempo"
  | "kasbon"
  | "absensi_terlambat";

export type NotificationPrefs = Record<NotificationPrefKey, boolean>;

export const DEFAULT_PREFS: NotificationPrefs = {
  pesanan_baru: true,
  status_produksi: true,
  status_bayar: true,
  stok_minimum: true,
  pesanan_stuck: true,
  tagihan_jatuh_tempo: true,
  kasbon: true,
  absensi_terlambat: false,
};

export const PREF_LABELS: Record<NotificationPrefKey, string> = {
  pesanan_baru: "Pesanan baru masuk",
  status_produksi: "Update status produksi",
  status_bayar: "Update status pembayaran",
  stok_minimum: "Stok bahan mendekati minimum",
  pesanan_stuck: "Pesanan stuck di produksi",
  tagihan_jatuh_tempo: "Tagihan mendekati jatuh tempo",
  kasbon: "Pengajuan kasbon baru",
  absensi_terlambat: "Karyawan terlambat absen",
};

/** Convert a base64url VAPID public key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    view[i] = rawData.charCodeAt(i);
  }
  return view;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** Request notification permission; returns the resulting permission state. */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) return "denied";
  return Notification.requestPermission();
}

/**
 * Ambil registration SW yang sudah ada — NON-BLOCKING.
 * Berbeda dengan `navigator.serviceWorker.ready` yang bisa hang selamanya
 * jika SW belum terpasang (mis. saat `next dev`).
 */
async function getExistingRegistration(): Promise<ServiceWorkerRegistration | null> {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    return reg ?? null;
  } catch {
    return null;
  }
}

/** Get the active push subscription for the current browser, if any. */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  // getRegistration resolves immediately — tidak hang meski SW belum aktif
  const reg = await getExistingRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

/** Subscribe this browser to push notifications. */
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  const permission = await requestPermission();
  if (permission !== "granted") return null;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) throw new Error("VAPID public key tidak dikonfigurasi");

  // Untuk subscribe kita PERLU SW aktif — tunggu maksimal 10 detik
  let reg: ServiceWorkerRegistration;
  try {
    reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("Service Worker belum aktif. Jalankan app dengan 'npm start' (bukan 'npm run dev') dan muat ulang halaman.")),
          10_000
        )
      ),
    ]);
  } catch (err) {
    throw err;
  }

  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });
}

/** Unsubscribe this browser from push notifications. */
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return true;
  const reg = await getExistingRegistration();
  if (!reg) return true;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return true;
  return sub.unsubscribe();
}

/** Save subscription to server (associates with userId). */
export async function saveSubscription(
  userId: string,
  subscription: PushSubscription,
  prefs?: NotificationPrefs
): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      subscription: subscription.toJSON(),
      notificationPrefs: prefs,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as {
      error?: string;
      errorCode?: string;
      sql?: string;
    };
    // Tabel belum dibuat — bawa SQL supaya UI bisa menampilkannya
    if (data.errorCode === "TABLE_NOT_FOUND" && data.sql) {
      throw new PushSetupError(
        data.error ?? "Tabel database belum dibuat.",
        data.sql
      );
    }
    throw new Error(data.error ?? "Gagal menyimpan subscription");
  }
}

/** Remove subscription from server. */
export async function removeSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, endpoint }),
  });
}

/** Update notification preferences on server. */
export async function updatePrefs(
  userId: string,
  endpoint: string,
  prefs: NotificationPrefs
): Promise<void> {
  const res = await fetch("/api/push/subscribe", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, endpoint, notificationPrefs: prefs }),
  });
  if (!res.ok) throw new Error("Gagal update preferensi notifikasi");
}

/**
 * Helper: trigger a push notification to specific users.
 * Dipakai dari server-side actions / API routes lain.
 * Di client, gunakan fetch langsung ke /api/push/send.
 */
export async function sendPushNotification(opts: {
  notificationType: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  targetUserIds?: string[];
}): Promise<void> {
  await fetch("/api/push/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
}
