"use client";
// Tab Re-engagement (Tahap 7) — kelompok Dormant 90–180 / 180+ hari,
// diurut dari nilai historis terbesar (yang paling berharga disapa duluan),
// tombol Re-engage via WA (disabled bila tak ada No. WA).
import { useMemo } from "react";
import { MessageCircle, MapPin } from "lucide-react";
import type { Customer } from "@/types";
import {
    normalizeName, daysSince, DORMANT_DAYS, DORMANT_LONG_DAYS,
    type CustomerStat,
} from "@/lib/crm-analytics";
import { findMarketer, type Marketer } from "@/lib/crm-marketers";
import { waGreeting, waLink } from "@/lib/crm-wa";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DormantRow {
    stat: CustomerStat;
    c?: Customer;      // master (bisa tak ada — "Tak di master")
    days: number;
}

interface Props {
    stats: Map<string, CustomerStat>;
    byName: Map<string, Customer>;
    marketers: Marketer[];
}

export default function TabReengage({ stats, byName, marketers }: Props) {
    const dormant = useMemo<DormantRow[]>(() =>
        Array.from(stats.values())
            .filter((a) => a.last && daysSince(a.last) >= DORMANT_DAYS)
            .map((stat) => ({ stat, c: byName.get(normalizeName(stat.name)), days: daysSince(stat.last) }))
            .sort((x, y) => y.stat.total - x.stat.total),
        [stats, byName]);

    const groups = [
        { label: `Dormant ${DORMANT_DAYS}–${DORMANT_LONG_DAYS} hari`, items: dormant.filter((d) => d.days < DORMANT_LONG_DAYS) },
        { label: `Dormant ${DORMANT_LONG_DAYS}+ hari`, items: dormant.filter((d) => d.days >= DORMANT_LONG_DAYS) },
    ];
    const totalPotensi = dormant.reduce((s, d) => s + d.stat.total, 0);

    return (
        <>
            <p style={{ fontSize: 13, color: "#8A6D55", margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
                Customer yang dulu order tapi sudah lama sepi. Mengaktifkan kembali lebih murah daripada
                mencari customer baru — diurutkan dari nilai historis terbesar.
            </p>
            <div className="rgrid rgrid-half" style={{ gap: "0.875rem" }}>
                <div className="stat-card">
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Perlu Di-follow-up (≥ {DORMANT_DAYS} hari)</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#A16207" }}>{dormant.length.toLocaleString("id-ID")}</div>
                </div>
                <div className="stat-card">
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Potensi Nilai (total historis)</div>
                    <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-dark)" }}>{formatCurrency(totalPotensi)}</div>
                </div>
            </div>

            {dormant.length === 0 && (
                <div className="card"><div className="card-body" style={{ textAlign: "center", padding: 30, color: "#15803D", fontSize: 13 }}>
                    Semua customer aktif (order &lt; {DORMANT_DAYS} hari). 👍
                </div></div>
            )}

            {groups.map((g) => g.items.length > 0 && (
                <div className="card" key={g.label}>
                    <div className="card-header">{g.label} ({g.items.length.toLocaleString("id-ID")})</div>
                    <div>
                        {g.items.map((d) => {
                            const mk = d.c ? findMarketer(marketers, d.c.marketingId) : undefined;
                            const wa = d.c?.phone ? waLink(d.c.phone, waGreeting(d.stat.name, d.c.pic)) : null;
                            return (
                                <div key={d.stat.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderTop: "1px solid #F3EADB", flexWrap: "wrap" }}>
                                    <div style={{ flex: 1, minWidth: 200 }}>
                                        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#A67B5B" }}>{d.stat.name}</div>
                                        <div style={{ fontSize: 11, color: "#8A7B6E", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                            {(d.c?.kota ?? "").trim() && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={10} />{d.c!.kota}</span>}
                                            {mk && <span>PIC {mk.name}</span>}
                                            <span>total {formatCurrency(d.stat.total)}</span>
                                            {d.stat.last && <span>terakhir {formatDate(d.stat.last)}</span>}
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 11.5, fontWeight: 600, color: d.days >= DORMANT_LONG_DAYS ? "#B91C1C" : "#C99A3A", whiteSpace: "nowrap" }}>{d.days} hari sepi</span>
                                    {wa ? (
                                        <a href={wa} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}>
                                            <MessageCircle size={12} style={{ marginRight: 4 }} />Re-engage
                                        </a>
                                    ) : (
                                        <button disabled title={d.c ? "Belum ada No. WA — lengkapi di tab Direktori" : "Belum ada di master — Import/Tambah dulu di Direktori"}
                                            className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px", opacity: 0.5, cursor: "not-allowed", whiteSpace: "nowrap" }}>
                                            <MessageCircle size={12} style={{ marginRight: 4 }} />{d.c ? "Belum ada WA" : "Tak di master"}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </>
    );
}
