"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/auth";
import { useLicense } from "@/lib/license-store";
import { supabase } from "@/lib/supabase-client";
import {
    CreditCard, Calendar, Users,
    FileText, CheckCircle2, Loader2,
    X, Zap, History, Printer, Download, QrCode
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";


export default function BillingPage() {
    const { user } = useAuth();
    const { refreshLicense: refreshBanner } = useLicense();
    const [license, setLicense] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [manualReports, setManualReports] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"overview" | "history" | "admin">("overview");
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);

    const [buktiFile, setBuktiFile] = useState<File | null>(null);
    const [buktiPreview, setBuktiPreview] = useState<string>("");
    const [notes, setNotes] = useState("");
    const [showInvoice, setShowInvoice] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [showApproveSuccess, setShowApproveSuccess] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [showQrisModal, setShowQrisModal] = useState(false);
    const [showAbsensiConfirmSuccess, setShowAbsensiConfirmSuccess] = useState(false);

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

    const handleBuktiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        setBuktiFile(file);
        if (file) {
            const reader = new FileReader();
            reader.onload = ev => setBuktiPreview(ev.target?.result as string);
            reader.readAsDataURL(file);
        } else {
            setBuktiPreview("");
        }
    };

    const submitBuktiTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!buktiFile) return alert("Bukti transfer wajib diunggah.");
        setUploading(true);
        try {
            const ext = buktiFile.name.split(".").pop();
            const fileName = `${Date.now()}-${user?.username}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from("bukti-transfer")
                .upload(fileName, buktiFile, { upsert: true });
            if (uploadError) throw new Error("Gagal upload: " + uploadError.message);

            const { data: { publicUrl } } = supabase.storage.from("bukti-transfer").getPublicUrl(fileName);

            const { error } = await supabase.from("billing_manual_confirmations").insert({
                username: user?.username,
                amount: license?.is_setup_completed ? 6200000 : 20800000,
                reference_number: `BUKTI-${Date.now()}`,
                bukti_url: publicUrl,
                notes: notes || null,
                status: "pending",
            });
            if (!error) {
                setShowSuccessModal(true);
                setBuktiFile(null);
                setBuktiPreview("");
                setNotes("");
                fetchData();
                refreshBanner();
            } else {
                alert("Gagal mengirim: " + error.message);
            }
        } catch (err: any) { alert(err.message ?? "Sistem error."); } finally { setUploading(false); }
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
                setShowApproveSuccess(true);
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

            setShowApproveSuccess(true);
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

    const activateAbsensi = async (reportId?: string) => {
        if (!confirm("Konfirmasi pembayaran fitur absensi sudah diterima?\nBanner di menu absensi akan hilang dan invoice akan dibuat.")) return;
        setLoading(true);
        try {
            const [configRes, invoiceRes] = await Promise.all([
                supabase.from("app_config").update({ is_absensi_aktif: true }).eq("id", 1),
                supabase.from("billing_history").insert({
                    order_id: `ABSENSI-${Date.now()}`,
                    amount: 6100000,
                    payment_type: "absensi_activation",
                    status: "settlement",
                    payment_method: "QRIS",
                    created_at: new Date().toISOString(),
                }),
            ]);
            if (configRes.error) throw new Error(configRes.error.message);
            if (invoiceRes.error) throw new Error(invoiceRes.error.message);

            if (reportId) {
                await supabase.from("billing_manual_confirmations")
                    .update({ status: "approved" })
                    .eq("id", reportId);
            }

            setShowAbsensiConfirmSuccess(true);
            refreshLicense();
            fetchData();
            refreshBanner();
        } catch (err: any) { alert("Gagal: " + (err.message ?? "Sistem error.")); } finally { setLoading(false); }
    };

    if (!hasAccess) return <div className="page-content text-center py-20 opacity-50">AKSES DITOLAK</div>;

    return (
        <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: "#f5f3f0", minHeight: "100vh", color: "#2d2a26", paddingBottom: "40px" }} className="page-content px-4 py-6 md:px-8">
            <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@600;700&display=swap" rel="stylesheet" />

            {/* Standard Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, flexWrap: "wrap", gap: 16 }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, fontFamily: "'Playfair Display', serif", color: "#3a2e25" }}>
                        Admin Billing
                    </h1>
                    <p style={{ margin: "4px 0 0", fontSize: 13, color: "#8a7e72" }}>Sistem Manajemen Lisensi & Pembayaran CV TOTO</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isOwner && (
                        <>
                            <button onClick={manualExtend} style={{ background: "#5a8f6e", color: "white", padding: "8px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, boxShadow: "0 2px 5px rgba(0,0,0,0.1)" }}>
                                <CheckCircle2 size={14} /> AKTIVASI (MANUAL)
                            </button>
                            <button onClick={resetInitialState} style={{ background: "#fff", color: "#3a2e25", padding: "8px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid #ebe5dd", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                                <Zap size={14} /> FORCE TRIAL 25 APR
                            </button>
                        </>
                    )}
                    <button onClick={() => { fetchData(); refreshLicense(); }} style={{ background: "#fff", color: "#3a2e25", padding: "8px 16px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "1px solid #ebe5dd", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                        <History size={14} /> SEGARKAN DATA
                    </button>
                </div>
            </div>

            {isOwner && manualReports.length > 0 && (
                <div style={{ marginBottom: 24, padding: "20px 24px", background: "#d63230", borderRadius: 14, boxShadow: "0 10px 25px rgba(214,50,48,0.2)", border: "4px solid white", display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 16, color: "white" }}>
                        <div style={{ width: 48, height: 48, background: "rgba(255,255,255,0.2)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Zap size={24} />
                        </div>
                        <div>
                            <h4 style={{ margin: 0, fontWeight: 900, fontSize: 14, textTransform: "uppercase", letterSpacing: 1 }}>Ada {manualReports.length} Laporan Pembayaran Baru!</h4>
                            <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 600, opacity: 0.9, fontStyle: "italic" }}>Klik tombol di samping untuk mengaktifkan lisensi {license?.is_setup_completed ? '1 Bulan' : '3 Bulan'}.</p>
                        </div>
                    </div>
                    <button onClick={() => approveManual(manualReports[0].id)} style={{ background: "white", color: "#d63230", padding: "12px 24px", borderRadius: 30, fontWeight: 900, textTransform: "uppercase", fontSize: 11, letterSpacing: 1.5, border: "none", cursor: "pointer", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                        AKTIFKAN LISENSI SEKARANG
                    </button>
                </div>
            )}

            {/* Summary Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16, marginBottom: 24 }}>
                {[
                    { icon: "📅", title: "Masa Aktif Aplikasi", value: license?.license_expired_at ? format(new Date(license.license_expired_at), "dd MMM yyyy", { locale: localeId }) : "—", sub: license?.isWarning ? <span style={{ color: "#d63230", fontWeight: 700 }}>⚠️ AKAN HABIS ({license.daysLeft} Hari)</span> : null, accent: "#c69c6d" },
                    { icon: "💳", title: "Tagihan Berikutnya", value: formatCurrency(license?.is_setup_completed ? 6200000 : 20800000), sub: license?.is_setup_completed ? "Biaya Langganan Bulanan" : "Setup Awal + 3 Bulan", accent: "#5a8f6e" },
                    { icon: "👥", title: "Kapasitas Sistem", value: `${license?.max_users || 7} User Aktif`, sub: "Unlimited Data Storage", accent: "#6b7fb5" },
                ].map(card => (
                    <div key={card.title} style={{ background: "#fff", borderRadius: 14, padding: "22px 24px", border: "1px solid #ebe5dd", position: "relative", overflow: "hidden" }}>
                        <div style={{ position: "absolute", top: 0, left: 0, width: 4, height: "100%", background: card.accent, borderRadius: "14px 0 0 14px" }} />
                        <div style={{ fontSize: 22, marginBottom: 10 }}>{card.icon}</div>
                        <div style={{ fontSize: 11.5, color: "#8a7e72", fontWeight: 500, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{card.title}</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: "#2d2a26", fontFamily: "'Playfair Display', serif" }}>{card.value}</div>
                        {card.sub && <div style={{ fontSize: 12, color: "#a09488", marginTop: 4 }}>{card.sub}</div>}
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, marginBottom: 24, borderBottom: "2px solid #ebe5dd", overflowX: "auto" }}>
                {[
                    { id: "overview", label: "Pembayaran" },
                    { id: "history", label: "Riwayat & Invoice" },
                    ...(isOwner && manualReports.length > 0 ? [{ id: "admin", label: `Verifikasi (${manualReports.length})` }] : [])
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} style={{ padding: "12px 24px", background: "none", border: "none", borderBottom: activeTab === tab.id ? "2px solid #3a2e25" : "2px solid transparent", marginBottom: -2, fontWeight: activeTab === tab.id ? 700 : 500, fontSize: 13.5, color: activeTab === tab.id ? (tab.id === "admin" ? "#d63230" : "#3a2e25") : "#a09488", cursor: "pointer", letterSpacing: 0.3, textTransform: "uppercase", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Overview: Pembayaran */}
            {activeTab === "overview" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
                    {/* Left Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                                <span style={{ fontSize: 16 }}>⚡</span>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#3a2e25" }}>Instruksi Perpanjangan Manual</h3>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {[
                                    'Klik tombol "LIHAT QRIS PEMBAYARAN" di sebelah kanan.',
                                    'Scan QRIS menggunakan aplikasi bank / dompet digital Anda.',
                                    'Ambil screenshot / foto notifikasi bukti transfer yang diterima.',
                                    'Upload foto bukti transfer di form sebelah kanan.',
                                    'Klik "KIRIM BUKTI TRANSFER" — Faisal akan verifikasi & konfirmasi.',
                                ].map((step, idx) => (
                                    <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f5f0ea", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#8a7e72", flexShrink: 0, marginTop: 1 }}>{idx+1}</div>
                                        <span style={{ fontSize: 13, lineHeight: 1.55, color: "#4a4440" }} dangerouslySetInnerHTML={{ __html: step.replace(/"(.*?)"/g, '<strong>"$1"</strong>') }}></span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {!license?.is_setup_completed && (
                            <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
                                    <span style={{ fontSize: 16 }}>🧾</span>
                                    <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#3a2e25" }}>Rincian Pemberitahuan Tagihan</h3>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                    {[
                                        { label: "Lisensi Terusan (7 User Aktif)", amount: 18585000 },
                                        { label: "Cloud Server License (Singapore)", amount: 3000000 },
                                        { label: "Installation & Configuration Fee", amount: 4415000 },
                                    ].map(item => (
                                        <div key={item.label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4a4440", padding: "6px 0" }}>
                                            <span>{item.label}</span>
                                            <span style={{ fontWeight: 500, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))}
                                    <div style={{ borderTop: "1px solid #ebe5dd", margin: "4px 0", padding: "8px 0 0", display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600 }}>
                                        <span>Subtotal Biaya</span>
                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatCurrency(26000000)}</span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#5a8f6e", fontWeight: 500, padding: "2px 0" }}>
                                        <span style={{ fontStyle: "italic" }}>Diskon Aktivasi Awal</span>
                                        <span style={{ fontVariantNumeric: "tabular-nums" }}>- {formatCurrency(5200000)}</span>
                                    </div>
                                    <div style={{ borderTop: "2px solid #3a2e25", margin: "6px 0 0", padding: "12px 0 0", display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, color: "#3a2e25" }}>
                                        <span>TOTAL PEMBAYARAN</span>
                                        <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontVariantNumeric: "tabular-nums" }}>{formatCurrency(20800000)}</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd" }}>
                            <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 700, color: "#3a2e25" }}>Portal Pembayaran</h3>
                            <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#8a7e72", lineHeight: 1.5 }}>Scan QRIS di bawah untuk memproses pembayaran tagihan aplikasi Anda.</p>
                            <button onClick={() => setShowQrisModal(true)} style={{ width: "100%", padding: "14px 20px", background: "linear-gradient(135deg, #3a2e25 0%, #4a3d32 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: 0.8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(58,46,37,0.2)" }}>
                                <QrCode size={16} /> LIHAT QRIS PEMBAYARAN
                            </button>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12, fontSize: 11, color: "#a09488" }}>
                                <span>🔒</span><span style={{ fontWeight: 500 }}>PEMBAYARAN AMAN VIA QRIS</span>
                            </div>
                        </div>

                        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                <span style={{ fontSize: 16 }}>📋</span>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#3a2e25" }}>Aktivasi Fitur Absensi</h3>
                                {license?.is_absensi_aktif && (
                                    <span style={{ marginLeft: "auto", background: "#e8f5e9", color: "#2e7d32", fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 20, letterSpacing: 0.5 }}>● AKTIF</span>
                                )}
                            </div>
                            <p style={{ margin: "0 0 18px", fontSize: 12.5, color: "#8a7e72", lineHeight: 1.5 }}>
                                {license?.is_absensi_aktif
                                    ? "Fitur absensi sudah aktif. Banner pemberitahuan telah disembunyikan."
                                    : "Lakukan pembayaran fitur absensi dan server untuk foto absensi via QRIS, lalu upload Bukti untuk mengaktifkan."}
                            </p>
                            {!license?.is_absensi_aktif && (
                                <button onClick={() => setShowQrisModal(true)} style={{ width: "100%", padding: "13px 20px", background: "linear-gradient(135deg, #1D4ED8 0%, #1E3A5F 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 600, fontSize: 13, cursor: "pointer", letterSpacing: 0.8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(29,78,216,0.2)", marginBottom: 12 }}>
                                    <QrCode size={16} /> LIHAT QRIS AKTIVASI ABSENSI
                                </button>
                            )}
                            {isOwner && !license?.is_absensi_aktif && (
                                <button onClick={() => activateAbsensi()} disabled={loading} style={{ width: "100%", padding: "13px 20px", background: loading ? "#a09488" : "linear-gradient(135deg, #5a8f6e 0%, #3d6b50 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: loading ? "not-allowed" : "pointer", letterSpacing: 0.8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(90,143,110,0.25)" }}>
                                    {loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    {loading ? "MEMPROSES..." : "KONFIRMASI PEMBAYARAN ABSENSI"}
                                </button>
                            )}
                        </div>

                        <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd" }}>
                            <h3 style={{ margin: "0 0 6px", fontSize: 15, fontWeight: 700, color: "#3a2e25" }}>Bukti Transfer</h3>
                            <p style={{ margin: "0 0 18px", fontSize: 12, color: "#8a7e72", lineHeight: 1.5 }}>Upload screenshot / foto bukti transfer untuk diverifikasi admin.</p>
                            <form onSubmit={submitBuktiTransfer}>
                                <div style={{ marginBottom: 16 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b5e52", marginBottom: 8, letterSpacing: 0.3 }}>
                                        Foto / Screenshot Bukti Transfer <span style={{ color: "#d63230" }}>*</span>
                                    </label>
                                    <label style={{
                                        display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                                        gap: 8, padding: buktiPreview ? 0 : "24px 16px", borderRadius: 10,
                                        border: `2px dashed ${buktiPreview ? "transparent" : "#ddd6cd"}`,
                                        background: buktiPreview ? "transparent" : "#faf8f5",
                                        cursor: "pointer", overflow: "hidden",
                                    }}>
                                        {buktiPreview ? (
                                            /* eslint-disable-next-line @next/next/no-img-element */
                                            <img src={buktiPreview} alt="Preview" style={{ width: "100%", borderRadius: 8, display: "block", maxHeight: 220, objectFit: "contain" }} />
                                        ) : (
                                            <>
                                                <div style={{ fontSize: 28 }}>📎</div>
                                                <div style={{ fontSize: 12.5, color: "#8a7e72", textAlign: "center" as const }}>
                                                    Klik untuk pilih foto<br />
                                                    <span style={{ fontSize: 11, color: "#a09488" }}>JPG, PNG, WEBP</span>
                                                </div>
                                            </>
                                        )}
                                        <input type="file" accept="image/*" onChange={handleBuktiFileChange} style={{ display: "none" }} required />
                                    </label>
                                    {buktiPreview && (
                                        <button type="button" onClick={() => { setBuktiFile(null); setBuktiPreview(""); }} style={{ marginTop: 6, fontSize: 11, color: "#d63230", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                                            ✕ Hapus foto
                                        </button>
                                    )}
                                </div>
                                <div style={{ marginBottom: 20 }}>
                                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b5e52", marginBottom: 6, letterSpacing: 0.3 }}>Catatan (Pilihan)</label>
                                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Contoh: Transfer BCA tgl 11 Mei, QRIS, dll." style={{ width: "100%", padding: "11px 14px", borderRadius: 8, border: "1.5px solid #ddd6cd", fontSize: 13.5, fontFamily: "'DM Sans', sans-serif", background: "#faf8f5", outline: "none", boxSizing: "border-box" }} />
                                </div>
                                <button type="submit" disabled={uploading || !buktiFile} style={{ width: "100%", padding: "13px 20px", background: (uploading || !buktiFile) ? "#a09488" : "linear-gradient(135deg, #c69c6d 0%, #a67c52 100%)", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: (uploading || !buktiFile) ? "not-allowed" : "pointer", letterSpacing: 0.8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: "0 4px 14px rgba(198,156,109,0.3)" }}>
                                    {uploading ? <Loader2 size={16} className="animate-spin" /> : "📤"} {uploading ? "MENGUNGGAH..." : "KIRIM BUKTI TRANSFER"}
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab Riwayat */}
            {activeTab === "history" && (
                <div style={{ background: "#fff", borderRadius: 14, padding: "24px 28px", border: "1px solid #ebe5dd", overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                        <thead>
                            <tr>
                                <th style={{ padding: "12px 16px", background: "#faf8f5", textAlign: "left", fontSize: 12, color: "#8a7e72", borderBottom: "1px solid #ebe5dd" }}>Tanggal</th>
                                <th style={{ padding: "12px 16px", background: "#faf8f5", textAlign: "left", fontSize: 12, color: "#8a7e72", borderBottom: "1px solid #ebe5dd" }}>Jenis</th>
                                <th style={{ padding: "12px 16px", background: "#faf8f5", textAlign: "left", fontSize: 12, color: "#8a7e72", borderBottom: "1px solid #ebe5dd" }}>Nominal</th>
                                <th style={{ padding: "12px 16px", background: "#faf8f5", textAlign: "center", fontSize: 12, color: "#8a7e72", borderBottom: "1px solid #ebe5dd" }}>Invoice</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.length > 0 ? history.map(item => (
                                <tr key={item.order_id} style={{ borderBottom: "1px solid #f5f3f0" }}>
                                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 500 }}>{format(new Date(item.created_at), 'dd MMM yyyy')}</td>
                                    <td style={{ padding: "14px 16px", fontSize: 11, textTransform: "uppercase", fontWeight: 700, color: item.payment_type === 'absensi_activation' ? "#1D4ED8" : "#8a7e72" }}>
                                        {item.payment_type === 'initial' ? 'Setup + Lisensi' : item.payment_type === 'absensi_activation' ? '📋 Aktivasi Absensi' : 'Langganan Bulanan'}
                                    </td>
                                    <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 700, fontFamily: "'Playfair Display', serif" }}>{formatCurrency(item.amount)}</td>
                                    <td style={{ padding: "14px 16px", textAlign: "center" }}>
                                        <button onClick={() => openInvoice(item)} style={{ background: "#f5f3f0", color: "#3a2e25", border: "none", padding: "6px 12px", borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>LIHAT</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={4} style={{ padding: "40px", textAlign: "center", color: "#a09488" }}>
                                        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                                        <div style={{ fontSize: 14, fontWeight: 500 }}>Belum ada riwayat pembayaran</div>
                                        <div style={{ fontSize: 12.5, marginTop: 6 }}>Riwayat transaksi akan muncul setelah konfirmasi diverifikasi.</div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === "admin" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 860 }}>
                    <h3 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#d63230", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}>
                        <Zap size={14} /> Review Pembayaran Manual
                    </h3>
                    {manualReports.map(report => (
                        <div key={report.id} style={{ background: "#fff", borderRadius: 14, border: "1px solid #ebe5dd", overflow: "hidden" }}>
                            {/* Info row */}
                            <div style={{ padding: "18px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "8px 32px", borderBottom: report.bukti_url ? "1px solid #f5f3f0" : "none" }}>
                                <div><div style={{ fontSize: 10, fontWeight: 700, color: "#a09488", textTransform: "uppercase", marginBottom: 2 }}>User</div><div style={{ fontSize: 14, fontWeight: 700, textTransform: "uppercase", color: "#3a2e25" }}>{report.username}</div></div>
                                <div><div style={{ fontSize: 10, fontWeight: 700, color: "#a09488", textTransform: "uppercase", marginBottom: 2 }}>Nominal</div><div style={{ fontSize: 14, fontWeight: 700, color: "#3a2e25" }}>{formatCurrency(report.amount)}</div></div>
                                <div><div style={{ fontSize: 10, fontWeight: 700, color: "#a09488", textTransform: "uppercase", marginBottom: 2 }}>Tanggal</div><div style={{ fontSize: 13, color: "#3a2e25" }}>{format(new Date(report.created_at), "dd MMM yyyy HH:mm", { locale: localeId })}</div></div>
                                {report.notes && <div style={{ gridColumn: "span 3" }}><div style={{ fontSize: 10, fontWeight: 700, color: "#a09488", textTransform: "uppercase", marginBottom: 2 }}>Catatan</div><div style={{ fontSize: 13, color: "#4a4440" }}>{report.notes}</div></div>}
                            </div>

                            {/* Bukti transfer image */}
                            {report.bukti_url && (
                                <div style={{ padding: "16px 24px", borderBottom: "1px solid #f5f3f0" }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: "#a09488", textTransform: "uppercase", marginBottom: 8 }}>Bukti Transfer</div>
                                    <a href={report.bukti_url} target="_blank" rel="noopener noreferrer" title="Klik untuk zoom">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={report.bukti_url} alt="Bukti Transfer" style={{ maxHeight: 260, maxWidth: "100%", borderRadius: 8, border: "1px solid #ebe5dd", display: "block", cursor: "zoom-in", objectFit: "contain" }} />
                                    </a>
                                    <div style={{ fontSize: 11, color: "#a09488", marginTop: 4 }}>Klik gambar untuk lihat ukuran penuh</div>
                                </div>
                            )}

                            {/* Action buttons */}
                            <div style={{ padding: "14px 24px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                                <button onClick={() => approveManual(report.id)} style={{ background: "#5a8f6e", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: "pointer", boxShadow: "0 4px 10px rgba(90,143,110,0.2)" }}>
                                    ✓ Aktifkan Lisensi Web App
                                </button>
                                {!license?.is_absensi_aktif && (
                                    <button onClick={() => activateAbsensi(report.id)} disabled={loading} style={{ background: loading ? "#a09488" : "linear-gradient(135deg, #1D4ED8, #1E3A5F)", color: "white", border: "none", padding: "10px 20px", borderRadius: 8, fontSize: 11, fontWeight: 700, textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 4px 10px rgba(29,78,216,0.2)" }}>
                                        {loading ? <Loader2 size={14} className="animate-spin" /> : "📋"} Konfirmasi Absensi
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal Invoice Pop-Up - Premium Certificate Design */}
            {showInvoice && selectedInvoice && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }} onClick={() => setShowInvoice(false)}>
                    <div className="bg-[#FDF3E7] w-full max-w-3xl mx-auto p-4 md:p-8 rounded-sm shadow-2xl relative" onClick={e => e.stopPropagation()} style={{ margin: "auto" }}>
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
                                            <span style={{ fontSize: 10, color: "#6b7280" }}>Lisensi Terusan (7 User Aktif)</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 18.585.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, color: "#6b7280" }}>Cloud Server (Singapore)</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 3.000.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, color: "#6b7280" }}>Installation & Config</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 4.415.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mt-2 pt-2 border-t border-gray-100">
                                            <span style={{ fontSize: 10, fontWeight: "bold" }}>Subtotal Biaya</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 26.000.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, fontStyle: "italic", fontWeight: 900, color: "#059669" }}>Diskon Aktivasi</span>
                                            <span style={{ fontSize: 11, fontWeight: 900, color: "#059669" }}>- Rp 5.200.000</span>
                                        </div>
                                    </div>
                                ) : selectedInvoice.payment_type === 'absensi_activation' ? (
                                    <div className="mt-4 pt-4 border-t border-dashed border-gray-200">
                                        <div className="cert-row">
                                            <span className="cert-label">Jenis Layanan</span>
                                            <span className="cert-value uppercase">Aktivasi Fitur Absensi Karyawan</span>
                                        </div>
                                        <p className="cert-label mb-2">Rincian Biaya:</p>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, color: "#6b7280" }}>Biaya Pembuatan Menu Absensi</span>
                                            <span style={{ fontSize: 11, textDecoration: "line-through", color: "#9ca3af" }}>Rp 6.000.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, fontStyle: "italic", color: "#059669" }}>Diskon 40% (Paket 5 Fitur Tambahan)</span>
                                            <span style={{ fontSize: 11, fontWeight: 900, color: "#059669" }}>- Rp 2.400.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mb-1">
                                            <span style={{ fontSize: 10, color: "#6b7280" }}>Biaya Server Tambahan (1 Tahun)</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 2.500.000</span>
                                        </div>
                                        <div className="cert-row !border-none !mt-2 pt-2 border-t border-gray-100">
                                            <span style={{ fontSize: 10, fontWeight: "bold" }}>Setelah Diskon</span>
                                            <span style={{ fontSize: 11, fontWeight: "bold" }}>Rp 3.600.000 + Rp 2.500.000</span>
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
                            <button onClick={() => window.print()} style={{ background: "#5C4033", color: "white", padding: "12px 24px", borderRadius: 8, fontWeight: 700, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                                <Printer size={16} /> CETAK SERTIFIKAT
                            </button>
                            <button onClick={() => setShowInvoice(false)} style={{ background: "#fff", color: "#5C4033", padding: "12px 24px", borderRadius: 8, fontWeight: 700, border: "1px solid #5C4033", cursor: "pointer" }}>
                                TUTUP
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Sukses Validasi */}
            {showSuccessModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowSuccessModal(false)}>
                    <div style={{ background: "#fff", width: "100%", maxWidth: 400, padding: 32, borderRadius: 20, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative" }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 80, height: 80, background: "#e8f5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#4caf50", boxShadow: "inset 0 4px 8px rgba(0,0,0,0.05)" }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#3a2e25", textTransform: "uppercase", letterSpacing: 0.5 }}>Laporan Terkirim</h3>
                        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8a7e72", lineHeight: 1.6 }}>Terima kasih, pembayaran Anda <b style={{ color: "#3a2e25" }}>sedang divalidasi</b> oleh sistem & Tim Admin.</p>
                        
                        <button 
                            onClick={() => setShowSuccessModal(false)}
                            style={{ background: "#5a8f6e", color: "white", width: "100%", padding: "14px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase", fontSize: 12, border: "none", cursor: "pointer", letterSpacing: 0.5, boxShadow: "0 4px 12px rgba(90,143,110,0.3)" }}
                        >
                            Selesai & Tutup
                        </button>
                    </div>
                </div>
            )}
            {/* Modal QRIS Pembayaran */}
            {showQrisModal && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowQrisModal(false)}>
                    <div style={{ background: "#fff", borderRadius: 20, padding: "28px 24px", maxWidth: 380, width: "100%", textAlign: "center", boxShadow: "0 24px 48px rgba(0,0,0,0.25)", position: "relative" }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowQrisModal(false)} style={{ position: "absolute", top: 14, right: 14, background: "#f5f3f0", border: "none", borderRadius: "50%", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#6b5e52" }}>
                            <X size={16} />
                        </button>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#a09488", letterSpacing: "0.1em", marginBottom: 6, textTransform: "uppercase" }}>Scan untuk Membayar</div>
                        <h3 style={{ margin: "0 0 16px", fontSize: 17, fontWeight: 800, color: "#3a2e25" }}>QRIS Pembayaran</h3>
                        <div style={{ borderRadius: 12, overflow: "hidden", border: "2px solid #ebe5dd", marginBottom: 16 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/qris-payment.jpeg" alt="QRIS Pembayaran" style={{ width: "100%", display: "block" }} />
                        </div>
                        <p style={{ margin: "0 0 20px", fontSize: 12, color: "#8a7e72", lineHeight: 1.6 }}>
                            Buka aplikasi bank / dompet digital Anda, pilih <b>Scan QR</b>, lalu arahkan ke kode di atas.
                        </p>
                        <button onClick={() => setShowQrisModal(false)} style={{ width: "100%", padding: "13px", background: "#3a2e25", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 0.5 }}>
                            TUTUP
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Sukses Aktivasi Absensi */}
            {showAbsensiConfirmSuccess && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowAbsensiConfirmSuccess(false)}>
                    <div style={{ background: "#fff", width: "100%", maxWidth: 400, padding: 32, borderRadius: 20, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)" }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 80, height: 80, background: "#e8f5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#4caf50" }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#3a2e25", textTransform: "uppercase", letterSpacing: 0.5 }}>Fitur Absensi Aktif!</h3>
                        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8a7e72", lineHeight: 1.6 }}>Pembayaran dikonfirmasi. Banner pemberitahuan di menu absensi telah dihapus.</p>
                        <button onClick={() => setShowAbsensiConfirmSuccess(false)} style={{ background: "#5a8f6e", color: "white", width: "100%", padding: "14px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase", fontSize: 12, border: "none", cursor: "pointer", letterSpacing: 0.5, boxShadow: "0 4px 12px rgba(90,143,110,0.3)" }}>
                            Oke, Lanjutkan
                        </button>
                    </div>
                </div>
            )}

            {/* Modal Sukses Aktifasi */}
            {showApproveSuccess && (
                <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => setShowApproveSuccess(false)}>
                    <div style={{ background: "#fff", width: "100%", maxWidth: 400, padding: 32, borderRadius: 20, textAlign: "center", boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative" }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: 80, height: 80, background: "#e8f5e9", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", color: "#4caf50", boxShadow: "inset 0 4px 8px rgba(0,0,0,0.05)" }}>
                            <CheckCircle2 size={40} />
                        </div>
                        <h3 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 900, color: "#3a2e25", textTransform: "uppercase", letterSpacing: 0.5 }}>Aktivasi Sukses</h3>
                        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#8a7e72", lineHeight: 1.6 }}>Lisensi aplikasi berhasil diperpanjang. Seluruh sistem kini dapat diakses kembali.</p>
                        
                        <button 
                            onClick={() => setShowApproveSuccess(false)}
                            style={{ background: "#5a8f6e", color: "white", width: "100%", padding: "14px", borderRadius: 12, fontWeight: 700, textTransform: "uppercase", fontSize: 12, border: "none", cursor: "pointer", letterSpacing: 0.5, boxShadow: "0 4px 12px rgba(90,143,110,0.3)" }}
                        >
                            Oke, Lanjutkan
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
