"use client";
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { useKaryawan, DataKaryawan, StatusKaryawan } from "@/lib/karyawan-store";

/* ================================================================
   MENU KARYAWAN - 3 Tab
   Tab 1: Data Karyawan (CRUD)
   Tab 2: Data Gaji (per bulan, editable komponen)
   Tab 3: Kasbon / Bon Karyawan
================================================================ */

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const STATUS_OPTIONS: StatusKaryawan[] = ["Full-time", "Part-time", "Contract", "Freelance"];
const DIVISI_OPTIONS = ["Management", "Finance", "Admin", "Produksi", "Marketing", "Lainnya"];

function fmtRp(v: number) {
    if (!v) return "-";
    return "Rp " + Math.round(v).toLocaleString("id-ID");
}
function fmtDate(d: string) {
    if (!d) return "-";
    const p = d.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : d;
}

const statusColor: Record<StatusKaryawan, { bg: string; color: string }> = {
    "Full-time": { bg: "#DCFCE7", color: "#15803D" },
    "Part-time": { bg: "#DBEAFE", color: "#1D4ED8" },
    "Contract": { bg: "#FEF9C3", color: "#A16207" },
    "Freelance": { bg: "#F3F4F6", color: "#6B7280" },
};

/* -- Shared input style ------------------------------------------ */
const inp: React.CSSProperties = {
    border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 10px",
    fontSize: 12, color: "#3C2F2F", background: "#FFFBF7", width: "100%", boxSizing: "border-box",
};

/* -- Print CSS (injected once) ----------------------------------- */
const PRINT_STYLE = `
@media print {
    body > *:not(#print-root) { display: none !important; }
    #print-root { display: block !important; position: fixed; inset: 0; background: white; z-index: 99999; padding: 0; }
    @page { size: A4; margin: 12mm 14mm; }
}
`;

function injectPrintStyle() {
    if (typeof document === "undefined") return;
    if (!document.getElementById("karyawan-print-style")) {
        const s = document.createElement("style");
        s.id = "karyawan-print-style";
        s.innerHTML = PRINT_STYLE;
        document.head.appendChild(s);
    }
}

/* ================================================================
   PRINT: REKAP GAJI (semua karyawan 1 periode)
================================================================ */
type GajiInfo = {
    karyawan: DataKaryawan;
    base: number; lembur: number; tunjangan: number;
    kasbon: number; potongan: number; bersihPos: number; bersihNeg: number; bersih: number;
};

