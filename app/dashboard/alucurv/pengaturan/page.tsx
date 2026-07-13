"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";

interface AlucurvAccount {
    id: string;
    name: string;
    type: string;
    opening_balance: number;
}
interface AlucurvSubCategory {
    id: string;
    type: string;
    name: string;
}
interface AlucurvSupplier {
    id: string;
    name: string;
}

const accountFields: CrudField[] = [
    { key: "name", label: "Nama Akun", type: "text" },
    { key: "type", label: "Tipe", type: "select", options: ["cash", "bank", "marketplace"] },
    { key: "opening_balance", label: "Saldo Awal", type: "number" },
];
const subCategoryFields: CrudField[] = [
    { key: "type", label: "Tipe", type: "select", options: ["Pemasukan", "Pengeluaran"] },
    { key: "name", label: "Nama Kategori", type: "text" },
];
const supplierFields: CrudField[] = [
    { key: "name", label: "Nama Supplier", type: "text" },
];

export default function AlucurvPengaturanPage() {
    const accounts = useAlucurvTable<AlucurvAccount>("alu_accounts", "name");
    const subCategories = useAlucurvTable<AlucurvSubCategory>("alu_sub_categories", "name");
    const suppliers = useAlucurvTable<AlucurvSupplier>("alu_suppliers", "name");

    return (
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 32 }}>
            <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Pengaturan</h1>
                <p style={{ fontSize: 13, color: "var(--text-med)" }}>
                    Master data Alucurv: akun kas/bank, kategori transaksi, dan supplier — dipakai sebagai referensi di modul Keuangan & Pengadaan.
                </p>
            </div>

            <section>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>Akun Kas / Bank / Marketplace</h2>
                <AlucurvCrudTable fields={accountFields} rows={accounts.rows} loading={accounts.loading} onAdd={accounts.insertRow} onDelete={accounts.deleteRow} />
            </section>

            <section>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>Kategori Transaksi</h2>
                <AlucurvCrudTable fields={subCategoryFields} rows={subCategories.rows} loading={subCategories.loading} onAdd={subCategories.insertRow} onDelete={subCategories.deleteRow} />
            </section>

            <section>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)", marginBottom: 10 }}>Supplier</h2>
                <AlucurvCrudTable fields={supplierFields} rows={suppliers.rows} loading={suppliers.loading} onAdd={suppliers.insertRow} onDelete={suppliers.deleteRow} />
            </section>
        </div>
    );
}
