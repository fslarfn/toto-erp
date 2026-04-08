"use client";
import { useState, useMemo } from "react";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";

/* ================================================================
   MENU INVOICE
   Kiri : ringkasan bulanan + form cari invoice
   Kanan: preview invoice real-time → cetak PDF
================================================================ */

const MONTH_NAMES_LONG = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtRp(val: number): string {
    return "Rp " + val.toLocaleString("id-ID");
}

/**
 * Parse angka format Indonesia:
 * - Titik sebagai pemisah ribuan: "230.000" → 230000
 * - Koma sebagai pemisah desimal: "1,7" → 1.7
 * - Mix: "1.700,5" → 1700.5
 */
function parseIdNum(s: string | undefined): number {
    if (!s) return 0;
    const str = s.trim();
    if (str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        return parseFloat(str.replace(/\./g, "")) || 0;
    }
    return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

function fmtDate(iso: string): string {
    if (!iso) return "—";
    const p = iso.split("-");
    if (p.length !== 3) return iso;
    return `${parseInt(p[2])} ${MONTH_NAMES_LONG[parseInt(p[1]) - 1]} ${p[0]}`;
}

/* ── group rows by no_inv ─────────────────────────────────────── */
function groupByInvoice(rows: PesananRow[]): Map<string, PesananRow[]> {
    const map = new Map<string, PesananRow[]>();
    rows.filter((r) => (r.customer || r.deskripsi) && r.no_inv).forEach((r) => {
        const key = r.no_inv.trim();
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(r);
    });
    return map;
}

export default function InvoicePage() {
    const { rows } = usePesanan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [noInvInput, setNoInvInput] = useState("");
    const [searchedInv, setSearchedInv] = useState<string | null>(null);
    const [dp, setDp] = useState("");
    const [diskonRp, setDiskonRp] = useState("");
    const [diskonPct, setDiskonPct] = useState("");

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    /* ── monthly data ────────────────────────────────────────── */
    const monthRows = useMemo(() =>
        rows.filter((r) => {
            if (!(r.customer || r.deskripsi) || !r.no_inv) return false;
            const d = r.tanggal;
            if (!d) return false;
            return parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month;
        }), [rows, month, year]);

    const invoiceMap = useMemo(() => groupByInvoice(monthRows), [monthRows]);
    const allInvNos = useMemo(() => Array.from(invoiceMap.keys()), [invoiceMap]);

    // unique invoice numbers this month
    const totalInvoices = allInvNos.length;
    // "Sudah Bayar" = semua item di invoice itu di_kirim=true
    const sudahBayar = allInvNos.filter((k) => invoiceMap.get(k)!.every((r) => r.di_kirim)).length;
    const belumBayar = totalInvoices - sudahBayar;

    /* ── searched invoice items ──────────────────────────────── */
    const invoiceItems: PesananRow[] = useMemo(() => {
        if (!searchedInv) return [];
        // search across all rows (not just this month)
        const allMap = groupByInvoice(rows);
        return allMap.get(searchedInv.trim()) ?? [];
    }, [rows, searchedInv]);

    const invoiceCustomer = invoiceItems[0]?.customer ?? "";
    const invoiceDate = invoiceItems[0]?.tanggal ?? "";

    /* ── calculations ───────────────────────────────────────── */
    const subtotal = useMemo(() =>
        invoiceItems.reduce((acc, r) => {
            const h = parseIdNum(r.harga);
            const u = parseIdNum(r.ukuran);
            const q = parseIdNum(r.qty);
            return acc + h * u * q;
        }, 0), [invoiceItems]);

    const dpNum = parseIdNum(dp);
    const diskonRpNum = parseIdNum(diskonRp);
    const diskonPctNum = parseFloat(diskonPct.replace(/[^0-9.]/g, "") || "0") || 0;

    // Jika keduanya diisi, prioritas persen
    const effectiveDiskon = diskonPctNum > 0
        ? Math.round(subtotal * diskonPctNum / 100)
        : diskonRpNum;

    const grandTotal = Math.max(0, subtotal - dpNum - effectiveDiskon);

    /* ── print ───────────────────────────────────────────────── */
    const cetakInvoice = () => {
        if (invoiceItems.length === 0) return;

        const tableRows = invoiceItems.map((r, i) => {
            const h = parseIdNum(r.harga);
            const u = parseIdNum(r.ukuran);
            const q = parseIdNum(r.qty);
            const total = h * u * q;
            return `
            <tr>
                <td style="text-align:center">${i + 1}</td>
                <td>${r.deskripsi || "—"}</td>
                <td style="text-align:center">${r.ukuran || "—"}</td>
                <td style="text-align:center">${r.qty || "—"}</td>
                <td style="text-align:right">${h > 0 ? fmtRp(h) : "—"}</td>
                <td style="text-align:right;font-weight:600;color:#A0522D">${total > 0 ? fmtRp(total) : "—"}</td>
            </tr>`;
        }).join("");

        const diskonRow = effectiveDiskon > 0 ? `
            <tr><td colspan="5" style="text-align:right;padding:6px 10px;font-size:12px;color:#555">
                Diskon${diskonPctNum > 0 ? ` (${diskonPctNum}%)` : ""}:</td>
                <td style="text-align:right;padding:6px 10px;color:#DC2626;font-weight:600">- ${fmtRp(effectiveDiskon)}</td>
            </tr>` : "";
        const dpRow = dpNum > 0 ? `
            <tr><td colspan="5" style="text-align:right;padding:6px 10px;font-size:12px;color:#555">
                DP (Down Payment):</td>
                <td style="text-align:right;padding:6px 10px;color:#2563EB;font-weight:600">- ${fmtRp(dpNum)}</td>
            </tr>` : "";

        const win = window.open("", "_blank", "width=820,height=900");
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>Invoice ${searchedInv}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 36px 44px; }
  .kop { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:18px; border-bottom:2px solid #111; }
  .company-name { font-size:20px; font-weight:900; letter-spacing:.3px; color:#111; margin-bottom:4px; }
  .company-info { font-size:11px; color:#555; line-height:1.6; }
  .inv-title { font-size:28px; font-weight:900; color:#111; letter-spacing:1px; }
  .inv-meta { margin-top:8px; }
  .inv-meta table { width:100%; }
  .inv-meta td { padding:3px 0; font-size:12px; }
  .inv-meta td:first-child { color:#555; width:110px; }
  .inv-meta td:last-child { font-weight:600; }
  .items { margin-top:22px; width:100%; border-collapse:collapse; }
  .items thead tr th { background:#111; color:#fff; padding:9px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; text-align:left; }
  .items tbody tr td { padding:8px 10px; border-bottom:1px solid #E5E5E5; font-size:12px; }
  .items tbody tr:nth-child(even) td { background:#FAFAFA; }
  .totals { width:100%; margin-top:4px; border-collapse:collapse; }
  .totals td { padding:5px 10px; font-size:12px; }
  .grand { background:#111; color:#fff; }
  .grand td { padding:10px 10px; font-size:14px; font-weight:800; }
  .footer { margin-top:40px; display:flex; justify-content:space-between; align-items:flex-end; }
  .tagline { font-size:12px; color:#A0522D; font-style:italic; }
  .sign { text-align:center; }
  .sign-line { width:130px; border-top:1px solid #333; margin:0 auto 6px; }
  .sign p { font-size:11px; color:#333; font-weight:600; }
  @media print { body { padding:20px; } }
</style>
</head>
<body>
  <div class="kop">
    <div>
      <div class="company-name">CV. TOTO ALUMINIUM MANUFACTURE</div>
      <div class="company-info">
        Jl. Rawa Mulya, Kota Bekasi<br/>
        Telp: 0813 1191 2002
      </div>
    </div>
    <div style="text-align:right">
      <div class="inv-title">INVOICE</div>
    </div>
  </div>

  <div class="inv-meta">
    <table>
      <tr><td>No. Invoice</td><td>: ${searchedInv}</td></tr>
      <tr><td>Tanggal</td><td>: ${fmtDate(invoiceDate)}</td></tr>
      <tr><td>Customer</td><td>: ${invoiceCustomer.toUpperCase()}</td></tr>
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:38px;text-align:center">No</th>
        <th>Deskripsi</th>
        <th style="width:68px;text-align:center">Ukuran</th>
        <th style="width:50px;text-align:center">Qty</th>
        <th style="width:110px;text-align:right">Harga</th>
        <th style="width:120px;text-align:right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>

  <table class="totals">
    <tr>
      <td colspan="5" style="text-align:right;padding:10px 10px 4px;color:#555">Subtotal:</td>
      <td style="text-align:right;padding:10px 10px 4px;font-weight:700;width:130px">${fmtRp(subtotal)}</td>
    </tr>
    ${diskonRow}
    ${dpRow}
    <tr class="grand">
      <td colspan="5" style="text-align:right">Grand Total</td>
      <td style="text-align:right">${fmtRp(grandTotal)}</td>
    </tr>
  </table>

  <div class="footer">
    <div class="tagline">Terima kasih atas kepercayaan Anda.</div>
    <div class="sign">
      <div class="sign-line"></div>
      <p>Hormat Kami,</p>
    </div>
  </div>

<script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`);
        win.document.close();
    };

    /* ── shared styles ──────────────────────────────────────── */
    const inputSt: React.CSSProperties = {
        width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7,
        padding: "8px 12px", fontSize: 13, color: "#3C2F2F",
        background: "#FFFBF7", outline: "none", boxSizing: "border-box",
    };
    const labelSt: React.CSSProperties = {
        fontSize: 10, fontWeight: 700, color: "#B89678",
        letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 5,
    };

    const statCard = (title: string, value: number | string, accent: string) => (
        <div style={{ flex: 1, background: "#FFFBF7", border: `1.5px solid ${accent}20`, borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>{title}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div>
        </div>
    );

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}>

            {/* ── Header ──────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A67B5B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                </svg>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>Invoice</span>
            </div>

            {/* ── Split body ──────────────────────────────────── */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

                {/* ── LEFT PANEL ────────────────────────────────── */}
                <div style={{ width: 360, minWidth: 300, background: "white", borderRight: "1px solid #E6D5BE", display: "flex", flexDirection: "column", overflow: "hidden" }}>

                    {/* Scrollable content */}
                    <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 20 }}>

                        {/* Ringkasan Bulanan */}
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#5C4033", marginBottom: 10 }}>Ringkasan Invoice Bulanan</div>
                            {/* Filter bulan/tahun */}
                            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                                <select value={month} onChange={(e) => setMonth(+e.target.value)}
                                    style={{ ...inputSt, flex: 2 }}>
                                    {MONTH_NAMES_LONG.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                                </select>
                                <select value={year} onChange={(e) => setYear(+e.target.value)}
                                    style={{ ...inputSt, flex: 1 }}>
                                    {years.map((y) => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                            {/* Stat cards */}
                            <div style={{ display: "flex", gap: 8 }}>
                                {statCard("Total Invoice", totalInvoices, "#A67B5B")}
                                {statCard("Sudah Bayar", sudahBayar, "#15803D")}
                                {statCard("Belum Bayar", belumBayar, "#B91C1C")}
                            </div>

                            {/* List no invoice bulan ini */}
                            {allInvNos.length > 0 && (
                                <div style={{ marginTop: 12 }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>No. Invoice Bulan Ini</div>
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                        {allInvNos.map((inv) => {
                                            const done = invoiceMap.get(inv)!.every((r) => r.di_kirim);
                                            return (
                                                <button key={inv}
                                                    onClick={() => { setNoInvInput(inv); setSearchedInv(inv); }}
                                                    style={{
                                                        padding: "3px 10px", borderRadius: 99, border: "none", cursor: "pointer",
                                                        fontSize: 11, fontWeight: 700,
                                                        background: done ? "#DCFCE7" : "#FEF9C3",
                                                        color: done ? "#15803D" : "#A16207",
                                                    }}>
                                                    {inv}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <hr style={{ border: "none", borderTop: "1px solid #F0E6D8" }} />

                        {/* Cari Invoice Individual */}
                        <div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#5C4033", marginBottom: 12 }}>Cari & Cetak Invoice Individual</div>

                            <div style={{ marginBottom: 12 }}>
                                <label style={labelSt}>Nomor Invoice</label>
                                <div style={{ display: "flex", gap: 6 }}>
                                    <input
                                        type="text" value={noInvInput}
                                        onChange={(e) => setNoInvInput(e.target.value)}
                                        onKeyDown={(e) => { if (e.key === "Enter") setSearchedInv(noInvInput.trim()); }}
                                        placeholder="cth: 11312"
                                        style={{ ...inputSt, flex: 1 }} />
                                    <button
                                        onClick={() => setSearchedInv(noInvInput.trim())}
                                        style={{
                                            padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                                            background: "#A67B5B", color: "white", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
                                        }}>
                                        Cari
                                    </button>
                                </div>
                            </div>

                            {/* DP & Diskon */}
                            <div style={{ marginBottom: 10 }}>
                                <label style={labelSt}>DP (Down Payment)</label>
                                <input type="text" value={dp} onChange={(e) => setDp(e.target.value)}
                                    placeholder="cth: 500000"
                                    style={{ ...inputSt, borderColor: dpNum > 0 ? "#2563EB" : "#D1BFA3" }} />
                                {dpNum > 0 && <div style={{ fontSize: 10, color: "#2563EB", marginTop: 3 }}>- {fmtRp(dpNum)}</div>}
                            </div>

                            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ ...labelSt, color: diskonRpNum > 0 ? "#DC2626" : "#B89678" }}>Diskon (Nominal)</label>
                                    <input type="text" value={diskonRp} onChange={(e) => setDiskonRp(e.target.value)}
                                        placeholder="cth: 50000"
                                        style={{ ...inputSt, borderColor: diskonRpNum > 0 ? "#DC2626" : "#D1BFA3" }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ ...labelSt, color: diskonPctNum > 0 ? "#DC2626" : "#B89678" }}>Diskon (%)</label>
                                    <input type="text" value={diskonPct} onChange={(e) => setDiskonPct(e.target.value)}
                                        placeholder="cth: 10"
                                        style={{ ...inputSt, borderColor: diskonPctNum > 0 ? "#DC2626" : "#D1BFA3" }} />
                                </div>
                            </div>
                            {diskonPctNum > 0 && (
                                <div style={{ fontSize: 10, color: "#B89678", marginBottom: 4 }}>
                                    ℹ️ Jika keduanya diisi, diskon <strong>persentase</strong> yang digunakan
                                </div>
                            )}

                            {/* Result summary */}
                            {invoiceItems.length > 0 && (
                                <div style={{ background: "#F5EBDD", borderRadius: 8, padding: "12px 14px", marginTop: 4 }}>
                                    <div style={{ fontSize: 11, color: "#5C4033", marginBottom: 6, fontWeight: 700 }}>
                                        {invoiceCustomer} — {invoiceItems.length} item
                                    </div>
                                    <div style={{ fontSize: 11, color: "#6B5E55", display: "flex", justifyContent: "space-between" }}>
                                        <span>Subtotal</span><span style={{ fontWeight: 700 }}>{fmtRp(subtotal)}</span>
                                    </div>
                                    {effectiveDiskon > 0 && (
                                        <div style={{ fontSize: 11, color: "#DC2626", display: "flex", justifyContent: "space-between" }}>
                                            <span>Diskon</span><span style={{ fontWeight: 700 }}>- {fmtRp(effectiveDiskon)}</span>
                                        </div>
                                    )}
                                    {dpNum > 0 && (
                                        <div style={{ fontSize: 11, color: "#2563EB", display: "flex", justifyContent: "space-between" }}>
                                            <span>DP</span><span style={{ fontWeight: 700 }}>- {fmtRp(dpNum)}</span>
                                        </div>
                                    )}
                                    <div style={{ fontSize: 13, color: "#3C2F2F", display: "flex", justifyContent: "space-between", borderTop: "1px solid #D1BFA3", marginTop: 6, paddingTop: 6, fontWeight: 800 }}>
                                        <span>Grand Total</span><span>{fmtRp(grandTotal)}</span>
                                    </div>
                                </div>
                            )}

                            {searchedInv && invoiceItems.length === 0 && (
                                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px", marginTop: 6, fontSize: 12, color: "#991B1B" }}>
                                    ❌ No. Invoice <strong>{searchedInv}</strong> tidak ditemukan.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Tombol Cetak — sticky bottom */}
                    <div style={{ padding: "12px 18px", borderTop: "1px solid #E6D5BE", background: "white" }}>
                        <button
                            onClick={cetakInvoice}
                            disabled={invoiceItems.length === 0}
                            style={{
                                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                padding: "11px 0", borderRadius: 8, border: "none", cursor: invoiceItems.length === 0 ? "not-allowed" : "pointer",
                                fontWeight: 800, fontSize: 14,
                                background: invoiceItems.length === 0 ? "#D1BFA3" : "#A67B5B",
                                color: "white",
                                opacity: invoiceItems.length === 0 ? 0.5 : 1,
                                transition: "background .2s",
                            }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="6 9 6 2 18 2 18 9" />
                                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                                <rect x="6" y="14" width="12" height="8" />
                            </svg>
                            Cetak Invoice PDF
                        </button>
                    </div>
                </div>

                {/* ── RIGHT PANEL: Invoice Preview ──────────────────── */}
                <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", background: "#FAF7F3" }}>
                    <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 24px rgba(92,64,51,0.10)", padding: "36px 40px", maxWidth: 720, margin: "0 auto", fontFamily: "Arial, sans-serif" }}>

                        {/* Kop Surat */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, paddingBottom: 18, borderBottom: "2px solid #1a1a1a" }}>
                            <div>
                                <div style={{ fontSize: 18, fontWeight: 900, color: "#1a1a1a", letterSpacing: 0.3, marginBottom: 4 }}>
                                    CV. TOTO ALUMINIUM MANUFACTURE
                                </div>
                                <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>
                                    Jl. Rawa Mulya, Kota Bekasi<br />
                                    Telp: 0813 1191 2002
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 30, fontWeight: 900, color: "#1a1a1a", letterSpacing: 1 }}>INVOICE</div>
                            </div>
                        </div>

                        {invoiceItems.length === 0 ? (
                            /* Placeholder */
                            <div style={{ textAlign: "center", padding: "4rem 0", color: "#C5A882" }}>
                                <div style={{ fontSize: 52, marginBottom: 14 }}>🧾</div>
                                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>Preview Invoice</div>
                                <div style={{ fontSize: 12 }}>Masukkan No. Invoice di panel kiri lalu klik <strong>Cari</strong></div>
                            </div>
                        ) : (
                            <>
                                {/* Meta info */}
                                <div style={{ marginBottom: 22 }}>
                                    <table style={{ fontSize: 13 }}>
                                        <tbody>
                                            {[
                                                ["No. Invoice", searchedInv],
                                                ["Tanggal", fmtDate(invoiceDate)],
                                                ["Customer", invoiceCustomer.toUpperCase()],
                                            ].map(([k, v]) => (
                                                <tr key={k}>
                                                    <td style={{ color: "#666", paddingRight: 16, paddingBottom: 4, width: 110 }}>{k}</td>
                                                    <td style={{ fontWeight: 600, color: "#1a1a1a" }}>: {v}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Items table */}
                                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 0 }}>
                                    <thead>
                                        <tr>
                                            {[
                                                { label: "No", w: 38, center: true },
                                                { label: "Deskripsi", center: false },
                                                { label: "Ukuran", w: 68, center: true },
                                                { label: "Qty", w: 50, center: true },
                                                { label: "Harga", w: 110, right: true },
                                                { label: "Total", w: 120, right: true },
                                            ].map((col) => (
                                                <th key={col.label} style={{
                                                    background: "#111", color: "#fff", padding: "9px 10px",
                                                    fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px",
                                                    textAlign: col.right ? "right" : col.center ? "center" : "left",
                                                    width: col.w,
                                                }}>{col.label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invoiceItems.map((r, i) => {
                                            const h = parseIdNum(r.harga);
                                            const u = parseIdNum(r.ukuran);
                                            const q = parseIdNum(r.qty);
                                            const total = h * u * q;
                                            return (
                                                <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                                                    <td style={{ padding: "9px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{i + 1}</td>
                                                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{r.deskripsi || "—"}</td>
                                                    <td style={{ padding: "9px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{r.ukuran || "—"}</td>
                                                    <td style={{ padding: "9px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700 }}>{r.qty || "—"}</td>
                                                    <td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{h > 0 ? fmtRp(h) : "—"}</td>
                                                    <td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700, color: "#A0522D" }}>{total > 0 ? fmtRp(total) : "—"}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Totals */}
                                <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 0 }}>
                                    <tbody>
                                        <tr>
                                            <td colSpan={5} style={{ padding: "9px 10px", textAlign: "right", color: "#555", fontSize: 12 }}>Subtotal:</td>
                                            <td style={{ padding: "9px 10px", textAlign: "right", fontWeight: 700, width: 120, fontSize: 12 }}>{fmtRp(subtotal)}</td>
                                        </tr>
                                        {effectiveDiskon > 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: "3px 10px", textAlign: "right", color: "#DC2626", fontSize: 12 }}>
                                                    Diskon{diskonPctNum > 0 ? ` (${diskonPctNum}%)` : ""}:
                                                </td>
                                                <td style={{ padding: "3px 10px", textAlign: "right", fontWeight: 700, color: "#DC2626", fontSize: 12 }}>- {fmtRp(effectiveDiskon)}</td>
                                            </tr>
                                        )}
                                        {dpNum > 0 && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: "3px 10px", textAlign: "right", color: "#2563EB", fontSize: 12 }}>DP (Down Payment):</td>
                                                <td style={{ padding: "3px 10px", textAlign: "right", fontWeight: 700, color: "#2563EB", fontSize: 12 }}>- {fmtRp(dpNum)}</td>
                                            </tr>
                                        )}
                                        <tr style={{ background: "#111" }}>
                                            <td colSpan={5} style={{ padding: "11px 10px", textAlign: "right", color: "white", fontWeight: 800, fontSize: 14 }}>Grand Total</td>
                                            <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 900, color: "white", fontSize: 14 }}>{fmtRp(grandTotal)}</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* Footer */}
                                <div style={{ marginTop: 32, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                                    <div style={{ fontSize: 12, color: "#A0522D", fontStyle: "italic" }}>
                                        Terima kasih atas kepercayaan Anda.
                                    </div>
                                    <div style={{ textAlign: "center" }}>
                                        <div style={{ width: 130, borderTop: "1px solid #333", marginBottom: 6 }} />
                                        <div style={{ fontSize: 11, color: "#333", fontWeight: 600 }}>Hormat Kami,</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
