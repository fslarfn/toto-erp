"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

const BANK_ACCOUNTS = ["Bank BCA Toto", "Bank BCA Yanto", "Cash"];
const CATEGORIES_IN = ["Pembayaran Invoice", "DP Invoice", "Penjualan", "Lainnya"];
const CATEGORIES_OUT = ["Bahan Baku", "Gaji", "Operasional", "Transportasi", "Perawatan Mesin", "Lainnya"];

export default function KeuanganPage() {
    const { cashFlow, bankAccounts, addCashFlow, deleteCashFlow, recalculateBalances } = useStore();

    const now = new Date();
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [filterMonth, setFilterMonth] = useState(thisMonthStr);
    const [form, setForm] = useState({
        tanggal: now.toISOString().slice(0, 10),
        type: "income" as "income" | "expense",
        category: "Pembayaran Invoice",
        amount: "",
        kas: "Bank BCA Toto",
        keterangan: "",
    });
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);

    const months = [...new Set([...cashFlow.map((c) => c.date.substring(0, 7)), thisMonthStr])].sort().reverse();

    const filtered = filterMonth === "semua"
        ? cashFlow
        : cashFlow.filter((c) => c.date.startsWith(filterMonth));

    const totalIn = filtered.filter((c) => c.type === "income").reduce((s, c) => s + c.amount, 0);
    const totalOut = filtered.filter((c) => c.type === "expense").reduce((s, c) => s + c.amount, 0);
    const netSaldo = bankAccounts.reduce((s, b) => s + b.balance, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        addCashFlow({
            type: form.type,
            category: form.category,
            amount: parseFloat(form.amount.replace(/[^0-9.]/g, "")) || 0,
            description: form.keterangan,
            date: form.tanggal,
            bankAccount: form.kas,
            createdBy: "finance",
        });
        setForm((p) => ({ ...p, amount: "", keterangan: "" }));
        setSaving(false);
    };

    const handleDelete = (id: string) => {
        if (confirm("Apakah Anda yakin ingin menghapus transaksi ini?")) {
            deleteCashFlow(id);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        recalculateBalances();
        await new Promise(r => setTimeout(r, 1000));
        setSyncing(false);
        alert("Sinkronisasi saldo selesai!");
    };

    const categoryOptions = form.type === "income" ? CATEGORIES_IN : CATEGORIES_OUT;

    return (
        <div className="page-content space-y-5">
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title-h1">Keuangan</h1>
                    <p className="page-subtitle">Manajemen kas dan riwayat transaksi</p>
                </div>
                <button 
                    onClick={handleSync}
                    disabled={syncing}
                    className="btn btn-secondary"
                    style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                >
                    {syncing ? "⌛ Menghitung..." : "🔄 Sinkronkan Saldo"}
                </button>
            </div>

            {/* Saldo Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.875rem" }}>
                {bankAccounts.map((b) => (
                    <div key={b.id} className="stat-card">
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#B89678", marginBottom: 4 }}>{b.name}</div>
                        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-dark)" }}>{formatCurrency(b.balance)}</div>
                    </div>
                ))}
                <div className="stat-card" style={{ background: "var(--primary)", border: "1px solid var(--primary-dark)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>Total Saldo</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "white" }}>{formatCurrency(netSaldo)}</div>
                </div>
            </div>

            {/* Form Input */}
            <div className="card">
                <div className="card-header">Input Transaksi Keuangan</div>
                <div className="card-body">
                    <form onSubmit={handleSubmit}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                            <div>
                                <label className="form-label">Tanggal</label>
                                <input type="date" value={form.tanggal} onChange={(e) => setForm((p) => ({ ...p, tanggal: e.target.value }))} className="form-input" required />
                            </div>
                            <div>
                                <label className="form-label">Tipe</label>
                                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as "income" | "expense", category: e.target.value === "income" ? "Pembayaran Invoice" : "Bahan Baku" }))} className="form-select">
                                    <option value="income">Pemasukan</option>
                                    <option value="expense">Pengeluaran</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Kategori</label>
                                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="form-select">
                                    {categoryOptions.map((c) => <option key={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Sumber / Tujuan Kas</label>
                                <select value={form.kas} onChange={(e) => setForm((p) => ({ ...p, kas: e.target.value }))} className="form-select">
                                    {BANK_ACCOUNTS.map((b) => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: "1rem", alignItems: "flex-end" }}>
                            <div>
                                <label className="form-label">Jumlah (Rp)</label>
                                <input
                                    type="text"
                                    value={form.amount}
                                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                                    placeholder="500000"
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label">Keterangan</label>
                                <input
                                    type="text"
                                    value={form.keterangan}
                                    onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))}
                                    placeholder="Keterangan transaksi..."
                                    className="form-input"
                                />
                            </div>
                            <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: "0.625rem 1.5rem" }}>
                                {saving ? "Menyimpan..." : "💾 Simpan Transaksi"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Riwayat Transaksi */}
            <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span>Riwayat Transaksi</span>
                    <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: 13 }}>
                        <span style={{ color: "#B89678" }}>
                            Masuk: <strong style={{ color: "#10b981" }}>{formatCurrency(totalIn)}</strong> |
                            Keluar: <strong style={{ color: "#ef4444" }}>{formatCurrency(totalOut)}</strong>
                        </span>
                        <select
                            className="form-select"
                            style={{ width: "auto", padding: "4px 8px", fontSize: 12 }}
                            value={filterMonth}
                            onChange={(e) => setFilterMonth(e.target.value)}
                        >
                            <option value="semua">Semua Periode</option>
                            {months.map((m) => (
                                <option key={m} value={m}>{m}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Keterangan</th>
                                <th>Kategori</th>
                                <th>Sumber/Tujuan Kas</th>
                                <th>Tipe</th>
                                <th style={{ textAlign: "right" }}>Jumlah</th>
                                <th style={{ width: 50 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontSize: 13 }}>{formatDate(c.date)}</td>
                                    <td style={{ fontWeight: 500 }}>{c.description}</td>
                                    <td>
                                        <span className="badge" style={{ background: "#FDF3E7", color: "#B89678" }}>{c.category}</span>
                                    </td>
                                    <td>{c.bankAccount}</td>
                                    <td>
                                        <span className={`badge ${c.type === "income" ? "status-siap_kirim" : "status-belum_produksi"}`} style={{ fontSize: 11 }}>
                                            {c.type === "income" ? "Pemasukan" : "Pengeluaran"}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: "right", fontWeight: 600, color: c.type === "income" ? "#10b981" : "#ef4444" }}>
                                        {c.type === "income" ? "+" : "-"}{formatCurrency(c.amount)}
                                    </td>
                                    <td style={{ textAlign: "center" }}>
                                        <button 
                                            onClick={() => handleDelete(c.id)}
                                            className="btn btn-ghost" 
                                            style={{ color: "#ef4444", padding: 4 }}
                                            title="Hapus Transaksi"
                                        >
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
