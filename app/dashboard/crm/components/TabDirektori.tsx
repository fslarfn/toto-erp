"use client";
// Tab Direktori (Tahap 4) — sesuai mockup TotoCRMUnified:
// KPI klik-filter, banner duplikat, titik status Aktif/Dormant, badge tier,
// kolom Wilayah & Marketing, tombol "Lengkapi" utk WA kosong.
import { useState, useMemo } from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import type { Customer } from "@/types";
import {
    directoryKpi, findDuplicateGroups, marketerById,
    DORMANT_DAYS, TIER_A_MIN, TIER_B_MIN,
    type EnrichedCustomer, type Tier,
} from "@/lib/crm-analytics";
import { waGreeting, waLink } from "@/lib/crm-wa";
import { formatCurrency } from "@/lib/utils";
import { usePaged, PageNav } from "@/components/layout/PageNav";
import { typeMeta, inputSt } from "./shared";
import MergeDuplikat from "./MergeDuplikat";

/* Meta tier — label singkat utk tooltip. Dipakai juga CustomerDrawer. */
export const TIER_META: Record<Tier, { c: string; l: string }> = {
    A: { c: "#8B6A44", l: `Prioritas (≥ ${formatCurrency(TIER_A_MIN)})` },
    B: { c: "#7A8A5A", l: `Menengah (≥ ${formatCurrency(TIER_B_MIN)})` },
    C: { c: "#A79B85", l: "Kecil" },
};

export function StatusDot({ dormant, hasOrder }: { dormant: boolean; hasOrder: boolean }) {
    const color = !hasOrder ? "#C5C0B5" : dormant ? "#C99A3A" : "#15803D";
    const title = !hasOrder ? "Belum ada order" : dormant ? `Dormant (≥ ${DORMANT_DAYS} hari tidak order)` : "Aktif";
    return <span title={title} style={{ width: 8, height: 8, borderRadius: 99, background: color, display: "inline-block", flexShrink: 0 }} />;
}

