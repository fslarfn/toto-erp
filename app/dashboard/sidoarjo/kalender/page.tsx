"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const pad = (n: number) => String(n).padStart(2, "0");
const currentMonth = () => new Date().toISOString().slice(0, 7);
type Order = { id: number; tanggal: string | null; customer: string | null; deskripsi: string | null; no_invoice: string | number | null; di_produksi: boolean | null; di_warna: boolean | null; siap_kirim: boolean | null; dikirim: boolean | null };

export default function SidoarjoCalendarPage() {
    const [month, setMonth] = useState(currentMonth());
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const load = useCallback(async () => {
        setLoading(true); setError("");
        const [year, mon] = month.split("-").map(Number);
        const start = `${year}-${pad(mon)}-01`;
        const end = `${year}-${pad(mon)}-${pad(new Date(year, mon, 0).getDate())}`;
        const { data, error: queryError } = await supabase.from("pesanan_rows")
            .select("id,tanggal,customer,deskripsi,no_invoice,di_produksi,di_warna,siap_kirim,dikirim")
            .eq("operating_unit", UNIT).gte("tanggal", start).lte("tanggal", end).order("tanggal");
        if (queryError) setError(queryError.message); else setOrders((data ?? []) as Order[]);
        setLoading(false);
    }, [month]);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => { void load(); }, [load]);
    const days = useMemo(() => {
        const [year, mon] = month.split("-").map(Number);
        const first = new Date(year, mon - 1, 1).getDay();
        const offset = first === 0 ? 6 : first - 1;
        const count = new Date(year, mon, 0).getDate();
        return Array.from({ length: offset + count }, (_, i) => i < offset ? null : i - offset + 1);
    }, [month]);
    const byDate = useMemo(() => {
        const result = new Map<string, Order[]>();
        orders.forEach((order) => { const day = order.tanggal || ""; result.set(day, [...(result.get(day) || []), order]); });
        return result;
    }, [orders]);
    const stage = (order: Order) => order.dikirim ? "Terkirim" : order.siap_kirim ? "Siap kirim" : order.di_warna ? "Warna" : order.di_produksi ? "Produksi" : "Belum";
    const totals = useMemo(() => ({ total: orders.length, produksi: orders.filter(x => x.di_produksi && !x.dikirim).length, siap: orders.filter(x => x.siap_kirim && !x.dikirim).length, terkirim: orders.filter(x => x.dikirim).length }), [orders]);
    const [year, mon] = month.split("-").map(Number);
    return <div className="page-content" style={{ maxWidth: 1500, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>OPERASIONAL · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Kalender Operasional</h1><p className="page-subtitle">Jadwal pesanan cabang berdasarkan tanggal order. Tidak menampilkan data Toto Pusat.</p></div><button onClick={() => void load()} style={button}>↻ Muat ulang</button></div>
        <div style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginBottom: 16 }}><label style={label}>Bulan<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} style={input} /></label><div style={muted}>Menampilkan pesanan Sidoarjo untuk {MONTHS[mon - 1]} {year}.</div></div>
        <div style={cards}>{[["Pesanan", totals.total, "#6B4423"], ["Di produksi", totals.produksi, "#2563EB"], ["Siap kirim", totals.siap, "#15803D"], ["Terkirim", totals.terkirim, "#7C3AED"]].map(([labelText, value, color]) => <div style={card} key={String(labelText)}><div style={small}>{labelText}</div><b style={{ fontSize: 24, color: String(color) }}>{value}</b></div>)}</div>
        {error && <div style={{ ...panel, color: "#B91C1C", marginBottom: 16 }}>Gagal memuat kalender: {error}</div>}
        <div style={panel}><h2 style={heading}>{MONTHS[mon - 1]} {year}</h2>{loading ? <p style={muted}>Memuat jadwal…</p> : <><div style={{ overflowX: "auto" }}><div style={weekdays}>{["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map(day => <b key={day}>{day}</b>)}</div><div style={grid}>{days.map((day, index) => { if (!day) return <div key={`empty-${index}`} style={emptyCell} />; const date = `${month}-${pad(day)}`; const rows = byDate.get(date) || []; return <div key={date} style={cell}><b>{day}</b>{rows.slice(0, 3).map(order => <div key={order.id} style={entry} title={`${order.customer || "Tanpa customer"} · ${order.deskripsi || ""}`}><span>{stage(order)}</span> {order.customer || "Tanpa customer"}</div>)}{rows.length > 3 && <div style={more}>+{rows.length - 3} pesanan</div>}</div>; })}</div></div><div style={{ ...muted, marginTop: 12 }}>Kalender ini otomatis mengikuti Input Pesanan dan Status Barang Sidoarjo.</div></>}</div>
    </div>;
}
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 };
const panel: React.CSSProperties = { background: "#fff", border: "1px solid #E8DCCF", borderRadius: 12, padding: 18 };
const cards: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginBottom: 16 };
const card: React.CSSProperties = { ...panel, padding: 14 };
const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#A67B5B", marginBottom: 7 };
const label: React.CSSProperties = { display: "grid", gap: 4, fontSize: 11, fontWeight: 700, color: "#7B6656", textTransform: "uppercase" };
const input: React.CSSProperties = { padding: "8px 10px", border: "1px solid #E8DCCF", borderRadius: 7, color: "#3C2F2F", background: "white" };
const button: React.CSSProperties = { padding: "9px 12px", background: "white", color: "#6B4423", border: "1px solid #E8DCCF", borderRadius: 7, fontWeight: 700, cursor: "pointer" };
const small: React.CSSProperties = { fontSize: 11, color: "#7B6656", textTransform: "uppercase", fontWeight: 700, marginBottom: 3 };
const muted: React.CSSProperties = { color: "#7B6656", fontSize: 12 };
const heading: React.CSSProperties = { margin: "0 0 14px", fontSize: 17, color: "#3C2F2F" };
const weekdays: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(105px,1fr))", gap: 6, minWidth: 770, color: "#7B6656", fontSize: 11, textTransform: "uppercase", padding: "0 4px 6px" };
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(7, minmax(105px,1fr))", gap: 6, minWidth: 770 };
const cell: React.CSSProperties = { minHeight: 112, border: "1px solid #EDE2D7", borderRadius: 8, padding: 8, color: "#3C2F2F", fontSize: 12, overflow: "hidden" };
const emptyCell: React.CSSProperties = { minHeight: 112, background: "#FCF9F6", borderRadius: 8 };
const entry: React.CSSProperties = { marginTop: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", background: "#F8EEDC", borderRadius: 4, padding: "3px 5px", fontSize: 10, color: "#6B4423" };
const more: React.CSSProperties = { color: "#8B5E3C", fontSize: 10, marginTop: 5, fontWeight: 700 };
