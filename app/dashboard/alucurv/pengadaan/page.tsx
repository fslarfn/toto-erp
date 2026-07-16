"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvPurchase {
    id: string;
    date: string;
    supplier_id: string | null;
    item_code: string | null;
    item_name: string;
    size: string | null;
    unit_price: number;
    qty: number;
    qty_label: string | null;
    total: number;
    account_id: string | null;
}
interface AlucurvSupplier { id: string; name: string }
interface AlucurvAccount { id: string; name: string }

export default function AlucurvPengadaanPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvPurchase>("alu_purchases", "date");
    const suppliers = useAlucurvTable<AlucurvSupplier>("alu_suppliers", "name");
    const accounts = useAlucurvTable<AlucurvAccount>("alu_accounts", "name");

    const supplierOptions = suppliers.rows.map((s) => ({ value: s.id, label: s.name }));
    const accountOptions = accounts.rows.map((a) => ({ value: a.id, label: a.name }));

    const fields: CrudField[] = [
        { key: "date", label: "Tanggal", type: "date", required: true },
        { key: "supplier_id", label: "Supplier", type: "select", optionsMap: supplierOptions },
        { key: "item_name", label: "Nama Barang", type: "text", required: true },
        { key: "size", label: "Ukuran", type: "text" },
        { key: "unit_price", label: "Harga Satuan", type: "number", format: "currency" },
        { key: "qty", label: "Qty", type: "number" },
        { key: "qty_label", label: "Satuan", type: "text" },
        { key: "total", label: "Total", type: "number", format: "currency" },
        { key: "account_id", label: "Akun Pembayar", type: "select", optionsMap: accountOptions },
    ];

    const excelColumns: ExcelColumn[] = [
        { key: "date", header: "Tanggal", type: "date" },
        { key: "supplier_id", header: "Supplier", type: "text", lookup: supplierOptions },
        { key: "item_name", header: "Nama Barang", type: "text" },
        { key: "size", header: "Ukuran", type: "text" },
        { key: "unit_price", header: "Harga Satuan", type: "number" },
        { key: "qty", header: "Qty", type: "number" },
        { key: "qty_label", header: "Satuan", type: "text" },
        { key: "total", header: "Total", type: "number" },
        { key: "account_id", header: "Akun Pembayar", type: "text", lookup: accountOptions },
    ];

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Pengadaan Bahan Baku</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Catatan pembelian bahan baku dari supplier. Supplier &amp; Akun Pembayar mengikuti master data di Pengaturan.
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
