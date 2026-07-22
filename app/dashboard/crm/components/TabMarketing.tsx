"use client";
// Tab Per Marketing (Tahap 5) — sesuai mockup TotoCRMUnified:
// kartu omset/share/bonus per marketing (rate bisa diubah), selektor bulan,
// tabel penagihan customer binaan, callout belum tertagih, dan
// "Kunci & catat bonus" → snapshot ke tabel marketing_bonus.
import { useState, useMemo, useEffect, useCallback } from "react";
import { Percent, Wallet, AlertCircle, Send, Lock, Check, Clock, MapPin } from "lucide-react";
import type { Customer } from "@/types";
import {
    MARKETERS, marketerById, marketingRollup, customersOfMarketer, availableMonths,
    monthLabel, currentMonthKey, computeBonus, DEFAULT_BONUS_RATE,
    type EnrichedCustomer, type OrderRowLike,
} from "@/lib/crm-analytics";
import { fetchMarketingBonuses, lockMarketingBonus, type MarketingBonusRecord } from "@/lib/crm-refs";
import { waPiutang, waLink } from "@/lib/crm-wa";
import { useAuth } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

const MONTH_OPTS: [string, string][] = [
    ["01", "Januari"], ["02", "Februari"], ["03", "Maret"], ["04", "April"],
    ["05", "Mei"], ["06", "Juni"], ["07", "Juli"], ["08", "Agustus"],
    ["09", "September"], ["10", "Oktober"], ["11", "November"], ["12", "Desember"],
];

const selectSt: React.CSSProperties = {
    border: "1.5px solid #D1BFA3", borderRadius: 8, padding: "8px 12px",
    fontSize: 13, fontWeight: 600, color: "#5C4033", background: "#FFFBF7",
};

interface Props {
    enriched: EnrichedCustomer[];
    rows: OrderRowLike[];
    onDetail: (c: Customer) => void;
    showToast: (m: string) => void;
}

