"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const PAGE_SIZE = 100;
const EMPTY_ROWS = 12;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const today = () => new Date().toISOString().slice(0, 10);
const emptyRow = (id: string) => ({ id, tanggal: today(), customer: "", deskripsi: "", ukuran: "", qty: "", persisted: false });

type Order = { id: number; tanggal: string; customer: string; deskripsi: string; ukuran: string; qty: string; no_inv: string; harga: string };
type Draft = { id: string | number; tanggal: string; customer: string; deskripsi: string; ukuran: string; qty: string; persisted: boolean };

function periodOf(value: string) {
    const iso = value.match(/^(\d{4})-(\d{2})/);
    if (iso) return { year: Number(iso[1]), month: Number(iso[2]) };
    const id = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return id ? { year: Number(id[3]), month: Number(id[2]) } : null;
}

export default function SidoarjoPesananPage() {
    const currentYear = new Date().getFullYear();
    const [rows, setRows] = useState<Order[]>([]);
    const [drafts, setDrafts] = useState<Draft[]>(() => Array.from({ length: EMPTY_ROWS }, (_, i) => emptyRow(`new-${i}`)));
    const [month, setMonth] = useState<number | "all">(new Date().getMonth() + 1);
    const [year, setYear] = useState(currentYear);
    const [mode, setMode] = useState<"input" | "history">("input");
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState<string>("");
    const years = useMemo(() => Array.from({ length: Math.max(4, currentYear - 2023 + 2) }, (_, i) => 2023 + i), [currentYear]);

    const load = useCallback(async () => {
        setLoading(true);
        const data: Order[] = [];
        for (let from = 0; ; from += 1000) {
            const { data: pageData, error } = await supabase.from("pesanan_rows").select("id,tanggal,customer,deskripsi,ukuran,qty,no_inv,harga").eq("operating_unit", UNIT).order("id", { ascending: false }).range(from, from + 999);
            if (error) { setNotice(`Gagal memuat pesanan: ${error.message}`); break; }
            data.push(...((pageData ?? []) as Order[]));
            if (!pageData || pageData.length < 1000) break;
        }
        setRows(data); setLoading(false);
    }, []);
    useEffect(() => { void load(); }, [load]);
    useEffect(() => {
        const channel = supabase.channel("sidoarjo-grid-pesanan").on("postgres_changes", { event: "*", schema: "public", table: "pesanan_rows", filter: `operating_unit=eq.${UNIT}` }, () => void load()).subscribe();
        return () => { void supabase.removeChannel(channel); };
    }, [load]);

    const periodRows = useMemo(() => rows.filter((row) => { const period = periodOf(row.tanggal); return period && period.year === year && (month === "all" || period.month === month); }), [rows, year, month]);
    const historyPages = Math.max(1, Math.ceil(periodRows.length / PAGE_SIZE));
    const visibleRows = useMemo(() => mode === "history" ? periodRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((row) => ({ ...row, persisted: true })) : drafts, [drafts, mode, page, periodRows]);
    const filledDrafts = drafts.filter((row) => row.customer.trim() || row.deskripsi.trim());
    useEffect(() => { setPage(1); }, [month, year]);
    const changeDraft = (id: string | number, key: keyof Omit<Draft, "id" | "persisted">, value: string) => setDrafts((current) => current.map((row) => row.id === id ? { ...row, [key]: value } : row));
    const addRows = (amount: number) => setDrafts((current) => [...current, ...Array.from({ length: amount }, (_, i) => emptyRow(`new-${Date.now()}-${i}`))]);
    const saveAll = async () => {
        const valid = filledDrafts.filter((row) => row.customer.trim() && row.deskripsi.trim());
        if (!valid.length) { setNotice("Isi minimal nama customer dan deskripsi pesanan pada satu baris."); return; }
        if (valid.length !== filledDrafts.length) { setNotice("Setiap baris yang diisi wajib memiliki customer dan deskripsi pesanan."); return; }
        setSaving(true); setNotice("");
        const { error } = await supabase.from("pesanan_rows").insert(valid.map((row) => ({ tanggal: row.tanggal || today(), customer: row.customer.trim(), deskripsi: row.deskripsi.trim(), ukuran: row.ukuran.trim(), qty: row.qty || "1", operating_unit: UNIT, sync_id: `sidoarjo-${crypto.randomUUID()}` })));
        setSaving(false);
        if (error) { setNotice(`Pesanan belum tersimpan: ${error.message}`); return; }
        setDrafts(Array.from({ length: EMPTY_ROWS }, (_, i) => emptyRow(`new-${Date.now()}-${i}`)));
        setNotice(`${valid.length} pesanan berhasil disimpan.`); await load();
    };
    const exportExcel = () => { const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(periodRows.map((row, i) => ({ No: i + 1, Tanggal: row.tanggal, "Nama Customer": row.customer, "Deskripsi Pesanan": row.deskripsi, Ukuran: row.ukuran, Qty: row.qty }))), "Pesanan Sidoarjo"); XLSX.writeFile(book, `pesanan-sidoarjo-${year}-${month === "all" ? "semua" : String(month).padStart(2, "0")}.xlsx`); };

    return <div style={shell}>
        <div style={toolbar}><div><span style={title}>Input Pesanan</span><span style={sub}>{mode === "input" ? `0 tersimpan · ${periodRows.length} pesanan total` : `Hal. ${page}/${historyPages} · ${periodRows.length} pesanan total`}</span></div><div style={filters}><select value={month} onChange={(e) => setMonth(e.target.value === "all" ? "all" : Number(e.target.value))} style={select}><option value="all">Semua Bulan</option>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select><select value={year} onChange={(e) => setYear(Number(e.target.value))} style={select}>{years.map((value) => <option key={value}>{value}</option>)}</select></div><span style={hint}>↑↓←→ navigasi · Ctrl+C salin · Ctrl+V tempel · input langsung dalam tabel</span><div style={{ marginLeft: "auto", display: "flex", gap: 8 }}><button disabled={saving} onClick={() => void saveAll()} style={saveButton}>{saving ? "⏳ Menyimpan..." : "💾 SIMPAN DATA"}</button><button onClick={exportExcel} style={exportButton}>↧ Excel</button></div></div>
        {notice && <div style={{ padding: "7px 14px", fontSize: 12, fontWeight: 700, color: notice.includes("berhasil") ? "#15803D" : "#B91C1C", background: notice.includes("berhasil") ? "#F0FDF4" : "#FEF2F2" }}>{notice}</div>}
        <div style={gridWrap}><table style={grid}><colgroup><col style={{ width: 56 }} /><col style={{ width: 160 }} /><col style={{ width: "26%" }} /><col style={{ width: "42%" }} /><col style={{ width: 110 }} /><col style={{ width: 80 }} /></colgroup><thead><tr>{["No", "Tanggal", "Nama Customer", "Deskripsi Pesanan", "Ukuran", "Qty"].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={6} style={empty}>Memuat pesanan Sidoarjo…</td></tr> : visibleRows.map((row, index) => <tr key={row.id} style={{ background: row.persisted ? "white" : "#FAFAF8" }}><td style={numberCell}>{mode === "history" ? (page - 1) * PAGE_SIZE + index + 1 : index + 1}</td>{(["tanggal", "customer", "deskripsi", "ukuran", "qty"] as const).map((key) => <td key={key} style={cell}><input type={key === "tanggal" ? "date" : "text"} inputMode={key === "ukuran" || key === "qty" ? "decimal" : "text"} value={row[key]} disabled={row.persisted} onChange={(e: ChangeEvent<HTMLInputElement>) => changeDraft(row.id, key, e.target.value)} placeholder={key === "customer" ? "Nama customer..." : key === "deskripsi" ? "Deskripsi pesanan..." : key === "ukuran" ? "cth: 1,9" : key === "qty" ? "0" : ""} style={gridInput} /></td>)}</tr>)}</tbody></table></div>
        <div style={pager}><button onClick={() => { setMode("history"); setPage((value) => Math.max(1, value - 1)); }} disabled={mode !== "history" || page === 1} style={pageButton}>◀ Sebelumnya</button>{Array.from({ length: Math.min(7, historyPages) }, (_, index) => index + 1).map((value) => <button key={value} onClick={() => { setMode("history"); setPage(value); }} style={{ ...pageButton, background: mode === "history" && page === value ? "#A67B5B" : "white", color: mode === "history" && page === value ? "white" : "#5C4033" }}>{value}</button>)}<button onClick={() => setPage((value) => Math.min(historyPages, value + 1))} disabled={mode !== "history" || page === historyPages} style={pageButton}>Berikutnya ▶</button><button onClick={() => addRows(100)} style={{ ...pageButton, background: "#DCFCE7", color: "#15803D", width: "auto" }}>＋ 100 Baris</button><button onClick={() => setMode("input")} style={{ ...pageButton, width: "auto", background: mode === "input" ? "#A67B5B" : "#FEF3E8", color: mode === "input" ? "white" : "#A67B5B" }}>📝 Input Terbaru</button></div>
    </div>;
}

