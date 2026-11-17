"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type OrderRow = {
    id: number; tanggal: string; customer: string; deskripsi: string; ukuran: string; qty: string;
    di_produksi: boolean; di_warna: boolean; siap_kirim: boolean; di_kirim: boolean;
};

function periodOf(value: string) {
    const iso = value.match(/^(\d{4})-(\d{2})/);
    if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
    const local = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return local ? { year: Number(local[3]), month: Number(local[2]) } : null;
}

export default function SidoarjoProduksiPage() {
    const now = new Date();
    const [rows, setRows] = useState<OrderRow[]>([]);
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState<number | null>(null);
    const [message, setMessage] = useState("");

    const load = useCallback(async () => {
        setLoading(true); setMessage("");
        const all: OrderRow[] = [];
        for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase.from("pesanan_rows")
                .select("id,tanggal,customer,deskripsi,ukuran,qty,di_produksi,di_warna,siap_kirim,di_kirim")
                .eq("operating_unit", UNIT).order("id", { ascending: false }).range(from, from + 999);
            if (error) { setMessage(`Gagal memuat alur pesanan: ${error.message}`); break; }
            all.push(...((data ?? []) as OrderRow[]));
            if (!data || data.length < 1000) break;
        }
        setRows(all); setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        const channel = supabase.channel("sidoarjo-production-flow")
            .on("postgres_changes", { event: "*", schema: "public", table: "pesanan_rows", filter: `operating_unit=eq.${UNIT}` }, () => void load())
            .subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [load]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return rows.filter((row) => {
            const p = periodOf(row.tanggal);
            return p?.year === year && p.month === month && (!needle || `${row.customer} ${row.deskripsi} ${row.ukuran}`.toLowerCase().includes(needle));
        });
    }, [month, query, rows, year]);

    const count = (predicate: (row: OrderRow) => boolean) => visible.filter(predicate).length;
    const update = async (row: OrderRow, stage: "di_produksi" | "di_warna" | "siap_kirim") => {
        const next = !row[stage];
        if (next && stage === "di_warna" && !row.di_produksi) return setMessage("Tandai Produksi terlebih dahulu.");
        if (next && stage === "siap_kirim" && !row.di_warna) return setMessage("Tandai Warna terlebih dahulu.");
        setSaving(row.id); setMessage("");
        const { error } = await supabase.from("pesanan_rows").update({ [stage]: next }).eq("id", row.id).eq("operating_unit", UNIT);
        setSaving(null);
        if (error) { setMessage(`Perubahan belum tersimpan: ${error.message}`); return; }
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, [stage]: next } : item));
    };

    return <main style={shell}>
        <aside style={sidebar}>
            <b style={{ fontSize: 12, color: "#6B4423" }}>SESI PO SIDOARJO</b>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={select}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={select}>{[2025, 2026, 2027].map((value) => <option key={value}>{value}</option>)}</select>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="⌕ Cari customer, barang…" style={search} />
            <button onClick={() => void load()} style={reload}>↻ Muat ulang</button>
            <div style={{ marginTop: 22, color: "#9A765C", fontSize: 12, lineHeight: 1.6 }}>Alur ini khusus pesanan Sidoarjo. Status pusat tidak dapat dibaca atau diubah dari halaman ini.</div>
        </aside>
        <section style={content}>
            <div style={heading}><div><div style={eyebrow}>GUDANG & PRODUKSI · TOTO SIDOARJO</div><h1 style={{ margin: 0, fontSize: 23, color: "#3D302B" }}>Alur Pesanan</h1><p style={{ color: "#967660", margin: "7px 0 0" }}>Proses pesanan dengan alur yang sama seperti Toto Pusat.</p></div></div>
            <div style={stats}><Stat value={visible.length} label="Total" /><Stat value={count((r) => !r.di_produksi)} label="Belum" /><Stat value={count((r) => r.di_produksi && !r.di_warna)} label="Produksi" /><Stat value={count((r) => r.di_warna && !r.siap_kirim)} label="Warna" /><Stat value={count((r) => r.siap_kirim && !r.di_kirim)} label="Siap kirim" /></div>
            {message && <div style={notice}>{message}</div>}
            <div style={tablePanel}><table style={table}><thead><tr>{["No", "Customer", "Deskripsi", "Uk", "Qty", "Produksi", "Warna", "Siap kirim"].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>
                {loading ? <tr><td colSpan={8} style={empty}>Memuat alur pesanan…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} style={empty}>Tidak ada pesanan pada periode ini.</td></tr> : visible.map((row, index) => <tr key={row.id}><td style={td}>{index + 1}</td><td style={{ ...td, fontWeight: 800 }}>{row.customer}</td><td style={td}>{row.deskripsi}</td><td style={td}>{row.ukuran || "—"}</td><td style={td}>{row.qty || "—"}</td><td style={td}><Toggle checked={row.di_produksi} disabled={saving === row.id} onChange={() => void update(row, "di_produksi")} /></td><td style={td}><Toggle checked={row.di_warna} disabled={saving === row.id} onChange={() => void update(row, "di_warna")} /></td><td style={td}><Toggle checked={row.siap_kirim} disabled={saving === row.id} onChange={() => void update(row, "siap_kirim")} /></td></tr>)}</tbody></table></div>
        </section>
    </main>;
}

