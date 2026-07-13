"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvHpp {
    id: string;
    product_name: string;
    market_cut_percent: number;
    current_price: number;
}

const fields: CrudField[] = [
    { key: "product_name", label: "Nama Produk", type: "text" },
    { key: "market_cut_percent", label: "Potongan Market (%)", type: "number" },
    { key: "current_price", label: "Harga Jual Saat Ini", type: "number" },
];

const excelColumns: ExcelColumn[] = [
    { key: "product_name", header: "Nama Produk", type: "text" },
    { key: "market_cut_percent", header: "Potongan Market (%)", type: "number" },
    { key: "current_price", header: "Harga Jual Saat Ini", type: "number" },
];

export default function AlucurvHppPage() {
    const { rows, loading, insertRow, insertRows, deleteRow } = useAlucurvTable<AlucurvHpp>("alu_hpp_calculations", "product_name");

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Kalkulator HPP</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Daftar perhitungan HPP per produk. Rincian komponen biaya per produk akan ditambahkan di iterasi berikutnya.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} />
        </div>
    );
}
