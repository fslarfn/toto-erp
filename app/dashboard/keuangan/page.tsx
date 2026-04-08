"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";

const BANK_ACCOUNTS = ["Bank BCA Toto", "Bank BCA Yanto", "Cash"];
const CATEGORIES_IN = ["Pembayaran Invoice", "DP Invoice", "Penjualan", "Lainnya"];
const CATEGORIES_OUT = ["Bahan Baku", "Gaji", "Operasional", "Transportasi", "Perawatan Mesin", "Lainnya"];

export default function KeuanganPage() {
    const { cashFlow, bankAccounts, addCashFlow } = useStore();

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
        await new Promise((r) => setTimeout(r, 300));
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

    const categoryOptions = form.type === "income" ? CATEGORIES_IN : CATEGORIES_OUT;

    return (
        <div className="page-content space-y-5">
            <div className="page-header">
                <div>
                    <h1 className="page-title-h1">Input Keuangan</h1>
                    <p className="page-subtitle">Manajemen kas dan riwayat transaksi</p>
                </div>
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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
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
                                <label className="form-label">Jumlah (Rp)</label>
                                <input type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} className="form-input" placeholder="500000" min="1" required />
                            </div>
                            <div>
                                <label className="form-label">Sumber / Tujuan Kas</label>
                                <select value={form.kas} onChange={(e) => setForm((p) => ({ ...p, kas: e.target.value }))} className="form-select">
                                    {BANK_ACCOUNTS.map((b) => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Keterangan</label>
                                <input type="text" value={form.keterangan} onChange={(e) => setForm((p) => ({ ...p, keterangan: e.target.value }))} className="form-input" placeholder="Keterangan transaksi..." required />
                            </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                            <button type="submit" disabled={saving} className="btn btn-primary" style={{ padding: "0.625rem 1.75rem" }}>
                                {saving ? "Menyimpan..." : "💾 Simpan Transaksi"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {/* Riwayat */}
            <div className="card">
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.875rem 1.25rem", borderBottom: "1px solid var(--border-light)" }}>
                    <span style={{ fontWeight: 600, color: "var(--text-dark)" }}>Riwayat Transaksi</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ fontSize: 12, color: "#B89678" }}>
                            Masuk: <strong style={{ color: "#10b981" }}>{formatCurrency(totalIn)}</strong> &nbsp;|&nbsp;
                            Keluar: <strong style={{ color: "#ef4444" }}>{formatCurrency(totalOut)}</strong>
                        </span>
                        <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="form-select" style={{ width: 150, fontSize: 12 }}>
                            <option value="semua">Semua Bulan</option>
                            {months.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                </div>
                <div className="table-container" style={{ border: "none", borderRadius: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Keterangan</th>
                                <th>Kategori</th>
                                <th>Sumber/Tujuan Kas</th>
                                <th>Tipe</th>
                                <th style={{ textAlign: "right" }}>Jumlah</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "#B89678" }}>Belum ada transaksi pada periode ini.</td></tr>
                            ) : (
                                [...filtered].sort((a, b) => b.date.localeCompare(a.date)).map((c) => (
                                    <tr key={c.id}>
                                        <td style={{ fontSize: 12 }}>{formatDate(c.date)}</td>
                                        <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</td>
                                        <td>
                                            <span className="badge" style={{ background: "#E8DCCF", color: "var(--text-dark)", fontSize: 11 }}>{c.category}</span>
                                        </td>
                                        <td style={{ fontSize: 12 }}>{c.bankAccount}</td>
                                        <td>
                                            <span className="badge" style={{ background: c.type === "income" ? "#D1FAE5" : "#FEE2E2", color: c.type === "income" ? "#065F46" : "#991B1B", fontSize: 11 }}>
                                                {c.type === "income" ? "Pemasukan" : "Pengeluaran"}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: "right", fontWeight: 600, color: c.type === "income" ? "#10b981" : "#ef4444" }}>
                                            {c.type === "income" ? "+" : "-"}{formatCurrency(c.amount)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
