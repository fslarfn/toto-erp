"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { GabunganPageFrame, card, ErrorBox, LoadingBox, button } from "@/components/gabungan/GabunganPageFrame";
import { UNIT_META, rupiah, useGabunganDashboard } from "@/lib/gabungan/useGabunganDashboard";

export default function DashboardGabunganPage() {
    const today = new Date();
    const [period, setPeriod] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`);
    const { data, loading, error, refresh } = useGabunganDashboard(period);
    const total = useMemo(() => ({
        orderValue: data?.summaries.reduce((sum, row) => sum + row.orderValue, 0) ?? 0,
        active: data?.summaries.reduce((sum, row) => sum + row.activeOrders, 0) ?? 0,
        receivable: data?.summaries.reduce((sum, row) => sum + row.receivable, 0) ?? 0,
        balance: data?.summaries.reduce((sum, row) => sum + row.balance, 0) ?? 0,
    }), [data]);

    return <GabunganPageFrame title="Dashboard Gabungan" description="Pusat kontrol owner untuk membandingkan kinerja Toto Pusat, Toto Sidoarjo, dan Alucurv. Halaman ini hanya menampilkan ringkasan—perubahan tetap dilakukan di unit asal." period={period} onPeriodChange={setPeriod} action={<button onClick={() => void refresh()} style={button}>↻ Muat ulang</button>}>
        {loading ? <LoadingBox /> : <>
            <ErrorBox message={error} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12, marginBottom: 18 }}>
                <Metric label="Nilai order periode ini" value={rupiah(total.orderValue)} hint="Gabungan seluruh unit" />
                <Metric label="Order aktif" value={`${total.active} baris`} hint="Belum berstatus terkirim" />
                <Metric label="Piutang terpantau" value={rupiah(total.receivable)} hint="Estimasi dari order belum lunas" danger />
                <Metric label="Saldo tercatat" value={rupiah(total.balance)} hint="Saldo akun masing-masing unit" />
            </div>
            <section style={{ ...card, padding: 0, overflow: "hidden", marginBottom: 18 }}>
                <div style={{ padding: "15px 17px", borderBottom: "1px solid #F0E7DE" }}><strong style={{ color: "#3C2F2F" }}>Ringkasan per unit</strong><p style={{ margin: "4px 0 0", fontSize: 12, color: "#927C6D" }}>Bandingkan operasional dan arus kas tanpa mencampur transaksi antarsatuan usaha.</p></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
                    {data?.summaries.map((row) => <div key={row.unit} style={{ padding: 17, borderRight: "1px solid #F0E7DE", borderBottom: "1px solid #F0E7DE" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 14 }}><b style={{ color: UNIT_META[row.unit].color }}>{UNIT_META[row.unit].label}</b><Link href={UNIT_META[row.unit].href} style={{ color: "#8B5E3C", fontSize: 11, fontWeight: 800, textDecoration: "none" }}>Buka unit →</Link></div>
                        <GridMetric label="Order" value={`${row.orderCount} baris`} /><GridMetric label="Nilai order" value={rupiah(row.orderValue)} /><GridMetric label="Order aktif" value={`${row.activeOrders} baris`} /><GridMetric label="Pemasukan" value={rupiah(row.income)} green /><GridMetric label="Pengeluaran" value={rupiah(row.expense)} red /><GridMetric label="Saldo tercatat" value={rupiah(row.balance)} />
                    </div>)}
                </div>
            </section>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))", gap: 12 }}>
                <QuickLink href="/dashboard/gabungan/operasional" icon="🏭" title="Operasional lintas unit" text="Cari order, lihat tahap produksi, dan buka unit asal untuk tindakan." />
                <QuickLink href="/dashboard/gabungan/keuangan" icon="💳" title="Keuangan & saldo" text="Bandingkan pemasukan, pengeluaran, dan saldo tercatat tiap unit." />
                <QuickLink href="/dashboard/gabungan/piutang" icon="📋" title="Piutang & tagihan" text="Pantau invoice Toto Pusat dan Sidoarjo yang belum lunas." />
            </div>
        </>}
    </GabunganPageFrame>;
}

function Metric({ label, value, hint, danger }: { label: string; value: string; hint: string; danger?: boolean }) { return <div style={card}><div style={{ color: "#A67B5B", fontSize: 11, fontWeight: 800, textTransform: "uppercase" }}>{label}</div><div style={{ color: danger ? "#B91C1C" : "#3C2F2F", fontWeight: 800, fontSize: 21, marginTop: 7 }}>{value}</div><div style={{ color: "#927C6D", fontSize: 11, marginTop: 5 }}>{hint}</div></div>; }
function GridMetric({ label, value, green, red }: { label: string; value: string; green?: boolean; red?: boolean }) { return <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "5px 0", borderBottom: "1px solid #F7EFE8" }}><span style={{ color: "#927C6D" }}>{label}</span><b style={{ color: green ? "#15803D" : red ? "#B91C1C" : "#3C2F2F" }}>{value}</b></div>; }
function QuickLink({ href, icon, title, text }: { href: string; icon: string; title: string; text: string }) { return <Link href={href} style={{ ...card, textDecoration: "none" }}><div style={{ fontSize: 20, marginBottom: 9 }}>{icon}</div><div style={{ fontSize: 14, color: "#3C2F2F", fontWeight: 800, marginBottom: 5 }}>{title}</div><div style={{ fontSize: 12, color: "#7B6656", lineHeight: 1.5 }}>{text}</div><div style={{ color: "#8B5E3C", fontSize: 12, fontWeight: 800, marginTop: 12 }}>Buka ringkasan →</div></Link>; }
