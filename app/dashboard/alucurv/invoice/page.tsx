"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvInvoice {
    id: string;
    number: string;
    date: string;
    customer: string;
    status: string;
    dp_amount: number | null;
    paid_date: string | null;
    payment: string | null;
    note: string | null;
}

const fields: CrudField[] = [
    { key: "number", label: "No. Invoice", type: "text" },
    { key: "date", label: "Tanggal", type: "date" },
    { key: "customer", label: "Customer", type: "text" },
    { key: "status", label: "Status", type: "select", options: ["LUNAS", "DP", "BELUM"] },
    { key: "dp_amount", label: "Nominal DP", type: "number" },
    { key: "paid_date", label: "Tgl Lunas", type: "date" },
    { key: "payment", label: "Pembayaran", type: "select", options: ["TRANSFER", "CASH"] },
    { key: "note", label: "Catatan", type: "text" },
];

const excelColumns: ExcelColumn[] = [
    { key: "number", header: "No. Invoice", type: "text" },
    { key: "date", header: "Tanggal", type: "date" },
    { key: "customer", header: "Customer", type: "text" },
    { key: "status", header: "Status", type: "text", options: ["LUNAS", "DP", "BELUM"] },
    { key: "dp_amount", header: "Nominal DP", type: "number" },
    { key: "payment", header: "Pembayaran", type: "text", options: ["TRANSFER", "CASH"] },
    { key: "note", header: "Catatan", type: "text" },
];

export default function AlucurvInvoicePage() {
    const { rows, loading, insertRow, insertRows, deleteRow } = useAlucurvTable<AlucurvInvoice>("alu_invoices", "date");

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Invoice / Nota</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Daftar invoice Alucurv. Rincian item per invoice akan ditambahkan di iterasi berikutnya — untuk sekarang kelola header invoice (nomor, customer, status pembayaran) di sini.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} />
        </div>
    );
}
