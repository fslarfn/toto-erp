/*
 * Service worker retirement.
 * Menghapus cache PWA versi lama agar aplikasi selalu memuat bundle produksi
 * terbaru. File ini akan mendaftarkan lalu melepas dirinya sendiri sekali.
 */
self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await Promise.all((await caches.keys()).map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    await Promise.all(clients.map((client) => client.navigate(client.url)));
  })());
});
