"use client";
// ============================================================
// Tampilan "Per Order" untuk Status Barang.
// Baris pesanan dikelompokkan per invoice (no_inv) → satu kartu per
// order dengan pipeline tahap (Produksi → Warna → Siap → Kirim → Bayar)
// yang bisa dicentang langsung untuk SEMUA item sekaligus (auto-save).
// Detail line item bisa di-expand. Meniru pola pipeline Order Alucurv,
// dengan identitas warna Toto (coklat/cream).
//
// Tampilan flat lama TIDAK dihapus — ini mode tambahan (toggle).
// ============================================================
import { useMemo, useState, useRef, useEffect } from "react";
import { PesananRow } from "@/lib/pesanan-store";
import { pesananRowTotal } from "@/lib/piutang";

type StageKey = "di_produksi" | "di_warna" | "siap_kirim" | "di_kirim";
const STAGES: { key: StageKey; label: string }[] = [
    { key: "di_produksi", label: "Produksi" },
    { key: "di_warna", label: "Warna" },
    { key: "siap_kirim", label: "Siap" },
    { key: "di_kirim", label: "Kirim" },
];
// Urutan tahap untuk cascade (di atas = lebih awal).
const ORDER: StageKey[] = ["di_produksi", "di_warna", "siap_kirim", "di_kirim"];

/** Patch satu baris untuk perubahan satu tahap, dengan cascade maju/mundur.
 *  Mengembalikan null bila tidak ada yang berubah (hemat request). */
function buildStagePatch(row: PesananRow, key: StageKey, checked: boolean): Partial<PesananRow> | null {
    const idx = ORDER.indexOf(key);
    const target: Partial<PesananRow> = {};
    if (checked) {
        // Maju: tahap ini + semua tahap sebelumnya ikut tercentang.
        for (let i = 0; i <= idx; i++) target[ORDER[i]] = true;
    } else {
        // Mundur: tahap ini + semua tahap setelahnya dilepas.
        for (let i = idx; i < ORDER.length; i++) target[ORDER[i]] = false;
    }
    const patch: Partial<PesananRow> = {};
    for (const [k, v] of Object.entries(target) as [StageKey, boolean][]) {
        if (!!row[k] !== v) patch[k] = v;
    }
    return Object.keys(patch).length ? patch : null;
}

interface OrderGroup {
    key: string;
    no_inv: string;
    customer: string;
    tanggal: string;
    items: PesananRow[];
    total: number;
}

type Props = {
    rows: PesananRow[];
    onUpdate: (id: number, patch: Partial<PesananRow>) => void;
};

/** Checkbox yang mendukung kondisi "sebagian" (indeterminate). */
function TriCheckbox({ all, some, onToggle, title }: { all: boolean; some: boolean; onToggle: (next: boolean) => void; title: string }) {
    const ref = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = !all && some;
    }, [all, some]);
    return (
        <input
            ref={ref}
            type="checkbox"
            title={title}
            checked={all}
            onChange={() => onToggle(!all)}
            style={{ accentColor: "#A67B5B", width: 15, height: 15, cursor: "pointer" }}
        />
    );
}

// Batas render bertahap — ratusan kartu sekaligus membekukan browser.
const CHUNK = 50;

