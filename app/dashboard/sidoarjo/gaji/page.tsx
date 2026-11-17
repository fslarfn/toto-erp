"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const pad = (n: number) => String(n).padStart(2, "0");
const firstOfMonth = () => { const now = new Date(); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`; };
const lastOfMonth = () => { const now = new Date(); return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`; };
const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
const digits = (value: string) => value.replace(/\D/g, "");

type Employee = { id: number; nama: string; jabatan: string; divisi: string; gaji_pokok: number; gaji_harian: number; bpjs_tk: number; bpjs_kes: number };
type Attendance = { karyawan_id: number; tanggal: string; overtime_hours: number };
type Salary = { id: number; karyawan_id: number; periode_mulai: string; periode_selesai: string; gaji_pokok: number; hari_kerja: number; hari_lembur: number; lembur: number; tunjangan: number; kasbon_potong: number; potongan_lain: number; bpjs_tk: number; bpjs_kes: number; catatan: string };

export default function SidoarjoGajiPage() {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [attendance, setAttendance] = useState<Attendance[]>([]);
    const [history, setHistory] = useState<Salary[]>([]);
    const [employeeId, setEmployeeId] = useState("");
    const [start, setStart] = useState(firstOfMonth());
    const [end, setEnd] = useState(lastOfMonth());
    const [allowance, setAllowance] = useState("0");
    const [kasbon, setKasbon] = useState("0");
    const [otherDeduction, setOtherDeduction] = useState("0");
    const [note, setNote] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: employeeRows, error: employeeError }, { data: salaryRows, error: salaryError }] = await Promise.all([
            supabase.from("karyawan").select("id,nama,jabatan,divisi,gaji_pokok,gaji_harian,bpjs_tk,bpjs_kes").eq("operating_unit", UNIT).order("nama"),
            supabase.from("gaji").select("id,karyawan_id,periode_mulai,periode_selesai,gaji_pokok,hari_kerja,hari_lembur,lembur,tunjangan,kasbon_potong,potongan_lain,bpjs_tk,bpjs_kes,catatan").eq("operating_unit", UNIT).order("id", { ascending: false }).limit(100),
        ]);
        if (employeeError || salaryError) setMessage({ ok: false, text: employeeError?.message || salaryError?.message || "Gagal memuat data gaji." });
        else { setEmployees((employeeRows ?? []) as Employee[]); setHistory((salaryRows ?? []) as Salary[]); }
        setLoading(false);
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
    useEffect(() => {
        if (!employeeId) { const timer = window.setTimeout(() => setAttendance([]), 0); return () => window.clearTimeout(timer); }
        const run = async () => {
            const { data, error } = await supabase.from("absensi").select("karyawan_id,tanggal,overtime_hours").eq("operating_unit", UNIT).eq("karyawan_id", Number(employeeId)).gte("tanggal", start).lte("tanggal", end);
            if (error) setMessage({ ok: false, text: `Gagal membaca absensi: ${error.message}` }); else setAttendance((data ?? []) as Attendance[]);
        };
        void run();
    }, [employeeId, start, end]);
    const employee = employees.find((item) => item.id === Number(employeeId));
    const calculation = useMemo(() => {
        const workDays = new Set(attendance.map((row) => row.tanggal)).size;
        const overtimeDays = attendance.filter((row) => Number(row.overtime_hours || 0) > 0).length;
        const base = !employee ? 0 : Number(employee.gaji_pokok || 0) > 0 ? Number(employee.gaji_pokok) : Number(employee.gaji_harian || 0) * workDays;
        const overtime = !employee ? 0 : Number(employee.gaji_harian || 0) * overtimeDays;
        const deductions = Number(kasbon || 0) + Number(otherDeduction || 0) + Number(employee?.bpjs_tk || 0) + Number(employee?.bpjs_kes || 0);
        return { workDays, overtimeDays, base, overtime, deductions, takeHome: base + overtime + Number(allowance || 0) - deductions };
    }, [allowance, attendance, employee, kasbon, otherDeduction]);
    const save = async () => {
        if (!employee) { setMessage({ ok: false, text: "Pilih karyawan terlebih dahulu." }); return; }
        setSaving(true); setMessage(null);
        const { error } = await supabase.from("gaji").insert({
            karyawan_id: employee.id, periode: `${start} s.d. ${end}`, periode_mulai: start, periode_selesai: end, tanggal_gajian: end,
            gaji_pokok: calculation.base, hari_kerja: Number(employee.gaji_pokok || 0) > 0 ? 0 : calculation.workDays,
            hari_lembur: calculation.overtimeDays, lembur: calculation.overtime, tunjangan: Number(allowance || 0),
            kasbon_potong: Number(kasbon || 0), potongan_lain: Number(otherDeduction || 0),
            bpjs_tk: Number(employee.bpjs_tk || 0), bpjs_kes: Number(employee.bpjs_kes || 0), catatan: note.trim(), sumber_hitung: "Absensi Toto Sidoarjo", operating_unit: UNIT,
        });
        setSaving(false);
        if (error) { setMessage({ ok: false, text: `Gagal menyimpan gaji: ${error.message}` }); return; }
        setMessage({ ok: true, text: "Perhitungan gaji Sidoarjo tersimpan. Pencatatan pembayaran tetap dilakukan manual di Keuangan cabang." });
        setAllowance("0"); setKasbon("0"); setOtherDeduction("0"); setNote(""); await load();
    };
    const employeeName = (id: number) => employees.find((item) => item.id === id)?.nama || "Karyawan";
    return <div className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>SDM · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Gaji & Slip Cabang</h1><p className="page-subtitle">Absensi selfie menjadi dasar hari kerja dan lembur. Karyawan bergaji pokok tetap tidak dihitung berdasarkan hari kerja.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        <section style={{ ...panel, display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(300px,.8fr)", gap: 18 }}>
            <div><strong style={{ color: "#3C2F2F" }}>Hitung gaji dari absensi</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 14 }}>
                <Field label="Karyawan"><select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} style={input}><option value="">Pilih karyawan…</option>{employees.map((item) => <option key={item.id} value={item.id}>{item.nama}</option>)}</select></Field>
                <Field label="Periode mulai"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={input} /></Field><Field label="Periode selesai"><input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={input} /></Field>
                <Field label="Tunjangan"><input inputMode="numeric" value={allowance} onChange={(e) => setAllowance(digits(e.target.value))} style={input} /></Field><Field label="Potongan kasbon"><input inputMode="numeric" value={kasbon} onChange={(e) => setKasbon(digits(e.target.value))} style={input} /></Field><Field label="Potongan lain"><input inputMode="numeric" value={otherDeduction} onChange={(e) => setOtherDeduction(digits(e.target.value))} style={input} /></Field>
            </div><Field label="Catatan"><input value={note} onChange={(e) => setNote(e.target.value)} style={{ ...input, width: "100%", marginTop: 5, boxSizing: "border-box" }} placeholder="Opsional" /></Field><div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><button onClick={() => void save()} disabled={saving || !employee} style={primary}>{saving ? "Menyimpan…" : "💾 Simpan gaji periode ini"}</button>{message && <span style={{ fontSize: 12, fontWeight: 700, color: message.ok ? "#15803D" : "#B91C1C" }}>{message.text}</span>}</div></div>
            <div style={{ border: "1px solid #E8DCCF", borderRadius: 10, background: "#FFFCF7", padding: 16 }}><div style={eyebrow}>HASIL PERHITUNGAN</div><Line label={employee && Number(employee.gaji_pokok || 0) > 0 ? "Gaji pokok tetap" : `Gaji harian × ${calculation.workDays} hari`} value={calculation.base} /><Line label={`Lembur × ${calculation.overtimeDays} hari`} value={calculation.overtime} /><Line label="Tunjangan" value={Number(allowance || 0)} /><hr style={{ border: 0, borderTop: "1px solid #E8DCCF", margin: "12px 0" }} /><Line label="BPJS TK & Kes" value={Number(employee?.bpjs_tk || 0) + Number(employee?.bpjs_kes || 0)} negative /><Line label="Kasbon & potongan lain" value={Number(kasbon || 0) + Number(otherDeduction || 0)} negative /><div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 14, background: "#8B5E3C", color: "white", padding: "12px", borderRadius: 8, fontWeight: 800 }}><span>TAKE HOME PAY</span><span>{money(calculation.takeHome)}</span></div></div>
        </section>
        <section style={{ ...panel, marginTop: 18, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, fontWeight: 800, color: "#3C2F2F" }}>Riwayat gaji Sidoarjo</div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Periode", "Karyawan", "Gaji", "Lembur", "Potongan", "Take home"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={6} style={emptyCell}>Memuat riwayat…</td></tr> : history.length === 0 ? <tr><td colSpan={6} style={emptyCell}>Belum ada gaji yang tersimpan.</td></tr> : history.map((row) => { const takeHome = Number(row.gaji_pokok) + Number(row.lembur) + Number(row.tunjangan) - Number(row.kasbon_potong) - Number(row.potongan_lain) - Number(row.bpjs_tk) - Number(row.bpjs_kes); return <tr key={row.id}><td style={td}>{row.periode_mulai} s.d. {row.periode_selesai}</td><td style={{ ...td, fontWeight: 800 }}>{employeeName(row.karyawan_id)}</td><td style={td}>{money(Number(row.gaji_pokok))}</td><td style={td}>{money(Number(row.lembur))}</td><td style={td}>{money(Number(row.kasbon_potong) + Number(row.potongan_lain) + Number(row.bpjs_tk) + Number(row.bpjs_kes))}</td><td style={{ ...td, fontWeight: 800, color: "#15803D" }}>{money(takeHome)}</td></tr>; })}</tbody></table></div></section>
    </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#6B574B", fontWeight: 800, textTransform: "uppercase" }}>{label}{children}</label>; }
function Line({ label, value, negative = false }: { label: string; value: number; negative?: boolean }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginTop: 9, fontSize: 13, color: negative ? "#B91C1C" : "#514036" }}><span>{label}</span><b>{negative ? `(${money(value)})` : money(value)}</b></div>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontWeight: 800, letterSpacing: ".08em", fontSize: 11, marginBottom: 7 };
const panel: React.CSSProperties = { border: "1px solid #E8DCCF", background: "#FFFDF9", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white", fontSize: 13 };
const primary: React.CSSProperties = { minHeight: 38, padding: "0 15px", border: 0, borderRadius: 7, background: "#8B5E3C", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#F4EBDD", color: "#6B4423", fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyCell: React.CSSProperties = { ...td, textAlign: "center", padding: "30px 12px", color: "#927C6D" };
