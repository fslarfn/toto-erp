"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useKaryawan } from "@/lib/karyawan-store";
import { useAbsensi } from "@/lib/absensi-store";

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
    const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function AbsenSelectPage() {
    const router = useRouter();
    const { karyawan } = useKaryawan();
    const { sudahAbsenMasuk, sudahAbsenPulang } = useAbsensi();
    const [search, setSearch] = useState("");
    const [clock, setClock] = useState(getWIBNow());

    useEffect(() => {
        const t = setInterval(() => setClock(getWIBNow()), 1000);
        return () => clearInterval(t);
    }, []);

    const today = toISODate(clock);

    const filtered = karyawan.filter(k =>
        k.nama.toLowerCase().includes(search.toLowerCase())
    );

    const totalHadir = karyawan.filter(k => sudahAbsenMasuk(k.id, today)).length;
    const totalPulang = karyawan.filter(k => sudahAbsenPulang(k.id, today)).length;
    const totalBelum = karyawan.length - totalHadir;

    return (
        <div style={{
            minHeight: "100dvh",
            background: "linear-gradient(160deg, #1a2744 0%, #0f172a 60%, #0c1523 100%)",
            fontFamily: "'Inter', -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
        }}>
            {/* ── HEADER ── */}
            <div style={{
                padding: "28px 20px 20px",
                textAlign: "center",
                flexShrink: 0,
            }}>
                {/* Logo */}
                <div style={{
                    width: 64, height: 64, borderRadius: 18,
                    background: "linear-gradient(135deg, #5C4033, #A67B5B)",
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    fontSize: 30, marginBottom: 14,
                    boxShadow: "0 8px 24px rgba(92,64,51,0.4)",
                }}>📋</div>

                <h1 style={{
                    fontSize: 20, fontWeight: 800, color: "white",
                    margin: "0 0 4px", letterSpacing: "-0.3px",
                }}>
                    Absensi Karyawan
                </h1>
                <p style={{ color: "#A67B5B", fontSize: 13, fontWeight: 600, margin: "0 0 4px" }}>
                    CV TOTO ALUMINIUM MANUFACTURE
                </p>
                <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: 0 }}>
                    {formatTanggal(clock)}
                </p>

                {/* Live clock */}
                <div style={{
                    marginTop: 14,
                    fontSize: 32, fontWeight: 800, color: "white",
                    fontVariantNumeric: "tabular-nums", letterSpacing: "2px",
                }}>
                    {padZero(clock.getHours())}:{padZero(clock.getMinutes())}:{padZero(clock.getSeconds())}
                </div>
                <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 11, margin: "4px 0 0" }}>WIB</p>

                {/* Stats bar */}
                <div style={{
                    display: "flex", gap: 8, marginTop: 18, justifyContent: "center",
                }}>
                    {[
                        { label: "Hadir", value: totalHadir, color: "#22C55E", bg: "rgba(34,197,94,0.15)" },
                        { label: "Pulang", value: totalPulang, color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
                        { label: "Belum", value: totalBelum, color: "#94A3B8", bg: "rgba(148,163,184,0.15)" },
                    ].map(s => (
                        <div key={s.label} style={{
                            flex: 1, maxWidth: 90,
                            background: s.bg, borderRadius: 12,
                            padding: "8px 4px",
                            border: `1px solid ${s.color}30`,
                        }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{s.label}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── SEARCH ── */}
            <div style={{ padding: "0 16px 12px", flexShrink: 0 }}>
                <div style={{ position: "relative" }}>
                    <span style={{
                        position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                        fontSize: 16, pointerEvents: "none",
                    }}>🔍</span>
                    <input
                        type="text"
                        placeholder="Cari nama karyawan..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width: "100%", padding: "14px 16px 14px 42px",
                            borderRadius: 14, border: "1.5px solid rgba(255,255,255,0.1)",
                            fontSize: 15, outline: "none", boxSizing: "border-box",
                            background: "rgba(255,255,255,0.07)",
                            color: "white",
                        }}
                    />
                </div>
            </div>

            {/* ── EMPLOYEE LIST ── */}
            <div style={{
                flex: 1,
                background: "white",
                borderRadius: "22px 22px 0 0",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
            }}>
                {/* Drag handle */}
                <div style={{ textAlign: "center", paddingTop: 10, paddingBottom: 6, flexShrink: 0 }}>
                    <div style={{ width: 36, height: 4, borderRadius: 2, background: "#E2E8F0", display: "inline-block" }} />
                </div>

                <div style={{ padding: "0 16px 8px", flexShrink: 0 }}>
                    <p style={{ fontSize: 12, color: "#94A3B8", margin: 0, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        {filtered.length} karyawan
                    </p>
                </div>

                <div style={{ overflowY: "auto", flex: 1, padding: "0 12px 24px" }}>
                    {filtered.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "40px 0", color: "#94A3B8" }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>😕</div>
                            <p style={{ fontSize: 15 }}>Karyawan tidak ditemukan</p>
                        </div>
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {filtered.map(k => {
                                const hasMasuk = sudahAbsenMasuk(k.id, today);
                                const hasPulang = sudahAbsenPulang(k.id, today);
                                const isDone = hasPulang;

                                return (
                                    <button
                                        key={k.id}
                                        onClick={() => !isDone && router.push(`/absen/${k.id}`)}
                                        disabled={isDone}
                                        style={{
                                            display: "flex", alignItems: "center", gap: 14,
                                            padding: "14px 14px",
                                            borderRadius: 16,
                                            border: hasMasuk && !hasPulang
                                                ? "1.5px solid #FDE68A"
                                                : hasPulang
                                                    ? "1.5px solid #D1FAE5"
                                                    : "1.5px solid #F1F5F9",
                                            background: hasMasuk && !hasPulang
                                                ? "#FFFBEB"
                                                : hasPulang
                                                    ? "#F0FDF4"
                                                    : "white",
                                            cursor: isDone ? "default" : "pointer",
                                            width: "100%",
                                            textAlign: "left",
                                            opacity: isDone ? 0.65 : 1,
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                                            minHeight: 68,
                                            transition: "all 0.15s",
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            width: 46, height: 46, borderRadius: 13, flexShrink: 0,
                                            background: hasPulang
                                                ? "linear-gradient(135deg, #22C55E, #15803D)"
                                                : hasMasuk
                                                    ? "linear-gradient(135deg, #F59E0B, #D97706)"
                                                    : "linear-gradient(135deg, #5C4033, #A67B5B)",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            color: "white", fontWeight: 800, fontSize: 18,
                                        }}>
                                            {k.nama.charAt(0).toUpperCase()}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, color: "#1E293B", fontSize: 15, marginBottom: 2 }}>
                                                {k.nama}
                                            </div>
                                            <div style={{ color: "#94A3B8", fontSize: 12.5 }}>
                                                {k.jabatan}
                                            </div>
                                        </div>

                                        {/* Badge */}
                                        <div style={{ flexShrink: 0 }}>
                                            {hasPulang ? (
                                                <span style={{
                                                    padding: "6px 12px", borderRadius: 20,
                                                    fontSize: 12, fontWeight: 700,
                                                    background: "#DCFCE7", color: "#15803D",
                                                }}>✅ Selesai</span>
                                            ) : hasMasuk ? (
                                                <span style={{
                                                    padding: "9px 14px", borderRadius: 20,
                                                    fontSize: 13, fontWeight: 700,
                                                    background: "linear-gradient(135deg, #F59E0B, #D97706)",
                                                    color: "white",
                                                    boxShadow: "0 4px 12px rgba(245,158,11,0.3)",
                                                }}>Pulang →</span>
                                            ) : (
                                                <span style={{
                                                    padding: "9px 14px", borderRadius: 20,
                                                    fontSize: 13, fontWeight: 700,
                                                    background: "linear-gradient(135deg, #5C4033, #A67B5B)",
                                                    color: "white",
                                                    boxShadow: "0 4px 12px rgba(92,64,51,0.3)",
                                                }}>Absen →</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
