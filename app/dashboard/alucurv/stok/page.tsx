"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvStockItem {
    id: string;
    code: string;
    name: string;
    category: string;
    min_stock: number;
    opening_stock: number;
}

const fields: CrudField[] = [
    { key: "code", label: "Kode", type: "text" },
    { key: "name", label: "Nama Barang", type: "text" },
    { key: "category", label: "Kategori", type: "select", options: ["Produk", "Consumable"] },
    { key: "min_stock", label: "Stok Minimum", type: "number" },
    { key: "opening_stock", label: "Stok Awal", type: "number" },
];

const excelColumns: ExcelColumn[] = [
    { key: "code", header: "Kode", type: "text" },
    { key: "name", header: "Nama Barang", type: "text" },
    { key: "category", header: "Kategori", type: "text", options: ["Produk", "Consumable"] },
    { key: "min_stock", header: "Stok Minimum", type: "number" },
    { key: "opening_stock", header: "Stok Awal", type: "number" },
];

export default function AlucurvStokPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvStockItem>("alu_stock_items", "name");

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Stok Barang</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Master data produk & consumable Alucurv. Pergerakan stok masuk/keluar akan ditambahkan di iterasi berikutnya.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
