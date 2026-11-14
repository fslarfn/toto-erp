"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const today = () => new Date().toISOString().slice(0, 10);
const number = (value: string) => value.replace(/\D/g, "");

type Row = { id: number; tanggal: string; customer: string; deskripsi: string; ukuran: string; qty: string; no_inv: string; harga: string; di_produksi: boolean; di_warna: boolean; siap_kirim: boolean; di_kirim: boolean };
const empty = () => ({ tanggal: today(), customer: "", deskripsi: "", ukuran: "", qty: "1", no_inv: "", harga: "" });

export default function SidoarjoPesananPage() {
    const [form, setForm] = useState(empty);
    const [rows, setRows] = useState<Row[]>([]);
    const [query, setQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        const all: Row[] = [];
        let from = 0;
        while (true) {
            const { data, error } = await supabase.from("pesanan_rows")
                .select("id,tanggal,customer,deskripsi,ukuran,qty,no_inv,harga,di_produksi,di_warna,siap_kirim,di_kirim")
                .eq("operating_unit", UNIT).order("id", { ascending: false }).range(from, from + 999);
            if (error) { setMessage({ ok: false, text: `Gagal memuat pesanan cabang: ${error.message}` }); break; }
            all.push(...((data ?? []) as Row[]));
            if (!data || data.length < 1000) break;
            from += 1000;
        }
        setRows(all);
        setLoading(false);
    }, []);

    useEffect(() => { void load(); }, [load]);

    useEffect(() => {
        const channel = supabase.channel("sidoarjo-orders")
            .on("postgres_changes", { event: "*", schema: "public", table: "pesanan_rows", filter: `operating_unit=eq.${UNIT}` }, () => void load())
            .subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [load]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        return !needle ? rows : rows.filter((row) => [row.customer, row.deskripsi, row.no_inv, row.tanggal].join(" ").toLowerCase().includes(needle));
    }, [query, rows]);

    const save = async (event: FormEvent) => {
        event.preventDefault();
        if (!form.customer.trim() || !form.deskripsi.trim()) {
            setMessage({ ok: false, text: "Nama customer dan deskripsi pesanan wajib diisi." });
            return;
        }
        setSaving(true); setMessage(null);
        const syncId = `sidoarjo-${crypto.randomUUID()}`;
        const { error } = await supabase.from("pesanan_rows").insert({
            ...form,
            tanggal: form.tanggal || today(), customer: form.customer.trim(), deskripsi: form.deskripsi.trim(),
            ukuran: form.ukuran.trim(), qty: form.qty || "1", no_inv: form.no_inv.trim(), harga: form.harga || "",
            sync_id: syncId, operating_unit: UNIT,
        });
        setSaving(false);
        if (error) { setMessage({ ok: false, text: `Pesanan belum tersimpan: ${error.message}` }); return; }
        setForm(empty()); setMessage({ ok: true, text: "Pesanan Sidoarjo tersimpan dan siap diproses." }); await load();
    };

    return <div className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>OPERASIONAL · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Input Pesanan Cabang</h1><p className="page-subtitle">Pesanan di sini hanya untuk Sidoarjo. Nomor invoice tetap dapat diisi manual setelah harga disepakati.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        <form onSubmit={save} style={panel}>
            <strong style={{ color: "#3C2F2F" }}>Tambah baris pesanan</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 14 }}>
                <Field label="Tanggal"><input type="date" required value={form.tanggal} onChange={(e) => setForm((v) => ({ ...v, tanggal: e.target.value }))} style={input} /></Field>
                <Field label="Customer *"><input required value={form.customer} onChange={(e) => setForm((v) => ({ ...v, customer: e.target.value }))} style={input} placeholder="Nama customer" /></Field>
                <Field label="Deskripsi pesanan *"><input required value={form.deskripsi} onChange={(e) => setForm((v) => ({ ...v, deskripsi: e.target.value }))} style={input} placeholder="Jenis / barang" /></Field>
                <Field label="Ukuran"><input value={form.ukuran} onChange={(e) => setForm((v) => ({ ...v, ukuran: e.target.value }))} style={input} placeholder="cth: 1,9" /></Field>
                <Field label="Qty"><input inputMode="decimal" value={form.qty} onChange={(e) => setForm((v) => ({ ...v, qty: number(e.target.value) }))} style={input} /></Field>
                <Field label="No. invoice"><input value={form.no_inv} onChange={(e) => setForm((v) => ({ ...v, no_inv: e.target.value }))} style={input} placeholder="Diisi setelah deal" /></Field>
                <Field label="Harga / unit"><input inputMode="numeric" value={form.harga} onChange={(e) => setForm((v) => ({ ...v, harga: number(e.target.value) }))} style={input} placeholder="0" /></Field>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}><button disabled={saving} type="submit" style={primary}>{saving ? "Menyimpan…" : "＋ Simpan Pesanan"}</button>{message && <span style={{ fontSize: 13, fontWeight: 700, color: message.ok ? "#15803D" : "#B91C1C" }}>{message.text}</span>}</div>
        </form>
        <section style={{ ...panel, marginTop: 18, padding: 0, overflow: "hidden" }}>
            <div style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}><strong style={{ color: "#3C2F2F" }}>Pesanan terbaru Sidoarjo</strong><input value={query} onChange={(e) => setQuery(e.target.value)} style={{ ...input, width: 280, maxWidth: "100%" }} placeholder="Cari customer, invoice, pesanan…" /></div>
            <div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Tanggal", "Customer", "Deskripsi", "Ukuran", "Qty", "Invoice", "Harga", "Status"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={8} style={emptyCell}>Memuat pesanan cabang…</td></tr> : visible.length === 0 ? <tr><td colSpan={8} style={emptyCell}>Belum ada pesanan Sidoarjo.</td></tr> : visible.map((row) => <tr key={row.id}><td style={td}>{row.tanggal}</td><td style={{ ...td, fontWeight: 800 }}>{row.customer}</td><td style={td}>{row.deskripsi}</td><td style={td}>{row.ukuran || "—"}</td><td style={td}>{row.qty || "—"}</td><td style={td}>{row.no_inv || "—"}</td><td style={td}>{row.harga ? `Rp ${Number(row.harga).toLocaleString("id-ID")}` : "—"}</td><td style={td}>{row.di_kirim ? "Terkirim" : row.siap_kirim ? "Siap kirim" : row.di_warna ? "Warna" : row.di_produksi ? "Produksi" : "Menunggu"}</td></tr>)}</tbody></table></div>
            <div style={{ padding: "10px 16px", borderTop: "1px solid #F0E7DE", color: "#7B6656", fontSize: 12 }}>Seluruh pesanan Sidoarjo dimuat bertahap. Gunakan pencarian untuk menyaring daftar.</div>
        </section>
    </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#6B574B", fontWeight: 800, textTransform: "uppercase" }}>{label}{children}</label>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontWeight: 800, letterSpacing: ".08em", fontSize: 12, marginBottom: 7 };
const panel: React.CSSProperties = { border: "1px solid #E8DCCF", background: "#FFFDF9", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white", fontSize: 13 };
const primary: React.CSSProperties = { minHeight: 38, padding: "0 15px", border: 0, borderRadius: 7, background: "#8B5E3C", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#F4EBDD", color: "#6B4423", fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyCell: React.CSSProperties = { ...td, textAlign: "center", padding: "30px 12px", color: "#927C6D" };
