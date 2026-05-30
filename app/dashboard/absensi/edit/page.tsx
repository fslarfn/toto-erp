"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useKaryawan } from "@/lib/karyawan-store";
import { supabase } from "@/lib/supabase-client";

/* ── Helpers ────────────────────────────────────────────────────── */

function padZero(n: number) { return n.toString().padStart(2, "0"); }

function getWIBThisMonth() {
    const now = new Date();
    const wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}`;
}

function getWIBToday() {
    const now = new Date();
    const wib = new Date(now.getTime() + now.getTimezoneOffset() * 60000 + 7 * 3600000);
    return `${wib.getFullYear()}-${padZero(wib.getMonth() + 1)}-${padZero(wib.getDate())}`;
}

function formatTgl(d: string) {
    if (!d) return "-";
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const [y, m, day] = d.split("-");
    const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
    const dow = new Date(d + "T00:00:00").getDay();
    return `${dayNames[dow]}, ${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`;
}

function formatLembur(v: number) {
    if (!v) return "-";
    if (v === 0.5) return "½ hari";
    if (v === 1.5) return "1½ hari";
    return `${v} hari`;
}

/* ── Types ────────────────────────────────────────────────────── */

type AbsensiRow = {
    id: number;
    karyawan_id: number;
    nama_karyawan: string;
    tanggal: string;
    jam_masuk: string;
    jam_keluar: string;
    is_telat: boolean;
    overtime_hours: number;
    status_kehadiran: string;
    catatan: string;
    total_jam_kerja: string;
};

type FormState = {
    karyawan_id: string;
    nama_karyawan: string;
    tanggal: string;
    jam_masuk: string;
    jam_keluar: string;
    overtime_hours: string;
    status_kehadiran: string;
    catatan: string;
};

const BLANK_FORM: FormState = {
    karyawan_id: "",
    nama_karyawan: "",
    tanggal: getWIBToday(),
    jam_masuk: "08:00",
    jam_keluar: "",
    overtime_hours: "0",
    status_kehadiran: "hadir",
    catatan: "",
};

const STATUS_OPTIONS = ["hadir", "izin", "sakit", "cuti", "lembur"];
const LEMBUR_OPTIONS = [
    { value: "0", label: "Tidak ada" },
    { value: "0.5", label: "½ hari" },
    { value: "1", label: "1 hari" },
    { value: "1.5", label: "1½ hari" },
    { value: "2", label: "2 hari" },
];

/* ── Page ─────────────────────────────────────────────────────── */

export default function EditAbsensiPage() {
    const { user } = useAuth();
    const { karyawan } = useKaryawan();

    const [filterKaryawan, setFilterKaryawan] = useState("all");
    const [filterBulan, setFilterBulan] = useState(getWIBThisMonth());
    const [absensi, setAbsensi] = useState<AbsensiRow[]>([]);
    const [loading, setLoading] = useState(false);

    const [modal, setModal] = useState<"add" | "edit" | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [form, setForm] = useState<FormState>(BLANK_FORM);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    /* Akses hanya faisal */
    const isFaisal = user?.username === "faisal";

    /* ── Fetch data ─────────────────────────────────────────── */

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [y, m] = filterBulan.split("-").map(Number);
            const startDate = `${y}-${padZero(m)}-01`;
            const lastDay = new Date(y, m, 0).getDate();
            const endDate = `${y}-${padZero(m)}-${padZero(lastDay)}`;

            let q = supabase
                .from("absensi")
                .select("id, karyawan_id, nama_karyawan, tanggal, jam_masuk, jam_keluar, is_telat, overtime_hours, status_kehadiran, catatan, total_jam_kerja")
                .gte("tanggal", startDate)
                .lte("tanggal", endDate)
                .order("tanggal", { ascending: false });

            if (filterKaryawan !== "all") q = q.eq("karyawan_id", parseInt(filterKaryawan));

            const { data, error } = await q;
            if (error) throw error;
            setAbsensi((data || []) as AbsensiRow[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filterKaryawan, filterBulan]);

    useEffect(() => { fetchData(); }, [fetchData]);

    /* ── Helpers form ───────────────────────────────────────── */

    const openAdd = () => {
        setForm({ ...BLANK_FORM, karyawan_id: filterKaryawan !== "all" ? filterKaryawan : "", nama_karyawan: "" });
        setEditId(null);
        setModal("add");
    };

    const openEdit = (row: AbsensiRow) => {
        setForm({
            karyawan_id: String(row.karyawan_id),
            nama_karyawan: row.nama_karyawan,
            tanggal: row.tanggal,
            jam_masuk: row.jam_masuk || "08:00",
            jam_keluar: row.jam_keluar || "",
            overtime_hours: String(row.overtime_hours || 0),
            status_kehadiran: row.status_kehadiran || "hadir",
            catatan: row.catatan || "",
        });
        setEditId(row.id);
        setModal("edit");
    };

    const setField = (k: keyof FormState, v: string) => {
        setForm(f => {
            const next = { ...f, [k]: v };
            if (k === "karyawan_id") {
                const kar = karyawan.find(k2 => String(k2.id) === v);
                next.nama_karyawan = kar?.nama || "";
            }
            return next;
        });
    };

    /* ── Save (add / edit) ──────────────────────────────────── */

    const handleSave = async () => {
        if (!form.karyawan_id || !form.tanggal || !form.jam_masuk) {
            alert("Karyawan, tanggal, dan jam masuk wajib diisi.");
            return;
        }
        setSaving(true);
        try {
            if (modal === "add") {
                const res = await fetch("/api/absensi/admin", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        karyawan_id: parseInt(form.karyawan_id),
                        nama_karyawan: form.nama_karyawan,
                        tanggal: form.tanggal,
                        jam_masuk: form.jam_masuk,
                        jam_keluar: form.jam_keluar || null,
                        overtime_hours: parseFloat(form.overtime_hours) || 0,
                        status_kehadiran: form.status_kehadiran,
                        catatan: form.catatan || null,
                    }),
                });
                if (!res.ok) {
                    const e = await res.json();
                    throw new Error(e.error || "Gagal menyimpan");
                }
            } else {
                const res = await fetch("/api/absensi/admin", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        id: editId,
                        jam_masuk: form.jam_masuk,
                        jam_keluar: form.jam_keluar || null,
                        overtime_hours: parseFloat(form.overtime_hours) || 0,
                        status_kehadiran: form.status_kehadiran,
                        catatan: form.catatan || null,
                    }),
                });
                if (!res.ok) {
                    const e = await res.json();
                    throw new Error(e.error || "Gagal menyimpan");
                }
            }
            setModal(null);
            fetchData();
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSaving(false);
        }
    };

    /* ── Delete ─────────────────────────────────────────────── */

    const handleDelete = async (id: number) => {
        if (!confirm("Hapus data absen ini? Tindakan ini tidak bisa dibatalkan.")) return;
        setDeletingId(id);
        try {
            const res = await fetch("/api/absensi/admin", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) {
                const e = await res.json();
                throw new Error(e.error || "Gagal menghapus");
            }
            setAbsensi(prev => prev.filter(r => r.id !== id));
        } catch (err: any) {
            alert(err.message);
        } finally {
            setDeletingId(null);
        }
    };

    /* ── Ringkasan ──────────────────────────────────────────── */

    const ringkasan = useMemo(() => ({
        totalHadir: absensi.filter(a => a.jam_masuk).length,
        totalLembur: absensi.reduce((s, a) => s + (a.overtime_hours || 0), 0),
        totalTelat: absensi.filter(a => a.is_telat).length,
        totalPulang: absensi.filter(a => a.jam_keluar).length,
    }), [absensi]);

    /* ── Guard ──────────────────────────────────────────────── */

    if (!user) return null;
    if (!isFaisal) {
        return (
            <div style={{ padding: 40, textAlign: "center", color: "#64748B" }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <p style={{ fontWeight: 600, fontSize: 16 }}>Akses ditolak — halaman ini hanya untuk Faisal.</p>
            </div>
        );
    }

    /* ── Styles ─────────────────────────────────────────────── */

    const card: React.CSSProperties = { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "16px 20px" };
    const th: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "left", whiteSpace: "nowrap" };
    const td: React.CSSProperties = { padding: "10px 12px", fontSize: 13, color: "#1E293B", borderTop: "1px solid #F1F5F9", verticalAlign: "middle" };
    const btn = (bg: string, color = "#fff"): React.CSSProperties => ({ background: bg, color, border: "none", borderRadius: 6, padding: "7px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" });
    const input: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, outline: "none", boxSizing: "border-box" };
    const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#64748B", display: "block", marginBottom: 5 };

    return (
        <div style={{ padding: "24px 16px", maxWidth: 1100, margin: "0 auto", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }} className="page-content">

            {/* ── Header ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#1E293B" }}>✏️ Edit Absensi</h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748B" }}>Tambah, ubah, atau hapus data absen karyawan</p>
                </div>
                <button onClick={openAdd} style={{ ...btn("#4F46E5"), display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Tambah Absen
                </button>
            </div>

            {/* ── Filter ── */}
            <div style={{ ...card, marginBottom: 20, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 180px" }}>
                    <label style={label}>Karyawan</label>
                    <select value={filterKaryawan} onChange={e => setFilterKaryawan(e.target.value)}
                        style={{ ...input, background: "#fff" }}>
                        <option value="all">Semua Karyawan</option>
                        {karyawan.map(k => (
                            <option key={k.id} value={String(k.id)}>{k.nama}</option>
                        ))}
                    </select>
                </div>
                <div style={{ flex: "1 1 160px" }}>
                    <label style={label}>Bulan</label>
                    <input type="month" value={filterBulan} onChange={e => setFilterBulan(e.target.value)}
                        style={input} />
                </div>
                <button onClick={fetchData} style={{ ...btn("#0F172A"), alignSelf: "flex-end" }}>
                    Tampilkan
                </button>
            </div>

            {/* ── Ringkasan ── */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginBottom: 20 }}>
                {[
                    { icon: "✅", label: "Hadir", value: ringkasan.totalHadir, bg: "#DCFCE7", color: "#16A34A" },
                    { icon: "🏠", label: "Sudah Pulang", value: ringkasan.totalPulang, bg: "#DBEAFE", color: "#1D4ED8" },
                    { icon: "⏰", label: "Telat", value: ringkasan.totalTelat, bg: "#FEE2E2", color: "#DC2626" },
                    { icon: "🌙", label: "Total Lembur", value: formatLembur(ringkasan.totalLembur), bg: "#EEF2FF", color: "#6366F1" },
                ].map(s => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: "12px 16px" }}>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>{s.icon}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: s.color, opacity: 0.8 }}>{s.label}</div>
                    </div>
                ))}
            </div>

            {/* ── Tabel ── */}
            <div style={{ ...card, padding: 0, overflow: "hidden" }}>
                {loading ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>Memuat data...</div>
                ) : absensi.length === 0 ? (
                    <div style={{ padding: 40, textAlign: "center", color: "#94A3B8", fontSize: 14 }}>
                        Tidak ada data absen untuk filter ini.
                    </div>
                ) : (
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead style={{ background: "#F8FAFC" }}>
                                <tr>
                                    <th style={th}>Tanggal</th>
                                    <th style={th}>Karyawan</th>
                                    <th style={th}>Masuk</th>
                                    <th style={th}>Pulang</th>
                                    <th style={th}>Kerja</th>
                                    <th style={th}>Lembur</th>
                                    <th style={th}>Status</th>
                                    <th style={th}>Catatan</th>
                                    <th style={{ ...th, textAlign: "center" }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {absensi.map(row => (
                                    <tr key={row.id} style={{ transition: "background 0.15s" }}
                                        onMouseEnter={e => (e.currentTarget.style.background = "#F8FAFC")}
                                        onMouseLeave={e => (e.currentTarget.style.background = "")}>
                                        <td style={td}>
                                            <span style={{ fontSize: 12 }}>{formatTgl(row.tanggal)}</span>
                                        </td>
                                        <td style={td}>
                                            <span style={{ fontWeight: 600 }}>{row.nama_karyawan}</span>
                                        </td>
                                        <td style={td}>
                                            {row.jam_masuk ? (
                                                <span style={{ color: row.is_telat ? "#DC2626" : "#16A34A", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                                                    {row.jam_masuk.slice(0, 5)}
                                                    {row.is_telat && <span style={{ fontSize: 10, marginLeft: 4 }}>⏰</span>}
                                                </span>
                                            ) : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={td}>
                                            {row.jam_keluar
                                                ? <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.jam_keluar.slice(0, 5)}</span>
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={td}>
                                            <span style={{ fontSize: 12, color: "#64748B" }}>{row.total_jam_kerja || "-"}</span>
                                        </td>
                                        <td style={td}>
                                            {(row.overtime_hours || 0) > 0
                                                ? <span style={{ background: "#EEF2FF", color: "#6366F1", borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{formatLembur(row.overtime_hours)}</span>
                                                : <span style={{ color: "#CBD5E1" }}>-</span>}
                                        </td>
                                        <td style={td}>
                                            <span style={{
                                                background: row.status_kehadiran === "hadir" ? "#DCFCE7" : row.status_kehadiran === "lembur" ? "#EEF2FF" : "#FEF3C7",
                                                color: row.status_kehadiran === "hadir" ? "#16A34A" : row.status_kehadiran === "lembur" ? "#6366F1" : "#D97706",
                                                borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 600, textTransform: "capitalize"
                                            }}>
                                                {row.status_kehadiran || "hadir"}
                                            </span>
                                        </td>
                                        <td style={{ ...td, maxWidth: 150 }}>
                                            <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                                                {row.catatan || "-"}
                                            </span>
                                        </td>
                                        <td style={{ ...td, textAlign: "center", whiteSpace: "nowrap" }}>
                                            <button onClick={() => openEdit(row)}
                                                style={{ ...btn("#EFF6FF", "#3B82F6"), marginRight: 6, padding: "5px 10px" }}>
                                                ✏️ Edit
                                            </button>
                                            <button onClick={() => handleDelete(row.id)}
                                                disabled={deletingId === row.id}
                                                style={{ ...btn("#FEF2F2", "#DC2626"), padding: "5px 10px", opacity: deletingId === row.id ? 0.6 : 1 }}>
                                                {deletingId === row.id ? "..." : "🗑️"}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Modal Tambah / Edit ── */}
            {modal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: 16 }}>
                    <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>

                        {/* Modal Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 24px", borderBottom: "1px solid #F1F5F9" }}>
                            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1E293B" }}>
                                {modal === "add" ? "➕ Tambah Absen" : "✏️ Edit Absen"}
                            </h3>
                            <button onClick={() => setModal(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#94A3B8", lineHeight: 1 }}>×</button>
                        </div>

                        {/* Modal Body */}
                        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>

                            {/* Karyawan — hanya saat tambah */}
                            {modal === "add" && (
                                <div>
                                    <label style={label}>Karyawan *</label>
                                    <select value={form.karyawan_id} onChange={e => setField("karyawan_id", e.target.value)}
                                        style={{ ...input, background: "#fff" }}>
                                        <option value="">— Pilih Karyawan —</option>
                                        {karyawan.map(k => (
                                            <option key={k.id} value={String(k.id)}>{k.nama}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Info karyawan saat edit */}
                            {modal === "edit" && (
                                <div style={{ background: "#F8FAFC", borderRadius: 8, padding: "10px 14px" }}>
                                    <span style={{ fontSize: 12, color: "#64748B" }}>Karyawan: </span>
                                    <span style={{ fontWeight: 700, color: "#1E293B" }}>{form.nama_karyawan}</span>
                                </div>
                            )}

                            {/* Tanggal */}
                            <div>
                                <label style={label}>Tanggal *</label>
                                <input type="date" value={form.tanggal} onChange={e => setField("tanggal", e.target.value)}
                                    style={input} readOnly={modal === "edit"} />
                            </div>

                            {/* Jam Masuk & Pulang */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                <div>
                                    <label style={label}>Jam Masuk *</label>
                                    <input type="time" value={form.jam_masuk} onChange={e => setField("jam_masuk", e.target.value)}
                                        style={input} />
                                </div>
                                <div>
                                    <label style={label}>Jam Pulang <span style={{ fontWeight: 400 }}>(opsional)</span></label>
                                    <input type="time" value={form.jam_keluar} onChange={e => setField("jam_keluar", e.target.value)}
                                        style={input} />
                                </div>
                            </div>

                            {/* Lembur */}
                            <div>
                                <label style={label}>🌙 Hari Lembur</label>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {LEMBUR_OPTIONS.map(o => (
                                        <button key={o.value} onClick={() => setField("overtime_hours", o.value)}
                                            style={{
                                                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                                                border: form.overtime_hours === o.value ? "2px solid #6366F1" : "1px solid #E2E8F0",
                                                background: form.overtime_hours === o.value ? "#EEF2FF" : "#fff",
                                                color: form.overtime_hours === o.value ? "#6366F1" : "#64748B",
                                            }}>
                                            {o.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label style={label}>Status Kehadiran</label>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    {STATUS_OPTIONS.map(s => (
                                        <button key={s} onClick={() => setField("status_kehadiran", s)}
                                            style={{
                                                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                                                border: form.status_kehadiran === s ? "2px solid #4F46E5" : "1px solid #E2E8F0",
                                                background: form.status_kehadiran === s ? "#EEF2FF" : "#fff",
                                                color: form.status_kehadiran === s ? "#4F46E5" : "#64748B",
                                            }}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Catatan */}
                            <div>
                                <label style={label}>Catatan <span style={{ fontWeight: 400 }}>(opsional)</span></label>
                                <textarea value={form.catatan} onChange={e => setField("catatan", e.target.value)}
                                    rows={2} placeholder="Tambahkan catatan..."
                                    style={{ ...input, resize: "vertical", fontFamily: "inherit" }} />
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 24px", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderRadius: "0 0 16px 16px" }}>
                            <button onClick={() => setModal(null)}
                                style={{ ...btn("#fff", "#64748B"), border: "1px solid #E2E8F0" }}>
                                Batal
                            </button>
                            <button onClick={handleSave} disabled={saving}
                                style={{ ...btn(saving ? "#A5B4FC" : "#4F46E5"), minWidth: 110, opacity: saving ? 0.8 : 1 }}>
                                {saving ? "Menyimpan..." : modal === "add" ? "Tambah Absen" : "Simpan Perubahan"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
