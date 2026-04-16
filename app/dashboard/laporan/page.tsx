"use client";
import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { usePesanan, PesananRow, isRowFilled } from "@/lib/pesanan-store";
import { formatCurrency, parseIdNum } from "@/lib/utils";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell,
} from "recharts";
import * as XLSX from "xlsx";

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const PIE_COLORS = ["#7c5c3e", "#a16207", "#d97706", "#f59e0b", "#fbbf24", "#fcd34d", "#fde68a", "#fef3c7", "#fffbeb", "#9ca3af"];

function exportToExcel(data: any[], filename: string) {
    if (data.length === 0) return alert("Tidak ada data untuk di ekspor.");
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

function calculateUmur(date: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const invDate = new Date(date);
    invDate.setHours(0, 0, 0, 0);
    const diff = today.getTime() - invDate.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getAgingCategory(hari: number) {
    if (hari <= 30) return "0-30";
    if (hari <= 60) return "31-60";
    if (hari <= 90) return "61-90";
    return ">90";
}

/* =========================================================
   TAB 1: Laba Rugi
========================================================= */
function TabLabaRugi() {
    const { cashFlow } = useStore();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const selectedPeriod = `${year}-${String(month).padStart(2, "0")}`;

    // Transactions in selected period
    const periodCF = useMemo(() => cashFlow.filter(c => c.date.startsWith(selectedPeriod)), [cashFlow, selectedPeriod]);
    const income = periodCF.filter(c => c.type === "income").reduce((s, c) => s + c.amount, 0);
    const expense = periodCF.filter(c => c.type === "expense").reduce((s, c) => s + c.amount, 0);
    const profit = income - expense;

    // 6-month chart
    const chartData = useMemo(() => {
        const result = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(year, month - 1 - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = `${MONTH_NAMES[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`;
            const monthCF = cashFlow.filter(c => c.date.startsWith(mStr));
            result.push({
                Bulan: label,
                Pemasukan: monthCF.filter(c => c.type === "income").reduce((a, c) => a + c.amount, 0),
                Pengeluaran: monthCF.filter(c => c.type === "expense").reduce((a, c) => a + c.amount, 0)
            });
        }
        return result;
    }, [cashFlow, month, year]);

    const doExport = () => {
        const raw = periodCF.map(c => ({
            Tanggal: c.date,
            Kategori: c.category,
            Keterangan: c.description,
            Tipe: c.type === "income" ? "Pemasukan" : "Pengeluaran",
            Jumlah: c.amount
        }));
        exportToExcel(raw, `Laba_Rugi_${selectedPeriod}`);
    };

    return (
        <div style={{ padding: "0 16px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none" }}>
                        {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none" }}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button onClick={doExport} style={{ background: "#A67B5B", color: "white", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                    📥 Export Excel
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 }}>
                <div style={{ padding: 16, borderRadius: 12, background: "#ECFDF5", border: "1px solid #A7F3D0" }}>
                    <div style={{ fontSize: 13, color: "#065F46", fontWeight: 700 }}>Total Pendapatan</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#065F46" }}>{formatCurrency(income)}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: "#FEF2F2", border: "1px solid #FECACA" }}>
                    <div style={{ fontSize: 13, color: "#991B1B", fontWeight: 700 }}>Total Pengeluaran</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: "#991B1B" }}>{formatCurrency(expense)}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 12, background: profit >= 0 ? "#FFF8F0" : "#FEF2F2", border: `1px solid ${profit >= 0 ? "#E6D5BE" : "#FECACA"}` }}>
                    <div style={{ fontSize: 13, color: profit >= 0 ? "#7C5C3E" : "#991B1B", fontWeight: 700 }}>Laba Bersih</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: profit >= 0 ? "#7C5C3E" : "#991B1B" }}>{formatCurrency(profit)}</div>
                </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
                <div style={{ background: "white", borderRadius: 12, padding: 20, border: "1px solid #E6D5BE" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3C2F2F", marginBottom: 16 }}>Perbandingan 6 Bulan Terakhir</div>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="Bulan" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
                                <Tooltip formatter={(v) => formatCurrency(v as number)} />
                                <Legend wrapperStyle={{ fontSize: 12 }} />
                                <Bar dataKey="Pemasukan" fill="#10B981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Pengeluaran" fill="#EF4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", fontSize: 14, fontWeight: 700, color: "#3C2F2F" }}>Rincian Transaksi ({MONTH_NAMES[month - 1]} {year})</div>
                    <div style={{ flex: 1, overflowY: "auto", maxHeight: 310 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "left", color: "#B89678", fontWeight: 700, position: "sticky", top: 0 }}>Tanggal</th>
                                    <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "left", color: "#B89678", fontWeight: 700, position: "sticky", top: 0 }}>Kategori</th>
                                    <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "left", color: "#B89678", fontWeight: 700, position: "sticky", top: 0 }}>Keterangan</th>
                                    <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "right", color: "#B89678", fontWeight: 700, position: "sticky", top: 0 }}>Jumlah</th>
                                </tr>
                            </thead>
                            <tbody>
                                {periodCF.map((c, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 1 ? "#FAFAF8" : "white" }}>
                                        <td style={{ padding: "10px", color: "#5C4033" }}>{c.date}</td>
                                        <td style={{ padding: "10px", fontWeight: 600 }}>{c.category}</td>
                                        <td style={{ padding: "10px", color: "#6B5E55" }}>{c.description}</td>
                                        <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: c.type === "income" ? "#10B981" : "#EF4444" }}>
                                            {c.type === "income" ? "+" : "-"}{formatCurrency(c.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {periodCF.length === 0 && (
                                    <tr>
                                        <td colSpan={4} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>Tidak ada transaksi bulan ini</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* =========================================================
   TAB 2: Aging Piutang
========================================================= */
function TabAgingPiutang() {
    const { rows: pesananRows } = usePesanan();
    const { orders } = useStore();
    const [year, setYear] = useState(new Date().getFullYear());

    // Gabungkan Piutang dari Order & Pesanan
    const piutangData = useMemo(() => {
        const data: any[] = [];
        
        // Dari store pesanan
        pesananRows.forEach(r => {
            if (!isRowFilled(r)) return;
            if (!r.is_paid && r.tanggal.startsWith(String(year))) {
                const u = parseIdNum(r.ukuran);
                const q = parseIdNum(r.qty);
                const h = parseIdNum(r.harga);
                const val = u * q * h;
                const umur = calculateUmur(r.tanggal);
                if (val > 0) {
                    data.push({
                        customer: r.customer,
                        invoice: r.no_inv || r.po_label || "Tanpa No",
                        tanggal: r.tanggal,
                        tagihan: val,
                        lunas: 0,
                        sisa: val,
                        umur,
                        kategori: getAgingCategory(umur),
                        src: "Pesanan"
                    });
                }
            }
        });

        // Dari orders store
        orders.forEach(o => {
            if (o.paymentStatus !== "lunas" && o.orderDate.startsWith(String(year))) {
                const umur = calculateUmur(o.orderDate);
                const sisa = o.totalPrice - o.paidAmount;
                data.push({
                    customer: o.customerName,
                    invoice: o.id.split("-")[0].toUpperCase(),
                    tanggal: o.orderDate,
                    tagihan: o.totalPrice,
                    lunas: o.paidAmount,
                    sisa: sisa,
                    umur,
                    kategori: getAgingCategory(umur),
                    src: "Invoice"
                });
            }
        });

        return data.sort((a, b) => b.umur - a.umur);
    }, [pesananRows, orders, year]);

    const summary = useMemo(() => {
        return {
            "0-30": piutangData.filter(d => d.kategori === "0-30").reduce((s, d) => s + d.sisa, 0),
            "31-60": piutangData.filter(d => d.kategori === "31-60").reduce((s, d) => s + d.sisa, 0),
            "61-90": piutangData.filter(d => d.kategori === "61-90").reduce((s, d) => s + d.sisa, 0),
            ">90": piutangData.filter(d => d.kategori === ">90").reduce((s, d) => s + d.sisa, 0),
        };
    }, [piutangData]);

    const badgeProps = {
        "0-30": { bg: "#DCFCE7", col: "#15803D" },
        "31-60": { bg: "#FEF9C3", col: "#A16207" },
        "61-90": { bg: "#FFEDD5", col: "#C2410C" },
        ">90":   { bg: "#FEE2E2", col: "#B91C1C" },
    };

    const doExport = () => {
        const raw = piutangData.map(d => ({
            "Nama Customer": d.customer,
            "No Invoice / Referensi": d.invoice,
            "Tanggal": d.tanggal,
            "Total Tagihan": d.tagihan,
            "Jumlah Lunas": d.lunas,
            "Sisa Piutang": d.sisa,
            "Umur (Hari)": d.umur,
            "Kategori Aging": d.kategori
        }));
        exportToExcel(raw, `Aging_Piutang_${year}`);
    };

    return (
        <div style={{ padding: "0 16px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none", width: 120 }}>
                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                <button onClick={doExport} style={{ background: "#A67B5B", color: "white", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                    📥 Export Excel
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
                {(["0-30", "31-60", "61-90", ">90"] as const).map(k => (
                    <div key={k} style={{ padding: 16, borderRadius: 12, background: badgeProps[k].bg, border: `1px solid ${badgeProps[k].col}40` }}>
                        <div style={{ fontSize: 13, color: badgeProps[k].col, fontWeight: 700, marginBottom: 8 }}>Aging {k} Hari</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: badgeProps[k].col }}>{formatCurrency(summary[k])}</div>
                        <div style={{ fontSize: 11, color: badgeProps[k].col, opacity: 0.8, marginTop: 4 }}>
                            {piutangData.filter(d => d.kategori === k).length} Invoice
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["Customer", "No. Referensi", "Tanggal", "Total Tagihan", "Sisa Tagihan", "Umur (Hari)", "Aging"].map((h) => (
                                <th key={h} style={{ background: "#FAF7F3", padding: "10px", textAlign: h === "Customer" || h === "No. Referensi" ? "left" : "center", color: "#7C5C3E", fontWeight: 700, borderBottom: "1px solid #E6D5BE" }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {piutangData.map((d, i) => {
                            const bp = badgeProps[d.kategori as keyof typeof badgeProps];
                            return (
                                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 1 ? "#FAFAF8" : "white" }}>
                                    <td style={{ padding: "10px", fontWeight: 700, color: "#3C2F2F" }}>{d.customer}</td>
                                    <td style={{ padding: "10px", color: "#6B5E55" }}>{d.invoice}</td>
                                    <td style={{ padding: "10px", textAlign: "center" }}>{d.tanggal}</td>
                                    <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(d.tagihan)}</td>
                                    <td style={{ padding: "10px", textAlign: "right", fontWeight: 700 }}>{formatCurrency(d.sisa)}</td>
                                    <td style={{ padding: "10px", textAlign: "center", color: bp.col, fontWeight: 700 }}>{d.umur} hr</td>
                                    <td style={{ padding: "10px", textAlign: "center" }}>
                                        <span style={{ background: bp.bg, color: bp.col, padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                                            {d.kategori} Hari
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                        {piutangData.length === 0 && (
                            <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>Tidak ada piutang jatuh tempo.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* =========================================================
   TAB 3: Produktivitas Operator
========================================================= */
function TabProduktivitas() {
    const { rows: pesananRows } = usePesanan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    
    // selected state for modal
    const [selectedPO, setSelectedPO] = useState<string | null>(null);

    const paramPeriod = `${year}-${String(month).padStart(2, "0")}`;

    const prodData = useMemo(() => {
        const map: Record<string, { count: number, totalQty: number, totalNilai: number, rawRows: PesananRow[] }> = {};
        
        pesananRows.forEach(r => {
            if (!isRowFilled(r)) return;
            if (r.tanggal.startsWith(paramPeriod)) {
                // Gunakan po_label jika ada, jika tidak masukkan "Belum di Set"
                const operator = r.po_label ? (r.po_label.startsWith("PO ") ? r.po_label : `PO ${r.po_label}`) : "Tanpa Operator";
                if (!map[operator]) map[operator] = { count: 0, totalQty: 0, totalNilai: 0, rawRows: [] };
                
                const q = parseIdNum(r.qty);
                const u = parseIdNum(r.ukuran);
                const h = parseIdNum(r.harga);
                
                map[operator].count += 1;
                map[operator].totalQty += q;
                map[operator].totalNilai += (q * u * h);
                map[operator].rawRows.push(r);
            }
        });

        // Convert and calculate average item/day (assume ~22 working days loosely or just use days elapsed)
        // For simplicity, we just display raw totals.
        return Object.entries(map).map(([name, data]) => ({
            name,
            count: data.count,
            totalQty: data.totalQty,
            totalNilai: data.totalNilai,
            avgHari: (data.count / 22).toFixed(1), // asumsi kasaran 22 hari kerja
            rawRows: data.rawRows
        })).sort((a,b) => b.count - a.count);
        
    }, [pesananRows, paramPeriod]);

    const doExport = () => {
        const raw = prodData.map(d => ({
            "Nama Operator": d.name,
            "Total Pesanan Dikerjakan": d.count,
            "Total Qty (Pcs/Meter)": d.totalQty,
            "Total Nilai Harga": d.totalNilai,
            "Rata Pekerjaan/Hari": Number(d.avgHari)
        }));
        exportToExcel(raw, `Produktivitas_${paramPeriod}`);
    };

    return (
        <div style={{ padding: "0 16px 24px" }}>
             <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none" }}>
                        {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none" }}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <button onClick={doExport} style={{ background: "#A67B5B", color: "white", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                    📥 Export Excel
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                {/* Table */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "left", color: "#7C5C3E", fontWeight: 700, borderBottom: "1px solid #E6D5BE" }}>Operator</th>
                                <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "center", color: "#7C5C3E", fontWeight: 700, borderBottom: "1px solid #E6D5BE" }}>Item Dikerjakan</th>
                                <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "center", color: "#7C5C3E", fontWeight: 700, borderBottom: "1px solid #E6D5BE" }}>Total Qty</th>
                                <th style={{ background: "#FAF7F3", padding: "10px", textAlign: "right", color: "#7C5C3E", fontWeight: 700, borderBottom: "1px solid #E6D5BE" }}>Nilai (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {prodData.map((d, i) => (
                                <tr key={i} onClick={() => setSelectedPO(d.name)} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 1 ? "#FAFAF8" : "white", cursor: "pointer" }}>
                                    <td style={{ padding: "10px", fontWeight: 700, color: "#1D4ED8", textDecoration: "underline" }}>{d.name}</td>
                                    <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>{d.count}</td>
                                    <td style={{ padding: "10px", textAlign: "center" }}>{d.totalQty}</td>
                                    <td style={{ padding: "10px", textAlign: "right" }}>{formatCurrency(d.totalNilai)}</td>
                                </tr>
                            ))}
                            {prodData.length === 0 && (
                                <tr><td colSpan={4} style={{ textAlign: "center", padding: 30, color: "#9CA3AF" }}>Belum ada data produksi pada bulan ini.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Chart */}
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3C2F2F", marginBottom: 16 }}>Komparasi Kinerja Operator (Dalam Item)</div>
                    <div style={{ height: 350 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={prodData} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11 }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                                <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: 8 }} />
                                <Bar dataKey="count" name="Total Item Dikerjakan" fill="#A67B5B" radius={[0, 4, 4, 0]} barSize={24} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Modal Detail */}
            {selectedPO && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
                    <div style={{ background: "white", borderRadius: 16, width: 800, maxWidth: "100%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 10px 25px rgba(0,0,0,0.2)", overflow: "hidden" }}>
                        <div style={{ padding: "16px 24px", borderBottom: "1px solid #E6D5BE", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAF7F3" }}>
                            <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F" }}>Rincian Pekerjaan: {selectedPO}</div>
                            <button onClick={() => setSelectedPO(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✖</button>
                        </div>
                        <div style={{ overflowY: "auto", flex: 1, padding: 20 }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                                <thead>
                                    <tr>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "left", color: "#5C4033" }}>Customer</th>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "left", color: "#5C4033" }}>Deskripsi</th>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "center", color: "#5C4033" }}>Ukuran</th>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "center", color: "#5C4033" }}>Qty</th>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "center", color: "#5C4033" }}>Inv</th>
                                        <th style={{ background: "#E8DCCF", padding: "8px", textAlign: "center", color: "#5C4033" }}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prodData.find(d => d.name === selectedPO)?.rawRows.map(r => (
                                        <tr key={r.id} style={{ borderBottom: "1px solid #F3F4F6" }}>
                                            <td style={{ padding: "8px", fontWeight: 600 }}>{r.customer}</td>
                                            <td style={{ padding: "8px", color: "#555" }}>{r.deskripsi}</td>
                                            <td style={{ padding: "8px", textAlign: "center" }}>{r.ukuran}</td>
                                            <td style={{ padding: "8px", textAlign: "center", fontWeight: 700 }}>{r.qty}</td>
                                            <td style={{ padding: "8px", textAlign: "center", color: "#A67B5B" }}>{r.no_inv || "—"}</td>
                                            <td style={{ padding: "8px", textAlign: "center" }}>
                                                {r.di_kirim ? "Dikirim" : r.siap_kirim ? "Siap Kirim" : r.di_warna ? "Warna" : "Produksi"}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* =========================================================
   TAB 4: Analisa Produk Terlaris
========================================================= */
function TabProdukTerlaris() {
    const { rows: pesananRows } = usePesanan();
    const [period, setPeriod] = useState<"semua" | "bulan_ini">("bulan_ini");
    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const terlarisData = useMemo(() => {
        const map: Record<string, { qty: number, nilai: number, customers: Set<string> }> = {};
        let totalOmzet = 0;

        pesananRows.forEach(r => {
            if (!isRowFilled(r)) return;
            if (period === "bulan_ini" && !r.tanggal.startsWith(currMonthStr)) return;

            // Simple normalization (e.g. "KUSEN ALUMINIUM HITAM", "kusen aluminium hitam " -> identical)
            const deskripsi = r.deskripsi.trim().toUpperCase() || "TANPA NAMA";
            if (!map[deskripsi]) map[deskripsi] = { qty: 0, nilai: 0, customers: new Set() };

            const q = parseIdNum(r.qty);
            const u = parseIdNum(r.ukuran);
            const h = parseIdNum(r.harga);
            const val = q * u * h;

            map[deskripsi].qty += q;
            map[deskripsi].nilai += val;
            if (r.customer.trim()) map[deskripsi].customers.add(r.customer.trim().toUpperCase());
            
            totalOmzet += val;
        });

        return Object.entries(map).map(([name, d]) => ({
            name,
            qty: d.qty,
            nilai: d.nilai,
            custCount: d.customers.size,
            percent: totalOmzet > 0 ? (d.nilai / totalOmzet) * 100 : 0
        })).sort((a, b) => b.qty - a.qty);

    }, [pesananRows, period, currMonthStr]);

    const pieData = useMemo(() => {
        const top10 = terlarisData.slice(0, 5);
        const others = terlarisData.slice(5).reduce((s, c) => s + c.nilai, 0);
        const res = top10.map(t => ({ name: t.name, value: t.nilai }));
        if (others > 0) res.push({ name: "Lainnya", value: others });
        return res;
    }, [terlarisData]);

    const doExport = () => {
        const raw = terlarisData.map((d, i) => ({
            "Rank": i + 1,
            "Deskripsi Produk": d.name,
            "Total Qty": d.qty,
            "Total Nilai Penjualan": d.nilai,
            "Jumlah Customer": d.custCount,
            "Rasio Omzet (%)": d.percent.toFixed(2) + "%"
        }));
        exportToExcel(raw, `Produk_Terlaris_${period}`);
    };

    return (
         <div style={{ padding: "0 16px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <select value={period} onChange={(e) => setPeriod(e.target.value as any)} style={{ border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 12px", outline: "none", width: 160 }}>
                    <option value="bulan_ini">Bulan Ini</option>
                    <option value="semua">Semua Waktu</option>
                </select>
                <button onClick={doExport} style={{ background: "#A67B5B", color: "white", padding: "8px 16px", borderRadius: 8, fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                    📥 Export Excel
                </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 20 }}>
                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", overflow: "hidden", maxHeight: 500, display: "flex", flexDirection: "column" }}>
                     <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", fontSize: 14, fontWeight: 700, color: "#3C2F2F", background: "#FAF7F3" }}>Ranking Produk</div>
                    <div style={{ overflowY: "auto", flex: 1 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                            <thead>
                                <tr>
                                    <th style={{ background: "#EDE0D4", padding: "10px", textAlign: "center", color: "#7C5C3E", fontWeight: 700, position: "sticky", top: 0 }}>Rank</th>
                                    <th style={{ background: "#EDE0D4", padding: "10px", textAlign: "left", color: "#7C5C3E", fontWeight: 700, position: "sticky", top: 0 }}>Deskripsi Produk</th>
                                    <th style={{ background: "#EDE0D4", padding: "10px", textAlign: "center", color: "#7C5C3E", fontWeight: 700, position: "sticky", top: 0 }}>Qty Terjual</th>
                                    <th style={{ background: "#EDE0D4", padding: "10px", textAlign: "right", color: "#7C5C3E", fontWeight: 700, position: "sticky", top: 0 }}>Total Nilai (Rp)</th>
                                    <th style={{ background: "#EDE0D4", padding: "10px", textAlign: "center", color: "#7C5C3E", fontWeight: 700, position: "sticky", top: 0 }}>% Omzet</th>
                                </tr>
                            </thead>
                            <tbody>
                                {terlarisData.map((d, i) => (
                                    <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: i % 2 === 1 ? "#FAFAF8" : "white" }}>
                                        <td style={{ padding: "10px", textAlign: "center", fontWeight: 800, color: i < 3 ? "#D97706" : "#A67B5B" }}>#{i + 1}</td>
                                        <td style={{ padding: "10px", fontWeight: i < 3 ? 700 : 500, color: "#3C2F2F" }}>{d.name}</td>
                                        <td style={{ padding: "10px", textAlign: "center", fontWeight: 700 }}>{d.qty}</td>
                                        <td style={{ padding: "10px", textAlign: "right", color: "#10B981", fontWeight: 600 }}>{formatCurrency(d.nilai)}</td>
                                        <td style={{ padding: "10px", textAlign: "center", color: "#6B5E55" }}>{d.percent.toFixed(1)}%</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", padding: 20 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#3C2F2F", marginBottom: 16 }}>Komposisi Produk Berdasarkan Omzet</div>
                    <div style={{ height: 320 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={2} dataKey="value" stroke="none">
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(v) => formatCurrency(v as number)} />
                                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 11, maxWidth: 120 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 10 }}>Peringkat 5 teratas mendominasi persentase penjualan.</div>
                </div>
            </div>
         </div>
    );
}

/* =========================================================
   MAIN EXPORT
========================================================= */
export default function LaporanPage() {
    const [activeTab, setActiveTab] = useState<"labarugi" | "aging" | "operator" | "produk">("labarugi");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "12px 24px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap", flex: 1
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F5EBDD" }}>
            <div style={{ background: "white", padding: "16px 20px 0 20px", borderBottom: "1px solid #E6D5BE" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#3C2F2F", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                    <span>📊</span> Laporan Sistem ERP
                </div>
                <div style={{ display: "flex" }}>
                    <button onClick={() => setActiveTab("labarugi")} style={tabStyle("labarugi")}>Laba Rugi</button>
                    <button onClick={() => setActiveTab("aging")} style={tabStyle("aging")}>Aging Piutang</button>
                    <button onClick={() => setActiveTab("operator")} style={tabStyle("operator")}>Produktivitas Operator</button>
                    <button onClick={() => setActiveTab("produk")} style={tabStyle("produk")}>Analisa Produk</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "24px 8px 8px 8px" }}>
                {activeTab === "labarugi" && <TabLabaRugi />}
                {activeTab === "aging" && <TabAgingPiutang />}
                {activeTab === "operator" && <TabProduktivitas />}
                {activeTab === "produk" && <TabProdukTerlaris />}
            </div>
        </div>
    );
}
