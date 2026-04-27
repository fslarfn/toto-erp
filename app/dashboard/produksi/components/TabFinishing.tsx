"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { usePesanan, PesananRow, FinishingStatus } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";

/* ================================================================
   TAB FINISHING — Digital checklist untuk operator finishing
   Menggantikan ceklis kertas PO Finishing
================================================================ */

const MN = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
const ML = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];

function fmtDate(iso: string) {
    if (!iso) return "—";
    const p = iso.split("-");
    return p.length >= 3 ? `${parseInt(p[2])} ${MN[parseInt(p[1]) - 1]}` : iso;
}
function fmtDateFull(iso: string) {
    if (!iso) return "—";
    const p = iso.split("-");
    return p.length >= 3 ? `${parseInt(p[2])} ${ML[parseInt(p[1]) - 1]} ${p[0]}` : iso;
}
function fmtTime(iso: string) {
    if (!iso) return "";
    return iso.slice(11, 16);
}
function fmtTimestamp(iso: string) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString("id-ID", {
            day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
            timeZone: "Asia/Jakarta",
        });
    } catch { return iso; }
}
function parseQty(q: string): number {
    return parseFloat(q.replace(",", ".")) || 0;
}

/* ── Audio beep untuk operator mode ── */
function playBeep(freq = 880, duration = 0.12) {
    try {
        const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    } catch { /* silently fail */ }
}

/* ── Toast kecil ── */
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

/* ── Status label & warna ── */
const STATUS_META: Record<FinishingStatus, { label: string; color: string; bg: string; border: string }> = {
    belum:  { label: "Belum",  color: "#6B7280", bg: "#F3F4F6",  border: "#D1D5DB" },
    repair: { label: "Repair", color: "#BE123C", bg: "#FFF1F2",  border: "#FECDD3" },
    warna:  { label: "Warna",  color: "#1D4ED8", bg: "#EFF6FF",  border: "#BFDBFE" },
    gudang: { label: "Gudang", color: "#15803D", bg: "#F0FFF4",  border: "#BBF7D0" },
};

/* ── Sesi type ── */
type Sesi = {
    key: string;        // `${printed_at}|||${po_label}`
    poLabel: string;
    printedAt: string;  // full ISO
    rows: PesananRow[];
    progress: number;   // 0–100 persen item sudah diceklis
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
        if (!map[key]) {
            map[key] = { key, poLabel: opKey, printedAt: r.printed_at, rows: [], progress: 0 };
        }
        map[key].rows.push(r);
    });

    return Object.values(map)
        .map(s => ({
            ...s,
            progress: s.rows.length === 0
                ? 0
                : Math.round((s.rows.filter(r => r.finishing_status !== "belum").length / s.rows.length) * 100),
        }))
        .sort((a, b) => b.printedAt.localeCompare(a.printedAt));
}

/* ================================================================
   CONFIRM MODAL
================================================================ */
type ConfirmPayload = {
    item: PesananRow;
    fromStatus: FinishingStatus;
    toStatus: FinishingStatus;
};