export function OrderView({ rows, onUpdate }: Props) {
    const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
    const [limit, setLimit] = useState(CHUNK);

    const groups = useMemo<OrderGroup[]>(() => {
        const map = new Map<string, OrderGroup>();
        for (const r of rows) {
            const inv = (r.no_inv || "").trim();
            const key = inv || `#${r.id}`;
            let g = map.get(key);
            if (!g) {
                g = { key, no_inv: inv, customer: r.customer || "", tanggal: r.tanggal || "", items: [], total: 0 };
                map.set(key, g);
            }
            g.items.push(r);
            g.total += pesananRowTotal(r);
            if (!g.customer && r.customer) g.customer = r.customer;
            if (!g.tanggal && r.tanggal) g.tanggal = r.tanggal;
        }
        return [...map.values()];
    }, [rows]);

    // Filter/bulan berubah → mulai lagi dari 50 pertama.
    useEffect(() => { setLimit(CHUNK); }, [groups.length]);
    const visibleGroups = groups.slice(0, limit);

    const toggleOpen = (key: string) => {
        setOpenKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const setStageForGroup = (g: OrderGroup, key: StageKey, checked: boolean) => {
        if (!checked) {
            const idx = ORDER.indexOf(key);
            const higherActive = ORDER.slice(idx + 1).some((k) => g.items.some((it) => it[k]));
            const label = STAGES.find((s) => s.key === key)?.label;
            const msg = higherActive
                ? `Lepas tahap "${label}" untuk ${g.items.length} item order ini?\nTahap setelahnya ikut direset.`
                : `Lepas tahap "${label}" untuk ${g.items.length} item order ini?`;
            if (g.items.length > 1 || higherActive) {
                if (!window.confirm(msg)) return;
            }
        }
        for (const item of g.items) {
            const patch = buildStagePatch(item, key, checked);
            if (patch) onUpdate(item.id, patch);
        }
    };

    const setPaidForGroup = (g: OrderGroup, checked: boolean) => {
        if (!checked && g.items.length > 1) {
            if (!window.confirm(`Tandai BELUM BAYAR untuk ${g.items.length} item order ini?`)) return;
        }
        for (const item of g.items) {
            if (!!item.is_paid !== checked) onUpdate(item.id, { is_paid: checked });
        }
    };

    const badgeOf = (g: OrderGroup) => {
        const all = (k: StageKey) => g.items.every((it) => it[k]);
        if (all("di_kirim")) return { label: "Di Kirim", bg: "#DCFCE7", color: "#15803D" };
        if (all("siap_kirim")) return { label: "Siap Kirim", bg: "#DBEAFE", color: "#1D4ED8" };
        if (all("di_warna")) return { label: "Di Warna", bg: "#FEF9C3", color: "#A16207" };
        if (all("di_produksi")) return { label: "Di Produksi", bg: "#FFE4E6", color: "#BE123C" };
        if (ORDER.some((k) => g.items.some((it) => it[k]))) return { label: "Sebagian", bg: "#FEF3C7", color: "#B45309" };
        return { label: "Belum", bg: "#F3F4F6", color: "#6B7280" };
    };

    const fmtTanggal = (t: string) => {
        const p = (t || "").split("-");
        return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : t || "—";
    };

    return (
        <div style={{ flex: 1, overflow: "auto", padding: "10px 12px", background: "#F5EBDD" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 1100, margin: "0 auto" }}>
                {visibleGroups.map((g) => {
                    const isOpen = openKeys.has(g.key);
                    const badge = badgeOf(g);
                    const allPaid = g.items.every((it) => it.is_paid);
                    const somePaid = g.items.some((it) => it.is_paid);
                    return (
                        <div key={g.key} style={{ background: "white", border: "1px solid #E6D5BE", borderRadius: 10 }}>
                            {/* Header kartu order */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", flexWrap: "wrap" }}>
                                <button
                                    onClick={() => toggleOpen(g.key)}
                                    title={isOpen ? "Tutup detail" : "Lihat detail item"}
                                    style={{ border: "1px solid #D1BFA3", background: "#FFFBF7", borderRadius: 6, width: 24, height: 24, cursor: "pointer", color: "#5C4033", fontSize: 11, lineHeight: 1 }}
                                >{isOpen ? "▾" : "▸"}</button>
                                <div style={{ minWidth: 150, flex: 1 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#5C4033" }}>
                                        {g.customer || "—"}
                                        <span style={{ marginLeft: 8, background: badge.bg, color: badge.color, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{badge.label}</span>
                                    </div>
                                    <div style={{ fontSize: 10.5, color: "#B89678", fontFamily: "monospace" }}>
                                        {g.no_inv ? `INV ${g.no_inv}` : "tanpa invoice"} · {fmtTanggal(g.tanggal)} · {g.items.length} item
                                        {g.total > 0 && <> · Rp {g.total.toLocaleString("id-ID")}</>}
                                    </div>
                                </div>
                                {/* Pipeline tahap per-order */}
                                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                                    {STAGES.map((s) => {
                                        const allS = g.items.every((it) => it[s.key]);
                                        const someS = g.items.some((it) => it[s.key]);
                                        return (
                                            <label key={s.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 700, color: allS ? "#15803D" : someS ? "#B45309" : "#8A7B6E", cursor: "pointer" }}>
                                                <TriCheckbox all={allS} some={someS} title={`${s.label} — semua item`} onToggle={(next) => setStageForGroup(g, s.key, next)} />
                                                {s.label}
                                            </label>
                                        );
                                    })}
                                    <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, fontSize: 9.5, fontWeight: 700, color: allPaid ? "#15803D" : somePaid ? "#B45309" : "#8A7B6E", cursor: "pointer" }}>
                                        <TriCheckbox all={allPaid} some={somePaid} title="Bayar — semua item" onToggle={(next) => setPaidForGroup(g, next)} />
                                        💰 Bayar
                                    </label>
                                </div>
                            </div>

                            {/* Detail line item */}
                            {isOpen && (
                                <div style={{ borderTop: "1px solid #E6D5BE", overflowX: "auto" }}>
                                    <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                                        <thead>
                                            <tr>
                                                {["Deskripsi", "Ukuran", "Qty", "Harga", "Produksi", "Warna", "Siap", "Kirim", "💰"].map((h, i) => (
                                                    <th key={h} style={{ background: "#F8F4EE", color: "#8A7B6E", fontWeight: 700, fontSize: 10, padding: "4px 8px", textAlign: i === 0 ? "left" : "center", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {g.items.map((it) => (
                                                <tr key={it.id}>
                                                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", color: "#3C2F2F", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.deskripsi || "—"}</td>
                                                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", textAlign: "center", color: "#3C2F2F" }}>{it.ukuran || "—"}</td>
                                                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", textAlign: "center", color: "#3C2F2F" }}>{it.qty || "—"}</td>
                                                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", textAlign: "right", color: "#3C2F2F" }}>{it.harga || "—"}</td>
                                                    {STAGES.map((s) => (
                                                        <td key={s.key} style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", textAlign: "center" }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={!!it[s.key]}
                                                                onChange={(e) => {
                                                                    const patch = buildStagePatch(it, s.key, e.target.checked);
                                                                    if (patch) onUpdate(it.id, patch);
                                                                }}
                                                                style={{ accentColor: "#A67B5B", width: 13, height: 13, cursor: "pointer" }}
                                                            />
                                                        </td>
                                                    ))}
                                                    <td style={{ padding: "3px 8px", borderBottom: "1px solid #F1E7DA", textAlign: "center" }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!it.is_paid}
                                                            onChange={(e) => onUpdate(it.id, { is_paid: e.target.checked })}
                                                            style={{ accentColor: "#A67B5B", width: 13, height: 13, cursor: "pointer" }}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
                {groups.length === 0 && (
                    <div style={{ textAlign: "center", marginTop: 40, color: "#C5A882" }}>Tidak ada data.</div>
                )}
                {groups.length > limit && (
                    <button
                        onClick={() => setLimit((l) => l + CHUNK)}
                        style={{ margin: "6px auto 16px", padding: "8px 22px", borderRadius: 8, border: "1px solid #D1BFA3", background: "white", color: "#5C4033", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                    >
                        Tampilkan {Math.min(CHUNK, groups.length - limit)} order berikutnya ({limit} / {groups.length})
                    </button>
                )}
            </div>
        </div>
    );
}
