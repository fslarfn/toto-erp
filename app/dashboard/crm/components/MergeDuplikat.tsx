"use client";
// Modal "Tinjau & gabungkan" kandidat duplikat.
// Merge TIDAK otomatis: user memilih entri mana saja yang ikut digabung
// (checkbox) + entri utama per grup (radio), lalu konfirmasi.
// Order dipindahkan ke entri utama; tidak ada data pesanan yang dihapus.
import { useMemo, useState } from "react";
import type { Customer } from "@/types";
import type { EnrichedCustomer, DupReason } from "@/lib/crm-analytics";
import { mergeCustomers } from "@/lib/crm-merge";
import { formatCurrency } from "@/lib/utils";
import { usePaged, PageNav } from "@/components/layout/PageNav";
import { inputSt } from "./shared";

export interface SimilarGroupUI {
    reason: DupReason;
    entries: EnrichedCustomer[];
}

const REASON_META: Record<DupReason, { label: string; bg: string; fg: string; hint: string }> = {
    identik: { label: "IDENTIK", bg: "#DCFCE7", fg: "#15803D", hint: "Nama/No. WA sama persis — aman digabung." },
    keterangan: { label: "KETERANGAN ORDER", bg: "#FEF3C7", fg: "#A16207", hint: "Nama + catatan order (PO/URGENT/TGL…) — hampir pasti customer yang sama." },
    mirip: { label: "NAMA MIRIP — CEK DULU", bg: "#FFE4D1", fg: "#C2410C", hint: "Nama pendek vs panjang — BISA beda orang. Centang hanya yang yakin sama." },
};

type ReasonFilter = "semua" | DupReason;

interface Props {
    groups: SimilarGroupUI[];
    onClose: () => void;
    showToast: (m: string) => void;
}

