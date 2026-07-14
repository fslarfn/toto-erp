"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import AlucurvCrudTable, { type CrudField } from "@/components/layout/AlucurvCrudTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface AlucurvOrder {
    id: string;
    date: string;
    invoice_id: string | null;
    customer: string;
    description: string | null;
    channel: string;
    deadline: string | null;
    price: number;
    received_amount: number | null;
    expedition: string | null;
    produksi: boolean;
    perakitan: boolean;
    packing: boolean;
    dikirim: boolean;
    sampai: boolean;
    created_at?: string;
}

const fields: CrudField[] = [
    { key: "date", label: "Tanggal", type: "date", required: true },
    { key: "customer", label: "Customer", type: "text", required: true },
    { key: "description", label: "Deskripsi", type: "text" },
    { key: "channel", label: "Channel", type: "select", options: ["Shopee", "TikTokShop", "Offline"], required: true },
    { key: "deadline", label: "Deadline", type: "date" },
    { key: "price", label: "Harga", type: "number", format: "currency" },
    {
        key: "received_amount",
        label: "Harga Setelah Barang Datang",
        type: "number",
        format: "currency",
        nullable: true,
        showIf: (form) => form.channel === "Shopee" || form.channel === "TikTokShop",
    },
    { key: "expedition", label: "Ekspedisi", type: "text" },
    { key: "produksi", label: "Produksi", type: "checkbox" },
    { key: "perakitan", label: "Perakitan", type: "checkbox" },
    { key: "packing", label: "Packing", type: "checkbox" },
    { key: "dikirim", label: "Dikirim", type: "checkbox" },
    { key: "sampai", label: "Sampai", type: "checkbox" },
];

const excelColumns: ExcelColumn[] = [
    { key: "date", header: "Tanggal", type: "date" },
    { key: "customer", header: "Customer", type: "text" },
    { key: "description", header: "Deskripsi", type: "text" },
    { key: "channel", header: "Channel", type: "text", options: ["Shopee", "TikTokShop", "Offline"] },
    { key: "deadline", header: "Deadline", type: "date" },
    { key: "price", header: "Harga", type: "number" },
    { key: "received_amount", header: "Harga Setelah Barang Datang", type: "number", nullable: true },
    { key: "expedition", header: "Ekspedisi", type: "text" },
];

export default function AlucurvOrderPage() {
    const { rows, loading, insertRow, insertRows, updateRow, deleteRow } = useAlucurvTable<AlucurvOrder>("alu_orders", "created_at", true);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Order</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Pipeline order per channel Shopee/TikTok/Offline. Klik langsung checkbox produksi–perakitan–packing–kirim–sampai di tabel untuk update progres, atau klik &quot;Ubah&quot; untuk edit field lain. Urutan mengikuti input pertama.
                Untuk order Shopee/TikTok, isi &quot;Harga Setelah Barang Datang&quot; — itu nominal bersih yang benar-benar diterima Alucurv setelah settlement marketplace (beda dengan Harga yang cuma harga jual di listing).
            </p>
            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => insertRows(rows)} />
            </div>
            <AlucurvCrudTable fields={fields} rows={rows} loading={loading} onAdd={insertRow} onDelete={deleteRow} onUpdate={updateRow} />
        </div>
    );
}
