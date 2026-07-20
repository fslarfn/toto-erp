"use client";
import { useMemo, useState, type CSSProperties } from "react";

/* ================================================================
   Paginasi ringan untuk daftar panjang (ribuan baris) yang selama
   ini di-render sekaligus ke DOM. Data & total tetap dihitung dari
   seluruh list — hanya RENDER-nya yang dipotong per halaman.
================================================================ */

export function usePaged<T>(items: T[], perPage = 50) {
    const [page, setPage] = useState(1);
    const totalPages = Math.max(1, Math.ceil(items.length / perPage));
    // Clamp otomatis: kalau filter menyempit dan halaman aktif melewati akhir,
    // turun ke halaman terakhir yang valid (tanpa perlu reset manual).
    const safePage = Math.min(page, totalPages);
    const paged = useMemo(
        () => items.slice((safePage - 1) * perPage, safePage * perPage),
        [items, safePage, perPage]
    );
    return { paged, page: safePage, setPage, totalPages, total: items.length, perPage };
}

export function PageNav({ page, totalPages, setPage, total, label = "item" }: {
    page: number;
    totalPages: number;
    setPage: (updater: (p: number) => number) => void;
    total: number;
    label?: string;
}) {
    if (totalPages <= 1) return null;
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 0" }}>
            <button onClick={() => setPage(() => 1)} disabled={page <= 1} style={btn(page <= 1)}>«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={btn(page <= 1)}>‹ Sebelumnya</button>
            <span style={{ fontSize: 12, color: "var(--text-med)", fontWeight: 600, padding: "0 6px" }}>
                Hal {page} / {totalPages} · {total.toLocaleString("id-ID")} {label}
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={btn(page >= totalPages)}>Berikutnya ›</button>
            <button onClick={() => setPage(() => totalPages)} disabled={page >= totalPages} style={btn(page >= totalPages)}>»</button>
        </div>
    );
}

const btn = (disabled: boolean): CSSProperties => ({
    fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: 6,
    border: "1px solid var(--border)", background: disabled ? "var(--bg-secondary)" : "white",
    color: disabled ? "var(--border)" : "var(--text-med)",
    cursor: disabled ? "default" : "pointer", whiteSpace: "nowrap",
});
