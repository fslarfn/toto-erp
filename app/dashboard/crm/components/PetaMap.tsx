"use client";
// Peta Leaflet utk tab Peta Wilayah (Tahap 6). Komponen ini HANYA di-load
// client-side (dynamic import ssr:false dari TabPeta) karena Leaflet
// menyentuh window/document saat init.
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { RegionAgg, RegionTag } from "@/lib/crm-analytics";
import { formatCurrency } from "@/lib/utils";

export const TAG_META: Record<RegionTag, { color: string; label: string }> = {
    strong: { color: "#8B6A44", label: "Basis kuat" },
    potential: { color: "#C99A3A", label: "Potensi tinggi" },
    untapped: { color: "#5E7A52", label: "Belum tergarap" },
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

interface Props {
    regions: RegionAgg[];                    // hanya kota yang punya koordinat
    metric: "count" | "value";
    onAudience: (kota: string) => void;      // klik "+ Buat audiens iklan" di popup
    onReady?: (map: L.Map) => void;          // panel kanan pakai ini utk flyTo
}

export default function PetaMap({ regions, metric, onAudience, onReady }: Props) {
    const divRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);
    const layerRef = useRef<L.LayerGroup | null>(null);
    const fittedRef = useRef(false);
    // Simpan callback di ref agar listener popup selalu memanggil versi terbaru.
    const onAudienceRef = useRef(onAudience);
    onAudienceRef.current = onAudience;

    // Init peta — sekali.
    useEffect(() => {
        if (!divRef.current || mapRef.current) return;
        const map = L.map(divRef.current, { scrollWheelZoom: false, minZoom: 3 })
            .setView([-2.5, 118], 5); // Indonesia utuh
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
            subdomains: "abcd",
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        }).addTo(map);
        layerRef.current = L.layerGroup().addTo(map);
        // Tombol audiens di dalam popup (HTML string) → pasang handler saat popup terbuka.
        map.on("popupopen", (e: L.PopupEvent) => {
            const btn = e.popup.getElement()?.querySelector<HTMLElement>("[data-kota]");
            if (btn) btn.addEventListener("click", () => onAudienceRef.current(btn.dataset.kota ?? ""), { once: true });
        });
        mapRef.current = map;
        onReady?.(map);
        return () => { map.remove(); mapRef.current = null; layerRef.current = null; fittedRef.current = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Gambar bubble — tiap regions/metric berubah.
    useEffect(() => {
        const map = mapRef.current, layer = layerRef.current;
        if (!map || !layer) return;
        layer.clearLayers();
        if (!regions.length) return;
        const max = Math.max(...regions.map((r) => (metric === "count" ? r.count : r.total)), 1);
        for (const r of regions) {
            if (r.lat == null || r.lng == null) continue;
            const v = (metric === "count" ? r.count : r.total) / max;
            const tag = TAG_META[r.tag];
            const m = L.circleMarker([r.lat, r.lng], {
                radius: 9 + Math.sqrt(v) * 28,
                color: "#fff", weight: 1.5,
                fillColor: tag.color, fillOpacity: 0.82,
            }).addTo(layer);
            m.bindTooltip(`${r.kota} · ${r.count.toLocaleString("id-ID")} customer`, { direction: "top" });
            m.bindPopup(
                `<div style="font-size:12.5px;min-width:180px">`
                + `<b style="font-size:14px">${esc(r.kota)}</b>`
                + `<div style="color:#7A6349;margin-top:5px">${r.count.toLocaleString("id-ID")} customer · ${tag.label}</div>`
                + `<div style="color:#7A6349">Total order: ${formatCurrency(r.total)}</div>`
                + `<div style="color:#7A6349">Rata-rata/customer: ${formatCurrency(r.avg)}</div>`
                + `<button data-kota="${esc(r.kota)}" style="margin-top:8px;border:1px solid #D9B96A;background:#FBF3E1;color:#7A5E1E;font-weight:600;font-size:12px;border-radius:7px;padding:4px 10px;cursor:pointer">＋ Buat audiens iklan</button>`
                + `</div>`
            );
        }
        // fitBounds sekali saat titik pertama tersedia — peta tetap bisa
        // di-zoom-out melihat seluruh Indonesia.
        if (!fittedRef.current) {
            const pts = regions.filter((r) => r.lat != null && r.lng != null).map((r) => [r.lat!, r.lng!] as [number, number]);
            if (pts.length) {
                map.fitBounds(L.latLngBounds(pts), { padding: [45, 45], maxZoom: 10 });
                fittedRef.current = true;
            }
        }
    }, [regions, metric]);

    return <div ref={divRef} style={{ height: 520, width: "100%", background: "#DCE6EA" }} />;
}
