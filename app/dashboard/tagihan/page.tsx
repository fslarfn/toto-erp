"use client";
import React, { useState, useMemo } from "react";
import { usePesanan } from "@/lib/pesanan-store";

/* ================================================================
   MENU TAGIHAN
   Tampilan piutang per customer per tahun.
   Admin finance bisa toggle status lunas / belum bayar per invoice.
================================================================ */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function fmtRp(val: number): string {
    if (val === 0) return "—";
    return "Rp " + Math.round(val).toLocaleString("id-ID");
}

function fmtDateShort(d: string): string {
    if (!d) return "—";
    const p = d.split("-");
    return p.length === 3 ? `${p[2]} ${MONTH_NAMES[parseInt(p[1]) - 1]}` : d;
}

/**
 * Parse angka format Indonesia:
 * - Titik pemisah ribuan: "230.000" → 230000
 * - Koma desimal: "1,7" → 1.7
 */
function parseIdNum(s: string | undefined): number {
    if (!s) return 0;
    const str = s.trim();
    if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, "")) || 0;
    return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

export default function TagihanPage() {
    const { rows, updateRow } = usePesanan();
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    /* ── Hanya baris yang punya No Invoice ───────────────── */
    const baseRows = useMemo(() =>
        rows.filter((r) => (r.customer || r.deskripsi) && r.no_inv && r.tanggal &&
            parseInt(r.tanggal.slice(0, 4)) === year),
        [rows, year]);

    /* ── Group by no_inv → hitung total per invoice ──────── */
    const invoiceMap = useMemo(() => {
        const map = new Map<string, {
            no_inv: string; customer: string; tanggal: string;
            total: number; is_paid: boolean; ids: number[];
            descs: string[];
        }>();
        baseRows.forEach((r) => {
            const key = r.no_inv.trim();
            const rowTotal = parseIdNum(r.ukuran) * parseIdNum(r.qty) * parseIdNum(r.harga);
            if (!map.has(key)) {
                map.set(key, { no_inv: key, customer: r.customer, tanggal: r.tanggal, total: 0, is_paid: r.is_paid, ids: [], descs: [] });
            }
            const inv = map.get(key)!;
            inv.total += rowTotal;
            inv.ids.push(r.id);
            if (r.deskripsi) inv.descs.push(r.deskripsi);
            // Invoice dianggap lunas jika SEMUA row is_paid=true
            inv.is_paid = inv.is_paid && r.is_paid;
        });
        return map;
    }, [baseRows]);

    /* ── Group by customer ───────────────────────────────── */
    const customerMap = useMemo(() => {
        const map = new Map<string, typeof Array.prototype>();
        invoiceMap.forEach((inv) => {
            const key = inv.customer || "(Tanpa Customer)";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(inv);
        });
        return map;
    }, [invoiceMap]);

    const filteredCustomers = useMemo(() => {
        const q = search.toLowerCase();
        return Array.from(customerMap.entries())
            .filter(([cust]) => !q || cust.toLowerCase().includes(q))
            .sort(([a], [b]) => a.localeCompare(b));
    }, [customerMap, search]);

    /* ── Summary totals ──────────────────────────────────── */
    const { totalAll, totalLunas, totalBelum, countAll, countLunas, countBelum } = useMemo(() => {
        let totalAll = 0, totalLunas = 0, countAll = 0, countLunas = 0;
        invoiceMap.forEach((inv) => {
            totalAll += inv.total;
            countAll++;
            if (inv.is_paid) { totalLunas += inv.total; countLunas++; }
        });
        return { totalAll, totalLunas, totalBelum: totalAll - totalLunas, countAll, countLunas, countBelum: countAll - countLunas };
    }, [invoiceMap]);

    /* ── Toggle lunas untuk semua row dalam satu invoice ─── */
    const togglePaid = (noInv: string, newVal: boolean) => {
        const inv = invoiceMap.get(noInv);
        if (!inv) return;
        inv.ids.forEach((id) => updateRow(id, { is_paid: newVal }));
    };

    const cardSt = (accent: string): React.CSSProperties => ({
        flex: 1, background: "#FFFBF7", border: `1.5px solid ${accent}30`,
        borderLeft: `4px solid ${accent}`, borderRadius: 8, padding: "12px 16px",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A67B5B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>Tagihan</span>
            </div>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 18px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, color: "#B89678", fontWeight: 600 }}>Tahun:</span>
                    <select value={year} onChange={(e) => setYear(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "4px 8px", fontSize: 12, color: "#5C4033", background: "#FFFBF7", height: 30 }}>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari nama customer..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "4px 10px", fontSize: 12, width: 220, color: "#5C4033", background: "#FFFBF7", height: 30 }} />
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 18px" }}>

                {/* Summary Cards */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                    <div style={cardSt("#A67B5B")}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Total Tagihan ({countAll} inv)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>{fmtRp(totalAll)}</div>
                    </div>
                    <div style={cardSt("#15803D")}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Sudah Lunas ({countLunas} inv)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#15803D" }}>{fmtRp(totalLunas)}</div>
                    </div>
                    <div style={cardSt("#B91C1C")}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", marginBottom: 4 }}>Belum Bayar ({countBelum} inv)</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#B91C1C" }}>{fmtRp(totalBelum)}</div>
                    </div>
                </div>

                {filteredCustomers.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "5rem 0", color: "#C5A882" }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>🧾</div>
                        <div style={{ fontWeight: 700, fontSize: 14 }}>Belum ada tagihan tahun {year}</div>
                        <div style={{ fontSize: 12, marginTop: 4 }}>Pastikan pesanan sudah diisi No Invoice di menu Status Barang</div>
                    </div>
                ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {filteredCustomers.map(([customer, invoices]) => {
                            const custTotal = (invoices as typeof Array.prototype).reduce((s: number, inv: { total: number }) => s + inv.total, 0);
                            const custLunas = (invoices as typeof Array.prototype).filter((inv: { is_paid: boolean }) => inv.is_paid).reduce((s: number, inv: { total: number }) => s + inv.total, 0);
                            const custBelum = custTotal - custLunas;
                            const isExp = expanded === customer;
                            const allLunas = (invoices as typeof Array.prototype).every((inv: { is_paid: boolean }) => inv.is_paid);

                            return (
                                <div key={customer} style={{ background: "white", borderRadius: 10, border: "1px solid #E6D5BE", overflow: "hidden", boxShadow: "0 1px 6px rgba(92,64,51,0.06)" }}>
                                    {/* Customer header row */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", cursor: "pointer", background: isExp ? "#FEF9F5" : "white" }}
                                        onClick={() => setExpanded(isExp ? null : customer)}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                                                <span style={{ fontSize: 14, fontWeight: 800, color: "#3C2F2F" }}>{customer}</span>
                                                {allLunas ? (
                                                    <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "1px 9px", fontSize: 10, fontWeight: 700 }}>✓ LUNAS</span>
                                                ) : (
                                                    <span style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 99, padding: "1px 9px", fontSize: 10, fontWeight: 700 }}>⚠ ADA TUNGGAKAN</span>
                                                )}
                                                <span style={{ fontSize: 11, color: "#B89678" }}>{(invoices as typeof Array.prototype).length} invoice</span>
                                            </div>
                                            <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
                                                <span style={{ color: "#5C4033" }}>Total: <strong>{fmtRp(custTotal)}</strong></span>
                                                <span style={{ color: "#15803D" }}>Lunas: <strong>{fmtRp(custLunas)}</strong></span>
                                                {custBelum > 0 && <span style={{ color: "#B91C1C" }}>Sisa: <strong>{fmtRp(custBelum)}</strong></span>}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 16, color: "#A67B5B" }}>{isExp ? "▲" : "▼"}</div>
                                    </div>

                                    {/* Invoice detail */}
                                    {isExp && (
                                        <div style={{ borderTop: "1px solid #F0E6D8" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                                <thead>
                                                    <tr>
                                                        {["No Invoice", "Tanggal", "Deskripsi", "Total (Rp)", "Status", "Aksi"].map((h) => (
                                                            <th key={h} style={{ background: "#F7F0E8", color: "#5C4033", padding: "7px 12px", fontWeight: 700, fontSize: 11, textAlign: h === "Total (Rp)" ? "right" : "left", borderBottom: "1px solid #E6D5BE" }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(invoices as typeof Array.prototype)
                                                        .sort((a: { tanggal: string }, b: { tanggal: string }) => b.tanggal.localeCompare(a.tanggal))
                                                        .map((inv: { no_inv: string; tanggal: string; descs: string[]; total: number; is_paid: boolean }) => (
                                                            <tr key={inv.no_inv} style={{ background: inv.is_paid ? "#F0FDF4" : "white", borderBottom: "1px solid #F0E6D8" }}>
                                                                <td style={{ padding: "8px 12px", fontWeight: 700, color: "#3C2F2F", fontFamily: "monospace" }}>{inv.no_inv}</td>
                                                                <td style={{ padding: "8px 12px", color: "#6B5E55", whiteSpace: "nowrap" }}>{fmtDateShort(inv.tanggal)}</td>
                                                                <td style={{ padding: "8px 12px", color: "#444", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                                    {inv.descs.slice(0, 2).join(", ")}{inv.descs.length > 2 ? ` +${inv.descs.length - 2} lainnya` : ""}
                                                                </td>
                                                                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: inv.total > 0 ? "#3C2F2F" : "#C5A882" }}>{fmtRp(inv.total)}</td>
                                                                <td style={{ padding: "8px 12px" }}>
                                                                    {inv.is_paid ? (
                                                                        <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>✓ Lunas</span>
                                                                    ) : (
                                                                        <span style={{ background: "#FEF2F2", color: "#B91C1C", borderRadius: 99, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>⏳ Belum Bayar</span>
                                                                    )}
                                                                </td>
                                                                <td style={{ padding: "6px 12px" }}>
                                                                    {inv.is_paid ? (
                                                                        <button onClick={() => togglePaid(inv.no_inv, false)}
                                                                            style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#B91C1C", whiteSpace: "nowrap" }}>
                                                                            ↩ Batalkan Lunas
                                                                        </button>
                                                                    ) : (
                                                                        <button onClick={() => togglePaid(inv.no_inv, true)}
                                                                            style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #15803D", background: "#F0FDF4", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#15803D", whiteSpace: "nowrap" }}>
                                                                            ✓ Tandai Lunas
                                                                        </button>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ background: "#F7F0E8" }}>
                                                        <td colSpan={3} style={{ padding: "7px 12px", fontWeight: 700, fontSize: 11, color: "#5C4033" }}>TOTAL {customer.toUpperCase()}</td>
                                                        <td style={{ padding: "7px 12px", textAlign: "right", fontWeight: 800, fontSize: 12, color: "#3C2F2F" }}>{fmtRp(custTotal)}</td>
                                                        <td colSpan={2} style={{ padding: "7px 12px", fontSize: 11, color: custBelum > 0 ? "#B91C1C" : "#15803D", fontWeight: 700 }}>
                                                            {custBelum > 0 ? `Sisa: ${fmtRp(custBelum)}` : "✓ Semua Lunas"}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
