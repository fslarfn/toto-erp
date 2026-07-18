"use client";
import DesktopOnly from "@/components/layout/DesktopOnly";
import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";
import TabFinishing from "./components/TabFinishing";

/* ================================================================
   ALUR PESANAN — 5 Tab Workflow (Clean UI v2)
   Tab 1: Produksi      → PIC Produksi centang PO selesai
   Tab 2: Cek Gudang    → PIC Gudang cek kelengkapan, tandai siap kirim
   Tab 3: Follow Up     → Marketing follow up customer, pilih metode kirim
   Tab 4: Pengiriman    → PIC Gudang kirim barang sesuai metode
   Tab 5: Riwayat       → Arsip PO selesai
================================================================ */

const MN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const ML = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
function fmtShort(d: string) { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${p[2]} ${MN[parseInt(p[1]) - 1]}` : d; }
function fmtFull(d: string) { if (!d) return ""; const p = d.split("-"); return p.length === 3 ? `${parseInt(p[2])} ${ML[parseInt(p[1]) - 1]} ${p[0]}` : d; }

async function addLog(pesanan_id: number, action: string, from_status: string, to_status: string, note: string, user_name: string) {
    try { await supabase.from("production_logs").insert({ pesanan_id, action, from_status, to_status, note, user_name }); } catch {}
}

/* ── SVG Icons for tabs ── */
function IconGudang({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
}
function IconKirim({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
}
function IconRiwayat({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
}
/* ── Shared: Empty state ── */
function EmptyState({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "4rem 1.5rem", color: "#C5A882" }}>
            <div style={{ marginBottom: 16, opacity: 0.5 }}>{icon}</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#8A6D55" }}>{title}</div>
            <div style={{ fontSize: 12, marginTop: 6, color: "#C5A882" }}>{subtitle}</div>
        </div>
    );
}

/* ── Shared: Search bar ── */
function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
    return (
        <div style={{ position: "relative" }}>
            <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#5C4033" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                style={{
                    width: "100%", border: "1.5px solid #E8DDD0", borderRadius: 10, padding: "9px 12px 9px 34px",
                    fontSize: 13, color: "#3C2F2F", background: "#FAFAF8", outline: "none", boxSizing: "border-box",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                }}
                onFocus={e => { e.target.style.borderColor = "#A67B5B"; e.target.style.boxShadow = "0 0 0 3px rgba(166,123,91,0.08)"; }}
                onBlur={e => { e.target.style.borderColor = "#E8DDD0"; e.target.style.boxShadow = "none"; }}
            />
        </div>
    );
}

/* ── Shared: Section header for content panels ── */
function SectionHeader({ title, count, countBg, countColor, actions, children }: { title: string; count: number; countBg: string; countColor: string; actions?: React.ReactNode; children?: React.ReactNode }) {
    return (
        <div style={{ padding: "14px 16px 12px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: children ? 10 : 0, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F" }}>{title}</span>
                    <span style={{ background: countBg, color: countColor, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{count}</span>
                </div>
                {actions}
            </div>
            {children}
        </div>
    );
}

/* ── Shared: Tombol Laporan WhatsApp (Salin + Share) ──
   Format: *Updet [Judul]* (tanggal) lalu per baris
   •Nama / No.Invoice / Deskripsi / Qty [emoji status]  (+ ekspedisi utk tab Kirim) */
function WaButtons({ title, items, ekspedisi, statusOf }: { title: string; items: PesananRow[]; ekspedisi?: boolean; statusOf: (r: PesananRow) => string }) {
    const build = () => {
        const today = fmtFull(new Date().toISOString().slice(0, 10));
        const lines = items.map(r => {
            const eks = ekspedisi && r.ekspedisi ? ` / ${r.ekspedisi}` : "";
            return `•${r.customer || "-"} / ${r.no_inv || "-"} / ${r.deskripsi || "-"} / ${r.qty || "-"}${eks} ${statusOf(r)}`;
        });
        return `*Updet ${title}* (${today})\n${lines.join("\n")}`;
    };
    const disabled = items.length === 0;
    const onCopy = async () => {
        try { await navigator.clipboard.writeText(build()); alert("Laporan disalin ke clipboard!"); }
        catch { alert("Gagal menyalin laporan."); }
    };
    const onShare = () => { window.open(`https://wa.me/?text=${encodeURIComponent(build())}`, "_blank"); };
    const base: React.CSSProperties = { display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, whiteSpace: "nowrap" };
    return (
        <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onCopy} disabled={disabled} style={{ ...base, background: "#F0ECE6", color: "#5C4033" }}>📋 Salin Laporan WA</button>
            <button onClick={onShare} disabled={disabled} style={{ ...base, background: "#16a34a", color: "white" }}>Share WhatsApp</button>
        </div>
    );
}

