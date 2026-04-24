"use client";
import React, { useState, useEffect } from "react";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";

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

type LogEntry = { id: number; pesanan_id: number; action: string; from_status: string; to_status: string; note: string; user_name: string; created_at: string };

async function addLog(pesanan_id: number, action: string, from_status: string, to_status: string, note: string, user_name: string) {
    try { await supabase.from("production_logs").insert({ pesanan_id, action, from_status, to_status, note, user_name }); } catch {}
}

const METODE_OPTIONS = [
    { value: "", label: "Pilih metode kirim..." },
    { value: "packing_ekspedisi", label: "📦 Packing + Ekspedisi" },
    { value: "packing_lalamove", label: "📦 Packing + Lalamove/Gojek" },
    { value: "tanpa_packing_ekspedisi", label: "🚚 Tanpa Packing + Ekspedisi" },
    { value: "tanpa_packing_lalamove", label: "🛵 Tanpa Packing + Lalamove/Gojek" },
    { value: "diambil", label: "🏪 Diambil Sendiri" },
];

const METODE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
    packing_ekspedisi: { label: "📦 Ekspedisi", bg: "#DBEAFE", color: "#1D4ED8" },
    packing_lalamove: { label: "📦 Lalamove", bg: "#E0E7FF", color: "#4338CA" },
    tanpa_packing_ekspedisi: { label: "🚚 Ekspedisi", bg: "#FEF9C3", color: "#A16207" },
    tanpa_packing_lalamove: { label: "🛵 Lalamove", bg: "#FCE7F3", color: "#BE185D" },
    diambil: { label: "🏪 Diambil", bg: "#F3F4F6", color: "#374151" },
};

/* ── SVG Icons for tabs ── */
function IconProduksi({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>);
}
function IconGudang({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>);
}
function IconFollowUp({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>);
}
function IconKirim({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>);
}
function IconRiwayat({ size = 16, color = "currentColor" }: { size?: number; color?: string }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>);
}
function IconCheck({ size = 14 }: { size?: number }) {
    return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>);
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
function SectionHeader({ title, count, countBg, countColor, children }: { title: string; count: number; countBg: string; countColor: string; children?: React.ReactNode }) {
    return (
        <div style={{ padding: "14px 16px 12px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: children ? 10 : 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F" }}>{title}</span>
                    <span style={{ background: countBg, color: countColor, borderRadius: 99, padding: "2px 10px", fontSize: 11, fontWeight: 700 }}>{count}</span>
                </div>
            </div>
            {children}
        </div>
    );
}

