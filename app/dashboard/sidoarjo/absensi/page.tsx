"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type Employee = { id: number; nama: string; jabatan: string | null; divisi: string | null; attendance_token: string | null };
type Attendance = { id: number; karyawan_id: number; nama_karyawan: string; tanggal: string; jam_masuk: string; jam_keluar: string; is_telat: boolean; selisih_menit: number; total_jam_kerja: string; overtime_hours: number };
type Tab = "harian" | "mingguan" | "bulanan" | "link";
const UNIT = "toto_sidoarjo";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => iso(new Date());
const toDate = (value: string) => new Date(`${value}T00:00:00`);
const shortDate = (value: string) => `${Number(value.slice(8, 10))}/${value.slice(5, 7)}`;
function weekRange(anchor: string) { const first = toDate(anchor); first.setDate(first.getDate() - (first.getDay() === 0 ? 6 : first.getDay() - 1)); const end = new Date(first); end.setDate(end.getDate() + 6); return { start: iso(first), end: iso(end), days: Array.from({ length: 7 }, (_, index) => { const value = new Date(first); value.setDate(value.getDate() + index); return iso(value); }) }; }
function monthRange(value: string) { const [year, month] = value.split("-").map(Number); return { start: `${value}-01`, end: `${value}-${pad(new Date(year, month, 0).getDate())}` }; }

