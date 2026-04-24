/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

/** Convert a base64url string to a Uint8Array (required for applicationServerKey). */
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

// ─── Push Event ─────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    icon?: string;
    badge?: string;
  };

  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Toto ERP", body: event.data.text() };
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: payload.icon ?? "/icons/icon-192x192.png",
    badge: payload.badge ?? "/icons/icon-192x192.png",
    tag: payload.tag ?? "toto-erp",
    data: { url: payload.url ?? "/dashboard" },
    requireInteraction: false,
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

// ─── Notification Click ──────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl: string =
    (event.notification.data as { url?: string })?.url ?? "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (
            "url" in client &&
            (client as WindowClient).url.includes(targetUrl) &&
            "focus" in client
          ) {
            return (client as WindowClient).focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      })
  );
});

// ─── Push Subscription Change (auto re-subscribe) ───────────────────────────
// Fires when the browser invalidates the old push subscription.
// We fetch the VAPID public key from our own API so we don't hardcode it here.
self.addEventListener("pushsubscriptionchange", (event) => {
  const e = event as PushSubscriptionChangeEvent;

  e.waitUntil(
    fetch("/api/push/vapid-key")
      .then((r) => r.json())
      .then(({ publicKey }: { publicKey: string }) =>
        self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
      )
      .then((newSub) =>
        fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: newSub.toJSON(),
            oldEndpoint: e.oldSubscription?.endpoint ?? null,
          }),
        })
      )
  );
});
