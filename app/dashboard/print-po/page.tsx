"use client";
import React, { useState, useRef } from "react";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";
import { FinishingTab } from "./FinishingTab";

/* ================================================================
   PRINT PO — 2 Tab
   Tab 1: Print PO (form pilih item + cetak)
   Tab 2: Riwayat Print PO (log semua PO yang sudah di-print)
================================================================ */

const MONTH_NAMES_LONG = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function fmtDateFull(iso: string): string {
    if (!iso) return "—";
    const p = iso.split("-");
    if (p.length !== 3) return iso;
    return `${parseInt(p[2])} ${MONTH_NAMES_LONG[parseInt(p[1]) - 1]} ${p[0]}`;
}
function fmtDateShort(d: string): string {
    if (!d) return "—";
    const p = d.split("-");
    const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    return p.length === 3 ? `${p[2]} ${MONTH_SHORT[parseInt(p[1]) - 1]}` : d;
}

/* ================================================================
   TAB 1: Print PO (form)
================================================================ */
function TabPrintPO() {
    const { rows, updateRow } = usePesanan();
    const [operator, setOperator] = useState("");
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [marked, setMarked] = useState(false);
    const printRef = useRef<HTMLDivElement>(null);

    // Filter & Search
    const allItems = rows.filter((r) => {
        const isPending = (r.customer || r.deskripsi) && !r.printed_at && !r.di_produksi;
        if (!isPending) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return [r.customer, r.deskripsi, r.ukuran].join(" ").toLowerCase().includes(q);
    });
    
    const pendingCount = allItems.filter(r => (r.customer || r.deskripsi) && !r.printed_at && !r.di_produksi).length;

    const toggle = (id: number) =>
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    const toggleAll = () =>
        setSelectedIds(selectedIds.length === allItems.length ? [] : allItems.map((r) => r.id));

    // PENTING: Menggunakan mapping dari selectedIds agar urutannya SESUAI urutan centang (instruksi Faisal)
    const selectedItems = selectedIds
        .map(id => rows.find(r => r.id === id))
        .filter((r): r is PesananRow => !!r);

    const tandaiDiproduksi = () => {
        if (selectedIds.length === 0) return;
        selectedIds.forEach((id) => updateRow(id, { di_produksi: true }, true));
        setMarked(true);
        setSelectedIds([]); // <-- Clear pilihan setelah sukses
        setTimeout(() => setMarked(false), 2500);
    };

    const cetak = () => {
        const el = printRef.current;
        if (!el || selectedItems.length === 0) return;
        // Gunakan ISO String Lengkap agar setiap sesi cetak punya ID unik di riwayat
        const fullISO = new Date().toISOString(); 
        selectedIds.forEach((id) =>
            updateRow(id, { printed_at: fullISO, po_label: operator || "PO" }, true)
        );
        const now = new Date();
        const fmtDate = now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
        const win = window.open("", "_blank", "width=820,height=680");
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>PO ${operator || "Produksi"}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial,sans-serif; font-size: 13px; padding: 28px 32px; color:#000; margin:0 }
  .date { font-size:14px; color:#555; margin-bottom:8px; }
  h2 { font-size:22px; font-weight:800; margin:0 0 20px; }
  table { width:100%; border-collapse:collapse; }
  thead tr th { background:#111; color:#fff; padding:9px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; }
  tbody tr td { padding:9px 12px; border-bottom:1px solid #eee; font-size:12px; }
  tbody tr:nth-child(even) td { background:#fafafa; }
  .ceklis-box { width:18px; height:18px; border:2px solid #333; border-radius:3px; display:inline-block; }
  .footer { margin-top:28px; display:flex; justify-content:space-between; border-top:1px solid #ccc; padding-top:14px; }
  .sign { text-align:center; }
  .sign-line { width:120px; border-top:1px solid #333; margin:0 auto 6px; }
  @media print { body { padding:16px; } }
</style></head>
<body>
${el.innerHTML}
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`);
        win.document.close();
        
        // CLEAR pilihan setelah print sukses agar tidak terbawa ke print selanjutnya
        setSelectedIds([]);
        setOperator(""); // Opsional: Kosongkan juga nama operator setelah selesai
    };

    const now = new Date();
    const fmtDate = now.toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

    const btnStyle = (primary: boolean): React.CSSProperties => ({
        display: "flex", alignItems: "center", gap: 7,
        padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer",
        fontWeight: 700, fontSize: 13,
        background: primary ? "#A67B5B" : "#D1BFA3",
        color: primary ? "white" : "#5C4033",
        opacity: selectedIds.length === 0 ? 0.45 : 1,
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Header bar */}
            <div style={{ display: "flex", alignItems: "center", padding: "10px 18px", background: "white", borderBottom: "1px solid #E6D5BE", gap: 12, flexShrink: 0 }}>
                <div style={{ background: "#FFF9C4", color: "#A16207", borderRadius: 99, padding: "2px 12px", fontSize: 12, fontWeight: 700 }}>
                    {pendingCount} Pending
                </div>
                {marked && (
                    <div style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "2px 14px", fontSize: 12, fontWeight: 700 }}>
                        ✓ {selectedIds.length} item ditandai Di Produksi
                    </div>
                )}
                <div style={{ marginLeft: "auto", display: "flex", gap: 10 }}>
                    <button onClick={cetak} disabled={selectedIds.length === 0} style={btnStyle(false)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Cetak &amp; Proses
                    </button>
                    <button onClick={tandaiDiproduksi} disabled={selectedIds.length === 0} style={btnStyle(true)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        Tandai Diproduksi
                    </button>
                </div>
            </div>

            {/* Split body */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {/* LEFT PANEL */}
                <div style={{ width: 340, minWidth: 290, background: "white", borderRight: "1px solid #E6D5BE", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <div style={{ padding: "16px 18px", borderBottom: "1px solid #F0E6D8" }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 6 }}>
                            NAMA OPERATOR / JUDUL PO
                        </label>
                        <input
                            type="text" value={operator}
                            onChange={(e) => setOperator(e.target.value)}
                            placeholder='cth: "ATE" → PO ATE'
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "9px 12px", fontSize: 13, color: "#3C2F2F", background: "#FFFBF7", outline: "none", boxSizing: "border-box" }}
                        />
                    </div>
                    <div style={{ padding: "0 18px 12px", borderBottom: "1px solid #F0E6D8" }}>
                        <input
                            type="text" value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder='🔍 Cari item/customer...'
                            style={{ width: "100%", border: "1px solid #E6D5BE", borderRadius: 6, padding: "6px 10px", fontSize: 12, color: "#5C4033", background: "#FAF7F3", outline: "none" }}
                        />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", borderBottom: "1px solid #F0E6D8" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#5C4033" }}>
                            Pilih Item
                            {selectedIds.length > 0 && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: "#A67B5B" }}>({selectedIds.length} dipilih)</span>}
                        </span>
                        <button onClick={toggleAll} style={{ fontSize: 11, color: "#A67B5B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                            {selectedIds.length === allItems.length ? "Batal Semua" : "Pilih Semua"}
                        </button>
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
                        {allItems.length === 0 ? (
                            <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#C5A882", fontSize: 12 }}>
                                Belum ada item. Isi di <strong>Input Pesanan</strong>.
                            </div>
                        ) : (
                            allItems.map((row) => {
                                const isSel = selectedIds.includes(row.id);
                                return (
                                    <div key={row.id} onClick={() => toggle(row.id)}
                                        style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 18px", cursor: "pointer", background: isSel ? "#FEF3E8" : "white", borderLeft: isSel ? "3px solid #A67B5B" : "3px solid transparent", borderBottom: "1px solid #F5F0EC" }}>
                                        <input type="checkbox" checked={isSel} readOnly style={{ accentColor: "#A67B5B", marginTop: 3, width: 15, height: 15, cursor: "pointer", flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 13, color: "#3C2F2F", marginBottom: 2 }}>{row.customer || "—"}</div>
                                            <div style={{ fontSize: 11, color: "#6B5E55", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.deskripsi || "—"}</div>
                                            <div style={{ fontSize: 11, color: "#B89678", fontWeight: 600 }}>{row.ukuran || "—"} · Qty: {row.qty || "—"}</div>
                                        </div>
                                        {row.di_produksi && (
                                            <span style={{ background: "#DCFCE7", color: "#15803D", fontSize: 9, fontWeight: 700, borderRadius: 99, padding: "2px 7px", flexShrink: 0, marginTop: 2 }}>✓ PROD</span>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: PO Preview */}
                <div style={{ flex: 1, overflow: "auto", padding: "24px 28px", background: "#FAF7F3" }}>
                    <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 20px rgba(92,64,51,0.09)", padding: "32px 36px", maxWidth: 760, margin: "0 auto" }}>
                        <div ref={printRef}>
                            <div className="date" style={{ fontSize: 14, color: "#5C4033", fontWeight: 600, marginBottom: 6 }}>{fmtDate}</div>
                            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#1a1a1a", marginBottom: 22 }}>
                                PO {operator || <span style={{ color: "#C5A882", fontStyle: "italic", fontWeight: 400 }}>nama operator...</span>}
                            </h2>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        {["NAMA", "KETERANGAN", "UK", "QTY", "CEKLIS"].map((h) => (
                                            <th key={h} style={{ background: "#111", color: "white", padding: "9px 12px", textAlign: h === "UK" || h === "QTY" || h === "CEKLIS" ? "center" : "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", width: h === "CEKLIS" ? 70 : h === "UK" || h === "QTY" ? 60 : undefined }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedItems.length === 0 ? (
                                        <tr><td colSpan={5} style={{ textAlign: "center", padding: "2.5rem", color: "#C5A882", fontSize: 13 }}>Belum ada item dipilih.</td></tr>
                                    ) : (
                                        selectedItems.map((row, idx) => (
                                            <tr key={row.id} style={{ background: idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                                                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, borderBottom: "1px solid #F0F0F0" }}>{row.customer}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 12, color: "#444", borderBottom: "1px solid #F0F0F0" }}>{row.deskripsi}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 12, textAlign: "center", borderBottom: "1px solid #F0F0F0" }}>{row.ukuran || "—"}</td>
                                                <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 700, textAlign: "center", borderBottom: "1px solid #F0F0F0" }}>{row.qty || "—"}</td>
                                                <td style={{ padding: "10px 12px", textAlign: "center", borderBottom: "1px solid #F0F0F0" }}>
                                                    <div className="ceklis-box" style={{ width: 18, height: 18, border: "2px solid #333", borderRadius: 3, display: "inline-block" }} />
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {selectedItems.length > 0 && (
                                <div className="footer" style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-end", paddingTop: 16, borderTop: "1px solid #E6D5BE" }}>
                                    <div style={{ fontSize: 12, color: "#B89678" }}>Total: <strong style={{ color: "#5C4033" }}>{selectedItems.length} item</strong></div>
                                    <div className="sign" style={{ textAlign: "center" }}>
                                        <div className="sign-line" style={{ width: 120, borderTop: "1px solid #5C4033", marginBottom: 6 }} />
                                        <div style={{ fontSize: 11, color: "#5C4033", fontWeight: 600 }}>{operator || "Operator"}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   REPRINT HELPER — cetak ulang satu grup PO dari riwayat
================================================================ */
function reprintPO(poLabel: string, tanggal: string, items: PesananRow[]) {
    const fmtDate = tanggal
        ? new Date(tanggal).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" })
        : new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

    const tableRows = items.map((row, idx) => `
        <tr style="background:${idx % 2 === 0 ? "white" : "#fafafa"}">
            <td style="padding:9px 12px;font-size:13px;font-weight:600;border-bottom:1px solid #eee">${row.customer || "—"}</td>
            <td style="padding:9px 12px;font-size:12px;color:#444;border-bottom:1px solid #eee">${row.deskripsi || "—"}</td>
            <td style="padding:9px 12px;font-size:12px;text-align:center;border-bottom:1px solid #eee">${row.ukuran || "—"}</td>
            <td style="padding:9px 12px;font-size:12px;font-weight:700;text-align:center;border-bottom:1px solid #eee">${row.qty || "—"}</td>
            <td style="padding:9px 12px;text-align:center;border-bottom:1px solid #eee"><div style="width:18px;height:18px;border:2px solid #333;border-radius:3px;display:inline-block"></div></td>
        </tr>`).join("");

    const win = window.open("", "_blank", "width=820,height=680");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>PO ${poLabel}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial,sans-serif; font-size: 13px; padding: 28px 32px; color:#000; margin:0 }
  table { width:100%; border-collapse:collapse; }
  thead tr th { background:#111; color:#fff; padding:9px 12px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; }
  .footer { margin-top:28px; display:flex; justify-content:space-between; border-top:1px solid #ccc; padding-top:14px; }
  .sign { text-align:center; }
  .sign-line { width:120px; border-top:1px solid #333; margin:0 auto 6px; }
  @media print { body { padding:16px; } }
</style></head>
<body>
  <div style="font-size:14px;color:#555;margin-bottom:8px">${fmtDate}</div>
  <h2 style="font-size:22px;font-weight:800;margin:0 0 20px">PO ${poLabel}</h2>
  <table>
    <thead><tr>
      <th>NAMA</th><th>KETERANGAN</th>
      <th style="width:60px;text-align:center">UK</th>
      <th style="width:60px;text-align:center">QTY</th>
      <th style="width:70px;text-align:center">CEKLIS</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  <div class="footer">
    <div style="font-size:12px;color:#888">Total: <strong style="color:#333">${items.length} item</strong></div>
    <div class="sign">
      <div class="sign-line"></div>
      <div style="font-size:11px;font-weight:600">${poLabel}</div>
    </div>
  </div>
<script>window.onload=()=>{window.print();window.close();}<\/script>
</body></html>`);
    win.document.close();
}

/* ================================================================
   TAB 2: Riwayat Print PO
================================================================ */
function TabRiwayatPO() {
    const { rows } = usePesanan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    // Semua row yang sudah di-print
    const baseRows = rows.filter((r) => (r.customer || r.deskripsi) && r.printed_at);

    const filtered = baseRows.filter((r) => {
        const d = r.printed_at;
        const matchDate = !d || (parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month);
        const q = search.toLowerCase();
        const matchSearch = !q || [r.customer, r.deskripsi, r.po_label].join(" ").toLowerCase().includes(q);
        return matchDate && matchSearch;
    });

    // Group by printed_at (ISO String) + operator
    const groupMap: Record<string, { label: string; poLabel: string; tanggal: string; rows: PesananRow[] }> = {};
    filtered.forEach((r) => {
        const opKey = r.po_label || "(Tanpa Operator)";
        // Key menggunakan jam menit agar sesi cetak yang sama di tanggal yang sama tidak menyatu
        const key = `${r.printed_at}|||${opKey}`;
        if (!groupMap[key]) {
            // Label tetap menampilkan tanggal saja agar rapi, atau bisa ditambah jam (opsional)
            const dateOnly = r.printed_at.slice(0, 10);
            groupMap[key] = { label: fmtDateFull(dateOnly), poLabel: opKey, tanggal: r.printed_at, rows: [] };
        }
        groupMap[key].rows.push(r);
    });

    const sortedKeys = Object.keys(groupMap).sort((a, b) => {
        const [dateA, opA] = a.split("|||");
        const [dateB, opB] = b.split("|||");
        if (dateB !== dateA) return dateB.localeCompare(dateA);
        return opA.localeCompare(opB);
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 14px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>
                <div style={{ display: "flex", gap: 4 }}>
                    <select value={month} onChange={(e) => setMonth(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 7px", fontSize: 11, color: "#5C4033", background: "#FFFBF7", height: 28 }}>
                        {MONTH_NAMES_LONG.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 7px", fontSize: 11, color: "#5C4033", background: "#FFFBF7", height: 28 }}>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari operator, customer..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 8px", fontSize: 11, width: 200, height: 28, color: "#5C4033", background: "#FFFBF7" }} />
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#B89678" }}>
                    {sortedKeys.length} PO dicetak
                </span>
            </div>

            {sortedKeys.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#C5A882", fontSize: 13 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
                    <div style={{ fontWeight: 700 }}>Belum ada PO yang dicetak bulan ini</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>PO akan tersimpan di sini otomatis setelah dicetak dari tab <strong>Print PO</strong></div>
                </div>
            ) : (
                <div style={{ flex: 1, overflow: "auto", background: "white" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                        <thead>
                            <tr>
                                {["Tgl Print", "Operator / Judul PO", "Total Item", "Total Qty", ""].map((h) => (
                                    <th key={h} style={{
                                        background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11,
                                        padding: "7px 10px", borderBottom: "2px solid #C5A882", borderRight: "1px solid #D1BFA3",
                                        whiteSpace: "nowrap", textAlign: h === "Total Item" || h === "Total Qty" ? "center" : "left",
                                        position: "sticky", top: 0, zIndex: 4,
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedKeys.map((key, idx) => {
                                const grp = groupMap[key];
                                const totalQty = grp.rows.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0);
                                const isExp = expanded === key;
                                const rowBg = idx % 2 === 0 ? "white" : "#FAFAF8";
                                return (
                                    <React.Fragment key={key}>
                                        <tr style={{ background: rowBg }}>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", whiteSpace: "nowrap", color: "#5C4033", fontWeight: 600 }}>
                                                {grp.label}
                                            </td>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE" }}>
                                                <span style={{ background: "#A67B5B", color: "white", borderRadius: 99, padding: "2px 10px", fontSize: 10, fontWeight: 700 }}>
                                                    {grp.poLabel}
                                                </span>
                                            </td>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center", fontWeight: 700 }}>
                                                {grp.rows.length}
                                            </td>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center" }}>
                                                {totalQty > 0 ? totalQty.toFixed(2) : "—"}
                                            </td>
                                            <td style={{ padding: "4px 8px", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>
                                                <div style={{ display: "flex", gap: 4 }}>
                                                    <button onClick={() => setExpanded(isExp ? null : key)}
                                                        style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #D1BFA3", background: isExp ? "#EDE0D4" : "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#5C4033" }}>
                                                        {isExp ? "▲ Tutup" : "▼ Detail"}
                                                    </button>
                                                    <button onClick={() => reprintPO(grp.poLabel, grp.tanggal, grp.rows)}
                                                        style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #A67B5B", background: "#FEF3E8", cursor: "pointer", fontSize: 10, fontWeight: 700, color: "#A67B5B", display: "flex", alignItems: "center", gap: 4 }}>
                                                        🖨️ Cetak Ulang
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {isExp && (
                                            <tr>
                                                <td colSpan={5} style={{ padding: "0 0 0 30px", borderBottom: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                                                    <table style={{ borderCollapse: "collapse", width: "calc(100% - 30px)", margin: "8px 0", fontSize: 11 }}>
                                                        <thead>
                                                            <tr>
                                                                {["No", "Tgl Order", "Customer", "Deskripsi", "Ukuran", "Qty", "Status"].map((h) => (
                                                                    <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", padding: "5px 8px", fontWeight: 700, fontSize: 10, textAlign: h === "No" || h === "Ukuran" || h === "Qty" ? "center" : "left", borderRight: "1px solid #D1BFA3" }}>{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {grp.rows.map((r, i) => {
                                                                const stage = r.di_kirim ? { label: "Di Kirim", bg: "#DCFCE7", color: "#15803D" }
                                                                    : r.siap_kirim ? { label: "Siap Kirim", bg: "#DBEAFE", color: "#1D4ED8" }
                                                                        : r.di_warna ? { label: "Di Warna", bg: "#FEF9C3", color: "#A16207" }
                                                                            : r.di_produksi ? { label: "Di Produksi", bg: "#FFE4E6", color: "#BE123C" }
                                                                                : { label: "Belum", bg: "#F3F4F6", color: "#6B7280" };
                                                                return (
                                                                    <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAF8" }}>
                                                                        <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE", color: "#B89678" }}>{i + 1}</td>
                                                                        <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", color: "#6B5E55", whiteSpace: "nowrap" }}>{fmtDateShort(r.tanggal)}</td>
                                                                        <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", fontWeight: 600 }}>{r.customer}</td>
                                                                        <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", color: "#555", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.deskripsi}</td>
                                                                        <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE" }}>{r.ukuran || "—"}</td>
                                                                        <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700, borderRight: "1px solid #E6D5BE" }}>{r.qty || "—"}</td>
                                                                        <td style={{ padding: "4px 8px" }}>
                                                                            <span style={{ background: stage.bg, color: stage.color, borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>{stage.label}</span>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

/* ================================================================
   MAIN PAGE — 2 Tab
================================================================ */
export default function PrintPOPage() {
    const [activeTab, setActiveTab] = useState<"print" | "riwayat" | "finishing">("print");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F5EBDD" }}>

            {/* Tab navigation */}
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, paddingLeft: 14 }}>
                <button onClick={() => setActiveTab("print")} style={tabStyle("print")}>
                    🖨️ Print PO
                </button>
                <button onClick={() => setActiveTab("riwayat")} style={tabStyle("riwayat")}>
                    📂 Riwayat Print PO
                </button>
                <button onClick={() => setActiveTab("finishing")} style={tabStyle("finishing")}>
                    🎨 PO Finishing
                </button>
            </div>

            {/* Tab content */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {activeTab === "print" && <TabPrintPO />}
                {activeTab === "riwayat" && <TabRiwayatPO />}
                {activeTab === "finishing" && <FinishingTab />}
            </div>
        </div>
    );
}
