"use client";
import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useKaryawan } from "@/lib/karyawan-store";
import { useAbsensi, AbsensiRecord } from "@/lib/absensi-store";

/* ================================================================
   DASHBOARD ABSENSI — /dashboard/absensi
   Rekap absensi harian dengan jam masuk, jam keluar, total jam kerja
================================================================ */

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getWIBToday() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}-${padZero(wib.getDate())}`;
}

function formatTanggalDisplay(d: string) {
    if (!d) return "-";
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const [y, m, day] = d.split("-");
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

export default function AbsensiPage() {
    const { karyawan } = useKaryawan();
    const { absensi, getAbsensiByDate, deleteAbsensi, refreshFromLS } = useAbsensi();
    const [selectedDate, setSelectedDate] = useState(getWIBToday());
    const [fotoModal, setFotoModal] = useState<{ record: AbsensiRecord; type: "masuk" | "keluar" } | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [activeTab, setActiveTab] = useState<"rekap" | "link">("rekap");

    // Auto-refresh from localStorage every 5 seconds (to catch cross-tab updates)
    useEffect(() => {
        const interval = setInterval(() => refreshFromLS(), 5000);
        return () => clearInterval(interval);
    }, [refreshFromLS]);

    // Also refresh when tab gets focus
    useEffect(() => {
        const handler = () => refreshFromLS();
        window.addEventListener("focus", handler);
        return () => window.removeEventListener("focus", handler);
    }, [refreshFromLS]);

    const absensiHariIni = useMemo(() => getAbsensiByDate(selectedDate), [absensi, selectedDate, getAbsensiByDate]);

    const rekapRows = useMemo(() => {
        return karyawan.map(k => {
            const record = absensiHariIni.find(a => a.karyawan_id === k.id);
            return { karyawan: k, absensi: record ?? null };
        });
    }, [karyawan, absensiHariIni]);

    const totalHadir = rekapRows.filter(r => r.absensi).length;
    const totalTelat = rekapRows.filter(r => r.absensi?.is_telat).length;
    const totalBelum = rekapRows.filter(r => !r.absensi).length;
    const totalPulang = rekapRows.filter(r => r.absensi?.jam_keluar).length;

    const copyLink = () => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        navigator.clipboard.writeText(`${base}/absen`);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const exportExcel = () => {
        const rows = rekapRows.map(r => ({
            "Nama": r.karyawan.nama,
            "Jabatan": r.karyawan.jabatan,
            "Divisi": r.karyawan.divisi,
            "Jam Masuk": r.absensi?.jam_masuk ?? "-",
            "Jam Keluar": r.absensi?.jam_keluar || "-",
            "Total Jam Kerja": r.absensi?.total_jam_kerja || "-",
            "Status": !r.absensi ? "Belum Absen" : r.absensi.is_telat ? `Telat ${r.absensi.selisih_menit} menit` : "Tepat Waktu",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Absensi");
        XLSX.writeFile(wb, `Absensi_${selectedDate}.xlsx`);
    };

    const absenLink = typeof window !== "undefined" ? `${window.location.origin}/absen` : "/absen";

    return (
        <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", margin: 0 }}>📋 Absensi Karyawan</h1>
                <p style={{ color: "#64748B", fontSize: 14, margin: "4px 0 0" }}>Rekap kehadiran & link absen karyawan</p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {(["rekap", "link"] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            padding: "10px 24px", borderRadius: 10, border: "none",
                            cursor: "pointer", fontSize: 14, fontWeight: 600,
                            background: activeTab === tab ? "linear-gradient(135deg, #3B82F6, #1D4ED8)" : "#F1F5F9",
                            color: activeTab === tab ? "white" : "#64748B",
                            transition: "all 0.2s",
                        }}
                    >
                        {tab === "rekap" ? "📊 Rekap Harian" : "🔗 Link Absen"}
                    </button>
                ))}
            </div>

            {/* ============ TAB: REKAP HARIAN ============ */}
            {activeTab === "rekap" && (
                <>
                    {/* Summary Cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 20 }}>
                        <SummaryCard icon="✅" label="Hadir" value={totalHadir} color="#15803D" bg="#DCFCE7" />
                        <SummaryCard icon="⏰" label="Telat" value={totalTelat} color="#DC2626" bg="#FEF2F2" />
                        <SummaryCard icon="🏠" label="Sudah Pulang" value={totalPulang} color="#D97706" bg="#FEF3C7" />
                        <SummaryCard icon="⚪" label="Belum Absen" value={totalBelum} color="#6B7280" bg="#F3F4F6" />
                    </div>

                    {/* Date filter + Export */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <label style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Tanggal:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                style={{
                                    padding: "8px 14px", borderRadius: 10,
                                    border: "1.5px solid #E2E8F0", fontSize: 14,
                                    color: "#1E293B", background: "white",
                                }}
                            />
                        </div>
                        <button onClick={exportExcel} style={btnOutline}>📥 Export Excel</button>
                    </div>

                    {/* Table */}
                    <div style={{ background: "white", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                            <thead>
                                <tr style={{ background: "#F8FAFC" }}>
                                    <th style={th}>No</th>
                                    <th style={{ ...th, textAlign: "left" }}>Nama</th>
                                    <th style={th}>Jabatan</th>
                                    <th style={th}>Jam Masuk</th>
                                    <th style={th}>Jam Keluar</th>
                                    <th style={th}>Total Kerja</th>
                                    <th style={th}>Status</th>
                                    <th style={th}>Foto</th>
                                    <th style={th}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rekapRows.length === 0 ? (
                                    <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#94A3B8", padding: 40 }}>Tidak ada data karyawan</td></tr>
                                ) : (
                                    rekapRows.map((row, i) => (
                                        <tr key={row.karyawan.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                            <td style={{ ...td, textAlign: "center", color: "#94A3B8" }}>{i + 1}</td>
                                            <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{row.karyawan.nama}</td>
                                            <td style={{ ...td, textAlign: "center", color: "#64748B", fontSize: 13 }}>{row.karyawan.jabatan}</td>
                                            <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                                {row.absensi ? row.absensi.jam_masuk : <span style={{ color: "#CBD5E1" }}>--:--</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: "center", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                                                {row.absensi?.jam_keluar ? row.absensi.jam_keluar : <span style={{ color: "#CBD5E1" }}>--:--</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: "center", fontSize: 13, fontWeight: 600, color: "#6366F1" }}>
                                                {row.absensi?.total_jam_kerja || <span style={{ color: "#CBD5E1" }}>-</span>}
                                            </td>
                                            <td style={{ ...td, textAlign: "center" }}>
                                                {!row.absensi ? (
                                                    <StatusBadge label="Belum" bg="#F3F4F6" color="#6B7280" />
                                                ) : row.absensi.is_telat ? (
                                                    <StatusBadge label={`Telat ${row.absensi.selisih_menit}m`} bg="#FEF2F2" color="#DC2626" />
                                                ) : (
                                                    <StatusBadge label="Tepat Waktu" bg="#DCFCE7" color="#15803D" />
                                                )}
                                            </td>
                                            <td style={{ ...td, textAlign: "center" }}>
                                                <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                                    {row.absensi?.foto_masuk_base64 && (
                                                        <button
                                                            onClick={() => setFotoModal({ record: row.absensi!, type: "masuk" })}
                                                            style={fotoBtn}
                                                            title="Foto Masuk"
                                                        >📷</button>
                                                    )}
                                                    {row.absensi?.foto_keluar_base64 && (
                                                        <button
                                                            onClick={() => setFotoModal({ record: row.absensi!, type: "keluar" })}
                                                            style={fotoBtn}
                                                            title="Foto Pulang"
                                                        >🏠</button>
                                                    )}
                                                    {!row.absensi && <span style={{ color: "#CBD5E1" }}>-</span>}
                                                </div>
                                            </td>
                                            <td style={{ ...td, textAlign: "center" }}>
                                                {row.absensi && (
                                                    <button
                                                        onClick={() => { if (confirm("Hapus data absensi ini?")) deleteAbsensi(row.absensi!.id); }}
                                                        style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#DC2626" }}
                                                        title="Hapus"
                                                    >🗑️</button>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ============ TAB: LINK ABSEN ============ */}
            {activeTab === "link" && (
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div style={{ padding: "24px 28px" }}>
                        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1E293B" }}>🔗 Link Absen Karyawan</h3>
                        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748B" }}>
                            Bagikan <b>1 link</b> ini ke semua karyawan. Mereka akan memilih nama sendiri saat membuka link.
                        </p>

                        {/* Link Box */}
                        <div style={{
                            display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
                            background: "#F8FAFC", borderRadius: 14, border: "1.5px solid #E2E8F0", marginBottom: 20,
                        }}>
                            <div style={{
                                width: 44, height: 44, borderRadius: 12,
                                background: "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 20, flexShrink: 0,
                            }}>🔗</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, color: "#64748B", marginBottom: 2 }}>Link Absensi</div>
                                <div style={{ fontSize: 15, fontWeight: 600, color: "#3B82F6", wordBreak: "break-all" }}>{absenLink}</div>
                            </div>
                            <button
                                onClick={copyLink}
                                style={{
                                    padding: "10px 24px", borderRadius: 10, border: "none",
                                    cursor: "pointer", fontSize: 14, fontWeight: 600,
                                    background: linkCopied ? "#DCFCE7" : "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                                    color: linkCopied ? "#15803D" : "white",
                                    transition: "all 0.2s", flexShrink: 0,
                                }}
                            >
                                {linkCopied ? "✅ Tersalin!" : "📋 Salin Link"}
                            </button>
                        </div>

                        {/* How it works */}
                        <div style={{ background: "#EFF6FF", borderRadius: 12, padding: "16px 20px" }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D4ED8", marginBottom: 10 }}>📖 Cara Kerja</div>
                            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                                {[
                                    { step: "1", text: "Bagikan link di atas ke grup WhatsApp karyawan" },
                                    { step: "2", text: "Karyawan buka link → pilih nama mereka dari daftar" },
                                    { step: "3", text: "Ambil foto selfie → klik \"Absen Masuk\"" },
                                    { step: "4", text: "Saat pulang, buka link lagi → klik \"Absen Pulang\"" },
                                    { step: "5", text: "Data masuk otomatis ke Rekap Harian di dashboard ini" },
                                ].map(item => (
                                    <div key={item.step} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                        <div style={{
                                            width: 28, height: 28, borderRadius: "50%",
                                            background: "#1D4ED8", color: "white",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 13, fontWeight: 700, flexShrink: 0,
                                        }}>{item.step}</div>
                                        <span style={{ fontSize: 14, color: "#334155" }}>{item.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ============ FOTO MODAL ============ */}
            {fotoModal && (
                <div
                    onClick={() => setFotoModal(null)}
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        zIndex: 9999, padding: 16,
                    }}
                >
                    <div
                        onClick={e => e.stopPropagation()}
                        style={{
                            background: "white", borderRadius: 20, maxWidth: 420,
                            width: "100%", overflow: "hidden",
                            boxShadow: "0 25px 50px rgba(0,0,0,0.3)",
                        }}
                    >
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E2E8F0" }}>
                            <h3 style={{ margin: 0, fontSize: 16, color: "#1E293B" }}>
                                {fotoModal.type === "masuk" ? "📷 Foto Masuk" : "🏠 Foto Pulang"} — {fotoModal.record.nama_karyawan}
                            </h3>
                            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>
                                {formatTanggalDisplay(fotoModal.record.tanggal)} •{" "}
                                {fotoModal.type === "masuk" ? fotoModal.record.jam_masuk : fotoModal.record.jam_keluar} WIB
                                {fotoModal.type === "masuk" && fotoModal.record.is_telat && (
                                    <span style={{ color: "#DC2626", fontWeight: 600 }}> • Telat {fotoModal.record.selisih_menit}m</span>
                                )}
                            </p>
                        </div>
                        <img
                            src={fotoModal.type === "masuk" ? fotoModal.record.foto_masuk_base64 : fotoModal.record.foto_keluar_base64}
                            alt="Selfie"
                            style={{ width: "100%", display: "block" }}
                        />
                        <div style={{ padding: 16, textAlign: "center" }}>
                            <button
                                onClick={() => setFotoModal(null)}
                                style={{
                                    padding: "10px 32px", borderRadius: 10, border: "none",
                                    cursor: "pointer", background: "#F1F5F9", color: "#475569",
                                    fontSize: 14, fontWeight: 600,
                                }}
                            >Tutup</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ──────── COMPONENTS ──────── */

function SummaryCard({ icon, label, value, color, bg }: { icon: string; label: string; value: number; color: string; bg: string }) {
    return (
        <div style={{
            background: "white", borderRadius: 14, padding: "18px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex",
            alignItems: "center", gap: 14,
        }}>
            <div style={{
                width: 44, height: 44, borderRadius: 12, background: bg,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
            }}>{icon}</div>
            <div>
                <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 13, color: "#64748B" }}>{label}</div>
            </div>
        </div>
    );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
    return (
        <span style={{
            display: "inline-block", padding: "4px 12px", borderRadius: 20,
            fontSize: 12, fontWeight: 600, background: bg, color,
        }}>{label}</span>
    );
}

/* ──────── STYLES ──────── */

const th: React.CSSProperties = {
    padding: "12px 14px", fontSize: 13, fontWeight: 600,
    color: "#64748B", textAlign: "center", borderBottom: "1px solid #E2E8F0",
};

const td: React.CSSProperties = { padding: "12px 14px", fontSize: 14 };

const btnOutline: React.CSSProperties = {
    padding: "8px 20px", borderRadius: 10, border: "1.5px solid #E2E8F0",
    background: "white", color: "#475569", fontSize: 14, fontWeight: 600, cursor: "pointer",
};

const fotoBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2,
};
