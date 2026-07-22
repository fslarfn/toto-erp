"use client";
// Modal "Tinjau & gabungkan" kandidat duplikat (Tahap 4).
// Merge TIDAK otomatis: user memilih entri utama per grup, lalu konfirmasi.
// Order dipindahkan ke entri utama; tidak ada data pesanan yang dihapus.
import { useState } from "react";
import type { Customer } from "@/types";
import type { EnrichedCustomer } from "@/lib/crm-analytics";
import { mergeCustomers } from "@/lib/crm-merge";
import { formatCurrency } from "@/lib/utils";

interface Props {
    groups: EnrichedCustomer[][];        // grup kandidat duplikat (≥ 2 entri)
    onClose: () => void;
    showToast: (m: string) => void;
}

export default function MergeDuplikat({ groups, onClose, showToast }: Props) {
    // Pilihan entri utama per grup — default: nilai order historis terbesar.
    const [primaryIds, setPrimaryIds] = useState<Record<number, string>>(() => {
        const init: Record<number, string> = {};
        groups.forEach((g, i) => {
            const top = g.reduce((best, e) => (e.stat.total > best.stat.total ? e : best), g[0]);
            init[i] = top.c.id;
        });
        return init;
    });
    const [busyGroup, setBusyGroup] = useState<number | null>(null);

    const handleMerge = async (gi: number) => {
        const group = groups[gi];
        const primary = group.find((e) => e.c.id === primaryIds[gi])?.c as Customer | undefined;
        if (!primary) return;
        const others = group.filter((e) => e.c.id !== primary.id).map((e) => e.c);
        const ok = confirm(
            `Gabungkan ${others.length} entri ke "${primary.name}"?\n\n`
            + `• Semua order atas nama: ${others.map((o) => `"${o.name}"`).join(", ")} dipindahkan ke "${primary.name}".\n`
            + `• Data pesanan TIDAK ada yang dihapus.\n`
            + `• Entri duplikat dihapus dari master customer.\n\n`
            + `Lanjutkan?`
        );
        if (!ok) return;
        setBusyGroup(gi);
        try {
            const res = await mergeCustomers(primary, others);
            showToast(`✅ Digabung ke "${primary.name}" — ${res.movedRows} baris order dipindahkan, ${res.deletedMasters} entri master dihapus`);
        } catch (err: unknown) {
            alert("Gagal menggabungkan: " + (err instanceof Error ? err.message : ""));
        } finally { setBusyGroup(null); }
    };

    return (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "88vh", display: "flex", flexDirection: "column", border: "1px solid #E6D5BE", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "12px 12px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 15, color: "#5C4033" }}>🔀 Tinjau & Gabungkan Duplikat ({groups.length} grup)</span>
                    <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#B89678" }}>×</button>
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                    <p style={{ fontSize: 12.5, color: "#8A7B6E", margin: "0 0 14px", lineHeight: 1.55 }}>
                        Pilih <strong>entri utama</strong> untuk tiap grup (order dari entri lain dipindahkan ke sana).
                        Kandidat dideteksi dari nama mirip atau No. WA sama. Tidak ada data pesanan yang dihapus.
                    </p>
                    {groups.length === 0 && (
                        <div style={{ textAlign: "center", padding: 24, color: "#15803D", fontSize: 13 }}>🎉 Tidak ada kandidat duplikat tersisa.</div>
                    )}
                    {groups.map((g, gi) => (
                        <div key={g.map((e) => e.c.id).join("-")} style={{ border: "1px solid #E8DDD0", borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
                            <div style={{ padding: "8px 14px", background: "#FBF4E6", fontSize: 11, fontWeight: 700, color: "#7A5E1E", letterSpacing: 0.4 }}>GRUP {gi + 1} · {g.length} ENTRI MIRIP</div>
                            {g.map((e) => (
                                <label key={e.c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: "1px solid #F3EADB", cursor: "pointer", background: primaryIds[gi] === e.c.id ? "#F8FDF8" : "transparent" }}>
                                    <input type="radio" name={`primary-${gi}`} checked={primaryIds[gi] === e.c.id}
                                        onChange={() => setPrimaryIds((p) => ({ ...p, [gi]: e.c.id }))} />
                                    <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#3C2F2F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                            {e.c.name} {primaryIds[gi] === e.c.id && <span style={{ fontSize: 10, fontWeight: 700, color: "#15803D", background: "#DCFCE7", borderRadius: 99, padding: "1px 7px", marginLeft: 4 }}>UTAMA</span>}
                                        </span>
                                        <span style={{ fontSize: 11, color: "#8A7B6E" }}>
                                            {e.c.phone ? `📱 ${e.c.phone}` : "tanpa WA"} · {e.stat.count} order · {formatCurrency(e.stat.total)}
                                            {e.stat.unpaid > 0 && <span style={{ color: "#B91C1C" }}> · piutang {formatCurrency(e.stat.unpaid)}</span>}
                                        </span>
                                    </span>
                                </label>
                            ))}
                            <div style={{ padding: "10px 14px", borderTop: "1px solid #F3EADB", textAlign: "right" }}>
                                <button onClick={() => handleMerge(gi)} disabled={busyGroup !== null} className="btn btn-primary" style={{ fontSize: 12, padding: "6px 14px" }}>
                                    {busyGroup === gi ? "Menggabungkan…" : "🔀 Gabungkan grup ini"}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
                <div style={{ padding: "12px 20px", borderTop: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "0 0 12px 12px", textAlign: "right" }}>
                    <button onClick={onClose} className="btn btn-secondary" style={{ padding: "8px 18px" }}>Tutup</button>
                </div>
            </div>
        </div>
    );
}