/* ================================================================
   TAB 1: PRODUKSI — PIC Produksi centang PO selesai
================================================================ */
function TabProduksi() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState<number | null>(null);

    const items = rows.filter(r => (r.customer || r.deskripsi) && r.printed_at && !r.di_produksi);
    const filtered = items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    const groups: Record<string, PesananRow[]> = {};
    filtered.forEach(r => { const k = r.po_label || "(Tanpa PO)"; if (!groups[k]) groups[k] = []; groups[k].push(r); });

    const markDone = (row: PesananRow) => {
        updateRow(row.id, { di_produksi: true, di_warna: false, siap_kirim: false, di_kirim: false, metode_kirim: "" }, true);
        addLog(row.id, "status_change", "pending", "di_produksi", "", user?.name || "");
        pushNotify({
            notificationType: "status_produksi",
            title: "Pesanan Masuk Produksi",
            body: `${row.customer || "—"} — ${row.deskripsi || "—"}`,
            url: "/dashboard/produksi",
            targetRoles: ["owner"],
        });
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    const markAll = (opRows: PesananRow[]) => {
        opRows.forEach(r => {
            updateRow(r.id, { di_produksi: true, di_warna: false, siap_kirim: false, di_kirim: false, metode_kirim: "" }, true);
            addLog(r.id, "status_change", "pending", "di_produksi", "", user?.name || "");
        });
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="PO Berjalan" count={items.length} countBg="#FEF9C3" countColor="#A16207">
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, PO..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {Object.keys(groups).length === 0 ? (
                    <EmptyState icon={<IconCheck size={48} />} title="Semua PO sudah selesai produksi!" subtitle="Tidak ada PO yang menunggu" />
                ) : Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([opKey, opRows]) => (
                    <div key={opKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(92,64,51,0.06), 0 0 0 1px rgba(92,64,51,0.04)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #5C4033, #7C5A3C)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "white", letterSpacing: 0.2 }}>PO {opKey}</span>
                                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{opRows.length}</span>
                            </div>
                            <button onClick={() => markAll(opRows)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
                                Selesai Semua ✓
                            </button>
                        </div>
                        <div style={{ background: "white" }}>
                            {opRows.map((row, idx) => (
                                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderBottom: idx < opRows.length - 1 ? "1px solid #F5F0EC" : "none", background: flash === row.id ? "#F0FFF4" : "white", transition: "background 0.4s" }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                        <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                        <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · {fmtShort(row.tanggal)}</div>
                                    </div>
                                    <button onClick={() => markDone(row)} style={{
                                        padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                                        fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
                                        background: "#15803D", color: "white",
                                        transition: "transform 0.15s, opacity 0.15s",
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                                        onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                                    >Selesai ✓</button>
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
        updateRow(row.id, { siap_kirim: true, di_warna: true, di_kirim: false }, true);
        addLog(row.id, "status_change", "di_produksi", "siap_kirim", "", user?.name || "");
        pushNotify({
            notificationType: "status_produksi",
            title: "Pesanan Siap Kirim",
            body: `${row.customer || "—"} — ${row.deskripsi || "—"}`,
            url: "/dashboard/produksi",
            targetRoles: ["owner", "sales"],
        });
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    const markAllReady = (opRows: PesananRow[]) => {
        opRows.forEach(r => {
            updateRow(r.id, { siap_kirim: true, di_warna: true, di_kirim: false }, true);
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
            <SectionHeader title="Cek Kelengkapan" count={items.length} countBg="#FFE4E6" countColor="#BE123C">
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
   TAB 3: FOLLOW UP — Marketing follow up customer & pilih metode kirim
================================================================ */
function TabFollowUp() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState<number | null>(null);

    const items = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && !r.metode_kirim && r.di_kirim === false);
    const filtered = items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label, r.production_note].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    const groups: Record<string, PesananRow[]> = {};
    filtered.forEach(r => { const k = r.po_label || "(Tanpa PO)"; if (!groups[k]) groups[k] = []; groups[k].push(r); });

    const setMetode = (row: PesananRow, metode: string) => {
        if (!metode) return;
        const isPacking = metode.startsWith("packing_");
        updateRow(row.id, { metode_kirim: metode, is_packing: isPacking }, true);
        addLog(row.id, "metode_kirim", "", metode, "", user?.name || "");
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="Follow Up Customer" count={items.length} countBg="#FEF3C7" countColor="#D97706">
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {Object.keys(groups).length === 0 ? (
                    <EmptyState icon={<IconFollowUp size={48} color="#C5A882" />} title="Tidak ada yang perlu di-follow up" subtitle="Semua customer sudah dikonfirmasi" />
                ) : Object.entries(groups).sort(([a], [b]) => a.localeCompare(b)).map(([opKey, opRows]) => (
                    <div key={opKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #92400E, #D97706)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>PO {opKey}</span>
                                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{opRows.length} item</span>
                            </div>
                        </div>
                        <div style={{ background: "white" }}>
                            {opRows.map((row, idx) => (
                                <div key={row.id} style={{ padding: "11px 14px", borderBottom: idx < opRows.length - 1 ? "1px solid #F5F0EC" : "none", background: flash === row.id ? "#F0FFF4" : "white", transition: "background 0.4s" }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                    <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                    <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · PO: {row.po_label || "—"} · 🗓️ {fmtShort(row.tanggal)}</div>
                                    {row.production_note && (
                                        <div style={{ marginTop: 5, padding: "4px 8px", background: "#FAFAF5", borderRadius: 6, fontSize: 11, color: "#8A6D55", border: "1px dashed #E8DDD0" }}>📝 {row.production_note}</div>
                                    )}
                                    <select value={row.metode_kirim} onChange={e => setMetode(row, e.target.value)}
                                        style={{
                                            width: "100%", marginTop: 8, padding: "9px 12px", borderRadius: 8,
                                            border: "1.5px solid #E8DDD0", fontSize: 12, fontWeight: 600,
                                            color: "#5C4033", background: "#FAFAF8", cursor: "pointer", outline: "none",
                                        }}>
                                        {METODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
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
   TAB 4: PENGIRIMAN — PIC Gudang kirim barang sesuai metode dari marketing
================================================================ */
function TabPengiriman() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState<number | null>(null);
    const [ekspedisiInputs, setEkspedisiInputs] = useState<Record<number, string>>({});

    const items = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && r.metode_kirim && r.di_kirim === false);
    const filtered = items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label, r.metode_kirim].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    const groups: Record<string, PesananRow[]> = {};
    filtered.forEach(r => { const k = r.metode_kirim || "unknown"; if (!groups[k]) groups[k] = []; groups[k].push(r); });

    const isEkspedisiMethod = (metode: string) => metode.includes("ekspedisi");

    const getEkspedisiValue = (row: PesananRow) => {
        if (ekspedisiInputs[row.id] !== undefined) return ekspedisiInputs[row.id];
        return row.ekspedisi || "";
    };

    const setEkspedisiInput = (rowId: number, val: string) => {
        setEkspedisiInputs(prev => ({ ...prev, [rowId]: val }));
    };

    const markDikirim = (row: PesananRow) => {
        const eks = getEkspedisiValue(row);
        // If ekspedisi method, require ekspedisi name
        if (isEkspedisiMethod(row.metode_kirim) && !eks.trim()) {
            alert("Harap isi nama ekspedisi terlebih dahulu!");
            return;
        }
        const patch: Partial<PesananRow> = { di_kirim: true, shipped_at: new Date().toISOString() };
        if (eks) patch.ekspedisi = eks;
        updateRow(row.id, patch, true);
        addLog(row.id, "status_change", "siap_kirim", "di_kirim", eks ? `via ${eks}` : "", user?.name || "");
        pushNotify({
            notificationType: "status_produksi",
            title: "Pesanan Dikirim",
            body: `${row.customer || "—"} — ${row.deskripsi || "—"}${eks ? ` via ${eks}` : ""}`,
            url: "/dashboard/produksi",
            targetRoles: ["owner", "finance", "sales"],
        });
        setFlash(row.id); setTimeout(() => setFlash(null), 1200);
    };

    const markAllDikirim = (rowList: PesananRow[]) => {
        // Check all ekspedisi rows have the nama filled
        const missing = rowList.filter(r => isEkspedisiMethod(r.metode_kirim) && !getEkspedisiValue(r).trim());
        if (missing.length > 0) {
            alert(`${missing.length} item belum diisi nama ekspedisinya!`);
            return;
        }
        rowList.forEach(r => {
            const eks = getEkspedisiValue(r);
            const patch: Partial<PesananRow> = { di_kirim: true, shipped_at: new Date().toISOString() };
            if (eks) patch.ekspedisi = eks;
            updateRow(r.id, patch, true);
            addLog(r.id, "status_change", "siap_kirim", "di_kirim", eks ? `via ${eks}` : "", user?.name || "");
        });
    };

    const metodeOrder = ["packing_ekspedisi", "packing_lalamove", "tanpa_packing_ekspedisi", "tanpa_packing_lalamove", "diambil"];
    const sortedKeys = Object.keys(groups).sort((a, b) => {
        const ia = metodeOrder.indexOf(a); const ib = metodeOrder.indexOf(b);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="Proses Pengiriman" count={items.length} countBg="#DCFCE7" countColor="#15803D">
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, metode..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {sortedKeys.length === 0 ? (
                    <EmptyState icon={<IconKirim size={48} color="#C5A882" />} title="Tidak ada barang untuk dikirim" subtitle="Tunggu Marketing menentukan metode kirim" />
                ) : sortedKeys.map(metodeKey => {
                    const metodeRows = groups[metodeKey];
                    const badge = METODE_BADGE[metodeKey] || { label: metodeKey, bg: "#F3F4F6", color: "#374151" };
                    const showEkspedisi = isEkspedisiMethod(metodeKey);
                    return (
                        <div key={metodeKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #166534, #22C55E)" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
                                    <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{metodeRows.length}</span>
                                </div>
                                <button onClick={() => markAllDikirim(metodeRows)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.9)", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.2s" }}
                                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}>
                                    Kirim Semua ✓
                                </button>
                            </div>
                            <div style={{ background: "white" }}>
                                {metodeRows.map((row, idx) => (
                                    <div key={row.id} style={{ padding: "11px 14px", borderBottom: idx < metodeRows.length - 1 ? "1px solid #F5F0EC" : "none", background: flash === row.id ? "#F0FFF4" : "white", transition: "background 0.4s" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                                <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                                <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · PO: {row.po_label || "—"}</div>
                                                {row.production_note && <div style={{ marginTop: 3, fontSize: 10.5, color: "#8A6D55" }}>📝 {row.production_note}</div>}
                                            </div>
                                            <button onClick={() => markDikirim(row)} style={{
                                                padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                                                fontWeight: 700, fontSize: 12, whiteSpace: "nowrap",
                                                background: "#15803D", color: "white",
                                                transition: "opacity 0.15s",
                                            }}
                                                onMouseEnter={e => { e.currentTarget.style.opacity = "0.85"; }}
                                                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}
                                            >Dikirim ✓</button>
                                        </div>
                                        {showEkspedisi && (
                                            <div style={{ marginTop: 8 }}>
                                                <input
                                                    type="text"
                                                    value={getEkspedisiValue(row)}
                                                    onChange={e => { setEkspedisiInput(row.id, e.target.value); updateRow(row.id, { ekspedisi: e.target.value }, true); }}
                                                    placeholder="Tulis nama ekspedisi (JNE, SiCepat, Indah Cargo, dll)..."
                                                    style={{
                                                        width: "100%", padding: "8px 12px", borderRadius: 8,
                                                        border: getEkspedisiValue(row).trim() ? "1.5px solid #22C55E" : "1.5px solid #FCA5A5",
                                                        fontSize: 12, color: "#3C2F2F", background: getEkspedisiValue(row).trim() ? "#F0FFF4" : "#FFF5F5",
                                                        outline: "none", boxSizing: "border-box",
                                                        transition: "border-color 0.2s, background 0.2s",
                                                    }}
                                                    onFocus={e => { e.target.style.borderColor = "#A67B5B"; e.target.style.boxShadow = "0 0 0 3px rgba(166,123,91,0.08)"; }}
                                                    onBlur={e => { e.target.style.borderColor = getEkspedisiValue(row).trim() ? "#22C55E" : "#FCA5A5"; e.target.style.boxShadow = "none"; }}
                                                />
                                            </div>
                                        )}
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
   TAB 5: RIWAYAT — Riwayat pengiriman & tracking
================================================================ */
function TabRiwayatPO() {
    const { rows } = usePesanan();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [search, setSearch] = useState("");
    const [filterStatus, setFilterStatus] = useState<"semua" | "dikirim" | "proses">("semua");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [logs, setLogs] = useState<LogEntry[]>([]);

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    // Load logs on mount
    useEffect(() => {
        (async () => {
            const since = new Date(); since.setDate(since.getDate() - 90);
            const { data } = await supabase.from("production_logs").select("*").gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(200);
            if (data) setLogs(data as LogEntry[]);
        })();
    }, []);

    const baseRows = rows.filter(r => (r.customer || r.deskripsi));
    const filtered = baseRows.filter(r => {
        const d = r.printed_at || r.tanggal;
        const matchDate = !d || (parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month);
        const q = search.toLowerCase();
        const matchSearch = !q || [r.customer, r.deskripsi, r.po_label, r.ekspedisi, r.metode_kirim].join(" ").toLowerCase().includes(q);
        const matchStatus = filterStatus === "semua" ? true : filterStatus === "dikirim" ? r.di_kirim : !r.di_kirim;
        return matchDate && matchSearch && matchStatus;
    });

    // Summary stats
    const totalAll = baseRows.filter(r => {
        const d = r.printed_at || r.tanggal;
        return !d || (parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month);
    });
    const totalDikirim = totalAll.filter(r => r.di_kirim).length;
    const totalProses = totalAll.filter(r => !r.di_kirim).length;

    // Group: dikirim items by customer for shipping history
    const dikirimRows = filtered.filter(r => r.di_kirim);
    const prosesRows = filtered.filter(r => !r.di_kirim);

    const getStatus = (r: PesananRow) => {
        if (r.di_kirim) return { label: "Dikirim ✓", bg: "#DCFCE7", color: "#15803D" };
        if (r.metode_kirim && r.siap_kirim) return { label: "Siap Kirim", bg: "#DBEAFE", color: "#1D4ED8" };
        if (r.siap_kirim) return { label: "Follow Up", bg: "#FEF3C7", color: "#D97706" };
        if (r.di_produksi) return { label: "Gudang", bg: "#FFE4E6", color: "#BE123C" };
        return { label: "Produksi", bg: "#F3F4F6", color: "#6B7280" };
    };

    const getLogsForRow = (rowId: number) => logs.filter(l => l.pesanan_id === rowId).slice(0, 10);

    const selectStyle: React.CSSProperties = { border: "1.5px solid #E8DDD0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#5C4033", background: "#FAFAF8", height: 32, fontWeight: 600, outline: "none" };

    const pillStyle = (key: typeof filterStatus, active: boolean): React.CSSProperties => ({
        padding: "5px 12px", borderRadius: 99, border: "none", cursor: "pointer",
        fontSize: 11, fontWeight: 700, transition: "all 0.15s",
        background: active ? (key === "dikirim" ? "#DCFCE7" : key === "proses" ? "#FEF3C7" : "#F0ECE6") : "transparent",
        color: active ? (key === "dikirim" ? "#15803D" : key === "proses" ? "#D97706" : "#5C4033") : "#9CA3AF",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            {/* Header filter bar */}
            <div style={{ padding: "12px 16px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <select value={month} onChange={e => setMonth(+e.target.value)} style={selectStyle}>{ML.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
                    <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    <div style={{ position: "relative", flex: 1, minWidth: 120 }}>
                        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#5C4033" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari..."
                            style={{ ...selectStyle, width: "100%", paddingLeft: 30, boxSizing: "border-box" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#B89678", fontWeight: 600 }}>{filtered.length} item</span>
                </div>
                {/* Status filter pills */}
                <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setFilterStatus("semua")} style={pillStyle("semua", filterStatus === "semua")}>Semua {totalAll.length}</button>
                    <button onClick={() => setFilterStatus("dikirim")} style={pillStyle("dikirim", filterStatus === "dikirim")}>✓ Dikirim {totalDikirim}</button>
                    <button onClick={() => setFilterStatus("proses")} style={pillStyle("proses", filterStatus === "proses")}>⏳ Proses {totalProses}</button>
                </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {/* Summary cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#3C2F2F" }}>{totalAll.length}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Total PO</div>
                    </div>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#15803D" }}>{totalDikirim}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Sudah Kirim</div>
                    </div>
                    <div style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)", textAlign: "center" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "#D97706" }}>{totalProses}</div>
                        <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>Dalam Proses</div>
                    </div>
                </div>

                {filtered.length === 0 ? (
                    <EmptyState icon={<IconRiwayat size={48} color="#C5A882" />} title="Belum ada data" subtitle="Pilih bulan lain atau ubah filter" />
                ) : (
                    <>
                        {/* Shipped items */}
                        {dikirimRows.length > 0 && (filterStatus === "semua" || filterStatus === "dikirim") && (
                            <div style={{ marginBottom: 14 }}>
                                {filterStatus === "semua" && <div style={{ fontSize: 12, fontWeight: 700, color: "#15803D", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><IconKirim size={14} color="#15803D" /> Riwayat Pengiriman ({dikirimRows.length})</div>}
                                {dikirimRows.map(r => {
                                    const metBadge = r.metode_kirim ? METODE_BADGE[r.metode_kirim] : null;
                                    const isExp = expanded === `row-${r.id}`;
                                    const rowLogs = getLogsForRow(r.id);
                                    return (
                                        <div key={r.id} style={{ background: "white", borderRadius: 10, marginBottom: 6, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                            <div onClick={() => setExpanded(isExp ? null : `row-${r.id}`)} style={{ padding: "10px 14px", cursor: "pointer", transition: "background 0.15s" }}
                                                onMouseEnter={e => (e.currentTarget.style.background = "#FAFAF8")}
                                                onMouseLeave={e => (e.currentTarget.style.background = "white")}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                            <span style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{r.customer}</span>
                                                            <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 700 }}>Dikirim ✓</span>
                                                        </div>
                                                        <div style={{ fontSize: 11, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 2 }}>{r.deskripsi}</div>
                                                    </div>
                                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                                                        {metBadge && <span style={{ background: metBadge.bg, color: metBadge.color, borderRadius: 99, padding: "1px 7px", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" }}>{metBadge.label}</span>}
                                                        {r.ekspedisi && <span style={{ fontSize: 10, color: "#5C4033", fontWeight: 600 }}>{r.ekspedisi}</span>}
                                                    </div>
                                                    <span style={{ fontSize: 11, color: "#B89678", transition: "transform 0.2s", transform: isExp ? "rotate(180deg)" : "none", display: "inline-block", marginLeft: 4 }}>▼</span>
                                                </div>
                                            </div>
                                            {isExp && (
                                                <div style={{ borderTop: "1px solid #F0E6D8", padding: "10px 14px", background: "#FAFAF8" }}>
                                                    {/* Detail info */}
                                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11, marginBottom: 10 }}>
                                                        <div><span style={{ color: "#B89678" }}>Ukuran:</span> <strong style={{ color: "#3C2F2F" }}>{r.ukuran || "—"}</strong></div>
                                                        <div><span style={{ color: "#B89678" }}>Qty:</span> <strong style={{ color: "#3C2F2F" }}>{r.qty || "—"}</strong></div>
                                                        <div><span style={{ color: "#B89678" }}>PO:</span> <strong style={{ color: "#3C2F2F" }}>{r.po_label || "—"}</strong></div>
                                                        <div><span style={{ color: "#B89678" }}>Tanggal:</span> <strong style={{ color: "#3C2F2F" }}>{fmtFull(r.tanggal)}</strong></div>
                                                        {r.shipped_at && <div><span style={{ color: "#B89678" }}>Dikirim:</span> <strong style={{ color: "#15803D" }}>{fmtFull(r.shipped_at.slice(0, 10))}</strong></div>}
                                                        {r.metode_kirim && <div><span style={{ color: "#B89678" }}>Metode:</span> <strong style={{ color: "#3C2F2F" }}>{METODE_BADGE[r.metode_kirim]?.label || r.metode_kirim}</strong></div>}
                                                        {r.ekspedisi && <div><span style={{ color: "#B89678" }}>Ekspedisi:</span> <strong style={{ color: "#3C2F2F" }}>{r.ekspedisi}</strong></div>}
                                                    </div>
                                                    {r.production_note && <div style={{ padding: "4px 8px", background: "#FFF9F0", borderRadius: 6, fontSize: 11, color: "#8A6D55", marginBottom: 10, border: "1px dashed #E8DDD0" }}>📝 {r.production_note}</div>}
                                                    {/* Timeline from logs */}
                                                    {rowLogs.length > 0 && (
                                                        <div>
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: "#5C4033", marginBottom: 6 }}>📜 Riwayat Aktivitas</div>
                                                            <div style={{ borderLeft: "2px solid #E8DDD0", paddingLeft: 12, marginLeft: 4 }}>
                                                                {rowLogs.map(log => {
                                                                    const time = new Date(log.created_at).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
                                                                    let actionLabel = log.action;
                                                                    if (log.action === "status_change") {
                                                                        if (log.to_status === "di_produksi") actionLabel = "Selesai Produksi";
                                                                        else if (log.to_status === "siap_kirim") actionLabel = "Siap Kirim (Gudang)";
                                                                        else if (log.to_status === "di_kirim") actionLabel = "Dikirim";
                                                                        else actionLabel = log.to_status;
                                                                    } else if (log.action === "metode_kirim") {
                                                                        actionLabel = `Metode: ${METODE_BADGE[log.to_status]?.label || log.to_status}`;
                                                                    } else if (log.action === "note") {
                                                                        actionLabel = `Catatan: "${log.note}"`;
                                                                    }
                                                                    return (
                                                                        <div key={log.id} style={{ display: "flex", gap: 8, marginBottom: 6, fontSize: 11, position: "relative" }}>
                                                                            <div style={{ position: "absolute", left: -17, top: 3, width: 8, height: 8, borderRadius: "50%", background: log.to_status === "di_kirim" ? "#22C55E" : "#A67B5B" }} />
                                                                            <span style={{ color: "#B89678", minWidth: 70, whiteSpace: "nowrap" }}>{time}</span>
                                                                            <span style={{ color: "#3C2F2F" }}>{actionLabel}</span>
                                                                            {log.note && log.action !== "note" && <span style={{ color: "#8A6D55" }}>· {log.note}</span>}
                                                                            {log.user_name && <span style={{ color: "#B89678" }}>· {log.user_name}</span>}
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* In-progress items */}
                        {prosesRows.length > 0 && (filterStatus === "semua" || filterStatus === "proses") && (
                            <div>
                                {filterStatus === "semua" && <div style={{ fontSize: 12, fontWeight: 700, color: "#D97706", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><IconRiwayat size={14} color="#D97706" /> Dalam Proses ({prosesRows.length})</div>}
                                {prosesRows.map(r => {
                                    const st = getStatus(r);
                                    return (
                                        <div key={r.id} style={{ background: "white", borderRadius: 10, marginBottom: 6, padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{r.customer}</div>
                                                    <div style={{ fontSize: 11, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{r.deskripsi}</div>
                                                    <div style={{ fontSize: 10, color: "#B89678", marginTop: 2 }}>UK: {r.ukuran || "—"} · Qty: {r.qty || "—"} · PO: {r.po_label || "—"}</div>
                                                </div>
                                                <span style={{ background: st.bg, color: st.color, borderRadius: 99, padding: "2px 10px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{st.label}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

/* ================================================================
   MAIN — 5 Tab (compact horizontal tabs)
================================================================ */
export default function AlurPesananPage() {
    const [activeTab, setActiveTab] = useState<"produksi" | "gudang" | "followup" | "pengiriman" | "riwayat">("produksi");
    const { rows } = usePesanan();

    const countProduksi = rows.filter(r => (r.customer || r.deskripsi) && r.printed_at && !r.di_produksi).length;
    const countGudang = rows.filter(r => (r.customer || r.deskripsi) && r.di_produksi && !r.siap_kirim && !r.di_kirim).length;
    const countFollowUp = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && !r.metode_kirim && r.di_kirim === false).length;
    const countPengiriman = rows.filter(r => (r.customer || r.deskripsi) && r.siap_kirim === true && !!r.metode_kirim && r.di_kirim === false).length;

    type TabKey = typeof activeTab;
    const tabs: { key: TabKey; label: string; Icon: React.FC<{ size?: number; color?: string }>; count: number; activeColor: string }[] = [
        { key: "produksi", label: "Produksi", Icon: IconProduksi, count: countProduksi, activeColor: "#7C5A3C" },
        { key: "gudang", label: "Gudang", Icon: IconGudang, count: countGudang, activeColor: "#2563EB" },
        { key: "followup", label: "Follow Up", Icon: IconFollowUp, count: countFollowUp, activeColor: "#D97706" },
        { key: "pengiriman", label: "Kirim", Icon: IconKirim, count: countPengiriman, activeColor: "#15803D" },
        { key: "riwayat", label: "Riwayat", Icon: IconRiwayat, count: 0, activeColor: "#6B7280" },
    ];

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F8F4EF" }}>
            {/* ── Compact Tab Bar ── */}
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E8DDD0", flexShrink: 0, position: "relative" }}>
                {tabs.map((tab, idx) => {
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
                {activeTab === "produksi" && <TabProduksi />}
                {activeTab === "gudang" && <TabCekGudang />}
                {activeTab === "followup" && <TabFollowUp />}
                {activeTab === "pengiriman" && <TabPengiriman />}
                {activeTab === "riwayat" && <TabRiwayatPO />}
            </div>
        </div>
    );
}
