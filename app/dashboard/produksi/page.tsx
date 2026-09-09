"use client";
import DesktopOnly from "@/components/layout/DesktopOnly";
import React, { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";
import { pesananRowTotal } from "@/lib/piutang";
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
function fmtTimeShort(iso: string) { try { return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }); } catch { return ""; } }

async function addLog(pesanan_id: number, action: string, from_status: string, to_status: string, note: string, user_name: string) {
    try { await supabase.from("production_logs").insert({ pesanan_id, action, from_status, to_status, note, user_name }); } catch {}
}

/**
 * Daftar otoritatif isi Gudang dari status di pesanan_rows.
 *
 * Store global tetap dipakai untuk detail barang dan optimistic update, tetapi
 * Barang masuk setelah tahap Warna selesai dan keluar setelah Dikirim. Id
 * Gudang dibaca langsung dengan filter server-side agar cache lama tidak
 * membuat barang yang sudah dikirim masih terlihat. Query hanya mengambil id
 * (payload kecil), lalu perubahan status aktif diikuti lewat Realtime.
 */
function useGudangStatusIds() {
    const [ids, setIds] = useState<Set<number> | null>(null);

    useEffect(() => {
        let active = true;

        const refresh = async () => {
            try {
                const nextIds = new Set<number>();
                let from = 0;
                let hasMore = true;

                while (hasMore) {
                    const { data, error } = await supabase
                        .from("pesanan_rows")
                        .select("id")
                        .eq("di_warna", true)
                        .eq("di_kirim", false)
                        .order("id", { ascending: true })
                        .range(from, from + 999);

                    if (error) throw error;
                    (data || []).forEach(row => nextIds.add(row.id));
                    hasMore = (data?.length || 0) === 1000;
                    from += 1000;
                }

                if (active) setIds(nextIds);
            } catch (error) {
                // Jika sinkronisasi ringan gagal, tampilan tetap memakai status
                // dari store sehingga halaman tidak kosong atau terkunci.
                console.error("Gagal menyinkronkan status Gudang:", error);
            }
        };

        void refresh();

        const channel = supabase
            .channel("gudang_status_sync")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "pesanan_rows", filter: "di_warna=eq.true" },
                payload => {
                    if (payload.eventType === "DELETE") return;
                    const row = payload.new as { id?: number; di_warna?: boolean; di_kirim?: boolean };
                    if (typeof row.id !== "number") return;

                    setIds(previous => {
                        const next = new Set(previous || []);
                        if (row.di_warna === true && row.di_kirim !== true) next.add(row.id!);
                        else next.delete(row.id!);
                        return next;
                    });
                }
            )
            .subscribe();

        const refreshWhenVisible = () => {
            if (document.visibilityState === "visible") void refresh();
        };
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", refreshWhenVisible);

        return () => {
            active = false;
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", refreshWhenVisible);
            supabase.removeChannel(channel);
        };
    }, []);

    return ids;
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
   TAB 2: GUDANG — kartu ringkas per invoice untuk barang SELESAI WARNA.
   Barang masuk dari ceklis "Warna" di Status Barang. PIC Gudang membuka
   rincian bila perlu, mengisi ekspedisi, lalu menandai kirim.
