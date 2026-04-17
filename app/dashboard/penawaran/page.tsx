"use client";
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth";
import { usePesanan } from "@/lib/pesanan-store";
import { 
    Plus, Trash2, Printer, Save, History, 
    X, CheckCircle2, Loader2, Search,
    ArrowRightLeft, FileSpreadsheet, Eye, 
    ChevronLeft, ChevronRight, FileText, Pencil
} from "lucide-react";

/* ================================================================
   MODUL PENAWARAN (QUOTATION) - ERP STANDARD UI
   Layout: Full-width Card Stack
   Modeled after: Keuangan & Status Barang
   ================================================================ */

interface QuoteItem {
    id: string;
    description: string;
    size: string;
    qty: string;
    price: string;
    total: number;
}

interface Quotation {
    id: string;
    no_quote: string;
    customer: string;
    tanggal: string;
    items: QuoteItem[];
    subtotal: number;
    dp: number;
    diskon: number;
    grand_total: number;
    notes: string;
    payment_terms: string;
    franco: string;
    remark: string;
}

function fmtRp(val: number): string {
    return "Rp " + Math.round(val).toLocaleString("id-ID");
}

function parseIdNum(s: string | undefined): number {
    if (!s) return 0;
    const str = s.trim();
    if (str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    return parseFloat(str.replace(/\./g, "")) || 0;
}

export default function PenawaranPage() {
    const { user } = useAuth();
    const { addRow } = usePesanan();
    const [activeTab, setActiveTab] = useState<"buat" | "riwayat">("buat");
    const [showPreview, setShowPreview] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    
    // Form States
    const [customer, setCustomer] = useState("");
    const [noQuote, setNoQuote] = useState(() => {
        const d = new Date();
        const ymd = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
        const rand = Math.floor(Math.random() * 900) + 100;
        return `QT-${ymd}-${rand}`;
    });
    const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);
    const [items, setItems] = useState<QuoteItem[]>([
        { id: "1", description: "", size: "", qty: "", price: "", total: 0 }
    ]);
    const [dp, setDp] = useState("");
    const [diskon, setDiskon] = useState("");
    const [notes, setNotes] = useState("Sistem pembayaran : DP 30% dari total harga. Pelunasan saat barang diterima / terpasang.");
    
    // History States
    const [riwayat, setRiwayat] = useState<Quotation[]>([]);
    const [loadingRiwayat, setLoadingRiwayat] = useState(false);
    const [searchRiwayat, setSearchRiwayat] = useState("");

    // Calculations
    const subtotal = useMemo(() => items.reduce((acc, it) => acc + it.total, 0), [items]);
    const dpNum = parseIdNum(dp);
    const diskonNum = parseIdNum(diskon);
    const grandTotal = Math.max(0, subtotal - dpNum - diskonNum);

    // Helpers
    const updateItem = (id: string, field: keyof QuoteItem, val: string) => {
        setItems(prev => prev.map(it => {
            if (it.id !== id) return it;
            const updated = { ...it, [field]: val };
            if (field === "qty" || field === "price" || field === "size") {
                const q = parseIdNum(field === "qty" ? val : it.qty);
                const u = parseIdNum(field === "size" ? val : it.size);
                const p = parseIdNum(field === "price" ? val : it.price);
                updated.total = q * u * p;
            }
            return updated;
        }));
    };

    const addItem = () => {
        setItems([...items, { id: Math.random().toString(36).substr(2,9), description: "", size: "", qty: "", price: "", total: 0 }]);
    };

    const removeItem = (id: string) => {
        if (items.length > 1) setItems(items.filter(it => it.id !== id));
    };

    const fetchRiwayat = async () => {
        setLoadingRiwayat(true);
        try {
            const { data, error } = await supabase
                .from("quotations")
                .select("*")
                .order("created_at", { ascending: false });
            if (error) throw error;
            setRiwayat(data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingRiwayat(false);
        }
    };

    useEffect(() => {
        if (activeTab === "riwayat") fetchRiwayat();
    }, [activeTab]);

    const resetForm = () => {
        setCustomer("");
        setNoQuote(() => {
            const d = new Date();
            const ymd = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
            const rand = Math.floor(Math.random() * 900) + 100;
            return `QT-${ymd}-${rand}`;
        });
        setTanggal(new Date().toISOString().split('T')[0]);
        setItems([{ id: "1", description: "", size: "", qty: "", price: "", total: 0 }]);
        setDp("");
        setDiskon("");
        setNotes("Sistem pembayaran : DP 30% dari total harga. Pelunasan saat barang diterima / terpasang.");
        setEditingId(null);
    };

    const handleEdit = (quote: Quotation) => {
        setEditingId(quote.id);
        setCustomer(quote.customer);
        setNoQuote(quote.no_quote);
        setTanggal(quote.tanggal);
        setItems(quote.items);
        setDp(String(quote.dp));
        setDiskon(String(quote.diskon));
        setNotes(quote.notes);
        setActiveTab("buat");
    };

    const handleSave = async () => {
        if (!customer) return alert("Pilih customer dulu!");
        try {
            const payload = {
                no_quote: noQuote,
                customer,
                tanggal,
                items,
                subtotal,
                dp: dpNum,
                diskon: diskonNum,
                grand_total: grandTotal,
                notes,
                created_by: user?.username
            };

            if (editingId) {
                const { error } = await supabase
                    .from("quotations")
                    .update(payload)
                    .eq("id", editingId);
                if (error) throw error;
                alert("Penawaran berhasil diperbarui!");
            } else {
                const { error } = await supabase
                    .from("quotations")
                    .insert([payload]);
                if (error) throw error;
                alert("Penawaran berhasil disimpan!");
            }
            
            resetForm();
            setActiveTab("riwayat");
        } catch (err) {
            alert("Gagal simpan: " + (err as any).message);
        }
    };

    const handleConvertToOrder = async (quote: Quotation) => {
        if (!confirm(`Konversi Penawaran ${quote.no_quote} menjadi Pesanan Utama?`)) return;
        try {
            for (const it of quote.items) {
                await addRow({
                    tanggal: quote.tanggal,
                    customer: quote.customer,
                    deskripsi: it.description,
                    ukuran: it.size,
                    qty: it.qty,
                    harga: it.price,
                    no_inv: "",
                    di_kirim: false
                });
            }
            alert("Berhasil dikonversi ke Pesanan!");
        } catch (err) {
            alert("Gagal konversi: " + (err as any).message);
        }
    };
    
    const handleDeleteQuote = async (id: string) => {
        if (!confirm("Hapus penawaran ini secara permanen?")) return;
        try {
            const { error } = await supabase.from("quotations").delete().eq("id", id);
            if (error) throw error;
            setRiwayat(prev => prev.filter(q => q.id !== id));
        } catch (err) {
            alert("Gagal hapus: " + (err as any).message);
        }
    };

    const cetakPenawaran = (quote?: Quotation) => {
        const q = quote || { no_quote: noQuote, customer, tanggal, items, subtotal, dp: dpNum, diskon: diskonNum, grand_total: grandTotal, notes };
        const win = window.open("", "_blank");
        if (!win) return;
        const currentUserName = user?.name?.toUpperCase() || "ADMIN";
        const tableRows = q.items.map((it: any, i: number) => `
            <tr><td style="text-align:center">${i+1}</td><td>${it.description || '—'}</td><td style="text-align:center">${it.size || '—'}</td><td style="text-align:center">${it.qty || '—'}</td><td style="text-align:right">${fmtRp(parseIdNum(it.price))}</td><td style="text-align:right;font-weight:600">${fmtRp(it.total)}</td></tr>
        `).join("");
        win.document.write(`<html><head><title>Penawaran ${q.no_quote}</title><style>body{font-family:sans-serif;padding:40px;color:#333;}.kop{border-bottom:2px solid #5C4033;padding-bottom:15px;margin-bottom:25px;}.h1{font-size:20px;font-weight:800;margin:0;color:#5C4033;}.info{font-size:11px;color:#666;}.title{text-align:center;font-size:24px;font-weight:900;margin:30px 0;letter-spacing:2px;}.meta{display:flex;justify-content:space-between;margin-bottom:25px;}.meta-box{border:1px solid #ddd;padding:12px;width:48%;font-size:12px;background:#fcfcfc;}table{width:100%;border-collapse:collapse;font-size:12px;}th{background:#5C4033;color:#fff;padding:10px;border:1px solid #5C4033;text-transform:uppercase;}td{padding:8px 10px;border:1px solid #ddd;}.total-box{margin-top:20px;display:flex;justify-content:flex-end;}.total-table{width:300px;border-collapse:collapse;}.total-table td{padding:6px 12px;border:1px solid #ddd;}.grand{background:#5C4033;color:#fff;font-weight:800;}.notes{margin-top:30px;font-size:11px;color:#888;font-style:italic; border-top: 1px dashed #ddd; padding-top: 10px;}.sign{margin-top:40px;display:flex;justify-content:flex-end;}.sign-box{text-align:center;width:200px;}.sign-name{margin-top:60px;font-weight:800;text-decoration:underline;}</style></head><body><div class="kop"><div class="h1">TOTO ALUMINIUM MANUFACTURE</div><div class="info">Jl. Rawa Mulya, Bekasi. Telp: 0813 1191 2002</div></div><div class="title">QUOTATION</div><div class="meta"><div class="meta-box"><strong>DARI:</strong><br/>CV TOTO ALUMINIUM MANUFACTURE<br/>${currentUserName}</div><div class="meta-box"><strong>KEPADA YTH:</strong><br/><span style="font-size:16px;font-weight:900">${q.customer.toUpperCase()}</span></div></div><table><thead><tr><th width="30">No</th><th>Description</th><th width="60">UK</th><th width="40">Qty</th><th width="120">Harga</th><th width="120">Total</th></tr></thead><tbody>${tableRows}</tbody></table><div class="total-box"><table class="total-table"><tr><td style="text-align:right">Subtotal</td><td style="text-align:right">${fmtRp(q.subtotal)}</td></tr>${q.dp > 0 ? `<tr><td style="text-align:right">DP</td><td style="text-align:right">-${fmtRp(q.dp)}</td></tr>` : ""}${q.diskon > 0 ? `<tr><td style="text-align:right">Diskon</td><td style="text-align:right">-${fmtRp(q.diskon)}</td></tr>` : ""}<tr class="grand"><td style="text-align:right">Grand Total</td><td style="text-align:right">${fmtRp(q.grand_total)}</td></tr></table></div><div class="notes">Note: ${q.notes}</div><div class="sign"><div class="sign-box"><p>Hormat Kami,</p><p class="sign-name">${currentUserName}</p><p style="font-size:10px">TOTO ALUMINIUM TEAM</p></div></div><script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
        win.document.close();
    };

    const filteredRiwayat = riwayat.filter(q => 
        q.customer.toLowerCase().includes(searchRiwayat.toLowerCase()) || 
        q.no_quote.toLowerCase().includes(searchRiwayat.toLowerCase())
    );

    return (
        <div className="page-content space-y-5">
            
            {/* Header Area */}
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <h1 className="page-title-h1 tracking-tight">Penawaran</h1>
                    <p className="page-subtitle">Buat dan kelola surat penawaran harga kepada klien</p>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => { resetForm(); setActiveTab("buat"); }}
                        className={`btn ${activeTab === "buat" && !editingId ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <Plus size={16} /> BUAT BARU
                    </button>
                    <button 
                        onClick={() => setActiveTab("riwayat")}
                        className={`btn ${activeTab === "riwayat" || editingId ? "btn-primary" : "btn-secondary"}`}
                        style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                    >
                        <History size={16} /> RIWAYAT / EDIT
                    </button>
                </div>
            </div>

            {activeTab === "buat" ? (
                <div className="space-y-6 animate-fade-in max-w-6xl">
                    
                    {/* Card 1: Informasi Klien */}
                    <div className="card">
                        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Informasi Klien & Dokumen</span>
                            {editingId && (
                                <span style={{ background: "#FEF3C7", color: "#B45309", padding: "4px 10px", borderRadius: 20, fontSize: 10, fontWeight: 800 }}>
                                    MODE EDIT: {noQuote}
                                </span>
                            )}
                        </div>
                        <div className="card-body">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="form-label">Nama Customer / Partner</label>
                                    <input 
                                        className="form-input"
                                        placeholder="Masukkan nama customer..."
                                        value={customer}
                                        onChange={e => setCustomer(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Nomor Penawaran</label>
                                    <input className="form-input bg-slate-50" value={noQuote} readOnly />
                                </div>
                                <div>
                                    <label className="form-label">Tanggal Penawaran</label>
                                    <input 
                                        type="date" 
                                        className="form-input" 
                                        value={tanggal} 
                                        onChange={e => setTanggal(e.target.value)} 
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Daftar Item */}
                    <div className="card">
                        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>Daftar Item Penawaran</span>
                            <button onClick={addItem} className="btn btn-secondary" style={{ fontSize: 11, padding: '4px 10px' }}>
                                <Plus size={12} className="mr-1" /> TAMBAH BARIS
                            </button>
                        </div>
                        <div className="table-container">
                            <table className="data-table">
                                <thead style={{ background: "#ede4d6" }}>
                                    <tr>
                                        <th style={{ width: 40, textAlign: "center" }}>NO</th>
                                        <th>DESKRIPSI ITEM</th>
                                        <th style={{ width: 100, textAlign: "center" }}>UKURAN</th>
                                        <th style={{ width: 80, textAlign: "center" }}>QTY</th>
                                        <th style={{ width: 150, textAlign: "right" }}>HARGA SATUAN</th>
                                        <th style={{ width: 150, textAlign: "right" }}>NILAI TOTAL</th>
                                        <th style={{ width: 50, textAlign: "center" }}>AKSI</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, idx) => (
                                        <tr key={it.id}>
                                            <td style={{ textAlign: "center", fontSize: 12, color: "#999" }}>{idx + 1}</td>
                                            <td style={{ padding: 0 }}>
                                                <input 
                                                    className="w-full h-full px-4 py-3 bg-transparent outline-none border-none text-[13px]"
                                                    placeholder="Deskripsi..."
                                                    value={it.description}
                                                    onChange={e => updateItem(it.id, "description", e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                <input 
                                                    className="w-full h-full px-2 py-3 bg-transparent outline-none border-none text-[13px] text-center"
                                                    placeholder="—"
                                                    value={it.size}
                                                    onChange={e => updateItem(it.id, "size", e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                <input 
                                                    className="w-full h-full px-2 py-3 bg-transparent outline-none border-none text-[13px] text-center font-bold"
                                                    placeholder="0"
                                                    value={it.qty}
                                                    onChange={e => updateItem(it.id, "qty", e.target.value)}
                                                />
                                            </td>
                                            <td style={{ padding: 0 }}>
                                                <input 
                                                    className="w-full h-full px-4 py-3 bg-transparent outline-none border-none text-[13px] text-right"
                                                    placeholder="0"
                                                    value={it.price}
                                                    onChange={e => updateItem(it.id, "price", e.target.value)}
                                                />
                                            </td>
                                            <td style={{ textAlign: "right", fontWeight: 700, color: "#5C4033", paddingRight: 16 }}>
                                                {fmtRp(it.total)}
                                            </td>
                                            <td style={{ textAlign: "center" }}>
                                                <button onClick={() => removeItem(it.id)} className="text-red-400 hover:text-red-600 transition-colors">
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Card 3: Penyesuaian & Catatan */}
                    <div className="card">
                        <div className="card-header">Penyesuaian & Keterangan Tambahan</div>
                        <div className="card-body">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="form-label">DP (Uang Muka)</label>
                                            <input className="form-input" value={dp} onChange={e => setDp(e.target.value)} placeholder="0" />
                                        </div>
                                        <div>
                                            <label className="form-label">Diskon Khusus</label>
                                            <input className="form-input" value={diskon} onChange={e => setDiskon(e.target.value)} placeholder="0" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="form-label">S&K Penawaran (Catatan)</label>
                                        <textarea 
                                            className="form-input h-32 resize-none italic text-slate-500"
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="bg-[#FAF9F6] border border-[#e5ddd0] rounded-xl p-6 flex flex-col justify-center">
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs text-slate-400 uppercase font-black">
                                            <span>Subtotal</span>
                                            <span>{fmtRp(subtotal)}</span>
                                        </div>
                                        {dpNum > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-blue-600">
                                                <span>Down Payment (DP)</span>
                                                <span>-{fmtRp(dpNum)}</span>
                                            </div>
                                        )}
                                        {diskonNum > 0 && (
                                            <div className="flex justify-between text-xs font-bold text-red-500">
                                                <span>Diskon</span>
                                                <span>-{fmtRp(diskonNum)}</span>
                                            </div>
                                        )}
                                        <div className="pt-4 border-t-2 border-dashed border-[#e5ddd0] flex justify-between items-center">
                                            <span className="text-sm font-black text-[#5C4033] uppercase">Grand Total</span>
                                            <span className="text-2xl font-black text-[#5C4033]">{fmtRp(grandTotal)}</span>
                                        </div>
                                    </div>
                                    <div className="mt-8 flex gap-3">
                                        <button 
                                            onClick={() => setShowPreview(true)}
                                            className="flex-1 btn btn-secondary py-3 text-sm font-bold"
                                        >
                                            <Eye size={18} className="mr-2 inline" /> PRATINJAU DOKUMEN
                                        </button>
                                        <button 
                                            onClick={handleSave}
                                            disabled={!customer || items[0].description === ""}
                                            className={`flex-1 btn py-3 text-sm font-bold ${editingId ? "bg-amber-500 hover:bg-amber-600 border-none text-white" : "btn-primary"}`}
                                        >
                                            <Save size={18} className="mr-2 inline" /> {editingId ? "UPDATE PENAWARAN" : "SIMPAN PENAWARAN"}
                                        </button>
                                        {editingId && (
                                            <button 
                                                onClick={resetForm}
                                                className="btn btn-secondary py-3 text-sm font-bold border-red-200 text-red-500 hover:bg-red-50"
                                            >
                                                BATAL EDIT
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            ) : (
                /* History Tab View */
                <div className="card animate-fade-in">
                    <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>Riwayat Penawaran</span>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input 
                                className="form-input pl-9"
                                style={{ width: 300, fontSize: 12, padding: '4px 12px 4px 36px' }}
                                placeholder="Cari nama atau no. penawaran..."
                                value={searchRiwayat}
                                onChange={e => setSearchRiwayat(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>NO. QUOTE</th>
                                    <th>CUSTOMER</th>
                                    <th>TANGGAL</th>
                                    <th style={{ textAlign: "right" }}>GRAND TOTAL</th>
                                    <th style={{ textAlign: "center" }}>AKSI</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loadingRiwayat ? (
                                    <tr><td colSpan={5} className="text-center py-20 text-slate-400"><Loader2 className="animate-spin inline mr-2" /> Memuat riwayat...</td></tr>
                                ) : filteredRiwayat.map(q => (
                                    <tr key={q.id}>
                                        <td className="font-mono text-[11px] font-bold text-primary">{q.no_quote}</td>
                                        <td className="font-bold text-[#5C4033]">{q.customer.toUpperCase()}</td>
                                        <td>{q.tanggal}</td>
                                        <td style={{ textAlign: "right", fontWeight: 700 }}>{fmtRp(q.grand_total)}</td>
                                        <td style={{ textAlign: "center" }}>
                                            <div className="flex justify-center gap-2">
                                                <button onClick={() => { setCustomer(q.customer); setTanggal(q.tanggal); setItems(q.items); setNotes(q.notes); setDp(String(q.dp)); setDiskon(String(q.diskon)); setNoQuote(q.no_quote); setShowPreview(true); }} className="p-2 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors" title="Print">
                                                    <Printer size={14} className="text-[#5C4033]" />
                                                </button>
                                                <button 
                                                    onClick={() => handleEdit(q)}
                                                    className="p-2 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors"
                                                    title="Edit Penawaran"
                                                >
                                                    <Pencil size={14} className="text-amber-600" />
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteQuote(q.id)}
                                                    className="p-2 bg-red-50 rounded-lg hover:bg-red-500 hover:text-white transition-all group"
                                                    title="Hapus Penawaran"
                                                >
                                                    <Trash2 size={14} className="text-red-500 group-hover:text-white" />
                                                </button>
                                                <button 
                                                    onClick={() => handleConvertToOrder(q)}
                                                    className="p-2 bg-[#5C4033] rounded-lg hover:bg-black transition-colors"
                                                    title="Jadikan Pesanan"
                                                >
                                                    <ArrowRightLeft size={14} className="text-white" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredRiwayat.length === 0 && !loadingRiwayat && (
                                    <tr><td colSpan={5} className="text-center py-20 text-slate-300">Belum ada riwayat penawaran.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* PREVIEW MODAL */}
            {showPreview && (
                <div className="modal-overlay z-[100]" onClick={() => setShowPreview(false)}>
                    <div className="modal-box max-w-4xl max-h-[90vh] overflow-y-auto relative p-0 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <button 
                            onClick={() => setShowPreview(false)}
                            className="absolute top-4 right-4 p-2 bg-white/80 backdrop-blur rounded-lg hover:bg-red-50 hover:text-red-500 transition-all z-20 shadow-sm border border-slate-100"
                        >
                            <X size={20} />
                        </button>
                        
                        <div className="p-10 bg-white min-h-screen">
                            {/* Kop Surat Header (Cetak Style) */}
                            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-10 mb-12">
                                <div>
                                    <h1 className="text-2xl font-black text-slate-900 leading-none mb-2 tracking-tight">CV. TOTO ALUMINIUM MANUFACTURE</h1>
                                    <p className="text-xs font-semibold text-slate-500">Jl. Rawa Mulya, Kota Bekasi | Telp: 0813 1191 2002</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-5xl font-black text-slate-100 italic tracking-tighter select-none">QUOTATION</div>
                                </div>
                            </div>

                            {/* Addresses */}
                            <div className="grid grid-cols-2 gap-16 mb-12">
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-slate-400 border-l-2 border-slate-200 pl-3 uppercase tracking-widest">Pengirim</div>
                                    <div className="pl-3">
                                        <p className="text-sm font-black text-slate-900">{user?.name?.toUpperCase() || "ADMIN"}</p>
                                        <p className="text-[10px] font-bold text-slate-500 mt-1">CV. Toto Aluminium Manufacture</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div className="text-[10px] font-black text-[#7c5c3e] border-l-2 border-[#7c5c3e]/20 pl-3 uppercase tracking-widest">Kepada Yth.</div>
                                    <div className="pl-3">
                                        <p className="text-lg font-black text-slate-900 italic tracking-tight">{customer.toUpperCase() || "..."}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Meta */}
                            <div className="flex items-center gap-10 mb-8 border-y border-slate-50 py-4 px-2">
                                <div className="text-[11px] font-bold"><span className="text-slate-400 uppercase mr-3">No. Quote :</span> {noQuote}</div>
                                <div className="text-[11px] font-bold"><span className="text-slate-400 uppercase mr-3">Tanggal :</span> {tanggal}</div>
                            </div>

                            {/* Items Table */}
                            <table className="w-full text-xs mb-12 border-collapse">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        <th className="py-3 px-4 text-center border border-slate-900">NO</th>
                                        <th className="py-3 px-4 text-left border border-slate-900 uppercase">Deskripsi Item</th>
                                        <th className="py-3 px-4 text-center border border-slate-900">UK</th>
                                        <th className="py-3 px-4 text-center border border-slate-900">QTY</th>
                                        <th className="py-3 px-4 text-right border border-slate-900">HARGA</th>
                                        <th className="py-3 px-4 text-right border border-slate-900">TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((it, idx) => (
                                        <tr key={it.id} className="border-b border-slate-100">
                                            <td className="py-3.5 px-4 text-center text-slate-400">{idx + 1}</td>
                                            <td className="py-3.5 px-4 font-bold text-slate-800">{it.description || "—"}</td>
                                            <td className="py-3.5 px-4 text-center text-slate-500">{it.size || "—"}</td>
                                            <td className="py-3.5 px-4 text-center font-bold text-slate-900">{it.qty || "0"}</td>
                                            <td className="py-3.5 px-4 text-right text-slate-400">{it.price ? fmtRp(parseIdNum(it.price)) : "—"}</td>
                                            <td className="py-3.5 px-4 text-right font-black text-slate-900">{fmtRp(it.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Calculation Row */}
                            <div className="flex justify-end mb-16">
                                <div className="w-72 space-y-2">
                                    <div className="flex justify-between text-xs font-bold text-slate-500 px-2 uppercase">
                                        <span>Subtotal Projek</span>
                                        <span>{fmtRp(subtotal)}</span>
                                    </div>
                                    {dpNum > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-blue-600 px-2 uppercase italic">
                                            <span>Uang Muka (DP)</span>
                                            <span>-{fmtRp(dpNum)}</span>
                                        </div>
                                    )}
                                    {diskonNum > 0 && (
                                        <div className="flex justify-between text-xs font-bold text-red-500 px-2 uppercase italic">
                                            <span>Diskon Khusus</span>
                                            <span>-{fmtRp(diskonNum)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between p-4 bg-slate-900 text-white font-black text-sm rounded shadow-lg mt-4">
                                        <span>TOTAL AKHIR</span>
                                        <span>{fmtRp(grandTotal)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Signatures */}
                            <div className="grid grid-cols-2 gap-20">
                                <div className="space-y-4">
                                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2 mb-2 block">Catatan & Ketentuan :</div>
                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">{notes}</p>
                                </div>
                                <div className="flex flex-col items-center">
                                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-20 italic">Hormat Kami,</div>
                                    <div className="text-center w-full">
                                        <p className="text-sm font-black text-slate-900 underline underline-offset-8">{user?.name?.toUpperCase() || "ADMIN"}</p>
                                        <p className="text-[9px] font-bold text-slate-400 mt-2 uppercase tracking-widest">Toto Alumunium Team</p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-16 pt-8 border-t border-slate-50">
                                <button 
                                    onClick={() => cetakPenawaran()}
                                    className="w-full btn btn-primary py-4 text-sm font-bold shadow-xl shadow-primary/20"
                                >
                                    <Printer className="mr-2 inline" size={18} /> CETAK KE PDF (A4)
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

        </div>
    );
}
