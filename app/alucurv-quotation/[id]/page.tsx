"use client";

import Link from "next/link";
import { use, useEffect, useState, type CSSProperties } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { supabase } from "@/lib/supabase-client";
import { ALUCURV_QUOTATIONS_LOCAL_KEY, type AlucurvQuotation } from "@/lib/alucurv/quotations";

const BRAND = {
    name: "ALUCURV",
    logo: "/alucurv-logo-trimmed.png",
};

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });

function readLocalQuotation(id: string): AlucurvQuotation | null {
    try {
        const rows = JSON.parse(localStorage.getItem(ALUCURV_QUOTATIONS_LOCAL_KEY) || "[]") as AlucurvQuotation[];
        return rows.find((row) => row.id === id) || null;
    } catch {
        return null;
    }
}

export default function AlucurvQuotationPrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [quotation, setQuotation] = useState<AlucurvQuotation | null>(null);
    const [loading, setLoading] = useState(true);
    const [logoOk, setLogoOk] = useState(true);

    useEffect(() => {
        (async () => {
            if (id.startsWith("local-")) {
                setQuotation(readLocalQuotation(id));
                setLoading(false);
                return;
            }
            const { data } = await supabase.from("alu_quotations").select("*").eq("id", id).maybeSingle();
            setQuotation((data as AlucurvQuotation | null) || readLocalQuotation(id));
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <div style={messageStyle}>Memuat penawaran...</div>;
    if (!quotation) return <div style={messageStyle}>Penawaran tidak ditemukan.</div>;

    const noteLines = (quotation.notes || "").split("\n").map((line) => line.trim()).filter(Boolean);

    return (
        <main className="quotation-bg" style={{ minHeight: "100vh", padding: "24px 12px", background: "#e7eeee", color: "#172426", fontFamily: "Arial, Helvetica, sans-serif" }}>
            <style>{`
                @page { size: A4; margin: 10mm; }
                * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                @media print {
                    body, .quotation-bg { margin: 0 !important; padding: 0 !important; background: white !important; }
                    .no-print { display: none !important; }
                    .quotation-paper { width: 100% !important; max-width: none !important; min-height: 277mm !important; margin: 0 !important; border: 0 !important; box-shadow: none !important; }
                }
            `}</style>

            <div className="no-print" style={{ width: "min(100%, 794px)", margin: "0 auto 14px", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <Link href="/dashboard/alucurv/penawaran" style={toolbarButton}><ArrowLeft size={15} /> Kembali</Link>
                <button type="button" onClick={() => window.print()} style={{ ...toolbarButton, borderColor: "#14B8A6", background: "#14B8A6", color: "white" }}><Printer size={15} /> Cetak / Simpan PDF</button>
            </div>

            <article className="quotation-paper" style={{ width: "min(100%, 794px)", minHeight: 1040, margin: "0 auto", padding: "28px 30px 36px", border: "1px solid #cbd5d1", background: "white", boxShadow: "0 12px 36px rgba(15,118,110,.12)" }}>
                <div style={{ textAlign: "center" }}>
                    {logoOk ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={BRAND.logo} alt={BRAND.name} onError={() => setLogoOk(false)} style={{ display: "block", width: 330, maxWidth: "78%", height: "auto", margin: "0 auto" }} />
                    ) : (
                        <div style={{ color: "#14B8A6", fontSize: 38, fontWeight: 900 }}>{BRAND.name}</div>
                    )}
                </div>

                <div style={{ height: 1, margin: "14px 0 16px", background: "#0F766E" }} />
                <h1 style={{ margin: "0 0 18px", textAlign: "center", fontSize: 20, fontWeight: 900, letterSpacing: ".08em" }}>QUOTATION</h1>

                <table style={{ marginBottom: 18, borderCollapse: "collapse", fontSize: 11.5 }}><tbody>
                    <tr><td style={metaLabel}>No. Penawaran</td><td style={metaValue}>: {quotation.number}</td></tr>
                    <tr><td style={metaLabel}>Tanggal</td><td style={metaValue}>: {formatDate(quotation.date)}</td></tr>
                    <tr><td style={metaLabel}>Customer</td><td style={{ ...metaValue, fontWeight: 800 }}>: {quotation.customer}</td></tr>
                </tbody></table>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                    <thead><tr style={{ background: "#14B8A6", color: "white" }}>
                        <th style={{ ...headerCell, width: 48 }}>No</th>
                        <th style={{ ...headerCell, textAlign: "left" }}>Deskripsi</th>
                        <th style={{ ...headerCell, width: 74 }}>Qty</th>
                        <th style={{ ...headerCell, width: 145 }}>Harga</th>
                        <th style={{ ...headerCell, width: 150 }}>Total</th>
                    </tr></thead>
                    <tbody>
                        {quotation.items.map((item, index) => (
                            <tr key={item.id}>
                                <td style={bodyCell}>{index + 1}</td>
                                <td style={{ ...bodyCell, textAlign: "left" }}>{item.description}</td>
                                <td style={bodyCell}>{Number(item.qty).toLocaleString("id-ID")}</td>
                                <td style={{ ...bodyCell, textAlign: "right", whiteSpace: "nowrap" }}>{rupiah(Number(item.unit_price))}</td>
                                <td style={{ ...bodyCell, textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" }}>{rupiah(Number(item.qty) * Number(item.unit_price))}</td>
                            </tr>
                        ))}
                        {Array.from({ length: Math.max(0, 4 - quotation.items.length) }).map((_, index) => (
                            <tr key={`blank-${index}`}><td style={blankCell}>&nbsp;</td><td style={blankCell} /><td style={blankCell} /><td style={blankCell} /><td style={blankCell} /></tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                    <table style={{ width: 310, borderCollapse: "collapse", fontSize: 11.5 }}><tbody>
                        <tr><td style={totalLabel}>Subtotal</td><td style={totalValue}>{rupiah(Number(quotation.subtotal))}</td></tr>
                        {Number(quotation.discount_amount) > 0 && <tr><td style={totalLabel}>Diskon</td><td style={totalValue}>- {rupiah(Number(quotation.discount_amount))}</td></tr>}
                        <tr><td style={{ ...totalLabel, borderTop: "2px solid #14B8A6", color: "#0F766E", fontWeight: 900 }}>TOTAL</td><td style={{ ...totalValue, borderTop: "2px solid #14B8A6", color: "#0F766E", fontSize: 14, fontWeight: 900 }}>{rupiah(Number(quotation.grand_total))}</td></tr>
                    </tbody></table>
                </div>

                <section style={{ marginTop: 28, fontSize: 11.5, lineHeight: 1.65 }}>
                    <div style={{ marginBottom: 5, color: "#0F766E", fontWeight: 800 }}>Note:</div>
                    {noteLines.length ? noteLines.map((line, index) => <div key={`${line}-${index}`} style={{ display: "flex", gap: 7 }}><span>–</span><span>{line}</span></div>) : <div>–</div>}
                </section>

                <footer style={{ display: "flex", justifyContent: "flex-end", marginTop: 58, paddingRight: 34, textAlign: "center", fontSize: 11.5 }}>
                    <div style={{ width: 190 }}>
                        <div>Hormat Kami,</div>
                        <div style={{ height: 62 }} />
                        <div style={{ paddingTop: 6, borderTop: "1px solid #172426", color: "#0F766E", fontWeight: 900 }}>ALUCURV</div>
                    </div>
                </footer>
            </article>
        </main>
    );
}

const messageStyle: CSSProperties = { padding: 40, textAlign: "center", color: "#64748b", fontFamily: "Arial, sans-serif" };
const toolbarButton: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 13px", border: "1px solid #cbd5d1", borderRadius: 8, background: "white", color: "#173c3a", fontSize: 12, fontWeight: 800, textDecoration: "none", cursor: "pointer" };
const metaLabel: CSSProperties = { width: 105, padding: "3px 8px 3px 0", color: "#0F766E", fontWeight: 800 };
const metaValue: CSSProperties = { padding: "3px 0" };
const headerCell: CSSProperties = { padding: "8px 9px", border: "1px solid #0F766E", textAlign: "center", fontSize: 10.5, fontWeight: 800, textTransform: "uppercase" };
const bodyCell: CSSProperties = { minHeight: 34, padding: "8px 9px", border: "1px solid #b7c9c6", textAlign: "center", verticalAlign: "top" };
const blankCell: CSSProperties = { height: 35, border: "1px solid #d4dfdd" };
const totalLabel: CSSProperties = { padding: "6px 8px", textAlign: "right" };
const totalValue: CSSProperties = { padding: "6px 8px", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap" };