export default function SidoarjoAbsensiPage() {
    const [tab, setTab] = useState<Tab>("harian");
    const [date, setDate] = useState(today());
    const [weekAnchor, setWeekAnchor] = useState(today());
    const [month, setMonth] = useState(today().slice(0, 7));
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const base = typeof window === "undefined" ? "" : window.location.origin;
    const range = useMemo(() => tab === "harian" ? { start: date, end: date } : tab === "mingguan" ? weekRange(weekAnchor) : monthRange(month), [tab, date, weekAnchor, month]);
    const week = useMemo(() => weekRange(weekAnchor), [weekAnchor]);
    const load = useCallback(async () => {
        setLoading(true); setError("");
        const [{ data: emps, error: employeeError }, { data: rows, error: attendanceError }] = await Promise.all([
            supabase.from("karyawan").select("id,nama,jabatan,divisi,attendance_token").eq("operating_unit", UNIT).order("nama"),
            supabase.from("absensi").select("id,karyawan_id,nama_karyawan,tanggal,jam_masuk,jam_keluar,is_telat,selisih_menit,total_jam_kerja,overtime_hours").eq("operating_unit", UNIT).gte("tanggal", range.start).lte("tanggal", range.end).order("tanggal"),
        ]);
        if (employeeError || attendanceError) setError(employeeError?.message || attendanceError?.message || "Gagal memuat absensi.");
        else { setEmployees((emps ?? []) as Employee[]); setAttendance((rows ?? []) as Attendance[]); }
        setLoading(false);
    }, [range.end, range.start]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { void load(); }, [load]);
    useEffect(() => { const channel = supabase.channel("sidoarjo-attendance-recap").on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => { void load(); }).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load]);
    const byEmployee = useMemo(() => new Map(attendance.map((row) => [row.karyawan_id, row])), [attendance]);
    const weeklyRows = useMemo(() => employees.map((employee) => { const cells = week.days.map((day) => attendance.find((row) => row.karyawan_id === employee.id && row.tanggal === day)); return { employee, cells, hadir: cells.filter(Boolean).length, complete: cells.filter((row) => row?.jam_keluar).length, late: cells.filter((row) => row?.is_telat).length, overtime: cells.reduce((total, row) => total + Number(row?.overtime_hours || 0), 0) }; }), [attendance, employees, week.days]);
    const monthlyRows = useMemo(() => employees.map((employee) => { const rows = attendance.filter((row) => row.karyawan_id === employee.id); return { employee, hadir: rows.length, complete: rows.filter((row) => row.jam_keluar).length, late: rows.filter((row) => row.is_telat).length, overtime: rows.reduce((total, row) => total + Number(row.overtime_hours || 0), 0) }; }), [attendance, employees]);
    const copy = async (value: string) => { await navigator.clipboard.writeText(value); alert("Link absensi tersalin."); };
    const active = (key: Tab): React.CSSProperties => ({ ...tabButton, ...(tab === key ? tabButtonActive : {}) });
    return <div className="page-content" style={{ maxWidth: 1440, paddingTop: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}><div><div style={eyebrow}>SDM · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Absensi Karyawan</h1><p className="page-subtitle">Rekap selfie masuk dan pulang cabang. Data tersimpan terpisah dari Toto Pusat dan menjadi dasar gaji cabang.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}><button onClick={() => setTab("harian")} style={active("harian")}>📊 Harian</button><button onClick={() => setTab("mingguan")} style={active("mingguan")}>📅 Mingguan</button><button onClick={() => setTab("bulanan")} style={active("bulanan")}>🗓️ Bulanan</button><button onClick={() => setTab("link")} style={active("link")}>🔗 Link Absen</button></div>
        {tab !== "link" && <div style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>{tab === "harian" && <label style={label}>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={input} /></label>}{tab === "mingguan" && <label style={label}>Pilih salah satu tanggal minggu<input type="date" value={weekAnchor} onChange={(event) => setWeekAnchor(event.target.value)} style={input} /></label>}{tab === "bulanan" && <label style={label}>Bulan<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={input} /></label>}</div>}
        {error && <div style={{ ...panel, color: "#B91C1C", marginBottom: 16 }}>Gagal memuat: {error}</div>}
        {tab !== "link" && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}><Card label="Karyawan aktif" value={employees.length} /><Card label="Hadir" value={attendance.length} /><Card label="Sudah pulang" value={attendance.filter((row) => row.jam_keluar).length} /><Card label="Telat" value={attendance.filter((row) => row.is_telat).length} /><Card label="Lembur" value={`${attendance.reduce((total, row) => total + Number(row.overtime_hours || 0), 0)} jam`} /></div>}
        {tab === "harian" && <div style={panel}><h2 style={heading}>Rekap harian</h2>{loading ? <p>Memuat…</p> : <table style={table}><thead><tr>{["Karyawan", "Masuk", "Pulang", "Total kerja", "Lembur", "Status"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{employees.map((employee) => { const row = byEmployee.get(employee.id); return <tr key={employee.id}><td style={td}><b>{employee.nama}</b><div style={role}>{employee.jabatan || employee.divisi || "—"}</div></td><td style={td}>{row?.jam_masuk || "—"}</td><td style={td}>{row?.jam_keluar || "—"}</td><td style={td}>{row?.total_jam_kerja || "—"}</td><td style={td}>{row?.overtime_hours ? `${row.overtime_hours} jam` : "—"}</td><td style={td}>{!row ? <Badge label="Belum absen" color="#A16207" bg="#FEF3C7" /> : row.jam_keluar ? <Badge label="Lengkap" color="#15803D" bg="#DCFCE7" /> : <Badge label={row.is_telat ? `Telat ${row.selisih_menit}m` : "Sudah masuk"} color={row.is_telat ? "#DC2626" : "#6B4423"} bg={row.is_telat ? "#FEE2E2" : "#FDF3E7"} />}</td></tr>; })}</tbody></table>}</div>}
        {tab === "mingguan" && <div style={panel}><h2 style={heading}>Rekap mingguan</h2>{loading ? <p>Memuat…</p> : <div style={{ overflowX: "auto" }}><table style={table}><thead><tr><th style={th}>Karyawan</th>{week.days.map((day) => <th key={day} style={th}>{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][toDate(day).getDay()]}<br />{shortDate(day)}</th>)}<th style={th}>Hadir</th><th style={th}>Pulang</th><th style={th}>Telat</th><th style={th}>Lembur</th></tr></thead><tbody>{weeklyRows.map((row) => <tr key={row.employee.id}><td style={td}><b>{row.employee.nama}</b><div style={role}>{row.employee.jabatan || row.employee.divisi}</div></td>{row.cells.map((cell, index) => <td key={week.days[index]} style={{ ...td, textAlign: "center" }}>{!cell ? "—" : `${cell.is_telat ? "⚠️" : "✓"}${cell.overtime_hours ? " ⏱" : ""}`}</td>)}<td style={td}>{row.hadir}</td><td style={td}>{row.complete}</td><td style={td}>{row.late || "—"}</td><td style={td}>{row.overtime ? `${row.overtime} jam` : "—"}</td></tr>)}</tbody></table></div>}</div>}
        {tab === "bulanan" && <div style={panel}><h2 style={heading}>Rekap bulanan</h2>{loading ? <p>Memuat…</p> : <table style={table}><thead><tr>{["Karyawan", "Jabatan / Divisi", "Hadir", "Sudah pulang", "Telat", "Total lembur"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{monthlyRows.map((row) => <tr key={row.employee.id}><td style={{ ...td, fontWeight: 700 }}>{row.employee.nama}</td><td style={td}>{row.employee.jabatan || row.employee.divisi || "—"}</td><td style={td}>{row.hadir}</td><td style={td}>{row.complete}</td><td style={td}>{row.late || "—"}</td><td style={td}>{row.overtime ? `${row.overtime} jam` : "—"}</td></tr>)}</tbody></table>}</div>}
        {tab === "link" && <div style={panel}><h2 style={heading}>Link selfie per karyawan</h2><p style={help}>Bagikan tautan pribadi ini kepada masing-masing karyawan Sidoarjo. Tautan memakai token acak, bukan nomor urut karyawan.</p>{employees.length === 0 ? <p style={help}>Tambahkan karyawan cabang terlebih dahulu agar link absensi dibuat otomatis.</p> : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>{employees.map((employee) => { const link = employee.attendance_token ? `${base}/sidoarjo-absen/${employee.attendance_token}` : ""; return <div key={employee.id} style={{ border: "1px solid #E8DCCF", borderRadius: 10, padding: 12 }}><b style={{ fontSize: 13 }}>{employee.nama}</b><div style={role}>{employee.jabatan || employee.divisi || "Karyawan Toto Sidoarjo"}</div><button disabled={!link} onClick={() => void copy(link)} style={{ ...primary, marginTop: 10, opacity: link ? 1 : .5 }}>{link ? "🔗 Salin link absensi" : "Menyiapkan link…"}</button></div>; })}</div>}</div>}
    </div>;
}
function Card({ label, value }: { label: string; value: string | number }) { return <div style={{ ...panel, margin: 0, minWidth: 150, padding: 14 }}><div style={{ fontSize: 11, color: "#7B6656", textTransform: "uppercase", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 24, color: "#6B4423", fontWeight: 800 }}>{value}</div></div>; }
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) { return <span style={{ color, background: bg, padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{label}</span>; }
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#A67B5B", marginBottom: 7 };
const panel: React.CSSProperties = { background: "white", border: "1px solid #E8DCCF", borderRadius: 12, padding: 18 };
const heading: React.CSSProperties = { margin: "0 0 8px", fontSize: 15, color: "#3C2F2F" };
const help: React.CSSProperties = { margin: "0 0 12px", color: "#7B6656", fontSize: 12 };
const label: React.CSSProperties = { display: "grid", gap: 4, fontSize: 11, fontWeight: 700, color: "#7B6656", textTransform: "uppercase" };
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid #E8DCCF", borderRadius: 7, color: "#3C2F2F", background: "white" };
const primary: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "#8B5E3C", border: 0, color: "white", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const secondary: React.CSSProperties = { padding: "7px 10px", background: "white", color: "#6B4423", border: "1px solid #E8DCCF", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const tabButton: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "#F5EDE4", color: "#7B6656", fontWeight: 700, cursor: "pointer" };
const tabButtonActive: React.CSSProperties = { background: "#8B5E3C", color: "white" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", background: "#F5EDE4", color: "#7B6656", fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid #F4E8DD", color: "#3C2F2F", verticalAlign: "top" };
const role: React.CSSProperties = { fontSize: 10, color: "#7B6656", marginTop: 3 };
