"use client";
import Link from "next/link";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";

interface AlucurvOrder { id: string; sampai: boolean }
interface AlucurvInvoice { id: string; status: string }
interface AlucurvTransaction { id: string; type: string; amount: number }
interface AlucurvStockItem { id: string; name: string; min_stock: number; opening_stock: number }

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
    return (
        <Link
            href={href}
            style={{
                display: "block", padding: "14px 18px", borderRadius: 12,
                background: "white", border: "1px solid var(--border)", textDecoration: "none",
            }}
        >
            <div style={{ fontSize: 10, color: "var(--text-med)", fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginTop: 4 }}>{value}</div>
        </Link>
    );
}

export default function AlucurvWorkspacePage() {
    const orders = useAlucurvTable<AlucurvOrder>("alu_orders");
    const invoices = useAlucurvTable<AlucurvInvoice>("alu_invoices");
    const transactions = useAlucurvTable<AlucurvTransaction>("alu_transactions");
    const stock = useAlucurvTable<AlucurvStockItem>("alu_stock_items");

    const orderBerjalan = orders.rows.filter((o) => !o.sampai).length;
    const invoiceBelumLunas = invoices.rows.filter((i) => i.status !== "LUNAS").length;
    const saldoKas = transactions.rows.reduce(
        (s, t) => s + (t.type === "Pemasukan" ? Number(t.amount || 0) : -Number(t.amount || 0)),
        0
    );
    const stokKurang = stock.rows.filter((s) => Number(s.opening_stock) < Number(s.min_stock)).length;

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Workspace Alucurv</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 20 }}>
                Ringkasan operasional Alucurv.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, maxWidth: 720 }}>
                <StatCard label="Order Berjalan" value={String(orderBerjalan)} href="/dashboard/alucurv/order" />
                <StatCard label="Invoice Belum Lunas" value={String(invoiceBelumLunas)} href="/dashboard/alucurv/invoice" />
                <StatCard label="Saldo Kas" value={`Rp ${saldoKas.toLocaleString("id-ID")}`} href="/dashboard/alucurv/keuangan" />
                <StatCard label="Stok di Bawah Minimum" value={String(stokKurang)} href="/dashboard/alucurv/stok" />
            </div>
        </div>
    );
}
