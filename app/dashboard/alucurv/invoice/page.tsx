"use client";
import { useState, useMemo, type CSSProperties } from "react";
import Link from "next/link";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import ExcelImportButton, { type ExcelColumn } from "@/components/layout/ExcelImportButton";

interface InvoiceRow {
    id: string;
    number: string;
    date: string;
    order_date: string | null;
    customer: string;
    status: string;
    dp_amount: number | null;
    discount_amount: number | null;
    paid_date: string | null;
    payment: string | null;
    franco: string | null;
    note: string | null;
}
interface InvoiceItemRow {
    id: string;
    invoice_id: string;
    description: string;
    qty: number;
    unit_price: number;
}
type ItemForm = { id: string; description: string; qty: number; unit_price: number };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const emptyItem = (): ItemForm => ({ id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0 });

const excelColumns: ExcelColumn[] = [
    { key: "number", header: "No. Invoice", type: "text" },
    { key: "date", header: "Tanggal", type: "date" },
    { key: "customer", header: "Customer", type: "text" },
    { key: "status", header: "Status", type: "text", options: ["LUNAS", "DP", "BELUM"] },
    { key: "dp_amount", header: "Nominal DP", type: "number" },
    { key: "payment", header: "Pembayaran", type: "text", options: ["TRANSFER", "CASH"] },
    { key: "note", header: "Catatan", type: "text" },
];

