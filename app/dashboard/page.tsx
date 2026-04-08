"use client";
import { useStore } from "@/lib/store";
import { useAuth, roleLabels } from "@/lib/auth";
import { formatCurrency, formatDate, PRODUCTION_STATUS_LABELS } from "@/lib/utils";
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
    const { orders, cashFlow, materials, bankAccounts } = useStore();
    const { user } = useAuth();

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const thisMonthOrders = orders.filter((o) => o.orderDate.startsWith(thisMonth));
    const totalRevenue = cashFlow.filter((c) => c.type === "income").reduce((s, c) => s + c.amount, 0);
    const totalExpense = cashFlow.filter((c) => c.type === "expense").reduce((s, c) => s + c.amount, 0);
    const netProfit = totalRevenue - totalExpense;
    const totalAR = orders.filter((o) => o.paymentStatus !== "lunas").reduce((s, o) => s + (o.totalPrice - o.paidAmount), 0);
    const totalSaldo = bankAccounts.reduce((s, b) => s + b.balance, 0);
    const lowStock = materials.filter((m) => m.currentStock <= m.minimumStock).length;
    const activeJobs = orders.filter((o) => o.productionStatus !== "di_kirim").length;

    // Monthly chart data
    const monthlyData = (() => {
        const map: Record<string, { income: number; expense: number }> = {};
        cashFlow.forEach((c) => {
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

    // Payment pie
    const paymentPie = [
        { name: "Belum Bayar", value: orders.filter((o) => o.paymentStatus === "belum_bayar").length },
        { name: "Bayar Sebagian", value: orders.filter((o) => o.paymentStatus === "bayar_sebagian").length },
        { name: "Lunas", value: orders.filter((o) => o.paymentStatus === "lunas").length },
    ].filter((d) => d.value > 0);

    // Production status bar
    const prodData = Object.entries(
        orders.reduce((acc, o) => {
            acc[o.productionStatus] = (acc[o.productionStatus] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)
    ).map(([status, count]) => ({
        name: PRODUCTION_STATUS_LABELS[status] ?? status,
        count,
        fill: PROD_COLORS[status] ?? "#D1BFA3",
    }));

    const recentOrders = [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

    return (
        <div className="page-content space-y-5">
            {/* Page header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title-h1">Dashboard Performa Usaha</h1>
                    <p className="page-subtitle">
                        Selamat datang, <strong style={{ color: "var(--text-dark)" }}>{user?.name}</strong> &nbsp;—&nbsp;
                        {now.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                    </p>
                </div>
            </div>

            {/* KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem" }}>
                {[
                    { label: "Order Bulan Ini", value: `${thisMonthOrders.length} order`, sub: formatCurrency(thisMonthOrders.reduce((s, o) => s + o.totalPrice, 0)), bg: "#FDF3E7", border: "#E8DCCF", icon: "📦" },
                    { label: "Total Saldo", value: formatCurrency(totalSaldo), sub: `${bankAccounts.length} rekening`, bg: "#FDF3E7", border: "#E8DCCF", icon: "🏦" },
                    { label: "Piutang Belum Lunas", value: formatCurrency(totalAR), sub: `${orders.filter((o) => o.paymentStatus !== "lunas").length} invoice`, bg: "#FEF2F2", border: "#FECACA", icon: "⚠️" },
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
                    Status Produksi Aktif ({activeJobs} order)
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {Object.entries(PRODUCTION_STATUS_LABELS).map(([key, label]) => {
                        const count = orders.filter((o) => o.productionStatus === key).length;
                        return (
                            <span key={key} className={`badge status-${key}`} style={{ fontSize: 12, padding: "3px 12px" }}>
                                {label}: <strong style={{ marginLeft: 4 }}>{count}</strong>
                            </span>
                        );
                    })}
                </div>
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1rem" }}>
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
                    <div className="card-header" style={{ fontSize: 13 }}>💳 Status Pembayaran</div>
                    <div className="card-body">
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
                    </div>
                </div>
            </div>

            {/* Production bar + recent orders */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
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
                    <div className="card-header" style={{ fontSize: 13 }}>📋 Order Terbaru</div>
                    <div style={{ overflowY: "auto", maxHeight: 220 }}>
                        {recentOrders.map((o) => (
                            <div key={o.id} style={{ display: "flex", alignItems: "center", padding: "0.625rem 1.25rem", borderBottom: "1px solid var(--border-light)", gap: "0.75rem" }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-dark)", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.customerName}</div>
                                    <div style={{ fontSize: 11, color: "#B89678" }}>{o.description} • {o.qty} pcs</div>
                                </div>
                                <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-dark)" }}>{formatCurrency(o.totalPrice)}</div>
                                    <div style={{ fontSize: 11, color: "#B89678" }}>{formatDate(o.orderDate)}</div>
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
