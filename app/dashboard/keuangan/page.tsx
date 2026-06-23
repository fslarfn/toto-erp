"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CashFlow } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";
import ReconciliationPanel from "@/components/ReconciliationPanel";
import { computeTotals } from "@/lib/balance";

const BANK_ACCOUNTS = ["Bank BCA Toto", "Bank BCA Yanto", "Cash"];
const CATEGORIES_IN = ["Pembayaran Invoice", "DP Invoice", "Penjualan", "Lainnya"];
const CATEGORIES_OUT = ["Bahan Baku", "Gaji", "Operasional", "Transportasi", "Perawatan Mesin", "Lainnya"];

type FormState = {
    tanggal: string;
    type: "income" | "expense";
    category: string;
    amount: string;
    kas: string;
    keterangan: string;
    isTest?: boolean;
    isAdjustment?: boolean;
};

export default function KeuanganPage() {
    const { cashFlow, bankAccounts, addCashFlow, updateCashFlow, deleteCashFlow, addTransfer, getComputedBalance, reconcile, syncAllBalances } = useStore();

    const now = new Date();
    const thisMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [filterMonth, setFilterMonth] = useState(thisMonthStr);
    const [searchKeterangan, setSearchKeterangan] = useState("");
    const [showTest, setShowTest] = useState(false);

    // Opsi kas: dari bank_accounts (agar account_id ter-resolve), fallback ke daftar statis.
    const kasOptions = bankAccounts.length ? bankAccounts.map((b) => b.name) : BANK_ACCOUNTS;

    // ── Mutasi antar kas ──
    const [transfer, setTransfer] = useState({
        from: "", to: "", amount: "", date: now.toISOString().slice(0, 10), keterangan: "",
    });
    const [form, setForm] = useState<FormState>({
        tanggal: now.toISOString().slice(0, 10),
        type: "income",
        category: "Pembayaran Invoice",
        amount: "",
        kas: "Bank BCA Toto",
        keterangan: "",
    });
    const [saving, setSaving] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // ── Edit Modal state ───────────────────────────────────────
    const [editingTx, setEditingTx] = useState<CashFlow | null>(null);
    const [editForm, setEditForm] = useState<FormState>({
        tanggal: "", type: "income", category: "", amount: "", kas: "", keterangan: "",
    });
    const [editSaving, setEditSaving] = useState(false);
    const [toastMsg, setToastMsg] = useState("");

    const showToast = (msg: string) => {
        setToastMsg(msg);
        setTimeout(() => setToastMsg(""), 3000);
    };

    const months = [...new Set([...cashFlow.map((c) => c.date.substring(0, 7)), thisMonthStr])].sort().reverse();

    const filtered = cashFlow
        .filter((c) => showTest || !c.isTest)
        .filter((c) => filterMonth === "semua" || c.date.startsWith(filterMonth))
        .filter((c) => !searchKeterangan.trim() || c.description.toLowerCase().includes(searchKeterangan.toLowerCase().trim()));

    // Masuk/Keluar: KECUALIKAN mutasi antar-kas (transfer internal bukan omzet/biaya).
    // `filtered` sudah menerapkan toggle test → pakai includeTest:true di sini.
    const { income: totalIn, expense: totalOut } = computeTotals(filtered, { includeTest: true });

    // Saldo TERHITUNG (sumber kebenaran) — bukan field tersimpan.
    const computedFor = (id: string) => getComputedBalance(id, { includeTest: showTest });
    const netSaldo = bankAccounts.reduce((s, b) => s + computedFor(b.id), 0);
    const recRows = reconcile();

    // ── Form Input handlers ────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // Peringatan: transfer internal harus lewat "Mutasi Antar Kas", bukan transaksi biasa.
        if (/mutasi/i.test(form.keterangan)) {
            const tetap = confirm(
                "Sepertinya ini transfer antar kas (\"MUTASI\").\n\n" +
                "Sebaiknya gunakan fitur \"🔁 Mutasi Antar Kas\" agar tercatat sebagai pasangan " +
                "dan TIDAK terhitung sebagai pemasukan/pengeluaran operasional.\n\n" +
                "Tetap simpan sebagai transaksi biasa?"
            );
            if (!tetap) return;
        }
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
        const summary = await syncAllBalances();
        setSyncing(false);
        const changed = summary.filter((s) => Math.abs(s.diff) > 0.01);
        if (changed.length === 0) {
            showToast("✅ Semua saldo sudah seimbang");
        } else {
            const detail = changed.map((s) => `${s.name}: ${s.diff > 0 ? "+" : ""}${formatCurrency(s.diff)}`).join(" · ");
            showToast(`✅ ${changed.length} akun disinkronkan — ${detail}`);
        }
    };

    const handleTransfer = (e: React.FormEvent) => {
        e.preventDefault();
        const amount = parseFloat(transfer.amount.replace(/[^0-9.]/g, "")) || 0;
        if (!transfer.from || !transfer.to || transfer.from === transfer.to || amount <= 0) {
            alert("Pilih kas sumber & tujuan yang berbeda dan jumlah > 0.");
            return;
        }
        const fromAcc = bankAccounts.find((b) => b.name === transfer.from);
        const toAcc = bankAccounts.find((b) => b.name === transfer.to);
        if (!fromAcc || !toAcc) { alert("Akun kas tidak ditemukan."); return; }
        addTransfer({
            fromAccountId: fromAcc.id,
            toAccountId: toAcc.id,
            amount,
            date: transfer.date,
            description: transfer.keterangan || `Mutasi ${transfer.from} → ${transfer.to}`,
            createdBy: "finance",
        });
        setTransfer((p) => ({ ...p, amount: "", keterangan: "" }));
        showToast("✅ Mutasi antar kas tercatat (pasangan masuk + keluar)");
    };

    const categoryOptions = form.type === "income" ? CATEGORIES_IN : CATEGORIES_OUT;

    // ── Edit Modal handlers ────────────────────────────────────
    const handleEditOpen = (tx: CashFlow) => {
        setEditingTx(tx);
        setEditForm({
            tanggal: tx.date,
            type: tx.type,
            category: tx.category,
            amount: String(tx.amount),
            kas: tx.bankAccount,
            keterangan: tx.description,
            isTest: tx.isTest,
            isAdjustment: tx.isAdjustment,
        });
    };

    const handleEditClose = () => {
        setEditingTx(null);
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTx) return;

        const parsedAmount = parseFloat(editForm.amount.replace(/[^0-9.]/g, "")) || 0;
        if (parsedAmount <= 0) {
            alert("Jumlah harus lebih dari 0.");
            return;
        }

        setEditSaving(true);
        updateCashFlow(editingTx.id, {
            date: editForm.tanggal,
            type: editForm.type,
            category: editForm.category,
            amount: parsedAmount,
            bankAccount: editForm.kas,
            description: editForm.keterangan,
            isTest: !!editForm.isTest,
            isAdjustment: !!editForm.isAdjustment,
        });
        setEditSaving(false);
        setEditingTx(null);
        showToast("✅ Transaksi berhasil diperbarui");
    };

    const editCategoryOptions = editForm.type === "income" ? CATEGORIES_IN : CATEGORIES_OUT;

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
                        <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "var(--text-dark)" }}>{formatCurrency(computedFor(b.id))}</div>
                    </div>
                ))}
                <div className="stat-card" style={{ background: "var(--primary)", border: "1px solid var(--primary-dark)" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.75)", marginBottom: 4 }}>Total Saldo</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, color: "white" }}>{formatCurrency(netSaldo)}</div>
                </div>
            </div>

            {/* Panel Rekonsiliasi: stored vs computed vs selisih */}
            <ReconciliationPanel rows={recRows} syncing={syncing} onSync={handleSync} />

            {/* Mutasi Antar Kas (pasangan income+expense, total tetap balance) */}
            <div className="card">
                <div className="card-header">🔁 Mutasi Antar Kas</div>
                <div className="card-body">
                    <form onSubmit={handleTransfer}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "1rem", alignItems: "flex-end" }}>
                            <div>
                                <label className="form-label">Dari Kas</label>
                                <select value={transfer.from} onChange={(e) => setTransfer((p) => ({ ...p, from: e.target.value }))} className="form-select" required>
                                    <option value="" disabled>Pilih kas…</option>
                                    {kasOptions.map((b) => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Ke Kas</label>
                                <select value={transfer.to} onChange={(e) => setTransfer((p) => ({ ...p, to: e.target.value }))} className="form-select" required>
                                    <option value="" disabled>Pilih kas…</option>
                                    {kasOptions.map((b) => <option key={b}>{b}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Jumlah (Rp)</label>
                                <input type="text" value={transfer.amount} onChange={(e) => setTransfer((p) => ({ ...p, amount: e.target.value }))} placeholder="500000" className="form-input" required />
                            </div>
                            <div>
                                <label className="form-label">Tanggal</label>
                                <input type="date" value={transfer.date} onChange={(e) => setTransfer((p) => ({ ...p, date: e.target.value }))} className="form-input" required />
                            </div>
                            <button type="submit" className="btn btn-secondary" style={{ padding: "0.625rem 1.25rem", whiteSpace: "nowrap" }}>🔁 Catat Mutasi</button>
                        </div>
                    </form>
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
                                    {kasOptions.map((b) => <option key={b}>{b}</option>)}
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
                <div className="card-header" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <span>Riwayat Transaksi</span>
                        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: 13, flexWrap: "wrap" }}>
                            <span style={{ color: "#B89678" }}>
                                Masuk: <strong style={{ color: "#10b981" }}>{formatCurrency(totalIn)}</strong> |
                                Keluar: <strong style={{ color: "#ef4444" }}>{formatCurrency(totalOut)}</strong>
                            </span>
                            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#8A7B6E", cursor: "pointer" }}>
                                <input type="checkbox" checked={showTest} onChange={(e) => setShowTest(e.target.checked)} />
                                Tampilkan entri uji/test
                            </label>
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
                    <div style={{ position: "relative" }}>
                        <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, pointerEvents: "none", opacity: 0.4 }}>🔍</span>
                        <input
                            type="text"
                            placeholder="Cari keterangan transaksi..."
                            value={searchKeterangan}
                            onChange={(e) => setSearchKeterangan(e.target.value)}
                            style={{ width: "100%", padding: "7px 32px 7px 32px", borderRadius: 8, border: "1.5px solid #e5e0d8", fontSize: 13, background: "#faf8f5", outline: "none", boxSizing: "border-box" as const }}
                            onFocus={(e) => (e.target.style.borderColor = "#B89678")}
                            onBlur={(e) => (e.target.style.borderColor = "#e5e0d8")}
                        />
                        {searchKeterangan && (
                            <button
                                onClick={() => setSearchKeterangan("")}
                                style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, opacity: 0.5, padding: 2 }}
                            >✕</button>
                        )}
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
                                <th style={{ width: 80, textAlign: "center" }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((c) => (
                                <tr key={c.id}>
                                    <td style={{ fontSize: 13 }}>{formatDate(c.date)}</td>
                                    <td style={{ fontWeight: 500 }}>
                                        {c.description}
                                        {c.isTest && <span className="badge" style={{ marginLeft: 6, background: "#FEF3C7", color: "#B45309", fontSize: 10 }}>TEST</span>}
                                        {c.isAdjustment && <span className="badge" style={{ marginLeft: 6, background: "#E0E7FF", color: "#4338CA", fontSize: 10 }}>ADJ</span>}
                                        {c.transferGroup && <span className="badge" style={{ marginLeft: 6, background: "#DBEAFE", color: "#1D4ED8", fontSize: 10 }}>MUTASI</span>}
                                    </td>
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
                                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                        <button
                                            onClick={() => handleEditOpen(c)}
                                            className="btn btn-ghost"
                                            style={{ color: "#A67B5B", padding: 4 }}
                                            title="Edit Transaksi"
                                        >
                                            ✏️
                                        </button>
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

            {/* ── Edit Modal ─────────────────────────────────────────── */}
            {editingTx && (
                <div
                    style={{
                        position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
                        padding: "1rem",
                    }}
                    onClick={(e) => { if (e.target === e.currentTarget) handleEditClose(); }}
                >
                    <div style={{
                        background: "white", borderRadius: 12, width: "100%", maxWidth: 560,
                        boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                        border: "1px solid #E6D5BE",
                    }}>
                        {/* Modal Header */}
                        <div style={{
                            padding: "16px 20px", borderBottom: "1px solid #E6D5BE",
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            background: "#FDF8F3", borderRadius: "12px 12px 0 0",
                        }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#5C4033" }}>✏️ Edit Transaksi</span>
                            <button
                                onClick={handleEditClose}
                                style={{
                                    background: "none", border: "none", fontSize: 18,
                                    cursor: "pointer", color: "#B89678", lineHeight: 1,
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleEditSubmit}>
                            <div style={{ padding: "20px" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                                    <div>
                                        <label className="form-label">Tanggal</label>
                                        <input
                                            type="date"
                                            value={editForm.tanggal}
                                            onChange={(e) => setEditForm(p => ({ ...p, tanggal: e.target.value }))}
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Tipe</label>
                                        <select
                                            value={editForm.type}
                                            onChange={(e) => setEditForm(p => ({
                                                ...p,
                                                type: e.target.value as "income" | "expense",
                                                category: e.target.value === "income" ? CATEGORIES_IN[0] : CATEGORIES_OUT[0],
                                            }))}
                                            className="form-select"
                                        >
                                            <option value="income">Pemasukan</option>
                                            <option value="expense">Pengeluaran</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Kategori</label>
                                        <select
                                            value={editForm.category}
                                            onChange={(e) => setEditForm(p => ({ ...p, category: e.target.value }))}
                                            className="form-select"
                                        >
                                            {editCategoryOptions.map((c) => <option key={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="form-label">Sumber / Tujuan Kas</label>
                                        <select
                                            value={editForm.kas}
                                            onChange={(e) => setEditForm(p => ({ ...p, kas: e.target.value }))}
                                            className="form-select"
                                        >
                                            {kasOptions.map((b) => <option key={b}>{b}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1rem" }}>
                                    <div>
                                        <label className="form-label">Jumlah (Rp)</label>
                                        <input
                                            type="text"
                                            value={editForm.amount}
                                            onChange={(e) => setEditForm(p => ({ ...p, amount: e.target.value }))}
                                            placeholder="500000"
                                            className="form-input"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="form-label">Keterangan</label>
                                        <input
                                            type="text"
                                            value={editForm.keterangan}
                                            onChange={(e) => setEditForm(p => ({ ...p, keterangan: e.target.value }))}
                                            placeholder="Keterangan transaksi..."
                                            className="form-input"
                                        />
                                    </div>
                                </div>
                                {/* Penanda non-riil (jangan hapus data — cukup di-flag) */}
                                <div style={{ display: "flex", gap: 20, marginTop: 14, fontSize: 13, color: "#6B5B4D" }}>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                        <input type="checkbox" checked={!!editForm.isTest} onChange={(e) => setEditForm(p => ({ ...p, isTest: e.target.checked }))} />
                                        Entri uji/test (dikecualikan dari laporan)
                                    </label>
                                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                                        <input type="checkbox" checked={!!editForm.isAdjustment} onChange={(e) => setEditForm(p => ({ ...p, isAdjustment: e.target.checked }))} />
                                        Penyesuaian (adjustment)
                                    </label>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div style={{
                                padding: "14px 20px", borderTop: "1px solid #E6D5BE",
                                display: "flex", justifyContent: "flex-end", gap: 10,
                                background: "#FDF8F3", borderRadius: "0 0 12px 12px",
                            }}>
                                <button
                                    type="button"
                                    onClick={handleEditClose}
                                    className="btn btn-secondary"
                                    style={{ padding: "8px 20px" }}
                                >
                                    Batal
                                </button>
                                <button
                                    type="submit"
                                    disabled={editSaving}
                                    className="btn btn-primary"
                                    style={{ padding: "8px 20px" }}
                                >
                                    {editSaving ? "Menyimpan..." : "💾 Simpan Perubahan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Toast Notification ─────────────────────────────────── */}
            {toastMsg && (
                <div style={{
                    position: "fixed", bottom: 28, right: 28, zIndex: 2000,
                    background: "#DCFCE7", color: "#15803D", fontWeight: 600, fontSize: 13,
                    padding: "12px 20px", borderRadius: 10,
                    border: "1px solid #86EFAC",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
                    animation: "fadeIn 0.2s ease",
                }}>
                    {toastMsg}
                </div>
            )}
        </div>
    );
}
