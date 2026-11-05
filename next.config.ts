import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
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
};

export default withPWA(nextConfig);