export default function TabMarketing({ enriched, rows, onDetail, showToast }: Props) {
    const { user } = useAuth();
    const [active, setActive] = useState<string>(MARKETERS[0].id);
    const [rate, setRate] = useState<number>(DEFAULT_BONUS_RATE);
    const months = useMemo(() => availableMonths(rows), [rows]);
    // Tahun tersedia: dari data (sudah dibatasi rentang wajar) + tahun berjalan.
    const years = useMemo(() => {
        const ys = new Set(months.map((m) => m.slice(0, 4)));
        ys.add(currentMonthKey().slice(0, 4));
        return Array.from(ys).sort().reverse();
    }, [months]);
    const [year, setYear] = useState<string>("");         // '' = semua tahun
    const [monthNum, setMonthNum] = useState<string>(""); // '01'..'12', '' = semua bulan
    const [periodInit, setPeriodInit] = useState(false);
    const [locked, setLocked] = useState<Record<string, MarketingBonusRecord>>({});
    const [busyLock, setBusyLock] = useState(false);

    // Default: bulan berjalan bila ada ordernya; kalau tidak, bulan terbaru
    // yang TIDAK melewati bulan berjalan (hindari default ke tanggal typo
    // masa depan). Sekali saja, saat data siap.
    useEffect(() => {
        if (!periodInit && months.length) {
            const def = months.find((m) => m <= currentMonthKey()) ?? months[0];
            setYear(def.slice(0, 4));
            setMonthNum(def.slice(5, 7));
            setPeriodInit(true);
        }
    }, [months, periodInit]);

    // Periode filter: 'YYYY-MM' (bulan) | 'YYYY' (setahun) | '' (semua waktu).
    const period = year ? (monthNum ? `${year}-${monthNum}` : year) : "";
    // Kunci bonus hanya masuk akal utk satu bulan penuh.
    const lockPeriod = year && monthNum ? `${year}-${monthNum}` : "";
    const periodLabel = !period ? "" : monthNum ? monthLabel(period) : `Tahun ${year}`;

    const customers = useMemo(() => enriched.map((e) => e.c), [enriched]);
    const rollup = useMemo(() => marketingRollup(customers, rows, period), [customers, rows, period]);
    const list = useMemo(() => customersOfMarketer(enriched, rows, active, period), [enriched, rows, active, period]);

    const unassigned = rollup.perMarketer.get("");
    const activeMk = marketerById(active) ?? MARKETERS[0];
    const activeOmset = rollup.perMarketer.get(active)?.omset ?? 0;

    // Piutang periode terpilih saja — selaras dgn omset & bonus.
    const unpaidList = list.filter((r) => !r.paid);
    const unpaidTotal = unpaidList.reduce((s, r) => s + r.periodUnpaid, 0);

    // Bonus terkunci utk bulan terpilih.
    const reloadLocked = useCallback(() => {
        if (!lockPeriod) { setLocked({}); return; }
        fetchMarketingBonuses(lockPeriod)
            .then((recs) => setLocked(Object.fromEntries(recs.map((r) => [r.marketing_id, r]))))
            .catch(() => setLocked({}));
    }, [lockPeriod]);
    useEffect(() => { reloadLocked(); }, [reloadLocked]);

    const handleLock = async () => {
        if (!lockPeriod) return;
        const bonus = computeBonus(activeOmset, rate);
        const ok = confirm(
            `Kunci & catat bonus ${activeMk.name} untuk ${monthLabel(lockPeriod)}?\n\n`
            + `Omset: ${formatCurrency(activeOmset)}\nRate: ${rate}%\nBonus: ${formatCurrency(bonus)}\n\n`
            + (locked[active] ? "Catatan lama untuk bulan ini akan DITIMPA." : "Angka disimpan sebagai catatan final bulan ini.")
        );
        if (!ok) return;
        setBusyLock(true);
        try {
            await lockMarketingBonus({
                marketing_id: active, period: lockPeriod, omset: activeOmset, rate,
                bonus, locked_by: user?.username ?? user?.name ?? "",
            });
            showToast(`🔒 Bonus ${activeMk.name} ${monthLabel(lockPeriod)} tercatat: ${formatCurrency(bonus)}`);
            reloadLocked();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            alert(/policy|denied|violates/i.test(msg)
                ? "Tidak punya izin mengunci bonus (hanya owner/finance)."
                : "Gagal menyimpan bonus: " + msg);
        } finally { setBusyLock(false); }
    };

    return (
        <>
            {/* Selektor bulan + tahun + rate bonus */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={monthNum} onChange={(e) => setMonthNum(e.target.value)} disabled={!year}
                        title={year ? "" : "Pilih tahun dulu"} style={{ ...selectSt, opacity: year ? 1 : 0.55 }}>
                        <option value="">Semua bulan</option>
                        {MONTH_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(e.target.value)} style={selectSt}>
                        <option value="">Semua tahun</option>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: "1px solid #E8DDD0", borderRadius: 9, padding: "7px 12px" }}>
                    <Percent size={14} color="#8A7B6E" />
                    <span style={{ fontSize: 12.5, color: "#8A7B6E" }}>Bonus</span>
                    <input type="number" step="0.1" min="0" value={rate}
                        onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                        style={{ width: 48, border: "none", outline: "none", fontSize: 13, fontWeight: 700, color: "#A67B5B", background: "transparent" }} />
                    <span style={{ fontSize: 13, color: "#8A7B6E" }}>%</span>
                </div>
            </div>

            {/* Kartu total + per marketing */}
            <div className="rgrid rgrid-4" style={{ gap: "0.875rem" }}>
                <div style={{ background: "linear-gradient(135deg,#3B1F0F,#A67B5B)", color: "#fff", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, opacity: 0.9, fontWeight: 600 }}>TOTAL OMSET {period ? periodLabel.toUpperCase() : "(SEMUA)"}</div>
                    <div style={{ fontSize: "1.25rem", fontWeight: 800, marginTop: 6 }}>{formatCurrency(rollup.totalOmset)}</div>
                    <div style={{ fontSize: 11, opacity: 0.85, marginTop: 3 }}>Total bonus {rate}%: {formatCurrency(computeBonus(rollup.totalOmset, rate))}</div>
                </div>
                {MARKETERS.map((m) => {
                    const r = rollup.perMarketer.get(m.id);
                    const om = r?.omset ?? 0;
                    const share = rollup.totalOmset ? Math.round((om / rollup.totalOmset) * 100) : 0;
                    const isActive = active === m.id;
                    return (
                        <button key={m.id} onClick={() => setActive(m.id)} className="stat-card"
                            style={{ textAlign: "left", cursor: "pointer", border: isActive ? `2px solid ${m.color}` : "2px solid transparent", boxShadow: isActive ? `0 0 0 3px ${m.color}22` : undefined, transition: "all .15s" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ width: 20, height: 20, borderRadius: "50%", background: m.color, color: "#fff", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>{m.name[0]}</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "#3C2F2F" }}>{m.name}</span>
                            </div>
                            <div style={{ fontSize: "1.05rem", fontWeight: 800, marginTop: 6, color: "var(--text-dark)" }}>{formatCurrency(om)}</div>
                            <div style={{ fontSize: 10.5, color: "#8A7B6E" }}>{share}% · {r?.customerCount ?? 0} customer</div>
                            <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid #F3EADB", display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                                <Wallet size={12} color="#15803D" /><span style={{ color: "#15803D", fontWeight: 700 }}>{formatCurrency(computeBonus(om, rate))}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Omset tanpa marketing → ajakan assign */}
            {(unassigned?.omset ?? 0) > 0 && (
                <div style={{ background: "#FBF4E6", border: "1px solid #EAD9B4", borderRadius: 10, padding: "10px 16px", fontSize: 12.5, color: "#7A5E1E" }}>
                    ⚠️ <strong>{formatCurrency(unassigned!.omset)}</strong> omset dari {unassigned!.customerCount} customer <strong>belum di-assign</strong> ke marketing —
                    isi kolom Marketing di tab Direktori agar masuk rekap.
                </div>
            )}

            {/* Pill marketing + callout belum tertagih */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {MARKETERS.map((m) => (
                        <button key={m.id} onClick={() => setActive(m.id)}
                            style={{ fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "7px 15px", borderRadius: 999, border: `1px solid ${active === m.id ? m.color : "#E8DDD0"}`, background: active === m.id ? m.color : "#fff", color: active === m.id ? "#fff" : "#8A7B6E" }}>{m.name}</button>
                    ))}
                </div>
                {unpaidList.length > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FBEEEC", border: "1px solid #E8C9C4", borderRadius: 9, padding: "7px 13px" }}>
                        <AlertCircle size={15} color="#B91C1C" />
                        <span style={{ fontSize: 12.5, color: "#8E2A20" }}>Belum tertagih: <strong>{formatCurrency(unpaidTotal)}</strong> · {unpaidList.length} customer</span>
                    </div>
                )}
            </div>

            {/* Tabel customer binaan */}
            <div className="card">
                <div className="card-header">Customer {activeMk.name}{period ? ` · ${periodLabel}` : ""} ({list.length})</div>
                <div className="table-container">
                    <table className="data-table">
                        <thead><tr><th>Customer</th><th>Wilayah</th><th style={{ textAlign: "right" }}>Nilai{period ? " (periode)" : ""}</th><th>Status</th><th style={{ width: 150, textAlign: "center" }}>Penagihan</th></tr></thead>
                        <tbody>
                            {list.length === 0 ? (
                                <tr><td colSpan={5} style={{ textAlign: "center", padding: 30, color: "#B89678" }}>
                                    Belum ada customer {activeMk.name}{period ? ` yang beromset di ${periodLabel}` : ""}. Assign lewat kolom Marketing di tab Direktori.
                                </td></tr>
                            ) : list.map(({ e, periodValue, periodUnpaid, periodUnpaidInvoices, paid }) => {
                                const c = e.c;
                                const wa = c.phone ? waLink(c.phone, waPiutang(c.name, c.pic, periodUnpaid, periodUnpaidInvoices)) : null;
                                return (
                                    <tr key={c.id}>
                                        <td>
                                            <button onClick={() => onDetail(c)} style={{ background: "none", border: "none", padding: 0, color: "#A67B5B", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{c.name}</button>
                                            {e.stat.last && <div style={{ fontSize: 11, color: "#8A7B6E" }}>terakhir {formatDate(e.stat.last)}</div>}
                                        </td>
                                        <td style={{ fontSize: 12, color: "#5C4033" }}>
                                            {(c.kota ?? "").trim() ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{c.kota}</span> : <span style={{ color: "#C5A882" }}>—</span>}
                                        </td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(period ? periodValue : e.stat.total)}</td>
                                        <td>
                                            {paid ? (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#DCFCE7", color: "#15803D" }}><Check size={12} />Lunas</span>
                                            ) : (
                                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#FBEEEC", color: "#B91C1C" }} title={`Piutang periode ini ${formatCurrency(periodUnpaid)}`}><Clock size={12} />Belum bayar</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: "center" }}>
                                            {paid ? (
                                                <span style={{ fontSize: 12, color: "#C5A882" }}>—</span>
                                            ) : wa ? (
                                                <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: "#16a34a", fontSize: 12, padding: "5px 10px", whiteSpace: "nowrap" }}><Send size={12} style={{ marginRight: 4 }} />Tagih via WA</a>
                                            ) : (
                                                <span style={{ fontSize: 11, color: "#C5A882" }}>Belum ada WA</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Kunci & catat bonus (butuh periode bulan) */}
            {lockPeriod && (
                <div className="card">
                    <div className="card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#5C4033" }}>Bonus {activeMk.name} · {monthLabel(lockPeriod)}</div>
                            <div style={{ fontSize: 12.5, color: "#8A7B6E", marginTop: 3 }}>
                                {formatCurrency(activeOmset)} × {rate}% = <strong style={{ color: "#15803D" }}>{formatCurrency(computeBonus(activeOmset, rate))}</strong>
                            </div>
                            {locked[active] && (
                                <div style={{ fontSize: 11.5, color: "#A16207", marginTop: 4 }}>
                                    🔒 Tercatat: {formatCurrency(locked[active].bonus)} (rate {locked[active].rate}%)
                                    {locked[active].locked_at ? ` · ${formatDate(locked[active].locked_at!)}` : ""}
                                    {locked[active].locked_by ? ` · oleh ${locked[active].locked_by}` : ""}
                                </div>
                            )}
                        </div>
                        <button onClick={handleLock} disabled={busyLock || activeOmset <= 0} className="btn btn-primary" style={{ fontSize: 13 }}>
                            <Lock size={13} style={{ marginRight: 5 }} />{busyLock ? "Menyimpan…" : locked[active] ? "Kunci ulang bonus" : "Kunci & catat bonus"}
                        </button>
                    </div>
                </div>
            )}
            <p style={{ fontSize: 11.5, color: "#B89678", margin: 0, lineHeight: 1.5 }}>
                Semua angka mengikuti tanggal order pada periode terpilih: omset, bonus, status Lunas/Belum bayar,
                dan nominal tagihan hanya menghitung order periode itu. Atribusi marketing lewat kolom Marketing
                tiap customer (tab Direktori). Bonus terkunci tersimpan per bulan di tabel marketing_bonus.
            </p>
        </>
    );
}
