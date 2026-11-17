"use client";

import Link from "next/link";

export default function SidoarjoModulePage({ title, description, relatedHref, relatedLabel }: { title: string; description: string; relatedHref?: string; relatedLabel?: string }) {
    return <main className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
        <div style={{ border: "1px solid #E8DCCF", borderRadius: 14, background: "#FFFDF9", padding: 28 }}>
            <div style={{ color: "#A67B5B", fontSize: 11, letterSpacing: ".09em", fontWeight: 800, marginBottom: 8 }}>TOTO SIDOARJO</div>
            <h1 className="page-title-h1" style={{ marginBottom: 8 }}>{title}</h1>
            <p className="page-subtitle" style={{ maxWidth: 720 }}>{description}</p>
            <div style={{ marginTop: 22, padding: "16px 18px", borderRadius: 9, background: "#F7EEE5", color: "#6B4423", fontSize: 13, lineHeight: 1.6 }}>
                Modul ini sudah memiliki ruang kerja Sidoarjo sendiri. Saat data cabang belum tersedia, halaman tidak akan memuat data Toto Pusat.
            </div>
            {relatedHref && relatedLabel && <Link href={relatedHref} style={{ display: "inline-block", marginTop: 18, padding: "10px 14px", borderRadius: 7, background: "#A67B5B", color: "white", fontWeight: 800, textDecoration: "none", fontSize: 13 }}>{relatedLabel}</Link>}
        </div>
    </main>;
}