function PrintRekapModal({ rows, periode, onClose }: {
    rows: GajiInfo[]; periode: string; onClose: () => void;
}) {
    const [mm, yy] = periode.split("-");
    const label = `${MONTH_NAMES[+mm - 1]} ${yy}`;
    const total = rows.reduce((s, r) => s + r.bersih, 0);
    const doPrint = () => { injectPrintStyle(); setTimeout(() => window.print(), 100); };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", width: "min(96vw,860px)", maxHeight: "92vh", overflow: "auto", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>
                {/* Toolbar (hidden when printing) */}
                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #E6D5BE" }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "#3C2F2F" }}>Print Preview Rekap Gaji - {label}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={doPrint} style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🖨️ Print</button>
                        <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>✕ Tutup</button>
                    </div>
                </div>
                {/* Printable area */}
                <div id="print-root" style={{ padding: "28px 32px", fontFamily: "Arial, sans-serif" }}>
                    {/* Header */}
                    <div style={{ textAlign: "center", marginBottom: 20, borderBottom: "2px solid #5C4033", paddingBottom: 12 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#3C2F2F", letterSpacing: 1 }}>CV TOTO ALUMINIUM MANUFACTURE</div>
                        <div style={{ fontSize: 11, color: "#6B5E55", marginTop: 2 }}>Mustika Jaya, Bekasi Timur, Bekasi, Jawa Barat</div>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#A67B5B", marginTop: 10, textTransform: "uppercase", letterSpacing: 2 }}>REKAP GAJI KARYAWAN</div>
                        <div style={{ fontSize: 12, color: "#6B5E55", marginTop: 2 }}>Periode: {label}</div>
                    </div>
                    {/* Table */}
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 10 }}>
                        <thead>
                            <tr style={{ background: "#EDE0D4" }}>
                                {["No", "Nama Karyawan", "Jabatan", "Gaji Pokok", "Lembur", "Tunjangan", "Kasbon", "Potongan", "BPJS", "Gaji Bersih"].map(h => (
                                    <th key={h} style={{ border: "1px solid #C5A882", padding: "5px 7px", textAlign: h === "No" ? "center" : "left", fontWeight: 700, color: "#5C4033", whiteSpace: "nowrap" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, i) => (
                                <tr key={r.karyawan.id} style={{ background: i % 2 === 0 ? "#FFFBF7" : "white" }}>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "center", color: "#B89678" }}>{i + 1}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", fontWeight: 700 }}>{r.karyawan.nama}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px" }}>{r.karyawan.jabatan}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right" }}>{r.base.toLocaleString("id-ID")}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right" }}>{r.lembur > 0 ? r.lembur.toLocaleString("id-ID") : "-"}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right" }}>{r.tunjangan > 0 ? r.tunjangan.toLocaleString("id-ID") : "-"}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right", color: "#B91C1C" }}>{r.kasbon > 0 ? `(${r.kasbon.toLocaleString("id-ID")})` : "-"}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right", color: "#B91C1C" }}>{r.potongan > 0 ? `(${r.potongan.toLocaleString("id-ID")})` : "-"}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right", color: "#B91C1C" }}>{(r.karyawan.bpjs_tk + r.karyawan.bpjs_kes) > 0 ? `(${(r.karyawan.bpjs_tk + r.karyawan.bpjs_kes).toLocaleString("id-ID")})` : "-"}</td>
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right", fontWeight: 800, color: "#15803D" }}>Rp {r.bersih.toLocaleString("id-ID")}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: "#EDE0D4", fontWeight: 800 }}>
                                <td colSpan={9} style={{ border: "1px solid #C5A882", padding: "6px 7px", fontWeight: 800, fontSize: 11 }}>TOTAL</td>
                                <td style={{ border: "1px solid #C5A882", padding: "6px 7px", textAlign: "right", fontSize: 12, color: "#15803D" }}>Rp {total.toLocaleString("id-ID")}</td>
                            </tr>
                        </tfoot>
                    </table>
                    {/* Ttd */}
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 32, gap: 80 }}>
                        {["Dibuat Oleh", "Disetujui Oleh"].map(l => (
                            <div key={l} style={{ textAlign: "center", fontSize: 10, color: "#5C4033" }}>
                                <div style={{ marginBottom: 40 }}>{l}</div>
                                <div style={{ borderTop: "1px solid #5C4033", paddingTop: 4, width: 120 }}>( ________________ )</div>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginTop: 16, fontSize: 9, color: "#B89678", textAlign: "center" }}>Dicetak oleh sistem ERP TOTO - {new Date().toLocaleString("id-ID")}</div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   PRINT: SLIP GAJI (individual) - redesigned per payroll.html ref
================================================================ */
function PrintSlipModal({ row, periode, onClose }: {
    row: GajiInfo; periode: string; onClose: () => void;
}) {
    const doPrint = () => { injectPrintStyle(); setTimeout(() => window.print(), 100); };
    const k = row.karyawan;
    const pendapatan = row.base + row.lembur + row.tunjangan;
    const potonganTotal = row.kasbon + row.potongan + k.bpjs_tk + k.bpjs_kes;
    const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    const tdL: React.CSSProperties = { padding: "6px 10px", borderBottom: "1px solid #E6D5BE", color: "#5C4033", fontSize: 11 };
    const tdR: React.CSSProperties = { ...tdL, textAlign: "right", fontWeight: 600 };
    const tdRed: React.CSSProperties = { ...tdR, color: "#B91C1C" };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", width: "min(96vw,540px)", maxHeight: "95vh", overflow: "auto", borderRadius: 12, boxShadow: "0 24px 80px rgba(0,0,0,0.35)" }}>

                {/* Toolbar */}
                <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #E6D5BE", background: "#FFFBF7" }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#5C4033" }}>Print Slip Gaji - {k.nama}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={doPrint} style={{ padding: "7px 20px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>🖨️ Print</button>
                        <button onClick={onClose} style={{ padding: "7px 14px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>✕ Tutup</button>
                    </div>
                </div>

                {/* -- Printable Slip -- */}
                <div id="print-root" style={{ fontFamily: "Arial, sans-serif", color: "#3C2F2F" }}>

                    {/* Header band */}
                    <div style={{ background: "#A67B5B", padding: "16px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                            <div style={{ fontSize: 15, fontWeight: 900, color: "white", letterSpacing: 0.5 }}>CV TOTO ALUMINIUM MANUFACTURE</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>Mustika Jaya, Bekasi Timur, Bekasi, Jawa Barat</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "white", letterSpacing: 2 }}>SLIP GAJI</div>
                            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>{periode}</div>
                        </div>
                    </div>

                    <div style={{ padding: "18px 24px" }}>

                        {/* Info Karyawan */}
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 11 }}>
                            <tbody>
                                <tr style={{ background: "#FEF3E8" }}>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678", width: 120, borderBottom: "1px solid #E6D5BE" }}>Nama Karyawan</td>
                                    <td style={{ padding: "5px 10px", fontWeight: 800, color: "#3C2F2F", borderBottom: "1px solid #E6D5BE" }}>: {k.nama}</td>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678", width: 100, borderBottom: "1px solid #E6D5BE" }}>Periode</td>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#3C2F2F", borderBottom: "1px solid #E6D5BE" }}>: {periode}</td>
                                </tr>
                                <tr>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678", borderBottom: "1px solid #E6D5BE" }}>Jabatan</td>
                                    <td style={{ padding: "5px 10px", color: "#3C2F2F", borderBottom: "1px solid #E6D5BE" }}>: {k.jabatan || "-"}</td>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678", borderBottom: "1px solid #E6D5BE" }}>Divisi</td>
                                    <td style={{ padding: "5px 10px", color: "#3C2F2F", borderBottom: "1px solid #E6D5BE" }}>: {k.divisi}</td>
                                </tr>
                                <tr style={{ background: "#FEF3E8" }}>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678" }}>Status</td>
                                    <td style={{ padding: "5px 10px", color: "#3C2F2F" }}>: {k.status}</td>
                                    <td style={{ padding: "5px 10px", fontWeight: 700, color: "#B89678" }}>Tanggal Cetak</td>
                                    <td style={{ padding: "5px 10px", color: "#3C2F2F" }}>: {today}</td>
                                </tr>
                            </tbody>
                        </table>

                        {/* Rincian Gaji - single table */}
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 14 }}>
                            <thead>
                                <tr style={{ background: "#A67B5B" }}>
                                    <th style={{ padding: "7px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>Komponen</th>
                                    <th style={{ padding: "7px 10px", textAlign: "right", color: "white", fontWeight: 700, fontSize: 11 }}>Jumlah (Rp)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {/* -- Pendapatan -- */}
                                <tr style={{ background: "#F0FDF4" }}>
                                    <td colSpan={2} style={{ padding: "5px 10px", fontWeight: 800, color: "#15803D", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{'>'} Pendapatan</td>
                                </tr>
                                <tr>
                                    <td style={tdL}>Gaji Harian</td>
                                    <td style={tdR}>{row.base.toLocaleString("id-ID")}</td>
                                </tr>
                                {row.lembur > 0 && <tr style={{ background: "#FAFAF8" }}>
                                    <td style={tdL}>Uang Lembur</td>
                                    <td style={tdR}>{row.lembur.toLocaleString("id-ID")}</td>
                                </tr>}
                                {row.tunjangan > 0 && <tr>
                                    <td style={tdL}>Tunjangan</td>
                                    <td style={tdR}>{row.tunjangan.toLocaleString("id-ID")}</td>
                                </tr>}
                                <tr style={{ background: "#DCFCE7" }}>
                                    <td style={{ ...tdL, fontWeight: 800, color: "#15803D" }}>Total Pendapatan</td>
                                    <td style={{ ...tdR, fontWeight: 800, color: "#15803D" }}>{pendapatan.toLocaleString("id-ID")}</td>
                                </tr>

                                {/* -- Potongan -- */}
                                {potonganTotal > 0 && <>
                                    <tr style={{ background: "#FEF2F2" }}>
                                        <td colSpan={2} style={{ padding: "5px 10px", fontWeight: 800, color: "#B91C1C", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{'>'} Potongan</td>
                                    </tr>
                                    {row.kasbon > 0 && <tr><td style={tdL}>Potongan Kasbon / Bon</td><td style={tdRed}>({row.kasbon.toLocaleString("id-ID")})</td></tr>}
                                    {row.potongan > 0 && <tr style={{ background: "#FAFAF8" }}><td style={tdL}>Potongan Lain</td><td style={tdRed}>({row.potongan.toLocaleString("id-ID")})</td></tr>}
                                    {k.bpjs_tk > 0 && <tr><td style={tdL}>BPJS Ketenagakerjaan</td><td style={tdRed}>({k.bpjs_tk.toLocaleString("id-ID")})</td></tr>}
                                    {k.bpjs_kes > 0 && <tr style={{ background: "#FAFAF8" }}><td style={tdL}>BPJS Kesehatan</td><td style={tdRed}>({k.bpjs_kes.toLocaleString("id-ID")})</td></tr>}
                                    <tr style={{ background: "#FEE2E2" }}>
                                        <td style={{ ...tdL, fontWeight: 800, color: "#B91C1C" }}>Total Potongan</td>
                                        <td style={{ ...tdR, fontWeight: 800, color: "#B91C1C" }}>({potonganTotal.toLocaleString("id-ID")})</td>
                                    </tr>
                                </>}
                            </tbody>
                        </table>

                        {/* Gaji Bersih */}
                        <div style={{ background: "#A67B5B", borderRadius: 8, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "white", letterSpacing: 1 }}>TAKE HOME PAY</span>
                            <span style={{ fontWeight: 900, fontSize: 18, color: "white" }}>Rp {row.bersih.toLocaleString("id-ID")}</span>
                        </div>

                        {/* Tanda tangan */}
                        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                            {["Karyawan Bersangkutan", "Admin / HRD"].map(l => (
                                <div key={l} style={{ textAlign: "center", fontSize: 10, color: "#5C4033", width: 140 }}>
                                    <div style={{ marginBottom: 44 }}>{l}</div>
                                    <div style={{ borderTop: "1.5px solid #A67B5B", paddingTop: 4 }}>(________________)</div>
                                </div>
                            ))}
                        </div>

                        <div style={{ marginTop: 16, fontSize: 9, color: "#C5A882", textAlign: "center", borderTop: "1px dashed #E6D5BE", paddingTop: 8 }}>
                            Slip gaji ini dicetak secara otomatis oleh Sistem ERP CV Toto - {new Date().toLocaleString("id-ID")} - Dokumen ini sah tanpa tanda tangan basah.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   MODAL FORM: Add / Edit Karyawan
================================================================ */
const EMPTY_K: Omit<DataKaryawan, "id"> = {
    nama: "", jabatan: "", divisi: "Produksi", status: "Full-time",
    gaji_pokok: 0, gaji_harian: 0, tanggal_join: "", email: "", no_hp: "",
    alamat: "", bpjs_tk: 0, bpjs_kes: 0, catatan: "",
};

function KaryawanModal({ initial, onSave, onClose }: {
    initial?: DataKaryawan; onSave: (d: Omit<DataKaryawan, "id">) => void; onClose: () => void;
}) {
    const [f, setF] = useState<Omit<DataKaryawan, "id">>(initial ? { ...initial } : EMPTY_K);
    const set = (k: keyof typeof EMPTY_K, v: string | number) =>
        setF(p => ({ ...p, [k]: v }));

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", borderRadius: 12, padding: 24, width: "min(95vw,600px)", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F" }}>{initial ? "✏️ Edit Karyawan" : "+ Tambah Karyawan"}</div>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#B89678" }}>✕</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[
                        { label: "Nama Lengkap *", key: "nama", span: 2 },
                        { label: "Jabatan", key: "jabatan" },
                        { label: "No. HP", key: "no_hp" },
                        { label: "Email", key: "email", span: 2 },
                        { label: "Alamat", key: "alamat", span: 2 },
                        { label: "Tanggal Join", key: "tanggal_join", type: "date" },
                        { label: "Catatan", key: "catatan" },
                    ].map(({ label, key, span, type }) => (
                        <div key={key} style={{ gridColumn: span === 2 ? "1 / -1" : undefined }}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>{label.toUpperCase()}</label>
                            <input type={type || "text"} value={String((f as Record<string, unknown>)[key] ?? "")}
                                onChange={e => set(key as keyof typeof EMPTY_K, e.target.value)}
                                style={inp} />
                        </div>
                    ))}
                    <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>DIVISI</label>
                        <select value={f.divisi} onChange={e => set("divisi", e.target.value)} style={inp}>
                            {DIVISI_OPTIONS.map(d => <option key={d}>{d}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>STATUS</label>
                        <select value={f.status} onChange={e => set("status", e.target.value as StatusKaryawan)} style={inp}>
                            {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
                        </select>
                    </div>
                    {[
                        { label: "Gaji Pokok (Rp)", key: "gaji_pokok" },
                        { label: "Gaji Harian (Rp)", key: "gaji_harian" },
                        { label: "BPJS Ketenagakerjaan (Rp)", key: "bpjs_tk" },
                        { label: "BPJS Kesehatan (Rp)", key: "bpjs_kes" },
                    ].map(({ label, key }) => (
                        <div key={key}>
                            <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>{label.toUpperCase()}</label>
                            <input type="number" min={0} value={(f as Record<string, unknown>)[key] as number || ""}
                                onChange={e => set(key as keyof typeof EMPTY_K, Number(e.target.value))}
                                style={inp} />
                        </div>
                    ))}
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                    <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>Batal</button>
                    <button onClick={() => { if (!f.nama) return; onSave(f); onClose(); }}
                        style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        Simpan
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   TAB 1: DATA KARYAWAN
================================================================ */
function TabDataKaryawan() {
    const { karyawan, addKaryawan, updateKaryawan, deleteKaryawan } = useKaryawan();
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState<"add" | DataKaryawan | null>(null);

    const filtered = karyawan.filter(k =>
        [k.nama, k.jabatan, k.divisi].join(" ").toLowerCase().includes(search.toLowerCase())
    );

    const exportExcel = () => {
        const data = karyawan.map((k, i) => ({
            "No": i + 1, "Nama": k.nama, "Jabatan": k.jabatan, "Divisi": k.divisi,
            "Status": k.status, "Gaji Pokok": k.gaji_pokok, "Gaji Harian": k.gaji_harian,
            "BPJS TK": k.bpjs_tk, "BPJS Kes": k.bpjs_kes, "Tgl Join": k.tanggal_join,
            "No HP": k.no_hp, "Email": k.email,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Karyawan");
        XLSX.writeFile(wb, "data-karyawan.xlsx");
    };

    const totalGaji = karyawan.reduce((s, k) => s + (k.gaji_pokok || k.gaji_harian * 26), 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ background: "#FEF3E8", border: "1.5px solid #A67B5B30", borderLeft: "4px solid #A67B5B", borderRadius: 8, padding: "8px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>TOTAL KARYAWAN</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>{karyawan.length} orang</div>
                    </div>
                    <div style={{ background: "#F0FDF4", border: "1.5px solid #15803D30", borderLeft: "4px solid #15803D", borderRadius: 8, padding: "8px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>EST. GAJI/BULAN</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#15803D" }}>{fmtRp(totalGaji)}</div>
                    </div>
                </div>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Cari nama, jabatan, divisi..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 10px", fontSize: 12, width: 220, height: 30, color: "#5C4033", background: "#FFFBF7" }} />
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={exportExcel}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 12px", fontSize: 11, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 }}>⬇ Excel
                    </button>
                    <button onClick={() => setModal("add")}
                        style={{ border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, background: "#A67B5B", color: "white", cursor: "pointer", fontWeight: 700 }}>
                        + Tambah Karyawan
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: "auto", background: "white" }}>
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["No", "Nama", "Jabatan", "Divisi", "Status", "Gaji Pokok", "Gaji Harian", "BPJS TK", "BPJS Kes", "Tgl Join", "Aksi"].map(h => (
                                <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11, padding: "7px 10px", borderBottom: "2px solid #C5A882", borderRight: "1px solid #D1BFA3", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 4, textAlign: h === "No" ? "center" : "left" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={11} style={{ textAlign: "center", padding: "3rem", color: "#C5A882" }}>Belum ada karyawan. Klik + untuk menambah.</td></tr>
                        ) : filtered.map((k, i) => {
                            const st = statusColor[k.status];
                            return (
                                <tr key={k.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAF8" }}>
                                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", color: "#B89678", fontWeight: 600 }}>{i + 1}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700, whiteSpace: "nowrap" }}>{k.nama}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{k.jabatan || "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>{k.divisi}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>
                                        <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>{k.status}</span>
                                    </td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 600 }}>{k.gaji_pokok ? fmtRp(k.gaji_pokok) : "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>{k.gaji_harian ? fmtRp(k.gaji_harian) + "/hr" : "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>{k.bpjs_tk ? fmtRp(k.bpjs_tk) : "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>{k.bpjs_kes ? fmtRp(k.bpjs_kes) : "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{fmtDate(k.tanggal_join)}</td>
                                    <td style={{ padding: "5px 8px", borderBottom: "1px solid #E6D5BE" }}>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            <button onClick={() => setModal(k)}
                                                style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#5C4033" }}>Edit</button>
                                            <button onClick={() => { if (confirm(`Hapus ${k.nama}?`)) deleteKaryawan(k.id); }}
                                                style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontSize: 11, fontWeight: 600, color: "#B91C1C" }}>Hapus</button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal */}
            {modal === "add" && <KaryawanModal onSave={addKaryawan} onClose={() => setModal(null)} />}
            {modal && modal !== "add" && <KaryawanModal initial={modal as DataKaryawan} onSave={d => updateKaryawan((modal as DataKaryawan).id, d)} onClose={() => setModal(null)} />}
        </div>
    );
}

/* ================================================================
   TAB 2: DATA GAJI - mekanisme mirip payroll.html
================================================================ */
function TabDataGaji() {
    const { karyawan, gaji, upsertGaji } = useKaryawan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [week, setWeek] = useState(1);
    const [selectedKId, setSelectedKId] = useState<number>(karyawan[0]?.id ?? 0);
    const [form, setForm] = useState({ hari_kerja: 6, hari_lembur: 0, tunjangan: 0, kasbon_potong: 0, potongan_lain: 0 });
    const [hasResult, setHasResult] = useState(false);
    const [printRekap, setPrintRekap] = useState(false);
    const [printSlip, setPrintSlip] = useState(false);

    const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);
    const periode = `${year}-${String(month).padStart(2, "0")}-W${week}`;
    const periodeLabel = `Minggu ${week}, ${MONTH_NAMES[month - 1]} ${year}`;

    const getGaji = (kId: number) => gaji.find(g => g.karyawan_id === kId && g.periode === periode);
    const selectedK = karyawan.find(k => k.id === selectedKId);

    /* Auto-fill form saat pilih karyawan / ganti periode */
    React.useEffect(() => {
        const g = getGaji(selectedKId);
        if (g) {
            setForm({
                hari_kerja: g.hari_kerja ?? 6,
                hari_lembur: g.hari_lembur ?? 0,
                tunjangan: g.tunjangan ?? 0,
                kasbon_potong: g.kasbon_potong ?? 0,
                potongan_lain: g.potongan_lain ?? 0,
            });
            setHasResult(true);
        } else {
            setForm({ hari_kerja: 6, hari_lembur: 0, tunjangan: 0, kasbon_potong: 0, potongan_lain: 0 });
            setHasResult(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKId, periode]);

    /* Hitung - effective daily rate: pakai gaji_harian, kalau 0 ambil dari gaji_pokok/26 */
    const effectiveHarian = selectedK
        ? (selectedK.gaji_harian || Math.round(selectedK.gaji_pokok / 26))
        : 0;
    const base = effectiveHarian * form.hari_kerja;
    const lemburNominal = effectiveHarian * form.hari_lembur;
    const totalPendapatan = base + lemburNominal + form.tunjangan;
    const totalPotongan = form.kasbon_potong + form.potongan_lain;
    const bersih = totalPendapatan - totalPotongan;

    const hitungDanSimpan = () => {
        if (!selectedK) return;
        upsertGaji({
            karyawan_id: selectedK.id, periode,
            gaji_pokok: base,
            hari_kerja: form.hari_kerja,
            hari_lembur: form.hari_lembur,
            lembur: lemburNominal,
            tunjangan: form.tunjangan,
            kasbon_potong: form.kasbon_potong,
            potongan_lain: form.potongan_lain,
            catatan: "",
        });
        setHasResult(true);
    };

    /* Build rows for summary table + rekap print */
    const gajiRows: GajiInfo[] = karyawan.map(k => {
        const g = getGaji(k.id);
        const hk = g?.hari_kerja ?? 6;
        const effHarian = k.gaji_harian || Math.round(k.gaji_pokok / 26);
        const base = effHarian * hk;
        const lembur = g?.lembur ?? 0;
        const tunjangan = g?.tunjangan ?? 0;
        const kasbon = g?.kasbon_potong ?? 0;
        const potongan = g?.potongan_lain ?? 0;
        const bersih = base + lembur + tunjangan - kasbon - potongan;
        return { karyawan: k, base, lembur, tunjangan, kasbon, potongan, bersihPos: base + lembur + tunjangan, bersihNeg: kasbon + potongan, bersih };
    });
    const totalBersih = gajiRows.reduce((s, r) => s + r.bersih, 0);

    /* Current employee's GajiInfo for print slip */
    const selectedRow: GajiInfo = {
        karyawan: selectedK ?? karyawan[0],
        base, lembur: lemburNominal, tunjangan: form.tunjangan,
        kasbon: form.kasbon_potong, potongan: form.potongan_lain,
        bersihPos: totalPendapatan, bersihNeg: totalPotongan, bersih,
    };

    const exportExcel = () => {
        const data = gajiRows.map(r => ({
            "Nama": r.karyawan.nama, "Jabatan": r.karyawan.jabatan, "Divisi": r.karyawan.divisi,
            "Hari Kerja": getGaji(r.karyawan.id)?.hari_kerja ?? "-",
            "Gaji Harian/Pokok": r.base, "Hari Lembur": getGaji(r.karyawan.id)?.hari_lembur ?? 0,
            "Lembur": r.lembur, "Tunjangan": r.tunjangan,
            "Kasbon Potong": r.kasbon, "Potongan Lain": r.potongan, "Gaji Bersih": r.bersih,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), `Gaji ${periode}`);
        XLSX.writeFile(wb, `gaji-${periode}.xlsx`);
    };

    const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 4 };
    const field: React.CSSProperties = { ...inp, marginBottom: 0 };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* -- Toolbar -- */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                {/* Period pill */}
                <div style={{ display: "flex", gap: 4, alignItems: "center", background: "#FEF3E8", borderRadius: 7, padding: "4px 12px", border: "1px solid #D1BFA3" }}>
                    <span style={{ fontSize: 11, color: "#B89678", fontWeight: 700 }}></span>
                    <select value={week} onChange={e => setWeek(+e.target.value)}
                        style={{ border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 11, color: "#5C4033", background: "transparent", fontWeight: 700, cursor: "pointer" }}>
                        {[1, 2, 3, 4, 5].map(w => <option key={w} value={w}>Minggu {w}</option>)}
                    </select>
                    <select value={month} onChange={e => setMonth(+e.target.value)}
                        style={{ border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 11, color: "#5C4033", background: "transparent", cursor: "pointer" }}>
                        {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={e => setYear(+e.target.value)}
                        style={{ border: "none", borderRadius: 4, padding: "3px 6px", fontSize: 11, color: "#5C4033", background: "transparent", cursor: "pointer" }}>
                        {years.map(y => <option key={y}>{y}</option>)}
                    </select>
                </div>
                {/* Total */}
                <div style={{ background: "#F0FDF4", borderLeft: "4px solid #15803D", borderRadius: 6, padding: "5px 12px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>TOTAL GAJI MINGGU INI</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803D" }}>{fmtRp(totalBersih)}</div>
                </div>
                <button onClick={exportExcel} style={{ marginLeft: "auto", border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 12px", fontSize: 11, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 }}>⬇ Excel</button>
                <button onClick={() => setPrintRekap(true)} style={{ border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, background: "#A67B5B", color: "white", cursor: "pointer", fontWeight: 700 }}>🖨️ Cetak Rekap</button>
            </div>

            {/* -- Body: Calculator (left) + Result (right) -- */}
            <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#F5EBDD" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900, margin: "0 auto" }}>

                    {/* -- LEFT: Kalkulator Gaji (mirip payroll.html) -- */}
                    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#5C4033", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                            Kalkulator Gaji Karyawan
                        </div>

                        {/* Pilih Karyawan */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>PILIH KARYAWAN</label>
                            <select value={selectedKId} onChange={e => setSelectedKId(+e.target.value)} style={field}>
                                {karyawan.map(k => <option key={k.id} value={k.id}>{k.nama} - {k.jabatan}</option>)}
                            </select>
                            {selectedK && (
                                <div style={{ marginTop: 6, padding: "6px 10px", background: "#FEF3E8", borderRadius: 6, fontSize: 11, color: "#A67B5B", display: "flex", gap: 16 }}>
                                    <span>📁 {selectedK.divisi}</span>
                                    <span>💰 Rp {effectiveHarian.toLocaleString("id-ID")}/hari{selectedK.gaji_pokok && !selectedK.gaji_harian ? ` (dari pokok ${fmtRp(selectedK.gaji_pokok)}/26)` : ''}</span>
                                </div>
                            )}
                        </div>

                        {/* Input 2-column grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={lbl}>HARI KERJA</label>
                                <input type="number" min={0} max={7} step={1} value={form.hari_kerja}
                                    onChange={e => { setForm(p => ({ ...p, hari_kerja: +e.target.value })); setHasResult(false); }}
                                    style={field} />
                            </div>
                            <div>
                                <label style={lbl}>HARI LEMBUR</label>
                                <input type="number" min={0} max={7} step={0.5} value={form.hari_lembur}
                                    onChange={e => { setForm(p => ({ ...p, hari_lembur: +e.target.value })); setHasResult(false); }}
                                    placeholder="0 (bisa 0.5)" style={field} />
                            </div>
                            <div>
                                <label style={lbl}>TUNJANGAN (Rp)</label>
                                <input type="number" min={0} value={form.tunjangan || ""}
                                    onChange={e => { setForm(p => ({ ...p, tunjangan: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                            <div>
                                <label style={lbl}>POTONGAN BON (Rp)</label>
                                <input type="number" min={0} value={form.kasbon_potong || ""}
                                    onChange={e => { setForm(p => ({ ...p, kasbon_potong: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                                <label style={lbl}>POTONGAN LAIN (Rp)</label>
                                <input type="number" min={0} value={form.potongan_lain || ""}
                                    onChange={e => { setForm(p => ({ ...p, potongan_lain: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                        </div>

                        <button onClick={hitungDanSimpan}
                            style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#A67B5B", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>
                            Hitung Gaji
                        </button>
                    </div>

                    {/* -- RIGHT: Hasil Perhitungan -- */}
                    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#5C4033", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                            Hasil Perhitungan
                            {hasResult && <span style={{ fontSize: 10, background: "#D1FAE5", color: "#15803D", padding: "2px 8px", borderRadius: 10, fontWeight: 700, marginLeft: "auto" }}>✓ Tersimpan</span>}
                        </div>

                        {!selectedK ? (
                            <div style={{ color: "#C5A882", textAlign: "center", marginTop: 40, fontSize: 13 }}>Pilih karyawan terlebih dahulu</div>
                        ) : (
                            <>
                                {/* Rincian */}
                                <div style={{ borderBottom: "1px solid #E6D5BE", paddingBottom: 12, marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: "#15803D", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{'>'} Pendapatan</div>
                                    {[
                                        { l: `Gaji Harian (Rp ${effectiveHarian.toLocaleString("id-ID")}) × ${form.hari_kerja} hari`, v: base },
                                        ...(form.hari_lembur > 0 ? [{ l: `Lembur (Rp ${effectiveHarian.toLocaleString("id-ID")}) × ${form.hari_lembur} hari`, v: lemburNominal }] : []),
                                        ...(form.tunjangan > 0 ? [{ l: "Tunjangan", v: form.tunjangan }] : []),
                                    ].map(({ l, v }) => (
                                        <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#5C4033" }}>
                                            <span>{l}</span><span style={{ fontWeight: 600 }}>Rp {v.toLocaleString("id-ID")}</span>
                                        </div>
                                    ))}
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#15803D", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #D1FAE5" }}>
                                        <span>Total Pendapatan</span><span>Rp {totalPendapatan.toLocaleString("id-ID")}</span>
                                    </div>
                                </div>

                                {totalPotongan > 0 && (
                                    <div style={{ borderBottom: "1px solid #E6D5BE", paddingBottom: 12, marginBottom: 12 }}>
                                        <div style={{ fontSize: 10, fontWeight: 800, color: "#B91C1C", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{'>'} Potongan</div>
                                        {[
                                            ...(form.kasbon_potong > 0 ? [{ l: "Potongan Bon / Kasbon", v: form.kasbon_potong }] : []),
                                            ...(form.potongan_lain > 0 ? [{ l: "Potongan Lain", v: form.potongan_lain }] : []),
                                        ].map(({ l, v }) => (
                                            <div key={l} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4, color: "#5C4033" }}>
                                                <span>{l}</span><span style={{ fontWeight: 600, color: "#B91C1C" }}>(Rp {v.toLocaleString("id-ID")})</span>
                                            </div>
                                        ))}
                                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700, color: "#B91C1C", marginTop: 6, paddingTop: 6, borderTop: "1px dashed #FEE2E2" }}>
                                            <span>Total Potongan</span><span>(Rp {totalPotongan.toLocaleString("id-ID")})</span>
                                        </div>
                                    </div>
                                )}

                                {/* Take Home Pay */}
                                <div style={{ background: "#A67B5B", borderRadius: 8, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                    <span style={{ fontWeight: 800, fontSize: 12, color: "white", letterSpacing: 1 }}>TAKE HOME PAY</span>
                                    <span style={{ fontWeight: 900, fontSize: 18, color: "white" }}>Rp {bersih.toLocaleString("id-ID")}</span>
                                </div>

                                <button onClick={() => { hitungDanSimpan(); setPrintSlip(true); }}
                                    style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "2px solid #D1BFA3", background: "#F5EBDD", color: "#A67B5B", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                                    🖨️ Cetak Slip Gaji
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* -- Summary Table (semua karyawan periode ini) -- */}
                <div style={{ maxWidth: 900, margin: "16px auto 0", background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #E6D5BE", fontWeight: 800, fontSize: 13, color: "#5C4033", display: "flex", justifyContent: "space-between" }}>
                        <span>📊 Rekap {periodeLabel}</span>
                        <span style={{ color: "#B89678", fontWeight: 600, fontSize: 11 }}>{gajiRows.filter(r => getGaji(r.karyawan.id)).length}/{karyawan.length} karyawan sudah dihitung</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "#EDE0D4" }}>
                                {["Nama", "Divisi", "Hari Kerja", "Hari Lembur", "Gaji Harian", "Take Home Pay", ""].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: h === "Take Home Pay" || h === "Hari Kerja" || h === "Hari Lembur" ? "center" : "left", fontWeight: 700, fontSize: 11, color: "#5C4033", borderBottom: "2px solid #C5A882" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gajiRows.map((r, i) => {
                                const g = getGaji(r.karyawan.id);
                                const isSelected = r.karyawan.id === selectedKId;
                                return (
                                    <tr key={r.karyawan.id} style={{ background: isSelected ? "#FEF3E8" : i % 2 === 0 ? "white" : "#FAFAF8", cursor: "pointer", transition: "background 0.15s" }}
                                        onClick={() => setSelectedKId(r.karyawan.id)}>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", fontWeight: 700 }}>
                                            {isSelected && <span style={{ color: "#A67B5B", marginRight: 4 }}>{'>'}</span>}{r.karyawan.nama}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", color: "#6B5E55" }}>{r.karyawan.divisi}</td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center" }}>
                                            {g ? <span style={{ background: "#FEF3E8", borderRadius: 5, padding: "2px 8px", color: "#A67B5B", fontWeight: 700 }}>{g.hari_kerja} hr</span> : <span style={{ color: "#D1BFA3" }}>-</span>}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center" }}>
                                            {g && g.hari_lembur > 0 ? <span style={{ background: "#FEF9C3", borderRadius: 5, padding: "2px 8px", color: "#A16207", fontWeight: 700 }}>{g.hari_lembur} hr</span> : <span style={{ color: "#D1BFA3" }}>-</span>}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", color: "#6B5E55" }}>
                                            {fmtRp(r.karyawan.gaji_harian || Math.round(r.karyawan.gaji_pokok / 26))}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center", fontWeight: 800, color: g ? "#15803D" : "#D1BFA3" }}>
                                            {g ? fmtRp(r.bersih) : "Belum dihitung"}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center" }}>
                                            <button onClick={e => { e.stopPropagation(); setSelectedKId(r.karyawan.id); setHasResult(true); setPrintSlip(true); }}
                                                disabled={!g}
                                                style={{ padding: "3px 10px", borderRadius: 5, border: "none", background: g ? "#A67B5B" : "#E6D5BE", color: g ? "white" : "#B89678", cursor: g ? "pointer" : "not-allowed", fontSize: 11, fontWeight: 700 }}>
                                                Print
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ background: "#EDE0D4" }}>
                                <td colSpan={5} style={{ padding: "8px 12px", fontWeight: 700, fontSize: 12, color: "#5C4033" }}>TOTAL - {periodeLabel}</td>
                                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, fontSize: 13, color: "#15803D" }}>{fmtRp(totalBersih)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Print Modals */}
            {printRekap && <PrintRekapModal rows={gajiRows} periode={periodeLabel} onClose={() => setPrintRekap(false)} />}
            {printSlip && selectedK && (
                <PrintSlipModal row={selectedRow} periode={periodeLabel} onClose={() => setPrintSlip(false)} />
            )}
        </div>
    );
}


/* ================================================================
   TAB 3: KASBON / BON KARYAWAN
================================================================ */
function TabKasbon() {
    const { karyawan, kasbon, addKasbon, updateKasbon, deleteKasbon } = useKaryawan();
    const [search, setSearch] = useState("");
    const [filterKId, setFilterKId] = useState<number | "all">("all");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ karyawan_id: 0, tanggal: new Date().toISOString().slice(0, 10), nominal: 0, bayar: 0, keterangan: "" });

    const filtered = kasbon.filter(b => {
        const k = karyawan.find(k => k.id === b.karyawan_id);
        if (filterKId !== "all" && b.karyawan_id !== filterKId) return false;
        if (search && !k?.nama.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const totalKasbon = filtered.reduce((s, b) => s + b.nominal, 0);
    const totalSisa = filtered.reduce((s, b) => s + (b.nominal - b.bayar), 0);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 10 }}>
                    <div style={{ background: "#FEF2F2", border: "1.5px solid #B91C1C30", borderLeft: "4px solid #B91C1C", borderRadius: 8, padding: "6px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>TOTAL KASBON</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#B91C1C" }}>{fmtRp(totalKasbon)}</div>
                    </div>
                    <div style={{ background: "#FEF9C3", border: "1.5px solid #A1620730", borderLeft: "4px solid #A16207", borderRadius: 8, padding: "6px 14px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>SISA BELUM BAYAR</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#A16207" }}>{fmtRp(totalSisa)}</div>
                    </div>
                </div>
                <select value={filterKId} onChange={e => setFilterKId(e.target.value === "all" ? "all" : +e.target.value)}
                    style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 8px", fontSize: 11, color: "#5C4033", background: "#FFFBF7", height: 30 }}>
                    <option value="all">Semua Karyawan</option>
                    {karyawan.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                </select>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Cari nama..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 10px", fontSize: 12, width: 180, height: 30, color: "#5C4033", background: "#FFFBF7" }} />
                <button onClick={() => setShowForm(true)} style={{ marginLeft: "auto", border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, background: "#A67B5B", color: "white", cursor: "pointer", fontWeight: 700 }}>
                    + Catat Kasbon
                </button>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: "auto", background: "white" }}>
                <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["No", "Tanggal", "Nama Karyawan", "Nominal Kasbon", "Sudah Dibayar", "Sisa", "Keterangan", "Aksi"].map(h => (
                                <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11, padding: "7px 10px", borderBottom: "2px solid #C5A882", borderRight: "1px solid #D1BFA3", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 4 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr><td colSpan={8} style={{ textAlign: "center", padding: "3rem", color: "#C5A882" }}>Belum ada catatan kasbon.</td></tr>
                        ) : filtered.sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((b, i) => {
                            const k = karyawan.find(k => k.id === b.karyawan_id);
                            const sisa = b.nominal - b.bayar;
                            const lunas = sisa <= 0;
                            return (
                                <tr key={b.id} style={{ background: lunas ? "#F0FDF4" : (i % 2 === 0 ? "white" : "#FAFAF8") }}>
                                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", color: "#B89678" }}>{i + 1}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{fmtDate(b.tanggal)}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700 }}>{k?.nama || "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700, color: "#B91C1C" }}>{fmtRp(b.nominal)}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>
                                        <input type="number" min={0} max={b.nominal} value={b.bayar || ""}
                                            onChange={e => updateKasbon(b.id, { bayar: +e.target.value })}
                                            style={{ width: 100, border: "1px solid #D1BFA3", borderRadius: 5, padding: "2px 6px", fontSize: 11, textAlign: "right" }} />
                                    </td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700 }}>
                                        {lunas
                                            ? <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700 }}>✓ LUNAS</span>
                                            : <span style={{ color: "#B91C1C" }}>{fmtRp(sisa)}</span>}
                                    </td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", color: "#6B5E55" }}>{b.keterangan || "-"}</td>
                                    <td style={{ padding: "5px 8px", borderBottom: "1px solid #E6D5BE" }}>
                                        <button onClick={() => { if (confirm("Hapus catatan ini?")) deleteKasbon(b.id); }}
                                            style={{ padding: "3px 9px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontSize: 11, color: "#B91C1C" }}>Hapus</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Form Modal */}
            {showForm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "white", borderRadius: 12, padding: 24, width: "min(95vw,440px)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F", marginBottom: 16 }}>+ Catat Kasbon Baru</div>
                        {[
                            { label: "Karyawan", key: "karyawan_id", type: "select" },
                            { label: "Tanggal", key: "tanggal", type: "date" },
                            { label: "Nominal Kasbon (Rp)", key: "nominal", type: "number" },
                            { label: "Keterangan", key: "keterangan", type: "text" },
                        ].map(({ label, key, type }) => (
                            <div key={key} style={{ marginBottom: 10 }}>
                                <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>{label.toUpperCase()}</label>
                                {type === "select"
                                    ? <select value={form.karyawan_id} onChange={e => setForm(p => ({ ...p, karyawan_id: +e.target.value }))} style={inp}>
                                        <option value={0}>-- Pilih Karyawan --</option>
                                        {karyawan.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
                                    </select>
                                    : <input type={type} value={(form as Record<string, unknown>)[key] as string || ""}
                                        onChange={e => setForm(p => ({ ...p, [key]: type === "number" ? +e.target.value : e.target.value }))}
                                        style={inp} />
                                }
                            </div>
                        ))}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setShowForm(false)} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>Batal</button>
                            <button onClick={() => {
                                if (!form.karyawan_id || !form.nominal) return;
                                addKasbon({ ...form, bayar: 0 });
                                setShowForm(false);
                                setForm({ karyawan_id: 0, tanggal: new Date().toISOString().slice(0, 10), nominal: 0, bayar: 0, keterangan: "" });
                            }} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                                Simpan
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================
   MAIN PAGE
================================================================ */
export default function KaryawanPage() {
    const [activeTab, setActiveTab] = useState<"data" | "gaji" | "kasbon">("data");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}>
            {/* Tab nav */}
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>

                <button onClick={() => setActiveTab("data")} style={tabStyle("data")}>👥 Data Karyawan</button>
                <button onClick={() => setActiveTab("gaji")} style={tabStyle("gaji")}>💰 Data Gaji</button>
                <button onClick={() => setActiveTab("kasbon")} style={tabStyle("kasbon")}>🏦 Kasbon</button>
            </div>
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {activeTab === "data" && <TabDataKaryawan />}
                {activeTab === "gaji" && <TabDataGaji />}
                {activeTab === "kasbon" && <TabKasbon />}
            </div>
        </div>
    );
}
