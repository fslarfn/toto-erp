"use client";
import { useLicense } from "@/lib/license-store";
import { useAuth } from "@/lib/auth";
import { AlertTriangle, Lock, CreditCard, LogOut } from "lucide-react";
import Link from "next/link";

export function LicenseGuard({ children }: { children: React.ReactNode }) {
    const { license, loading } = useLicense();
    const { user, logout } = useAuth();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    // Jika lisensi mati (Expired)
    if (license && !license.isActive) {
        return (
            <div className="min-h-screen relative flex items-center justify-center bg-slate-950 overflow-hidden font-sans">
                {/* Background Decor */}
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-500/10 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px]" />
                
                <div className="relative z-10 max-w-lg w-full p-8 mx-4 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl text-center">
                    <div className="w-20 h-20 bg-red-500/20 border border-red-500/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <Lock className="w-10 h-10 text-red-500" />
                    </div>
                    
                    <h1 className="text-3xl font-bold text-white mb-2 leading-tight">
                        Layanan Ditangguhkan
                    </h1>
                    <p className="text-slate-400 mb-8 text-lg">
                        Masa aktif aplikasi CV Toto telah berakhir. Harap lakukan pembayaran untuk mengaktifkan kembali layanan.
                    </p>
                    
                    <div className="space-y-4">
                        {user?.username === "faisal" ? (
                            <Link 
                                href="/dashboard/admin/billing"
                                className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-blue-500/25"
                            >
                                <CreditCard className="w-5 h-5" />
                                Bayar Sekarang
                            </Link>
                        ) : (
                            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl">
                                <p className="text-amber-500 font-medium">
                                    Segera hubungi Bapak Faisal untuk melakukan perpanjangan lisensi.
                                </p>
                            </div>
                        )}
                        
                        <button 
                            onClick={logout}
                            className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-slate-800/50 hover:bg-slate-700/50 text-slate-300 font-medium rounded-2xl transition-all"
                        >
                            <LogOut className="w-4 h-4" />
                            Keluar dari Akun
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Peringatan sebelum mati (IsWarning) */}
            {license?.isWarning && (
                <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white px-4 py-2 text-center text-sm font-bold shadow-lg flex items-center justify-center gap-2 sticky top-0 z-[100] animate-pulse">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Perhatian: Masa aktif aplikasi akan habis dalam {license.daysLeft} hari lagi!</span>
                    {user?.username === "faisal" && (
                        <Link href="/dashboard/admin/billing" className="underline ml-2 hover:text-amber-200">
                            Perpanjang Sekarang
                        </Link>
                    )}
                </div>
            )}
            {children}
        </>
    );
}
