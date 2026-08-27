"use client";

import { use, useEffect, useState, type CSSProperties } from "react";
import { supabase } from "@/lib/supabase-client";

const ALUCURV = {
    name: "ALUCURV",
    tagline: "Kreasi Aluminium, Inovasi Tanpa Batas.",
    banner: "Spesialis custom pintu, jendela aluminium lengkung",
    address: "Bekasi, Jawa Barat 17158",
    phone: "0851-7989-3645",
    logoSrc: "/alucurv-logo-trimmed.png",
};

interface DeliveryNote { id: string; number: string; date: string; customer: string }
interface DeliveryItem { id: string; description: string; qty: number }

function formatDate(value: string) {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function AlucurvDeliveryNotePrintPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [note, setNote] = useState<DeliveryNote | null>(null);
    const [items, setItems] = useState<DeliveryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [logoOk, setLogoOk] = useState(true);

    useEffect(() => {
        (async () => {
            const [{ data: header }, { data: details }] = await Promise.all([
                supabase.from("alu_delivery_notes").select("id, number, date, customer").eq("id", id).maybeSingle(),
                supabase.from("alu_delivery_note_items").select("id, description, qty").eq("delivery_note_id", id).order("id"),
            ]);
            setNote(header as DeliveryNote | null);
            setItems((details ?? []) as DeliveryItem[]);
            setLoading(false);
        })();
    }, [id]);

    if (loading) return <div style={messageStyle}>Memuat...</div>;
    if (!note) return <div style={messageStyle}>Surat jalan tidak ditemukan.</div>;

    return (
        <main className="print-page-bg" style={{ minHeight: "100vh", background: "#e5e5e5", padding: "24px 12px", fontFamily: "Arial, Helvetica, sans-serif", color: "#111" }}>
            <style>{`
                @page { size: A4; margin: 10mm; }
                * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                @media print {
                    body, .print-page-bg { background: white !important; padding: 0 !important; }
                    .no-print { display: none !important; }
                    .delivery-paper { box-shadow: none !important; margin: 0 auto !important; border: none !important; }
                }
            `}</style>

            <div className="no-print" style={{ maxWidth: 760, margin: "0 auto 16px", display: "flex", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => window.print()} style={printButtonStyle}>Cetak / Simpan PDF</button>
            </div>

            <article className="delivery-paper" style={{ maxWidth: 760, minHeight: 720, margin: "0 auto", background: "white", border: "2px solid #111", padding: 24, boxShadow: "0 6px 24px rgba(0,0,0,.12)", fontSize: 12 }}>
                <header style={{ textAlign: "center", marginBottom: 12 }}>
                    {logoOk ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ALUCURV.logoSrc} alt={ALUCURV.name} onError={() => setLogoOk(false)} style={{ width: 280, height: "auto", margin: "0 auto 4px", display: "block" }} />
                    ) : (
                        <div style={{ fontSize: 30, fontWeight: 800, color: "#14B8A6", letterSpacing: 1 }}>{ALUCURV.name}</div>
                    )}
                    <div style={{ fontSize: 10, color: "#0F766E", fontStyle: "italic" }}>{ALUCURV.tagline}</div>
                    <div style={{ marginTop: 8, background: "#14B8A6", color: "white", fontSize: 10, fontWeight: 700, padding: "4px 0" }}>{ALUCURV.banner}</div>
                </header>

                <h1 style={{ textAlign: "center", fontSize: 20, fontWeight: 800, margin: "12px 0" }}>SURAT JALAN</h1>

                <table style={{ fontSize: 11, marginBottom: 14 }}><tbody>
                    <tr><td style={metaLabelStyle}>No. Surat Jalan</td><td>: {note.number}</td></tr>
                    <tr><td style={metaLabelStyle}>Tanggal</td><td>: {formatDate(note.date)}</td></tr>
                </tbody></table>

                <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: "1px solid #111", marginBottom: 14 }}>
                    <div style={{ padding: 10, borderRight: "1px solid #111" }}>
                        <div style={sectionLabelStyle}>Dikirim oleh:</div><div style={{ fontWeight: 700 }}>{ALUCURV.name}</div>
                        <div>{ALUCURV.address}</div><div>Telp / Fax : {ALUCURV.phone}</div>
                    </div>
                    <div style={{ padding: 10 }}>
                        <div style={sectionLabelStyle}>Dikirim kepada:</div>
                        <div style={{ fontWeight: 700, textAlign: "center", marginTop: 16 }}>{note.customer}</div>
                    </div>
                </section>

                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr style={{ background: "#14B8A6", color: "white" }}>
                        <th style={{ ...headerCellStyle, width: 54 }}>No.</th>
                        <th style={{ ...headerCellStyle, textAlign: "left" }}>Deskripsi barang</th>
                        <th style={{ ...headerCellStyle, width: 100 }}>Qty</th>
                    </tr></thead>
                    <tbody>{items.length > 0 ? items.map((item, index) => (
                        <tr key={item.id} style={{ borderBottom: "1px solid #ccc" }}>
                            <td style={bodyCellStyle}>{index + 1}</td>
                            <td style={{ ...bodyCellStyle, textAlign: "left" }}>{item.description}</td>
                            <td style={bodyCellStyle}>{Number(item.qty).toLocaleString("id-ID")}</td>
                        </tr>
                    )) : (
                        <tr><td colSpan={3} style={{ ...bodyCellStyle, padding: 24, color: "#666" }}>Belum ada rincian barang pada surat jalan ini.</td></tr>
                    )}</tbody>
                </table>

                <div style={{ marginTop: 18, padding: "7px 9px", background: "#ECFDF5", borderLeft: "3px solid #14B8A6", color: "#0F766E", fontSize: 10.5 }}>
                    Barang telah diterima dalam kondisi baik dan sesuai dengan rincian di atas.
                </div>
                <footer style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 80, marginTop: 54, textAlign: "center", fontSize: 11 }}>
                    <Signature title="Penerima" /><Signature title="Pengirim" />
                </footer>
            </article>
        </main>
    );
}

function Signature({ title }: { title: string }) {
    return <div><div>{title}</div><div style={{ height: 62 }} /><div>( ____________________ )</div></div>;
}

const messageStyle: CSSProperties = { padding: 40, textAlign: "center", color: "#666" };
const printButtonStyle: CSSProperties = { background: "#14B8A6", color: "white", border: "none", borderRadius: 8, padding: "10px 20px", fontWeight: 700, fontSize: 13, cursor: "pointer" };
const metaLabelStyle: CSSProperties = { color: "#0F766E", fontWeight: 700, paddingRight: 8, paddingBottom: 3 };
const sectionLabelStyle: CSSProperties = { fontWeight: 700, color: "#0F766E", marginBottom: 4 };
const headerCellStyle: CSSProperties = { padding: "7px 8px", textAlign: "center", fontWeight: 700, fontSize: 10.5, textTransform: "uppercase" };
const bodyCellStyle: CSSProperties = { padding: "8px", textAlign: "center", verticalAlign: "top" };
