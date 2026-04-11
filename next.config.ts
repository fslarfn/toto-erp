import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Konfigurasi tambahan untuk memastikan real-time (WebSockets/API) berjalan normal
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
  // Memastikan aplikasi tidak mengandalkan cache untuk data dinamis
};

export default withPWA(nextConfig);