================================================================ */
function TabGudang({ statusIds }: { statusIds: Set<number> | null }) {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const [search, setSearch] = useState("");
    const [editingNote, setEditingNote] = useState<number | null>(null);
    const [noteText, setNoteText] = useState("");
    const [flash, setFlash] = useState<string | null>(null);
    const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
    const [ekspedisiInputs, setEkspedisiInputs] = useState<Record<string, string>>({});

    // Sumber utama adalah status di database. Pengecekan boolean lokal tetap
    // dipertahankan agar item langsung masuk setelah Warna dicentang dan
    // langsung hilang setelah tombol Kirim ditekan.
    const items = useMemo(
        () => rows.filter(r =>
            (r.customer || r.deskripsi) &&
            r.di_warna === true &&
            r.di_kirim === false &&
            (statusIds === null || statusIds.has(r.id))
        ),
        [rows, statusIds]
    );
    const filtered = useMemo(() => items.filter(r => {
        if (!search) return true;
        return [r.customer, r.deskripsi, r.po_label, r.no_inv, r.production_note, r.ekspedisi].join(" ").toLowerCase().includes(search.toLowerCase());
    }), [items, search]);

    type GudangOrder = {
        key: string;
        noInv: string;
        customer: string;
        tanggal: string;
        items: PesananRow[];
        total: number;
    };

    const orders = useMemo<GudangOrder[]>(() => {
        const grouped = new Map<string, GudangOrder>();
        filtered.forEach(row => {
            const invoice = (row.no_inv || "").trim();
            const key = invoice ? `inv:${invoice}` : `row:${row.id}`;
            const current = grouped.get(key) || {
                key,
                noInv: invoice,
                customer: row.customer || "",
                tanggal: row.tanggal || "",
                items: [],
                total: 0,
            };
            current.items.push(row);
            current.total += pesananRowTotal(row);
            if (!current.customer && row.customer) current.customer = row.customer;
            if (!current.tanggal && row.tanggal) current.tanggal = row.tanggal;
            grouped.set(key, current);
        });
        return [...grouped.values()].sort((a, b) => {
            const byDate = (b.tanggal || "").localeCompare(a.tanggal || "");
            if (byDate !== 0) return byDate;
            return (Number(b.noInv) || 0) - (Number(a.noInv) || 0);
        });
    }, [filtered]);

    const toggleOpen = (key: string) => {
        setOpenKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const getRowEkspedisi = (row: PesananRow) => ekspedisiInputs[`row:${row.id}`] ?? row.ekspedisi ?? "";
    const getOrderEkspedisi = (order: GudangOrder) => {
        const pending = ekspedisiInputs[`order:${order.key}`];
        if (pending !== undefined) return pending;
        const existing = [...new Set(order.items.map(row => (row.ekspedisi || "").trim()).filter(Boolean))];
        return existing.length === 1 ? existing[0] : "";
    };
    const setEkspedisiInput = (key: string, value: string) => setEkspedisiInputs(prev => ({ ...prev, [key]: value }));

    const markDikirim = (row: PesananRow) => {
        const eks = getRowEkspedisi(row);
        if (!eks.trim()) { alert("Harap isi ekspedisi terlebih dahulu (mis. JNE, SiCepat, Lalamove, Diambil)!"); return; }
        updateRow(row.id, { siap_kirim: true, di_kirim: true, shipped_at: new Date().toISOString(), ekspedisi: eks.trim() }, true);
        addLog(row.id, "status_change", row.siap_kirim ? "siap_kirim" : "di_warna", "di_kirim", `via ${eks}`, user?.name || "");
        pushNotify({ notificationType: "status_produksi", title: "Pesanan Dikirim", body: `${row.customer || "—"} — ${row.deskripsi || "—"} via ${eks}`, url: "/dashboard/produksi" });
        setFlash(`row:${row.id}`); setTimeout(() => setFlash(null), 1200);
    };

    const markOrderDikirim = (order: GudangOrder) => {
        const eks = getOrderEkspedisi(order).trim();
        if (!eks) { alert("Isi ekspedisi untuk order ini sebelum ditandai Dikirim."); return; }
        const shippedAt = new Date().toISOString();
        order.items.forEach(row => {
            updateRow(row.id, { siap_kirim: true, di_kirim: true, shipped_at: shippedAt, ekspedisi: eks }, true);
            addLog(row.id, "status_change", row.siap_kirim ? "siap_kirim" : "di_warna", "di_kirim", `via ${eks}`, user?.name || "");
        });
        pushNotify({ notificationType: "status_produksi", title: "Pesanan Dikirim", body: `${order.customer || "—"} · INV ${order.noInv || "—"} via ${eks}`, url: "/dashboard/produksi" });
        setFlash(order.key); setTimeout(() => setFlash(null), 1200);
    };

    const saveNote = (row: PesananRow) => {
        updateRow(row.id, { production_note: noteText }, true);
        if (noteText) addLog(row.id, "note", "", "", noteText, user?.name || "");
        setEditingNote(null);
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title="Barang di Gudang · Selesai Warna" count={orders.length} countBg="#DBEAFE" countColor="#1D4ED8"
                actions={<WaButtons title="Ready Gudang" items={filtered} statusOf={() => "✅"} />}>
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, invoice, catatan..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", background: "#F5EBDD" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 1160, margin: "0 auto" }}>
                    {orders.length === 0 ? (
                        <EmptyState icon={<IconGudang size={48} color="#C5A882" />} title="Gudang kosong" subtitle="Barang muncul setelah status Warna dicentang di menu Status Barang" />
                    ) : orders.map(order => {
                        const isOpen = openKeys.has(order.key);
                        const orderEkspedisi = getOrderEkspedisi(order);
                        const stageSummary = [
                            { label: "Produksi", done: order.items.every(row => row.di_produksi) },
                            { label: "Warna", done: order.items.every(row => row.di_warna) },
                            { label: "Siap", done: order.items.every(row => row.siap_kirim) },
                        ];
                        return (
                            <div key={order.key} style={{ background: flash === order.key ? "#F0FFF4" : "white", border: "1px solid #E6D5BE", borderRadius: 10, overflow: "hidden", transition: "background .35s" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", flexWrap: "wrap" }}>
                                    <button onClick={() => toggleOpen(order.key)} title={isOpen ? "Tutup detail" : "Lihat detail item"}
                                        style={{ border: "1px solid #D1BFA3", background: "#FFFBF7", borderRadius: 6, width: 28, height: 28, cursor: "pointer", color: "#5C4033", fontSize: 11, flexShrink: 0 }}>
                                        {isOpen ? "▾" : "▸"}
                                    </button>
                                    <div style={{ minWidth: 190, flex: "1 1 280px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                                            <strong style={{ fontSize: 13, color: "#5C4033" }}>{order.customer || "—"}</strong>
                                            <span style={{ background: "#DBEAFE", color: "#1D4ED8", borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                                                {order.items.every(row => row.siap_kirim) ? "Siap Kirim" : "Selesai Warna"}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>
                                            {order.noInv ? `INV ${order.noInv}` : "Tanpa invoice"} · {fmtFull(order.tanggal)} · {order.items.length} item
                                            {order.total > 0 && ` · Rp ${order.total.toLocaleString("id-ID")}`}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                            {stageSummary.map(stage => (
                                                <div key={stage.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, color: stage.done ? "#15803D" : "#8A7B6E", fontSize: 9.5, fontWeight: 700 }}>
                                                    <span aria-label={`${stage.label} ${stage.done ? "selesai" : "belum"}`} style={{ width: 16, height: 16, borderRadius: 3, border: `1.5px solid ${stage.done ? "#A67B5B" : "#9CA3AF"}`, background: stage.done ? "#A67B5B" : "white", color: "white", display: "grid", placeItems: "center", fontSize: 11 }}>{stage.done ? "✓" : ""}</span>
                                                    {stage.label}
                                                </div>
                                            ))}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "flex-end", gap: 7, flex: "1 1 260px" }}>
                                            <label style={{ display: "grid", gap: 3, flex: 1, minWidth: 170, fontSize: 9.5, fontWeight: 700, color: "#8A6D55" }}>
                                                Ekspedisi
                                                <input value={orderEkspedisi} onChange={e => setEkspedisiInput(`order:${order.key}`, e.target.value)} placeholder="JNE, travel, diambil..."
                                                    style={{ width: "100%", boxSizing: "border-box", height: 34, border: `1.5px solid ${orderEkspedisi.trim() ? "#86C99A" : "#E8DDD0"}`, borderRadius: 7, padding: "0 10px", background: orderEkspedisi.trim() ? "#F4FBF6" : "#FFFBF7", color: "#3C2F2F", outline: "none", fontSize: 12 }} />
                                            </label>
                                            <button onClick={() => markOrderDikirim(order)} title="Tandai semua item dalam order sebagai dikirim"
                                                style={{ height: 34, border: 0, borderRadius: 7, padding: "0 13px", background: "#15803D", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                                                Kirim ✓
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {isOpen && (
                                    <div style={{ borderTop: "1px solid #E6D5BE", background: "#FFFCF9" }}>
                                        {order.items.map((row, idx) => {
                                            const rowEkspedisi = getRowEkspedisi(row);
                                            return (
                                                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px 9px 50px", borderBottom: idx < order.items.length - 1 ? "1px solid #F1E7DA" : "none", flexWrap: "wrap", background: flash === `row:${row.id}` ? "#F0FFF4" : "transparent" }}>
                                                    <div style={{ flex: "1 1 300px", minWidth: 0 }}>
                                                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#3C2F2F" }}>{row.deskripsi || "—"}</div>
                                                        <div style={{ fontSize: 10.5, color: "#8A7B6E", marginTop: 2 }}>Ukuran {row.ukuran || "—"} · Qty {row.qty || "—"}{row.po_label ? ` · PO ${row.po_label}` : ""}</div>
                                                        {editingNote === row.id ? (
                                                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                                                <input value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Catatan gudang..." autoFocus onKeyDown={e => { if (e.key === "Enter") saveNote(row); if (e.key === "Escape") setEditingNote(null); }}
                                                                    style={{ flex: 1, minWidth: 0, border: "1px solid #D1BFA3", borderRadius: 6, padding: "6px 8px", fontSize: 11 }} />
                                                                <button onClick={() => saveNote(row)} style={{ border: 0, borderRadius: 6, padding: "0 10px", background: "#2563EB", color: "white", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>Simpan</button>
                                                            </div>
                                                        ) : (
                                                            <button onClick={() => { setEditingNote(row.id); setNoteText(row.production_note || ""); }} style={{ border: 0, padding: 0, marginTop: 4, background: "transparent", color: "#A67B5B", fontSize: 10.5, cursor: "pointer", textAlign: "left" }}>📝 {row.production_note || "Tambah catatan"}</button>
                                                        )}
                                                    </div>
                                                    <input value={rowEkspedisi} onChange={e => setEkspedisiInput(`row:${row.id}`, e.target.value)} onBlur={e => updateRow(row.id, { ekspedisi: e.target.value.trim() }, true)} placeholder="Ekspedisi item"
                                                        style={{ flex: "1 1 180px", maxWidth: 250, minWidth: 150, height: 32, border: "1px solid #E8DDD0", borderRadius: 7, padding: "0 9px", fontSize: 11.5, background: "white", color: "#3C2F2F" }} />
                                                    <button onClick={() => markDikirim(row)} style={{ height: 32, border: "1px solid #B7D9C1", borderRadius: 7, padding: "0 11px", background: "#F0FFF4", color: "#15803D", fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>Kirim item</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   TAB 4: KIRIM — barang yang SUDAH DIKIRIM bulan berjalan (di_kirim ✓
   dari tab Gudang atau ceklis "Kirim" di Status Barang) + ekspedisinya.
   Monitoring saja — riwayat bulan lain ada di tab Riwayat.
================================================================ */
function TabKirim() {
    const { rows } = usePesanan();
    const [search, setSearch] = useState("");
    const now = new Date();
    const curY = now.getFullYear();
    const curM = now.getMonth() + 1;

    const shipDate = (r: PesananRow) => (r.shipped_at ? r.shipped_at.slice(0, 10) : r.tanggal);

    // Sinkron dgn Status Barang: semua yang dicentang "Kirim" bulan ini.
    const items = useMemo(() => rows.filter(r => {
        if (!(r.customer || r.deskripsi) || !r.di_kirim) return false;
        const d = shipDate(r);
        if (!d) return false;
        return parseInt(d.slice(0, 4)) === curY && parseInt(d.slice(5, 7)) === curM;
    }), [rows, curY, curM]);

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        if (!q) return items;
        return items.filter(r => [r.customer, r.deskripsi, r.po_label, r.no_inv, r.ekspedisi].join(" ").toLowerCase().includes(q));
    }, [items, search]);

    // Kelompokkan per tanggal kirim, terbaru dulu.
    const groups = useMemo(() => {
        const m: Record<string, PesananRow[]> = {};
        filtered.forEach(r => { const k = shipDate(r); if (!m[k]) m[k] = []; m[k].push(r); });
        return Object.entries(m).sort(([a], [b]) => b.localeCompare(a));
    }, [filtered]);

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
            <SectionHeader title={`Terkirim ${ML[curM - 1]}`} count={items.length} countBg="#DCFCE7" countColor="#15803D"
                actions={<WaButtons title="Barang Keluar" items={filtered} ekspedisi statusOf={() => "✅"} />}>
                <SearchBar value={search} onChange={setSearch} placeholder="Cari customer, invoice, ekspedisi..." />
            </SectionHeader>
            <div style={{ flex: 1, overflow: "auto", padding: "12px 16px", background: "#F8F4EF" }}>
                {groups.length === 0 ? (
                    <EmptyState icon={<IconKirim size={48} color="#C5A882" />} title="Belum ada pengiriman bulan ini" subtitle="Barang yang ditandai Dikirim ✓ (dari Gudang atau Status Barang) muncul di sini" />
                ) : groups.map(([dateKey, dateRows]) => (
                    <div key={dateKey} style={{ marginBottom: 12, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05), 0 0 0 1px rgba(0,0,0,0.03)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "linear-gradient(135deg, #166534, #22C55E)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>{fmtFull(dateKey)}</span>
                                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", borderRadius: 99, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{dateRows.length}</span>
                            </div>
                        </div>
                        <div style={{ background: "white" }}>
                            {dateRows.map((row, idx) => (
                                <div key={row.id} style={{ padding: "11px 14px", borderBottom: idx < dateRows.length - 1 ? "1px solid #F5F0EC" : "none", display: "flex", alignItems: "center", gap: 12 }}>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: 13, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                        <div style={{ fontSize: 11.5, color: "#8A7B6E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{row.deskripsi || "—"}</div>
                                        <div style={{ fontSize: 10.5, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"} · Inv: {row.no_inv || "—"}{row.po_label ? ` · PO ${row.po_label}` : ""}</div>
                                        {row.production_note && <div style={{ marginTop: 3, fontSize: 10.5, color: "#8A6D55" }}>📝 {row.production_note}</div>}
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                                        <span style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 99, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                                            🚚 {(row.ekspedisi || "").trim() || "Tanpa Ekspedisi"}
                                        </span>
                                        {row.shipped_at && <span style={{ fontSize: 10, color: "#B89678" }}>{fmtTimeShort(row.shipped_at)}</span>}
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
    const { rows } = usePesanan();
    const { user } = useAuth();
    const gudangStatusIds = useGudangStatusIds();
    const [activeTab, setActiveTab] = useState<"finishing" | "gudang" | "pengiriman" | "riwayat">(
        user?.username?.toLowerCase() === "dika" ? "gudang" : "finishing"
    );
    const isFinishing = user?.role === "finishing";

    /* Operator finishing langsung lihat tab Finishing saja */
    if (isFinishing) {
        return <TabFinishing />;
    }

    const countFinishing  = rows.filter(r => (r.customer || r.deskripsi) && r.printed_at && !r.di_kirim && r.finishing_status === "belum").length;
    // Gudang = barang selesai warna dan belum dikirim.
    const countGudang = gudangStatusIds?.size
        ?? rows.filter(r => (r.customer || r.deskripsi) && r.di_warna === true && r.di_kirim === false).length;
    // Kirim = sudah dikirim bulan berjalan (sinkron ceklis "Kirim" di Status Barang).
    const nowT = new Date();
    const curYT = nowT.getFullYear(), curMT = nowT.getMonth() + 1;
    const countPengiriman = rows.filter(r => {
        if (!(r.customer || r.deskripsi) || !r.di_kirim) return false;
        const d = r.shipped_at ? r.shipped_at.slice(0, 10) : r.tanggal;
        return !!d && parseInt(d.slice(0, 4)) === curYT && parseInt(d.slice(5, 7)) === curMT;
    }).length;

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
                {activeTab === "gudang"    && <TabGudang statusIds={gudangStatusIds} />}
                {activeTab === "pengiriman"&& <TabKirim />}
                {activeTab === "riwayat"   && <TabRiwayatPO />}
            </div>
        </div>
    );
}

// Di HP tampilkan keterangan "buka di komputer" (components/layout/DesktopOnly).
// PENGECUALIAN: operator finishing bekerja pakai TABLET di lantai produksi.
// Dika juga mendapat bypass melalui DesktopOnly agar seluruh menu yang memang
// diberikan oleh role-nya dapat dibuka di HP (tanpa menambah hak akses baru).
export default function AlurPesananPageMobileGuard() {
    const { user } = useAuth();
    if (user?.role === "finishing") return <AlurPesananPage />;
    return (
        <DesktopOnly label="Alur Pesanan">
            <AlurPesananPage />
        </DesktopOnly>
    );
}
