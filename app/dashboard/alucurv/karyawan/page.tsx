"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvEmployee {
    id: string;
    name: string;
    role: string | null;
    division: string;
    weekly_base: number;
    active: boolean;
}

const fields: CrudField[] = [
    { key: "name", label: "Nama", type: "text" },
    { key: "role", label: "Jabatan", type: "text" },
    { key: "division", label: "Divisi", type: "select", options: ["Produksi", "Admin", "Marketing"] },
    { key: "weekly_base", label: "Gaji Mingguan", type: "number", format: "currency" },
    { key: "active", label: "Aktif", type: "checkbox" },
];

const excelColumns: ExcelColumn[] = [
    { key: "name", header: "Nama", type: "text" },
    { key: "role", header: "Jabatan", type: "text" },
    { key: "division", header: "Divisi", type: "text", options: ["Produksi", "Admin", "Marketing"] },
    { key: "weekly_base", header: "Gaji Mingguan", type: "number" },
    { key: "active", header: "Aktif", type: "boolean" },
];

export default function AlucurvKaryawanPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvEmployee>("alu_employees", "name");

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Karyawan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Data karyawan Alucurv — sengaja terpisah dari data karyawan Toto. Absensi, gaji, dan kasbon akan ditambahkan di iterasi berikutnya.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
