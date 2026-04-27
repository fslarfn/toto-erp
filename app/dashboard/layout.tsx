"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, roleLabels, getRoleDisplay } from "@/lib/auth";
import { useLicense } from "@/lib/license-store";
import { PesananProvider } from "@/lib/pesanan-store";
import { SuratJalanProvider } from "@/lib/surat-jalan-store";
import { SJBahanProvider } from "@/lib/sj-bahan-store";
import { TagihanBahanProvider } from "@/lib/tagihan-bahan-store";
import { QuotationProvider } from "@/lib/quotation-store";
import ChatOrderBox from "@/components/layout/ChatOrderBox";
import NotificationSettings from "@/components/notifications/NotificationSettings";
import { useNotificationHistory } from "@/hooks/useNotificationHistory";

const NAV_ITEMS = [
    {
        section: "Menu Utama",
        items: [
            { href: "/dashboard", label: "Dashboard", module: "dashboard", icon: HomeIcon },
            { href: "/dashboard/pesanan", label: "Input Pesanan", module: "pesanan", icon: ClipboardIcon },
            { href: "/dashboard/status-barang", label: "Status Barang", module: "status-barang", icon: PackageIcon },
            { href: "/dashboard/cockpit", label: "Executive Cockpit", module: "any", icon: CockpitIcon },
        ],
    },
    {
        section: "Keuangan",
        items: [
            { href: "/dashboard/penawaran", label: "Penawaran", module: "keuangan", icon: PenawaranIcon },
            { href: "/dashboard/keuangan", label: "Keuangan", module: "keuangan", icon: WalletIcon },
            { href: "/dashboard/invoice", label: "Invoice", module: "keuangan", icon: InvoiceIcon },
            { href: "/dashboard/tagihan", label: "Tagihan", module: "keuangan", icon: TagihanIcon },
            { href: "/dashboard/tagihan-bahan", label: "Tagihan Bahan Baku", module: "keuangan", icon: BoxIcon },
            { href: "/dashboard/laporan", label: "Laporan", module: "keuangan", icon: BarChartIcon },
        ],
    },
    {
        section: "Gudang & Produksi",
        items: [
            { href: "/dashboard/stok-bahan", label: "Stok Bahan", module: "stok-bahan", icon: BoxIcon },
            { href: "/dashboard/sj-bahan", label: "SJ Bahan Baku", module: "stok-bahan", icon: ColorPaletteIcon },
            { href: "/dashboard/produksi", label: "Alur Pesanan", module: "produksi", icon: FactoryIcon },
            { href: "/dashboard/print-po", label: "Print PO", module: "produksi", icon: PrinterIcon },
            { href: "/dashboard/surat-jalan", label: "Surat Jalan", module: "produksi", icon: TruckIcon },
        ],
    },
    {
        section: "SDM",
        items: [
            { href: "/dashboard/karyawan", label: "Karyawan", module: "keuangan", icon: KaryawanIcon },
        ],
    },
    {
        section: "Administrasi",
        items: [
            { href: "/dashboard/admin/billing", label: "Admin Billing", module: "admin-only", icon: BillingIcon },
            { href: "/dashboard/akun", label: "Akun Saya", module: "any", icon: UserCircleIcon },
        ],
    },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, hasAccess } = useAuth();
    const { license } = useLicense();
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [showTrialModal, setShowTrialModal] = useState(false);
    const { unreadCount } = useNotificationHistory();

    const isAdmin = ["faisal", "vira", "toto", "fauzi", "yuni"].includes(user?.username || "");
    const isFinishing = user?.role === "finishing";

    useEffect(() => {
        if (!user) router.replace("/login");
        else if (isFinishing && pathname !== "/dashboard/produksi") {
            router.replace("/dashboard/produksi");
        } else if (!isFinishing && license && !license.is_setup_completed) {
            setShowTrialModal(true);
        }
    }, [user, router, license, isFinishing, pathname]);

    if (!user) return null;
    // Tahan render sampai redirect selesai agar tidak crash di provider
    if (isFinishing && pathname !== "/dashboard/produksi") return null;

    /* ── Layout khusus Operator Finishing: tanpa sidebar, tanpa header lengkap ── */
    if (isFinishing) {
        const handleLogout = () => { logout(); router.replace("/login"); };
        return (
            <PesananProvider>
                <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F8F4EF" }}>
                    {/* Mini header */}
                    <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "10px 20px", background: "white",
                        borderBottom: "1px solid #E8DDD0", flexShrink: 0,
                    }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{
                                width: 32, height: 32, borderRadius: 8,
                                background: "#6B4423", display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                                </svg>
                            </div>
                            <div>
                                <div style={{ fontSize: 13, fontWeight: 800, color: "#3C2F2F" }}>Finishing</div>
                                <div style={{ fontSize: 11, color: "#B89678" }}>{user.name} · Operator Finishing</div>
                            </div>
                        </div>
                        <button onClick={handleLogout} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "6px 14px", borderRadius: 8,
                            border: "1.5px solid #E8DDD0", background: "white",
                            fontSize: 12, color: "#8A7B6E", fontWeight: 600, cursor: "pointer",
                        }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                <polyline points="16 17 21 12 16 7" />
                                <line x1="21" y1="12" x2="9" y2="12" />
                            </svg>
                            Logout
                        </button>
                    </div>
                    <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        {children}
                    </main>
                </div>
            </PesananProvider>
        );
    }

    const handleLogout = () => {
        logout();
        router.replace("/login");
    };

    const containerClass = [
        "flex h-screen",
        collapsed ? "sidebar-collapsed" : "",
        mobileOpen ? "sidebar-open" : "",
    ].filter(Boolean).join(" ");

    const isCockpit = pathname === "/dashboard/cockpit";

    return (
        <PesananProvider>
            <SuratJalanProvider>
                <SJBahanProvider>
                    <TagihanBahanProvider>
                        <QuotationProvider>
                <div id="app-container" className={containerClass} style={{ background: isCockpit ? "#F5EBDD" : "var(--bg)" }}>
                    {/* Mobile Backdrop */}
                    <div id="sidebar-backdrop" onClick={() => setMobileOpen(false)} />

                    {/* ============ SIDEBAR ============ */}
                    <div id="sidebar">
                        <div className="brand">
                            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)" }}>
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                            <span className="brand-text" style={{ fontSize: "0.95rem" }}>ERP TOTO</span>
                        </div>

                        <div className="sidebar-content">
                            {NAV_ITEMS.map((group) => {
                                const allowedUsers = ["faisal", "vira", "toto", "fauzi", "yuni"];
                                const visibleItems = group.items.filter((item) => {
                                    if (item.href === "/dashboard/cockpit") return user?.role === 'owner' || user?.username === 'faisal';
                                    if (item.module === "admin-only") return allowedUsers.includes(user?.username || "");
                                    if (item.module === "any") return true;
                                    return hasAccess(item.module);
                                });
                                if (visibleItems.length === 0) return null;
                                return (
                                    <div key={group.section}>
                                        <div className="section-label">{group.section}</div>
                                        {visibleItems.map((item) => {
                                            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                                            const Icon = item.icon;
                                            return (
                                                <Link key={item.href} href={item.href} className={`sidebar-link ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
                                                    <Icon size={18} />
                                                    <span className="sidebar-text">{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="sidebar-footer">
                            {!collapsed && (
                                <div className="text-xs mb-2 px-1 truncate flex items-center gap-2" style={{ color: "#B89678" }}>
                                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 bg-slate-200">
                                        {user?.avatar ? <img src={user.avatar} alt="P" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-primary text-white text-[10px]">{user?.name?.[0].toUpperCase()}</div>}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-semibold truncate" style={{ color: "var(--text-dark)" }}>{user.name}</div>
                                        <div className="opacity-80 truncate">{getRoleDisplay(user)}</div>
                                    </div>
                                </div>
                            )}
                            <button onClick={handleLogout} title="Logout">
                                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                                <span className="sidebar-text">Logout</span>
                            </button>
                        </div>
                    </div>

                    {/* ============ MAIN CONTENT ============ */}
                    <div id="main-content-wrapper">
                        {/* Header */}
                        {/* Header */}
                        {!isCockpit && (
                            <header>
                                <div className="header-content">
                                    <div className="flex items-center gap-3">
                                        <button
                                            className="sidebar-toggle"
                                            onClick={() => {
                                                if (window.innerWidth < 1025) {
                                                    setMobileOpen(!mobileOpen);
                                                } else {
                                                    setCollapsed(!collapsed);
                                                }
                                            }}
                                            title="Toggle Sidebar"
                                        >
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="3" y1="6" x2="21" y2="6" />
                                                <line x1="3" y1="12" x2="21" y2="12" />
                                                <line x1="3" y1="18" x2="21" y2="18" />
                                            </svg>
                                        </button>
                                        <span className="page-title">
                                            {NAV_ITEMS.flatMap((g) => g.items).find(
                                                (it) => pathname === it.href || (it.href !== "/dashboard" && pathname.startsWith(it.href))
                                            )?.label ?? "Dashboard"}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        {/* Notification Bell */}
                                        <button
                                            onClick={() => setNotifOpen(true)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-primary relative"
                                            title="Notifikasi"
                                        >
                                            <BellIcon size={20} />
                                            {unreadCount > 0 && (
                                                <span style={{
                                                    position: "absolute", top: 4, right: 4,
                                                    background: "#EF4444", color: "white",
                                                    borderRadius: 99, fontSize: 9, fontWeight: 700,
                                                    minWidth: 16, height: 16, lineHeight: "16px",
                                                    textAlign: "center", padding: "0 3px",
                                                    border: "1.5px solid white",
                                                }}>
                                                    {unreadCount > 99 ? "99+" : unreadCount}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            onClick={() => setChatOpen(!chatOpen)}
                                            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-primary relative"
                                            title="Koordinasi Tim"
                                        >
                                            <MessageSquareIcon size={20} />
                                            {/* Badge notifikasi sederhana di header */}
                                            <div className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border border-white" />
                                        </button>

                                        <div className="text-right hidden sm:block">
                                            <div className="text-sm font-semibold">{user.name}</div>
                                            <div className="text-xs opacity-80">{getRoleDisplay(user)}</div>
                                        </div>
                                        <div
                                            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center font-bold text-sm bg-slate-200 border-2 border-white/20"
                                        >
                                            {user?.avatar ? (
                                                <img src={user.avatar} alt="P" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-primary text-white">
                                                    {user.name[0].toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </header>
                        )}

                        {/* Page content */}
                        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowX: "hidden", background: isCockpit ? "#F5EBDD" : "var(--bg)" }}>
                            {/* Trial Banner */}
                            {license && !license.is_setup_completed && !isCockpit && (
                                <div style={{ background: "linear-gradient(90deg, #FFFBEB 0%, #FEF3C7 100%)", borderBottom: "1px solid #FDE68A", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", fontSize: "13px", color: "#92400E", fontWeight: 500 }}>
                                    <span style={{ fontSize: "16px" }}>✨</span><span>Aplikasi dalam masa <strong>Free Trial</strong> sampai <strong>25 April 2026</strong>. Silakan lakukan aktivasi untuk akses penuh.</span>
                                    <Link href="/dashboard/admin/billing" style={{ marginLeft: "10px", padding: "4px 12px", background: "#B45309", color: "white", borderRadius: "6px", textDecoration: "none", fontSize: "11px", fontWeight: 700 }}>AKTIVASI</Link>
                                </div>
                            )}
                            {children}
                        </main>
                    </div>

                    {showTrialModal && license && !license.is_setup_completed && (
                        <div className="modal-overlay z-[9999]" style={{ position:'fixed', top:0, left:0, right:0, bottom:0, display:'flex', alignItems:'center', justifyContent:'center', padding:'2rem', backgroundColor:'rgba(0,0,0,0.6)', backdropFilter:'blur(4px)', fontFamily:'system-ui,-apple-system,sans-serif' }}>
                            <div style={{ display:'flex', flexDirection:'row', borderRadius:'16px', overflow:'hidden', width:'680px', maxWidth:'100%', boxShadow:'0 8px 32px rgba(0,0,0,0.18)', backgroundColor:'#FFFFFF' }}>
                                <div style={{ width:'42%', backgroundColor:'#3B1F0F', padding:'32px', color:'white', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight:'320px', boxSizing:'border-box' }}>
                                    <div><div style={{ fontSize:'10px', fontWeight:600, letterSpacing:'0.12em', background:'rgba(255,255,255,0.15)', borderRadius:'4px', padding:'4px 10px', display:'inline-block', marginBottom:'20px' }}>MASA TRIAL</div><div style={{ fontSize:'26px', fontWeight:700, lineHeight:1.25, margin:0, padding:0, marginBottom:'6px' }}>Sistem ERP<br/>Toto Official</div><div style={{ fontSize:'10px', fontWeight:500, letterSpacing:'0.1em', color:'rgba(255,255,255,0.5)', marginBottom:'32px' }}>ENTERPRISE EDITION V2.4</div><div style={{ borderTop:'1px solid rgba(255,255,255,0.15)', paddingTop:'20px' }}><div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', letterSpacing:'0.08em', marginBottom:'4px' }}>BERAKHIR PADA</div><div style={{ fontSize:'28px', fontWeight:700, letterSpacing:'-0.5px', margin:0, padding:0 }}>25 April 2026</div></div></div>
                                    <div style={{ background:'#D97B2A', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', fontWeight:600, marginTop:'20px', display:'inline-flex', alignItems:'center', gap:'6px', width:'fit-content' }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><span>{(() => { const targetDate = new Date(2026, 3, 25); targetDate.setHours(0, 0, 0, 0); const today = new Date(); today.setHours(0, 0, 0, 0); const diffTime = targetDate.getTime() - today.getTime(); const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)); if (diffDays > 0) return `${diffDays} Hari Tersisa`; if (diffDays === 0) return 'Berakhir Hari Ini'; return 'Masa Trial Berakhir'; })()}</span></div>
                                </div>
                                <div style={{ width:'58%', background:'#FFFFFF', padding:'28px 28px 24px 28px', display:'flex', flexDirection:'column', justifyContent:'space-between', boxSizing:'border-box' }}>
                                    <div><div style={{ fontSize:'18px', fontWeight:700, color:'#1A1A1A', marginBottom:'6px', lineHeight:1.3 }}>Buka Potensi Penuh Bisnis Anda</div><div style={{ fontSize:'12.5px', color:'#666', lineHeight:1.6, marginBottom:'18px' }}>Jangan biarkan operasional Anda terhenti. Tingkatkan ke <strong style={{ color:'#3B1F0F' }}>Enterprise</strong> untuk terus menikmati kemudahan pengelolaan sistem.</div><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}><div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}><div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F5EFE8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div><div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>Akses Tak Terbatas</div><div style={{ fontSize:'11.5px', color:'#888', lineHeight:1.4 }}>Kolaborasi seluruh tim tanpa batas.</div></div></div><div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}><div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F5EFE8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg></div><div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>Backup Cloud</div><div style={{ fontSize:'11.5px', color:'#888', lineHeight:1.4 }}>Data aman otomatis.</div></div></div><div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}><div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F5EFE8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg></div><div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>Prioritas Support</div><div style={{ fontSize:'11.5px', color:'#888', lineHeight:1.4 }}>Bantuan teknis 24/7.</div></div></div><div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}><div style={{ width:'34px', height:'34px', borderRadius:'50%', background:'#F5EFE8', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8B5E3C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></div><div><div style={{ fontSize:'12.5px', fontWeight:600, color:'#1A1A1A', lineHeight:1.4 }}>Audit Log & Security</div><div style={{ fontSize:'11.5px', color:'#888', lineHeight:1.4 }}>Keamanan tingkat tinggi.</div></div></div></div></div>
                                    <div style={{ marginTop:'22px', display:'flex', gap:'12px', alignItems:'center' }}>{isAdmin ? (<><button onClick={() => { setShowTrialModal(false); router.push("/dashboard/admin/billing"); }} style={{ background:'#3B1F0F', color:'white', borderRadius:'8px', padding:'10px 22px', fontSize:'12.5px', fontWeight:600, letterSpacing:'0.05em', border:'none', cursor:'pointer', fontFamily:'inherit' }}>AKTIVASI SEKARANG</button><button onClick={() => setShowTrialModal(false)} style={{ background:'transparent', color:'#888', fontSize:'12.5px', border:'none', cursor:'pointer', padding:'10px 8px', fontFamily:'inherit' }}>TUTUP (SAYA PAHAM)</button></>) : (<button onClick={() => setShowTrialModal(false)} style={{ background:'#3B1F0F', color:'white', borderRadius:'8px', padding:'10px 22px', fontSize:'12.5px', fontWeight:600, letterSpacing:'0.05em', border:'none', cursor:'pointer', fontFamily:'inherit', width:'100%' }}>SAYA MENGERTI</button>)}</div>
                                </div>
                            </div>
                        </div>
                    )}
                    <ChatOrderBox isOpen={chatOpen} onClose={() => setChatOpen(false)} />
                    <NotificationSettings isOpen={notifOpen} onClose={() => setNotifOpen(false)} />
                </div>
                        </QuotationProvider>
                    </TagihanBahanProvider>
                </SJBahanProvider>
            </SuratJalanProvider>
        </PesananProvider>
    );
}

function HomeIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> ); }
function ClipboardIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg> ); }
function PackageIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="16.5" y1="9.4" x2="7.5" y2="4.21" /><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /><polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" /></svg> ); }
function WalletIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4" /><path d="M4 6v12c0 1.1.9 2 2 2h14v-4" /><path d="M18 12a2 2 0 000 4h4v-4z" /></svg> ); }
function BoxIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" /></svg> ); }
function FactoryIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20a2 2 0 002 2h16a2 2 0 002-2V8l-7 5V8l-7 5V4a2 2 0 00-2-2H4a2 2 0 00-2 2z" /></svg> ); }
function PrinterIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg> ); }
function InvoiceIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg> ); }
function TruckIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg> ); }
function TagihanIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg> ); }
function KaryawanIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg> ); }
function ClockIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg> ); }
function ColorPaletteIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor" /><circle cx="17.5" cy="10.5" r=".5" fill="currentColor" /><circle cx="8.5" cy="7.5" r=".5" fill="currentColor" /><circle cx="6.5" cy="12.5" r=".5" fill="currentColor" /><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" /></svg> ); }
function BillingIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /><line x1="7" y1="15" x2="7.01" y2="15" /><line x1="11" y1="15" x2="11.01" y2="15" /></svg> ); }
function UserCircleIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 00-4-4H9a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> ); }
function MessageSquareIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg> ); }
function BellIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 01-3.46 0" /></svg> ); }
function PenawaranIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="M16 13H8" /><path d="M16 17H8" /><path d="M10 9H9H8" /><path d="M12 2v6" /></svg> ); }
function BarChartIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /><line x1="3" y1="20" x2="21" y2="20" /></svg> ); }
function CockpitIcon({ size = 18 }: { size?: number }) { return ( <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 12L16 10" /><path d="M12 12L8 10" /><path d="M12 12V7" /><path d="M12 17V17.01" /></svg> ); }
