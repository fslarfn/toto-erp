"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type Employee = { id: string; name: string; role: string | null; division: string | null; attendance_token: string; active: boolean };
type Attendance = { id: number; alu_employee_id: string; nama_karyawan: string; tanggal: string; jam_masuk: string; jam_keluar: string; is_telat: boolean; selisih_menit: number; total_jam_kerja: string; overtime_hours: number };
type Tab = "harian" | "mingguan" | "bulanan" | "link";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const today = () => iso(new Date());
const toDate = (value: string) => new Date(`${value}T00:00:00`);
const shortDate = (value: string) => `${Number(value.slice(8, 10))}/${value.slice(5, 7)}`;
const monthLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(`${value}-01T00:00:00`));

function weekRange(anchor: string) {
  const value = toDate(anchor);
  const day = value.getDay();
  value.setDate(value.getDate() - (day === 0 ? 6 : day - 1));
  const start = iso(value);
  const end = new Date(value);
  end.setDate(end.getDate() + 6);
  return { start, end: iso(end), days: Array.from({ length: 7 }, (_, index) => { const date = new Date(value); date.setDate(date.getDate() + index); return iso(date); }) };
}

function monthRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  return { start: `${value}-01`, end: `${value}-${pad(new Date(year, month, 0).getDate())}` };
}

