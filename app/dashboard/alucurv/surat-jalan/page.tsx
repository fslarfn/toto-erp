"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvDeliveryNote {
    id: string;
    number: string;
    date: string;
    customer: string;
}

const fields: CrudField[] = [
    { key: "number", label: "No. Surat Jalan", type: "text" },
    { key: "date", label: "Tanggal", type: "date" },
    { key: "customer", label: "Customer", type: "text" },
];

const excelColumns: ExcelColumn[] = [
    { key: "number", header: "No. Surat Jalan", type: "text" },
    { key: "date", header: "Tanggal", type: "date" },
    { key: "customer", header: "Customer", type: "text" },
];

export default function AlucurvSuratJalanPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvDeliveryNote>("alu_delivery_notes", "date");

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Surat Jalan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Daftar surat jalan Alucurv. Rincian item per surat jalan akan ditambahkan di iterasi berikutnya.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
