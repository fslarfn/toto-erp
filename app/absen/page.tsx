"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useKaryawan } from "@/lib/karyawan-store";
import { useAbsensi } from "@/lib/absensi-store";

/* ================================================================
   HALAMAN PILIH KARYAWAN — /absen
   1 link untuk semua karyawan. Menampilkan status absen realtime.
================================================================ */

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getWIBNow() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    return new Date(utc + 7 * 3600000);
}

function toISODate(d: Date) {
    return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function formatTanggal(d: Date) {
    const days = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AbsenSelectPage() {
    const router = useRouter();
    const { karyawan } = useKaryawan();
    const { sudahAbsenMasuk, sudahAbsenPulang } = useAbsensi();
    const [search, setSearch] = useState("");
    const now = getWIBNow();
    const today = toISODate(now);

    const filtered = karyawan.filter(k =>
        k.nama.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div style={styles.container}>
            <div style={styles.card}>
                {/* Header */}
                <div style={{ textAlign: "center" as const, marginBottom: 24 }}>
                    <div style={styles.logo}>📋</div>
                    <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", margin: "10px 0 4px" }}>
                        Absensi Karyawan
                    </h1>
                    <p style={{ color: "#64748B", fontSize: 14, margin: 0 }}>PT Totobaru</p>
                    <p style={{ color: "#94A3B8", fontSize: 13, margin: "8px 0 0" }}>{formatTanggal(now)}</p>
                </div>

                {/* Search */}
                <div style={{ position: "relative", marginBottom: 16 }}>
                    <input
                        type="text"
                        placeholder="🔍 Cari nama karyawan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={styles.searchInput}
                    />
                </div>

                {/* Employee List */}
                <div style={styles.listContainer}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: "center" as const, padding: 32, color: "#94A3B8" }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
                            <p>Tidak ada karyawan ditemukan</p>
                        </div>
                    ) : (
                        filtered.map(k => {
                            const hasMasuk = sudahAbsenMasuk(k.id, today);
                            const hasPulang = sudahAbsenPulang(k.id, today);

                            let badgeEl: React.ReactNode;
                            let cardBg = "white";
                            let cardOpacity = 1;

                            if (hasPulang) {
                                // Selesai
                                badgeEl = <span style={styles.badgeDone}>✅ Selesai</span>;
                                cardBg = "#F8FAFC";
                                cardOpacity = 0.6;
                            } else if (hasMasuk) {
                                // Sudah masuk, belum pulang
                                badgeEl = <span style={styles.badgePulang}>🏠 Pulang →</span>;
                            } else {
                                // Belum absen
                                badgeEl = <span style={styles.badgeMasuk}>Absen →</span>;
                            }

                            return (
                                <button
                                    key={k.id}
                                    onClick={() => router.push(`/absen/${k.id}`)}
                                    style={{ ...styles.empCard, background: cardBg, opacity: cardOpacity }}
                                    disabled={hasPulang}
                                >
                                    <div style={styles.empAvatar}>
                                        {k.nama.charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, textAlign: "left" as const }}>
                                        <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 15 }}>
                                            {k.nama}
                                        </div>
                                        <div style={{ color: "#94A3B8", fontSize: 13, marginTop: 2 }}>
                                            {k.jabatan} • {k.divisi}
                                        </div>
                                    </div>
                                    {badgeEl}
                                </button>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div style={{ textAlign: "center" as const, marginTop: 16, color: "#CBD5E1", fontSize: 12 }}>
                    Pilih nama Anda untuk melakukan absensi
                </div>
            </div>
        </div>
    );
}

/* ──────── STYLES ──────── */
const styles: Record<string, React.CSSProperties> = {
    container: {
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #334155 100%)",
        padding: 16, fontFamily: "'Inter', sans-serif",
    },
    card: {
        width: "100%", maxWidth: 440, background: "white", borderRadius: 20, padding: 28,
        boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
    },
    logo: {
        width: 56, height: 56, borderRadius: 16,
        background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
        display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 28,
    },
    searchInput: {
        width: "100%", padding: "12px 16px", borderRadius: 12,
        border: "1.5px solid #E2E8F0", fontSize: 14, outline: "none",
        color: "#1E293B", background: "#F8FAFC", boxSizing: "border-box",
    },
    listContainer: {
        maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8,
    },
    empCard: {
        display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
        borderRadius: 14, border: "1.5px solid #F1F5F9", cursor: "pointer",
        transition: "all 0.15s", width: "100%", textAlign: "left" as const, fontSize: 14,
    },
    empAvatar: {
        width: 42, height: 42, borderRadius: 12,
        background: "linear-gradient(135deg, #3B82F6, #6366F1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontWeight: 700, fontSize: 16, flexShrink: 0,
    },
    badgeMasuk: {
        padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
        background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", color: "white", flexShrink: 0,
    },
    badgePulang: {
        padding: "6px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
        background: "linear-gradient(135deg, #F59E0B, #D97706)", color: "white", flexShrink: 0,
    },
    badgeDone: {
        padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
        background: "#DCFCE7", color: "#15803D", flexShrink: 0,
    },
};
