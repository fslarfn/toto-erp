"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
type Status = "all" | "belum" | "produksi" | "warna" | "siap" | "kirim";
type Row = { id: number; tanggal: string; customer: string; deskripsi: string; ukuran: string; qty: string; no_inv: string; di_produksi: boolean; di_warna: boolean; siap_kirim: boolean; di_kirim: boolean };
const stages: { key: Status; label: string }[] = [{ key: "all", label: "Semua" }, { key: "belum", label: "Belum" }, { key: "produksi", label: "Produksi" }, { key: "warna", label: "Warna" }, { key: "siap", label: "Siap kirim" }, { key: "kirim", label: "Terkirim" }];
const match = (row: Row, status: Status) => status === "all" || (status === "belum" && !row.di_produksi) || (status === "produksi" && row.di_produksi && !row.di_warna) || (status === "warna" && row.di_warna && !row.siap_kirim) || (status === "siap" && row.siap_kirim && !row.di_kirim) || (status === "kirim" && row.di_kirim);

export default function SidoarjoStatusBarangPage() {
    const [rows, setRows] = useState<Row[]>([]);
    const [status, setStatus] = useState<Status>("all");
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState<number | null>(null);
    const [message, setMessage] = useState("");
    const load = useCallback(async () => {
        setLoading(true);
        const all: Row[] = [];
        let from = 0;
        while (true) {
            const { data, error } = await supabase.from("pesanan_rows").select("id,tanggal,customer,deskripsi,ukuran,qty,no_inv,di_produksi,di_warna,siap_kirim,di_kirim").eq("operating_unit", UNIT).order("id", { ascending: false }).range(from, from + 999);
            if (error) { setMessage(`Gagal memuat status barang: ${error.message}`); break; }
            all.push(...((data ?? []) as Row[]));
            if (!data || data.length < 1000) break;
            from += 1000;
        }
        setRows(all);
        setLoading(false);
    }, []);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => { const channel = supabase.channel("sidoarjo-status").on("postgres_changes", { event: "*", schema: "public", table: "pesanan_rows", filter: `operating_unit=eq.${UNIT}` }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load]);
    const filtered = useMemo(() => { const needle = query.trim().toLowerCase(); return rows.filter((row) => match(row, status) && (!needle || [row.customer, row.deskripsi, row.no_inv, row.tanggal].join(" ").toLowerCase().includes(needle))); }, [query, rows, status]);
    const count = (key: Status) => key === "all" ? rows.length : rows.filter((row) => match(row, key)).length;
    const toggle = async (row: Row, field: "di_produksi" | "di_warna" | "siap_kirim" | "di_kirim") => {
        const next = !row[field];
        if (field === "di_warna" && next && !row.di_produksi) { setMessage("Tandai Produksi terlebih dahulu."); return; }
        if (field === "siap_kirim" && next && !row.di_warna) { setMessage("Tandai Warna terlebih dahulu."); return; }
        if (field === "di_kirim" && next && !row.siap_kirim) { setMessage("Tandai Siap kirim terlebih dahulu."); return; }
        setUpdating(row.id); setMessage("");
        const { error } = await supabase.from("pesanan_rows").update({ [field]: next }).eq("id", row.id).eq("operating_unit", UNIT);
        setUpdating(null);
        if (error) { setMessage(`Perubahan gagal disimpan: ${error.message}`); return; }
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, [field]: next } : item));
    };
    return <div className="page-content" style={{ maxWidth: 1450, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>OPERASIONAL · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Status Barang Cabang</h1><p className="page-subtitle">Pantau progres pesanan Sidoarjo. Data Toto Pusat tidak tampil di halaman ini.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{stages.map((item) => <button key={item.key} onClick={() => setStatus(item.key)} style={{ ...filterButton, ...(status === item.key ? activeFilter : {}) }}>{item.label}: {count(item.key)}</button>)}</div>
        {message && <div style={{ ...panel, padding: "10px 13px", color: "#B91C1C", marginBottom: 14, fontWeight: 700, fontSize: 13 }}>{message}</div>}
        <section style={{ ...panel, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><strong style={{ color: "#3C2F2F" }}>{filtered.length} barang tampil</strong><input value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...input, width: 290, maxWidth: "100%" }} placeholder="Cari customer, invoice, atau barang…" /></div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Tanggal", "Customer", "Deskripsi", "Ukuran", "Qty", "Invoice", "Produksi", "Warna", "Siap", "Kirim"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={10} style={emptyCell}>Memuat status barang cabang…</td></tr> : filtered.length === 0 ? <tr><td colSpan={10} style={emptyCell}>Tidak ada pesanan pada filter ini.</td></tr> : filtered.map((row) => <tr key={row.id}><td style={td}>{row.tanggal}</td><td style={{ ...td, fontWeight: 800 }}>{row.customer}</td><td style={td}>{row.deskripsi}</td><td style={td}>{row.ukuran || "—"}</td><td style={td}>{row.qty || "—"}</td><td style={td}>{row.no_inv || "—"}</td><td style={td}><Check label="Produksi" checked={row.di_produksi} disabled={updating === row.id} onChange={() => void toggle(row, "di_produksi")} /></td><td style={td}><Check label="Warna" checked={row.di_warna} disabled={updating === row.id} onChange={() => void toggle(row, "di_warna")} /></td><td style={td}><Check label="Siap" checked={row.siap_kirim} disabled={updating === row.id} onChange={() => void toggle(row, "siap_kirim")} /></td><td style={td}><Check label="Kirim" checked={row.di_kirim} disabled={updating === row.id} onChange={() => void toggle(row, "di_kirim")} /></td></tr>)}</tbody></table></div><div style={{ padding: "10px 16px", color: "#7B6656", fontSize: 12, borderTop: "1px solid #F0E7DE" }}>Seluruh pesanan Sidoarjo dimuat bertahap; pencarian berlaku untuk seluruh data yang sudah termuat.</div></section>
    </div>;
}
function Check({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: () => void }) { return <label title={label} style={{ display: "inline-flex", alignItems: "center", gap: 5, cursor: disabled ? "wait" : "pointer" }}><input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><span style={{ color: checked ? "#15803D" : "#9A8473", fontWeight: 700, fontSize: 11 }}>{checked ? "Selesai" : "—"}</span></label>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontWeight: 800, letterSpacing: ".08em", fontSize: 12, marginBottom: 7 };
const panel: React.CSSProperties = { border: "1px solid #E8DCCF", background: "#FFFDF9", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white", fontSize: 13 };
const secondary: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" };
const filterButton: React.CSSProperties = { padding: "7px 11px", borderRadius: 999, border: "1px solid #E8DCCF", background: "#FFFDF9", color: "#7B6656", fontWeight: 800, fontSize: 12, cursor: "pointer" };
const activeFilter: React.CSSProperties = { background: "#8B5E3C", color: "white", borderColor: "#8B5E3C" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#F4EBDD", color: "#6B4423", fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyCell: React.CSSProperties = { ...td, textAlign: "center", padding: "30px 12px", color: "#927C6D" };