/* ================================================================
   TAB 2: CEK GUDANG — PIC Gudang cek kelengkapan & tandai siap kirim
================================================================ */
function TabCekGudang() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [editingNote, setEditingNote] = useState<number | null>(null);
    const [noteText, setNoteText] = useState("");
    const [flash, setFlash] = useState<number | null>(null);

    const items = rows.filter(r => (r.customer || r.deskripsi) && r.di_produksi && !r.siap_kirim && !r.di_kirim);
    const filtered = items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label, r.production_note].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    const groups: Record<string, PesananRow[]> = {};
    filtered.forEach(r => { const k = r.po_label || "(Tanpa PO)"; if (!groups[k]) groups[k] = []; groups[k].push(r); });

    const markReady = (row: PesananRow) => {
        updateRow(row.id, { siap_kirim: true, di_warna: true }, true);
        addLog(row.id, "status_change", "di_produksi", "siap_kirim", "", user?.name || "");
        pushNotify({
            notificationType: "status_produksi",
            title: "Pesanan Siap Kirim",
            body: `${row.customer || "—"} — ${row.deskripsi || "—"}`,
            url: "/dashboard/produksi",
        });
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    const markAllReady = (opRows: PesananRow[]) => {
        opRows.forEach(r => {
            updateRow(r.id, { siap_kirim: true, di_warna: true }, true);
            addLog(r.id, "status_change", "di_produksi", "siap_kirim", "", user?.name || "");
        });
    };

    const saveNote = (row: PesananRow) => {
        updateRow(row.id, { production_note: noteText }, true);
        if (noteText) addLog(row.id, "note", "", "", noteText, user?.name || "");
        setEditingNote(null);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="Cek Kelengkapan" count={items.length} countBg="#FFE4E6" countColor="#BE123C"
                actions={<WaButtons title="Ready Gudang" items={filtered} statusOf={r => r.siap_kirim ? "✅" : r.di_produksi ? "⏳" : "❌"} />}>
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, catatan..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {Object.keys(groups).length === 0 ? (
                    <EmptyState icon={<IconGudang size={48} color="#C5A882" />} title="Gudang kosong" subtitle="Belum ada barang dari produksi" />
                ) : Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([opKey, opRows]) => (
                    <div key={opKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #1E3A5F, #2563EB)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>PO {opKey}</span>
                                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{opRows.length}</span>
                            </div>
                            <button onClick={() => markAllReady(opRows)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
                                Semua Lengkap ✓
                            </button>
                        </div>
                        <div style={{ background: "white" }}>
                            {opRows.map((row, idx) => (
                                <div key={row.id} style={{ padding: "11px 14px", borderBottom: idx < opRows.length - 1 ? "1px solid #F5F0EC" : "none", background: flash === row.id ? "#F0FFF4" : "white", transition: "background 0.4s" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                            <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                            <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · {fmtShort(row.tanggal)}</div>
                                        </div>
                                    </div>
                                    {editingNote === row.id ? (
                                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                            <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Catatan gudang..." autoFocus
                                                onKeyDown={e => { if (e.key === "Enter") saveNote(row); if (e.key === "Escape") setEditingNote(null); }}
                                                style={{ flex: 1, border: "1.5px solid #D1BFA3", borderRadius: 8, padding: "7px 10px", fontSize: 12, outline: "none", background: "#FAFAF8" }} />
                                            <button onClick={() => saveNote(row)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#2563EB", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>OK</button>
                                        </div>
                                    ) : row.production_note ? (
                                        <div onClick={() => { setEditingNote(row.id); setNoteText(row.production_note); }} style={{ marginTop: 6, padding: "4px 8px", background: "#FAFAF5", borderRadius: 6, fontSize: 11, color: "#8A6D55", cursor: "pointer", border: "1px dashed #E8DDD0" }}>📝 {row.production_note}</div>
                                    ) : null}
                                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                                        <button onClick={() => markReady(row)} style={{
                                            flex: 1, padding: "8px 0", borderRadius: 8, border: "none", cursor: "pointer",
                                            fontWeight: 700, fontSize: 12, background: "#2563EB", color: "white",
                                            transition: "opacity 0.15s",
                                        }}
                                            onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                                            onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                                        >Siap Kirim ✓</button>
                                        <button onClick={() => { setEditingNote(row.id); setNoteText(row.production_note || ""); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #E8DDD0", background: "white", cursor: "pointer", fontSize: 12, color: "#B89678" }}>📝</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ================================================================
   TAB 4: KIRIM — input ekspedisi + tandai dikirim (per PO)
================================================================ */
function TabPengiriman() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState<number | null>(null);
    const [ekspedisiInputs, setEkspedisiInputs] = useState<Record<number, string>>({});

    const items = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && r.di_kirim === false);
    const filtered = items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label, r.no_inv, r.ekspedisi].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    const groups: Record<string, PesananRow[]> = {};
    filtered.forEach(r => { const k = r.po_label || "(Tanpa PO)"; if (!groups[k]) groups[k] = []; groups[k].push(r); });
    const sortedKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

    const getEkspedisiValue = (row: PesananRow) => ekspedisiInputs[row.id] !== undefined ? ekspedisiInputs[row.id] : (row.ekspedisi || "");
    const setEkspedisiInput = (rowId: number, val: string) => setEkspedisiInputs(prev => ({ ...prev, [rowId]: val }));

    const markDikirim = (row: PesananRow) => {
        const eks = getEkspedisiValue(row);
        if (!eks.trim()) { alert("Harap isi ekspedisi terlebih dahulu (mis. JNE, SiCepat, Lalamove, Diambil)!"); return; }
        updateRow(row.id, { di_kirim: true, shipped_at: new Date().toISOString(), ekspedisi: eks.trim() }, true);
        addLog(row.id, "status_change", "siap_kirim", "di_kirim", `via ${eks}`, user?.name || "");
        pushNotify({ notificationType: "status_produksi", title: "Pesanan Dikirim", body: `${row.customer || "—"} — ${row.deskripsi || "—"} via ${eks}`, url: "/dashboard/produksi" });
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    const markAllDikirim = (rowList: PesananRow[]) => {
        const missing = rowList.filter(r => !getEkspedisiValue(r).trim());
        if (missing.length > 0) { alert(`${missing.length} item belum diisi ekspedisinya!`); return; }
        rowList.forEach(r => {
            const eks = getEkspedisiValue(r);
            updateRow(r.id, { di_kirim: true, shipped_at: new Date().toISOString(), ekspedisi: eks.trim() }, true);
            addLog(r.id, "status_change", "siap_kirim", "di_kirim", `via ${eks}`, user?.name || "");
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="Siap Dikirim" count={items.length} countBg="#DCFCE7" countColor="#15803D"
                actions={<WaButtons title="Barang Keluar" items={filtered} ekspedisi statusOf={r => r.di_kirim ? "✅" : "⏳"} />}>
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, invoice, PO..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {sortedKeys.length === 0 ? (
                    <EmptyState icon={<IconKirim size={48} color="#C5A882" />} title="Tidak ada barang untuk dikirim" subtitle="Barang yang sudah siap (Gudang) akan muncul di sini" />
                ) : sortedKeys.map(poKey => {
                    const poRows = groups[poKey];
                    return (
                        <div key={poKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #166534, #22C55E)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>PO {poKey}</span>
                                    <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{poRows.length}</span>
                                </div>
                                <button onClick={() => markAllDikirim(poRows)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
                                    Kirim Semua ✓
                                </button>
                            </div>
                            <div style={{ background: "white" }}>
                                {poRows.map((row, idx) => (
                                    <div key={row.id} style={{ padding: "11px 14px", borderBottom: idx < poRows.length - 1 ? "1px solid #F5F0EC" : "none", background: flash === row.id ? "#F0FFF4" : "white", transition: "background 0.4s" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                                <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                                <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · Inv: {row.no_inv || "—"}</div>
                                                {row.production_note && <div style={{ marginTop: 3, fontSize: 10.5, color: "#8A6D55" }}>📝 {row.production_note}</div>}
                                            </div>
                                            <button onClick={() => markDikirim(row)} style={{ padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, whiteSpace: "nowrap", background: "#15803D", color: "white", transition: "opacity 0.15s" }}
                                                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                                                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
                                                Dikirim ✓
                                            </button>
                                        </div>
                                        <div style={{ marginTop: 8 }}>
                                            <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "#B89678", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>Ekspedisi</label>
                                            <input
                                                type="text"
                                                value={getEkspedisiValue(row)}
                                                onChange={e => setEkspedisiInput(row.id, e.target.value)}
                                                onBlur={e => { updateRow(row.id, { ekspedisi: e.target.value.trim() }, true); e.target.style.borderColor = e.target.value.trim() ? "#22C55E" : "#FCA5A5"; e.target.style.boxShadow = "none"; }}
                                                placeholder="JNE, SiCepat, LION, Lalamove, Diambil..."
                                                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: getEkspedisiValue(row).trim() ? "1.5px solid #22C55E" : "1.5px solid #FCA5A5", fontSize: 12, color: "#3C2F2F", background: getEkspedisiValue(row).trim() ? "#F0FFF4" : "#FFF5F5", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s, background 0.2s" }}
                                                onFocus={e => { e.target.style.borderColor = "#A67B5B"; e.target.style.boxShadow = "0 0 0 3px rgba(166,123,91,0.08)"; }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ================================================================
   TAB 5: RIWAYAT KIRIM — rekap bulanan + breakdown per ekspedisi
================================================================ */
function TabRiwayatPO() {
    const { rows } = usePesanan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [search, setSearch] = useState("");

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    const parseQ = (q: string) => parseFloat((q || "").replace(",", ".")) || 0;
    const fmtQty = (n: number) => (n % 1 === 0 ? String(n) : n.toFixed(1));
    const shipDate = (r: PesananRow) => (r.shipped_at ? r.shipped_at.slice(0, 10) : r.tanggal);

    // Sumber data: baris yang SUDAH DIKIRIM (di_kirim), pada bulan/tahun terpilih.
    const shipped = useMemo(() => rows.filter(r => {
        if (!(r.customer || r.deskripsi) || !r.di_kirim) return false;
        const d = shipDate(r);
        if (!d) return false;
        return parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month;
    }), [rows, year, month]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return shipped;
        return shipped.filter(r => [r.customer, r.no_inv, r.deskripsi, r.ekspedisi].join(" ").toLowerCase().includes(q));
    }, [shipped, search]);

    const totalPO = filtered.length;
    const totalQty = filtered.reduce((a, r) => a + parseQ(r.qty), 0);

    const perEks = useMemo(() => {
        const m: Record<string, { po: number; qty: number }> = {};
        filtered.forEach(r => {
            const k = (r.ekspedisi || "").trim() || "(Tanpa Ekspedisi)";
            if (!m[k]) m[k] = { po: 0, qty: 0 };
            m[k].po += 1;
            m[k].qty += parseQ(r.qty);
        });
        return Object.entries(m).sort((a, b) => b[1].qty - a[1].qty);
    }, [filtered]);
    const jenisEks = perEks.filter(([k]) => k !== "(Tanpa Ekspedisi)").length;

    const exportExcel = () => {
        if (filtered.length === 0) { alert("Tidak ada data untuk diekspor."); return; }
        const data = filtered
            .slice()
            .sort((a, b) => shipDate(b).localeCompare(shipDate(a)))
            .map(r => ({
                Tanggal: fmtFull(shipDate(r)),
                Customer: r.customer,
                "No. Invoice": r.no_inv,
                Deskripsi: r.deskripsi,
                Qty: r.qty,
                Ekspedisi: r.ekspedisi || "-",
                Status: "Dikirim",
            }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Riwayat Kirim");
        XLSX.writeFile(wb, `riwayat-kirim-${year}-${String(month).padStart(2, "0")}.xlsx`);
    };

    const selectStyle: React.CSSProperties = { border: "1.5px solid #E8DDD0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#5C4033", background: "#FAFAF8", height: 32, fontWeight: 600, outline: "none" };
    const detailRows = filtered.slice().sort((a, b) => shipDate(b).localeCompare(shipDate(a)));

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Filter bar */}
            <div style={{ padding: "12px 16px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <select value={month} onChange={e => setMonth(+e.target.value)} style={selectStyle}>{ML.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
                <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                <div style={{ position: "relative", flex: 1, minWidth: 140 }}>
                    <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#5C4033" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari customer, invoice, ekspedisi..."
                        style={{ ...selectStyle, width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
                </div>
                <button onClick={exportExcel} style={{ display: "flex", alignItems: "center", gap: 6, padding: "0 14px", height: 32, borderRadius: 8, border: "none", cursor: "pointer", background: "#15803D", color: "white", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
                    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Export Excel
                </button>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {/* Recap cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center", borderTop: "3px solid #15803D" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#15803D" }}>{totalPO}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Total PO Dikirim</div>
                    </div>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center", borderTop: "3px solid #A67B5B" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#7C5A3C" }}>{fmtQty(totalQty)}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Total Barang Dikirim</div>
                    </div>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center", borderTop: "3px solid #1D4ED8" }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: "#1D4ED8" }}>{jenisEks}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Jenis Ekspedisi</div>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState icon={<IconKirim size={48} color="#C5A882" />} title="Belum ada pengiriman" subtitle="Tidak ada barang terkirim pada periode ini" />
                ) : (
                    <>
                        {/* Breakdown per Ekspedisi */}
                        <div style={{ background: "white", borderRadius: 12, padding: "12px 14px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: "#5C4033", marginBottom: 10 }}>Rekap per Ekspedisi</div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {perEks.map(([nama, v]) => (
                                    <div key={nama} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", background: "#FAF7F3", borderRadius: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 700, color: "#3C2F2F" }}>{nama}</span>
                                        <span style={{ fontSize: 11, color: "#5C4033" }}>
                                            <strong>{v.po}</strong> PO · <strong>{fmtQty(v.qty)}</strong> barang
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tabel detail */}
                        <div style={{ background: "white", borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: "#FAF7F3" }}>
                                        {["Tanggal", "Customer", "No. Invoice", "Deskripsi", "Qty", "Ekspedisi", "Status"].map((h, i) => (
                                            <th key={h} style={{ padding: "9px 10px", textAlign: i === 4 ? "center" : "left", fontSize: 9, fontWeight: 800, color: "#8A6D55", letterSpacing: "0.06em", textTransform: "uppercase", borderBottom: "1.5px solid #E8DDD0", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailRows.map((r, idx) => (
                                        <tr key={r.id} style={{ background: idx % 2 === 0 ? "white" : "#FAFAFA", borderBottom: "1px solid #F0E6D8" }}>
                                            <td style={{ padding: "9px 10px", color: "#5C4033", whiteSpace: "nowrap" }}>{fmtShort(shipDate(r))}</td>
                                            <td style={{ padding: "9px 10px", fontWeight: 700, color: "#3C2F2F", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.customer || "—"}</td>
                                            <td style={{ padding: "9px 10px", color: "#8A7B6E", whiteSpace: "nowrap" }}>{r.no_inv || "—"}</td>
                                            <td style={{ padding: "9px 10px", color: "#5C4033", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.deskripsi || "—"}</td>
                                            <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#3C2F2F" }}>{r.qty || "—"}</td>
                                            <td style={{ padding: "9px 10px", color: "#3C2F2F", fontWeight: 600, whiteSpace: "nowrap" }}>{r.ekspedisi || "—"}</td>
                                            <td style={{ padding: "9px 10px" }}><span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "2px 9px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>Dikirim ✓</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: "#FAF7F3", borderTop: "2px solid #E8DDD0" }}>
                                        <td colSpan={4} style={{ padding: "9px 10px", fontWeight: 800, color: "#5C4033", textAlign: "right" }}>Total</td>
                                        <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800, color: "#3C2F2F" }}>{fmtQty(totalQty)}</td>
                                        <td colSpan={2} style={{ padding: "9px 10px", fontWeight: 700, color: "#8A6D55" }}>{totalPO} PO</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ================================================================
   MAIN — 5 Tab (compact horizontal tabs)
================================================================ */
function IconFinishing({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
    );
}

function AlurPesananPage() {
    const [activeTab, setActiveTab] = useState<"finishing" | "gudang" | "pengiriman" | "riwayat">("finishing");
    const { rows } = usePesanan();
    const { user } = useAuth();
    const isFinishing = user?.role === "finishing";

    /* Operator finishing langsung lihat tab Finishing saja */
    if (isFinishing) {
        return <TabFinishing />;
    }

    const countFinishing  = rows.filter(r => (r.customer || r.deskripsi) && r.printed_at && !r.di_kirim && r.finishing_status === "belum").length;
    const countGudang     = rows.filter(r => (r.customer || r.deskripsi) && r.di_produksi && !r.siap_kirim && !r.di_kirim).length;
    const countPengiriman = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && r.di_kirim === false).length;

    type TabKey = typeof activeTab;
    const tabs: { key: TabKey; label: string; Icon: React.FC<{ size?: number; color?: string }>; count: number; activeColor: string }[] = [
        { key: "finishing", label: "Finishing",  Icon: IconFinishing, count: countFinishing,  activeColor: "#9333EA" },
        { key: "gudang",    label: "Gudang",     Icon: IconGudang,    count: countGudang,     activeColor: "#2563EB" },
        { key: "pengiriman",label: "Kirim",      Icon: IconKirim,     count: countPengiriman, activeColor: "#15803D" },
        { key: "riwayat",   label: "Riwayat",    Icon: IconRiwayat,   count: 0,               activeColor: "#6B7280" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F8F4EF" }}>
            {/* ── Compact Tab Bar ── */}
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E8DDD0", flexShrink: 0, position: "relative" }}>
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.key;
                    return (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
                            flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                            padding: "11px 4px", fontSize: 12, fontWeight: isActive ? 700 : 500, border: "none",
                            borderBottom: isActive ? `2.5px solid ${tab.activeColor}` : "2.5px solid transparent",
                            background: "white", color: isActive ? tab.activeColor : "#9CA3AF",
                            cursor: "pointer", transition: "all .2s", whiteSpace: "nowrap",
                            position: "relative",
                        }}>
                            <tab.Icon size={15} color={isActive ? tab.activeColor : "#9CA3AF"} />
                            <span style={{ fontSize: 12 }}>{tab.label}</span>
                            {tab.count > 0 && (
                                <span style={{
                                    background: isActive ? tab.activeColor : "#DC2626",
                                    color: "white", borderRadius: 99,
                                    minWidth: 18, height: 18, display: "inline-flex", alignItems: "center", justifyContent: "center",
                                    fontSize: 10, fontWeight: 700, padding: "0 5px", lineHeight: 1,
                                    marginLeft: -2,
                                }}>{tab.count}</span>
                            )}
                        </button>
                    );
                })}
            </div>
            {/* ── Tab Content ── */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
                {activeTab === "finishing" && <TabFinishing />}
                {activeTab === "gudang"    && <TabCekGudang />}
                {activeTab === "pengiriman"&& <TabPengiriman />}
                {activeTab === "riwayat"   && <TabRiwayatPO />}
            </div>
        </div>
    );
}

// Di HP tampilkan keterangan "buka di komputer" (components/layout/DesktopOnly).
export default function AlurPesananPageMobileGuard() {
    return (
        <DesktopOnly label="Alur Pesanan">
            <AlurPesananPage />
        </DesktopOnly>
    );
}
