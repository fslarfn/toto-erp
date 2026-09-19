"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Plus, Printer, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
    type AlucurvQuotation,
    type AlucurvQuotationItem,
    type AlucurvQuotationPayload,
    type AlucurvQuotationStatus,
    useAlucurvQuotations,
} from "@/lib/alucurv/quotations";
import styles from "./page.module.css";

const DRAFT_KEY = "alucurv_quotation_editor_draft_v1";
const DEFAULT_NOTES = "Sistem pembayaran: DP 50% dari total harga.\nPelunasan ketika barang jadi dan siap kirim / ambil.";

type EditorDraft = {
    number: string;
    date: string;
    customer: string;
    status: AlucurvQuotationStatus;
    items: AlucurvQuotationItem[];
    discount: number;
    notes: string;
};

const today = () => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
};

const emptyItem = (): AlucurvQuotationItem => ({ id: crypto.randomUUID(), description: "", qty: 1, unit_price: 0 });
const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const displayDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

function nextNumber(date: string, rows: AlucurvQuotation[]) {
    const [year, month] = date.split("-");
    const prefix = `AL/QTN/${month}/${year}/`;
    const max = rows
        .filter((row) => row.number.startsWith(prefix))
        .reduce((highest, row) => Math.max(highest, Number(row.number.split("/").pop()) || 0), 0);
    return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export default function AlucurvQuotationPage() {
    const { user } = useAuth();
    const { rows, mode, loading, error, createQuotation, updateQuotation, deleteQuotation } = useAlucurvQuotations();
    const [editorOpen, setEditorOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [number, setNumber] = useState("");
    const [date, setDate] = useState(today());
    const [customer, setCustomer] = useState("");
    const [status, setStatus] = useState<AlucurvQuotationStatus>("DRAFT");
    const [items, setItems] = useState<AlucurvQuotationItem[]>([emptyItem()]);
    const [discount, setDiscount] = useState(0);
    const [notes, setNotes] = useState(DEFAULT_NOTES);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [draftReady, setDraftReady] = useState(false);
    const [lastSavedId, setLastSavedId] = useState<string | null>(null);

    useEffect(() => {
        if (mode === "loading") return;
        try {
            const stored = localStorage.getItem(DRAFT_KEY);
            if (stored) {
                const draft = JSON.parse(stored) as EditorDraft;
                setNumber(draft.number || nextNumber(draft.date || today(), rows));
                setDate(draft.date || today());
                setCustomer(draft.customer || "");
                setStatus(draft.status || "DRAFT");
                setItems(draft.items?.length ? draft.items : [emptyItem()]);
                setDiscount(Number(draft.discount || 0));
                setNotes(draft.notes || DEFAULT_NOTES);
                setEditorOpen(true);
            } else {
                setNumber(nextNumber(date, rows));
            }
        } catch {
            setNumber(nextNumber(date, rows));
        }
        setDraftReady(true);
        // Pemulihan draft hanya dilakukan sekali setelah mode penyimpanan diketahui.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode]);

    useEffect(() => {
        if (!draftReady || !editorOpen || editingId) return;
        const timer = window.setTimeout(() => {
            const draft: EditorDraft = { number, date, customer, status, items, discount, notes };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        }, 350);
        return () => window.clearTimeout(timer);
    }, [draftReady, editorOpen, editingId, number, date, customer, status, items, discount, notes]);

    const subtotal = useMemo(() => items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unit_price || 0), 0), [items]);
    const grandTotal = Math.max(0, subtotal - Number(discount || 0));
    const filteredRows = useMemo(() => {
        const query = search.trim().toLowerCase();
        if (!query) return rows;
        return rows.filter((row) => [row.number, row.customer, row.status].some((value) => value.toLowerCase().includes(query)));
    }, [rows, search]);

    const resetEditor = (open = true) => {
        const nextDate = today();
        setEditingId(null);
        setNumber(nextNumber(nextDate, rows));
        setDate(nextDate);
        setCustomer("");
        setStatus("DRAFT");
        setItems([emptyItem()]);
        setDiscount(0);
        setNotes(DEFAULT_NOTES);
        setLastSavedId(null);
        localStorage.removeItem(DRAFT_KEY);
        setEditorOpen(open);
    };

    const updateItem = (id: string, patch: Partial<AlucurvQuotationItem>) => {
        setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
    };

    const startEdit = (quote: AlucurvQuotation) => {
        setEditingId(quote.id);
        setNumber(quote.number);
        setDate(quote.date);
        setCustomer(quote.customer);
        setStatus(quote.status);
        setItems(quote.items?.length ? quote.items : [emptyItem()]);
        setDiscount(Number(quote.discount_amount || 0));
        setNotes(quote.notes || DEFAULT_NOTES);
        setLastSavedId(quote.id);
        setEditorOpen(true);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    const save = async () => {
        const filledItems = items.filter((item) => item.description.trim() && Number(item.qty) > 0);
        if (!customer.trim()) return alert("Nama customer wajib diisi.");
        if (!date) return alert("Tanggal penawaran wajib diisi.");
        if (filledItems.length === 0) return alert("Tambahkan minimal satu item penawaran.");

        const calculatedSubtotal = filledItems.reduce((sum, item) => sum + Number(item.qty) * Number(item.unit_price), 0);
        const payload: AlucurvQuotationPayload = {
            number: number.trim(),
            date,
            customer: customer.trim(),
            status,
            items: filledItems,
            subtotal: calculatedSubtotal,
            discount_amount: Number(discount || 0),
            grand_total: Math.max(0, calculatedSubtotal - Number(discount || 0)),
            notes: notes.trim() || null,
            created_by: user?.name || user?.username || null,
        };

        setSaving(true);
        try {
            const saved = editingId
                ? await updateQuotation(editingId, payload)
                : await createQuotation(payload);
            localStorage.removeItem(DRAFT_KEY);
            setEditingId(saved.id);
            setLastSavedId(saved.id);
            alert(mode === "local" ? "Draft tersimpan di perangkat ini untuk pengujian lokal." : "Penawaran berhasil disimpan.");
        } catch (saveError) {
            alert(`Gagal menyimpan penawaran: ${saveError instanceof Error ? saveError.message : "Kesalahan tidak diketahui"}`);
        } finally {
            setSaving(false);
        }
    };

    const remove = async (quote: AlucurvQuotation) => {
        if (!confirm(`Hapus penawaran ${quote.number}?`)) return;
        try {
            await deleteQuotation(quote.id);
            if (editingId === quote.id) resetEditor(false);
        } catch (deleteError) {
            alert(`Gagal menghapus: ${deleteError instanceof Error ? deleteError.message : "Kesalahan tidak diketahui"}`);
        }
    };

    return (
        <main className={styles.page}>
            <div className={styles.header}>
                <div>
                    <p className={styles.eyebrow}>Keuangan · Alucurv</p>
                    <h1 className={styles.title}>Penawaran Harga</h1>
                    <p className={styles.subtitle}>Buat quotation Alucurv, simpan riwayat, lalu cetak atau kirim sebagai PDF.</p>
                </div>
                <button type="button" className={styles.primaryButton} onClick={() => resetEditor(true)}><Plus size={15} /> Buat Penawaran</button>
            </div>

            {mode === "local" && (
                <div className={`${styles.notice} ${styles.noticeWarning}`}>
                    <strong>Mode uji lokal.</strong>
                    <span>Tabel Supabase belum tersedia, jadi penawaran sementara tersimpan hanya di browser ini. Setelah SQL dijalankan, data baru akan tersimpan ke Supabase.</span>
                </div>
            )}
            {error && <div className={`${styles.notice} ${styles.noticeWarning}`}>{error}</div>}

            {editorOpen && (
                <section className={styles.editor}>
                    <div className={styles.editorHead}>
                        <div>
                            <p className={styles.eyebrow}>{editingId ? "Ubah dokumen" : "Dokumen baru"}</p>
                            <h2 className={styles.editorTitle}>{number || "Nomor sedang disiapkan"}</h2>
                        </div>
                        {!editingId && <span className={styles.autosave}>● Draft tersimpan otomatis</span>}
                    </div>

                    <div className={styles.editorBody}>
                        <div className={styles.metaGrid}>
                            <label className={styles.field}><span className={styles.label}>No. Penawaran</span><input className={styles.input} value={number} readOnly /></label>
                            <label className={styles.field}><span className={styles.label}>Tanggal</span><input className={styles.input} type="date" value={date} onChange={(event) => { const value = event.target.value; setDate(value); if (!editingId && value) setNumber(nextNumber(value, rows)); }} /></label>
                            <label className={styles.field}><span className={styles.label}>Customer</span><input className={styles.input} value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nama customer / perusahaan" /></label>
                            <label className={styles.field}><span className={styles.label}>Status</span><select className={styles.select} value={status} onChange={(event) => setStatus(event.target.value as AlucurvQuotationStatus)}><option value="DRAFT">Draft</option><option value="DIKIRIM">Dikirim</option><option value="DISETUJUI">Disetujui</option><option value="DIBATALKAN">Dibatalkan</option></select></label>
                        </div>

                        <div className={styles.sectionHead}>
                            <h3 className={styles.sectionTitle}>Rincian barang / pekerjaan</h3>
                            <button type="button" className={styles.rowButton} onClick={() => setItems((current) => [...current, emptyItem()])}><Plus size={13} /> Tambah baris</button>
                        </div>
                        <div className={styles.sheetWrap}>
                            <table className={styles.sheet}>
                                <thead><tr><th>No</th><th>Deskripsi</th><th>Qty</th><th>Harga</th><th>Total</th><th /></tr></thead>
                                <tbody>
                                    {items.map((item, index) => (
                                        <tr key={item.id}>
                                            <td>{index + 1}</td>
                                            <td><input className={styles.cellInput} value={item.description} onChange={(event) => updateItem(item.id, { description: event.target.value })} placeholder="Contoh: Pintu aluminium lengkung custom" /></td>
                                            <td><input className={styles.cellInput} type="number" min="0" step="1" value={item.qty || ""} onChange={(event) => updateItem(item.id, { qty: Number(event.target.value) })} /></td>
                                            <td><input className={styles.cellInput} type="number" min="0" step="1000" value={item.unit_price || ""} onChange={(event) => updateItem(item.id, { unit_price: Number(event.target.value) })} placeholder="0" /></td>
                                            <td className={styles.moneyCell}>{rupiah(Number(item.qty || 0) * Number(item.unit_price || 0))}</td>
                                            <td><button type="button" className={styles.removeItem} onClick={() => setItems((current) => current.length === 1 ? [emptyItem()] : current.filter((row) => row.id !== item.id))} aria-label="Hapus baris"><Trash2 size={14} /></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className={styles.adjustments}>
                            <label className={styles.field}><span className={styles.label}>Catatan / ketentuan pembayaran</span><textarea className={styles.textarea} value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
                            <div>
                                <label className={styles.field}><span className={styles.label}>Diskon (Rp)</span><input className={styles.input} type="number" min="0" step="1000" value={discount || ""} onChange={(event) => setDiscount(Number(event.target.value))} /></label>
                                <div className={styles.summary}>
                                    <div className={styles.summaryRow}><span>Subtotal</span><strong>{rupiah(subtotal)}</strong></div>
                                    <div className={styles.summaryRow}><span>Diskon</span><strong>- {rupiah(discount)}</strong></div>
                                    <div className={`${styles.summaryRow} ${styles.summaryTotal}`}><span>Total</span><span>{rupiah(grandTotal)}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={styles.editorActions}>
                        <button type="button" className={styles.secondaryButton} onClick={() => setEditorOpen(false)}>Tutup</button>
                        {(lastSavedId || editingId) && <Link className={styles.secondaryButton} href={`/alucurv-quotation/${lastSavedId || editingId}`} target="_blank"><Printer size={14} /> Cetak / PDF</Link>}
                        <button type="button" className={styles.primaryButton} disabled={saving} onClick={save}><Save size={14} /> {saving ? "Menyimpan..." : editingId ? "Simpan Perubahan" : "Simpan Penawaran"}</button>
                    </div>
                </section>
            )}

            <section className={styles.history}>
                <div className={styles.historyHead}>
                    <div><p className={styles.eyebrow}>Arsip</p><h2 className={styles.editorTitle}>Riwayat Penawaran</h2></div>
                    <input className={`${styles.input} ${styles.search}`} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nomor, customer, atau status..." />
                </div>
                <div className={styles.historyTableWrap}>
                    <table className={styles.historyTable}>
                        <thead><tr><th>No. Penawaran</th><th>Tanggal</th><th>Customer</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th /></tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={6} className={styles.empty}>Memuat penawaran...</td></tr> : filteredRows.length === 0 ? <tr><td colSpan={6} className={styles.empty}>Belum ada penawaran. Klik “Buat Penawaran” untuk mulai.</td></tr> : filteredRows.map((quote) => (
                                <tr key={quote.id}>
                                    <td className={styles.number}>{quote.number}</td>
                                    <td>{displayDate(quote.date)}</td>
                                    <td>{quote.customer}</td>
                                    <td><span className={`${styles.status} ${styles[`status${quote.status}`]}`}>{quote.status}</span></td>
                                    <td className={styles.amount}>{rupiah(Number(quote.grand_total))}</td>
                                    <td><div className={styles.actions}><Link className={styles.secondaryButton} href={`/alucurv-quotation/${quote.id}`} target="_blank">Cetak</Link><button type="button" className={styles.secondaryButton} onClick={() => startEdit(quote)}>Ubah</button><button type="button" className={styles.dangerButton} onClick={() => void remove(quote)}>Hapus</button></div></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}
