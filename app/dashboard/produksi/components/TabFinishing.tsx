"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePesanan, PesananRow, FinishingStatus } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";

/* ================================================================
   TAB FINISHING — 4 checkbox: PRODUKSI · REPAIR · WARNA · GUDANG
   Setiap checkbox independen & sync langsung ke pesanan_rows:
     PRODUKSI → di_produksi
     REPAIR   → is_repair + di_produksi=true + finishing_status='repair'
     WARNA    → di_warna   + finishing_status='warna'
     GUDANG   → siap_kirim + di_warna=true + finishing_status='gudang'
================================================================ */

const MN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const ML = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fmtDateFull(iso: string) {
    if (!iso) return "—";
    const p = iso.split("-");
    return p.length >= 3 ? `${parseInt(p[2])} ${ML[parseInt(p[1]) - 1]} ${p[0]}` : iso;
}
function fmtTime(iso: string) { return iso ? iso.slice(11, 16) : ""; }
function fmtTimestamp(iso: string | null) {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }); }
    catch { return iso; }
}
function parseQty(q: string) { return parseFloat(q.replace(",", ".")) || 0; }

function playBeep(freq = 880, duration = 0.12) {
    try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator(); const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = "sine"; osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + duration);
    } catch { /* silent */ }
}

