"use client";
import { useState } from "react";
import { useTagihanBahan, TagihanBahan, TagihanBahanItem } from "@/lib/tagihan-bahan-store";
import { formatCurrency, formatDate } from "@/lib/utils"; // assuming utils has these, if not we will define inline or use standard JS

export default function TagihanBahanPage() {
    const { tagihanList, addTagihan, deleteTagihan, updateTagihan } = useTagihanBahan();
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [viewData, setViewData] = useState<TagihanBahan | null>(null);

    // Form state
    const [formTanggal, setFormTanggal] = useState(new Date().toISOString().split("T")[0]);
    const [formSupplier, setFormSupplier] = useState("");
    const [formNoInvoice, setFormNoInvoice] = useState("");
    const [formCatatan, setFormCatatan] = useState("");
    const [formItems, setFormItems] = useState<Omit<TagihanBahanItem, "id" | "total">[]>([
        { namaBahan: "", qty: 1, ukuran: 6, hargaSatuan: 0 }
    ]);

    const handleAddItem = () => {
        setFormItems([...formItems, { namaBahan: "", qty: 1, ukuran: 6, hargaSatuan: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setFormItems(formItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: keyof Omit<TagihanBahanItem, "id" | "total">, value: any) => {
        const newItems = [...formItems];
        newItems[index] = { ...newItems[index], [field]: value };
        setFormItems(newItems);
    };

    const calculateGrandTotal = () => {
        return formItems.reduce((sum, item) => sum + (item.qty * item.hargaSatuan), 0);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Validation
        if (!formSupplier) return alert("Pilih / isi supplier!");
        if (formItems.length === 0) return alert("Minimal 1 item bahan baku!");
        if (formItems.some(item => !item.namaBahan || item.qty <= 0 || item.hargaSatuan <= 0)) {
            return alert("Harap lengkapi detail item (Nama, Qty, Harga > 0)!");
        }

        const itemsWithExtras = formItems.map((item, index) => ({
            ...item,
            id: `item-${Date.now()}-${index}`,
            total: item.qty * item.hargaSatuan
        }));

        addTagihan({
            tanggal: new Date(formTanggal).toISOString(),
            noInvoice: formNoInvoice || `INV-${Date.now()}`,
            supplier: formSupplier,
            catatan: formCatatan,
            items: itemsWithExtras,
            grandTotal: calculateGrandTotal(),
            isPaid: false,
            paidDate: ""
        });

        setIsFormOpen(false);
        resetForm();
    };

    const resetForm = () => {
        setFormTanggal(new Date().toISOString().split("T")[0]);
        setFormSupplier("");
        setFormNoInvoice("");
        setFormCatatan("");
        setFormItems([{ namaBahan: "", qty: 1, ukuran: 6, hargaSatuan: 0 }]);
    };

    // Helper functions for formatting just in case
    const toRupiah = (num: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(num);
    const toDateStr = (isoTanggal: string) => {
        try {
            return new Intl.DateTimeFormat("id-ID", { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(isoTanggal));
        } catch (e) {
            return isoTanggal;
        }
    };

    const inputSt: React.CSSProperties = {
        width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7,
        padding: "8px 12px", fontSize: 13, color: "#3C2F2F",
        background: "#FFFBF7", outline: "none", boxSizing: "border-box",
    };
    const labelSt: React.CSSProperties = {
        fontSize: 10, fontWeight: 700, color: "#B89678",
        letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 5,
        marginTop: 0
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F5EBDD" }}>
            {/* ── Header ──────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 18px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A67B5B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                    </svg>
                    <span style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>Tagihan Bahan Baku</span>
                </div>
                <button
                    onClick={() => { resetForm(); setIsFormOpen(true); }}
                    style={{
                        padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "#A67B5B", color: "white", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6
                    }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                    Tambah Tagihan
                </button>
            </div>

            {/* List / Table Panel */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#FAF7F3" }}>
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 24px rgba(92,64,51,0.06)", border: "1px solid #E6D5BE", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
                        <thead>
                            <tr>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "left" }}>Tanggal</th>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "left" }}>No. Invoice</th>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "left" }}>Supplier</th>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "right" }}>Grand Total</th>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "center" }}>Status</th>
                                <th style={{ background: "#F5EBDD", color: "#5C4033", padding: "10px 14px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #D1BFA3", textAlign: "center", width: 100 }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {tagihanList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} style={{ padding: "30px", textAlign: "center", color: "#B89678", fontWeight: 600 }}>Belum ada data tagihan bahan baku.</td>
                                </tr>
                            ) : (
                                tagihanList.map((tagihan, i) => (
                                    <tr key={tagihan.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8" }}>{toDateStr(tagihan.tanggal)}</td>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8", fontWeight: 700, color: "#3C2F2F" }}>{tagihan.noInvoice}</td>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8", color: "#555" }}>{tagihan.supplier}</td>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8", textAlign: "right", fontWeight: 800, color: "#A67B5B" }}>{toRupiah(tagihan.grandTotal)}</td>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8", textAlign: "center" }}>
                                            {tagihan.isPaid ? (
                                                <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#DCFCE7", color: "#15803D" }}>Lunas</span>
                                            ) : (
                                                <span style={{ padding: "3px 10px", borderRadius: 99, fontSize: 10, fontWeight: 700, background: "#FEF2F2", color: "#991B1B" }}>Belum Lunas</span>
                                            )}
                                        </td>
                                        <td style={{ padding: "10px 14px", borderBottom: "1px solid #F0E6D8", textAlign: "center" }}>
                                            <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                                                <button 
                                                    onClick={() => setViewData(tagihan)}
                                                    style={{ background: "#4B5563", color: "white", border: "none", borderRadius: 6, padding: "5px", cursor: "pointer", display: "flex" }}
                                                    title="Lihat Detail"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                                </button>
                                                <button 
                                                    onClick={() => {
                                                        if(confirm("Apakah Anda yakin ingin menghapus tagihan ini?")) deleteTagihan(tagihan.id);
                                                    }}
                                                    style={{ background: "#DC2626", color: "white", border: "none", borderRadius: 6, padding: "5px", cursor: "pointer", display: "flex" }}
                                                    title="Hapus"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah Tagihan */}
            {isFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ border: "1px solid #E6D5BE" }}>
                        <div className="p-4 sm:p-5 flex justify-between items-center" style={{ borderBottom: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#5C4033" }}>Input Tagihan Bahan Baku</h2>
                            <button onClick={() => setIsFormOpen(false)} style={{ color: "#B89678", cursor: "pointer" }} className="hover:opacity-70">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                            <form id="tagihan-form" onSubmit={handleSubmit} className="space-y-7">
                                {/* Info Utama */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                    <div className="space-y-1.5">
                                        <label style={labelSt}>Tanggal</label>
                                        <input 
                                            type="date" 
                                            required
                                            style={inputSt} 
                                            value={formTanggal}
                                            onChange={(e) => setFormTanggal(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label style={labelSt}>No Invoice (Opsional)</label>
                                        <input 
                                            type="text" 
                                            placeholder="Auto-generate jika kosong"
                                            style={inputSt} 
                                            value={formNoInvoice}
                                            onChange={(e) => setFormNoInvoice(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1.5 sm:col-span-2">
                                        <label style={labelSt}>Supplier</label>
                                        <input 
                                            type="text" 
                                            required
                                            placeholder="Contoh: PT. Steel Jaya"
                                            style={inputSt}
                                            value={formSupplier}
                                            onChange={(e) => setFormSupplier(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {/* Items */}
                                <div className="space-y-4 mt-7 pt-5" style={{ borderTop: "1px dashed #D1BFA3" }}>
                                    <div className="flex justify-between items-center mb-3">
                                        <h3 style={{ fontSize: 13, fontWeight: 800, color: "#5C4033" }}>Detail Bahan Baku</h3>
                                        <button 
                                            type="button" 
                                            onClick={handleAddItem}
                                            style={{
                                                padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                                                background: "#FEF9C3", color: "#A16207", fontWeight: 700, fontSize: 12,
                                                display: "flex", alignItems: "center", gap: 5
                                            }}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                            Tambah Item
                                        </button>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        {formItems.map((item, index) => (
                                            <div key={index} className="flex flex-col sm:flex-row gap-4 items-end p-4 rounded-xl" style={{ background: "#FAF7F3", border: "1.5px solid #F0E6D8" }}>
                                                <div className="w-full sm:flex-1 space-y-1.5">
                                                    <label style={labelSt}>Nama Bahan</label>
                                                    <input 
                                                        type="text" 
                                                        required
                                                        placeholder="Semen, Besi Plat, dll"
                                                        style={inputSt}
                                                        value={item.namaBahan}
                                                        onChange={(e) => handleItemChange(index, "namaBahan", e.target.value)}
                                                    />
                                                </div>
                                                <div className="w-full sm:w-24 space-y-1.5">
                                                    <label style={labelSt}>Qty (Batang)</label>
                                                    <input 
                                                        type="number" 
                                                        required min="1"
                                                        style={inputSt}
                                                        value={item.qty || ""}
                                                        onChange={(e) => handleItemChange(index, "qty", Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="w-full sm:w-24 space-y-1.5">
                                                    <label style={labelSt}>Ukuran</label>
                                                    <div className="relative">
                                                        <input 
                                                            type="number" 
                                                            disabled
                                                            style={{ ...inputSt, background: "#F5EBDD", color: "#A67B5B", fontWeight: 700 }}
                                                            value={item.ukuran}
                                                        />
                                                        <span className="absolute right-3 top-2 text-sm" style={{ color: "#A67B5B", fontWeight: 700 }}>m</span>
                                                    </div>
                                                </div>
                                                <div className="w-full sm:w-40 space-y-1.5">
                                                    <label style={labelSt}>Harga Satuan (Rp)</label>
                                                    <input 
                                                        type="number" 
                                                        required min="1"
                                                        style={inputSt}
                                                        value={item.hargaSatuan || ""}
                                                        onChange={(e) => handleItemChange(index, "hargaSatuan", Number(e.target.value))}
                                                    />
                                                </div>
                                                <div className="w-full sm:w-40 space-y-1.5">
                                                    <label style={labelSt}>Total Harga</label>
                                                    <div style={{ ...inputSt, background: "#FFFBF7", border: "1.5px solid transparent", borderLeft: "4px solid #A67B5B", fontWeight: 800, textAlign: "right", color: "#5C4033" }}>
                                                        {toRupiah(item.qty * item.hargaSatuan)}
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    onClick={() => handleRemoveItem(index)}
                                                    disabled={formItems.length === 1}
                                                    style={{
                                                        padding: "8px", borderRadius: 7, border: "none", cursor: formItems.length === 1 ? "not-allowed" : "pointer",
                                                        background: formItems.length === 1 ? "transparent" : "#FEF2F2",
                                                        color: formItems.length === 1 ? "#ccc" : "#DC2626",
                                                        height: "36px", marginTop: "22px"
                                                    }}
                                                    title="Hapus Item"
                                                >
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="flex justify-end pt-5 border-t mt-5" style={{ borderColor: '#E6D5BE' }}>
                                        <div className="text-right">
                                            <div style={{...labelSt, marginBottom: 2}}>Grand Total Tagihan</div>
                                            <div style={{ fontSize: 26, fontWeight: 900, color: "#A67B5B", letterSpacing: -0.5 }}>{toRupiah(calculateGrandTotal())}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5 mt-2">
                                    <label style={labelSt}>Catatan (Opsional)</label>
                                    <textarea 
                                        style={{ ...inputSt, minHeight: 90 }}
                                        placeholder="Tambahkan catatan jika diperlukan..."
                                        value={formCatatan}
                                        onChange={(e) => setFormCatatan(e.target.value)}
                                    ></textarea>
                                </div>
                            </form>
                        </div>

                        <div className="border-t p-4 sm:p-5 flex justify-end gap-3 rounded-b-xl" style={{ borderTop: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                            <button 
                                type="button" 
                                onClick={() => setIsFormOpen(false)}
                                style={{
                                    padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", cursor: "pointer",
                                    background: "white", color: "#5C4033", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap"
                                }}
                            >
                                Batal
                            </button>
                            <button 
                                type="submit" 
                                form="tagihan-form"
                                style={{
                                    padding: "8px 18px", borderRadius: 7, border: "none", cursor: "pointer",
                                    background: "#A67B5B", color: "white", fontWeight: 700, fontSize: 13, whiteSpace: "nowrap"
                                }}
                            >
                                Simpan Tagihan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal View Mode */}
            {viewData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" style={{ border: "1px solid #E6D5BE" }}>
                        <div className="p-4 sm:p-5 flex justify-between items-center" style={{ borderBottom: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                            <div>
                                <h2 style={{ fontSize: 18, fontWeight: 800, color: "#5C4033", display: "flex", alignItems: "center", gap: 10 }}>
                                    Detail Tagihan <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", background: "#FFFBF7", border: "1px solid #D1BFA3", borderRadius: 6, color: "#A67B5B" }}>{viewData.noInvoice}</span>
                                </h2>
                            </div>
                            <button onClick={() => setViewData(null)} style={{ color: "#B89678", cursor: "pointer" }} className="hover:opacity-70">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg" style={{ background: "#F5EBDD", borderLeft: "4px solid #A67B5B" }}>
                                <div>
                                    <div className="mb-1" style={{ color: "#B89678", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Supplier</div>
                                    <div style={{ color: "#3C2F2F", fontWeight: 800, fontSize: 13 }}>{viewData.supplier}</div>
                                </div>
                                <div className="text-right">
                                    <div className="mb-1" style={{ color: "#B89678", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Tanggal</div>
                                    <div style={{ color: "#3C2F2F", fontWeight: 800, fontSize: 13 }}>{toDateStr(viewData.tanggal)}</div>
                                </div>
                                <div>
                                    <div className="mb-1" style={{ color: "#B89678", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Status Pembayaran</div>
                                    <div>
                                        {viewData.isPaid ? (
                                            <span style={{ background: "#DCFCE7", color: "#15803D", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Lunas</span>
                                        ) : (
                                            <span style={{ background: "#FEF2F2", color: "#991B1B", padding: "4px 8px", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>Belum Lunas</span>
                                        )}
                                    </div>
                                </div>
                                {viewData.catatan && (
                                    <div className="col-span-2 mt-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                                        <div className="mb-1" style={{ color: "#B89678", fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1 }}>Catatan</div>
                                        <div style={{ color: "#3C2F2F", fontSize: 12, fontStyle: "italic" }}>{viewData.catatan}</div>
                                    </div>
                                )}
                            </div>

                            <div style={{ background: "white", borderRadius: 12, border: "1px solid #E6D5BE", overflow: "hidden" }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                                    <thead>
                                        <tr>
                                            <th style={{ background: "#111", color: "#fff", padding: "9px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "left" }}>Nama Bahan</th>
                                            <th style={{ background: "#111", color: "#fff", padding: "9px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", width: 80 }}>Qty</th>
                                            <th style={{ background: "#111", color: "#fff", padding: "9px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right" }}>Harga Satuan</th>
                                            <th style={{ background: "#111", color: "#fff", padding: "9px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right", width: 120 }}>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viewData.items.map((item, idx) => (
                                            <tr key={item.id || idx} style={{ background: idx % 2 === 0 ? "white" : "#FAFAFA" }}>
                                                <td style={{ padding: "9px 10px", borderBottom: "1px solid #E5E5E5", fontSize: 12 }}>{item.namaBahan}</td>
                                                <td style={{ padding: "9px 10px", textAlign: "center", borderBottom: "1px solid #E5E5E5", fontSize: 12, fontWeight: 700 }}>{item.qty} <span style={{ fontWeight: 400, fontSize: 10 }}>({item.ukuran}m)</span></td>
                                                <td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #E5E5E5", fontSize: 12 }}>{toRupiah(item.hargaSatuan)}</td>
                                                <td style={{ padding: "9px 10px", textAlign: "right", borderBottom: "1px solid #E5E5E5", fontSize: 12, fontWeight: 700, color: "#A0522D" }}>{toRupiah(item.total)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr style={{ background: "#111" }}>
                                            <td colSpan={3} style={{ padding: "11px 10px", textAlign: "right", color: "white", fontWeight: 800, fontSize: 14 }}>Grand Total</td>
                                            <td style={{ padding: "11px 10px", textAlign: "right", fontWeight: 900, color: "white", fontSize: 14 }}>{toRupiah(viewData.grandTotal)}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>

                        <div className="border-t p-4 sm:p-5 flex justify-between gap-3 rounded-b-xl" style={{ borderTop: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                            <button 
                                onClick={() => {
                                    updateTagihan(viewData.id, { 
                                        isPaid: !viewData.isPaid,
                                        paidDate: !viewData.isPaid ? new Date().toISOString() : "" 
                                    });
                                    setViewData({...viewData, isPaid: !viewData.isPaid});
                                }}
                                style={{
                                    padding: "8px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                                    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
                                    background: viewData.isPaid ? "#FEF2F2" : "#DCFCE7",
                                    color: viewData.isPaid ? "#991B1B" : "#15803D"
                                }}
                            >
                                {viewData.isPaid ? 'Batal Lunas' : 'Tandai Lunas'}
                            </button>
                            <button 
                                onClick={() => setViewData(null)}
                                style={{
                                    padding: "8px 18px", borderRadius: 7, border: "1px solid #D1BFA3", cursor: "pointer",
                                    background: "white", color: "#5C4033", fontWeight: 700, fontSize: 12,
                                }}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