export function TierBadge({ t }: { t: Tier }) {
    return <span title={`Tier ${t} · ${TIER_META[t].l}`} style={{ fontSize: 9.5, fontWeight: 700, color: "#fff", background: TIER_META[t].c, borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>{t}</span>;
}

type FilterKey = "semua" | "proyek" | "retail" | "piutang" | "dormant" | "nowa";
const FILTER_OPTS: [FilterKey, string][] = [
    ["semua", "Semua"], ["proyek", "Proyek"], ["retail", "Retail"],
    ["piutang", "Ada piutang"], ["dormant", "Dormant"], ["nowa", "Tanpa WA"],
];

interface Props {
    enriched: EnrichedCustomer[];
    loading: boolean;
    onDetail: (c: Customer) => void;
    onEdit: (c: Customer) => void;
    onDelete: (c: Customer) => void;
    showToast: (m: string) => void;
}

export default function TabDirektori({ enriched, loading, onDetail, onEdit, onDelete, showToast }: Props) {
    const [filter, setFilter] = useState<FilterKey>("semua");
    const [search, setSearch] = useState("");
    const [showMerge, setShowMerge] = useState(false);

    const kpi = useMemo(() => directoryKpi(enriched), [enriched]);

    // Kandidat duplikat (nama mirip / WA sama) — utk banner + highlight baris.
    const dupGroups = useMemo(() => {
        const byId = new Map(enriched.map((e) => [e.c.id, e]));
        return findDuplicateGroups(enriched.map((e) => e.c))
            .map((g) => g.map((c) => byId.get(c.id)!).filter(Boolean));
    }, [enriched]);
    const dupIds = useMemo(() => new Set(dupGroups.flat().map((e) => e.c.id)), [dupGroups]);

    const filtered = useMemo(() => {
        let list = enriched;
        switch (filter) {
            case "proyek": list = list.filter((e) => e.c.type === "proyek"); break;
            case "retail": list = list.filter((e) => e.c.type === "retail"); break;
            case "piutang": list = list.filter((e) => e.stat.unpaid > 0); break;
            case "dormant": list = list.filter((e) => e.dormant); break;
            case "nowa": list = list.filter((e) => !e.c.phone.trim()); break;
        }
        const q = search.toLowerCase().trim();
        if (q) list = list.filter((e) => [e.c.name, e.c.phone, e.c.pic, e.c.address, e.c.kota ?? ""].join(" ").toLowerCase().includes(q));
        return list;
    }, [enriched, search, filter]);

    // Render dipotong per halaman — 2 ribu+ customer jangan masuk DOM sekaligus.
    const { paged, page, setPage, totalPages } = usePaged(filtered, 50);

    const kpiCard = (label: string, value: string, sub: string, key: FilterKey, color?: string) => {
        const active = filter === key;
        return (
            <button onClick={() => setFilter(active ? "semua" : key)} className="stat-card"
                style={{ textAlign: "left", cursor: "pointer", border: active ? "2px solid #A67B5B" : "2px solid transparent", boxShadow: active ? "0 0 0 3px rgba(166,123,91,0.12)" : undefined, transition: "all .15s" }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>{label}{active ? " • aktif" : ""}</div>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: color ?? "var(--text-dark)" }}>{value}</div>
                <div style={{ fontSize: 10.5, color: "#C5A882", marginTop: 2 }}>{sub}</div>
            </button>
        );
    };

    return (
        <>
            {/* KPI — klik untuk memfilter tabel */}
            <div className="rgrid rgrid-4" style={{ gap: "0.875rem" }}>
                {kpiCard("Total Customer", String(kpi.total), "klik kartu lain utk filter", "semua")}
                {kpiCard("Nilai Piutang Berjalan", formatCurrency(kpi.piutangTotal), `${kpi.piutangCount} customer menunggak`, "piutang", "#B91C1C")}
                {kpiCard("Cakupan No. WA", `${kpi.withWa}/${kpi.total}`, "klik utk lihat yang kosong", "nowa", "#15803D")}
                {kpiCard("Perlu Re-engagement", String(kpi.dormantCount), `belum order ${DORMANT_DAYS}+ hari`, "dormant", "#A16207")}
            </div>

            {/* Banner deteksi duplikat */}
            {dupGroups.length > 0 && (
                <div style={{ background: "#FBF4E6", border: "1px solid #EAD9B4", borderRadius: 10, padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                    <AlertTriangle size={17} color="#B8860B" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: 12.5, color: "#7A5E1E", flex: 1, minWidth: 220 }}>
                        <strong>{dupGroups.length} grup kemungkinan duplikat</strong> — nama mirip atau No. WA sama. Baris terkait ditandai kuning.
                    </span>
                    <button onClick={() => setShowMerge(true)} className="btn btn-secondary" style={{ fontSize: 12, borderColor: "#D9B96A", color: "#7A5E1E" }}>🔀 Tinjau & gabungkan</button>
                </div>
            )}

            {/* Tabel */}
            <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        Daftar Customer ({filtered.length})
                        {FILTER_OPTS.map(([k, l]) => (
                            <button key={k} onClick={() => setFilter(k)}
                                style={{ fontSize: 11.5, fontWeight: 600, cursor: "pointer", padding: "4px 11px", borderRadius: 99, border: `1px solid ${filter === k ? "#A67B5B" : "#E8DDD0"}`, background: filter === k ? "#F1E7D5" : "#fff", color: filter === k ? "#A67B5B" : "#8A7B6E" }}>{l}</button>
                        ))}
                    </span>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Cari nama / WA / PIC / kota..." style={{ ...inputSt, width: 250 }} />
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nama</th><th>Tipe</th><th>No. WA</th><th>Wilayah</th><th>Marketing</th>
                                <th style={{ textAlign: "right" }}>Total</th>
                                <th style={{ textAlign: "right" }}>Piutang</th>
                                <th style={{ width: 150, textAlign: "center" }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#B89678" }}>Memuat…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={8} style={{ textAlign: "center", padding: 30, color: "#B89678" }}>Tidak ada customer utk filter ini.</td></tr>
                            ) : paged.map((e) => {
                                const c = e.c;
                                const tm = typeMeta(c.type);
                                const mk = marketerById(c.marketingId ?? "");
                                const wa = waLink(c.phone, waGreeting(c.name, c.pic));
                                return (
                                    <tr key={c.id} style={dupIds.has(c.id) ? { background: "#FCF7EC" } : undefined}>
                                        <td style={{ fontWeight: 600, color: "#3C2F2F" }}>
                                            <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                                                <StatusDot dormant={e.dormant} hasOrder={!!e.stat.last} />
                                                <button onClick={() => onDetail(c)} style={{ background: "none", border: "none", padding: 0, color: "#A67B5B", fontWeight: 700, cursor: "pointer", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</button>
                                                <TierBadge t={e.tier} />
                                            </span>
                                            {c.pic && <div style={{ fontSize: 11, color: "#8A7B6E", marginLeft: 15 }}>{c.pic}</div>}
                                        </td>
                                        <td><span className="badge" style={{ background: tm.color + "1A", color: tm.color, fontSize: 10 }}>{tm.label}</span></td>
                                        <td>
                                            {c.phone.trim() ? (
                                                wa ? <a href={wa} target="_blank" rel="noreferrer" style={{ color: "#15803D", fontWeight: 600, textDecoration: "none" }}>💬 {c.phone}</a> : c.phone
                                            ) : (
                                                <button onClick={() => onEdit(c)} title="Isi No. WA customer ini"
                                                    style={{ fontSize: 11, fontWeight: 600, color: "#B8860B", background: "#FBF3E1", border: "1px dashed #D9B96A", borderRadius: 7, padding: "3px 9px", cursor: "pointer" }}>📵 Lengkapi</button>
                                            )}
                                        </td>
                                        <td style={{ fontSize: 12, color: "#5C4033" }}>
                                            {(c.kota ?? "").trim() ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{c.kota}</span> : <span style={{ color: "#C5A882" }}>—</span>}
                                        </td>
                                        <td style={{ fontSize: 12 }}>
                                            {mk ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: mk.color, flexShrink: 0 }} />{mk.name}</span> : <span style={{ color: "#C5A882" }}>—</span>}
                                        </td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>{e.stat.total > 0 ? formatCurrency(e.stat.total) : "—"}</td>
                                        <td style={{ textAlign: "right", fontWeight: 700, color: e.stat.unpaid > 0 ? "#B91C1C" : "#15803D" }}>{e.stat.unpaid > 0 ? formatCurrency(e.stat.unpaid) : "—"}</td>
                                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                            <button onClick={() => onDetail(c)} className="btn btn-ghost" style={{ color: "#4B5563", padding: 4 }} title="Detail 360">👁️</button>
                                            <button onClick={() => onEdit(c)} className="btn btn-ghost" style={{ color: "#A67B5B", padding: 4 }} title="Edit">✏️</button>
                                            <button onClick={() => onDelete(c)} className="btn btn-ghost" style={{ color: "#ef4444", padding: 4 }} title="Hapus">🗑️</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <PageNav page={page} totalPages={totalPages} setPage={setPage} total={filtered.length} label="customer" />
                </div>
            </div>

            {showMerge && <MergeDuplikat groups={dupGroups} onClose={() => setShowMerge(false)} showToast={showToast} />}
        </>
    );
}