export default function AlucurvAbsensiPage() {
  const [tab, setTab] = useState<Tab>("harian");
  const [date, setDate] = useState(today());
  const [weekAnchor, setWeekAnchor] = useState(today());
  const [month, setMonth] = useState(today().slice(0, 7));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const range = useMemo(() => tab === "harian" ? { start: date, end: date } : tab === "mingguan" ? weekRange(weekAnchor) : monthRange(month), [tab, date, weekAnchor, month]);
  const week = useMemo(() => weekRange(weekAnchor), [weekAnchor]);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: emps, error: employeeError }, { data: rows, error: attendanceError }] = await Promise.all([
      supabase.from("alu_employees").select("id,name,role,division,attendance_token,active").eq("active", true).order("name"),
      supabase.from("absensi").select("id,alu_employee_id,nama_karyawan,tanggal,jam_masuk,jam_keluar,is_telat,selisih_menit,total_jam_kerja,overtime_hours").eq("workspace", "alucurv").gte("tanggal", range.start).lte("tanggal", range.end).order("tanggal", { ascending: true }),
    ]);
    if (!employeeError) setEmployees((emps ?? []) as Employee[]);
    if (!attendanceError) setAttendance((rows ?? []) as Attendance[]);
    setLoading(false);
  }, [range.end, range.start]);

  // The selected date/period is an external query input; refresh after it changes.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const channel = supabase.channel("alucurv-attendance-recap")
      .on("postgres_changes", { event: "*", schema: "public", table: "absensi" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const byEmployee = useMemo(() => new Map(attendance.map((row) => [row.alu_employee_id, row])), [attendance]);
  const totalLate = attendance.filter((row) => row.is_telat).length;
  const totalDone = attendance.filter((row) => row.jam_keluar).length;
  const totalOvertime = attendance.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0);
  const weeklyRows = useMemo(() => employees.map((employee) => {
    const cells = week.days.map((day) => attendance.find((row) => row.alu_employee_id === employee.id && row.tanggal === day));
    return { employee, cells, hadir: cells.filter(Boolean).length, complete: cells.filter((row) => row?.jam_keluar).length, late: cells.filter((row) => row?.is_telat).length, overtime: cells.reduce((sum, row) => sum + Number(row?.overtime_hours || 0), 0) };
  }), [attendance, employees, week.days]);
  const monthlyRows = useMemo(() => employees.map((employee) => {
    const rows = attendance.filter((row) => row.alu_employee_id === employee.id);
    return { employee, hadir: rows.length, complete: rows.filter((row) => row.jam_keluar).length, late: rows.filter((row) => row.is_telat).length, overtime: rows.reduce((sum, row) => sum + Number(row.overtime_hours || 0), 0) };
  }), [attendance, employees]);
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); alert("Link absensi tersalin."); };
  const tabs: { key: Tab; label: string }[] = [{ key: "harian", label: "📊 Harian" }, { key: "mingguan", label: "📅 Mingguan" }, { key: "bulanan", label: "🗓️ Bulanan" }, { key: "link", label: "🔗 Link Absen" }];

  return <div style={{ padding: 24, maxWidth: 1440, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
      <div><h1 style={{ margin: 0, color: "var(--text-dark)", fontSize: 23 }}>📋 Absensi Alucurv</h1><p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-med)" }}>Rekap kehadiran dan lembur Alucurv. Data terpisah dari Toto, namun memakai jalur penyimpanan absensi yang sama.</p></div>
      <button onClick={load} style={secondary}>↻ Muat ulang</button>
    </div>
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} style={{ ...tabButton, ...(tab === item.key ? tabButtonActive : {}) }}>{item.label}</button>)}</div>

    {tab !== "link" && <><div style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}>
      {tab === "harian" && <label style={label}>Tanggal<input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={input} /></label>}
      {tab === "mingguan" && <label style={label}>Pilih salah satu tanggal minggu<input type="date" value={weekAnchor} onChange={(event) => setWeekAnchor(event.target.value)} style={input} /></label>}
      {tab === "bulanan" && <label style={label}>Bulan<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={input} /></label>}
      <span style={{ fontSize: 12, color: "var(--text-med)", paddingBottom: 9 }}>{tab === "mingguan" ? `${shortDate(week.start)} – ${shortDate(week.end)}` : tab === "bulanan" ? monthLabel(month) : ""}</span>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12, marginBottom: 16 }}>
      <Card label="Karyawan aktif" value={employees.length} /><Card label="Hadir" value={attendance.length} /><Card label="Sudah pulang" value={totalDone} /><Card label="Telat" value={totalLate} /><Card label="Lembur" value={`${totalOvertime} jam`} />
    </div></>}

    {tab === "harian" && <div style={panel}><h2 style={heading}>Rekap harian</h2><AttendanceTable employees={employees} rows={byEmployee} loading={loading} /></div>}
    {tab === "mingguan" && <div style={panel}><h2 style={heading}>Rekap mingguan</h2><p style={help}>✓ hadir · ⏱ lembur · ⚠️ telat. Rekap ini menjadi dasar hitungan gaji mingguan di menu Karyawan.</p>{loading ? <p>Memuat…</p> : <div style={{ overflowX: "auto" }}><table style={table}><thead><tr><th style={th}>Karyawan</th>{week.days.map((day) => <th key={day} style={th}>{["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][toDate(day).getDay()]}<br />{shortDate(day)}</th>)}<th style={th}>Hadir</th><th style={th}>Pulang</th><th style={th}>Telat</th><th style={th}>Lembur</th></tr></thead><tbody>{weeklyRows.map((row) => <tr key={row.employee.id}><td style={td}><b>{row.employee.name}</b><div style={role}>{row.employee.role || row.employee.division}</div></td>{row.cells.map((cell, index) => <td key={week.days[index]} style={{ ...td, textAlign: "center" }}>{!cell ? <span style={{ color: "#CBD5E1" }}>—</span> : <span title={`${cell.jam_masuk}${cell.jam_keluar ? ` – ${cell.jam_keluar}` : ""}`}>{cell.is_telat ? "⚠️" : "✓"}{cell.overtime_hours ? " ⏱" : ""}</span>}</td>)}<td style={td}>{row.hadir}</td><td style={td}>{row.complete}</td><td style={{ ...td, color: row.late ? "#DC2626" : undefined }}>{row.late || "—"}</td><td style={td}>{row.overtime ? `${row.overtime} jam` : "—"}</td></tr>)}</tbody></table></div>}</div>}
    {tab === "bulanan" && <div style={panel}><h2 style={heading}>Rekap bulanan — {monthLabel(month)}</h2><p style={help}>Jumlah hadir, pulang, telat, dan lembur pada bulan yang dipilih. Digunakan ketika gaji periode bulanan dibuat.</p>{loading ? <p>Memuat…</p> : <div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Karyawan", "Jabatan / Divisi", "Hadir", "Sudah pulang", "Telat", "Total lembur"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{monthlyRows.map((row) => <tr key={row.employee.id}><td style={{ ...td, fontWeight: 700 }}>{row.employee.name}</td><td style={td}>{row.employee.role || row.employee.division || "—"}</td><td style={td}>{row.hadir}</td><td style={td}>{row.complete}</td><td style={{ ...td, color: row.late ? "#DC2626" : undefined }}>{row.late || "—"}</td><td style={td}>{row.overtime ? `${row.overtime} jam` : "—"}</td></tr>)}</tbody></table></div>}</div>}
    {tab === "link" && <div style={panel}><h2 style={heading}>Link selfie per karyawan</h2><p style={help}>Bagikan link pribadi ini kepada masing-masing karyawan untuk absen masuk dan pulang dengan selfie.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>{employees.map((employee) => { const link = `${base}/alucurv-absen/${employee.attendance_token}`; return <div key={employee.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}><b style={{ fontSize: 13 }}>{employee.name}</b><div style={role}>{employee.role || employee.division || "Karyawan"}</div><button onClick={() => copy(link)} style={{ ...primary, marginTop: 10 }}>🔗 Salin link absensi</button></div>; })}</div></div>}
  </div>;
}

function AttendanceTable({ employees, rows, loading }: { employees: Employee[]; rows: Map<string, Attendance>; loading: boolean }) { return loading ? <p>Memuat…</p> : <div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Karyawan", "Masuk", "Pulang", "Total kerja", "Lembur", "Status"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{employees.map((employee) => { const row = rows.get(employee.id); return <tr key={employee.id}><td style={td}><b>{employee.name}</b><div style={role}>{employee.role || employee.division}</div></td><td style={td}>{row?.jam_masuk || "—"}</td><td style={td}>{row?.jam_keluar || "—"}</td><td style={td}>{row?.total_jam_kerja || "—"}</td><td style={td}>{row?.overtime_hours ? `${row.overtime_hours} jam` : "—"}</td><td style={td}>{!row ? <Badge label="Belum absen" color="#a16207" bg="#fef9c3" /> : row.jam_keluar ? <Badge label="Lengkap" color="#15803d" bg="#dcfce7" /> : <Badge label={row.is_telat ? `Telat ${row.selisih_menit}m` : "Sudah masuk"} color={row.is_telat ? "#dc2626" : "#0f766e"} bg={row.is_telat ? "#fee2e2" : "#ccfbf1"} />}</td></tr>; })}</tbody></table></div>; }
function Card({ label, value }: { label: string; value: number | string }) { return <div style={{ ...panel, margin: 0, minWidth: 150, padding: 14 }}><div style={{ fontSize: 11, color: "var(--text-med)", textTransform: "uppercase", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 24, color: "var(--primary-dark)", fontWeight: 800 }}>{value}</div></div>; }
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) { return <span style={{ color, background: bg, padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{label}</span>; }
const panel: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 18 };
const heading: React.CSSProperties = { margin: "0 0 8px", fontSize: 15, color: "var(--text-dark)" };
const help: React.CSSProperties = { margin: "0 0 12px", color: "var(--text-med)", fontSize: 12 };
const label: React.CSSProperties = { display: "grid", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase" };
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-dark)", background: "white" };
const primary: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--primary)", border: 0, color: "white", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const secondary: React.CSSProperties = { padding: "7px 10px", background: "white", color: "var(--primary-dark)", border: "1px solid var(--border)", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const tabButton: React.CSSProperties = { border: 0, borderRadius: 8, padding: "10px 14px", background: "var(--bg-secondary)", color: "var(--text-med)", fontWeight: 700, cursor: "pointer" };
const tabButtonActive: React.CSSProperties = { background: "var(--primary)", color: "white" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", background: "var(--bg-secondary)", color: "var(--text-med)", fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-light)", color: "var(--text-dark)", verticalAlign: "top" };
const role: React.CSSProperties = { fontSize: 10, color: "var(--text-med)", marginTop: 3 };
