"use client";

import { useEffect, useState } from "react";

/**
 * Dipakai satu kali bila browser masih menjalankan bundle ERP versi lama.
 * Hanya Cache Storage dan service worker origin ini yang dilepas; cookie
 * login dan localStorage tidak disentuh.
 */
export default function CacheResetPage() {
  const [message, setMessage] = useState("Membersihkan cache aplikasi…");

  useEffect(() => {
    const reset = async () => {
      try {
        const tasks: Promise<unknown>[] = [];
        if ("serviceWorker" in navigator) {
          tasks.push(navigator.serviceWorker.getRegistrations().then((registrations) =>
            Promise.all(registrations.map((registration) => registration.unregister()))
          ));
        }
        if ("caches" in window) {
          tasks.push(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
        }
        await Promise.all(tasks);
        setMessage("Cache lama sudah dilepas. Memuat laporan terbaru…");
      } catch {
        setMessage("Memuat laporan terbaru…");
      }
      window.location.replace(`/dashboard/pajak?fresh=${Date.now()}`);
    };

    void reset();
  }, []);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Arial, sans-serif", background: "#f7f0e5", color: "#4b3527" }}>
      <p>{message}</p>
    </main>
  );
}