export default function AlucurvInvoicePage() {
    const invoices = useAlucurvTable<InvoiceRow>("alu_invoices", "date");
    const items = useAlucurvTable<InvoiceItemRow>("alu_invoice_items");

    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [number, setNumber] = useState("");
    const [date, setDate] = useState("");
    const [orderDate, setOrderDate] = useState("");
    const [customer, setCustomer] = useState("");
    const [status, setStatus] = useState("BELUM");
    const [dpAmount, setDpAmount] = useState(0);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [paidDate, setPaidDate] = useState("");
    const [payment, setPayment] = useState("TRANSFER");
    const [franco, setFranco] = useState("");
    const [note, setNote] = useState("");
    const [itemForms, setItemForms] = useState<ItemForm[]>([emptyItem()]);
    const [saving, setSaving] = useState(false);

    const itemsByInvoice = useMemo(() => {
        const map = new Map<string, InvoiceItemRow[]>();
        for (const it of items.rows) {
            const list = map.get(it.invoice_id) ?? [];
            list.push(it);
            map.set(it.invoice_id, list);
        }
        return map;
    }, [items.rows]);

    const totalOf = (invId: string) =>
        (itemsByInvoice.get(invId) ?? []).reduce((s, it) => s + Number(it.qty) * Number(it.unit_price), 0);

    const resetForm = () => {
        setNumber(""); setDate(""); setOrderDate(""); setCustomer(""); setStatus("BELUM");
        setDpAmount(0); setDiscountAmount(0); setPaidDate(""); setPayment("TRANSFER");
        setFranco(""); setNote(""); setItemForms([emptyItem()]);
    };

    const openNew = () => { setEditId(null); resetForm(); setOpen(true); };

    const openEdit = (inv: InvoiceRow) => {
        setEditId(inv.id);
        setNumber(inv.number); setDate(inv.date); setOrderDate(inv.order_date ?? "");
        setCustomer(inv.customer); setStatus(inv.status);
        setDpAmount(Number(inv.dp_amount ?? 0)); setDiscountAmount(Number(inv.discount_amount ?? 0));
        setPaidDate(inv.paid_date ?? ""); setPayment(inv.payment ?? "TRANSFER");
        setFranco(inv.franco ?? ""); setNote(inv.note ?? "");
        const existing = itemsByInvoice.get(inv.id) ?? [];
        setItemForms(
            existing.length > 0
                ? existing.map((it) => ({ id: it.id, description: it.description, qty: Number(it.qty), unit_price: Number(it.unit_price) }))
                : [emptyItem()]
        );
        setOpen(true);
    };

    const setItem = (idx: number, patch: Partial<ItemForm>) =>
        setItemForms((list) => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
    const removeItem = (idx: number) => setItemForms((list) => list.filter((_, i) => i !== idx));
    const addItem = () => setItemForms((list) => [...list, emptyItem()]);

    const save = async () => {
        if (!number.trim() || !customer.trim() || !date) { alert("Isi No. Invoice, Tanggal, dan Customer dulu ya."); return; }
        setSaving(true);
        try {
            const payload = {
                number, date, order_date: orderDate || null, customer, status,
                dp_amount: dpAmount || null, discount_amount: discountAmount || null,
                paid_date: paidDate || null, payment: payment || null, franco: franco || null, note: note || null,
            };
            let invId = editId;
            if (editId) {
                await invoices.updateRow(editId, payload);
                const old = itemsByInvoice.get(editId) ?? [];
                for (const o of old) await items.deleteRow(o.id);
            } else {
                invId = crypto.randomUUID();
                await invoices.insertRow({ id: invId, ...payload });
            }
            const filled = itemForms.filter((it) => it.description.trim());
            if (invId && filled.length > 0) {
                await items.insertRows(filled.map((it) => ({ invoice_id: invId, description: it.description, qty: it.qty, unit_price: it.unit_price })));
            }
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };

    // Item ikut terhapus otomatis lewat ON DELETE CASCADE di alu_invoice_items.
    const removeInvoice = (id: string) => invoices.deleteRow(id);

    const formTotal = itemForms.reduce((s, it) => s + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
    const formBayar = formTotal - dpAmount - discountAmount;

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Invoice / Nota</h1>
                    <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 560 }}>
                        Kelola invoice beserta rincian item. Klik &quot;Cetak&quot; untuk nota siap cetak/kirim ke customer.
                    </p>
                </div>
                <button onClick={openNew} style={primaryBtn}>+ Buat Invoice</button>
            </div>

            <div style={{ marginBottom: 16 }}>
                <ExcelImportButton columns={excelColumns} onImport={(rows) => invoices.insertRows(rows)} label="Import Excel (header saja)" />
            </div>

            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr>
                            <th style={thStyle}>No. Invoice</th>
                            <th style={thStyle}>Tanggal</th>
                            <th style={thStyle}>Customer</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Total</th>
                            <th style={thStyle} />
                        </tr>
                    </thead>
                    <tbody>
                        {invoices.loading ? (
                            <tr><td colSpan={6} style={tdEmptyStyle}>Memuat...</td></tr>
                        ) : invoices.rows.length === 0 ? (
                            <tr><td colSpan={6} style={tdEmptyStyle}>Belum ada invoice.</td></tr>
                        ) : (
                            invoices.rows.map((inv) => (
                                <tr key={inv.id}>
                                    <td style={tdStyle}>{inv.number}</td>
                                    <td style={tdStyle}>{inv.date}</td>
                                    <td style={tdStyle}>{inv.customer}</td>
                                    <td style={tdStyle}>{inv.status}</td>
                                    <td style={tdStyle}>{rupiah(totalOf(inv.id))}</td>
                                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                                        <Link href={`/alucurv-invoice/${inv.id}`} target="_blank" style={{ ...linkBtn, marginRight: 12 }}>Cetak</Link>
                                        <button onClick={() => openEdit(inv)} style={{ ...linkBtn, marginRight: 12 }}>Ubah</button>
                                        <button onClick={() => removeInvoice(inv.id)} style={{ ...linkBtn, color: "#DC2626" }}>Hapus</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {open && (
                <div style={overlayStyle} onClick={() => setOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)", marginBottom: 16 }}>
                            {editId ? "Ubah Invoice" : "Invoice Baru"}
                        </h2>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
                            <div><label style={labelStyle}>No. Invoice</label><input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="AL/INV/07/2026/030" style={inputStyle} /></div>
                            <div><label style={labelStyle}>Tanggal Order</label><input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Tanggal Invoice</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
                            <div><label style={labelStyle}>Customer</label><input value={customer} onChange={(e) => setCustomer(e.target.value)} style={inputStyle} /></div>
                            <div>
                                <label style={labelStyle}>Status</label>
                                <select value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
                                    <option value="BELUM">BELUM</option><option value="DP">DP</option><option value="LUNAS">LUNAS</option>
                                </select>
                            </div>
                            <div>
                                <label style={labelStyle}>Pembayaran</label>
                                <select value={payment} onChange={(e) => setPayment(e.target.value)} style={inputStyle}>
                                    <option value="TRANSFER">TRANSFER</option><option value="CASH">CASH</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ marginBottom: 6, display: "grid", gridTemplateColumns: "2fr 90px 110px 28px", gap: 8, fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase" }}>
                            <span>Deskripsi Item</span><span>Qty</span><span>Harga Satuan</span><span />
                        </div>
                        {itemForms.map((it, i) => (
                            <div key={it.id} style={{ display: "grid", gridTemplateColumns: "2fr 90px 110px 28px", gap: 8, marginBottom: 8 }}>
                                <input value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} style={inputStyle} />
                                <input type="number" min={0} value={it.qty || ""} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} style={inputStyle} />
                                <input type="number" min={0} value={it.unit_price || ""} onChange={(e) => setItem(i, { unit_price: Number(e.target.value) })} style={inputStyle} />
                                <button onClick={() => removeItem(i)} style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer" }} aria-label="Hapus">✕</button>
                            </div>
                        ))}
                        <button onClick={addItem} style={{ ...linkBtn, marginBottom: 16 }}>+ Tambah item</button>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
                            <div><label style={labelStyle}>DP (Rp)</label><input type="number" min={0} value={dpAmount || ""} onChange={(e) => setDpAmount(Number(e.target.value))} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Diskon (Rp)</label><input type="number" min={0} value={discountAmount || ""} onChange={(e) => setDiscountAmount(Number(e.target.value))} style={inputStyle} /></div>
                            <div><label style={labelStyle}>Tgl Lunas</label><input type="date" value={paidDate} onChange={(e) => setPaidDate(e.target.value)} style={inputStyle} /></div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
                            <div><label style={labelStyle}>Franco</label><input value={franco} onChange={(e) => setFranco(e.target.value)} placeholder="Franco Gudang" style={inputStyle} /></div>
                            <div><label style={labelStyle}>Catatan (Remark)</label><input value={note} onChange={(e) => setNote(e.target.value)} style={inputStyle} /></div>
                        </div>

                        <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12, fontSize: 12, marginBottom: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Item</span><strong>{rupiah(formTotal)}</strong></div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}><span>DP + Diskon</span><strong>-{rupiah(dpAmount + discountAmount)}</strong></div>
                            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}><span>Sisa Bayar</span><span>{rupiah(formBayar)}</span></div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setOpen(false)} style={ghostBtn}>Batal</button>
                            <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Menyimpan..." : "Simpan"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const thStyle: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" };
const tdStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const tdEmptyStyle: CSSProperties = { ...tdStyle, textAlign: "center", color: "var(--text-med)", padding: "20px 10px" };
const linkBtn: CSSProperties = { background: "none", border: "none", color: "var(--primary-dark)", fontWeight: 600, fontSize: 12, cursor: "pointer", textDecoration: "none" };
const primaryBtn: CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const ghostBtn: CSSProperties = { background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--text-med)" };
const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", display: "block", marginBottom: 4 };
const inputStyle: CSSProperties = { width: "100%", fontSize: 12, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", color: "var(--text-dark)", boxSizing: "border-box" };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalStyle: CSSProperties = { background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto" };
