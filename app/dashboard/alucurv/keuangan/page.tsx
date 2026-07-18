"use client";
import { useState } from "react";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import { computeAluTotals } from "@/lib/alucurv/transaksi";
import { supabase } from "@/lib/supabase-client";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvTransaction {
    id: string;
    date: string;
    description: string;
    type: string;
    sub_category_id: string | null;
    amount: number;
    account_id: string | null;
    note: string | null;
    transfer_group?: string | null;
}
interface AlucurvAccount { id: string; name: string }
interface AlucurvSubCategory { id: string; name: string; type: string }

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export default function AlucurvKeuanganPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow, refresh } = useAlucurvTable<AlucurvTransaction>("alu_transactions", "date");
    const accounts = useAlucurvTable<AlucurvAccount>("alu_accounts", "name");
    const subCategories = useAlucurvTable<AlucurvSubCategory>("alu_sub_categories", "name");

    // ── Saldo akun (untuk validasi saldo negatif) ─────────────
    // Sumber: view v_alu_account_balances (dihitung di DB, akurat).
    // Bila view belum di-run → null (validasi dilewati, insert tetap jalan).
    const accountBalanceOf = async (accountId: string): Promise<number | null> => {
        const { data, error } = await supabase
            .from("v_alu_account_balances")
            .select("computed_balance")
            .eq("id", accountId)
            .maybeSingle();
        if (error || !data) return null;
        return Number(data.computed_balance) || 0;
    };

    const accountNameOf = (id: string) => accounts.rows.find((a) => a.id === id)?.name ?? "akun ini";

    /** Konfirmasi bila pengeluaran membuat saldo akun negatif. true = lanjut. */
    const confirmIfNegative = async (accountId: string, amount: number): Promise<boolean> => {
        if (!accountId || amount <= 0) return true;
        const bal = await accountBalanceOf(accountId);
        if (bal === null || amount <= bal) return true;
        return window.confirm(
            `⚠️ PERINGATAN SALDO NEGATIF\n\n` +
            `Saldo ${accountNameOf(accountId)} saat ini: ${rupiah(bal)}\n` +
            `Pengeluaran ini: ${rupiah(amount)}\n` +
            `Saldo sesudahnya: ${rupiah(bal - amount)} (NEGATIF)\n\n` +
            `Kemungkinan ada transaksi yang salah akun, nominal keliru, ` +
            `atau saldo awal akun belum diisi.\n\nTetap simpan?`
        );
    };

    const handleAdd = async (values: Record<string, unknown>) => {
        if (values.type === "Pengeluaran") {
            const ok = await confirmIfNegative(String(values.account_id ?? ""), Number(values.amount || 0));
            if (!ok) return null; // batal tanpa pesan error
        }
        return insertRow(values);
    };

    // ── Mutasi antar akun (pasangan keluar+masuk, transfer_group sama) ──
    const now = new Date();
    const [mutasi, setMutasi] = useState({ from: "", to: "", amount: "", date: now.toISOString().slice(0, 10), ket: "" });
    const [mutasiMsg, setMutasiMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [mutasiSaving, setMutasiSaving] = useState(false);

    const handleMutasi = async (e: React.FormEvent) => {
        e.preventDefault();
        setMutasiMsg(null);
        const amount = Number(mutasi.amount || 0);
        if (!mutasi.from || !mutasi.to || mutasi.from === mutasi.to || amount <= 0) {
            setMutasiMsg({ ok: false, text: "Pilih akun sumber & tujuan yang berbeda dan nominal > 0." });
            return;
        }
        const ok = await confirmIfNegative(mutasi.from, amount);
        if (!ok) return;
        setMutasiSaving(true);
        const group = `mutasi-${Date.now()}`;
        const desc = mutasi.ket.trim() || `Mutasi ${accountNameOf(mutasi.from)} → ${accountNameOf(mutasi.to)}`;
        const base = { date: mutasi.date, description: desc, sub_category_id: null, note: null, transfer_group: group };
        const err = await insertRows([
            { ...base, type: "Pengeluaran", amount, account_id: mutasi.from },
            { ...base, type: "Pemasukan", amount, account_id: mutasi.to },
        ]);
        setMutasiSaving(false);
        if (err) {
            const m = err instanceof Error ? err.message : String((err as { message?: string })?.message ?? err);
            setMutasiMsg({
                ok: false,
                text: /transfer_group/i.test(m)
                    ? "Kolom transfer_group belum ada — jalankan dulu migrasi supabase/migrations/20260718_alucurv_mutasi.sql di Supabase."
                    : `Gagal mencatat mutasi: ${m}`,
            });
        } else {
            setMutasiMsg({ ok: true, text: "✅ Mutasi tercatat sebagai pasangan keluar + masuk (tidak dihitung omzet/biaya)." });
            setMutasi((p) => ({ ...p, amount: "", ket: "" }));
            refresh();
        }
    };

    const accountOptions = accounts.rows.map((a) => ({ value: a.id, label: a.name }));
    // Semua kategori (dipakai untuk lookup Excel & tabel, di situ tidak ada konteks Tipe yang dipilih).
    const subCategoryOptionsAll = subCategories.rows.map((c) => ({ value: c.id, label: c.name }));

    const fields: CrudField[] = [
        { key: "date", label: "Tanggal", type: "date", required: true },
        { key: "description", label: "Deskripsi", type: "text", required: true },
        { key: "type", label: "Tipe", type: "select", options: ["Pemasukan", "Pengeluaran"], required: true },
        {
            key: "sub_category_id",
            label: "Kategori",
            type: "select",
            // Cuma tampilkan kategori yang tipe-nya cocok dengan Tipe yang sedang dipilih di form —
            // sebelumnya semua kategori campur, jadi gampang salah pilih (transaksi Pemasukan
            // ketaut ke kategori pengeluaran, bikin Laporan Bulanan tampil rancu).
            optionsMap: (form) =>
                subCategories.rows
                    .filter((c) => !form.type || c.type === form.type)
                    .map((c) => ({ value: c.id, label: c.name })),
        },
        { key: "amount", label: "Nominal", type: "number", format: "currency" },
        { key: "account_id", label: "Akun", type: "select", optionsMap: accountOptions },
        { key: "note", label: "Catatan", type: "text" },
    ];

    const excelColumns: ExcelColumn[] = [
        { key: "date", header: "Tanggal", type: "date" },
        { key: "description", header: "Deskripsi", type: "text" },
        { key: "type", header: "Tipe", type: "text", options: ["Pemasukan", "Pengeluaran"] },
        { key: "sub_category_id", header: "Kategori", type: "text", lookup: subCategoryOptionsAll },
        { key: "amount", header: "Nominal", type: "number" },
        { key: "account_id", header: "Akun", type: "text", lookup: accountOptions },
        { key: "note", header: "Catatan", type: "text" },
    ];

    // Mutasi antar akun DIKECUALIKAN dari total operasional (lib/alucurv/transaksi).
    const { masuk: totalMasuk, keluar: totalKeluar } = computeAluTotals(rows);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Keuangan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Catatan kas masuk/keluar Alucurv. Akun &amp; Kategori mengikuti master data di Pengaturan.
            </p>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                <div style={{ padding: "10px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase" }}>Total Pemasukan</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)" }}>Rp {totalMasuk.toLocaleString("id-ID")}</div>
                </div>
                <div style={{ padding: "10px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase" }}>Total Pengeluaran</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)" }}>Rp {totalKeluar.toLocaleString("id-ID")}</div>
                </div>
            </div>
            {/* Mutasi Antar Akun */}
            <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>🔁 Mutasi Antar Akun</div>
                <form onSubmit={handleMutasi} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={mutasiLabel}>Dari Akun</label>
                        <select value={mutasi.from} onChange={(e) => setMutasi((p) => ({ ...p, from: e.target.value }))} style={mutasiInput} required>
                            <option value="" disabled>Pilih akun…</option>
                            {accounts.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={mutasiLabel}>Ke Akun</label>
                        <select value={mutasi.to} onChange={(e) => setMutasi((p) => ({ ...p, to: e.target.value }))} style={mutasiInput} required>
                            <option value="" disabled>Pilih akun…</option>
                            {accounts.rows.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                        </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={mutasiLabel}>Nominal</label>
                        <input type="number" value={mutasi.amount} onChange={(e) => setMutasi((p) => ({ ...p, amount: e.target.value }))} placeholder="500000" style={mutasiInput} required />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={mutasiLabel}>Tanggal</label>
                        <input type="date" value={mutasi.date} onChange={(e) => setMutasi((p) => ({ ...p, date: e.target.value }))} style={mutasiInput} required />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 160 }}>
                        <label style={mutasiLabel}>Keterangan (opsional)</label>
                        <input type="text" value={mutasi.ket} onChange={(e) => setMutasi((p) => ({ ...p, ket: e.target.value }))} placeholder="cth: tarik saldo Shopee ke BCA" style={{ ...mutasiInput, width: "100%" }} />
                    </div>
                    <button type="submit" disabled={mutasiSaving} style={{ fontSize: 12, padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "white", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                        {mutasiSaving ? "Menyimpan..." : "🔁 Catat Mutasi"}
                    </button>
                </form>
                {mutasiMsg && (
                    <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 600, color: mutasiMsg.ok ? "#16A34A" : "#DC2626" }}>{mutasiMsg.text}</div>
                )}
                <p style={{ fontSize: 10.5, color: "var(--text-med)", marginTop: 8 }}>
                    Mutasi dicatat sebagai pasangan keluar + masuk dan <strong>tidak dihitung</strong> sebagai pemasukan/pengeluaran operasional.
                </p>
            </div>

            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={handleAdd} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}

const mutasiLabel: React.CSSProperties = { fontSize: 10, color: "var(--text-med)", fontWeight: 600, textTransform: "uppercase" };
const mutasiInput: React.CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", minWidth: 130, color: "var(--text-dark)" };
