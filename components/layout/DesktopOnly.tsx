"use client";
// ============================================================
// DesktopOnly — pembungkus untuk menu yang tidak nyaman dipakai
// di layar HP (lembar kerja/tabel lebar). Di layar ≤900px konten
// TIDAK dirender (hemat: data halaman berat tidak ikut dimuat),
// diganti kartu keterangan + tombol kembali ke Dashboard.
// Desktop tidak terpengaruh sama sekali.
// ============================================================
import { useState, useEffect, type ReactNode } from "react";
import Link from "next/link";

export default function DesktopOnly({ label, children }: { label: string; children: ReactNode }) {
    // null = belum tahu (render kosong sesaat, hindari kedip salah tampilan)
    const [isMobile, setIsMobile] = useState<boolean | null>(null);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 900px)");
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener("change", update);
        return () => mq.removeEventListener("change", update);
    }, []);

    if (isMobile === null) return null;
    if (!isMobile) return <>{children}</>;

    return (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#F5EBDD" }}>
            <div style={{ maxWidth: 380, textAlign: "center", background: "white", border: "1px solid #E6D5BE", borderRadius: 14, padding: "32px 24px", boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }} aria-hidden>🖥️</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#5C4033", marginBottom: 8 }}>
                    {label} hanya tersedia di komputer
                </div>
                <p style={{ fontSize: 13, color: "#8A7B6E", lineHeight: 1.6, margin: "0 0 18px" }}>
                    Menu ini memakai lembar kerja/tabel lebar yang tidak nyaman
                    dioperasikan di layar HP. Silakan buka lewat laptop atau komputer.
                </p>
                <Link href="/dashboard" style={{ display: "inline-block", background: "#A67B5B", color: "white", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    ← Kembali ke Dashboard
                </Link>
            </div>
        </div>
    );
}