function ConfirmModal({ payload, onConfirm, onCancel }: {
    payload: ConfirmPayload;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    const from = STATUS_META[payload.fromStatus];
    const to   = STATUS_META[payload.toStatus];
    return (
        <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
            <div style={{
                background: "white", borderRadius: 16, padding: "28px 28px 24px",
                width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
            }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F", marginBottom: 8 }}>
                    Ganti Status?
                </div>
                <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.6 }}>
                    <strong style={{ color: "#3C2F2F" }}>{payload.item.customer || "—"}</strong>
                    <br />{payload.item.deskripsi || "—"}
                    <br /><br />
                    Status akan berubah dari{" "}
                    <span style={{ fontWeight: 700, color: from.color }}>{from.label}</span>
                    {" → "}
                    <span style={{ fontWeight: 700, color: to.color }}>{to.label}</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={onCancel} style={{
                        flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #E8DDD0",
                        background: "white", fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer",
                    }}>Batal</button>
                    <button onClick={onConfirm} style={{
                        flex: 1, padding: "10px", borderRadius: 10, border: "none",
                        background: to.color, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>Ya, Ganti</button>
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   MODE OPERATOR — full-screen, tombol besar
================================================================ */
function OperatorMode({
    sesi,
    onExit,
}: {
    sesi: Sesi;
    onExit?: () => void;
}) {
    const { updateRow } = usePesanan();
    const [operator, setOperator] = useState("");
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(null);
    const [exitConfirm, setExitConfirm] = useState(false);
    const { toasts, show: showToast } = useToast();

    useEffect(() => {
        supabase.from("app_users").select("id, name").then(({ data }) => {
            if (data) setUsers(data);
        });
    }, []);

    const executeCheck = useCallback(async (item: PesananRow, status: FinishingStatus) => {
        if (!operator) { showToast("Pilih nama operator dulu!", "#DC2626"); return; }

        const patch: Partial<PesananRow> = {
            finishing_status: status,
            finishing_operator: operator,
            finishing_at: new Date().toISOString(),
        };

        if (status === "repair") {
            patch.di_produksi = false;
            patch.is_repair = true;
        }

        updateRow(item.id, patch, true);
        await supabase.from("finishing_checks").insert({
            pesanan_id: item.id, status,
            operator_name: operator,
            checked_at: new Date().toISOString(),
        }).then(() => {});

        if (status === "repair") {
            pushNotify({
                notificationType: "status_produksi",
                title: "Item Perlu Repair",
                body: `${item.customer} — ${item.deskripsi} dikembalikan ke produksi`,
                url: "/dashboard/produksi",
            });
            playBeep(440, 0.2);
            showToast(`Repair: ${item.customer}`, "#BE123C");
        } else if (status === "warna") {
            playBeep(660, 0.12);
            showToast(`Warna: ${item.customer}`, "#1D4ED8");
        } else {
            playBeep(880, 0.12);
            showToast(`Gudang: ${item.customer}`, "#15803D");
        }
    }, [operator, updateRow, showToast]);

    const handleTap = useCallback((item: PesananRow, status: FinishingStatus) => {
        const cur = (item.finishing_status || "belum") as FinishingStatus;
        if (cur === status) {
            // uncheck: reset ke belum
            const reset: Partial<PesananRow> = {
                finishing_status: "belum", finishing_operator: "", finishing_at: null,
            };
            if (cur === "repair") { reset.di_produksi = true; reset.is_repair = false; }
            updateRow(item.id, reset, true);
            showToast("Status direset", "#6B7280");
            return;
        }
        if (cur !== "belum") {
            setConfirmPayload({ item, fromStatus: cur, toStatus: status });
            return;
        }
        executeCheck(item, status);
    }, [executeCheck, updateRow, showToast]);

    const items = sesi.rows;
    const done  = items.filter(r => r.finishing_status !== "belum").length;

    return (
        <div style={{
            position: "fixed", inset: 0, background: "#1C1917", zIndex: 1000,
            display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
            {/* Header */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 24px", background: "#292524", borderBottom: "1px solid #3C2F2F",
                flexShrink: 0,
            }}>
                <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#A67B5B", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        MODE OPERATOR — {sesi.poLabel}
                    </div>
                    <div style={{ fontSize: 13, color: "#D6D3D1", marginTop: 2 }}>
                        {fmtDateFull(sesi.printedAt.slice(0, 10))} · {done}/{items.length} selesai
                    </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Operator selector */}
                    <select
                        value={operator}
                        onChange={e => setOperator(e.target.value)}
                        style={{
                            padding: "8px 14px", borderRadius: 8, border: "1.5px solid #57534E",
                            background: "#3C3835", color: operator ? "#FCD34D" : "#78716C",
                            fontSize: 13, fontWeight: 700, minWidth: 160, cursor: "pointer",
                        }}
                    >
                        <option value="">— Pilih Nama —</option>
                        {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                    </select>
                    {onExit && (
                        <button
                            onClick={() => setExitConfirm(true)}
                            style={{
                                padding: "8px 18px", borderRadius: 8, border: "1.5px solid #57534E",
                                background: "transparent", color: "#F87171", fontSize: 12, fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Keluar ✕
                        </button>
                    )}
                </div>
            </div>

            {/* Warning jika belum pilih operator */}
            {!operator && (
                <div style={{
                    padding: "12px 24px", background: "#78350F", color: "#FCD34D",
                    fontSize: 13, fontWeight: 700, textAlign: "center", flexShrink: 0,
                }}>
                    ⚠️ Pilih nama operator di atas sebelum menceklis item
                </div>
            )}

            {/* Items list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                {items.map((item, idx) => {
                    const cur = (item.finishing_status || "belum") as FinishingStatus;
                    const meta = STATUS_META[cur];
                    return (
                        <div key={item.id} style={{
                            background: cur === "belum" ? "#292524" : meta.bg,
                            border: `2px solid ${cur === "belum" ? "#3C3835" : meta.border}`,
                            borderRadius: 16, marginBottom: 12, padding: "16px 18px",
                            transition: "all 0.2s",
                        }}>
                            {/* Item info */}
                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                                        <span style={{
                                            width: 28, height: 28, borderRadius: "50%",
                                            background: "#3C3835", color: "#D6D3D1",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            fontSize: 12, fontWeight: 800, flexShrink: 0,
                                        }}>{idx + 1}</span>
                                        <span style={{ fontSize: 17, fontWeight: 800, color: cur === "belum" ? "#E7E5E4" : meta.color }}>
                                            {item.customer || "—"}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: 13, color: "#A8A29E", marginLeft: 38, lineHeight: 1.5 }}>
                                        {item.deskripsi || "—"}
                                        <span style={{ marginLeft: 10, color: "#78716C" }}>
                                            UK: {item.ukuran || "—"} · Qty: {item.qty || "—"}
                                        </span>
                                    </div>
                                </div>
                                {cur !== "belum" && (
                                    <span style={{
                                        padding: "4px 14px", borderRadius: 99,
                                        background: meta.color, color: "white",
                                        fontSize: 12, fontWeight: 800, flexShrink: 0,
                                    }}>{meta.label} ✓</span>
                                )}
                            </div>

                            {/* 3 Big buttons */}
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                {(["repair", "warna", "gudang"] as FinishingStatus[]).map(s => {
                                    const m = STATUS_META[s];
                                    const isActive = cur === s;
                                    return (
                                        <button
                                            key={s}
                                            onClick={() => handleTap(item, s)}
                                            style={{
                                                padding: "16px 8px", borderRadius: 12, border: "none",
                                                cursor: "pointer", fontWeight: 800, fontSize: 15,
                                                transition: "all 0.15s", letterSpacing: "0.03em",
                                                background: isActive ? m.color : "#3C3835",
                                                color: isActive ? "white" : m.color,
                                                boxShadow: isActive ? `0 4px 14px ${m.color}55` : "none",
                                                transform: isActive ? "scale(1.03)" : "scale(1)",
                                                minHeight: 56,
                                            }}
                                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#57534E"; }}
                                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "#3C3835"; }}
                                        >
                                            {m.label}{isActive ? " ✓" : ""}
                                        </button>
                                    );
                                })}
                            </div>

                            {cur !== "belum" && item.finishing_operator && (
                                <div style={{ fontSize: 11, color: "#78716C", marginTop: 8, marginLeft: 2 }}>
                                    oleh {item.finishing_operator} · {fmtTimestamp(item.finishing_at ?? "")}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer progress */}
            <div style={{
                padding: "12px 24px", background: "#292524", borderTop: "1px solid #3C2F2F",
                display: "flex", alignItems: "center", gap: 16, flexShrink: 0,
            }}>
                <div style={{ flex: 1, height: 8, background: "#3C3835", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                        height: "100%", borderRadius: 99,
                        background: "linear-gradient(90deg, #A67B5B, #D4A574)",
                        width: `${items.length ? (done / items.length) * 100 : 0}%`,
                        transition: "width 0.4s ease",
                    }} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#D6D3D1", whiteSpace: "nowrap" }}>
                    {done}/{items.length} selesai
                </span>
            </div>

            {/* Confirm modal ganti status */}
            {confirmPayload && (
                <ConfirmModal
                    payload={confirmPayload}
                    onConfirm={() => { executeCheck(confirmPayload.item, confirmPayload.toStatus); setConfirmPayload(null); }}
                    onCancel={() => setConfirmPayload(null)}
                />
            )}

            {/* Confirm keluar */}
            {exitConfirm && (
                <div style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
                    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000,
                }}>
                    <div style={{ background: "white", borderRadius: 16, padding: "28px", width: 320 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F", marginBottom: 8 }}>Keluar Mode Operator?</div>
                        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20 }}>Semua progress tersimpan otomatis.</div>
                        <div style={{ display: "flex", gap: 10 }}>
                            <button onClick={() => setExitConfirm(false)} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "1.5px solid #E8DDD0", background: "white", fontSize: 13, fontWeight: 700, color: "#6B7280", cursor: "pointer" }}>Batal</button>
                            <button onClick={() => onExit?.()} style={{ flex: 1, padding: "10px", borderRadius: 10, border: "none", background: "#DC2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Keluar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toasts */}
            <div style={{ position: "fixed", top: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 20000 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        padding: "10px 18px", borderRadius: 10,
                        background: t.color, color: "white",
                        fontSize: 13, fontWeight: 700,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                        animation: "slideIn 0.2s ease",
                    }}>{t.text}</div>
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
    const [confirmPayload, setConfirmPayload] = useState<ConfirmPayload | null>(null);
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);
    const { toasts, show: showToast } = useToast();

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    useEffect(() => {
        supabase.from("app_users").select("id, name").then(({ data }) => {
            if (data) setUsers(data);
        });
    }, []);

    /* ── Sesi list ── */
    const allSesi = useMemo(() => buildSesiList(rows, year, month), [rows, year, month]);

    const filteredSesi = useMemo(() => {
        if (!search.trim()) return allSesi;
        const q = search.toLowerCase();
        return allSesi.filter(s =>
            s.poLabel.toLowerCase().includes(q) ||
            s.rows.some(r => [r.customer, r.deskripsi].join(" ").toLowerCase().includes(q))
        );
    }, [allSesi, search]);

    const selectedSesi = useMemo(
        () => filteredSesi.find(s => s.key === selectedKey) ?? null,
        [filteredSesi, selectedKey]
    );

    /* Auto-select first sesi when list changes */
    useEffect(() => {
        if (!selectedKey && filteredSesi.length > 0) setSelectedKey(filteredSesi[0].key);
    }, [filteredSesi, selectedKey]);

    /* Clear selection if sesi no longer exists */
    useEffect(() => {
        if (selectedKey && !filteredSesi.find(s => s.key === selectedKey)) {
            setSelectedKey(filteredSesi[0]?.key ?? null);
        }
    }, [filteredSesi, selectedKey]);

    /* ── Stats for selected sesi ── */
    const stats = useMemo(() => {
        const items = selectedSesi?.rows ?? [];
        const total   = items.length;
        const repair  = items.filter(r => r.finishing_status === "repair").length;
        const warna   = items.filter(r => r.finishing_status === "warna").length;
        const gudang  = items.filter(r => r.finishing_status === "gudang").length;
        const done    = repair + warna + gudang;
        const belum   = total - done;
        const repairPct = total ? Math.round((repair / total) * 100) : 0;
        const operators = [...new Set(items.filter(r => r.finishing_operator).map(r => r.finishing_operator))];
        return { total, repair, warna, gudang, done, belum, repairPct, operators };
    }, [selectedSesi]);

    /* ── Check / Uncheck logic ── */
    const executeCheck = useCallback(async (item: PesananRow, status: FinishingStatus) => {
        const operatorName = user?.name ?? "—";
        const patch: Partial<PesananRow> = {
            finishing_status: status,
            finishing_operator: operatorName,
            finishing_at: new Date().toISOString(),
        };

        if (status === "repair") {
            patch.di_produksi = false;
            patch.is_repair   = true;
        }

        updateRow(item.id, patch, true);
        await supabase.from("finishing_checks").insert({
            pesanan_id: item.id, status,
            operator_name: operatorName,
            checked_at: new Date().toISOString(),
        }).then(() => {});

        if (status === "repair") {
            pushNotify({
                notificationType: "status_produksi",
                title: "Item Perlu Repair",
                body: `${item.customer} — ${item.deskripsi} dikembalikan ke produksi`,
                url: "/dashboard/produksi",
            });
            showToast(`Repair: ${item.customer}`, "#BE123C");
        } else if (status === "warna") {
            showToast(`Warna: ${item.customer}`, "#1D4ED8");
        } else {
            showToast(`Gudang: ${item.customer}`, "#15803D");
        }
    }, [user, updateRow, showToast]);

    const executeUncheck = useCallback(async (item: PesananRow) => {
        const cur = (item.finishing_status || "belum") as FinishingStatus;
        const reset: Partial<PesananRow> = {
            finishing_status: "belum", finishing_operator: "", finishing_at: null,
        };
        if (cur === "repair") { reset.di_produksi = true; reset.is_repair = false; }

        updateRow(item.id, reset, true);
        await supabase.from("finishing_checks")
            .update({ unchecked_at: new Date().toISOString() })
            .eq("pesanan_id", item.id)
            .is("unchecked_at", null)
            .then(() => {});

        showToast("Status direset", "#6B7280");
    }, [updateRow, showToast]);

    const handleCheck = useCallback((item: PesananRow, status: FinishingStatus) => {
        const cur = (item.finishing_status || "belum") as FinishingStatus;
        if (cur === status) { executeUncheck(item); return; }
        if (cur !== "belum") {
            setConfirmPayload({ item, fromStatus: cur, toStatus: status });
            return;
        }
        executeCheck(item, status);
    }, [executeCheck, executeUncheck]);

    /* ── Row background by status ── */
    function rowBg(status: FinishingStatus) {
        if (status === "repair") return "#FFF1F2";
        if (status === "warna")  return "#EFF6FF";
        if (status === "gudang") return "#F0FFF4";
        return "white";
    }

    const selectStyle: React.CSSProperties = {
        border: "1.5px solid #E8DDD0", borderRadius: 8, padding: "6px 10px",
        fontSize: 12, color: "#5C4033", background: "#FAFAF8",
        height: 32, fontWeight: 600, outline: "none",
    };

    /* ── Render ── */
    if (operatorMode && selectedSesi) {
        return (
            <OperatorMode
                sesi={selectedSesi}
                onExit={isFinishingRole ? undefined : () => setOperatorMode(false)}
            />
        );
    }

    return (
        <div style={{ display: "flex", flex: 1, overflow: "hidden", background: "#F8F4EF" }}>

            {/* ── LEFT SIDEBAR: Sesi List ── */}
            <div style={{
                width: 300, minWidth: 260, maxWidth: 340,
                background: "white", borderRight: "1px solid #E8DDD0",
                display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0,
            }}>
                {/* Filter */}
                <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#5C4033", marginBottom: 10, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                        Sesi PO Finishing
                    </div>
                    <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                        <select value={month} onChange={e => setMonth(+e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                            {ML.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                        </select>
                        <select value={year} onChange={e => setYear(+e.target.value)} style={{ ...selectStyle, width: 72 }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    {/* Search */}
                    <div style={{ position: "relative" }}>
                        <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.35 }}
                            width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#5C4033" strokeWidth="2.5">
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Cari operator, customer..."
                            style={{ ...selectStyle, width: "100%", paddingLeft: 28, height: 30, boxSizing: "border-box" }}
                        />
                    </div>
                </div>

                {/* Sesi list */}
                <div style={{ flex: 1, overflowY: "auto" }}>
                    {filteredSesi.length === 0 ? (
                        <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#C5A882" }}>
                            <div style={{ fontSize: 28, marginBottom: 8 }}>📋</div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "#8A6D55" }}>Belum ada sesi PO</div>
                            <div style={{ fontSize: 11, marginTop: 4 }}>untuk bulan ini</div>
                        </div>
                    ) : filteredSesi.map(s => {
                        const isActive = s.key === selectedKey;
                        const totalQty = s.rows.reduce((a, r) => a + parseQty(r.qty), 0);
                        return (
                            <div key={s.key} onClick={() => setSelectedKey(s.key)}
                                style={{
                                    padding: "12px 14px", borderBottom: "1px solid #F5F0EC",
                                    cursor: "pointer", transition: "background 0.15s",
                                    background: isActive ? "#FEF3E8" : "white",
                                    borderLeft: `3px solid ${isActive ? "#A67B5B" : "transparent"}`,
                                }}
                                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#FAFAF8"; }}
                                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "white"; }}
                            >
                                <div style={{ fontSize: 10, color: "#B89678", fontWeight: 700, marginBottom: 2 }}>
                                    {fmtDateFull(s.printedAt.slice(0, 10))} {fmtTime(s.printedAt)}
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#3C2F2F", marginBottom: 4 }}>
                                    {s.poLabel}
                                </div>
                                <div style={{ fontSize: 11, color: "#8A7B6E", marginBottom: 6 }}>
                                    {s.rows.length} item · Qty {totalQty % 1 === 0 ? totalQty : totalQty.toFixed(1)}
                                </div>
                                {/* Progress bar */}
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                    <div style={{ flex: 1, height: 5, background: "#F0E6D8", borderRadius: 99, overflow: "hidden" }}>
                                        <div style={{
                                            height: "100%", borderRadius: 99,
                                            background: s.progress === 100 ? "#15803D" : "#A67B5B",
                                            width: `${s.progress}%`,
                                            transition: "width 0.3s ease",
                                        }} />
                                    </div>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: s.progress === 100 ? "#15803D" : "#A67B5B", minWidth: 30 }}>
                                        {s.progress}%
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── RIGHT PANEL: Detail Sesi ── */}
            {!selectedSesi ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#C5A882" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#8A6D55" }}>Pilih sesi PO dari sidebar</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>untuk melihat daftar item finishing</div>
                </div>
            ) : (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {/* Header detail */}
                    <div style={{ padding: "12px 18px", background: "white", borderBottom: "1px solid #F0E6D8", flexShrink: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F" }}>{selectedSesi.poLabel}</div>
                                <div style={{ fontSize: 11, color: "#B89678", marginTop: 2 }}>
                                    {fmtDateFull(selectedSesi.printedAt.slice(0, 10))} {fmtTime(selectedSesi.printedAt)}
                                    {stats.operators.length > 0 && ` · Operator: ${stats.operators.join(", ")}`}
                                </div>
                            </div>
                            {!isFinishingRole && (
                                <button
                                    onClick={() => setOperatorMode(true)}
                                    style={{
                                        padding: "8px 18px", borderRadius: 8, border: "none",
                                        background: "linear-gradient(135deg, #5C4033, #7C5A3C)",
                                        color: "white", fontSize: 12, fontWeight: 700,
                                        cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                                        boxShadow: "0 2px 8px rgba(92,64,51,0.25)",
                                    }}
                                >
                                    Mode Operator ▶
                                </button>
                            )}
                        </div>

                        {/* Stats cards */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginTop: 12 }}>
                            {[
                                { label: "Total", val: stats.total, color: "#3C2F2F", bg: "#F8F4EF" },
                                { label: "Belum", val: stats.belum, color: "#6B7280", bg: "#F3F4F6" },
                                { label: "Repair", val: stats.repair, color: "#BE123C", bg: "#FFF1F2" },
                                { label: "Warna",  val: stats.warna,  color: "#1D4ED8", bg: "#EFF6FF" },
                                { label: "Gudang", val: stats.gudang, color: "#15803D", bg: "#F0FFF4" },
                            ].map(c => (
                                <div key={c.label} style={{
                                    background: c.bg, borderRadius: 8,
                                    padding: "8px 10px", textAlign: "center",
                                }}>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: c.color }}>{c.val}</div>
                                    <div style={{ fontSize: 10, color: "#8A7B6E", fontWeight: 600 }}>{c.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Table */}
                    <div style={{ flex: 1, overflow: "auto" }}>
                        {selectedSesi.rows.length === 0 ? (
                            <div style={{ padding: "3rem 1rem", textAlign: "center", color: "#C5A882" }}>
                                <div style={{ fontSize: 12, fontWeight: 700 }}>Tidak ada item di sesi ini</div>
                            </div>
                        ) : (
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                <thead>
                                    <tr style={{ background: "#FAF7F3", position: "sticky", top: 0, zIndex: 2 }}>
                                        {["NO", "CUSTOMER", "DESKRIPSI", "UK", "QTY", "REPAIR", "WARNA", "GUDANG", "WAKTU", "OPERATOR"].map(h => (
                                            <th key={h} style={{
                                                padding: "10px 12px", textAlign: h === "NO" ? "center" : "left",
                                                fontSize: 10, fontWeight: 800, color: "#8A6D55",
                                                letterSpacing: "0.08em", textTransform: "uppercase",
                                                borderBottom: "1.5px solid #E8DDD0", whiteSpace: "nowrap",
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedSesi.rows.map((item, idx) => {
                                        const cur = (item.finishing_status || "belum") as FinishingStatus;
                                        const bg = rowBg(cur);
                                        return (
                                            <tr key={item.id} style={{
                                                background: bg,
                                                borderBottom: "1px solid #F0E6D8",
                                                transition: "background 0.2s",
                                            }}>
                                                <td style={{ padding: "10px 12px", textAlign: "center", color: "#8A7B6E", fontWeight: 700 }}>
                                                    {idx + 1}
                                                </td>
                                                <td style={{ padding: "10px 12px", fontWeight: 700, color: "#3C2F2F", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {item.customer || "—"}
                                                </td>
                                                <td style={{ padding: "10px 12px", color: "#5C4033", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {item.deskripsi || "—"}
                                                </td>
                                                <td style={{ padding: "10px 12px", color: "#8A7B6E", whiteSpace: "nowrap" }}>
                                                    {item.ukuran || "—"}
                                                </td>
                                                <td style={{ padding: "10px 12px", color: "#3C2F2F", fontWeight: 700, whiteSpace: "nowrap" }}>
                                                    {item.qty || "—"}
                                                </td>

                                                {/* 3 checkbox columns */}
                                                {(["repair", "warna", "gudang"] as FinishingStatus[]).map(s => {
                                                    const isChecked = cur === s;
                                                    const m = STATUS_META[s];
                                                    return (
                                                        <td key={s} style={{ padding: "10px 12px", textAlign: "center" }}>
                                                            <button
                                                                onClick={() => handleCheck(item, s)}
                                                                title={isChecked ? `Klik untuk reset dari ${m.label}` : `Tandai ${m.label}`}
                                                                style={{
                                                                    width: 28, height: 28, borderRadius: 6, cursor: "pointer",
                                                                    border: `2px solid ${isChecked ? m.color : "#D1D5DB"}`,
                                                                    background: isChecked ? m.color : "white",
                                                                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                                                                    transition: "all 0.15s", flexShrink: 0,
                                                                }}
                                                            >
                                                                {isChecked && (
                                                                    <svg width={13} height={13} viewBox="0 0 24 24" fill="none"
                                                                        stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                        <polyline points="20 6 9 17 4 12" />
                                                                    </svg>
                                                                )}
                                                            </button>
                                                        </td>
                                                    );
                                                })}

                                                <td style={{ padding: "10px 12px", color: "#8A7B6E", whiteSpace: "nowrap", fontSize: 11 }}>
                                                    {item.finishing_at ? fmtTimestamp(item.finishing_at) : "—"}
                                                </td>
                                                <td style={{ padding: "10px 12px", color: "#5C4033", fontWeight: 600, whiteSpace: "nowrap" }}>
                                                    {item.finishing_operator || "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                {/* Footer summary */}
                                <tfoot>
                                    <tr style={{ background: "#FAF7F3", borderTop: "2px solid #E8DDD0" }}>
                                        <td colSpan={5} style={{ padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#5C4033" }}>
                                            Total: {stats.total} item · Selesai: {stats.done} ({stats.total ? Math.round((stats.done / stats.total) * 100) : 0}%)
                                        </td>
                                        <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 800, color: STATUS_META.repair.color }}>
                                            {stats.repair}
                                        </td>
                                        <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 800, color: STATUS_META.warna.color }}>
                                            {stats.warna}
                                        </td>
                                        <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 11, fontWeight: 800, color: STATUS_META.gudang.color }}>
                                            {stats.gudang}
                                        </td>
                                        <td colSpan={2} style={{ padding: "10px 12px", fontSize: 11, color: "#B89678" }}>
                                            {stats.repairPct > 0 ? `Repair rate: ${stats.repairPct}%` : ""}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Confirm modal */}
            {confirmPayload && (
                <ConfirmModal
                    payload={confirmPayload}
                    onConfirm={() => { executeCheck(confirmPayload.item, confirmPayload.toStatus); setConfirmPayload(null); }}
                    onCancel={() => setConfirmPayload(null)}
                />
            )}

            {/* Toasts */}
            <div style={{ position: "fixed", top: 24, right: 24, display: "flex", flexDirection: "column", gap: 8, zIndex: 20000 }}>
                {toasts.map(t => (
                    <div key={t.id} style={{
                        padding: "10px 18px", borderRadius: 10,
                        background: t.color, color: "white",
                        fontSize: 13, fontWeight: 700,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                    }}>{t.text}</div>
                ))}
            </div>
        </div>
    );
}
