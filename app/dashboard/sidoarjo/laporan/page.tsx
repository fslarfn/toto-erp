"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
type Order = { tanggal: string; harga: string; qty: string; ukuran: string; is_paid: boolean; di_kirim: boolean };
type Flow = { type: string; amount: number; date: string };
const orderValue = (row: Order) => Number(row.harga || 0) * Number(row.qty || 0) * Number(String(row.ukuran || "0").replace(",", "."));

export default function SidoarjoLaporanPage() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [orders, setOrders] = useState<Order[]>([]);
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;
    const load = useCallback(async () => {
        setLoading(true); setError("");
        const [orderResult, flowResult] = await Promise.all([
            supabase.from("pesanan_rows").select("tanggal,harga,qty,ukuran,is_paid,di_kirim").eq("operating_unit", UNIT).gte("tanggal", start).lte("tanggal", end),
            supabase.from("cash_flow").select("type,amount,date").eq("operating_unit", UNIT).gte("date", start).lte("date", end),
        ]);
        if (orderResult.error || flowResult.error) setError(orderResult.error?.message || flowResult.error?.message || "Gagal memuat laporan.");
        else { setOrders((orderResult.data ?? []) as Order[]); setFlows((flowResult.data ?? []) as Flow[]); }
        setLoading(false);
    }, [end, start]);
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
    const summary = useMemo(() => {
        const sales = orders.reduce((sum, row) => sum + orderValue(row), 0);
        const shipped = orders.filter((row) => row.di_kirim).reduce((sum, row) => sum + orderValue(row), 0);
        const paid = orders.filter((row) => row.is_paid).reduce((sum, row) => sum + orderValue(row), 0);
        const income = flows.filter((row) => row.type === "Pemasukan").reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const expense = flows.filter((row) => row.type !== "Pemasukan").reduce((sum, row) => sum + Number(row.amount || 0), 0);
        return { sales, shipped, paid, receivable: sales - paid, income, expense, cash: income - expense };
    }, [flows, orders]);
    return <div className="page-content" style={{ maxWidth: 1260, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>LAPORAN · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Laporan</h1><p className="page-subtitle">Ringkasan operasional dan keuangan cabang, dengan struktur ringkasan Toto Pusat.</p></div><button onClick={() => void load()} style={button}>↻ Muat ulang</button></div>
        <section style={{ ...panel, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}><label style={label}>Tahun<select value={year} onChange={(event) => setYear(Number(event.target.value))} style={input}>{[year - 1, year, year + 1].map((value) => <option key={value}>{value}</option>)}</select></label><label style={label}>Bulan<select value={month} onChange={(event) => setMonth(Number(event.target.value))} style={input}>{MONTHS.map((value, index) => <option key={value} value={index + 1}>{value}</option>)}</select></label></section>
        {error && <p style={{ color: "#B91C1C", fontWeight: 700 }}>{error}</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))", gap: 12, marginTop: 18 }}><Card label="Nilai pesanan" value={money(summary.sales)} /><Card label="Barang terkirim" value={money(summary.shipped)} /><Card label="Piutang terbuka" value={money(summary.receivable)} color="#B91C1C" /><Card label="Kas bersih periode" value={money(summary.cash)} color={summary.cash < 0 ? "#B91C1C" : "#15803D"} /></div>
        <section style={{ ...panel, marginTop: 18 }}><h2 style={{ margin: "0 0 14px", fontSize: 16 }}>Ringkasan {MONTHS[month - 1]} {year}</h2><table style={table}><tbody><Line label="Jumlah baris pesanan" value={`${orders.length} barang`} /><Line label="Nilai pesanan (invoice/penjualan)" value={money(summary.sales)} /><Line label="Nilai pesanan terkirim" value={money(summary.shipped)} /><Line label="Invoice sudah lunas" value={money(summary.paid)} /><Line label="Piutang belum lunas" value={money(summary.receivable)} /><Line label="Pemasukan kas tercatat" value={money(summary.income)} /><Line label="Pengeluaran kas tercatat" value={money(summary.expense)} /><Line label="Arus kas bersih" value={money(summary.cash)} strong /></tbody></table><p style={note}>Kas mengikuti transaksi Keuangan; nilai pesanan mengikuti harga, kuantitas, dan ukuran pada pesanan Sidoarjo.</p></section>
        {loading && <p style={{ color: "#7B6656" }}>Memuat data laporan…</p>}
    </div>;
}
function Card({ label, value, color = "#3C2F2F" }: { label: string; value: string; color?: string }) { return <div style={panel}><div style={{ fontSize: 11, fontWeight: 800, color: "#A67B5B", textTransform: "uppercase" }}>{label}</div><div style={{ fontSize: 21, fontWeight: 800, color, marginTop: 6 }}>{value}</div></div>; }
function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <tr><td style={{ ...td, fontWeight: strong ? 800 : 500 }}>{label}</td><td style={{ ...td, textAlign: "right", fontWeight: strong ? 800 : 700 }}>{value}</td></tr>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start", marginBottom: 18 }; const eyebrow: React.CSSProperties = { color: "#A67B5B", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", marginBottom: 7 }; const panel: React.CSSProperties = { background: "#FFFDF9", border: "1px solid #E8DCCF", borderRadius: 12, padding: 18 }; const button: React.CSSProperties = { minHeight: 34, padding: "0 11px", border: "1px solid #D8C1AA", borderRadius: 6, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" }; const label: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "#6B574B", textTransform: "uppercase" }; const input: React.CSSProperties = { minHeight: 36, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white" }; const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 13 }; const td: React.CSSProperties = { padding: "11px 8px", borderBottom: "1px solid #F0E7DE", color: "#514036" }; const note: React.CSSProperties = { marginBottom: 0, color: "#7B6656", fontSize: 12, lineHeight: 1.5 };
