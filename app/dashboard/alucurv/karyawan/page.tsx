"use client";
import { useState } from "react";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import { supabase } from "@/lib/supabase-client";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

/* ================================================================
   MENU KARYAWAN ALUCURV — 3 Tab (meniru menu Karyawan Toto):
   1. Data Karyawan (CRUD, seperti sebelumnya)
   2. Gaji & Slip  (catat gaji per periode + cetak slip ala legacy Alucurv)
   3. Kasbon       (bon karyawan; potongan bon di slip otomatis
                    tercatat sebagai cicilan di alu_cashbon_payments,
                    sehingga Laporan Bulanan langsung akurat)
================================================================ */

interface AlucurvEmployee {
    id: string;
    name: string;
    role: string | null;
    division: string;
    weekly_base: number;
    active: boolean;
}
interface AluSalary {
    id: string;
    employee_id: string;
    period_start: string;
    period_end: string;
    base: number;
    overtime: number;
    meal: number;
    jht: number;
    bpjs: number;
    bon_deduction: number;
    note: string | null;
}
interface AluCashbon {
    id: string;
    date: string;
    employee_id: string;
    amount: number;
    installment: number;
    note: string | null;
}
interface AluCashbonPayment {
    id: string;
    cashbon_id: string;
    date: string;
    amount: number;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const MONTHS = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
const todayISO = () => new Date().toISOString().slice(0, 10);

function fmtDate(d: string | null | undefined) {
    if (!d) return "-";
    const p = d.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}
/** "2026-06-22".."2026-07-18" -> "22 JUNI - 18 JULI 2026" (format slip legacy Alucurv). */
function fmtPeriode(start: string, end: string) {
    const [y1, m1, d1] = start.split("-").map(Number);
    const [y2, m2, d2] = end.split("-").map(Number);
    if (!y1 || !y2) return `${start} - ${end}`;
    const left = `${d1} ${MONTHS[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ""}`;
    return `${left} - ${d2} ${MONTHS[m2 - 1]} ${y2}`;
}

/* Print: hanya area #print-root yang tercetak (pola sama dengan menu Karyawan Toto). */
const PRINT_STYLE = `
@media print {
    body * { visibility: hidden; }
    #print-root, #print-root * { visibility: visible; }
    #print-root { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background: white; z-index: 99999; }
    .no-print, .no-print * { display: none !important; }
    @page { size: A4; margin: 12mm 14mm; }
}
`;
function injectPrintStyle() {
    if (typeof document === "undefined") return;
    if (!document.getElementById("alucurv-karyawan-print-style")) {
        const s = document.createElement("style");
        s.id = "alucurv-karyawan-print-style";
        s.innerHTML = PRINT_STYLE;
        document.head.appendChild(s);
    }
}

/** Total pembayaran (manual + potongan gaji) per kasbon. */
function buildPaidMap(payments: AluCashbonPayment[]) {
    const map = new Map<string, number>();
    payments.forEach((p) => map.set(p.cashbon_id, (map.get(p.cashbon_id) ?? 0) + Number(p.amount || 0)));
    return map;
}

/* ================================================================
   TAB 2: GAJI & SLIP
================================================================ */
const EMPTY_GAJI = {
    employee_id: "", period_start: "", period_end: todayISO(),
    base: "", overtime: "", meal: "", jht: "", bpjs: "", bon_deduction: "", note: "",
};

function GajiTab({ employees, salaries, cashbons, payments }: {
    employees: ReturnType<typeof useAlucurvTable<AlucurvEmployee>>;
    salaries: ReturnType<typeof useAlucurvTable<AluSalary>>;
    cashbons: ReturnType<typeof useAlucurvTable<AluCashbon>>;
    payments: ReturnType<typeof useAlucurvTable<AluCashbonPayment>>;
}) {
    const [form, setForm] = useState({ ...EMPTY_GAJI });
    const [editId, setEditId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [slip, setSlip] = useState<AluSalary | null>(null);

    const empById = new Map(employees.rows.map((e) => [e.id, e]));
    const paidMap = buildPaidMap(payments.rows);

    /** Sisa bon seorang karyawan saat ini (amount - semua pembayaran). */
    const sisaBonOf = (empId: string, excludeSalaryId?: string) => {
        // Saat mengedit gaji, cicilan otomatis dari slip itu sendiri dikembalikan dulu
        // ke sisa bon (karena akan dialokasikan ulang saat disimpan).
        const excluded = excludeSalaryId
            ? payments.rows.filter((p) => p.id.startsWith(`salpay-${excludeSalaryId}-`))
            : [];
        const excludedPer = buildPaidMap(excluded);
        return cashbons.rows
            .filter((c) => c.employee_id === empId)
            .reduce((s, c) => s + Math.max(0, Number(c.amount || 0) - (paidMap.get(c.id) ?? 0) + (excludedPer.get(c.id) ?? 0)), 0);
    };

    const n = (v: string) => Number(v || 0);
    const pendapatan = n(form.base) + n(form.overtime) + n(form.meal);
    const potongan = n(form.jht) + n(form.bpjs) + n(form.bon_deduction);
    const takeHome = pendapatan - potongan;
    const sisaBonKaryawan = form.employee_id ? sisaBonOf(form.employee_id, editId ?? undefined) : 0;

    const pilihKaryawan = (id: string) => {
        const emp = empById.get(id);
        setForm((p) => ({ ...p, employee_id: id, base: p.base || String(emp?.weekly_base || "") }));
    };

    /** Potongan bon slip -> baris cicilan di alu_cashbon_payments (bon tertua dulu).
        Id diberi prefix salpay-<salaryId>- supaya bisa dihapus/dialokasi ulang saat
        gaji diubah/dihapus. Laporan Bulanan membaca tabel ini, jadi otomatis akurat. */
    const allocateBon = async (salaryId: string, empId: string, amount: number, date: string) => {
        await supabase.from("alu_cashbon_payments").delete().like("id", `salpay-${salaryId}-%`);
        if (amount > 0) {
            const paid = buildPaidMap(payments.rows.filter((p) => !p.id.startsWith(`salpay-${salaryId}-`)));
            const open = cashbons.rows
                .filter((c) => c.employee_id === empId)
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((c) => ({ id: c.id, sisa: Math.max(0, Number(c.amount || 0) - (paid.get(c.id) ?? 0)) }))
                .filter((c) => c.sisa > 0);
            let left = amount;
            const inserts: Record<string, unknown>[] = [];
            open.forEach((c, i) => {
                if (left <= 0) return;
                const pay = Math.min(c.sisa, left);
                left -= pay;
                inserts.push({ id: `salpay-${salaryId}-${i}`, cashbon_id: c.id, date, amount: pay });
            });
            if (inserts.length > 0) await supabase.from("alu_cashbon_payments").insert(inserts);
        }
        await payments.refresh();
    };

    const save = async () => {
        setMsg(null);
        if (!form.employee_id || !form.period_start || !form.period_end) {
            setMsg({ ok: false, text: "Pilih karyawan dan isi periode mulai + selesai dulu." });
            return;
        }
        if (form.period_end < form.period_start) {
            setMsg({ ok: false, text: "Periode selesai tidak boleh sebelum periode mulai." });
            return;
        }
        const bon = n(form.bon_deduction);
        if (bon > sisaBonKaryawan) {
            setMsg({ ok: false, text: `Potongan bon ${rupiah(bon)} melebihi sisa bon karyawan (${rupiah(sisaBonKaryawan)}).` });
            return;
        }
        setSaving(true);
        const payload = {
            employee_id: form.employee_id,
            period_start: form.period_start,
            period_end: form.period_end,
            base: n(form.base), overtime: n(form.overtime), meal: n(form.meal),
            jht: n(form.jht), bpjs: n(form.bpjs), bon_deduction: bon,
            note: form.note.trim() || null,
        };
        let err: unknown;
        let salaryId = editId;
        if (editId) {
            err = await salaries.updateRow(editId, payload);
        } else {
            salaryId = crypto.randomUUID();
            err = await salaries.insertRow({ id: salaryId, ...payload });
        }
        if (err) {
            setSaving(false);
            setMsg({ ok: false, text: `Gagal menyimpan: ${(err as { message?: string })?.message ?? String(err)}` });
            return;
        }
        await allocateBon(salaryId!, form.employee_id, bon, form.period_end);
        setSaving(false);
        setMsg({ ok: true, text: editId ? "✅ Gaji diperbarui." : "✅ Gaji tercatat. Klik 🖨️ Slip untuk mencetak." });
        setForm({ ...EMPTY_GAJI });
        setEditId(null);
    };

    const startEdit = (s: AluSalary) => {
        setEditId(s.id);
        setMsg(null);
        setForm({
            employee_id: s.employee_id, period_start: s.period_start, period_end: s.period_end,
            base: String(s.base || ""), overtime: String(s.overtime || ""), meal: String(s.meal || ""),
            jht: String(s.jht || ""), bpjs: String(s.bpjs || ""), bon_deduction: String(s.bon_deduction || ""),
            note: s.note ?? "",
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const remove = async (s: AluSalary) => {
        const emp = empById.get(s.employee_id);
        if (!confirm(`Hapus gaji ${emp?.name ?? ""} periode ${fmtDate(s.period_start)} - ${fmtDate(s.period_end)}?${s.bon_deduction > 0 ? "\nCicilan bon dari slip ini juga akan dibatalkan." : ""}`)) return;
        await supabase.from("alu_cashbon_payments").delete().like("id", `salpay-${s.id}-%`);
        await payments.refresh();
        await salaries.deleteRow(s.id);
        if (editId === s.id) { setEditId(null); setForm({ ...EMPTY_GAJI }); }
    };

    const rows = [...salaries.rows].sort((a, b) => b.period_start.localeCompare(a.period_start));
    const totalPeriodeTerakhir = rows.length > 0
        ? rows.filter((r) => r.period_end === rows[0].period_end)
            .reduce((s, r) => s + (r.base + r.overtime + r.meal - r.jht - r.bpjs - r.bon_deduction), 0)
        : 0;

    return (
        <div>
            {/* Form catat gaji */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>
                    {editId ? "✏️ Ubah Gaji" : "💰 Catat Gaji"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                    <div style={col}>
                        <label style={lbl}>Karyawan</label>
                        <select value={form.employee_id} onChange={(e) => pilihKaryawan(e.target.value)} style={inp}>
                            <option value="" disabled>Pilih…</option>
                            {employees.rows.filter((e) => e.active).map((e) => (
                                <option key={e.id} value={e.id}>{e.name}{e.role ? ` — ${e.role}` : ""}</option>
                            ))}
                        </select>
                    </div>
                    <div style={col}><label style={lbl}>Periode Mulai</label>
                        <input type="date" value={form.period_start} onChange={(e) => setForm((p) => ({ ...p, period_start: e.target.value }))} style={inp} /></div>
                    <div style={col}><label style={lbl}>Periode Selesai</label>
                        <input type="date" value={form.period_end} onChange={(e) => setForm((p) => ({ ...p, period_end: e.target.value }))} style={inp} /></div>
                    {([
                        ["base", "Gaji Pokok"], ["overtime", "Lembur"], ["meal", "Uang Makan"],
                        ["jht", "Pot. JHT"], ["bpjs", "Pot. BPJS"], ["bon_deduction", "Pot. Bon"],
                    ] as const).map(([key, label]) => (
                        <div key={key} style={col}>
                            <label style={lbl}>{label}</label>
                            <input type="number" min={0} value={form[key]} placeholder="0"
                                onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} style={{ ...inp, minWidth: 100 }} />
                        </div>
                    ))}
                    <div style={{ ...col, flex: 1, minWidth: 140 }}><label style={lbl}>Catatan</label>
                        <input type="text" value={form.note} onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} style={{ ...inp, width: "100%" }} /></div>
                </div>
                {form.employee_id && sisaBonKaryawan > 0 && (
                    <div style={{ marginTop: 8, fontSize: 11, color: "#A16207", background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 6, padding: "5px 10px", display: "inline-block" }}>
                        📋 Sisa bon {empById.get(form.employee_id)?.name}: <strong>{rupiah(sisaBonKaryawan)}</strong> — isi &quot;Pot. Bon&quot; untuk memotong dari gaji ini.
                    </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
                    <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px" }}>
                        <span style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase", marginRight: 10 }}>Take Home Pay</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "var(--text-dark)" }}>{rupiah(takeHome)}</span>
                    </div>
                    <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Menyimpan..." : editId ? "Simpan Perubahan" : "+ Simpan Gaji"}</button>
                    {editId && (
                        <button onClick={() => { setEditId(null); setForm({ ...EMPTY_GAJI }); setMsg(null); }} style={btnGhost}>Batal Edit</button>
                    )}
                    {msg && <span style={{ fontSize: 11.5, fontWeight: 600, color: msg.ok ? "#16A34A" : "#DC2626" }}>{msg.text}</span>}
                </div>
            </div>

            {/* Riwayat gaji */}
            {rows.length > 0 && (
                <div style={{ fontSize: 11, color: "var(--text-med)", marginBottom: 8 }}>
                    Total take home periode terakhir ({fmtDate(rows[0].period_end)}): <strong style={{ color: "var(--text-dark)" }}>{rupiah(totalPeriodeTerakhir)}</strong>
                </div>
            )}
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["Periode", "Karyawan", "Gaji Pokok", "Lembur", "Makan", "JHT", "BPJS", "Bon", "Take Home", ""].map((h) => (
                                <th key={h} style={th}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {salaries.loading ? (
                            <tr><td colSpan={10} style={tdEmpty}>Memuat...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={10} style={tdEmpty}>Belum ada catatan gaji. Isi form di atas untuk mencatat.</td></tr>
                        ) : rows.map((s) => {
                            const emp = empById.get(s.employee_id);
                            const th2 = s.base + s.overtime + s.meal - s.jht - s.bpjs - s.bon_deduction;
                            return (
                                <tr key={s.id}>
                                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(s.period_start)} – {fmtDate(s.period_end)}</td>
                                    <td style={{ ...td, fontWeight: 700 }}>{emp?.name ?? "-"}</td>
                                    <td style={td}>{rupiah(s.base)}</td>
                                    <td style={td}>{s.overtime > 0 ? rupiah(s.overtime) : "-"}</td>
                                    <td style={td}>{s.meal > 0 ? rupiah(s.meal) : "-"}</td>
                                    <td style={{ ...td, color: s.jht > 0 ? "#DC2626" : undefined }}>{s.jht > 0 ? rupiah(s.jht) : "-"}</td>
                                    <td style={{ ...td, color: s.bpjs > 0 ? "#DC2626" : undefined }}>{s.bpjs > 0 ? rupiah(s.bpjs) : "-"}</td>
                                    <td style={{ ...td, color: s.bon_deduction > 0 ? "#DC2626" : undefined }}>{s.bon_deduction > 0 ? rupiah(s.bon_deduction) : "-"}</td>
                                    <td style={{ ...td, fontWeight: 800 }}>{rupiah(th2)}</td>
                                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                                        <button onClick={() => setSlip(s)} style={btnSlip}>🖨️ Slip</button>
                                        <button onClick={() => startEdit(s)} style={btnLink}>Ubah</button>
                                        <button onClick={() => remove(s)} style={btnDanger}>Hapus</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {slip && (
                <SlipModal
                    salary={slip}
                    employee={empById.get(slip.employee_id)}
                    sisaBon={sisaBonOf(slip.employee_id)}
                    onClose={() => setSlip(null)}
                />
            )}
        </div>
    );
}

/* ================================================================
   SLIP GAJI — desain mengikuti slip legacy Alucurv (EMPLOYEE PAYSLIP)
================================================================ */
function SlipModal({ salary: s, employee, sisaBon, onClose }: {
    salary: AluSalary; employee?: AlucurvEmployee; sisaBon: number; onClose: () => void;
}) {
    const doPrint = () => { injectPrintStyle(); setTimeout(() => window.print(), 100); };
    const pendapatan = s.base + s.overtime + s.meal;
    const potongan = s.jht + s.bpjs + s.bon_deduction;
    const takeHome = pendapatan - potongan;

    const rowStyle: React.CSSProperties = { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 12, color: "#134E4A" };
    const line: React.CSSProperties = { borderTop: "1px solid #E5E7EB", margin: "10px 0" };

    return (
        <div style={overlay}>
            <div style={{ background: "white", width: "min(96vw,480px)", maxHeight: "95vh", overflow: "auto", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "var(--text-dark)" }}>Slip Gaji — {employee?.name ?? "-"}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={doPrint} style={btnPrimary}>🖨️ Print</button>
                        <button onClick={onClose} style={btnGhost}>✕ Tutup</button>
                    </div>
                </div>

                {/* Area cetak — EMPLOYEE PAYSLIP */}
                <div id="print-root" style={{ padding: "28px 32px", fontFamily: "Arial, sans-serif", color: "#111827" }}>
                    {/* Logo & alamat */}
                    <div style={{ textAlign: "center", marginBottom: 14 }}>
                        <div style={{ width: 46, height: 46, borderRadius: 10, background: "#14B8A6", margin: "0 auto 8px", display: "flex", alignItems: "flex-end", justifyContent: "center", paddingBottom: 9 }}>
                            <div style={{ width: 22, height: 13, borderRadius: "11px 11px 0 0", border: "3px solid white", borderBottom: "none" }} />
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: 1 }}>ALUCURV</div>
                        <div style={{ fontSize: 10, color: "#6B7280" }}>R.A Kartini, Bekasi, Jawa Barat</div>
                    </div>
                    <div style={{ background: "#1E3A5F", color: "white", textAlign: "center", fontWeight: 800, fontSize: 13, letterSpacing: 2, padding: "7px 0", marginBottom: 16 }}>
                        EMPLOYEE PAYSLIP
                    </div>

                    {/* Info karyawan */}
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, fontSize: 11.5, borderBottom: "2px solid #1E3A5F", paddingBottom: 10, marginBottom: 12 }}>
                        <div>
                            <div style={{ display: "flex", gap: 6, marginBottom: 3 }}><span style={{ color: "#6B7280", width: 50 }}>Nama</span><span style={{ fontWeight: 700 }}>: {employee?.name ?? "-"}</span></div>
                            <div style={{ display: "flex", gap: 6 }}><span style={{ color: "#6B7280", width: 50 }}>Divisi</span><span>: {employee?.division ?? "-"}</span></div>
                        </div>
                        <div>
                            <div style={{ display: "flex", gap: 6, marginBottom: 3 }}><span style={{ color: "#6B7280" }}>Status Karyawan</span><span>: {employee?.active === false ? "NONAKTIF" : "AKTIF"}{employee?.role ? ` — ${employee.role}` : ""}</span></div>
                            <div style={{ display: "flex", gap: 6 }}><span style={{ color: "#6B7280" }}>Periode</span><span style={{ fontWeight: 700 }}>: {fmtPeriode(s.period_start, s.period_end)}</span></div>
                        </div>
                    </div>

                    {/* Pendapatan */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 800, color: "#1E3A5F", marginBottom: 4 }}>
                        <span>Keterangan</span><span>Jumlah</span>
                    </div>
                    <div style={rowStyle}><span>Gaji Pokok</span><span style={{ fontWeight: 600 }}>{s.base > 0 ? rupiah(s.base) : ""}</span></div>
                    <div style={rowStyle}><span>Lembur</span><span style={{ fontWeight: 600 }}>{s.overtime > 0 ? rupiah(s.overtime) : ""}</span></div>
                    <div style={rowStyle}><span>Makan</span><span style={{ fontWeight: 600 }}>{s.meal > 0 ? rupiah(s.meal) : ""}</span></div>
                    <div style={line} />
                    <div style={{ ...rowStyle, fontWeight: 800 }}><span>Jumlah Pendapatan (+)</span><span>{rupiah(pendapatan)}</span></div>
                    <div style={line} />

                    {/* Potongan */}
                    <div style={rowStyle}><span>JHT</span><span style={{ fontWeight: 600, color: "#DC2626" }}>{s.jht > 0 ? rupiah(s.jht) : ""}</span></div>
                    <div style={rowStyle}><span>BPJS</span><span style={{ fontWeight: 600, color: "#DC2626" }}>{s.bpjs > 0 ? rupiah(s.bpjs) : ""}</span></div>
                    <div style={rowStyle}><span>BON</span><span style={{ fontWeight: 600, color: "#DC2626" }}>{s.bon_deduction > 0 ? rupiah(s.bon_deduction) : ""}</span></div>
                    <div style={{ ...rowStyle, color: "#6B7280", fontSize: 11 }}><span>SISA BON</span><span>{sisaBon > 0 ? rupiah(sisaBon) : "-"}</span></div>
                    <div style={line} />
                    <div style={{ ...rowStyle, fontWeight: 800 }}><span>Jumlah Potongan (-)</span><span>{rupiah(potongan)}</span></div>

                    {/* Take Home Pay */}
                    <div style={{ borderTop: "2px solid #1E3A5F", borderBottom: "2px solid #1E3A5F", margin: "14px 0", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 900, fontSize: 15 }}>Take Home Pay</span>
                        <span style={{ fontWeight: 900, fontSize: 17 }}>{rupiah(takeHome)}</span>
                    </div>

                    {s.note && <div style={{ fontSize: 10.5, color: "#6B7280", marginBottom: 12 }}>Catatan: {s.note}</div>}

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 30 }}>
                        <div style={{ textAlign: "center", fontSize: 11, color: "#374151" }}>
                            <div>Prepared by:</div>
                            <div style={{ height: 48 }} />
                            <div style={{ fontWeight: 700 }}>Finance</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   TAB 3: KASBON
================================================================ */
function KasbonTab({ employees, cashbons, payments }: {
    employees: ReturnType<typeof useAlucurvTable<AlucurvEmployee>>;
    cashbons: ReturnType<typeof useAlucurvTable<AluCashbon>>;
    payments: ReturnType<typeof useAlucurvTable<AluCashbonPayment>>;
}) {
    const [form, setForm] = useState({ date: todayISO(), employee_id: "", amount: "", installment: "", note: "" });
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [payFor, setPayFor] = useState<AluCashbon | null>(null);
    const [payAmount, setPayAmount] = useState("");

    const empById = new Map(employees.rows.map((e) => [e.id, e]));
    const paidMap = buildPaidMap(payments.rows);
    const sisaOf = (c: AluCashbon) => Math.max(0, Number(c.amount || 0) - (paidMap.get(c.id) ?? 0));
    const paidViaGaji = (cbId: string) =>
        payments.rows.filter((p) => p.cashbon_id === cbId && p.id.startsWith("salpay-")).reduce((s, p) => s + Number(p.amount || 0), 0);

    const rows = [...cashbons.rows].sort((a, b) => b.date.localeCompare(a.date));
    const totalKasbon = rows.reduce((s, c) => s + Number(c.amount || 0), 0);
    const totalSisa = rows.reduce((s, c) => s + sisaOf(c), 0);

    const save = async () => {
        setMsg(null);
        if (!form.employee_id || !Number(form.amount)) { setMsg("Pilih karyawan dan isi jumlah bon dulu."); return; }
        setSaving(true);
        const err = await cashbons.insertRow({
            date: form.date, employee_id: form.employee_id,
            amount: Number(form.amount), installment: Number(form.installment || 0),
            note: form.note.trim() || null,
        });
        setSaving(false);
        if (err) { setMsg(`Gagal menyimpan: ${(err as { message?: string })?.message ?? String(err)}`); return; }
        setForm({ date: todayISO(), employee_id: "", amount: "", installment: "", note: "" });
    };

    const bayar = async () => {
        if (!payFor) return;
        const amt = Number(payAmount || 0);
        const sisa = sisaOf(payFor);
        if (amt <= 0 || amt > sisa) { alert(`Nominal harus 1 s.d. ${rupiah(sisa)}.`); return; }
        await payments.insertRow({ cashbon_id: payFor.id, date: todayISO(), amount: amt });
        setPayFor(null);
        setPayAmount("");
    };

    return (
        <div>
            {/* Ringkasan */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ padding: "10px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase" }}>Total Kasbon</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(totalKasbon)}</div>
                </div>
                <div style={{ padding: "10px 16px", borderRadius: 10, background: "#FEF9C3", border: "1px solid #FDE68A" }}>
                    <div style={{ fontSize: 10, color: "#A16207", fontWeight: 700, textTransform: "uppercase" }}>Sisa Belum Lunas</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "#A16207" }}>{rupiah(totalSisa)}</div>
                </div>
            </div>

            {/* Form catat kasbon */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>🏦 Catat Kasbon Baru</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                    <div style={col}><label style={lbl}>Tanggal</label>
                        <input type="date" value={form.date} onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))} style={inp} /></div>
                    <div style={col}><label style={lbl}>Karyawan</label>
                        <select value={form.employee_id} onChange={(e) => setForm((p) => ({ ...p, employee_id: e.target.value }))} style={inp}>
                            <option value="" disabled>Pilih…</option>
                            {employees.rows.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                        </select></div>
                    <div style={col}><label style={lbl}>Jumlah Bon</label>
                        <input type="number" min={0} value={form.amount} placeholder="500000" onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} style={inp} /></div>
                    <div style={col}><label style={lbl}>Cicilan/Minggu (ops.)</label>
                        <input type="number" min={0} value={form.installment} placeholder="200000" onChange={(e) => setForm((p) => ({ ...p, installment: e.target.value }))} style={inp} /></div>
                    <div style={{ ...col, flex: 1, minWidth: 150 }}><label style={lbl}>Catatan</label>
                        <input type="text" value={form.note} placeholder="cth: dicicil mulai gajian depan" onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))} style={{ ...inp, width: "100%" }} /></div>
                    <button onClick={save} disabled={saving} style={btnPrimary}>{saving ? "Menyimpan..." : "+ Simpan"}</button>
                </div>
                {msg && <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: "#DC2626" }}>{msg}</div>}
                <p style={{ fontSize: 10.5, color: "var(--text-med)", marginTop: 8 }}>
                    Pelunasan bisa lewat <strong>potongan gaji</strong> (isi &quot;Pot. Bon&quot; di tab Gaji &amp; Slip — otomatis tercatat di sini) atau tombol <strong>Bayar Cicilan</strong> (bayar tunai).
                </p>
            </div>

            {/* Tabel kasbon */}
            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr>{["Tanggal", "Karyawan", "Jumlah Bon", "Cicilan/Minggu", "Sudah Dibayar", "Sisa", "Status", ""].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                    </thead>
                    <tbody>
                        {cashbons.loading ? (
                            <tr><td colSpan={8} style={tdEmpty}>Memuat...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={8} style={tdEmpty}>Belum ada catatan kasbon.</td></tr>
                        ) : rows.map((c) => {
                            const paid = paidMap.get(c.id) ?? 0;
                            const viaGaji = paidViaGaji(c.id);
                            const sisa = sisaOf(c);
                            const lunas = sisa <= 0;
                            return (
                                <tr key={c.id} style={{ background: lunas ? "#F0FDF4" : undefined }}>
                                    <td style={{ ...td, whiteSpace: "nowrap" }}>{fmtDate(c.date)}</td>
                                    <td style={{ ...td, fontWeight: 700 }}>
                                        {empById.get(c.employee_id)?.name ?? "-"}
                                        {c.note && <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 400 }}>{c.note}</div>}
                                    </td>
                                    <td style={{ ...td, fontWeight: 700 }}>{rupiah(Number(c.amount || 0))}</td>
                                    <td style={td}>{Number(c.installment) > 0 ? rupiah(Number(c.installment)) : "-"}</td>
                                    <td style={td}>
                                        {paid > 0 ? rupiah(paid) : "-"}
                                        {viaGaji > 0 && (
                                            <span style={{ marginLeft: 6, fontSize: 10, color: "#0F766E", background: "#CCFBF1", padding: "1px 6px", borderRadius: 4, fontWeight: 600 }}>
                                                {rupiah(viaGaji)} via gaji
                                            </span>
                                        )}
                                    </td>
                                    <td style={{ ...td, fontWeight: 700, color: lunas ? "#16A34A" : "#DC2626" }}>{lunas ? "-" : rupiah(sisa)}</td>
                                    <td style={td}>
                                        {lunas
                                            ? <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>✓ LUNAS</span>
                                            : <span style={{ background: "#FEF9C3", color: "#A16207", borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>CICILAN</span>}
                                    </td>
                                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                                        {!lunas && (
                                            <button onClick={() => { setPayFor(c); setPayAmount(String(Math.min(Number(c.installment) || sisa, sisa))); }} style={btnLink}>Bayar Cicilan</button>
                                        )}
                                        <button onClick={async () => {
                                            if (confirm(`Hapus kasbon ${empById.get(c.employee_id)?.name ?? ""} ${rupiah(Number(c.amount || 0))}? Riwayat cicilannya ikut terhapus.`)) {
                                                await cashbons.deleteRow(c.id);
                                                await payments.refresh();
                                            }
                                        }} style={btnDanger}>Hapus</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal bayar cicilan tunai */}
            {payFor && (
                <div style={overlay} onClick={() => setPayFor(null)}>
                    <div style={{ background: "white", borderRadius: 12, padding: 20, width: "min(95vw,380px)" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>Bayar Cicilan Bon (Tunai)</div>
                        <p style={{ fontSize: 12, color: "var(--text-med)", marginBottom: 12 }}>
                            Sisa bon {empById.get(payFor.employee_id)?.name}: <strong>{rupiah(sisaOf(payFor))}</strong>
                        </p>
                        <label style={lbl}>Nominal Pembayaran</label>
                        <input type="number" min={1} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} style={{ ...inp, width: "100%", marginTop: 3 }} />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setPayFor(null)} style={btnGhost}>Batal</button>
                            <button onClick={bayar} style={btnPrimary}>Catat Pembayaran</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================
   TAB 1: DATA KARYAWAN (CRUD lama, tidak berubah)
================================================================ */
const karyawanFields: CrudField[] = [
    { key: "name", label: "Nama", type: "text", required: true },
    { key: "role", label: "Jabatan", type: "text" },
    { key: "division", label: "Divisi", type: "select", options: ["Produksi", "Admin", "Marketing"], required: true },
    { key: "weekly_base", label: "Gaji Mingguan", type: "number", format: "currency" },
    { key: "active", label: "Aktif", type: "checkbox" },
];
const karyawanExcelColumns: ExcelColumn[] = [
    { key: "name", header: "Nama", type: "text" },
    { key: "role", header: "Jabatan", type: "text" },
    { key: "division", header: "Divisi", type: "text", options: ["Produksi", "Admin", "Marketing"] },
    { key: "weekly_base", header: "Gaji Mingguan", type: "number" },
    { key: "active", header: "Aktif", type: "boolean" },
];

export default function AlucurvKaryawanPage() {
    const employees = useAlucurvTable<AlucurvEmployee>("alu_employees", "name", true);
    const salaries = useAlucurvTable<AluSalary>("alu_salaries", "period_start");
    const cashbons = useAlucurvTable<AluCashbon>("alu_cashbons", "date");
    const payments = useAlucurvTable<AluCashbonPayment>("alu_cashbon_payments", "date");
    const [tab, setTab] = useState<"data" | "gaji" | "kasbon">("data");

    const tabBtn = (key: typeof tab, label: string) => (
        <button onClick={() => setTab(key)} style={{
            padding: "9px 18px", fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer",
            background: "none", whiteSpace: "nowrap",
            borderBottom: tab === key ? "3px solid var(--primary)" : "3px solid transparent",
            color: tab === key ? "var(--primary-dark)" : "var(--text-med)",
        }}>{label}</button>
    );

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Karyawan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 12 }}>
                Data karyawan, gaji + slip gaji, dan kasbon Alucurv — sengaja terpisah dari data karyawan Toto.
            </p>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 16, overflowX: "auto" }}>
                {tabBtn("data", "👥 Data Karyawan")}
                {tabBtn("gaji", "💰 Gaji & Slip")}
                {tabBtn("kasbon", "🏦 Kasbon")}
            </div>

            {tab === "data" && (
                <>
                    <div style={{ marginBottom: 16 }}>
                        <ExcelImportButton columns={karyawanExcelColumns} onImport={(rows) => employees.insertRows(rows)} />
                    </div>
                    <AlucurvCrudTable fields={karyawanFields} rows={employees.rows} loading={employees.loading}
                        onAdd={employees.insertRow} onDelete={employees.deleteRow} onUpdate={employees.updateRow} />
                </>
            )}
            {tab === "gaji" && <GajiTab employees={employees} salaries={salaries} cashbons={cashbons} payments={payments} />}
            {tab === "kasbon" && <KasbonTab employees={employees} cashbons={cashbons} payments={payments} />}
        </div>
    );
}

/* -- Shared styles -------------------------------------------------- */
const col: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const lbl: React.CSSProperties = { fontSize: 10, color: "var(--text-med)", fontWeight: 600, textTransform: "uppercase" };
const inp: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", minWidth: 130, color: "var(--text-dark)" };
const btnPrimary: React.CSSProperties = { fontSize: 12, padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "white", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
const btnGhost: React.CSSProperties = { fontSize: 12, padding: "8px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "white", color: "var(--text-med)", fontWeight: 600, cursor: "pointer" };
const btnSlip: React.CSSProperties = { fontSize: 11, padding: "3px 10px", borderRadius: 5, border: "none", background: "var(--primary)", color: "white", fontWeight: 700, cursor: "pointer", marginRight: 10 };
const btnLink: React.CSSProperties = { color: "var(--primary-dark)", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 10 };
const btnDanger: React.CSSProperties = { color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const tdEmpty: React.CSSProperties = { ...td, textAlign: "center", color: "var(--text-med)", padding: "20px 10px" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
