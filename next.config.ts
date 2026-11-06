import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Cache PWA lama pernah mempertahankan bundle laporan yang sudah tidak sesuai
  // dengan deployment. Nonaktifkan generator sementara agar sw.js pembersih
  // di public/ dapat mengambil alih dan melepas cache lama pada semua klien.
  disable: true,
  // Konfigurasi untuk memastikan real-time (WebSockets/API) berjalan normal
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    // Aktifkan bundle baru segera setelah deployment. Tanpa ini, browser PWA
    // bisa tetap menjalankan JavaScript laporan versi lama walaupun data dan
    // deployment produksi sudah diperbarui.
    skipWaiting: true,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    runtimeCaching: [
      {
        urlPattern: ({ url }) => url.hostname.includes("supabase.co"),
        handler: "NetworkOnly",
      },
      {
        urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // turbopack config kept for dev (next dev uses Turbopack by default in v16)
  // production build uses --webpack flag so next-pwa can generate the SW
  turbopack: {},
  async headers() {
    return [
      {
        // Endpoint khusus untuk melepaskan cache PWA lama. Hanya cache yang
        // dihapus—cookie login, localStorage, dan data aplikasi tetap aman.
        source: "/cache-reset",
        headers: [
          { key: "Clear-Site-Data", value: '"cache"' },
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
