"use client";
import DesktopOnly from "@/components/layout/DesktopOnly";
import React, { useState, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { useKaryawan, DataKaryawan, StatusKaryawan, GajiRecord } from "@/lib/karyawan-store";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import {
    bulanPeriode, periodeKustom, mingguPeriode, isoAddDays, tipeGajianOf, tarifHarianOf,
    hitungKehadiran, keteranganTelat, HALF_DAY_CUTOFF,
    type PeriodeGaji, type TipeGajian, type AbsensiLike, type KehadiranSummary,
} from "@/lib/gaji-absensi";

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
/** Tanggal akhir sebuah periode gaji — dipakai alokasi kasbon (auto_bayar).
 *  Format baru 'YYYY-MM-DD~YYYY-MM-DD' → tanggal selesai.
 *  Format lama 'YYYY-MM-Wn' → perkiraan akhir minggu itu, dibatasi akhir bulan. */
function periodeToDate(periode: string): string {
    const r = periode.match(/^\d{4}-\d{2}-\d{2}~(\d{4}-\d{2}-\d{2})$/);
    if (r) return r[1];
    const m = periode.match(/^(\d{4})-(\d{2})-W(\d)$/);
    if (!m) return periode;
    const [, y, mo, w] = m;
    const lastDayOfMonth = new Date(Number(y), Number(mo), 0).getDate();
    const day = Math.min(Number(w) * 7, lastDayOfMonth);
    return `${y}-${mo}-${String(day).padStart(2, "0")}`;
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
    body * { visibility: hidden; }
    #print-root, #print-root * { visibility: visible; }
    #print-root { position: absolute; left: 0; top: 0; width: 100%; margin: 0; padding: 0; background: white; z-index: 99999; }
    .no-print, .no-print * { display: none !important; }
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
    kasbon: number; potongan: number; bpjs_tk: number; bpjs_kes: number;
    bersihPos: number; bersihNeg: number; bersih: number;
};

function PrintRekapModal({ rows, periode, onClose }: {
    rows: GajiInfo[]; periode: string; onClose: () => void;
}) {
    // periode = label siap tampil ("20 – 25 Jul 2026" / "Juli 2026").
    const label = periode;
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
                                    <td style={{ border: "1px solid #E6D5BE", padding: "5px 7px", textAlign: "right", color: "#B91C1C" }}>{(r.bpjs_tk + r.bpjs_kes) > 0 ? `(${(r.bpjs_tk + r.bpjs_kes).toLocaleString("id-ID")})` : "-"}</td>
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
function PrintSlipModal({ row, periode, catatanTelat, onClose }: {
    row: GajiInfo; periode: string; catatanTelat?: string; onClose: () => void;
}) {
    const { kasbon: allKasbon, gaji: allGaji } = useKaryawan();
    const doPrint = () => { injectPrintStyle(); setTimeout(() => window.print(), 100); };
    const k = row.karyawan;
    const kId = k.id;
    const pendapatan = row.base + row.lembur + row.tunjangan;
    const potonganTotal = row.kasbon + row.potongan + row.bpjs_tk + row.bpjs_kes;
    const today = new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

    // Replikasi logika TabKasbon.kasbonWithAuto, difilter ke karyawan ini saja.
    // auto_bayar sudah include kasbon_potong slip ini karena hitungDanSimpan()
    // dipanggil sebelum modal terbuka — sehingga sisa yang tampil sudah akurat.
    const kasbonInfo = useMemo(() => {
        const myKasbon = allKasbon.filter(b => b.karyawan_id === kId);
        if (myKasbon.length === 0) return null;

        const totalGajiPotong = allGaji
            .filter(g => g.karyawan_id === kId && g.kasbon_potong > 0)
            .reduce((s, g) => s + g.kasbon_potong, 0);

        let leftover = totalGajiPotong;
        const withAuto = [...myKasbon]
            .sort((a, b) => a.id - b.id)
            .map(b => {
                const gap = b.nominal - b.bayar;
                let auto_bayar = 0;
                if (gap > 0 && leftover > 0) {
                    auto_bayar = Math.min(gap, leftover);
                    leftover -= auto_bayar;
                }
                return { ...b, auto_bayar };
            });

        const active = withAuto.filter(b => b.nominal - b.bayar - b.auto_bayar > 0);
        if (active.length === 0) return null;

        const totalNominal = active.reduce((s, b) => s + b.nominal, 0);
        const totalTerbayar = active.reduce((s, b) => s + b.bayar + b.auto_bayar, 0);
        return { totalNominal, totalTerbayar, sisa: totalNominal - totalTerbayar };
    }, [allKasbon, allGaji, kId]);

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
                                    {row.bpjs_tk > 0 && <tr><td style={tdL}>BPJS Ketenagakerjaan</td><td style={tdRed}>({row.bpjs_tk.toLocaleString("id-ID")})</td></tr>}
                                    {row.bpjs_kes > 0 && <tr style={{ background: "#FAFAF8" }}><td style={tdL}>BPJS Kesehatan</td><td style={tdRed}>({row.bpjs_kes.toLocaleString("id-ID")})</td></tr>}
                                    <tr style={{ background: "#FEE2E2" }}>
                                        <td style={{ ...tdL, fontWeight: 800, color: "#B91C1C" }}>Total Potongan</td>
                                        <td style={{ ...tdR, fontWeight: 800, color: "#B91C1C" }}>({potonganTotal.toLocaleString("id-ID")})</td>
                                    </tr>
                                </>}
                            </tbody>
                        </table>

                        {/* Gaji Bersih */}
                        <div style={{ background: "#A67B5B", borderRadius: 8, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                            <span style={{ fontWeight: 800, fontSize: 13, color: "white", letterSpacing: 1 }}>TAKE HOME PAY</span>
                            <span style={{ fontWeight: 900, fontSize: 18, color: "white" }}>Rp {row.bersih.toLocaleString("id-ID")}</span>
                        </div>

                        {/* Keterangan telat — tidak memotong gaji (keputusan owner) */}
                        {catatanTelat && (
                            <div style={{ marginBottom: 14, background: "#FFFBEB", border: "1px dashed #D9B96A", borderRadius: 8, padding: "8px 14px", fontSize: 10.5, color: "#92400E" }}>
                                ⏰ {catatanTelat}
                            </div>
                        )}

                        {/* Informasi Kasbon — hanya tampil jika karyawan punya kasbon aktif */}
                        {kasbonInfo && (
                            <div style={{ marginBottom: 18, border: "1.5px solid #FDE68A", borderRadius: 8, overflow: "hidden" }}>
                                <div style={{ background: "#FEF9C3", padding: "6px 14px", borderBottom: "1px solid #FDE68A" }}>
                                    <span style={{ fontWeight: 800, fontSize: 10, color: "#92400E", letterSpacing: 1, textTransform: "uppercase" }}>📋 Informasi Kasbon</span>
                                </div>
                                <div style={{ background: "#FFFBEB", padding: "10px 14px" }}>
                                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                        <tbody>
                                            <tr>
                                                <td style={{ padding: "3px 0", color: "#78350F" }}>Total Nominal Kasbon</td>
                                                <td style={{ padding: "3px 0", textAlign: "right", color: "#78350F" }}>Rp {kasbonInfo.totalNominal.toLocaleString("id-ID")}</td>
                                            </tr>
                                            <tr>
                                                <td style={{ padding: "3px 0", color: "#78350F" }}>Sudah Dibayar (termasuk slip ini)</td>
                                                <td style={{ padding: "3px 0", textAlign: "right", color: "#78350F" }}>Rp {kasbonInfo.totalTerbayar.toLocaleString("id-ID")}</td>
                                            </tr>
                                            {row.kasbon > 0 && (
                                                <tr>
                                                    <td style={{ padding: "2px 0 2px 12px", color: "#92400E", fontSize: 10 }}>↳ Potongan Kasbon Slip Ini</td>
                                                    <td style={{ padding: "2px 0", textAlign: "right", color: "#92400E", fontSize: 10 }}>Rp {row.kasbon.toLocaleString("id-ID")}</td>
                                                </tr>
                                            )}
                                            <tr style={{ borderTop: "1px solid #FDE68A" }}>
                                                <td style={{ padding: "7px 0 3px", fontWeight: 900, fontSize: 12, color: "#78350F" }}>SISA TAGIHAN KASBON</td>
                                                <td style={{ padding: "7px 0 3px", textAlign: "right", fontWeight: 900, fontSize: 14, color: "#B91C1C" }}>Rp {kasbonInfo.sisa.toLocaleString("id-ID")}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

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
    alamat: "", bpjs_tk: 0, bpjs_kes: 0, catatan: "", periode_gaji: "",
};

function KaryawanModal({ initial, onSave, onClose }: {
    initial?: DataKaryawan; onSave: (d: Omit<DataKaryawan, "id">) => void; onClose: () => void;
}) {
    const [f, setF] = useState<Omit<DataKaryawan, "id">>(initial ? { ...initial } : EMPTY_K);
    const [saving, setSaving] = useState(false);
    
    const set = (k: keyof typeof EMPTY_K, v: string | number) =>
        setF(p => ({ ...p, [k]: v }));
    
    const handleSave = async () => {
        if (!f.nama) return;
        setSaving(true);
        try {
            await onSave(f);
            onClose();
        } catch (err) {
            console.error(err);
            setSaving(false);
        }
    };

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
                    <div style={{ gridColumn: "1 / -1" }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>TIPE GAJIAN</label>
                        <select value={f.periode_gaji ?? ""} onChange={e => set("periode_gaji", e.target.value)} style={inp}>
                            <option value="">Otomatis (punya gaji harian → mingguan, selain itu bulanan)</option>
                            <option value="mingguan">Mingguan (gajian tiap Sabtu)</option>
                            <option value="bulanan">Bulanan (gajian akhir bulan)</option>
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
                    <button onClick={onClose} disabled={saving} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>Batal</button>
                    <button onClick={handleSave} disabled={saving}
                        style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: saving ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                        {saving ? "⏳ Menyimpan..." : "Simpan"}
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
   TAB 2: DATA GAJI — otomatis dari absensi.
   Periode mingguan Senin–Sabtu (gajian Sabtu, bisa digeser Jumat)
   atau bulanan penuh. Hari kerja/lembur terisi dari absensi
   (setengah hari bila pulang < 13:00; Minggu = lembur), semua angka
   tetap bisa dioverride sebelum disimpan. Telat tidak memotong —
   hanya keterangan slip. Total tersimpan bisa dicatat ke Keuangan.
================================================================ */
const TIPE_LABEL: Record<TipeGajian, string> = { mingguan: "Mingguan", bulanan: "Bulanan" };
const HARI_PENDEK = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const hariChip = (iso: string) => `${HARI_PENDEK[new Date(iso + "T00:00:00").getDay()]} ${Number(iso.slice(8, 10))}`;

function TabDataGaji() {
    const { karyawan, gaji, upsertGaji, kasbon } = useKaryawan();
    const { bankAccounts, addCashFlow } = useStore();
    const { user } = useAuth();
    const now = new Date();

    /* -- Periode -- */
    const [tipe, setTipe] = useState<TipeGajian>("mingguan");
    // Mingguan = rentang kalender bebas; default minggu berjalan (Senin–Sabtu).
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const defaultMinggu = useMemo(() => mingguPeriode(todayISO), [todayISO]);
    const [rMulai, setRMulai] = useState(defaultMinggu.mulai);
    const [rSelesai, setRSelesai] = useState(defaultMinggu.selesai);
    const [bMonth, setBMonth] = useState(now.getMonth() + 1);
    const [bYear, setBYear] = useState(now.getFullYear());
    const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 1 + i);
    const periode: PeriodeGaji = tipe === "mingguan"
        ? periodeKustom(rMulai, rSelesai)
        : bulanPeriode(bYear, bMonth);
    // Tanggal gajian: default Sabtu / akhir bulan — geser ke Jumat bila Sabtu libur.
    const [tglGajian, setTglGajian] = useState(periode.gajian);
    useEffect(() => { setTglGajian(periode.gajian); }, [periode.gajian]);

    /* -- Absensi periode (fetch langsung — rentang kecil) -- */
    const [absensi, setAbsensi] = useState<AbsensiLike[]>([]);
    const [absLoading, setAbsLoading] = useState(true);
    useEffect(() => {
        let cancel = false;
        setAbsLoading(true);
        (async () => {
            const all: AbsensiLike[] = [];
            let from = 0;
            while (true) {
                const { data, error } = await supabase.from("absensi")
                    .select("karyawan_id, tanggal, jam_masuk, jam_keluar, is_telat, selisih_menit, overtime_hours")
                    .gte("tanggal", periode.mulai).lte("tanggal", periode.selesai)
                    .order("id", { ascending: true }).range(from, from + 999);
                if (error || !data) break;
                all.push(...(data as unknown as AbsensiLike[]));
                if (data.length < 1000) break;
                from += 1000;
            }
            if (!cancel) { setAbsensi(all); setAbsLoading(false); }
        })();
        return () => { cancel = true; };
    }, [periode.mulai, periode.selesai]);

    /* -- Rekap kehadiran per karyawan (mesin: lib/gaji-absensi) -- */
    const kehadiranOf = useMemo(() => {
        const byK: Record<number, AbsensiLike[]> = {};
        absensi.forEach(a => { (byK[a.karyawan_id] ??= []).push(a); });
        const m = new Map<number, KehadiranSummary>();
        Object.entries(byK).forEach(([id, rows]) => m.set(Number(id), hitungKehadiran(rows, periode)));
        return m;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [absensi, periode.mulai, periode.selesai]);

    /* -- Karyawan sesuai tipe gajian -- */
    const listKaryawan = useMemo(() => karyawan.filter(k => tipeGajianOf(k) === tipe), [karyawan, tipe]);
    const [selectedKId, setSelectedKId] = useState<number>(0);
    useEffect(() => {
        if (listKaryawan.length && !listKaryawan.some(k => k.id === selectedKId)) setSelectedKId(listKaryawan[0].id);
    }, [listKaryawan, selectedKId]);
    const selectedK = listKaryawan.find(k => k.id === selectedKId);

    const getGaji = (kId: number) => gaji.find(g => g.karyawan_id === kId && g.periode === periode.key);

    /* Sisa kasbon (belum teralokasi potongan gaji periode LAIN) — saran cicilan. */
    const sisaKasbonOf = (kId: number) => {
        const totalKasbon = kasbon.filter(b => b.karyawan_id === kId).reduce((s, b) => s + b.nominal - (b.bayar || 0), 0);
        const totalPotong = gaji.filter(g => g.karyawan_id === kId && g.kasbon_potong > 0 && g.periode !== periode.key)
            .reduce((s, g) => s + g.kasbon_potong, 0);
        return Math.max(0, totalKasbon - totalPotong);
    };

    /* -- Form: angka final (default dari absensi / record tersimpan) -- */
    const [form, setForm] = useState({ hari_kerja: 0, hari_lembur: 0, tunjangan: 0, kasbon_potong: 0, potongan_lain: 0, bpjs_tk: 0, bpjs_kes: 0 });
    const [hasResult, setHasResult] = useState(false);
    const [printRekap, setPrintRekap] = useState(false);
    const [printSlip, setPrintSlip] = useState(false);
    const [showCatat, setShowCatat] = useState(false);

    const keh = kehadiranOf.get(selectedKId);
    useEffect(() => {
        if (absLoading) return;
        const g = getGaji(selectedKId);
        const kh = kehadiranOf.get(selectedKId);
        const k = listKaryawan.find(x => x.id === selectedKId);
        if (g) {
            setForm({
                hari_kerja: g.hari_kerja ?? 0, hari_lembur: g.hari_lembur ?? 0,
                tunjangan: g.tunjangan ?? 0, kasbon_potong: g.kasbon_potong ?? 0,
                potongan_lain: g.potongan_lain ?? 0,
                bpjs_tk: g.bpjs_tk ?? k?.bpjs_tk ?? 0, bpjs_kes: g.bpjs_kes ?? k?.bpjs_kes ?? 0,
            });
            setHasResult(true);
        } else {
            setForm({
                hari_kerja: kh?.hariKerja ?? 0, hari_lembur: kh?.hariLembur ?? 0,
                tunjangan: 0, kasbon_potong: 0, potongan_lain: 0,
                bpjs_tk: k?.bpjs_tk ?? 0, bpjs_kes: k?.bpjs_kes ?? 0,
            });
            setHasResult(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKId, periode.key, absLoading, kehadiranOf, gaji]);

    /* -- Hitungan -- */
    const effectiveHarian = selectedK ? tarifHarianOf(selectedK.gaji_harian, selectedK.gaji_pokok) : 0;
    const tarifLembur = selectedK ? (selectedK.tarif_lembur || effectiveHarian) : 0;
    const base = Math.round(effectiveHarian * form.hari_kerja);
    const lemburNominal = Math.round(tarifLembur * form.hari_lembur);
    const totalPendapatan = base + lemburNominal + form.tunjangan;
    const totalPotongan = form.kasbon_potong + form.potongan_lain + form.bpjs_tk + form.bpjs_kes;
    const bersih = totalPendapatan - totalPotongan;

    const hitungDanSimpan = () => {
        if (!selectedK) return;
        const kh = kehadiranOf.get(selectedK.id);
        const autoMatch = !!kh && form.hari_kerja === kh.hariKerja && form.hari_lembur === kh.hariLembur;
        upsertGaji({
            karyawan_id: selectedK.id, periode: periode.key,
            gaji_pokok: base, hari_kerja: form.hari_kerja, hari_lembur: form.hari_lembur,
            lembur: lemburNominal, tunjangan: form.tunjangan,
            kasbon_potong: form.kasbon_potong, potongan_lain: form.potongan_lain,
            bpjs_tk: form.bpjs_tk, bpjs_kes: form.bpjs_kes,
            catatan: "",
            periode_mulai: periode.mulai, periode_selesai: periode.selesai,
            tanggal_gajian: tglGajian,
            telat_count: kh?.telatCount ?? 0, telat_menit: kh?.telatMenit ?? 0,
            sumber_hitung: autoMatch ? "absensi" : "manual",
        });
        setHasResult(true);
    };

    /* -- Rekap semua karyawan tipe ini (tersimpan; kalau belum → preview absensi) -- */
    const gajiRows: GajiInfo[] = listKaryawan.map(k => {
        const g = getGaji(k.id);
        const kh = kehadiranOf.get(k.id);
        const effHarian = tarifHarianOf(k.gaji_harian, k.gaji_pokok);
        const hk = g?.hari_kerja ?? kh?.hariKerja ?? 0;
        const hl = g?.hari_lembur ?? kh?.hariLembur ?? 0;
        const b = g?.gaji_pokok ?? Math.round(effHarian * hk);
        const lembur = g?.lembur ?? Math.round((k.tarif_lembur || effHarian) * hl);
        const tunjangan = g?.tunjangan ?? 0;
        const kasbonP = g?.kasbon_potong ?? 0;
        const potongan = g?.potongan_lain ?? 0;
        const bTk = g?.bpjs_tk ?? k.bpjs_tk ?? 0;
        const bKes = g?.bpjs_kes ?? k.bpjs_kes ?? 0;
        const net = b + lembur + tunjangan - kasbonP - potongan - bTk - bKes;
        return { karyawan: k, base: b, lembur, tunjangan, kasbon: kasbonP, potongan, bpjs_tk: bTk, bpjs_kes: bKes, bersihPos: b + lembur + tunjangan, bersihNeg: kasbonP + potongan + bTk + bKes, bersih: net };
    });
    const totalBersih = gajiRows.reduce((s, r) => s + r.bersih, 0);
    const savedRows = listKaryawan.map(k => getGaji(k.id)).filter(Boolean) as GajiRecord[];
    const savedTotal = savedRows.reduce((s, g) => s + (g.gaji_pokok + g.lembur + g.tunjangan - g.kasbon_potong - g.potongan_lain - (g.bpjs_tk ?? 0) - (g.bpjs_kes ?? 0)), 0);
    const sudahDicatat = savedRows.find(g => (g.cash_flow_id ?? "") !== "")?.cash_flow_id ?? "";

    /* -- Catat total tersimpan ke Keuangan (cash_flow, kategori Gaji) -- */
    const catatKeKeuangan = (accountId: string, amount: number, date: string) => {
        const acc = bankAccounts.find(b => b.id === accountId);
        if (!acc || savedRows.length === 0) return;
        const cf = addCashFlow({
            type: "expense", category: "Gaji", amount,
            description: `Gaji karyawan ${TIPE_LABEL[tipe].toLowerCase()} periode ${periode.label} (${savedRows.length} orang)`,
            date, bankAccount: acc.name, accountId: acc.id,
            createdBy: user?.name ?? user?.username ?? "",
        });
        supabase.from("gaji").update({ cash_flow_id: cf.id }).in("id", savedRows.map(g => g.id)).then();
        setShowCatat(false);
        alert(`✅ Tercatat di Keuangan: ${fmtRp(amount)} dari ${acc.name}.`);
    };

    /* -- Slip: keterangan telat (dari record tersimpan / absensi) -- */
    const slipTelat = (() => {
        const g = getGaji(selectedKId);
        return keteranganTelat(g?.telat_count ?? keh?.telatCount ?? 0, g?.telat_menit ?? keh?.telatMenit ?? 0);
    })();

    const exportExcel = () => {
        const data = gajiRows.map(r => ({
            "Nama": r.karyawan.nama,
            "Hari Kerja": getGaji(r.karyawan.id)?.hari_kerja ?? "-",
            "Gaji Harian/Pokok": r.base, "Hari Lembur": getGaji(r.karyawan.id)?.hari_lembur ?? 0,
            "Lembur": r.lembur, "Tunjangan": r.tunjangan,
            "Kasbon Potong": r.kasbon, "Potongan Lain": r.potongan,
            "BPJS TK": r.bpjs_tk, "BPJS Kes": r.bpjs_kes,
            "Gaji Bersih": r.bersih,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Gaji");
        XLSX.writeFile(wb, `gaji-${tipe}-${periode.mulai}.xlsx`);
    };

    const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 4 };
    const field: React.CSSProperties = { ...inp, marginBottom: 0 };
    const hint: React.CSSProperties = { fontSize: 10, color: "#A67B5B", marginTop: 3, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" };
    const periodeLabel = `${TIPE_LABEL[tipe]} ${periode.label}`;

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>

            {/* -- Toolbar -- */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                {/* Tipe gajian */}
                <div style={{ display: "flex", gap: 3, background: "#FEF3E8", borderRadius: 7, padding: 3, border: "1px solid #D1BFA3" }}>
                    {(["mingguan", "bulanan"] as TipeGajian[]).map(t => (
                        <button key={t} onClick={() => setTipe(t)}
                            style={{ border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", background: tipe === t ? "#A67B5B" : "transparent", color: tipe === t ? "white" : "#A67B5B" }}>
                            {TIPE_LABEL[t]}
                        </button>
                    ))}
                </div>
                {/* Periode — kalender bebas: pilih mulai → selesai otomatis +5 hari (bisa diubah) */}
                {tipe === "mingguan" ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 0.5 }}>PERIODE</span>
                        <input type="date" value={rMulai}
                            onChange={e => { const v = e.target.value; if (!v) return; setRMulai(v); setRSelesai(isoAddDays(v, 5)); }}
                            title="Tanggal awal periode (Senin)"
                            style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "4px 6px", fontSize: 11, fontWeight: 700, color: "#5C4033", background: "#FFFBF7" }} />
                        <span style={{ fontSize: 11, color: "#B89678" }}>s.d.</span>
                        <input type="date" value={rSelesai} min={rMulai}
                            onChange={e => { const v = e.target.value; if (!v) return; setRSelesai(v); }}
                            title="Tanggal akhir periode (mis. Sabtu, atau 31 di akhir bulan)"
                            style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "4px 6px", fontSize: 11, fontWeight: 700, color: "#5C4033", background: "#FFFBF7" }} />
                    </div>
                ) : (
                    <div style={{ display: "flex", gap: 4 }}>
                        <select value={bMonth} onChange={e => setBMonth(+e.target.value)}
                            style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 700, color: "#5C4033", background: "#FFFBF7" }}>
                            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select value={bYear} onChange={e => setBYear(+e.target.value)}
                            style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 8px", fontSize: 11, fontWeight: 700, color: "#5C4033", background: "#FFFBF7" }}>
                            {years.map(y => <option key={y}>{y}</option>)}
                        </select>
                    </div>
                )}
                {/* Tanggal gajian (geser ke Jumat bila Sabtu libur) */}
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 0.5 }}>GAJIAN</span>
                    <input type="date" value={tglGajian} onChange={e => setTglGajian(e.target.value)}
                        title="Default Sabtu / akhir bulan — geser bila hari itu libur"
                        style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "4px 6px", fontSize: 11, color: "#5C4033", background: "#FFFBF7" }} />
                </div>
                {absLoading && <span style={{ fontSize: 11, color: "#B89678" }}>⏳ memuat absensi…</span>}
                {/* Total */}
                <div style={{ background: "#F0FDF4", borderLeft: "4px solid #15803D", borderRadius: 6, padding: "5px 12px" }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "#B89678", letterSpacing: 1 }}>TOTAL {TIPE_LABEL[tipe].toUpperCase()} · {savedRows.length}/{listKaryawan.length} TERSIMPAN</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#15803D" }}>{fmtRp(totalBersih)}</div>
                </div>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={exportExcel} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 12px", fontSize: 11, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 }}>⬇ Excel</button>
                    <button onClick={() => setPrintRekap(true)} style={{ border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, background: "#A67B5B", color: "white", cursor: "pointer", fontWeight: 700 }}>🖨️ Cetak Rekap</button>
                    <button onClick={() => setShowCatat(true)} disabled={savedRows.length === 0}
                        title={savedRows.length === 0 ? "Simpan gaji minimal 1 karyawan dulu" : sudahDicatat ? "Periode ini sudah pernah dicatat ke Keuangan" : "Catat total gaji tersimpan sebagai pengeluaran di Keuangan"}
                        style={{ border: "none", borderRadius: 6, padding: "5px 14px", fontSize: 11, background: sudahDicatat ? "#DCFCE7" : "#15803D", color: sudahDicatat ? "#15803D" : "white", cursor: savedRows.length === 0 ? "not-allowed" : "pointer", fontWeight: 700, opacity: savedRows.length === 0 ? 0.5 : 1 }}>
                        {sudahDicatat ? "✓ Tercatat di Keuangan" : "💰 Catat ke Keuangan"}
                    </button>
                </div>
            </div>

            {/* -- Body: Kalkulator (kiri) + Hasil (kanan) -- */}
            <div style={{ flex: 1, overflow: "auto", padding: 20, background: "#F5EBDD" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, maxWidth: 900, margin: "0 auto" }}>

                    {/* -- KIRI: Kalkulator -- */}
                    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#5C4033", marginBottom: 18 }}>Gaji dari Absensi</div>

                        {/* Pilih Karyawan */}
                        <div style={{ marginBottom: 14 }}>
                            <label style={lbl}>PILIH KARYAWAN ({TIPE_LABEL[tipe].toUpperCase()})</label>
                            <select value={selectedKId} onChange={e => setSelectedKId(+e.target.value)} style={field}>
                                {listKaryawan.map(k => <option key={k.id} value={k.id}>{k.nama} - {k.jabatan}</option>)}
                            </select>
                            {selectedK && (
                                <div style={{ marginTop: 6, padding: "6px 10px", background: "#FEF3E8", borderRadius: 6, fontSize: 11, color: "#A67B5B", display: "flex", gap: 14, flexWrap: "wrap" }}>
                                    <span>📁 {selectedK.divisi}</span>
                                    <span>💰 Rp {effectiveHarian.toLocaleString("id-ID")}/hari{selectedK.gaji_pokok && !selectedK.gaji_harian ? ` (pokok/26)` : ""}</span>
                                    {keh && keh.telatCount > 0 && <span style={{ color: "#B8860B" }}>⏰ telat {keh.telatCount}× ({keh.telatMenit} mnt)</span>}
                                </div>
                            )}
                            {/* Rincian kehadiran periode ini */}
                            {selectedK && !absLoading && (
                                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {(keh?.detail ?? []).length === 0 ? (
                                        <span style={{ fontSize: 10.5, color: "#C5A882" }}>Tidak ada absensi pada periode ini.</span>
                                    ) : keh!.detail.map(h => (
                                        <span key={h.tanggal}
                                            title={`${h.tanggal} · masuk ${h.jamMasuk || "-"} · pulang ${h.jamKeluar || "-"}${h.nilai === 0.5 ? ` · setengah hari (pulang < ${HALF_DAY_CUTOFF})` : ""}${h.isMinggu ? " · Minggu → lembur" : ""}${h.lembur > 0 && !h.isMinggu ? ` · lembur ${h.lembur} hr` : ""}${h.telat ? ` · telat ${h.telatMenit} mnt` : ""}`}
                                            style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: h.isMinggu || h.lembur > 0 ? "#FEF9C3" : "#DCFCE7", color: h.isMinggu || h.lembur > 0 ? "#A16207" : "#15803D", border: h.telat ? "1px dashed #B8860B" : "1px solid transparent" }}>
                                            {hariChip(h.tanggal)}{h.nilai === 0.5 ? "·½" : ""}{h.lembur > 0 && !h.isMinggu ? ` +L${h.lembur}` : ""}{h.telat ? " ⏰" : ""}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Input grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                            <div>
                                <label style={lbl}>HARI KERJA</label>
                                <input type="number" min={0} max={31} step={0.5} value={form.hari_kerja}
                                    onChange={e => { setForm(p => ({ ...p, hari_kerja: +e.target.value })); setHasResult(false); }}
                                    style={field} />
                                <div style={hint}>
                                    <span>dari absensi: {keh?.hariKerja ?? 0} hr</span>
                                    {keh && form.hari_kerja !== keh.hariKerja && (
                                        <button onClick={() => setForm(p => ({ ...p, hari_kerja: keh.hariKerja }))}
                                            style={{ border: "1px dashed #D1BFA3", background: "none", borderRadius: 5, padding: "0 6px", fontSize: 9.5, color: "#A67B5B", cursor: "pointer" }}>↻ pakai</button>
                                    )}
                                </div>
                            </div>
                            <div>
                                <label style={lbl}>HARI LEMBUR</label>
                                <input type="number" min={0} max={10} step={0.5} value={form.hari_lembur}
                                    onChange={e => { setForm(p => ({ ...p, hari_lembur: +e.target.value })); setHasResult(false); }}
                                    style={field} />
                                <div style={hint}>
                                    <span title="Lembur harian yang dicatat kiosk saat absen pulang + kehadiran hari Minggu">dari absensi: {keh?.hariLembur ?? 0} hr</span>
                                    {keh && form.hari_lembur !== keh.hariLembur && (
                                        <button onClick={() => setForm(p => ({ ...p, hari_lembur: keh.hariLembur }))}
                                            style={{ border: "1px dashed #D1BFA3", background: "none", borderRadius: 5, padding: "0 6px", fontSize: 9.5, color: "#A67B5B", cursor: "pointer" }}>↻ pakai</button>
                                    )}
                                </div>
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
                                    placeholder="0 (cicilan bebas)" style={field} />
                                {selectedK && sisaKasbonOf(selectedK.id) > 0 && (
                                    <div style={hint}>
                                        <span style={{ color: "#B8860B" }}>sisa kasbon {fmtRp(sisaKasbonOf(selectedK.id))}</span>
                                        <button onClick={() => { const s = sisaKasbonOf(selectedK.id); setForm(p => ({ ...p, kasbon_potong: s })); setHasResult(false); }}
                                            style={{ border: "1px dashed #D9B96A", background: "none", borderRadius: 5, padding: "0 6px", fontSize: 9.5, color: "#B8860B", cursor: "pointer" }}>potong semua</button>
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={lbl}>POTONGAN LAIN (Rp)</label>
                                <input type="number" min={0} value={form.potongan_lain || ""}
                                    onChange={e => { setForm(p => ({ ...p, potongan_lain: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                            <div />
                            <div style={{ borderTop: "1px dashed #E6D5BE", gridColumn: "1 / -1", marginTop: 4, paddingTop: 8 }}>
                                <label style={{ ...lbl, color: "#A67B5B" }}>POTONGAN BPJS (OTOMATIS DARI DATA KARYAWAN)</label>
                            </div>
                            <div>
                                <label style={lbl}>BPJS TK (Rp)</label>
                                <input type="number" min={0} value={form.bpjs_tk || ""}
                                    onChange={e => { setForm(p => ({ ...p, bpjs_tk: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                            <div>
                                <label style={lbl}>BPJS KES (Rp)</label>
                                <input type="number" min={0} value={form.bpjs_kes || ""}
                                    onChange={e => { setForm(p => ({ ...p, bpjs_kes: +e.target.value })); setHasResult(false); }}
                                    placeholder="0" style={field} />
                            </div>
                        </div>

                        <button onClick={hitungDanSimpan}
                            style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none", background: "#A67B5B", color: "white", fontSize: 14, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>
                            💾 Simpan Gaji Periode Ini
                        </button>
                    </div>

                    {/* -- KANAN: Hasil -- */}
                    <div style={{ background: "white", borderRadius: 12, padding: 24, boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#5C4033", marginBottom: 18, display: "flex", alignItems: "center", gap: 8 }}>
                            Hasil Perhitungan
                            {hasResult && <span style={{ fontSize: 10, background: "#D1FAE5", color: "#15803D", padding: "2px 8px", borderRadius: 10, fontWeight: 700, marginLeft: "auto" }}>✓ Tersimpan</span>}
                        </div>

                        {!selectedK ? (
                            <div style={{ color: "#C5A882", textAlign: "center", marginTop: 40, fontSize: 13 }}>
                                {listKaryawan.length === 0 ? `Tidak ada karyawan bertipe gajian ${TIPE_LABEL[tipe].toLowerCase()}.` : "Pilih karyawan terlebih dahulu"}
                            </div>
                        ) : (
                            <>
                                <div style={{ borderBottom: "1px solid #E6D5BE", paddingBottom: 12, marginBottom: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 800, color: "#15803D", letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>{'>'} Pendapatan · {periodeLabel}</div>
                                    {[
                                        { l: `Gaji Harian (Rp ${effectiveHarian.toLocaleString("id-ID")}) × ${form.hari_kerja} hari`, v: base },
                                        ...(form.hari_lembur > 0 ? [{ l: `Lembur (Rp ${tarifLembur.toLocaleString("id-ID")}) × ${form.hari_lembur} hari`, v: lemburNominal }] : []),
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
                                            ...(form.bpjs_tk > 0 ? [{ l: "BPJS TK", v: form.bpjs_tk }] : []),
                                            ...(form.bpjs_kes > 0 ? [{ l: "BPJS Kes", v: form.bpjs_kes }] : []),
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

                                {keh && keh.telatCount > 0 && (
                                    <div style={{ fontSize: 10.5, color: "#92400E", background: "#FFFBEB", border: "1px dashed #D9B96A", borderRadius: 6, padding: "6px 10px", marginBottom: 12 }}>
                                        ⏰ Telat {keh.telatCount}× (total {keh.telatMenit} menit) — tidak memotong gaji, tercantum di slip.
                                    </div>
                                )}

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

                {/* -- Rekap tabel -- */}
                <div style={{ maxWidth: 900, margin: "16px auto 0", background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.07)" }}>
                    <div style={{ padding: "12px 20px", borderBottom: "1px solid #E6D5BE", fontWeight: 800, fontSize: 13, color: "#5C4033", display: "flex", justifyContent: "space-between" }}>
                        <span>📊 Rekap {periodeLabel} · gajian {fmtDate(tglGajian)}</span>
                        <span style={{ color: "#B89678", fontWeight: 600, fontSize: 11 }}>{savedRows.length}/{listKaryawan.length} tersimpan</span>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr style={{ background: "#EDE0D4" }}>
                                {["Nama", "Divisi", "Hadir", "Lembur", "Telat", "Tarif", "Take Home Pay", ""].map(h => (
                                    <th key={h} style={{ padding: "8px 12px", textAlign: ["Hadir", "Lembur", "Telat", "Take Home Pay"].includes(h) ? "center" : "left", fontWeight: 700, fontSize: 11, color: "#5C4033", borderBottom: "2px solid #C5A882" }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gajiRows.map((r, i) => {
                                const g = getGaji(r.karyawan.id);
                                const kh = kehadiranOf.get(r.karyawan.id);
                                const isSelected = r.karyawan.id === selectedKId;
                                return (
                                    <tr key={r.karyawan.id} style={{ background: isSelected ? "#FEF3E8" : i % 2 === 0 ? "white" : "#FAFAF8", cursor: "pointer" }}
                                        onClick={() => setSelectedKId(r.karyawan.id)}>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", fontWeight: 700 }}>
                                            {isSelected && <span style={{ color: "#A67B5B", marginRight: 4 }}>{'>'}</span>}{r.karyawan.nama}
                                            {g?.sumber_hitung === "manual" && <span title="Angka dioverride manual" style={{ marginLeft: 5, fontSize: 9, color: "#B8860B" }}>✎</span>}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", color: "#6B5E55" }}>{r.karyawan.divisi}</td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center" }}>
                                            <span style={{ background: "#FEF3E8", borderRadius: 5, padding: "2px 8px", color: "#A67B5B", fontWeight: 700 }}>{g?.hari_kerja ?? kh?.hariKerja ?? 0} hr</span>
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center" }}>
                                            {(g?.hari_lembur ?? kh?.hariLembur ?? 0) > 0
                                                ? <span style={{ background: "#FEF9C3", borderRadius: 5, padding: "2px 8px", color: "#A16207", fontWeight: 700 }}>{g?.hari_lembur ?? kh?.hariLembur} hr</span>
                                                : <span style={{ color: "#D1BFA3" }}>-</span>}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center", fontSize: 11 }}>
                                            {(g?.telat_count ?? kh?.telatCount ?? 0) > 0
                                                ? <span title={`${g?.telat_menit ?? kh?.telatMenit ?? 0} menit`} style={{ color: "#B8860B", fontWeight: 700 }}>⏰ {g?.telat_count ?? kh?.telatCount}×</span>
                                                : <span style={{ color: "#D1BFA3" }}>-</span>}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", color: "#6B5E55" }}>
                                            {fmtRp(tarifHarianOf(r.karyawan.gaji_harian, r.karyawan.gaji_pokok))}
                                        </td>
                                        <td style={{ padding: "7px 12px", borderBottom: "1px solid #E6D5BE", textAlign: "center", fontWeight: 800, color: g ? "#15803D" : "#B89678" }}>
                                            {fmtRp(r.bersih)}{!g && <span style={{ fontWeight: 600, fontSize: 9, marginLeft: 4, color: "#C5A882" }}>(preview)</span>}
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
                                <td colSpan={6} style={{ padding: "8px 12px", fontWeight: 700, fontSize: 12, color: "#5C4033" }}>TOTAL — {periodeLabel}</td>
                                <td style={{ padding: "8px 12px", textAlign: "center", fontWeight: 800, fontSize: 13, color: "#15803D" }}>{fmtRp(totalBersih)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            {/* Print & Catat Modals */}
            {printRekap && <PrintRekapModal rows={gajiRows} periode={periodeLabel} onClose={() => setPrintRekap(false)} />}
            {printSlip && selectedK && (
                <PrintSlipModal row={{
                    karyawan: selectedK, base, lembur: lemburNominal, tunjangan: form.tunjangan,
                    kasbon: form.kasbon_potong, potongan: form.potongan_lain,
                    bpjs_tk: form.bpjs_tk, bpjs_kes: form.bpjs_kes,
                    bersihPos: totalPendapatan, bersihNeg: totalPotongan, bersih,
                }} periode={periodeLabel} catatanTelat={slipTelat} onClose={() => setPrintSlip(false)} />
            )}
            {showCatat && (
                <CatatKeuanganModal
                    total={savedTotal} jumlahOrang={savedRows.length} label={periodeLabel}
                    defaultDate={tglGajian} bankAccounts={bankAccounts} sudahDicatat={!!sudahDicatat}
                    onSubmit={catatKeKeuangan} onClose={() => setShowCatat(false)} />
            )}
        </div>
    );
}

/* -- Modal: catat total gaji tersimpan sebagai pengeluaran di Keuangan -- */
function CatatKeuanganModal({ total, jumlahOrang, label, defaultDate, bankAccounts, sudahDicatat, onSubmit, onClose }: {
    total: number; jumlahOrang: number; label: string; defaultDate: string;
    bankAccounts: { id: string; name: string }[]; sudahDicatat: boolean;
    onSubmit: (accountId: string, amount: number, date: string) => void; onClose: () => void;
}) {
    const [accountId, setAccountId] = useState(bankAccounts[0]?.id ?? "");
    const [amount, setAmount] = useState(total);
    const [date, setDate] = useState(defaultDate);
    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "white", borderRadius: 12, padding: 24, width: "min(95vw,440px)", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F", marginBottom: 6 }}>💰 Catat ke Keuangan</div>
                <div style={{ fontSize: 12, color: "#8A6D55", marginBottom: 14 }}>
                    Pengeluaran kategori <strong>Gaji</strong>: {label} · {jumlahOrang} karyawan tersimpan.
                </div>
                {sudahDicatat && (
                    <div style={{ background: "#FEF9C3", border: "1px solid #FDE68A", borderRadius: 8, padding: "8px 12px", fontSize: 11.5, color: "#92400E", marginBottom: 12 }}>
                        ⚠️ Periode ini <strong>sudah pernah dicatat</strong> ke Keuangan. Melanjutkan akan membuat entri BARU —
                        pastikan tidak dobel (hapus entri lama di menu Keuangan bila perlu).
                    </div>
                )}
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>DARI AKUN KAS</label>
                    <select value={accountId} onChange={e => setAccountId(e.target.value)} style={inp}>
                        {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                </div>
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>NOMINAL (Rp)</label>
                    <input type="number" min={0} value={amount || ""} onChange={e => setAmount(+e.target.value)} style={inp} />
                    <div style={{ fontSize: 10, color: "#A67B5B", marginTop: 3 }}>Total gaji tersimpan: {fmtRp(total)}</div>
                </div>
                <div style={{ marginBottom: 10 }}>
                    <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, display: "block", marginBottom: 3 }}>TANGGAL</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                    <button onClick={onClose} style={{ padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>Batal</button>
                    <button onClick={() => { if (accountId && amount > 0) onSubmit(accountId, amount, date); }}
                        disabled={!accountId || amount <= 0}
                        style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#15803D", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        Catat Pengeluaran
                    </button>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   TAB 3: KASBON / BON KARYAWAN
================================================================ */
function TabKasbon() {
    const { karyawan, kasbon, gaji, addKasbon, updateKasbon, deleteKasbon } = useKaryawan();
    const [search, setSearch] = useState("");
    const [filterKId, setFilterKId] = useState<number | "all">("all");
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ karyawan_id: 0, tanggal: new Date().toISOString().slice(0, 10), nominal: 0, bayar: 0, keterangan: "" });

    const kasbonWithAuto = React.useMemo(() => {
        // Kelompokkan potongan kasbon per karyawan, per slip gaji (bukan dipukul rata jadi satu pool).
        const gajiByKaryawan: Record<number, typeof gaji> = {};
        gaji.forEach(g => {
            if (g.kasbon_potong > 0) {
                (gajiByKaryawan[g.karyawan_id] ||= []).push(g);
            }
        });

        const arr = JSON.parse(JSON.stringify(kasbon)) as (typeof kasbon[0] & { auto_bayar: number })[];
        arr.forEach(b => { b.auto_bayar = 0; });

        const grouped: Record<number, typeof arr> = {};
        arr.forEach(b => {
            (grouped[b.karyawan_id] ||= []).push(b);
        });

        for (const kId in grouped) {
            // Urutkan kasbon dari yang paling lama (tanggal dibuat).
            const kasbonList = grouped[kId].sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.id - b.id);
            // Proses slip gaji secara kronologis, dari periode paling lama.
            const gajiList = (gajiByKaryawan[kId] || []).sort((a, b) => a.periode.localeCompare(b.periode));

            gajiList.forEach(g => {
                let sisaPotongan = g.kasbon_potong;
                const periodeEnd = periodeToDate(g.periode);
                for (const b of kasbonList) {
                    if (sisaPotongan <= 0) break;
                    // Kasbon yang dibuat SETELAH slip gaji ini tidak mungkin sudah dipotong di situ.
                    if (b.tanggal > periodeEnd) continue;
                    const gap = b.nominal - (b.bayar || 0) - b.auto_bayar;
                    if (gap > 0) {
                        const deduct = Math.min(gap, sisaPotongan);
                        b.auto_bayar += deduct;
                        sisaPotongan -= deduct;
                    }
                }
            });
        }
        return arr;
    }, [kasbon, gaji]);

    const filtered = kasbonWithAuto.filter(b => {
        const k = karyawan.find(k => k.id === b.karyawan_id);
        if (filterKId !== "all" && b.karyawan_id !== filterKId) return false;
        if (search && !k?.nama.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const totalKasbon = filtered.reduce((s, b) => s + b.nominal, 0);
    const totalSisa = filtered.reduce((s, b) => s + (b.nominal - b.bayar - b.auto_bayar), 0);

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
                            const sisa = b.nominal - b.bayar - b.auto_bayar;
                            const lunas = sisa <= 0;
                            return (
                                <tr key={b.id} style={{ background: lunas ? "#F0FDF4" : (i % 2 === 0 ? "white" : "#FAFAF8") }}>
                                    <td style={{ padding: "7px 10px", textAlign: "center", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", color: "#B89678" }}>{i + 1}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{fmtDate(b.tanggal)}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700 }}>{k?.nama || "-"}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontWeight: 700, color: "#B91C1C" }}>{fmtRp(b.nominal)}</td>
                                    <td style={{ padding: "7px 10px", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>
                                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                            <input type="number" min={0} max={b.nominal - b.auto_bayar} value={b.bayar || ""}
                                                onChange={e => updateKasbon(b.id, { bayar: +e.target.value })}
                                                placeholder="Manual..." title="Hanya diisi jika bayar cash"
                                                style={{ width: 80, border: "1px solid #D1BFA3", borderRadius: 5, padding: "2px 6px", fontSize: 11, textAlign: "right" }} />
                                            {b.auto_bayar > 0 && <span style={{ fontSize: 10, color: "#15803D", fontWeight: 600, background: "#D1FAE5", padding: "2px 6px", borderRadius: 4 }}>+ {fmtRp(b.auto_bayar)} (Gaji)</span>}
                                        </div>
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
function KaryawanPage() {
    const [activeTab, setActiveTab] = useState<"data" | "gaji" | "kasbon">("data");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F5EBDD" }}>
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

// Di HP tampilkan keterangan "buka di komputer" (components/layout/DesktopOnly).
export default function KaryawanPageMobileGuard() {
    return (
        <DesktopOnly label="Karyawan">
            <KaryawanPage />
        </DesktopOnly>
    );
}
