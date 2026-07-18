"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { usePesanan, isRowFilled, PesananRow } from "@/lib/pesanan-store";
import { useAuth } from "@/lib/auth";
import { useSuratJalan } from "@/lib/surat-jalan-store";
import { formatCurrency, formatDate, PRODUCTION_STATUS_LABELS } from "@/lib/utils";
import { computeTotals, isTransfer } from "@/lib/balance";
import { fetchPiutangSummary, pesananRowTotal } from "@/lib/piutang";
import useSWR from "swr";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";

const PIE_COLORS = ["#ef4444", "#f59e0b", "#10b981"];
const PROD_COLORS: Record<string, string> = {
    belum_produksi: "#fde68a",
    di_produksi: "#93c5fd",
    di_warna: "#c4b5fd",
    siap_kirim: "#6ee7b7",
    di_kirim: "#D1BFA3",
};

export default function DashboardPage() {
    const { cashFlow, materials, bankAccounts, getComputedBalance } = useStore();
    const { rows: pesananRows } = usePesanan();
    const { user } = useAuth();
    const { suratJalans } = useSuratJalan();

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());

    const selectedPeriod = `${year}-${String(month).padStart(2, "0")}`;

    // Filter rows dari usePesanan (SATU-SATUNYA jalur input order — tabel
    // orders legacy tidak lagi dihitung agar tidak dobel).
    const filteredPesananRows = pesananRows.filter((r) => {
        if (!isRowFilled(r)) return false;
        return r.tanggal.startsWith(selectedPeriod);
    });

    // ── Definisi ORDER = kelompok baris per invoice (dedup no_inv) ──
    // 1 order bisa banyak baris item; sebelumnya semua metrik menghitung
    // per-BARIS sehingga angkanya membengkak (mis. "Di Kirim: belasan ribu").
    const orderGroups = (() => {
        const map = new Map<string, PesananRow[]>();
        filteredPesananRows.forEach((r) => {
            const key = (r.no_inv || `#${r.id}`).trim();
            const arr = map.get(key);
            if (arr) arr.push(r);
            else map.set(key, [r]);
        });
        return [...map.values()];
    })();
    // Status order = tahap yang sudah dilewati SEMUA item-nya.
    const groupStatus = (items: PesananRow[]): string => {
        if (items.every((i) => i.di_kirim)) return "di_kirim";
        if (items.every((i) => i.siap_kirim)) return "siap_kirim";
        if (items.every((i) => i.di_warna)) return "di_warna";
        if (items.every((i) => i.di_produksi)) return "di_produksi";
        return "belum_produksi";
    };
    const statusCounts: Record<string, number> = {};
    orderGroups.forEach((g) => {
        const s = groupStatus(g);
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    const totalOrderCount = orderGroups.length;
    const totalOrderValue = filteredPesananRows.reduce((s, r) => s + pesananRowTotal(r), 0);

    // Order telat: >7 hari sejak tanggal order & belum terkirim semua.
    const overdueCount = orderGroups.filter((g) => {
        if (groupStatus(g) === "di_kirim") return false;
        const t = new Date(g[0]?.tanggal || "");
        if (isNaN(t.getTime())) return false;
        return (now.getTime() - t.getTime()) / 86400000 > 7;
    }).length;

    // Filter cashFlow berdasarkan periode.
    // Definisi SAMA dengan Keuangan & Cockpit: kecualikan mutasi antar-kas,
    // entri test, dan penyesuaian (lib/balance.computeTotals).
    const filteredCashFlow = cashFlow.filter(c => c.date.startsWith(selectedPeriod));
    const { income: totalRevenueFromCashFlow, expense: totalExpense } = computeTotals(filteredCashFlow);

    // Revenue = pemasukan cash flow SAJA. Pembayaran invoice selalu dicatat
    // di Keuangan (konfirmasi owner), jadi menambah nilai order lunas dari
    // pesanan_rows membuat pendapatan terhitung DOBEL. Definisi ini kini
    // konsisten dengan Keuangan & Laba Bulan Ini di Cockpit.
    const totalRevenue = totalRevenueFromCashFlow;
    const netProfit = totalRevenue - totalExpense;

    // Piutang: HANYA dari pesanan_rows — satu-satunya jalur input order
    // (tabel orders legacy tumpang-tindih sehingga dulu terhitung dobel ~2x).
    // Diambil langsung dari DB lewat fungsi bersama lib/piutang —
    // query & rumus SAMA PERSIS dengan Executive Cockpit.
    const { data: piutang } = useSWR("piutang-summary", fetchPiutangSummary, { dedupingInterval: 5000 });
    const totalAR = piutang?.total ?? 0;
    const unpaidInvoiceCount = piutang?.invoiceCount ?? 0;

    // Saldo TERHITUNG (sumber kebenaran yang sama dengan Keuangan), bukan cache.
    const totalSaldo = bankAccounts.reduce((s, b) => s + getComputedBalance(b.id), 0);
    const lowStock = materials.filter((m) => m.currentStock <= m.minimumStock).length;

    // Order aktif = order periode terpilih yang belum terkirim semua (per ORDER, bukan per baris).
    const activeJobs = orderGroups.filter((g) => groupStatus(g) !== "di_kirim").length;

    // Monthly chart data
    const monthlyData = (() => {
        const map: Record<string, { income: number; expense: number }> = {};
        cashFlow.forEach((c) => {
            if (c.isTest || c.isAdjustment || isTransfer(c)) return; // konsisten dgn computeTotals
            const m = c.date.substring(0, 7);
            if (!map[m]) map[m] = { income: 0, expense: 0 };
            if (c.type === "income") map[m].income += c.amount;
            else map[m].expense += c.amount;
        });
        return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, d]) => ({
            month: month.replace("2026-", ""),
            Pemasukan: d.income / 1_000_000,
            Pengeluaran: d.expense / 1_000_000,
        }));
    })();

    // Payment pie per ORDER (invoice) di periode terpilih.
    const countPaidOrders = orderGroups.filter((g) => g.every((r) => r.is_paid)).length;
    const countPartialOrders = orderGroups.filter((g) => g.some((r) => r.is_paid) && !g.every((r) => r.is_paid)).length;
    const countUnpaidOrders = orderGroups.length - countPaidOrders - countPartialOrders;

    const paymentPie = [
        { name: "Lunas", value: countPaidOrders },
        { name: "Bayar Sebagian", value: countPartialOrders },
        { name: "Belum Lunas", value: countUnpaidOrders },
    ].filter((d) => d.value > 0);

    // Distribusi status produksi per ORDER (periode terpilih) — sumber sama
    // dengan pill di atas agar angkanya tidak saling bertentangan.
    const prodData = Object.entries(statusCounts).map(([status, count]) => ({
        name: PRODUCTION_STATUS_LABELS[status] ?? status,
        count,
        fill: PROD_COLORS[status] ?? "#D1BFA3",
    }));

    // Order terbaru: dari pesanan_rows periode terpilih (bukan tabel orders legacy).
    const recentOrders = [...orderGroups]
        .sort((a, b) => (b[0]?.tanggal || "").localeCompare(a[0]?.tanggal || ""))
        .slice(0, 6)
        .map((g) => ({
            key: (g[0].no_inv || `#${g[0].id}`).trim(),
            customer: g[0].customer || "—",
            deskripsi: g[0].deskripsi || "",
            itemCount: g.length,
            total: g.reduce((s, r) => s + pesananRowTotal(r), 0),
            tanggal: g[0].tanggal || "",
        }));

    return (
        <div className="page-content space-y-5">
            {/* Page header */}
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "0.625rem" }}>
                <div>
                    <h1 className="page-title-h1">Dashboard Performa Usaha</h1>
                    <p className="page-subtitle">
                        Selamat datang, <strong style={{ color: "var(--text-dark)" }}>{user?.name}</strong> &nbsp;—&nbsp;
                        {now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>

                {/* Month/Year Filter */}
                <div style={{ display: "flex", gap: "0.5rem", background: "white", padding: "4px 8px", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                    <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}
                        style={{ border: "none", outline: "none", fontSize: 13, color: "#5C4033", fontWeight: 600, cursor: "pointer", background: "transparent" }}>
                        {["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"].map((m, i) => (
                            <option key={i + 1} value={i + 1}>{m}</option>
                        ))}
                    </select>
                    <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
                        style={{ border: "none", outline: "none", fontSize: 13, color: "#5C4033", fontWeight: 600, cursor: "pointer", background: "transparent" }}>
                        {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="rgrid rgrid-4">
                {[
                    { label: "Order Bulan Ini", value: `${totalOrderCount} order`, sub: formatCurrency(totalOrderValue), bg: "#FDF3E7", border: "#E8DCCF", icon: "📦" },
                    { label: "Total Saldo", value: formatCurrency(totalSaldo), sub: `${bankAccounts.length} rekening`, bg: "#FDF3E7", border: "#E8DCCF", icon: "🏦" },
                    { label: "Piutang Belum Lunas", value: formatCurrency(totalAR), sub: `${unpaidInvoiceCount} invoice`, bg: "#FEF2F2", border: "#FECACA", icon: "⚠️" },
                    { label: "Laba Bersih", value: formatCurrency(netProfit), sub: `Rev ${formatCurrency(totalRevenue)}`, bg: netProfit >= 0 ? "#F0FDF4" : "#FEF2F2", border: netProfit >= 0 ? "#BBF7D0" : "#FECACA", icon: netProfit >= 0 ? "📈" : "📉" },
                ].map((card) => (
                    <div key={card.label} className="stat-card" style={{ borderColor: card.border, background: card.bg }}>
                        <div className="flex items-start justify-between mb-2">
                            <span style={{ fontSize: 12, color: "#B89678", fontWeight: 500 }}>{card.label}</span>
                            <span style={{ fontSize: 18 }}>{card.icon}</span>
                        </div>
                        <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>{card.value}</div>
                        <div style={{ fontSize: 11, color: "#B89678" }}>{card.sub}</div>
                    </div>
                ))}
            </div>

            {/* Status produksi summary pills */}
            <div style={{ background: "white", border: "1px solid var(--border-light)", borderRadius: 10, padding: "0.875rem 1rem" }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#B89678", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Status Produksi Aktif ({activeJobs} order) — per order, periode terpilih
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {Object.entries(PRODUCTION_STATUS_LABELS).map(([key, label]) => (
                        <span key={key} className={`badge status-${key}`} style={{ fontSize: 12, padding: "3px 12px" }}>
                            {label}: <strong style={{ marginLeft: 4 }}>{statusCounts[key] || 0}</strong>
                        </span>
                    ))}

                    <span className="badge" style={{ background: "#DBEAFE", color: "#1D4ED8", fontSize: 12, padding: "3px 12px", borderRadius: 999 }}>
                        Dalam Pengiriman: <strong style={{ marginLeft: 4 }}>{suratJalans.filter(sj => sj.statusPengiriman === "Dikirim" || sj.statusPengiriman === "Dalam Perjalanan").length}</strong>
                    </span>

                    {overdueCount > 0 && (
                        <span className="badge" style={{ background: "#FEE2E2", color: "#B91C1C", fontSize: 12, padding: "3px 12px", borderRadius: 999 }}>
                            ⏰ Telat &gt;7 hari belum kirim: <strong style={{ marginLeft: 4 }}>{overdueCount}</strong>
                        </span>
                    )}
                </div>
            </div>

            {/* Charts row */}
            <div className="rgrid rgrid-main-side">
                {/* Line chart */}
                <div className="card">
                    <div className="card-header" style={{ fontSize: 13 }}>📊 Pemasukan vs Pengeluaran (Juta Rupiah)</div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={200}>
                            <LineChart data={monthlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#EFE1D1" />
                                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#B89678" }} />
                                <YAxis tick={{ fontSize: 11, fill: "#B89678" }} tickFormatter={(v) => `${v}jt`} />
                                <Tooltip formatter={(v) => `Rp ${Number(v).toFixed(1)} jt`} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8DCCF" }} />
                                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                <Line type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={2.5} dot={{ r: 4, fill: "#10b981" }} />
                                <Line type="monotone" dataKey="Pengeluaran" stroke="#A67B5B" strokeWidth={2.5} dot={{ r: 4, fill: "#A67B5B" }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Payment pie */}
                <div className="card">
                    <div className="card-header" style={{ fontSize: 13 }}>💳 Status Pembayaran (per order)</div>
                    <div className="card-body">
                        {paymentPie.length === 0 ? (
                            <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#C5A882", fontSize: 13, textAlign: "center" }}>
                                Belum ada order di periode ini.<br />Ganti bulan/tahun di kanan atas.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={200}>
                                <PieChart>
                                    <Pie data={paymentPie} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value"
                                        label={({ value }) => value}>
                                        {paymentPie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* Production bar + recent orders */}
            <div className="rgrid rgrid-half">
                <div className="card">
                    <div className="card-header" style={{ fontSize: 13 }}>🏭 Distribusi Status Produksi</div>
                    <div className="card-body">
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={prodData} layout="vertical">
                                <XAxis type="number" tick={{ fontSize: 11, fill: "#B89678" }} />
                                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#5C4033" }} width={110} />
                                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                    {prodData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recent orders */}
                <div className="card">
                    <div className="card-header" style={{ fontSize: 13 }}>📋 Order Terbaru (periode terpilih)</div>
                    <div style={{ overflowY: "auto", maxHeight: 220 }}>
                        {recentOrders.length === 0 ? (
                            <div style={{ height: 180, display: "flex", alignItems: "center", justifyContent: "center", color: "#C5A882", fontSize: 13, textAlign: "center" }}>
                                Belum ada order di periode ini.
                            </div>
                        ) : recentOrders.map((o) => (
                            <div key={o.key} style={{ display: "flex", alignItems: "center", padding: "0.625rem 1.25rem", borderBottom: "1px solid var(--border-light)", gap: "0.75rem" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customer}</div>
                                    <div style={{ fontSize: 11, color: "#B89678", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.deskripsi} • {o.itemCount} item</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dark)" }}>{formatCurrency(o.total)}</div>
                                    <div style={{ fontSize: 11, color: "#B89678" }}>{formatDate(o.tanggal)}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bank accounts row */}
            {lowStock > 0 && (
                <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 10, padding: "0.75rem 1rem", fontSize: 13, color: "#92400E" }}>
                    ⚠️ <strong>{lowStock} material</strong> di bawah stok minimum — segera lakukan pengisian stok.
                </div>
            )}
        </div>
    );
}
