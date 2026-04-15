"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLicense } from "@/lib/license-store";
import { supabase } from "@/lib/supabase-client";
import { 
    CreditCard, Calendar, Users, 
    FileText, CheckCircle2, Loader2, 
    ExternalLink, Zap, History, Printer, Download
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

const LYNKID_URL = "https://billing-erp-toto.com/"; 

export default function BillingPage() {
    const { user } = useAuth();
    const { refreshLicense: refreshBanner } = useLicense();
    const [license, setLicense] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [manualReports, setManualReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "history" | "admin">("overview");
    const [submitting, setSubmitting] = useState(false);
    
    const [refNumber, setRefNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [showInvoice, setShowInvoice] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

    const isOwner = user?.username === "faisal";
    const isAdminFinance = ["vira", "toto", "fauzi", "yuni"].includes(user?.username || "");
    const hasAccess = isOwner || isAdminFinance;

    const refreshLicense = useCallback(async () => {
        const { data, error } = await supabase.from("app_config").select("*").eq("id", 1).single();
        if (data) {
            const expiredAt = new Date(data.license_expired_at);
            const now = new Date();
            const diffDays = Math.ceil((expiredAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            setLicense({ ...data, daysLeft: diffDays, isWarning: diffDays <= 7, isExpired: diffDays <= 0 });
        }
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const { data: historyData } = await supabase.from("billing_history").select("*").order("created_at", { ascending: false });
            setHistory(historyData || []);
            const { data: reports } = await supabase.from("billing_manual_confirmations").select("*").eq("status", "pending").order("created_at", { ascending: false });
            setManualReports(reports || []);
        } catch (err) { console.error(err); } finally { setLoading(false); }
    }, []);

    useEffect(() => {
        refreshLicense();
        fetchData();

        // Auto-polling setiap 20 detik agar Faisal melihat laporan Vira tanpa refresh manual
        const interval = setInterval(() => {
            fetchData();
            refreshLicense();
        }, 20000);

        return () => clearInterval(interval);
    }, [refreshLicense, fetchData]);

    const submitManualReport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!refNumber) return alert("Nomor Referensi wajib diisi.");
        setSubmitting(true);
        try {
            const { error } = await supabase.from("billing_manual_confirmations").insert({
                username: user?.username,
                amount: license?.is_setup_completed ? 6200000 : 20800000,
                reference_number: refNumber, 
                status: "pending"
            });
            if (!error) {
                alert("Laporan terkirim! Menunggu verifikasi Faisal.");
                setRefNumber(""); setNotes(""); 
                fetchData();
                refreshBanner();
            }
        } catch (err) { alert("Sistem error."); } finally { setSubmitting(false); }
    };

    const approveManual = async (reportId: string) => {
        if (!confirm("Aktifkan lisensi sekarang? (Input pembayaran pertama akan menambah 60 hari, selanjutnya akan menambah 30 hari secara otomatis)")) return;
        setLoading(true);
        try {
            const res = await fetch("/api/billing/manual-approve", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ confirmationId: reportId, adminUsername: user?.username || "system" })
            });
            if (res.ok) { 
                alert("Suksess! Lisensi Berhasil Diperpanjang."); 
                refreshLicense(); 
                fetchData(); 
                refreshBanner();
            }
        } catch (err) { alert("Error."); } finally { setLoading(false); }
    };

    const manualExtend = async () => {
        const isInitial = !license?.is_setup_completed;
        const daysToAdd = isInitial ? 90 : 30;
        
        if (!confirm(`Lakukan Aktivasi Manual? \nIni akan menambah masa aktif ${daysToAdd} hari ${isInitial ? '(Setiap Awal)' : '(Bulanan)'} secara instan.`)) return;
        
        setLoading(true);
        try {
            let baseDate = new Date();
            const currentExpiredStr = license?.license_expired_at;
            if (currentExpiredStr) {
                const currentExpired = new Date(currentExpiredStr);
                if (currentExpired > baseDate) baseDate = currentExpired;
            }

            const newExpiredAt = new Date(baseDate);
            newExpiredAt.setDate(newExpiredAt.getDate() + daysToAdd);

            // 1. Update Config
            await supabase.from("app_config").update({ 
                license_expired_at: newExpiredAt.toISOString(), 
                is_setup_completed: true 
            }).eq("id", 1);

            // 2. Insert History
            await supabase.from("billing_history").insert({
                order_id: `ADMIN-MANUAL-${Date.now()}`,
                amount: isInitial ? 20800000 : 6200000,
                payment_type: isInitial ? "initial" : "monthly",
                status: "settlement",
                payment_method: "ADMIN_DIRECT",
                created_at: new Date().toISOString()
            });

            alert(`BERHASIL! Lisensi diperpanjang ${daysToAdd} Hari.`);
            refreshLicense();
            fetchData();
            refreshBanner();
        } catch (err) {
            alert("Gagal memproses perpanjangan.");
        } finally {
            setLoading(false);
        }
    };

    const resetInitialState = async () => {
        if (!confirm("Setel ulang masa trial ke 25 April 2026?")) return;
        setLoading(true);
        try {
            await supabase.from("app_config").update({ 
                license_expired_at: "2026-04-25T23:59:59+07:00", 
                is_setup_completed: false 
            }).eq("id", 1);
            alert("Berhasil Reset Trial!"); 
            refreshLicense();
            refreshBanner();
        } catch (err) { alert("Gagal."); } finally { setLoading(false); }
    };

    const openInvoice = (item: any) => {
        setSelectedInvoice(item);
        setShowInvoice(true);
    };

    if (!hasAccess) return <div className="page-content text-center py-20 opacity-50">AKSES DITOLAK</div>;

    return (
        <div className="page-content">
            {/* Standard Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title-h1">Admin Billing</h1>
                    <p className="page-subtitle">Sistem Manajemen Lisensi & Pembayaran CV TOTO</p>
                </div>
                <div className="flex items-center gap-2">
                    {isOwner && (
                        <>
                            <button onClick={manualExtend} className="btn btn-primary text-[10px] py-1 bg-emerald-700 hover:bg-emerald-900 border-none">
                                <CheckCircle2 size={10} /> AKTIVASI LISENSI (MANUAL)
                            </button>
                            <button onClick={resetInitialState} className="btn btn-secondary text-[10px] py-1">
                                <Zap size={10} /> FORCE TRIAL 25 APR
                            </button>
                        </>
                    )}
                    <button onClick={() => { fetchData(); refreshLicense(); }} className="btn btn-secondary text-[10px] py-1">
                        <History size={10} /> SEGARKAN DATA
                    </button>
                </div>
            </div>

            {isOwner && manualReports.length > 0 && (
                <div className="mb-6 p-5 bg-red-600 rounded-xl shadow-xl animate-fade-in border-4 border-white flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 text-white">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                            <Zap size={24} />
                        </div>
                        <div>
                            <h4 className="font-black text-sm uppercase tracking-widest">Ada {manualReports.length} Laporan Pembayaran Baru!</h4>
                            <p className="text-[10px] font-bold opacity-80 italic">Klik tombol di samping untuk mengaktifkan lisensi {license?.is_setup_completed ? '1 Bulan' : '3 Bulan'}.</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => approveManual(manualReports[0].id)}
                        className="bg-white text-red-600 px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-[0.2em] shadow-lg hover:bg-black hover:text-white transition-all active:scale-95"
                    >
                        AKTIFKAN LISENSI {license?.is_setup_completed ? '1 BULAN' : '3 BULAN'} SEKARANG
                    </button>
                </div>
            )}

            {/* Metric Cards - Using standard .stat-card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="stat-card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500">Masa Aktif Aplikasi</p>
                        <h3 className="text-lg font-bold text-gray-800">
                            {license?.license_expired_at ? format(new Date(license.license_expired_at), "dd MMM yyyy", { locale: localeId }) : "—"}
                        </h3>
                        {license?.isWarning && <span className="text-[10px] text-red-500 font-bold uppercase italic tracking-tighter shadow-sm">⚠️ AKAN HABIS ({license.daysLeft} Hari)</span>}
                    </div>
                </div>

                <div className="stat-card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500">Tagihan Berikutnya</p>
                        <h3 className="text-lg font-bold text-gray-800">{formatCurrency(license?.is_setup_completed ? 6200000 : 20800000)}</h3>
                        <p className="text-[10px] text-gray-400 italic italic">{license?.is_setup_completed ? "Biaya Langganan Bulanan" : "Setup Awal + 3 Bulan"}</p>
                    </div>
                </div>

                <div className="stat-card flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500">Kapasitas Sistem</p>
                        <h3 className="text-lg font-bold text-gray-800">{license?.max_users || 7} User Aktif</h3>
                        <p className="text-[10px] text-gray-400 italic">Unlimited Data Storage</p>
                    </div>
                </div>
            </div>

            {/* Main Content Card - Using standard .card */}
            <div className="card">
                <div className="flex border-b border-gray-100">
                    <button onClick={() => setActiveTab("overview")} className={`px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-gray-400'}`}>
                        Pembayaran
                    </button>
                    <button onClick={() => setActiveTab("history")} className={`px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-gray-400'}`}>
                        Riwayat & Invoice
                    </button>
                    {isOwner && manualReports.length > 0 && (
                        <button onClick={() => setActiveTab("admin")} className={`px-6 py-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'admin' ? 'border-red-500 text-red-600' : 'border-transparent text-red-300'}`}>
                            Verifikasi ({manualReports.length})
                        </button>
                    )}
                </div>

                <div className="card-body">
                    {activeTab === "overview" && (
                        <div className="max-w-4xl">
                            <div className="mb-8 p-6 bg-amber-50 rounded-xl border border-amber-100 border-dashed">
                                <h4 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
                                    <Zap size={16} /> Instruksi Perpanjangan Manual
                                </h4>
                                <ol className="text-xs text-amber-800 space-y-2 list-decimal list-inside leading-loose">
                                    <li>Klik tombol <strong>"BUKA LINK PEMBAYARAN"</strong> di bawah.</li>
                                    <li>Selesaikan pembayaran melalui QRIS/Transfer di link tersebut.</li>
                                    <li>Simpan <strong>Nomor Referensi</strong> (ID Transaksi) dari lynk.id.</li>
                                    <li>Masukkan Nomor Referensi tadi ke form konfirmasi di bawah ini.</li>
                                    <li>Klik tombol cokelat <strong>"KIRIM KONFIRMASI"</strong>.</li>
                                </ol>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="text-base font-bold text-gray-800 mb-2">Portal Pembayaran</h3>
                                        <p className="text-xs text-gray-500 leading-relaxed mb-4">Gunakan link eksternal di bawah ini (lynk.id) untuk memproses tagihan aplikasi Anda.</p>
                                        <a href={LYNKID_URL} target="_blank" className="btn btn-primary w-full py-4 flex items-center justify-center gap-2">
                                            BUKA LINK PEMBAYARAN <ExternalLink size={16} />
                                        </a>
                                    </div>
                                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center gap-3 text-[10px] text-gray-400 uppercase font-black italic tracking-widest">
                                        <Zap size={14} /> SECURED SESSION BY SSL
                                    </div>
                                </div>

                                <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm shadow-sm space-y-4">
                                    <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-50 pb-2">Form Konfirmasi</h4>
                                    <form onSubmit={submitManualReport} className="space-y-4">
                                        <div>
                                            <label className="form-label">ID Transaksi / Nomor Referensi</label>
                                            <input type="text" value={refNumber} onChange={e => setRefNumber(e.target.value)} placeholder="ABC-12345-XYZ" className="form-input" />
                                        </div>
                                        <div>
                                            <label className="form-label">Catatan (Pilihan)</label>
                                            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: QRIS MANDIRI" className="form-input" />
                                        </div>
                                        <button disabled={submitting} type="submit" className="btn btn-primary w-full py-3 flex items-center justify-center gap-2 shadow-lg">
                                            {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                            KIRIM KONFIRMASI
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "history" && (
                        <div className="table-container">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Jenis</th>
                                        <th>Nominal</th>
                                        <th style={{ textAlign: "center" }}>Invoice</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map(item => (
                                        <tr key={item.order_id}>
                                            <td className="font-medium">{format(new Date(item.created_at), 'dd MMM yyyy')}</td>
                                            <td className="uppercase text-[10px] font-bold text-gray-500">{item.payment_type === 'initial' ? 'Setup + Lisensi' : 'Langganan Bulanan'}</td>
                                            <td className="font-bold">{formatCurrency(item.amount)}</td>
                                            <td style={{ textAlign: "center" }}>
                                                <button onClick={() => openInvoice(item)} className="btn btn-secondary py-1 text-[10px] uppercase font-black">LIHAT</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {history.length === 0 && <tr><td colSpan={4} className="text-center py-10 opacity-30 italic italic">Belum ada riwayat pembayaran</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {activeTab === "admin" && (
                        <div className="space-y-4 max-w-4xl">
                            <h3 className="text-sm font-bold uppercase text-red-600 mb-4 flex items-center gap-2">
                                <Zap size={14} /> Review Pembayaran Manual
                            </h3>
                            {manualReports.map(report => (
                                <div key={report.id} className="p-6 border border-gray-100 rounded-xl bg-gray-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                        <div><p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">User</p><p className="font-bold text-sm uppercase">{report.username}</p></div>
                                        <div><p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Nominal</p><p className="font-bold text-sm">{formatCurrency(report.amount)}</p></div>
                                        <div className="col-span-2"><p className="text-[10px] font-bold text-gray-400 mb-1 uppercase">Kode Ref</p><p className="font-bold text-base tracking-tight select-all text-blue-600">{report.reference_number}</p></div>
                                    </div>
                                    <button onClick={() => approveManual(report.id)} className="btn btn-success py-3 px-6 shadow-md uppercase font-black text-[10px]">Aktifkan Lisensi</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Invoice Pop-Up - Premium Certificate Design */}
            {showInvoice && selectedInvoice && (
                <div className="modal-overlay overflow-y-auto py-10" onClick={() => setShowInvoice(false)}>
                    <div className="bg-[#FDF3E7] w-full max-w-3xl mx-auto p-4 md:p-8 rounded-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
                        {/* Styles for Certificate */}
                        <style jsx>{`
                            .cert-container {
                                background: #FFFFFF;
                                padding: 40px;
                                position: relative;
                                border-radius: 4px;
                                border: 15px solid #FFFFFF;
                                outline: 1px solid #B89678;
                                overflow: hidden;
                                color: #5C4033;
                                font-family: 'Outfit', sans-serif;
                            }
                            .cert-container::before {
                                content: "";
                                position: absolute;
                                top: 15px;
                                left: 15px;
                                right: 15px;
                                bottom: 15px;
                                border: 2px solid #B89678;
                                pointer-events: none;
                                opacity: 0.3;
                            }
                            .watermark {
                                position: absolute;
                                top: 50%;
                                left: 50%;
                                transform: translate(-50%, -50%) rotate(-30deg);
                                font-size: 100px;
                                font-weight: 900;
                                color: #B89678;
                                opacity: 0.05;
                                white-space: nowrap;
                                pointer-events: none;
                                text-transform: uppercase;
                                z-index: 0;
                            }
                            .cert-header { text-align: center; margin-bottom: 40px; position: relative; z-index: 1; }
                            .cert-header h1 { font-family: sans-serif; font-size: 32px; font-weight: 900; margin: 0; color: #5C4033; text-transform: uppercase; letter-spacing: -0.02em; }
                            .cert-header p { font-size: 10px; font-weight: 700; letter-spacing: 0.4em; text-transform: uppercase; color: #B89678; margin-top: 5px; }
                            
                            .cert-badge {
                                width: 80px; height: 80px; background: #D4AF37; margin: 20px auto; border-radius: 50%;
                                display: flex; align-items: center; justify-content: center; color: white;
                                box-shadow: 0 10px 20px rgba(212, 175, 55, 0.3); border: 4px double white; position: relative; z-index: 1;
                            }
                            
                            .cert-title { text-align: center; margin-bottom: 30px; position: relative; z-index: 1; }
                            .cert-title h2 { font-size: 22px; font-style: italic; margin-bottom: 5px; font-family: serif; }
                            .cert-title .line { width: 50px; height: 2px; background: #D4AF37; margin: 15px auto; }
                            
                            .cert-details { background: #FAFAFA; padding: 25px; border-radius: 12px; border: 1px solid #EEE; margin-bottom: 30px; position: relative; z-index: 1; }
                            .cert-row { display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 1px solid #F0F0F0; padding-bottom: 8px; }
                            .cert-label { font-size: 9px; font-weight: 700; color: #B89678; text-transform: uppercase; letter-spacing: 0.1em; }
                            .cert-value { font-size: 12px; font-weight: 700; color: #5C4033; }
                            
                            .cert-footer { margin-top: 40px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; border-top: 1px solid #EEE; padding-top: 25px; position: relative; z-index: 1; }
                            .signature-line { width: 150px; height: 1px; background: #5C4033; margin-bottom: 8px; margin-top: 40px; }
                            
                            @media print {
                                .modal-overlay { background: white !important; padding: 0 !important; }
                                .cert-container { border: none !important; box-shadow: none !important; }
                                .no-print { display: none !important; }
                            }
                        `}</style>

                        <div className="cert-container">
                            <div className="watermark">T O T O</div>

                            <div className="cert-header">
                                <h1>RFW Conecting</h1>
                                <p>Digital Architecture & Solution</p>
                            </div>

                            <div className="cert-badge">
                                <Zap size={40} fill="white" />
                            </div>

                            <div className="cert-title">
                                <h2>Payment Successful Notice</h2>
                                <p className="text-[10px] text-gray-400 mt-1">Dokumen ini merupakan pengakuan resmi atas transaksi lisensi aktif.</p>
                                <div className="line"></div>
                            </div>

                            <div className="cert-details">
                                <div className="cert-row">
                                    <span className="cert-label">Status Pembayaran</span>
                                    <span className="cert-value text-emerald-600">DITERIMA & TERVALIDASI</span>
                                </div>
                                <div className="cert-row">
                                    <span className="cert-label">Waktu Pembayaran</span>
                                    <span className="cert-value">{format(new Date(selectedInvoice.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}</span>
                                </div>
                                <div className="cert-row">
                                    <span className="cert-label">ID Transaksi</span>
                                    <span className="cert-value uppercase">{selectedInvoice.order_id}</span>
                                </div>
                                
                                {selectedInvoice.payment_type === 'initial' ? (
                                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                        <p className="cert-label mb-2">Rincian Paket Aktivasi:</p>
                                        <div className="cert-row !border-none !mb-1">
                                            <span className="text-[10px] text-gray-500">Lisensi Terusan (7 User Aktif)</span>
                                            <span className="text-[11px] font-bold">Rp 18.585.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span className="text-[10px] text-gray-500">Cloud Server License (Singapore)</span>
                                            <span className="text-[11px] font-bold">Rp 3.000.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span className="text-[10px] text-gray-500">Installation & Configuration Fee</span>
                                            <span className="text-[11px] font-bold">Rp 4.415.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mt-2 pt-2 border-t border-gray-100">
                                            <span className="text-[10px] font-bold">Subtotal Biaya</span>
                                            <span className="text-[11px] font-bold">Rp 26.000.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span className="text-[10px] font-black italic text-emerald-600">Diskon Aktivasi Awal</span>
                                            <span className="text-[11px] font-black text-emerald-600">- Rp 5.200.000</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="cert-row">
                                        <span className="cert-label">Jenis Lisensi</span>
                                        <span className="cert-value uppercase">TOTO ERP - LANGGANAN BULANAN (30 HARI)</span>
                                    </div>
                                )}

                                <div className="cert-row !border-none pt-4 mt-2 border-t-2 border-primary">
                                    <span className="cert-label !text-gray-900 !text-xs">Total Pembayaran</span>
                                    <span className="cert-value !text-lg !font-black">{formatCurrency(selectedInvoice.amount)}</span>
                                </div>
                            </div>

                            <div className="cert-footer">
                                <div className="signature">
                                    <div className="signature-line"></div>
                                    <p className="font-bold uppercase mb-0">SIGIT PUJO HARIYANTO</p>
                                    <p className="opacity-60">Managing Director - RFW Conecting</p>
                                </div>
                                <div className="text-right opacity-40 uppercase font-bold tracking-tighter">
                                    &copy; 2026 RFW Conecting<br />
                                    Official Licensing Department
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-center gap-4 no-print">
                            <button onClick={() => window.print()} className="btn btn-primary px-8 bg-[#5C4033] hover:bg-[#B89678] border-none flex items-center gap-2">
                                <Printer size={16} /> CETAK SERTIFIKAT
                            </button>
                            <button onClick={() => setShowInvoice(false)} className="btn btn-secondary px-8">
                                TUTUP
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
