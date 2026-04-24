"use client";
import { use, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase-client";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { FileText, Printer, Loader2 } from "lucide-react";

export default function PublicInvoicePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [invoice, setInvoice] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInvoice = async () => {
            const { data } = await supabase
                .from("billing_history")
                .select("*")
                .eq("order_id", id)
                .single();

            if (data) setInvoice(data);
            setLoading(false);
        };
        fetchInvoice();
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 animate-spin text-gray-400" />
            </div>
        );
    }

    if (!invoice) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-400">
                <FileText size={64} className="mb-4 opacity-20" />
                <h1 className="text-xl font-bold">Invoice Tidak Ditemukan</h1>
                <p className="text-sm italic">Pastikan Link Order ID sudah benar.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 py-10 px-4 flex flex-col items-center print:bg-white print:py-0">
            {/* Control Bar (Hidden in Print) */}
            <div className="max-w-2xl w-full mb-6 flex justify-between items-center print:hidden">
                <div className="flex items-center gap-2 text-gray-500">
                    <FileText size={18} />
                    <span className="text-sm font-bold uppercase tracking-widest italic">Dokumen Resmi RFW Conecting</span>
                </div>
                <button 
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-all shadow-lg"
                >
                    <Printer size={16} /> CETAK INVOICE
                </button>
            </div>

            {/* Invoice Paper */}
            <div className="bg-white max-w-2xl w-full p-12 shadow-2xl rounded-3xl print:shadow-none print:p-0 print:m-0">
                <div className="flex justify-between items-start mb-12">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 mb-1">RFW Conecting</h2>
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.2em] italic">Digital Architecture & ERP Solution</p>
                    </div>
                    <div className="text-right">
                        <h1 className="text-lg font-black text-slate-700 mb-1 uppercase tracking-tighter">Bukti Pembayaran</h1>
                        <p className="text-[10px] text-slate-400">No: {invoice.order_id}</p>
                        <p className="text-[10px] text-slate-400">Tanggal: {format(new Date(invoice.created_at), "dd MMMM yyyy", { locale: localeId })}</p>
                    </div>
                </div>

                {/* Details Section */}
                <div className="grid grid-cols-2 gap-8 mb-12 text-[12px] bg-slate-50 p-6 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                        <div className="flex gap-4">
                            <span className="text-slate-400 font-bold uppercase text-[9px] w-16">Penerima</span>
                            <span className="font-bold text-slate-800 uppercase tracking-tight">CV TOTO ALUMINIUM</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-slate-400 font-bold uppercase text-[9px] w-16">Metode</span>
                            <span className="text-slate-600">Verifikasi Sistem</span>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <div className="flex gap-4">
                            <span className="text-slate-400 font-bold uppercase text-[9px] w-16">Status</span>
                            <span className="font-black text-green-600">LUNAS / PAID</span>
                        </div>
                        <div className="flex gap-4">
                            <span className="text-slate-400 font-bold uppercase text-[9px] w-16">Keterangan</span>
                            <span className="text-slate-500 italic">Langganan Toto ERP</span>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <table className="w-full mb-12">
                    <thead>
                        <tr className="border-b-2 border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                            <th className="py-4 text-left">Deskripsi Layanan</th>
                            <th className="py-4 text-right">Qty</th>
                            <th className="py-4 text-right" style={{ width: "160px" }}>Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="border-b border-slate-50">
                            <td className="py-6">
                                <p className="font-bold text-base text-slate-800">
                                    {invoice.payment_type === 'initial' 
                                        ? "Setup Biaya Server + Lisensi Digital (2 Bulan)" 
                                        : "Perpanjangan Masa Aktif Lisensi ERP (30 Hari)"}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-1 italic">Lisensi valid untuk 7 Akun Pengguna Terdaftar</p>
                            </td>
                            <td className="py-6 text-right font-bold text-slate-700">1</td>
                            <td className="py-6 text-right font-black text-slate-800 text-lg">{formatCurrency(Number(invoice.amount))}</td>
                        </tr>
                    </tbody>
                </table>

                {/* Total Section */}
                <div className="flex justify-end mt-4">
                    <div className="w-72 bg-slate-900 p-6 rounded-3xl shadow-xl space-y-3">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-3">
                            <span>SUBTOTAL</span>
                            <span>{formatCurrency(Number(invoice.amount))}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 border-b border-slate-800 pb-3">
                            <span>PPN (0%)</span>
                            <span>Rp0</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-[10px] font-black uppercase text-white tracking-widest">Total Bayar</span>
                            <span className="text-2xl font-black text-white">{formatCurrency(Number(invoice.amount))}</span>
                        </div>
                    </div>
                </div>

                {/* Footer Signatures */}
                <div className="mt-20 flex justify-between items-end border-t border-slate-100 pt-10">
                    <div>
                        <p className="text-[10px] text-slate-400 uppercase font-black mb-16 tracking-tighter">Penanggung Jawab,</p>
                        <p className="text-base font-black text-slate-800">MUHAMMAD FAISAL ARIFIN</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital Architect - RFW Conecting</p>
                    </div>
                    <div className="text-right italic text-[9px] text-slate-300 max-w-[280px] leading-relaxed">
                        Invoice ini diterbitkan secara sah oleh sistem manajemen Toto ERP. Segala bukti transaksi yang ada di dokumen ini telah divalidasi dan diakui keabsahannya tanpa memerlukan tanda tangan basah.
                    </div>
                </div>
            </div>

            {/* Branding Footer */}
            <div className="mt-12 text-center text-slate-400 text-[10px] font-medium print:hidden">
                <p>&copy; 2026 CV TOTO ALUMINIUM MANUFACTURE. Powered by Toto ERP Environment.</p>
            </div>
        </div>
    );
}
