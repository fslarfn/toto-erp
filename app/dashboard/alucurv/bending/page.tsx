"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvBendingOrder {
    id: string;
    date: string;
    inv_no: string;
    amount: number;
    status: string;
    note: string | null;
}

const fields: CrudField[] = [
    { key: "date", label: "Tanggal", type: "date", required: true },
    { key: "inv_no", label: "No. Invoice", type: "text", required: true },
    { key: "amount", label: "Nominal", type: "number", format: "currency" },
    { key: "status", label: "Status", type: "select", options: ["LUNAS", "BELUM"], required: true },
    { key: "note", label: "Catatan", type: "text" },
];

const excelColumns: ExcelColumn[] = [
    { key: "date", header: "Tanggal", type: "date" },
    { key: "inv_no", header: "No. Invoice", type: "text" },
    { key: "amount", header: "Nominal", type: "number" },
    { key: "status", header: "Status", type: "text", options: ["LUNAS", "BELUM"] },
    { key: "note", header: "Catatan", type: "text" },
];

export default function AlucurvBendingPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvBendingOrder>("alu_bending_orders", "date");

    const belumLunas = rows.filter((r) => r.status === "BELUM").reduce((s, r) => s + Number(r.amount || 0), 0);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Bending CV Toto</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Tagihan jasa bending ke vendor CV Toto.
            </p>
            <div style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border)", display: "inline-block" }}>
                <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase" }}>Belum Lunas</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)" }}>Rp {belumLunas.toLocaleString("id-ID")}</div>
            </div>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
