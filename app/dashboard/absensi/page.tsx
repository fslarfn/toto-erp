"use client";
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useKaryawan, DataKaryawan } from "@/lib/karyawan-store";
import { useAbsensi, AbsensiRecord, IzinRecord } from "@/lib/absensi-store";

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getWIBToday() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}-${padZero(wib.getDate())}`;
}

function getWIBThisMonth() {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const wib = new Date(utc + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}`;
}

function formatTanggalDisplay(d: string) {
    if (!d) return "-";
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const [y, m, day] = d.split("-");
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatRupiah(n: number) {
    if (!n) return "Rp 0";
    return `Rp ${n.toLocaleString("id-ID")}`;
}

function isKaryawanHarian(k: DataKaryawan): boolean {
    if (k.periode_gaji === "mingguan") return true;
    if (k.periode_gaji === "bulanan") return false;
    return (k.gaji_harian ?? 0) > 0 && (k.gaji_pokok ?? 0) === 0;
}

type ActiveTab = "rekap" | "bulanan" | "izin" | "gaji" | "link";

export default function AbsensiPage() {
    const { karyawan } = useKaryawan();
    const { absensi, izin, deleteAbsensi, refreshFromLS, addIzin, deleteIzin } = useAbsensi();

    const [activeTab, setActiveTab] = useState<ActiveTab>("rekap");
    const [selectedDate, setSelectedDate] = useState(getWIBToday());
    const [selectedMonth, setSelectedMonth] = useState(getWIBThisMonth());
    const [fotoModal, setFotoModal] = useState<{ record: AbsensiRecord; type: "masuk" | "keluar" } | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);

    // Izin form state
    const [izinForm, setIzinForm] = useState({
        karyawan_id: "",
        tanggal: getWIBToday(),
        jenis: "izin",
        keterangan: "",
    });
    const [izinSubmitting, setIzinSubmitting] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => refreshFromLS(), 10000);
        return () => clearInterval(interval);
    }, [refreshFromLS]);

    useEffect(() => {
        const handler = () => refreshFromLS();
        window.addEventListener("focus", handler);
        return () => window.removeEventListener("focus", handler);
    }, [refreshFromLS]);

    // ── Rekap Harian data ──────────────────────────────────────────
    const absensiHariIni = useMemo(() =>
        absensi.filter(a => a.tanggal === selectedDate),
        [absensi, selectedDate]
    );

    const rekapRows = useMemo(() =>
        karyawan.map(k => ({
            karyawan: k,
            absensi: absensiHariIni.find(a => a.karyawan_id === k.id) ?? null,
        })),
        [karyawan, absensiHariIni]
    );

    const totalHadir = rekapRows.filter(r => r.absensi).length;
    const totalTelat = rekapRows.filter(r => r.absensi?.is_telat).length;
    const totalBelum = rekapRows.filter(r => !r.absensi).length;
    const totalPulang = rekapRows.filter(r => r.absensi?.jam_keluar).length;

    // ── Rekap Bulanan data ─────────────────────────────────────────
    const absensiForMonth = useMemo(() =>
        absensi.filter(a => a.tanggal.startsWith(selectedMonth)),
        [absensi, selectedMonth]
    );

    const izinForMonth = useMemo(() =>
        izin.filter(i => i.tanggal.startsWith(selectedMonth)),
        [izin, selectedMonth]
    );

    const bulananRows = useMemo(() =>
        karyawan.map(k => {
            const abs = absensiForMonth.filter(a => a.karyawan_id === k.id);
            const iz = izinForMonth.filter(i => i.karyawan_id === k.id);
            return {
                karyawan: k,
                hadir: abs.length,
                telat: abs.filter(a => a.is_telat).length,
                totalLembur: abs.reduce((s, a) => s + (a.overtime_hours || 0), 0),
                izin: iz.filter(i => i.jenis === "izin").length,
                sakit: iz.filter(i => i.jenis === "sakit").length,
                cuti: iz.filter(i => i.jenis === "cuti").length,
            };
        }),
        [karyawan, absensiForMonth, izinForMonth]
    );

    // ── Rekap Gaji data ────────────────────────────────────────────
    const gajiRows = useMemo(() =>
        karyawan.map(k => {
            const abs = absensiForMonth.filter(a => a.karyawan_id === k.id);
            const hariHadir = abs.length;
            const totalOT = abs.reduce((s, a) => s + (a.overtime_hours || 0), 0);
            const harian = isKaryawanHarian(k);
            const gajiDasar = harian
                ? (k.gaji_harian ?? 0) * hariHadir
                : (k.gaji_pokok ?? 0);
            const gajiLembur = (k.tarif_lembur ?? 0) * totalOT;
            return {
                karyawan: k,
                hariHadir,
                totalOT,
                harian,
                gajiDasar,
                gajiLembur,
                totalGaji: gajiDasar + gajiLembur,
            };
        }),
        [karyawan, absensiForMonth]
    );

    // ── Handlers ───────────────────────────────────────────────────
    const copyLink = () => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        navigator.clipboard.writeText(`${base}/absen`);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    };

    const submitIzin = useCallback(async () => {
        if (!izinForm.karyawan_id || !izinForm.tanggal) return;
        const emp = karyawan.find(k => k.id === Number(izinForm.karyawan_id));
        if (!emp) return;
        setIzinSubmitting(true);
        addIzin({
            karyawan_id: Number(izinForm.karyawan_id),
            nama_karyawan: emp.nama,
            tanggal: izinForm.tanggal,
            jenis: izinForm.jenis,
            keterangan: izinForm.keterangan,
            status: "disetujui",
        });
        setIzinForm(f => ({ ...f, karyawan_id: "", keterangan: "" }));
        setTimeout(() => setIzinSubmitting(false), 800);
    }, [izinForm, karyawan, addIzin]);

    const absenLink = typeof window !== "undefined" ? `${window.location.origin}/absen` : "/absen";

    const tabs: { key: ActiveTab; label: string }[] = [
        { key: "rekap", label: "📊 Harian" },
        { key: "bulanan", label: "📅 Bulanan" },
        { key: "izin", label: "🏖️ Izin/Cuti" },
        { key: "gaji", label: "💰 Rekap Gaji" },
        { key: "link", label: "🔗 Link Absen" },
    ];

    return (
        <div style={{ padding: "24px 28px", maxWidth: 1200, margin: "0 auto" }}>
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1E293B", margin: 0 }}>📋 Absensi Karyawan</h1>
                <p style={{ color: "#64748B", fontSize: 14, margin: "4px 0 0" }}>Rekap kehadiran, izin, dan gaji karyawan</p>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: "9px 18px", borderRadius: 10, border: "none",
                            cursor: "pointer", fontSize: 13, fontWeight: 600,
                            background: activeTab === tab.key
                                ? "linear-gradient(135deg, #3B82F6, #1D4ED8)"
                                : "#F1F5F9",
                            color: activeTab === tab.key ? "white" : "#64748B",
                            transition: "all 0.2s",
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════════════
                TAB: REKAP HARIAN
            ══════════════════════════════════════════════════════ */}
            {activeTab === "rekap" && (
                <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 20 }}>
                        <SummaryCard icon="✅" label="Hadir" value={totalHadir} color="#15803D" bg="#DCFCE7" />
                        <SummaryCard icon="⏰" label="Telat" value={totalTelat} color="#DC2626" bg="#FEF2F2" />
                        <SummaryCard icon="🏠" label="Sudah Pulang" value={totalPulang} color="#D97706" bg="#FEF3C7" />
                        <SummaryCard icon="⚪" label="Belum Absen" value={totalBelum} color="#6B7280" bg="#F3F4F6" />
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <label style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Tanggal:</label>
                            <input
                                type="date" value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                                style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B" }}
                            />
                        </div>
                    </div>

                    <div style={{ background: "white", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
                            <thead>
                                <tr style={{ background: "#F8FAFC" }}>
                                    <th style={th}>No</th>
                                    <th style={{ ...th, textAlign: "left" }}>Nama</th>
                                    <th style={th}>Jabatan</th>
                                    <th style={th}>Jam Masuk</th>
                                    <th style={th}>Jam Keluar</th>
                                    <th style={th}>Total Kerja</th>
                                    <th style={th}>Lembur</th>
                                    <th style={th}>Status</th>
                                    <th style={th}>Foto</th>
                                    <th style={th}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rekapRows.length === 0 ? (
                                    <tr><td colSpan={10} style={{ ...td, textAlign: "center", color: "#94A3B8", padding: 40 }}>Tidak ada data karyawan</td></tr>
                                ) : rekapRows.map((row, i) => (
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
                                            {row.absensi && (row.absensi.overtime_hours ?? 0) > 0
                                                ? <StatusBadge label={`🌙 ${row.absensi.overtime_hours}j`} bg="#EFF6FF" color="#1D4ED8" />
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {!row.absensi
                                                ? <StatusBadge label="Belum" bg="#F3F4F6" color="#6B7280" />
                                                : row.absensi.is_telat
                                                    ? <StatusBadge label={`Telat ${row.absensi.selisih_menit}m`} bg="#FEF2F2" color="#DC2626" />
                                                    : <StatusBadge label="Tepat Waktu" bg="#DCFCE7" color="#15803D" />}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                                                {row.absensi?.foto_masuk_base64 && (
                                                    <button onClick={() => setFotoModal({ record: row.absensi!, type: "masuk" })} style={fotoBtn} title="Foto Masuk">📷</button>
                                                )}
                                                {row.absensi?.foto_keluar_base64 && (
                                                    <button onClick={() => setFotoModal({ record: row.absensi!, type: "keluar" })} style={fotoBtn} title="Foto Pulang">🏠</button>
                                                )}
                                                {!row.absensi && <span style={{ color: "#CBD5E1" }}>-</span>}
                                            </div>
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {row.absensi && (
                                                <button
                                                    onClick={() => { if (confirm("Hapus data absensi ini?")) deleteAbsensi(row.absensi!.id); }}
                                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#DC2626" }}
                                                >🗑️</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: REKAP BULANAN
            ══════════════════════════════════════════════════════ */}
            {activeTab === "bulanan" && (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                        <label style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Bulan:</label>
                        <input
                            type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B" }}
                        />
                    </div>

                    {/* Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
                        <SummaryCard icon="📆" label="Total Hadir" value={bulananRows.reduce((s, r) => s + r.hadir, 0)} color="#15803D" bg="#DCFCE7" />
                        <SummaryCard icon="⏰" label="Total Telat" value={bulananRows.reduce((s, r) => s + r.telat, 0)} color="#DC2626" bg="#FEF2F2" />
                        <SummaryCard icon="🌙" label="Total Lembur (jam)" value={bulananRows.reduce((s, r) => s + r.totalLembur, 0)} color="#6366F1" bg="#EEF2FF" />
                        <SummaryCard icon="🏖️" label="Total Izin/Sakit" value={bulananRows.reduce((s, r) => s + r.izin + r.sakit, 0)} color="#D97706" bg="#FEF3C7" />
                    </div>

                    <div style={{ background: "white", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                            <thead>
                                <tr style={{ background: "#F8FAFC" }}>
                                    <th style={th}>No</th>
                                    <th style={{ ...th, textAlign: "left" }}>Nama</th>
                                    <th style={th}>Jabatan</th>
                                    <th style={th}>Hadir</th>
                                    <th style={th}>Telat</th>
                                    <th style={th}>Lembur (jam)</th>
                                    <th style={th}>Izin</th>
                                    <th style={th}>Sakit</th>
                                    <th style={th}>Cuti</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bulananRows.map((row, i) => (
                                    <tr key={row.karyawan.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                        <td style={{ ...td, textAlign: "center", color: "#94A3B8" }}>{i + 1}</td>
                                        <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{row.karyawan.nama}</td>
                                        <td style={{ ...td, textAlign: "center", color: "#64748B", fontSize: 13 }}>{row.karyawan.jabatan}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <span style={{ fontWeight: 700, color: "#15803D" }}>{row.hadir}</span>
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {row.telat > 0
                                                ? <StatusBadge label={`${row.telat}x`} bg="#FEF2F2" color="#DC2626" />
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {row.totalLembur > 0
                                                ? <StatusBadge label={`${row.totalLembur}j`} bg="#EEF2FF" color="#6366F1" />
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>{row.izin > 0 ? row.izin : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                                        <td style={{ ...td, textAlign: "center" }}>{row.sakit > 0 ? row.sakit : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                                        <td style={{ ...td, textAlign: "center" }}>{row.cuti > 0 ? row.cuti : <span style={{ color: "#CBD5E1" }}>-</span>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: IZIN / CUTI
            ══════════════════════════════════════════════════════ */}
            {activeTab === "izin" && (
                <>
                    {/* Add Izin Form */}
                    <div style={{ background: "white", borderRadius: 16, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 20 }}>
                        <h3 style={{ margin: "0 0 16px", fontSize: 15, color: "#1E293B", fontWeight: 700 }}>➕ Tambah Izin / Sakit / Cuti</h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                            <div>
                                <label style={formLabel}>Karyawan</label>
                                <select
                                    value={izinForm.karyawan_id}
                                    onChange={e => setIzinForm(f => ({ ...f, karyawan_id: e.target.value }))}
                                    style={formInput}
                                >
                                    <option value="">— Pilih Karyawan —</option>
                                    {karyawan.map(k => (
                                        <option key={k.id} value={k.id}>{k.nama}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={formLabel}>Tanggal</label>
                                <input
                                    type="date" value={izinForm.tanggal}
                                    onChange={e => setIzinForm(f => ({ ...f, tanggal: e.target.value }))}
                                    style={formInput}
                                />
                            </div>
                            <div>
                                <label style={formLabel}>Jenis</label>
                                <select
                                    value={izinForm.jenis}
                                    onChange={e => setIzinForm(f => ({ ...f, jenis: e.target.value }))}
                                    style={formInput}
                                >
                                    <option value="izin">Izin</option>
                                    <option value="sakit">Sakit</option>
                                    <option value="cuti">Cuti</option>
                                </select>
                            </div>
                            <div>
                                <label style={formLabel}>Keterangan</label>
                                <input
                                    type="text" value={izinForm.keterangan}
                                    placeholder="opsional"
                                    onChange={e => setIzinForm(f => ({ ...f, keterangan: e.target.value }))}
                                    style={formInput}
                                />
                            </div>
                        </div>
                        <div style={{ marginTop: 14 }}>
                            <button
                                onClick={submitIzin}
                                disabled={!izinForm.karyawan_id || !izinForm.tanggal || izinSubmitting}
                                style={{
                                    padding: "10px 28px", borderRadius: 10, border: "none",
                                    cursor: "pointer", fontSize: 14, fontWeight: 600,
                                    background: izinSubmitting ? "#DCFCE7" : "linear-gradient(135deg, #3B82F6, #1D4ED8)",
                                    color: izinSubmitting ? "#15803D" : "white",
                                    opacity: !izinForm.karyawan_id ? 0.5 : 1,
                                }}
                            >
                                {izinSubmitting ? "✅ Tersimpan!" : "💾 Simpan"}
                            </button>
                        </div>
                    </div>

                    {/* Month filter */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <label style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Filter Bulan:</label>
                        <input
                            type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B" }}
                        />
                    </div>

                    {/* Izin table */}
                    <div style={{ background: "white", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
                            <thead>
                                <tr style={{ background: "#F8FAFC" }}>
                                    <th style={th}>No</th>
                                    <th style={{ ...th, textAlign: "left" }}>Nama</th>
                                    <th style={th}>Tanggal</th>
                                    <th style={th}>Jenis</th>
                                    <th style={{ ...th, textAlign: "left" }}>Keterangan</th>
                                    <th style={th}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {izinForMonth.length === 0 ? (
                                    <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#94A3B8", padding: 40 }}>
                                        Tidak ada data izin bulan ini
                                    </td></tr>
                                ) : izinForMonth.map((rec, i) => (
                                    <tr key={rec.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                        <td style={{ ...td, textAlign: "center", color: "#94A3B8" }}>{i + 1}</td>
                                        <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>{rec.nama_karyawan}</td>
                                        <td style={{ ...td, textAlign: "center" }}>{formatTanggalDisplay(rec.tanggal)}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <StatusBadge
                                                label={rec.jenis === "izin" ? "🏖️ Izin" : rec.jenis === "sakit" ? "🤒 Sakit" : "✈️ Cuti"}
                                                bg={rec.jenis === "sakit" ? "#FEF2F2" : rec.jenis === "cuti" ? "#F5F3FF" : "#FEF3C7"}
                                                color={rec.jenis === "sakit" ? "#DC2626" : rec.jenis === "cuti" ? "#7C3AED" : "#D97706"}
                                            />
                                        </td>
                                        <td style={{ ...td, color: "#64748B", fontSize: 13 }}>{rec.keterangan || "-"}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <button
                                                onClick={() => { if (confirm("Hapus data izin ini?")) deleteIzin(rec.id); }}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#DC2626" }}
                                            >🗑️</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: REKAP GAJI
            ══════════════════════════════════════════════════════ */}
            {activeTab === "gaji" && (
                <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                        <label style={{ fontSize: 14, color: "#64748B", fontWeight: 500 }}>Bulan:</label>
                        <input
                            type="month" value={selectedMonth}
                            onChange={e => setSelectedMonth(e.target.value)}
                            style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #E2E8F0", fontSize: 14, color: "#1E293B" }}
                        />
                    </div>

                    {/* Total summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
                        <div style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Total Gaji Dasar</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#1E293B" }}>
                                {formatRupiah(gajiRows.reduce((s, r) => s + r.gajiDasar, 0))}
                            </div>
                        </div>
                        <div style={{ background: "white", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>Total Gaji Lembur</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#6366F1" }}>
                                {formatRupiah(gajiRows.reduce((s, r) => s + r.gajiLembur, 0))}
                            </div>
                        </div>
                        <div style={{ background: "linear-gradient(135deg, #3B82F6, #1D4ED8)", borderRadius: 14, padding: "16px 20px", boxShadow: "0 4px 12px rgba(59,130,246,0.25)" }}>
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginBottom: 4 }}>Total Penggajian</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "white" }}>
                                {formatRupiah(gajiRows.reduce((s, r) => s + r.totalGaji, 0))}
                            </div>
                        </div>
                    </div>

                    <div style={{ background: "white", borderRadius: 16, overflow: "auto", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                            <thead>
                                <tr style={{ background: "#F8FAFC" }}>
                                    <th style={th}>No</th>
                                    <th style={{ ...th, textAlign: "left" }}>Nama</th>
                                    <th style={th}>Periode</th>
                                    <th style={th}>Hari Hadir</th>
                                    <th style={th}>Jam Lembur</th>
                                    <th style={th}>Gaji Dasar</th>
                                    <th style={th}>Gaji Lembur</th>
                                    <th style={th}>Total Gaji</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gajiRows.map((row, i) => (
                                    <tr key={row.karyawan.id} style={{ borderBottom: "1px solid #F1F5F9" }}>
                                        <td style={{ ...td, textAlign: "center", color: "#94A3B8" }}>{i + 1}</td>
                                        <td style={{ ...td, fontWeight: 600, color: "#1E293B" }}>
                                            <div>{row.karyawan.nama}</div>
                                            <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 400 }}>{row.karyawan.jabatan}</div>
                                        </td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            <StatusBadge
                                                label={row.harian ? "Harian" : "Bulanan"}
                                                bg={row.harian ? "#FEF3C7" : "#EFF6FF"}
                                                color={row.harian ? "#D97706" : "#1D4ED8"}
                                            />
                                        </td>
                                        <td style={{ ...td, textAlign: "center", fontWeight: 700 }}>{row.hariHadir}</td>
                                        <td style={{ ...td, textAlign: "center" }}>
                                            {row.totalOT > 0
                                                ? <span style={{ color: "#6366F1", fontWeight: 600 }}>{row.totalOT}j</span>
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            <span style={{ color: "#1E293B" }}>{formatRupiah(row.gajiDasar)}</span>
                                        </td>
                                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            {row.gajiLembur > 0
                                                ? <span style={{ color: "#6366F1" }}>{formatRupiah(row.gajiLembur)}</span>
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                                            <span style={{ fontWeight: 700, fontSize: 15, color: "#1D4ED8" }}>{formatRupiah(row.totalGaji)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <p style={{ marginTop: 12, fontSize: 12, color: "#94A3B8" }}>
                        * Gaji lembur = jam lembur × tarif lembur/jam (dapat diatur di menu Karyawan)
                    </p>
                </>
            )}

            {/* ══════════════════════════════════════════════════════
                TAB: LINK ABSEN
            ══════════════════════════════════════════════════════ */}
            {activeTab === "link" && (
                <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                    <div style={{ padding: "24px 28px" }}>
                        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1E293B" }}>🔗 Link Absen Karyawan</h3>
                        <p style={{ margin: "0 0 20px", fontSize: 14, color: "#64748B" }}>
                            Bagikan <b>1 link</b> ini ke semua karyawan. Mereka akan memilih nama sendiri saat membuka link.
                        </p>

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

                        {/* Per-employee links */}
                        <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#475569" }}>Link Langsung per Karyawan</h4>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10 }}>
                            {karyawan.map(k => {
                                const link = `${absenLink}/${k.id}`;
                                return (
                                    <div key={k.id} style={{
                                        padding: "12px 16px", borderRadius: 12,
                                        background: "#F8FAFC", border: "1px solid #E2E8F0",
                                        display: "flex", flexDirection: "column", gap: 4,
                                    }}>
                                        <div style={{ fontWeight: 600, color: "#1E293B", fontSize: 13 }}>{k.nama}</div>
                                        <div style={{ fontSize: 11, color: "#94A3B8" }}>{k.jabatan}</div>
                                        <div style={{ fontSize: 11, color: "#3B82F6", wordBreak: "break-all" }}>{link}</div>
                                        <button
                                            onClick={() => { navigator.clipboard.writeText(link); }}
                                            style={{
                                                marginTop: 4, padding: "5px 0", borderRadius: 6,
                                                border: "1px solid #E2E8F0", background: "white",
                                                fontSize: 11, fontWeight: 600, color: "#475569",
                                                cursor: "pointer",
                                            }}
                                        >📋 Salin</button>
                                    </div>
                                );
                            })}
                        </div>

                        <div style={{ background: "#EFF6FF", borderRadius: 12, padding: "16px 20px", marginTop: 20 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#1D4ED8", marginBottom: 10 }}>📖 Cara Kerja</div>
                            <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                                {[
                                    { step: "1", text: "Bagikan link langsung per karyawan ke masing-masing HP mereka" },
                                    { step: "2", text: "Karyawan buka link → langsung masuk ke halaman absen mereka" },
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

            {/* ══ FOTO MODAL ══════════════════════════════════════ */}
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
                        style={{ background: "white", borderRadius: 20, maxWidth: 420, width: "100%", overflow: "hidden", boxShadow: "0 25px 50px rgba(0,0,0,0.3)" }}
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
                                style={{ padding: "10px 32px", borderRadius: 10, border: "none", cursor: "pointer", background: "#F1F5F9", color: "#475569", fontSize: 14, fontWeight: 600 }}
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
        <div style={{ background: "white", borderRadius: 14, padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>{icon}</div>
            <div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 12, color: "#64748B" }}>{label}</div>
            </div>
        </div>
    );
}

function StatusBadge({ label, bg, color }: { label: string; bg: string; color: string }) {
    return (
        <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, background: bg, color }}>
            {label}
        </span>
    );
}

/* ──────── STYLES ──────── */

const th: React.CSSProperties = {
    padding: "11px 14px", fontSize: 12, fontWeight: 600,
    color: "#64748B", textAlign: "center", borderBottom: "1px solid #E2E8F0",
};

const td: React.CSSProperties = { padding: "11px 14px", fontSize: 14 };

const formLabel: React.CSSProperties = {
    display: "block", fontSize: 12, fontWeight: 600, color: "#64748B", marginBottom: 6,
};

const formInput: React.CSSProperties = {
    width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E2E8F0",
    fontSize: 14, color: "#1E293B", background: "white", boxSizing: "border-box",
};

const fotoBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer", fontSize: 16, padding: 2,
};
