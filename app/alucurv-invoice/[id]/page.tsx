"use client";
import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

// Info perusahaan & rekening — hardcoded sesuai template nota, bisa diminta ubah kapan saja.
const ALUCURV = {
    name: "ALUCURV",
    tagline: "Kreasi Aluminium, Inovasi Tanpa Batas.",
    banner: "Spesialis custom pintu, jendela aluminium lengkung",
    address: "Bekasi, Jawa Barat 17158",
    phone: "0851-7989-3645",
    bankName: "BCA",
    bankAccountNo: "739-207-9893",
    bankAccountName: "Devina Aulia Rahma",
    // Sudah di-crop presisi ke bounding box asli (3464x952, dari kanvas asal 3464x3464 yang
    // banyak transparant padding vertikal) supaya ukurannya pas & center saat ditampilkan.
    logoSrc: "/alucurv-logo-trimmed.png",
};

interface InvoiceRow {
    id: string;
    number: string;
    date: string;
    order_date: string | null;
    customer: string;
    status: string;
    dp_amount: number | null;
    discount_amount: number | null;
    payment: string | null;
    franco: string | null;
    note: string | null;
}
interface InvoiceItemRow {
    id: string;
    description: string;
    qty: number;
    unit_price: number;
}

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const formatDate = (s: string | null) => {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

export default function AlucurvInvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
    const [items, setItems] = useState<InvoiceItemRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [logoOk, setLogoOk] = useState(true);

    useEffect(() => {
        (async () => {
            const [{ data: inv }, { data: its }] = await Promise.all([
                supabase.from("alu_invoices").select("*").eq("id", id).maybeSingle(),
                supabase.from("alu_invoice_items").select("*").eq("invoice_id", id),
            ]);
            setInvoice(inv as InvoiceRow | null);
            setItems((its ?? []) as InvoiceItemRow[]);
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Memuat...</div>;
    if (!invoice) return <div style={{ padding: 40, textAlign: "center", color: "#666" }}>Invoice tidak ditemukan.</div>;

    const total = items.reduce((s, it) => s + Number(it.qty) * Number(it.unit_price), 0);
    const dp = Number(invoice.dp_amount ?? 0);
    const diskon = Number(invoice.discount_amount ?? 0);
    const bayar = total - dp - diskon;

    return (
        <div className="print-page-bg" style={{ background: "#e5e5e5", minHeight: "100vh", padding: "24px 12px", fontFamily: "Arial, Helvetica, sans-serif" }}>
            <style>{`
                @page { margin: 10mm; }
                * {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                    color-adjust: exact !important;
                }
                @media print {
                    body, .print-page-bg { background: white !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                    .nota-paper { box-shadow: none !important; margin: 0 !important; border: none !important; }
                }
            `}</style>

            <div className="no-print" style={{ maxWidth: 600, margin: "0 auto 16px", display: "flex", justifyContent: "flex-end" }}>
                <button
                    onClick={() => window.print()}
                    style={{ background: "#14B8A6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                >
                    Cetak Nota
                </button>
            </div>

            <div className="nota-paper" style={{ maxWidth: 600, margin: "0 auto", background: "white", border: "2px solid #111", padding: 24, color: "#111", fontSize: 12 }}>
                {/* Header / Logo */}
                <div style={{ textAlign: "center", marginBottom: 12 }}>
                    {logoOk ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                            src={ALUCURV.logoSrc}
                            alt={ALUCURV.name}
                            style={{ width: 280, height: "auto", margin: "0 auto 4px", display: "block" }}
                            onError={() => setLogoOk(false)}
                        />
                    ) : (
                        <div style={{ fontSize: 30, fontWeight: 800, color: "#14B8A6", letterSpacing: 1 }}>{ALUCURV.name}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#0F766E", fontStyle: "italic" }}>{ALUCURV.tagline}</div>
                    <div style={{ marginTop: 8, background: "#14B8A6", color: "white", fontSize: 10, fontWeight: 700, padding: "4px 0" }}>
                        {ALUCURV.banner}
                    </div>
                </div>

                <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, margin: "12px 0" }}>NOTA</h1>

                <table style={{ fontSize: 11, marginBottom: 14 }}>
                    <tbody>
                        <tr><td style={{ color: "#0F766E", fontWeight: 700, paddingRight: 8 }}>INV No.</td><td>: {invoice.number}</td></tr>
                        <tr><td style={{ color: "#0F766E", fontWeight: 700, paddingRight: 8 }}>Order Date</td><td>: {formatDate(invoice.order_date)}</td></tr>
                        <tr><td style={{ color: "#0F766E", fontWeight: 700, paddingRight: 8 }}>INV Date</td><td>: {formatDate(invoice.date)}</td></tr>
                    </tbody>
                </table>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, border: "1px solid #111", marginBottom: 14 }}>
                    <div style={{ padding: 10, borderRight: "1px solid #111" }}>
                        <div style={{ fontWeight: 700, color: "#0F766E", marginBottom: 4 }}>Ship To :</div>
                        <div style={{ fontWeight: 700 }}>{ALUCURV.name}</div>
                        <div>{ALUCURV.address}</div>
                        <div>Telp / Fax : {ALUCURV.phone}</div>
                    </div>
                    <div style={{ padding: 10 }}>
                        <div style={{ fontWeight: 700, color: "#0F766E", marginBottom: 4 }}>To :</div>
                        <div style={{ fontWeight: 700, textAlign: "center", marginTop: 16 }}>{invoice.customer}</div>
                    </div>
                </div>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 12 }}>
                    <thead>
                        <tr style={{ background: "#14B8A6", color: "white" }}>
                            <th style={thCell}>No.</th>
                            <th style={{ ...thCell, textAlign: "left" }}>Description</th>
                            <th style={thCell}>Qty</th>
                            <th style={thCell}>Unit Price</th>
                            <th style={thCell}>Total Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((it, i) => (
                            <tr key={it.id} style={{ borderBottom: "1px solid #ccc" }}>
                                <td style={tdCell}>{i + 1}</td>
                                <td style={{ ...tdCell, textAlign: "left" }}>{it.description}</td>
                                <td style={tdCell}>{it.qty}</td>
                                <td style={{ ...tdCell, textAlign: "right" }}>{rupiah(Number(it.unit_price))}</td>
                                <td style={{ ...tdCell, textAlign: "right" }}>{rupiah(Number(it.qty) * Number(it.unit_price))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 200px", gap: 10, alignItems: "start", marginBottom: 14 }}>
                    <div>
                        <div style={{ background: "#FDE047", fontWeight: 700, padding: "4px 8px", marginBottom: 6 }}>
                            NOTE : {invoice.status}
                        </div>
                        <div style={{ fontSize: 10.5, color: "#1D4ED8", lineHeight: 1.6 }}>
                            Cara Pembayaran: DP 50% dari Total Harga<br />
                            Pelunasan ketika barang jadi dan siap kirim atau di ambil<br />
                            Transfer ke Rekening Bank {ALUCURV.bankName}<br />
                            No.Rekening : {ALUCURV.bankAccountNo}<br />
                            A/N : {ALUCURV.bankAccountName}
                        </div>
                    </div>
                    <table style={{ fontSize: 11, width: "100%" }}>
                        <tbody>
                            <tr><td style={{ color: "#0F766E", fontWeight: 700 }}>TOTAL</td><td style={{ textAlign: "right" }}>{rupiah(total)}</td></tr>
                            <tr><td style={{ color: "#0F766E", fontWeight: 700 }}>DP</td><td style={{ textAlign: "right" }}>{dp ? rupiah(dp) : ""}</td></tr>
                            <tr><td style={{ color: "#0F766E", fontWeight: 700 }}>DISKON</td><td style={{ textAlign: "right" }}>{diskon ? rupiah(diskon) : ""}</td></tr>
                            <tr><td colSpan={2} style={{ height: 6 }} /></tr>
                            <tr style={{ borderTop: "1px solid #111" }}>
                                <td style={{ fontWeight: 800, paddingTop: 6 }}>BAYAR</td>
                                <td style={{ textAlign: "right", fontWeight: 800, paddingTop: 6 }}>{rupiah(bayar)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
                    <tbody>
                        <tr style={{ borderTop: "1px solid #111" }}>
                            <td style={footLabel}>Term of Payment</td>
                            <td style={footValue}>: {invoice.payment ?? "-"}</td>
                        </tr>
                        <tr style={{ borderTop: "1px solid #111" }}>
                            <td style={footLabel}>Franco</td>
                            <td style={footValue}>: {invoice.franco || "-"}</td>
                        </tr>
                        <tr style={{ borderTop: "1px solid #111" }}>
                            <td style={footLabel}>Remark</td>
                            <td style={footValue}>: {invoice.note || "-"}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const thCell: React.CSSProperties = { padding: "6px 8px", textAlign: "center", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase" };
const tdCell: React.CSSProperties = { padding: "6px 8px", textAlign: "center" };
const footLabel: React.CSSProperties = { padding: "6px 4px", fontWeight: 700, width: 140 };
const footValue: React.CSSProperties = { padding: "6px 4px" };
