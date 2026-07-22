"use client";
// Tab Pengingat Piutang (Tahap 7) — kartu aging 1–30 / 31–60 / 60+ hari
// (klik utk filter), daftar diurut dari paling telat, tombol kirim
// pengingat WA (disabled bila tak ada No. WA).
// Umur dihitung dari tanggal invoice belum-lunas TERTUA (belum ada field
// jatuh tempo di pesanan_rows — asumsi konservatif, lihat crm-analytics).
import { useState, useMemo } from "react";
import { Send, MapPin } from "lucide-react";
import type { Customer } from "@/types";
import { normalizeName, daysSince, type CustomerStat } from "@/lib/crm-analytics";
import { findMarketer, type Marketer } from "@/lib/crm-marketers";
import { waPiutang, waLink } from "@/lib/crm-wa";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Debtor {
    stat: CustomerStat;
    c?: Customer;          // master (bisa tak ada — "Tak di master")
    overdue: number;
}

const BUCKETS = [
    { label: "1–30 hari", color: "#C99A3A", match: (d: number) => d <= 30 },
    { label: "31–60 hari", color: "#C0392B", match: (d: number) => d > 30 && d <= 60 },
    { label: "60+ hari", color: "#8E2A20", match: (d: number) => d > 60 },
];

interface Props {
    stats: Map<string, CustomerStat>;
    byName: Map<string, Customer>;
    marketers: Marketer[];
}

export default function TabPiutang({ stats, byName, marketers }: Props) {
    const [bucketFilter, setBucketFilter] = useState<number | null>(null);

    const debtors = useMemo<Debtor[]>(() =>
        Array.from(stats.values())
            .filter((a) => a.unpaid > 0.01)
            .map((stat) => ({ stat, c: byName.get(normalizeName(stat.name)), overdue: daysSince(stat.oldestUnpaid) }))
            .sort((x, y) => y.overdue - x.overdue || y.stat.unpaid - x.stat.unpaid),
        [stats, byName]);

    const total = debtors.reduce((s, d) => s + d.stat.unpaid, 0);
    const shown = bucketFilter === null ? debtors : debtors.filter((d) => BUCKETS[bucketFilter].match(d.overdue));

    return (
        <>
            {/* Kartu aging — klik utk filter daftar */}
            <div className="rgrid rgrid-3" style={{ gap: "0.875rem" }}>
                {BUCKETS.map((b, i) => {
                    const its = debtors.filter((d) => b.match(d.overdue));
                    const v = its.reduce((s, d) => s + d.stat.unpaid, 0);
                    const active = bucketFilter === i;
                    return (
                        <button key={b.label} onClick={() => setBucketFilter(active ? null : i)} className="stat-card"
                            style={{ textAlign: "left", cursor: "pointer", borderTop: `3px solid ${b.color}`, boxShadow: active ? `0 0 0 3px ${b.color}33` : undefined, transition: "all .15s" }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Jatuh tempo {b.label}{active ? " • aktif" : ""}</div>
                            <div style={{ fontSize: "1.2rem", fontWeight: 800, color: b.color }}>{formatCurrency(v)}</div>
                            <div style={{ fontSize: 10.5, color: "#C5A882" }}>{its.length} customer</div>
                        </button>
                    );
                })}
            </div>
            <div style={{ fontSize: 12.5, color: "#8A7B6E" }}>
                Total piutang berjalan: <strong style={{ color: "#B91C1C" }}>{formatCurrency(total)}</strong> · {debtors.length} customer
            </div>

            {/* Daftar — paling telat di atas */}
            <div className="card">
                <div className="card-header">Customer dengan Piutang ({shown.length}{bucketFilter !== null ? ` · ${BUCKETS[bucketFilter].label}` : ""})</div>
                <div>
                    {shown.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 30, color: "#15803D", fontSize: 13 }}>🎉 Tidak ada piutang{bucketFilter !== null ? " di kelompok ini" : ". Semua lunas!"}</div>
                    ) : shown.map((d) => {
                        const mk = d.c ? findMarketer(marketers, d.c.marketingId) : undefined;
                        const invs = Array.from(d.stat.unpaidInvoices);
                        const wa = d.c?.phone ? waLink(d.c.phone, waPiutang(d.stat.name, d.c.pic, d.stat.unpaid, invs)) : null;
                        return (
                            <div key={d.stat.name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 18px", borderTop: "1px solid #F3EADB", flexWrap: "wrap" }}>
                                <div style={{ flex: 1, minWidth: 200 }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#A67B5B" }}>{d.stat.name}</div>
                                    <div style={{ fontSize: 11, color: "#8A7B6E", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                        {(d.c?.kota ?? "").trim() && <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}><MapPin size={10} />{d.c!.kota}</span>}
                                        {mk && <span>PIC {mk.name}</span>}
                                        {d.stat.last && <span>terakhir {formatDate(d.stat.last)}</span>}
                                        {invs.length > 0 && <span>inv: {invs.slice(0, 3).join(", ")}{invs.length > 3 ? ` +${invs.length - 3}` : ""}</span>}
                                    </div>
                                </div>
                                <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "#B91C1C" }}>{formatCurrency(d.stat.unpaid)}</div>
                                    <div style={{ fontSize: 11, fontWeight: 600, color: d.overdue > 60 ? "#8E2A20" : "#C99A3A" }}>{d.overdue > 0 ? `lewat ${d.overdue} hari` : "baru"}</div>
                                </div>
                                {wa ? (
                                    <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: "#16a34a", fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap" }}>
                                        <Send size={12} style={{ marginRight: 4 }} />Kirim pengingat
                                    </a>
                                ) : (
                                    <button disabled title={d.c ? "Belum ada No. WA — lengkapi di tab Direktori" : "Belum ada di master — Import/Tambah dulu di Direktori"}
                                        className="btn btn-secondary" style={{ fontSize: 12, padding: "6px 12px", opacity: 0.5, cursor: "not-allowed", whiteSpace: "nowrap" }}>
                                        <Send size={12} style={{ marginRight: 4 }} />{d.c ? "Belum ada WA" : "Tak di master"}
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
                <div className="card-body" style={{ fontSize: 11.5, color: "#8A7B6E", borderTop: "1px solid #F3EADB" }}>
                    💡 Pengingat WA berisi nominal & nomor invoice yang belum lunas. Umur dihitung dari tanggal invoice tertua yang belum dibayar.
                </div>
            </div>
        </>
    );
}