type ToastMsg = { id: number; text: string; color: string };
let toastIdSeq = 0;
function useToast() {
    const [toasts, setToasts] = useState<ToastMsg[]>([]);
    const show = useCallback((text: string, color = "#15803D") => {
        const id = ++toastIdSeq;
        setToasts(prev => [...prev, { id, text, color }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 2800);
    }, []);
    return { toasts, show };
}

/* ── Checkbox metadata ── */
type CheckField = 'produksi' | 'repair' | 'warna' | 'gudang';
const CB: Record<CheckField, { label: string; color: string; bg: string; border: string; beep: number }> = {
    produksi: { label: "Produksi", color: "#7C5A3C", bg: "#FDF4E7", border: "#F5D9A8", beep: 550 },
    repair:   { label: "Repair",   color: "#BE123C", bg: "#FFF1F2", border: "#FECDD3", beep: 440 },
    warna:    { label: "Warna",    color: "#1D4ED8", bg: "#EFF6FF", border: "#BFDBFE", beep: 660 },
    gudang:   { label: "Gudang",   color: "#15803D", bg: "#F0FFF4", border: "#BBF7D0", beep: 880 },
};

/* ── Whether a row's checkbox is checked ── */
function isChecked(item: PesananRow, field: CheckField): boolean {
    if (field === 'produksi') return item.di_produksi;
    if (field === 'repair')   return item.is_repair;
    if (field === 'warna')    return item.di_warna;
    if (field === 'gudang')   return item.siap_kirim;
    return false;
}

/* ── Row background based on highest status ── */
function rowBg(item: PesananRow): string {
    if (item.siap_kirim) return "#F0FFF4";
    if (item.di_warna)   return "#EFF6FF";
    if (item.is_repair)  return "#FFF1F2";
    if (item.di_produksi) return "#FDF4E7";
    return "white";
}

/* ── Sesi type ── */
type Sesi = {
    key: string;
    poLabel: string;
    printedAt: string;
    rows: PesananRow[];
    progress: number;
};

function buildSesiList(rows: PesananRow[], year: number, month: number): Sesi[] {
    const filtered = rows.filter(r => {
        if (!(r.customer || r.deskripsi) || !r.printed_at) return false;
        if (r.di_kirim) return false;
        const y = parseInt(r.printed_at.slice(0, 4));
        const m = parseInt(r.printed_at.slice(5, 7));
        return y === year && m === month;
    });

    const map: Record<string, Sesi> = {};
    filtered.forEach(r => {
        const opKey = r.po_label || "(Tanpa Operator)";
        const key = `${r.printed_at}|||${opKey}`;
        if (!map[key]) map[key] = { key, poLabel: opKey, printedAt: r.printed_at, rows: [], progress: 0 };
        map[key].rows.push(r);
    });

    return Object.values(map)
        .map(s => ({
            ...s,
            // 100% only when all items are in gudang (siap_kirim)
            progress: s.rows.length === 0 ? 0 : Math.round(
                (s.rows.filter(r => r.siap_kirim).length / s.rows.length) * 100
            ),
        }))
        .sort((a, b) => b.printedAt.localeCompare(a.printedAt));
}

/* ================================================================
   MODE OPERATOR — full-screen dark, tombol besar, 4 checkbox
================================================================ */
function OperatorMode({ sesi, onExit }: { sesi: Sesi; onExit?: () => void }) {
    const { updateRow } = usePesanan();
    const [operator, setOperator] = useState("");
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    const [exitConfirm, setExitConfirm] = useState(false);
    const { toasts, show: showToast } = useToast();

    useEffect(() => {
        supabase.from("app_users").select("id, name").then(({ data }) => { if (data) setUsers(data); });
    }, []);

    const handleTap = useCallback((item: PesananRow, field: CheckField) => {
        if (!operator) { showToast("Pilih nama operator dulu!", "#DC2626"); return; }
        const ts = { finishing_operator: operator, finishing_at: new Date().toISOString() };
        const cur = isChecked(item, field);

        if (field === 'produksi') {
            updateRow(item.id, { di_produksi: !cur, ...ts }, true);
            playBeep(cur ? 330 : CB.produksi.beep, 0.12);
            showToast(cur ? "Produksi dibatalkan" : `Produksi: ${item.customer}`, cur ? "#6B7280" : CB.produksi.color);
        } else if (field === 'repair') {
            if (!cur) {
                updateRow(item.id, { is_repair: true, di_produksi: true, finishing_status: 'repair', ...ts }, true);
                pushNotify({ notificationType: "status_produksi", title: "Item Perlu Repair", body: `${item.customer} — ${item.deskripsi}`, url: "/dashboard/produksi" });
                playBeep(CB.repair.beep, 0.2);
                showToast(`Repair: ${item.customer}`, CB.repair.color);
            } else {
                updateRow(item.id, { is_repair: false, finishing_status: item.di_warna ? 'warna' : 'belum', finishing_operator: "", finishing_at: null }, true);
                showToast("Repair dibatalkan", "#6B7280");
            }
        } else if (field === 'warna') {
            if (!cur) {
                updateRow(item.id, { di_warna: true, finishing_status: 'warna', ...ts }, true);
                playBeep(CB.warna.beep, 0.12);
                showToast(`Warna: ${item.customer}`, CB.warna.color);
            } else {
                updateRow(item.id, { di_warna: false, finishing_status: item.is_repair ? 'repair' : 'belum', finishing_operator: "", finishing_at: null }, true);
                showToast("Warna dibatalkan", "#6B7280");
            }
        } else if (field === 'gudang') {
            if (!cur) {
                updateRow(item.id, { siap_kirim: true, di_warna: true, finishing_status: 'gudang', ...ts }, true);
                playBeep(CB.gudang.beep, 0.12);
                showToast(`Gudang: ${item.customer}`, CB.gudang.color);
            } else {
                updateRow(item.id, { siap_kirim: false, finishing_status: item.di_warna ? 'warna' : (item.is_repair ? 'repair' : 'belum'), finishing_operator: "", finishing_at: null }, true);
                showToast("Gudang dibatalkan", "#6B7280");
            }
        }

        supabase.from("finishing_checks").insert({ pesanan_id: item.id, status: field, operator_name: operator, checked_at: new Date().toISOString() }).then(() => {});
    }, [operator, updateRow, showToast]);

    const items = sesi.rows;
    const done = items.filter(r => r.di_produksi || r.finishing_status !== 'belum').length;

    return (
        <div style={{ position: "fixed", inset: 0, background: "#1C1917", zIndex: 1000, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "#292524", borderBottom: "1px solid #3C2F2F", flexShrink: 0 }}>
                <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#A67B5B", letterSpacing: "0.1em", textTransform: "uppercase" }}>MODE OPERATOR — {sesi.poLabel}</div>
                    <div style={{ fontSize: 12, color: "#D6D3D1", marginTop: 2 }}>{fmtDateFull(sesi.printedAt.slice(0, 10))} · {fmtTime(sesi.printedAt)} · {done}/{items.length} selesai</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <select value={operator} onChange={e => setOperator(e.target.value)}
                        style={{ padding: "7px 12px", borderRadius: 8, border: "1.5px solid #57534E", background: "#3C3835", color: operator ? "#FCD34D" : "#78716C", fontSize: 12, fontWeight: 700, minWidth: 150, cursor: "pointer" }}>
                        <option value="">— Pilih Nama —</option>
                        {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                    {onExit && (
                        <button onClick={() => setExitConfirm(true)} style={{ padding: "7px 16px", borderRadius: 8, border: "1.5px solid #57534E", background: "transparent", color: "#F87171", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Keluar ✕</button>
                    )}
                </div>
            </div>

            {!operator && (
                <div style={{ padding: "10px 20px", background: "#78350F", color: "#FCD34D", fontSize: 12, fontWeight: 700, textAlign: "center", flexShrink: 0 }}>
                    ⚠️ Pilih nama operator di atas sebelum menceklis item
                </div>
            )}

            {/* Items */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
                {items.map((item, idx) => {
                    const bg = rowBg(item);
                    const isLight = item.di_produksi || item.is_repair || item.di_warna || item.siap_kirim;
                    return (
                        <div key={item.id} style={{ background: isLight ? bg : "#292524", border: `2px solid ${isLight ? "#D1BFA3" : "#3C3835"}`, borderRadius: 14, marginBottom: 10, padding: "14px 16px", transition: "all 0.2s" }}>
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                                        <span style={{ width: 26, height: 26, borderRadius: "50%", background: "#3C3835", color: "#D6D3D1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, flexShrink: 0 }}>{idx + 1}</span>
                                        <span style={{ fontSize: 16, fontWeight: 800, color: isLight ? "#3C2F2F" : "#E7E5E4" }}>{item.customer || "—"}</span>
                                    </div>
                                    <div style={{ fontSize: 12, color: isLight ? "#5C4033" : "#A8A29E", marginLeft: 34 }}>
                                        {item.deskripsi || "—"} · UK: {item.ukuran || "—"} · Qty: {item.qty || "—"}
                                    </div>
                                </div>
                            </div>
                            {/* 4 buttons */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
                                {(["produksi", "repair", "warna", "gudang"] as CheckField[]).map(f => {
                                    const active = isChecked(item, f);
                                    const m = CB[f];
                                    return (
                                        <button key={f} onClick={() => handleTap(item, f)}
                                            style={{ padding: "14px 6px", borderRadius: 10, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, transition: "all 0.15s", background: active ? m.color : "#3C3835", color: active ? "white" : m.color, boxShadow: active ? `0 4px 12px ${m.color}55` : "none", transform: active ? "scale(1.03)" : "scale(1)", minHeight: 50 }}
                                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#57534E"; }}
                                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "#3C3835"; }}>
                                            {m.label}{active ? " ✓" : ""}
                                        </button>
                                    );
                                })}
                            </div>
                            {item.finishing_at && item.finishing_operator && (
                                <div style={{ fontSize: 10, color: "#78716C", marginTop: 6 }}>oleh {item.finishing_operator} · {fmtTimestamp(item.finishing_at)}</div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer progress */}
            <div style={{ padding: "10px 20px", background: "#292524", borderTop: "1px solid #3C2F2F", display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
                <div style={{ flex: 1, height: 7, background: "#3C3835", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg, #A67B5B, #D4A574)", width: `${items.length ? (done / items.length) * 100 : 0}%`, transition: "width 0.4s ease" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#D6D3D1", whiteSpace: "nowrap" }}>{done}/{items.length} selesai</span>
            </div>

            {/* Exit confirm */}
            {exitConfirm && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 }}>
                    <div style={{ background: "white", borderRadius: 16, padding: "26px", width: 300 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#3C2F2F", marginBottom: 6 }}>Keluar Mode Operator?</div>
                        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 18 }}>Semua progress tersimpan otomatis.</div>
                        <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setExitConfirm(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #E8DDD0", background: "white", fontSize: 12, fontWeight: 700, color: "#6B7280", cursor: "pointer" }}>Batal</button>
                            <button onClick={() => onExit?.()} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Keluar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div style={{ position: "fixed", top: 20, right: 20, display: "flex", flexDirection: "column", gap: 7, zIndex: 20000 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ padding: "9px 16px", borderRadius: 10, background: t.color, color: "white", fontSize: 12, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.2)" }}>{t.text}</div>
                ))}
            </div>
        </div>
    );
}

/* ================================================================
   MAIN: TAB FINISHING (Manager View)
================================================================ */
export default function TabFinishing() {
    const { rows, updateRow } = usePesanan();
    const { user } = useAuth();
    const now = new Date();
    const isFinishingRole = user?.role === "finishing";

    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear]   = useState(now.getFullYear());
    const [search, setSearch] = useState("");
    const [selectedKey, setSelectedKey] = useState<string | null>(null);
    const [operatorMode, setOperatorMode] = useState(false);
    const { toasts, show: showToast } = useToast();

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    const allSesi = useMemo(() => buildSesiList(rows, year, month), [rows, year, month]);
    const filteredSesi = useMemo(() => {
        if (!search.trim()) return allSesi;
        const q = search.toLowerCase();
        return allSesi.filter(s =>
            s.poLabel.toLowerCase().includes(q) ||
            s.rows.some(r => [r.customer, r.deskripsi].join(" ").toLowerCase().includes(q))
        );
    }, [allSesi, search]);

    const selectedSesi = useMemo(() => filteredSesi.find(s => s.key === selectedKey) ?? null, [filteredSesi, selectedKey]);

    useEffect(() => {
        if (!selectedKey && filteredSesi.length > 0) setSelectedKey(filteredSesi[0].key);
    }, [filteredSesi, selectedKey]);

    useEffect(() => {
        if (selectedKey && !filteredSesi.find(s => s.key === selectedKey)) {
            setSelectedKey(filteredSesi[0]?.key ?? null);
        }
    }, [filteredSesi, selectedKey]);

    const displayRows = useMemo(() => {
        const rows = selectedSesi?.rows ?? [];
        if (!search.trim()) return rows;
        const q = search.toLowerCase();
        return rows.filter(r => [r.customer, r.deskripsi].join(" ").toLowerCase().includes(q));
    }, [selectedSesi, search]);

    const stats = useMemo(() => {
        const items = selectedSesi?.rows ?? [];
        const total    = items.length;
        const belum    = items.filter(r => !r.di_produksi && !r.is_repair && !r.di_warna && !r.siap_kirim).length;
        const produksi = items.filter(r => r.di_produksi).length;
        const repair   = items.filter(r => r.is_repair).length;
        const warna    = items.filter(r => r.di_warna).length;
        const gudang   = items.filter(r => r.siap_kirim).length;
        const operators = [...new Set(items.filter(r => r.finishing_operator).map(r => r.finishing_operator))];
        return { total, belum, produksi, repair, warna, gudang, operators };
    }, [selectedSesi]);

    /* ── Unified checkbox handler (4 independent fields) ── */
    const handleCheck = useCallback((item: PesananRow, field: CheckField) => {
        const operatorName = user?.name ?? "—";
        const ts = { finishing_operator: operatorName, finishing_at: new Date().toISOString() };
        const cur = isChecked(item, field);

        if (field === 'produksi') {
            updateRow(item.id, { di_produksi: !cur, ...ts }, true);
            showToast(cur ? "Produksi dibatalkan" : `Produksi ✓ ${item.customer}`, cur ? "#6B7280" : CB.produksi.color);
        } else if (field === 'repair') {
            if (!cur) {
                updateRow(item.id, { is_repair: true, di_produksi: true, finishing_status: 'repair', ...ts }, true);
                pushNotify({ notificationType: "status_produksi", title: "Item Perlu Repair", body: `${item.customer} — ${item.deskripsi}`, url: "/dashboard/produksi" });
                showToast(`Repair: ${item.customer}`, CB.repair.color);
            } else {
                updateRow(item.id, { is_repair: false, finishing_status: (item.di_warna ? 'warna' : 'belum') as FinishingStatus, finishing_operator: "", finishing_at: null }, true);
                showToast("Repair dibatalkan", "#6B7280");
            }
        } else if (field === 'warna') {
            if (!cur) {
                updateRow(item.id, { di_warna: true, finishing_status: 'warna', ...ts }, true);
                showToast(`Warna ✓ ${item.customer}`, CB.warna.color);
            } else {
                updateRow(item.id, { di_warna: false, finishing_status: (item.is_repair ? 'repair' : 'belum') as FinishingStatus, finishing_operator: "", finishing_at: null }, true);
                showToast("Warna dibatalkan", "#6B7280");
            }
        } else if (field === 'gudang') {
            if (!cur) {
                updateRow(item.id, { siap_kirim: true, di_warna: true, finishing_status: 'gudang', ...ts }, true);
                showToast(`Gudang ✓ ${item.customer}`, CB.gudang.color);
            } else {
                updateRow(item.id, { siap_kirim: false, finishing_status: (item.di_warna ? 'warna' : item.is_repair ? 'repair' : 'belum') as FinishingStatus, finishing_operator: "", finishing_at: null }, true);
                showToast("Gudang dibatalkan", "#6B7280");
            }
        }

        supabase.from("finishing_checks").insert({ pesanan_id: item.id, status: field, operator_name: operatorName, checked_at: new Date().toISOString() }).then(() => {});
    }, [user, updateRow, showToast]);

    const selectStyle: React.CSSProperties = { border: "1.5px solid #E8DDD0", borderRadius: 8, padding: "6px 10px", fontSize: 12, color: "#5C4033", background: "#FAFAF8", height: 32, fontWeight: 600, outline: "none" };

    if (operatorMode && selectedSesi) {
        return <OperatorMode sesi={selectedSesi} onExit={isFinishingRole ? undefined : () => setOperatorMode(false)} />;
    }

    return (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", background: "#F8F4EF" }}>

            {/* ── LEFT SIDEBAR: Sesi List ── */}
            <div style={{ width: 280, minWidth: 240, maxWidth: 320, background: "white", borderRight: "1px solid #E8DDD0", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
                <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#5C4033", marginBottom: 8, letterSpacing: "0.05em", textTransform: "uppercase" }}>Sesi PO Finishing</div>
                    <div style={{ display: "flex", gap: 5, marginBottom: 7 }}>
                        <select value={month} onChange={e => setMonth(+e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                            {ML.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(+e.target.value)} style={{ ...selectStyle, width: 68 }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div style={{ position: "relative" }}>
                        <svg style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }} width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#5C4033" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari operator, customer..."
                            style={{ ...selectStyle, width: "100%", paddingLeft: 26, height: 30, boxSizing: "border-box" }} />
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {filteredSesi.length === 0 ? (
                        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#C5A882" }}>
                            <div style={{ fontSize: 26, marginBottom: 6 }}>📋</div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#8A6D55" }}>Belum ada sesi PO</div>
                        </div>
                    ) : filteredSesi.map(s => {
                        const isActive = s.key === selectedKey;
                        const totalQty = s.rows.reduce((a, r) => a + parseQty(r.qty), 0);
                        return (
                            <div key={s.key} onClick={() => setSelectedKey(s.key)}
                                style={{ padding: "10px 12px", borderBottom: "1px solid #F5F0EC", cursor: "pointer", transition: "background 0.15s", background: isActive ? "#FEF3E8" : "white", borderLeft: `3px solid ${isActive ? "#A67B5B" : "transparent"}` }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#FAFAF8"; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}>
                                <div style={{ fontSize: 9, color: "#B89678", fontWeight: 700, marginBottom: 1 }}>{fmtDateFull(s.printedAt.slice(0, 10))} {fmtTime(s.printedAt)}</div>
                                <div style={{ fontSize: 12, fontWeight: 800, color: "#3C2F2F", marginBottom: 3 }}>{s.poLabel}</div>
                                <div style={{ fontSize: 10, color: "#8A7B6E", marginBottom: 5 }}>{s.rows.length} item · Qty {totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)}</div>
                                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <div style={{ flex: 1, height: 4, background: "#F0E6D8", borderRadius: 99, overflow: "hidden" }}>
                                        <div style={{ height: "100%", borderRadius: 99, background: s.progress === 100 ? "#15803D" : "#A67B5B", width: `${s.progress}%`, transition: "width 0.3s ease" }} />
                                    </div>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: s.progress === 100 ? "#15803D" : "#A67B5B", minWidth: 26 }}>{s.progress}%</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            {!selectedSesi ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#C5A882" }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>🏭</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#8A6D55" }}>Pilih sesi PO dari sidebar</div>
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Header detail */}
                    <div style={{ padding: "10px 16px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                            <div>
                                <div style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F" }}>{selectedSesi.poLabel}</div>
                                <div style={{ fontSize: 10, color: "#B89678", marginTop: 1 }}>
                                    {fmtDateFull(selectedSesi.printedAt.slice(0, 10))} {fmtTime(selectedSesi.printedAt)}
                                    {stats.operators.length > 0 && ` · Operator: ${stats.operators.join(", ")}`}
                                </div>
                            </div>
                            {!isFinishingRole && (
                                <button onClick={() => setOperatorMode(true)}
                                    style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #5C4033, #7C5A3C)", color: "white", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, boxShadow: "0 2px 8px rgba(92,64,51,0.25)" }}>
                                    Mode Operator ▶
                                </button>
                            )}
                        </div>

                        {/* Stats: 6 cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginTop: 10 }}>
                            {[
                                { label: "Total",    val: stats.total,    color: "#3C2F2F", bg: "#F8F4EF" },
                                { label: "Belum",    val: stats.belum,    color: "#6B7280", bg: "#F3F4F6" },
                                { label: "Produksi", val: stats.produksi, color: CB.produksi.color, bg: CB.produksi.bg },
                                { label: "Repair",   val: stats.repair,   color: CB.repair.color,   bg: CB.repair.bg },
                                { label: "Warna",    val: stats.warna,    color: CB.warna.color,    bg: CB.warna.bg },
                                { label: "Gudang",   val: stats.gudang,   color: CB.gudang.color,   bg: CB.gudang.bg },
                            ].map(c => (
                                <div key={c.label} style={{ background: c.bg, borderRadius: 7, padding: "6px 8px", textAlign: "center" }}>
                                    <div style={{ fontSize: 16, fontWeight: 800, color: c.color }}>{c.val}</div>
                                    <div style={{ fontSize: 9, color: "#8A7B6E", fontWeight: 600 }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ flex: 1, overflow: "auto" }}>
                        {displayRows.length === 0 ? (
                            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#C5A882" }}>
                                <div style={{ fontSize: 11, fontWeight: 700 }}>{search.trim() ? "Tidak ada customer yang cocok" : "Tidak ada item di sesi ini"}</div>
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: "#FAF7F3", position: "sticky", top: 0, zIndex: 2 }}>
                                        {["NO", "CUSTOMER", "DESKRIPSI", "UK", "QTY", "PRODUKSI", "REPAIR", "WARNA", "GUDANG", "WAKTU", "OPERATOR"].map(h => (
                                            <th key={h} style={{ padding: "9px 10px", textAlign: h === "NO" ? "center" : "left", fontSize: 9, fontWeight: 800, color: "#8A6D55", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1.5px solid #E8DDD0", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayRows.map((item, idx) => {
                                        const bg = rowBg(item);
                                        return (
                                            <tr key={item.id} style={{ background: bg, borderBottom: "1px solid #F0E6D8", transition: "background 0.2s" }}>
                                                <td style={{ padding: "9px 10px", textAlign: "center", color: "#8A7B6E", fontWeight: 700 }}>{idx + 1}</td>
                                                <td style={{ padding: "9px 10px", fontWeight: 700, color: "#3C2F2F", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.customer || "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#5C4033", maxWidth: 220, wordBreak: "break-word", whiteSpace: "normal", lineHeight: 1.4 }}>{item.deskripsi || "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#8A7B6E", whiteSpace: "nowrap" }}>{item.ukuran || "—"}</td>
                                                <td style={{ padding: "9px 10px", color: "#3C2F2F", fontWeight: 700, whiteSpace: "nowrap" }}>{item.qty || "—"}</td>

                                                {/* 4 checkbox columns */}
                                                {(["produksi", "repair", "warna", "gudang"] as CheckField[]).map(f => {
                                                    const checked = isChecked(item, f);
                                                    const m = CB[f];
                                                    return (
                                                        <td key={f} style={{ padding: "9px 10px", textAlign: "center" }}>
                                                            <button onClick={() => handleCheck(item, f)}
                                                                title={checked ? `Batalkan ${m.label}` : `Tandai ${m.label}`}
                                                                style={{ width: 26, height: 26, borderRadius: 6, cursor: "pointer", border: `2px solid ${checked ? m.color : "#D1D5DB"}`, background: checked ? m.color : "white", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s", flexShrink: 0 }}>
                                                                {checked && (
                                                                    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}

                                                <td style={{ padding: "9px 10px", color: "#8A7B6E", whiteSpace: "nowrap", fontSize: 10 }}>{fmtTimestamp(item.finishing_at)}</td>
                                                <td style={{ padding: "9px 10px", color: "#5C4033", fontWeight: 600, whiteSpace: "nowrap" }}>{item.finishing_operator || "—"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr style={{ background: "#FAF7F3", borderTop: "2px solid #E8DDD0" }}>
                                        <td colSpan={5} style={{ padding: "9px 10px", fontSize: 10, fontWeight: 700, color: "#5C4033" }}>
                                            Total: {stats.total} · Belum: {stats.belum} · Progress: {stats.total ? Math.round(((stats.total - stats.belum) / stats.total) * 100) : 0}%
                                        </td>
                                        {(["produksi", "repair", "warna", "gudang"] as CheckField[]).map(f => (
                                            <td key={f} style={{ padding: "9px 10px", textAlign: "center", fontSize: 10, fontWeight: 800, color: CB[f].color }}>
                                                {f === 'produksi' ? stats.produksi : f === 'repair' ? stats.repair : f === 'warna' ? stats.warna : stats.gudang}
                                            </td>
                                        ))}
                                        <td colSpan={2} />
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div style={{ position: "fixed", top: 20, right: 20, display: "flex", flexDirection: "column", gap: 7, zIndex: 20000 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{ padding: "9px 16px", borderRadius: 10, background: t.color, color: "white", fontSize: 12, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }}>{t.text}</div>
                ))}
            </div>
        </div>
    );
}
