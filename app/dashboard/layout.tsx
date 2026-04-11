"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth, roleLabels, getRoleDisplay } from "@/lib/auth";
import { PesananProvider } from "@/lib/pesanan-store";
import { SuratJalanProvider } from "@/lib/surat-jalan-store";
import { SJBahanProvider } from "@/lib/sj-bahan-store";
import { TagihanBahanProvider } from "@/lib/tagihan-bahan-store";


const NAV_ITEMS = [
    {
        section: "Menu Utama",
        items: [
            { href: "/dashboard", label: "Dashboard", module: "dashboard", icon: HomeIcon },
            { href: "/dashboard/pesanan", label: "Input Pesanan", module: "pesanan", icon: ClipboardIcon },
            { href: "/dashboard/status-barang", label: "Status Barang", module: "status-barang", icon: PackageIcon },
        ],
    },
    {
        section: "Keuangan",
        items: [
            { href: "/dashboard/keuangan", label: "Keuangan", module: "keuangan", icon: WalletIcon },
            { href: "/dashboard/invoice", label: "Invoice", module: "keuangan", icon: InvoiceIcon },
            { href: "/dashboard/tagihan", label: "Tagihan", module: "keuangan", icon: TagihanIcon },
            { href: "/dashboard/tagihan-bahan", label: "Tagihan Bahan Baku", module: "keuangan", icon: BoxIcon },
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
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { user, logout, hasAccess } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    // Redirect to login if not authenticated
    useEffect(() => {
        if (!user) router.replace("/login");
    }, [user, router]);

    if (!user) return null;

    const handleLogout = () => {
        logout();
        router.replace("/login");
    };

    const containerClass = [
        "flex h-screen",
        collapsed ? "sidebar-collapsed" : "",
        mobileOpen ? "sidebar-open" : "",
    ].filter(Boolean).join(" ");

    return (
        <PesananProvider>
            <SuratJalanProvider>
                <SJBahanProvider>
                    <TagihanBahanProvider>
                <div id="app-container" className={containerClass} style={{ background: "var(--bg)" }}>
                    {/* Mobile Backdrop */}
                    <div id="sidebar-backdrop" onClick={() => setMobileOpen(false)} />

                    {/* ============ SIDEBAR ============ */}
                    <div id="sidebar">
                        {/* Brand */}
                        <div className="brand">
                            <div
                                className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ background: "var(--primary)" }}
                            >
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                                    <polyline points="9 22 9 12 15 12 15 22" />
                                </svg>
                            </div>
                            <span className="brand-text" style={{ fontSize: "0.95rem" }}>ERP TOTO</span>
                        </div>

                        {/* Nav */}
                        <div className="sidebar-content">
                            {NAV_ITEMS.map((group) => {
                                const visibleItems = group.items.filter((item) =>
                                    hasAccess(item.module)
                                );
                                if (visibleItems.length === 0) return null;
                                return (
                                    <div key={group.section}>
                                        <div className="section-label">{group.section}</div>
                                        {visibleItems.map((item) => {
                                            const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                                            const Icon = item.icon;
                                            return (
                                                <Link
                                                    key={item.href}
                                                    href={item.href}
                                                    className={`sidebar-link ${isActive ? "active" : ""}`}
                                                    onClick={() => setMobileOpen(false)}
                                                >
                                                    <Icon size={18} />
                                                    <span className="sidebar-text">{item.label}</span>
                                                </Link>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="sidebar-footer">
                            {!collapsed && (
                                <div className="text-xs mb-2 px-1 truncate" style={{ color: "#B89678" }}>
                                    <span className="font-semibold" style={{ color: "var(--text-dark)" }}>{user.name}</span>
                                    <br />
                                    <span>{getRoleDisplay(user)}</span>
                                </div>
                            )}
                            <button onClick={handleLogout} title="Logout">
                                <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                                    <polyline points="16 17 21 12 16 7" />
                                    <line x1="21" y1="12" x2="9" y2="12" />
                                </svg>
                                <span className="sidebar-text">Logout</span>
                            </button>
                        </div>
                    </div>

                    {/* ============ MAIN CONTENT ============ */}
                    <div id="main-content-wrapper">
                        {/* Header */}
                        <header>
                            <div className="header-content">
                                <div className="flex items-center gap-3">
                                    {/* Sidebar toggle */}
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

                                {/* Header right */}
                                <div className="flex items-center gap-3">
                                    <div className="text-right hidden sm:block">
                                        <div className="text-sm font-semibold">{user.name}</div>
                                        <div className="text-xs opacity-80">{getRoleDisplay(user)}</div>
                                    </div>
                                    <div
                                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                                        style={{ background: "rgba(255,255,255,0.2)", color: "white" }}
                                    >
                                        {user.name[0].toUpperCase()}
                                    </div>
                                </div>
                            </div>
                        </header>

                        {/* Page content */}
                        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflowX: "hidden", background: "var(--bg)" }}>
                            {children}
                        </main>
                    </div>
                </div>
                    </TagihanBahanProvider>
                </SJBahanProvider>
            </SuratJalanProvider>
        </PesananProvider>
    );
}

/* ---- Icon components (inline SVG) ---- */
function HomeIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
    );
}
function ClipboardIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
            <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
        </svg>
    );
}
function PackageIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
    );
}
function WalletIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 12V8H6a2 2 0 01-2-2c0-1.1.9-2 2-2h12v4" />
            <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
            <path d="M18 12a2 2 0 000 4h4v-4z" />
        </svg>
    );
}
function BoxIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
        </svg>
    );
}
function FactoryIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 20a2 2 0 002 2h16a2 2 0 002-2V8l-7 5V8l-7 5V4a2 2 0 00-2-2H4a2 2 0 00-2 2z" />
        </svg>
    );
}
function PrinterIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
        </svg>
    );
}
function InvoiceIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
        </svg>
    );
}
function TruckIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="3" width="15" height="13" />
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
        </svg>
    );
}
function TagihanIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
    );
}
function KaryawanIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}
function ClockIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
function ColorPaletteIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>
    );
}