function Toggle({ checked, disabled, onChange }: { checked: boolean; disabled: boolean; onChange: () => void }) { return <input aria-label="Ubah tahap pesanan" type="checkbox" checked={checked} disabled={disabled} onChange={onChange} style={{ width: 24, height: 24, accentColor: "#A67B5B", cursor: disabled ? "wait" : "pointer" }} />; }
function Stat({ value, label }: { value: number; label: string }) { return <div style={stat}><b style={{ fontSize: 18 }}>{value}</b><span style={{ fontSize: 10, color: "#967660" }}>{label}</span></div>; }
const shell: React.CSSProperties = { minHeight: "calc(100vh - 72px)", display: "grid", gridTemplateColumns: "280px minmax(0,1fr)", background: "#F8F4EF" };
const sidebar: React.CSSProperties = { padding: 18, background: "#FFFDF9", borderRight: "1px solid #E8DCCF", display: "grid", alignContent: "start", gap: 10 };
const content: React.CSSProperties = { padding: 22, minWidth: 0 };
const heading: React.CSSProperties = { marginBottom: 16 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", marginBottom: 6 };
const select: React.CSSProperties = { minHeight: 38, border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#513B2B", padding: "0 10px" };
const search: React.CSSProperties = { minHeight: 38, border: "1px solid #D8C1AA", borderRadius: 7, padding: "0 10px", color: "#513B2B" };
const reload: React.CSSProperties = { minHeight: 36, border: 0, borderRadius: 7, background: "#A67B5B", color: "white", fontWeight: 800, cursor: "pointer" };
const stats: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(5,minmax(100px,1fr))", gap: 10, marginBottom: 14 };
const stat: React.CSSProperties = { background: "white", border: "1px solid #E8DCCF", borderRadius: 9, padding: "11px 14px", display: "grid", gap: 3, color: "#5C4033" };
const notice: React.CSSProperties = { padding: "10px 12px", marginBottom: 12, borderRadius: 7, background: "#FEF2F2", color: "#B91C1C", fontSize: 12, fontWeight: 700 };
const tablePanel: React.CSSProperties = { border: "1px solid #E8DCCF", borderRadius: 10, overflow: "auto", background: "white" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", minWidth: 800, fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "11px 13px", background: "#F2E8DD", color: "#6B4423", fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "10px 13px", borderTop: "1px solid #F0E7DE", color: "#4C3930" };
const empty: React.CSSProperties = { ...td, padding: 50, textAlign: "center", color: "#987B68" };