export default function MergeDuplikat({ groups, onClose, showToast }: Props) {
    const [filter, setFilter] = useState<ReasonFilter>("semua");
    const [search, setSearch] = useState("");
    // Kunci state per grup = gabungan id anggota (stabil walau urutan/paging berubah).
    const keyOf = (g: SimilarGroupUI) => g.entries.map((e) => e.c.id).sort().join("-");

    // Pilihan entri utama per grup — default: nilai order historis terbesar.
    const [primaryIds, setPrimaryIds] = useState<Record<string, string>>({});
    const primaryOf = (g: SimilarGroupUI): string => {
        const k = keyOf(g);
        if (primaryIds[k]) return primaryIds[k];
        const top = g.entries.reduce((best, e) => (e.stat.total > best.stat.total ? e : best), g.entries[0]);
        return top.c.id;
    };

    // Centang keikutsertaan per entri. Default: identik/keterangan semua ikut;
    // grup "mirip" hanya entri utama (anggota lain wajib dicentang manual).
    const [included, setIncluded] = useState<Record<string, Set<string>>>({});
    const includedOf = (g: SimilarGroupUI): Set<string> => {
        const k = keyOf(g);
        if (included[k]) return included[k];
        return g.reason === "mirip"
            ? new Set([primaryOf(g)])
            : new Set(g.entries.map((e) => e.c.id));
    };
    const toggleInclude = (g: SimilarGroupUI, id: string) => {
        const k = keyOf(g);
        const cur = new Set(includedOf(g));
        if (cur.has(id)) cur.delete(id); else cur.add(id);
        setIncluded((p) => ({ ...p, [k]: cur }));
        // entri utama harus selalu ikut — pindahkan bila di-uncheck
        if (!cur.has(primaryOf(g))) {
            const first = g.entries.find((e) => cur.has(e.c.id));
            if (first) setPrimaryIds((p) => ({ ...p, [k]: first.c.id }));
        }
    };

    const [busyKey, setBusyKey] = useState<string | null>(null);

    const filtered = useMemo(() => {
        let list = groups;
        if (filter !== "semua") list = list.filter((g) => g.reason === filter);
        const q = search.toLowerCase().trim();
        if (q) list = list.filter((g) => g.entries.some((e) => e.c.name.toLowerCase().includes(q)));
        return list;
    }, [groups, filter, search]);
    const { paged, page, setPage, totalPages } = usePaged(filtered, 15);

    const counts = useMemo(() => {
        const c: Record<ReasonFilter, number> = { semua: groups.length, identik: 0, keterangan: 0, mirip: 0 };
        groups.forEach((g) => { c[g.reason]++; });
        return c;
    }, [groups]);

    const handleMerge = async (g: SimilarGroupUI) => {
        const k = keyOf(g);
        const inc = includedOf(g);
        const primary = g.entries.find((e) => e.c.id === primaryOf(g))?.c as Customer | undefined;
        if (!primary || !inc.has(primary.id)) return;
        const others = g.entries.filter((e) => inc.has(e.c.id) && e.c.id !== primary.id).map((e) => e.c);
        if (others.length === 0) return;
        const ok = confirm(
            `Gabungkan ${others.length} entri ke "${primary.name}"?\n\n`
            + `• Semua order atas nama: ${others.map((o) => `"${o.name}"`).join(", ")} dipindahkan ke "${primary.name}".\n`
            + `• Data pesanan TIDAK ada yang dihapus.\n`
            + `• Entri duplikat dihapus dari master customer.\n\n`
            + `Lanjutkan?`
        );
        if (!ok) return;
        setBusyKey(k);
        try {
            const res = await mergeCustomers(primary, others);
            showToast(`✅ Digabung ke "${primary.name}" — ${res.movedRows} baris order dipindahkan, ${res.deletedMasters} entri master dihapus`);
        } catch (err: unknown) {
            alert("Gagal menggabungkan: " + (err instanceof Error ? err.message : ""));
        } finally { setBusyKey(null); }
    };

    const FILTER_OPTS: [ReasonFilter, string][] = [
        ["semua", "Semua"], ["identik", "Identik"], ["keterangan", "Ket. order"], ["mirip", "Nama mirip"],
    ];

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", display: "flex", flexDirection: "column", border: "1px solid #E6D5BE", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "12px 12px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#5C4033" }}>🔀 Tinjau & Gabungkan Duplikat ({groups.length} grup)</span>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#B89678" }}>×</button>
                </div>

                {/* Filter alasan + pencarian */}
                <div style={{ padding: "10px 20px", borderBottom: "1px solid #F3EADB", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {FILTER_OPTS.map(([kf, l]) => (
                        <button key={kf} onClick={() => { setFilter(kf); setPage(1); }}
                            style={{ fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 11px", borderRadius: 99, border: `1px solid ${filter === kf ? "#A67B5B" : "#E8DDD0"}`, background: filter === kf ? "#F1E7D5" : "#fff", color: filter === kf ? "#A67B5B" : "#8A7B6E" }}>
                            {l} ({counts[kf]})
                        </button>
                    ))}
                    <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="🔍 Cari nama…" style={{ ...inputSt, width: 180, marginLeft: "auto" }} />
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    <p style={{ fontSize: 12.5, color: "#8A7B6E", margin: "0 0 14px", lineHeight: 1.55 }}>
                        Centang entri yang mau digabung, pilih <strong>entri utama</strong> (order entri lain dipindahkan ke sana), lalu klik Gabungkan.
                        Tidak ada data pesanan yang dihapus. Grup <strong style={{ color: "#C2410C" }}>Nama mirip</strong> bisa saja berisi orang berbeda — gabungkan hanya yang Anda yakin sama.
                    </p>
                    {filtered.length === 0 && (
                        <div style={{ textAlign: "center", padding: 24, color: "#15803D", fontSize: 13 }}>🎉 Tidak ada kandidat duplikat untuk filter ini.</div>
                    )}
                    {paged.map((g) => {
                        const k = keyOf(g);
                        const inc = includedOf(g);
                        const primaryId = primaryOf(g);
                        const rm = REASON_META[g.reason];
                        const canMerge = inc.size >= 2 && inc.has(primaryId);
                        return (
                            <div key={k} style={{ border: "1px solid #E8DDD0", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
                                <div style={{ padding: "8px 14px", background: "#FBF4E6", fontSize: 11, fontWeight: 700, color: "#7A5E1E", letterSpacing: 0.4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <span>{g.entries.length} ENTRI</span>
                                    <span title={rm.hint} style={{ fontSize: 9.5, fontWeight: 800, background: rm.bg, color: rm.fg, borderRadius: 99, padding: "2px 8px" }}>{rm.label}</span>
                                    <span style={{ fontWeight: 500, color: "#A79B85", fontSize: 10.5 }}>{rm.hint}</span>
                                </div>
                                {g.entries.map((e) => {
                                    const isIncluded = inc.has(e.c.id);
                                    const isPrimary = primaryId === e.c.id && isIncluded;
                                    return (
                                        <div key={e.c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid #F3EADB", background: isPrimary ? "#F8FDF8" : "transparent", opacity: isIncluded ? 1 : 0.55 }}>
                                            <input type="checkbox" checked={isIncluded} onChange={() => toggleInclude(g, e.c.id)} title="Ikut digabung?" style={{ cursor: "pointer" }} />
                                            <input type="radio" name={`primary-${k}`} checked={isPrimary} disabled={!isIncluded}
                                                onChange={() => setPrimaryIds((p) => ({ ...p, [k]: e.c.id }))} title="Jadikan entri utama" style={{ cursor: "pointer" }} />
                                            <span style={{ flex: 1, minWidth: 0 }}>
                                                <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#3C2F2F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {e.c.name} {isPrimary && <span style={{ fontSize: 10, fontWeight: 700, color: "#15803D", background: "#DCFCE7", borderRadius: 99, padding: "1px 7px", marginLeft: 4 }}>UTAMA</span>}
                                                </span>
                                                <span style={{ fontSize: 11, color: "#8A7B6E" }}>
                                                    {e.c.phone ? `📱 ${e.c.phone}` : "tanpa WA"} · {e.stat.count} order · {formatCurrency(e.stat.total)}
                                                    {(e.c.kota ?? "").trim() && <span> · 📍 {e.c.kota}</span>}
                                                    {e.stat.unpaid > 0 && <span style={{ color: "#B91C1C" }}> · piutang {formatCurrency(e.stat.unpaid)}</span>}
                                                </span>
                                            </span>
                                        </div>
                                    );
                                })}
                                <div style={{ padding: "10px 14px", borderTop: "1px solid #F3EADB", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10 }}>
                                    {!canMerge && <span style={{ fontSize: 11, color: "#A79B85" }}>centang minimal 2 entri utk menggabungkan</span>}
                                    <button onClick={() => handleMerge(g)} disabled={busyKey !== null || !canMerge} className="btn btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>
                                        {busyKey === k ? "Menggabungkan…" : `🔀 Gabungkan ${Math.max(inc.size, 0)} entri`}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                    <PageNav page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} label="grup" />
                </div>
                <div style={{ padding: "12px 20px", borderTop: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "0 0 12px 12px", textAlign: "right" }}>
                    <button onClick={onClose} className="btn btn-secondary" style={{ padding: "8px 18px" }}>Tutup</button>
                </div>
            </div>
        </div>
    );
}
