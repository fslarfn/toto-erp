"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

type Employee = { id: string; name: string; role: string | null; division: string | null; attendance_token: string; active: boolean };
type Attendance = { id: number; alu_employee_id: string; nama_karyawan: string; tanggal: string; jam_masuk: string; jam_keluar: string; is_telat: boolean; selisih_menit: number; total_jam_kerja: string; overtime_hours: number };
const today = () => new Date().toISOString().slice(0, 10);

export default function AlucurvAbsensiPage() {
  const [date, setDate] = useState(today());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: emps }, { data: rows }] = await Promise.all([
      supabase.from("alu_employees").select("id,name,role,division,attendance_token,active").eq("active", true).order("name"),
      supabase.from("absensi").select("id,alu_employee_id,nama_karyawan,tanggal,jam_masuk,jam_keluar,is_telat,selisih_menit,total_jam_kerja,overtime_hours").eq("workspace", "alucurv").eq("tanggal", date),
    ]);
    setEmployees((emps ?? []) as Employee[]); setAttendance((rows ?? []) as Attendance[]); setLoading(false);
  }, [date]);
  // Data diambil ulang saat tanggal rekap berubah.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  const byEmployee = useMemo(() => new Map(attendance.map((row) => [row.alu_employee_id, row])), [attendance]);
  const done = attendance.filter((row) => row.jam_keluar).length;
  const copy = async (value: string) => { await navigator.clipboard.writeText(value); alert("Link absensi tersalin."); };
  return <div style={{ padding: 24 }}>
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 18 }}><div><h1 style={{ margin: 0, color: "var(--text-dark)", fontSize: 22 }}>Absensi Alucurv</h1><p style={{ margin: "5px 0 0", fontSize: 13, color: "var(--text-med)" }}>Selfie tersimpan pada jalur absensi yang sama dengan Toto; rekap ini khusus karyawan Alucurv.</p></div><label style={{ fontSize: 12, fontWeight: 700 }}>Tanggal<br /><input type="date" value={date} onChange={(event) => setDate(event.target.value)} style={input} /></label></div>
    <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}><Card label="Karyawan aktif" value={employees.length} /><Card label="Sudah masuk" value={attendance.length} /><Card label="Sudah pulang" value={done} /></div>
    <div style={panel}><h2 style={heading}>Link selfie per karyawan</h2><p style={{ fontSize: 12, color: "var(--text-med)" }}>Bagikan link pribadi kepada karyawan. Link akan membuka kamera untuk absen masuk dan pulang.</p><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 10 }}>{employees.map((employee) => { const link = `${base}/alucurv-absen/${employee.attendance_token}`; return <div key={employee.id} style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 12 }}><b style={{ fontSize: 13 }}>{employee.name}</b><div style={{ fontSize: 11, color: "var(--text-med)", margin: "3px 0 10px" }}>{employee.role || employee.division || "Karyawan"}</div><button onClick={() => copy(link)} style={primary}>🔗 Salin link absensi</button></div>; })}</div></div>
    <div style={{ ...panel, marginTop: 16 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><h2 style={heading}>Rekap harian</h2><button onClick={load} style={secondary}>↻ Muat ulang</button></div>{loading ? <p>Memuat…</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}><thead><tr>{["Karyawan", "Masuk", "Pulang", "Total kerja", "Lembur", "Status"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{employees.map((employee) => { const row = byEmployee.get(employee.id); return <tr key={employee.id}><td style={td}><b>{employee.name}</b><div style={{ fontSize: 10, color: "var(--text-med)" }}>{employee.role || employee.division}</div></td><td style={td}>{row?.jam_masuk || "—"}</td><td style={td}>{row?.jam_keluar || "—"}</td><td style={td}>{row?.total_jam_kerja || "—"}</td><td style={td}>{row?.overtime_hours ? `${row.overtime_hours} jam` : "—"}</td><td style={td}>{!row ? <Badge label="Belum absen" color="#a16207" bg="#fef9c3" /> : row.jam_keluar ? <Badge label="Lengkap" color="#15803d" bg="#dcfce7" /> : <Badge label={row.is_telat ? `Telat ${row.selisih_menit}m` : "Sudah masuk"} color={row.is_telat ? "#dc2626" : "#0f766e"} bg={row.is_telat ? "#fee2e2" : "#ccfbf1"} />}</td></tr>; })}</tbody></table></div>}</div>
  </div>;
}
function Card({ label, value }: { label: string; value: number }) { return <div style={{ ...panel, margin: 0, minWidth: 150, padding: 14 }}><div style={{ fontSize: 11, color: "var(--text-med)", textTransform: "uppercase", fontWeight: 700 }}>{label}</div><div style={{ fontSize: 24, color: "var(--primary-dark)", fontWeight: 800 }}>{value}</div></div>; }
function Badge({ label, color, bg }: { label: string; color: string; bg: string }) { return <span style={{ color, background: bg, padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 700 }}>{label}</span>; }
const panel: React.CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 18 };
const heading: React.CSSProperties = { margin: "0 0 8px", fontSize: 15, color: "var(--text-dark)" };
const input: React.CSSProperties = { marginTop: 4, padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 7, color: "var(--text-dark)" };
const primary: React.CSSProperties = { width: "100%", padding: "8px 10px", background: "var(--primary)", border: 0, color: "white", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const secondary: React.CSSProperties = { padding: "7px 10px", background: "white", color: "var(--primary-dark)", border: "1px solid var(--border)", borderRadius: 6, fontWeight: 700, fontSize: 11, cursor: "pointer" };
const th: React.CSSProperties = { textAlign: "left", padding: "9px 10px", background: "var(--bg-secondary)", color: "var(--text-med)", fontSize: 10, textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "10px", borderTop: "1px solid var(--border-light)", color: "var(--text-dark)" };
