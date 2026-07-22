"use client";
// Tab Peta Wilayah (Tahap 6) — sesuai mockup TotoCRMUnified:
// bubble per kota (toggle jumlah customer ↔ nilai order), panel peringkat
// wilayah + status (Basis kuat / Potensi tinggi / Belum tergarap),
// rekomendasi penargetan iklan, dan ekspor audiens (CSV) utk Meta/Google Ads.
import { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMap } from "leaflet";
import { aggregateRegions, type EnrichedCustomer, type RegionAgg } from "@/lib/crm-analytics";
import type { RegionCoord } from "@/lib/crm-refs";
import { TAG_META } from "./PetaMap";

// Leaflet menyentuh window saat init → wajib client-only (tanpa SSR).
const PetaMap = dynamic(() => import("./PetaMap"), {
    ssr: false,
    loading: () => <div style={{ height: 520, display: "grid", placeItems: "center", background: "#DCE6EA", color: "#5C4033", fontSize: 13 }}>Memuat peta…</div>,
});

const jt = (n: number) => n >= 1e9
    ? "Rp " + (n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " M"
    : "Rp " + (n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";

interface Props {
    enriched: EnrichedCustomer[];
    coords: RegionCoord[];
    showToast: (m: string) => void;
}

export default function TabPeta({ enriched, coords, showToast }: Props) {
    const [metric, setMetric] = useState<"count" | "value">("count");
    const [audience, setAudience] = useState<Set<string>>(new Set());
    const mapRef = useRef<LeafletMap | null>(null);

    const regions = useMemo(() => aggregateRegions(enriched, coords), [enriched, coords]);
    const mapped = useMemo(() => regions.filter((r) => r.lat != null && r.lng != null), [regions]);
    const unmapped = useMemo(() => regions.filter((r) => r.lat == null), [regions]);
    const totalCount = regions.reduce((s, r) => s + r.count, 0);
    const totalValue = regions.reduce((s, r) => s + r.total, 0);
    const noKota = enriched.length - totalCount;

    const sorted = useMemo(
        () => [...regions].sort((a, b) => (metric === "count" ? b.count - a.count : b.total - a.total)),
        [regions, metric]
    );

    // Rekomendasi sederhana dari status wilayah (aturan di crm-analytics).
    const reko = useMemo(() => {
        const names = (tag: RegionAgg["tag"], sortBy: (r: RegionAgg) => number) =>
            regions.filter((r) => r.tag === tag).sort((a, b) => sortBy(b) - sortBy(a)).slice(0, 3).map((r) => r.kota);
        return {
            retensi: names("strong", (r) => r.count),
            akuisisi: names("potential", (r) => r.avg),
            uji: names("untapped", (r) => r.count),
        };
    }, [regions]);

    const toggleAudience = (kota: string) => {
        setAudience((prev) => {
            const next = new Set(prev);
            if (next.has(kota)) { next.delete(kota); showToast(`➖ ${kota} dihapus dari audiens`); }
            else { next.add(kota); showToast(`➕ ${kota} masuk daftar audiens iklan`); }
            return next;
        });
    };

    // Ekspor CSV daftar kota terpilih — utk upload manual ke Meta/Google Ads.
    // TODO: titik integrasi API Meta/Google Ads bila kelak dibutuhkan.
    const exportAudience = () => {
        const rows = regions.filter((r) => audience.has(r.kota));
        if (!rows.length) return;
        const csv = "kota,provinsi,jumlah_customer,total_order\n"
            + rows.map((r) => `"${r.kota.replace(/"/g, '""')}","${r.provinsi.replace(/"/g, '""')}",${r.count},${Math.round(r.total)}`).join("\n");
        const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
        const a = document.createElement("a");
        a.href = url;
        a.download = `audiens-iklan-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`⬇️ ${rows.length} kota diekspor — siap di-upload ke Meta/Google Ads`);
    };

    const flyTo = (r: RegionAgg) => {
        if (r.lat == null || r.lng == null || !mapRef.current) return;
        const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduced) mapRef.current.setView([r.lat, r.lng], 11);
        else mapRef.current.flyTo([r.lat, r.lng], 11, { duration: 0.8 });
    };

    return (
        <>
            {noKota > 0 && (
                <div style={{ background: "#FBF4E6", border: "1px solid #EAD9B4", borderRadius: 10, padding: "10px 16px", fontSize: 12.5, color: "#7A5E1E" }}>
                    ⚠️ <strong>{noKota.toLocaleString("id-ID")} customer belum punya kota</strong> — isi kolom Kota/Wilayah di tab Direktori agar masuk peta.
                </div>
            )}
            <div className="card" style={{ overflow: "hidden" }}>
                <div className="rgrid rgrid-main-side" style={{ gap: 0 }}>
                    {/* Peta + overlay */}
                    <div style={{ position: "relative" }}>
                        <div style={{ position: "absolute", top: 12, right: 12, zIndex: 500, background: "#fff", border: "1px solid #E8DDD0", borderRadius: 10, padding: 4, display: "flex", gap: 3, boxShadow: "0 2px 10px rgba(61,46,30,.1)" }}>
                            {([["count", "Jumlah customer"], ["value", "Nilai order"]] as const).map(([k, l]) => (
                                <button key={k} onClick={() => setMetric(k)}
                                    style={{ fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer", padding: "7px 12px", borderRadius: 7, background: metric === k ? "#F1E7D5" : "transparent", color: metric === k ? "#A67B5B" : "#8A7B6E" }}>{l}</button>
                            ))}
                        </div>
                        <div style={{ position: "absolute", bottom: 14, left: 14, zIndex: 500, background: "#fff", border: "1px solid #E8DDD0", borderRadius: 10, padding: "10px 12px", fontSize: 11.5, boxShadow: "0 2px 10px rgba(61,46,30,.1)" }}>
                            <div style={{ fontWeight: 700, color: "#3C2F2F", marginBottom: 5 }}>Status wilayah</div>
                            {Object.values(TAG_META).map((t) => (
                                <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 7, margin: "3px 0", color: "#7A6349" }}>
                                    <span style={{ width: 11, height: 11, borderRadius: 99, background: t.color }} />{t.label}
                                </div>
                            ))}
                        </div>
                        <PetaMap regions={mapped} metric={metric} onAudience={toggleAudience} onReady={(m) => { mapRef.current = m; }} />
                    </div>

                    {/* Panel kanan */}
                    <div style={{ borderLeft: "1px solid #E8DDD0", padding: "14px 14px 20px", maxHeight: 520, overflowY: "auto" }}>
                        <div style={{ background: "#FBF4E6", border: "1px solid #EAD9B4", borderRadius: 10, padding: "11px 12px", marginBottom: 14 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: "#7A5E1E", marginBottom: 7 }}>Rekomendasi penargetan iklan</div>
                            {([
                                ["📍", "Retensi", reko.retensi, "iklan repeat-order ke basis terkuat"],
                                ["🎯", "Akuisisi", reko.akuisisi, "rata-rata order per customer tertinggi"],
                                ["🌱", "Uji pasar", reko.uji, "masih tipis — layak dites budget kecil"],
                            ] as const).map(([emo, b, list, t]) => (
                                <div key={b} style={{ fontSize: 12, color: "#6E561F", lineHeight: 1.5, margin: "5px 0", display: "flex", gap: 7 }}>
                                    <span>{emo}</span>
                                    <span><b style={{ color: "#5A4212" }}>{b}</b> — {list.length ? list.join(" · ") : "—"} <span style={{ color: "#8A7B6E" }}>({t})</span></span>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: "#3C2F2F" }}>Wilayah</span>
                            <span style={{ fontSize: 11, color: "#8A7B6E" }}>{totalCount.toLocaleString("id-ID")} customer ber-kota · {jt(totalValue)}</span>
                        </div>
                        <div style={{ width: 26, height: 2, background: "#A67B5B", margin: "2px 0 12px" }} />

                        {sorted.length === 0 && (
                            <p style={{ fontSize: 12.5, color: "#8A7B6E", lineHeight: 1.6 }}>
                                Belum ada customer dengan kota terisi. Mulai dari customer terbesar: buka tab Direktori → edit → isi Kota/Wilayah.
                            </p>
                        )}
                        {sorted.map((r) => {
                            const share = metric === "count"
                                ? (totalCount ? r.count / totalCount : 0)
                                : (totalValue ? r.total / totalValue : 0);
                            const t = TAG_META[r.tag];
                            const inAud = audience.has(r.kota);
                            return (
                                <div key={r.kota} style={{ background: "#FDF8F3", border: `1px solid ${inAud ? "#A67B5B" : "#E8DDD0"}`, borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                                        <button onClick={() => flyTo(r)} disabled={r.lat == null}
                                            title={r.lat == null ? "Kota ini belum ada di referensi koordinat (region_coords)" : "Lihat di peta"}
                                            style={{ background: "none", border: "none", padding: 0, cursor: r.lat == null ? "default" : "pointer", fontSize: 13, fontWeight: 700, color: "#3C2F2F", textAlign: "left" }}>
                                            {r.kota}{r.lat == null ? " 🚫🗺️" : ""}
                                        </button>
                                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, color: t.color, background: t.color + "1A", whiteSpace: "nowrap" }}>{t.label}</span>
                                    </div>
                                    <div style={{ fontSize: 11, color: "#8A7B6E", marginTop: 2 }}>{r.count.toLocaleString("id-ID")} customer · {jt(r.total)} · rata² {jt(r.avg)}</div>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                                        <div style={{ flex: 1, height: 6, background: "#EDE5D7", borderRadius: 99, overflow: "hidden" }}>
                                            <i style={{ display: "block", height: "100%", width: `${Math.max(2, Math.round(share * 100))}%`, background: t.color, borderRadius: 99 }} />
                                        </div>
                                        <label style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, color: "#8A7B6E", cursor: "pointer" }}>
                                            <input type="checkbox" checked={inAud} onChange={() => toggleAudience(r.kota)} /> audiens
                                        </label>
                                    </div>
                                </div>
                            );
                        })}

                        {unmapped.length > 0 && (
                            <p style={{ fontSize: 11, color: "#B89678", lineHeight: 1.5, marginTop: 4 }}>
                                🚫🗺️ {unmapped.length} kota belum ada koordinatnya — tambahkan barisnya di tabel <code>region_coords</code> agar tampil di peta.
                            </p>
                        )}

                        <button onClick={exportAudience} disabled={audience.size === 0} className="btn btn-primary"
                            style={{ width: "100%", marginTop: 10, fontSize: 13, opacity: audience.size === 0 ? 0.55 : 1 }}>
                            ⬇️ Ekspor audiens iklan ({audience.size} kota)
                        </button>
                        <p style={{ fontSize: 10.5, color: "#B89678", marginTop: 6, lineHeight: 1.5 }}>
                            CSV berisi kota, provinsi, jumlah customer & total order — siap di-upload sebagai acuan lokasi di Meta/Google Ads.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
