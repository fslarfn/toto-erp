"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const digits = (value: string) => value.replace(/[^0-9.,-]/g, "");
const numeric = (value: string) => Number(value.replace(",", ".") || 0);
type Material = { id: string; code: string; name: string; category: string; unit: string; current_stock: number; minimum_stock: number; location: string; last_updated: string };
const empty = () => ({ code: "", name: "", category: "", unit: "batang", current_stock: "0", minimum_stock: "0", location: "" });

export default function SidoarjoStokBahanPage() {
    const [rows, setRows] = useState<Material[]>([]);
    const [form, setForm] = useState(empty);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const load = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase.from("materials").select("id,code,name,category,unit,current_stock,minimum_stock,location,last_updated").eq("operating_unit", UNIT).order("name");
        if (error) setMessage({ ok: false, text: `Gagal memuat stok cabang: ${error.message}` }); else setRows((data ?? []) as Material[]);
        setLoading(false);
    }, []);
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
    useEffect(() => { const channel = supabase.channel("sidoarjo-materials").on("postgres_changes", { event: "*", schema: "public", table: "materials", filter: `operating_unit=eq.${UNIT}` }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load]);
    const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return !needle ? rows : rows.filter((row) => [row.code, row.name, row.category, row.location].join(" ").toLowerCase().includes(needle)); }, [query, rows]);
    const save = async (event: FormEvent) => {
        event.preventDefault(); if (!form.name.trim()) { setMessage({ ok: false, text: "Nama bahan wajib diisi." }); return; }
        setSaving(true); setMessage(null);
        const { error } = await supabase.from("materials").insert({ code: form.code.trim(), name: form.name.trim(), category: form.category.trim(), unit: form.unit.trim() || "unit", current_stock: numeric(form.current_stock), minimum_stock: numeric(form.minimum_stock), location: form.location.trim(), last_updated: new Date().toISOString(), operating_unit: UNIT });
        setSaving(false); if (error) { setMessage({ ok: false, text: `Stok belum tersimpan: ${error.message}` }); return; }
        setForm(empty()); setMessage({ ok: true, text: "Bahan baku Sidoarjo tersimpan." }); await load();
    };
    const adjust = async (row: Material) => {
        const raw = window.prompt(`Penyesuaian stok ${row.name}. Gunakan angka positif untuk tambah atau negatif untuk kurangi.\nStok saat ini: ${row.current_stock}`, "");
        if (raw === null) return; const delta = numeric(raw); if (!delta) return;
        const next = Number(row.current_stock || 0) + delta;
        const { error } = await supabase.from("materials").update({ current_stock: next, last_updated: new Date().toISOString() }).eq("id", row.id).eq("operating_unit", UNIT);
        if (error) { setMessage({ ok: false, text: `Gagal menyesuaikan stok: ${error.message}` }); return; }
        setRows((current) => current.map((item) => item.id === row.id ? { ...item, current_stock: next } : item)); setMessage({ ok: true, text: `Stok ${row.name} diperbarui.` });
    };
    const low = rows.filter((row) => Number(row.minimum_stock || 0) > 0 && Number(row.current_stock || 0) <= Number(row.minimum_stock || 0)).length;
    return <div className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>GUDANG & PRODUKSI · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Stok Bahan</h1><p className="page-subtitle">Persediaan Sidoarjo berdiri sendiri dari gudang pusat. Gunakan pencarian dan indikator minimum untuk pengadaan.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        {message && <div style={{ ...panel, padding: "10px 13px", marginBottom: 14, color: message.ok ? "#15803D" : "#B91C1C", fontWeight: 700, fontSize: 13 }}>{message.text}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 18 }}><Card label="Jenis bahan" value={String(rows.length)} /><Card label="Stok minimum" value={String(low)} attention={low > 0} /><Card label="Total stok" value={`${rows.reduce((sum, row) => sum + Number(row.current_stock || 0), 0).toLocaleString("id-ID")} unit`} /></div>
        <form onSubmit={save} style={panel}><strong style={{ color: "#3C2F2F" }}>Tambah bahan baku Sidoarjo</strong><div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 10, marginTop: 14 }}><Field label="Kode"><input value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} style={input} /></Field><Field label="Nama bahan *"><input required value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} style={input} /></Field><Field label="Kategori"><input value={form.category} onChange={(e) => setForm((v) => ({ ...v, category: e.target.value }))} style={input} /></Field><Field label="Satuan"><input value={form.unit} onChange={(e) => setForm((v) => ({ ...v, unit: e.target.value }))} style={input} /></Field><Field label="Stok awal"><input inputMode="decimal" value={form.current_stock} onChange={(e) => setForm((v) => ({ ...v, current_stock: digits(e.target.value) }))} style={input} /></Field><Field label="Stok minimum"><input inputMode="decimal" value={form.minimum_stock} onChange={(e) => setForm((v) => ({ ...v, minimum_stock: digits(e.target.value) }))} style={input} /></Field><Field label="Lokasi"><input value={form.location} onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))} style={input} /></Field></div><button disabled={saving} style={{ ...primary, marginTop: 14 }}>{saving ? "Menyimpan…" : "＋ Simpan bahan"}</button></form>
        <section style={{ ...panel, marginTop: 18, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}><strong style={{ color: "#3C2F2F" }}>Daftar stok Sidoarjo</strong><input value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...input, width: 280, maxWidth: "100%" }} placeholder="Cari kode, bahan, lokasi…" /></div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Kode", "Bahan", "Kategori", "Lokasi", "Stok", "Minimum", "Status", "Aksi"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={8} style={emptyCell}>Memuat stok…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} style={emptyCell}>Belum ada stok bahan Sidoarjo.</td></tr> : visible.map((row) => { const minimum = Number(row.minimum_stock || 0); const lowStock = minimum > 0 && Number(row.current_stock || 0) <= minimum; return <tr key={row.id}><td style={td}>{row.code || "—"}</td><td style={{ ...td, fontWeight: 800 }}>{row.name}</td><td style={td}>{row.category || "—"}</td><td style={td}>{row.location || "—"}</td><td style={td}>{Number(row.current_stock || 0).toLocaleString("id-ID")} {row.unit}</td><td style={td}>{minimum ? `${minimum.toLocaleString("id-ID")} ${row.unit}` : "—"}</td><td style={td}><span style={{ color: lowStock ? "#B91C1C" : "#15803D", background: lowStock ? "#FEE2E2" : "#DCFCE7", borderRadius: 20, padding: "3px 8px", fontSize: 10, fontWeight: 800 }}>{lowStock ? "Perlu beli" : "Aman"}</span></td><td style={td}><button onClick={() => void adjust(row)} style={secondary}>Sesuaikan</button></td></tr>; })}</tbody></table></div></section>
    </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#6B574B", fontWeight: 800, textTransform: "uppercase" }}>{label}{children}</label>; }
function Card({ label, value, attention }: { label: string; value: string; attention?: boolean }) { return <div style={{ ...panel, padding: 15 }}><div style={{ fontSize: 11, fontWeight: 800, color: "#A67B5B", textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, color: attention ? "#B91C1C" : "#3C2F2F", fontWeight: 800, fontSize: 21 }}>{value}</div></div>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontWeight: 800, letterSpacing: ".08em", fontSize: 11, marginBottom: 7 };
const panel: React.CSSProperties = { border: "1px solid #E8DCCF", background: "#FFFDF9", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white", fontSize: 13 };
const primary: React.CSSProperties = { minHeight: 38, padding: "0 15px", border: 0, borderRadius: 7, background: "#8B5E3C", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 32, padding: "0 10px", border: "1px solid #D8C1AA", borderRadius: 6, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer", fontSize: 11 };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#F4EBDD", color: "#6B4423", fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyCell: React.CSSProperties = { ...td, textAlign: "center", padding: "30px 12px", color: "#927C6D" };