const shell: React.CSSProperties = { display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden", background: "#F5EBDD" };
const toolbar: React.CSSProperties = { display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" };
const title: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#5C4033" }; const sub: React.CSSProperties = { fontSize: 11, color: "#B89678", marginLeft: 10 }; const filters: React.CSSProperties = { display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }; const select: React.CSSProperties = { border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 7px", fontSize: 11, background: "#FFFBF7", color: "#5C4033" }; const hint: React.CSSProperties = { fontSize: 10, color: "#C5A882", marginLeft: 4 }; const saveButton: React.CSSProperties = { border: "none", borderRadius: 6, padding: "6px 16px", fontSize: 12, background: "#15803D", color: "white", cursor: "pointer", fontWeight: 700, minWidth: 130 }; const exportButton: React.CSSProperties = { border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 14px", fontSize: 12, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 };
const gridWrap: React.CSSProperties = { flex: 1, overflow: "auto", background: "white" }; const grid: React.CSSProperties = { borderCollapse: "collapse", width: "100%", tableLayout: "fixed", fontSize: 12 }; const th: React.CSSProperties = { background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11, padding: "8px 6px", borderRight: "1px solid #D1BFA3", borderBottom: "2px solid #C5A882", whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 1, textAlign: "center" }; const cell: React.CSSProperties = { height: 36, padding: 0, borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }; const numberCell: React.CSSProperties = { ...cell, textAlign: "center", padding: "2px 4px", color: "#B89678", fontWeight: 700, background: "#F8F4EE" }; const gridInput: React.CSSProperties = { width: "100%", height: "100%", minHeight: 35, border: "none", outline: "none", padding: "5px 7px", background: "transparent", color: "#3C2F2F", fontFamily: "inherit", fontSize: 12, boxSizing: "border-box" }; const empty: React.CSSProperties = { padding: "36px 12px", textAlign: "center", color: "#927C6D" }; const pager: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "8px 14px", background: "white", borderTop: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }; const pageButton: React.CSSProperties = { width: 38, height: 32, borderRadius: 6, border: "1px solid #D1BFA3", fontSize: 12, background: "white", color: "#5C4033", cursor: "pointer", fontWeight: 700 };
