"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import {
    LayoutDashboard, ShoppingCart, Database, DollarSign,
    Package, Factory, Users, LogOut, Menu, X, ChevronRight,
    Shirt, FileText, CreditCard, UserCircle
} from "lucide-react";

const navItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", module: "dashboard" },
    { href: "/dashboard/pesanan", icon: ShoppingCart, label: "Pesanan (PO)", module: "pesanan" },
    { href: "/dashboard/big-data", icon: Database, label: "Big Data / Tracking", module: "big-data" },
    { href: "/dashboard/keuangan", icon: DollarSign, label: "Keuangan", module: "keuangan" },
    { href: "/dashboard/invoice", icon: FileText, label: "Invoice", module: "keuangan" },
    { href: "/dashboard/tagihan", icon: DollarSign, label: "Tagihan", module: "keuangan" },
    { href: "/dashboard/inventaris", icon: Package, label: "Inventaris", module: "inventaris" },
    { href: "/dashboard/produksi", icon: Factory, label: "Produksi", module: "produksi" },
    { href: "/dashboard/akun", icon: UserCircle, label: "Akun Saya", module: "any" },
    { href: "/dashboard/admin/billing", icon: CreditCard, label: "Admin Billing", module: "admin-only" },
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user, logout, hasAccess } = useAuth();
    const [collapsed, setCollapsed] = useState(false);

    const roleColors: Record<string, string> = {
        owner: "bg-yellow-500",
        finance: "bg-blue-500",
        sales: "bg-green-500",
        produksi: "bg-purple-500",
        barang: "bg-orange-500",
    };

    const roleLabels: Record<string, string> = {
        owner: "Owner",
        finance: "Admin Finance",
        sales: "Admin Sales",
        produksi: "Bag. Produksi",
        barang: "Admin Barang",
    };

    return (
        <aside
            className={`flex flex-col h-screen transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
            style={{ background: "#0f172a", flexShrink: 0 }}
        >
            {/* Logo */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-slate-700">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                            <Shirt size={16} className="text-white" />
                        </div>
                        <div>
                            <div className="text-white font-bold text-sm leading-tight">TOTOBARU</div>
                            <div className="text-slate-400 text-xs">Manufacturing</div>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center mx-auto">
                        <Shirt size={16} className="text-white" />
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="text-slate-400 hover:text-white transition-colors p-1 rounded"
                >
                    {collapsed ? <ChevronRight size={16} /> : <Menu size={16} />}
                </button>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
                {navItems.map((item) => {
                    // Proteksi Khusus Billing: Hanya Faisal
                    if (item.module === "admin-only" && user?.username !== "faisal") return null;
                    
                    // Proteksi Modul standar
                    if (item.module !== "admin-only" && item.module !== "any" && !hasAccess(item.module) && user?.role !== "owner") return null;
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`sidebar-link ${isActive ? "active" : ""} ${collapsed ? "justify-center px-2" : ""}`}
                            title={collapsed ? item.label : undefined}
                        >
                            <item.icon size={18} />
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* User */}
            <div className="p-3 border-t border-slate-700">
                {!collapsed ? (
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-white text-xs font-bold ${roleColors[user?.role || "owner"]}`}>
                            {user?.avatar ? (
                                <img src={user.avatar} alt="P" className="w-full h-full object-cover" />
                            ) : (
                                user?.name.charAt(0)
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-white text-xs font-medium truncate">{user?.name.split(" (")[0]}</div>
                            <div className="text-slate-400 text-xs">{roleLabels[user?.role || "owner"]}</div>
                        </div>
                        <button onClick={logout} className="text-slate-400 hover:text-red-400 transition-colors" title="Logout">
                            <LogOut size={15} />
                        </button>
                    </div>
                ) : (
                    <button
                        onClick={logout}
                        className="w-full flex justify-center text-slate-400 hover:text-red-400 transition-colors py-1"
                        title="Logout"
                    >
                        <LogOut size={18} />
                    </button>
                )}
            </div>
        </aside>
    );
}
