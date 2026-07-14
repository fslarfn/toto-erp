"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
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
}

const fields: CrudField[] = [
    { key: "date", label: "Tanggal", type: "date" },
    { key: "description", label: "Deskripsi", type: "text" },
    { key: "type", label: "Tipe", type: "select", options: ["Pemasukan", "Pengeluaran"] },
    { key: "amount", label: "Nominal", type: "number" },
    { key: "account_id", label: "Akun", type: "text" },
    { key: "note", label: "Catatan", type: "text" },
];

const excelColumns: ExcelColumn[] = [
    { key: "date", header: "Tanggal", type: "date" },
    { key: "description", header: "Deskripsi", type: "text" },
    { key: "type", header: "Tipe", type: "text", options: ["Pemasukan", "Pengeluaran"] },
    { key: "amount", header: "Nominal", type: "number" },
    { key: "account_id", header: "Akun", type: "text" },
    { key: "note", header: "Catatan", type: "text" },
];

export default function AlucurvKeuanganPage() {
    const { rows, loading, insertRow, insertRows, deleteRow } = useAlucurvTable<AlucurvTransaction>("alu_transactions", "date");

    const totalMasuk = rows.filter((r) => r.type === "Pemasukan").reduce((s, r) => s + Number(r.amount || 0), 0);
    const totalKeluar = rows.filter((r) => r.type === "Pengeluaran").reduce((s, r) => s + Number(r.amount || 0), 0);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Keuangan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Catatan kas masuk/keluar Alucurv. Isi Akun dengan ID akun dari halaman Pengaturan (mis. nama akun kas/bank).
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
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} />
        </div>
    );
}
