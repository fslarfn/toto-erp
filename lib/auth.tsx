"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, UserRole } from "@/types";
import { supabase } from "@/lib/supabase-client";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    hasAccess: (module: string) => boolean;
    updateUserData: (updatedUser: User) => void;
}

/**
 * RBAC Configuration
 * - owner: Full access to all modules
 * - finance: Full access (updated for Vira)
 * - sales/produksi/barang: Restricted access
 */
const roleAccess: Record<UserRole, string[]> = {
    owner: ["dashboard", "pesanan", "status-barang", "keuangan", "stok-bahan", "produksi", "admin"],
    finance: ["dashboard", "pesanan", "status-barang", "keuangan", "stok-bahan", "produksi", "admin"],
    sales: ["pesanan", "status-barang"],
    produksi: ["dashboard", "pesanan", "status-barang", "stok-bahan", "produksi"],
    barang: ["dashboard", "pesanan", "status-barang", "stok-bahan", "produksi"],
};

const roleLabels: Record<UserRole, string> = {
    owner: "Owner / Manager",
    finance: "Admin Finance",
    sales: "Admin Sales",
    produksi: "PIC Produksi",
    barang: "PIC Barang",
};

export function getRoleDisplay(user: User | null) {
    if (!user) return "";
    if (user.username === "faisal") return "Manager";
    if (user.username === "yuni") return "Admin Barang";
    return roleLabels[user.role] || user.role;
}

const LS_USER_KEY = "totobaru_user";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore session from localStorage & Sync with DB
    useEffect(() => {
        const restoreAndSync = async () => {
            try {
                const stored = localStorage.getItem(LS_USER_KEY);
                if (stored) {
                    const localUser = JSON.parse(stored) as User;
                    setUser(localUser); // Set local immediately for UI responsiveness
                    
                    // Background refetch to ensure avatar and other data are fresh
                    const { data, error } = await supabase
                        .from("app_users")
                        .select("*")
                        .eq("id", localUser.id)
                        .maybeSingle();
                    
                    if (data && !error) {
                        const freshUser: User = {
                            id: data.id,
                            name: data.name,
                            username: data.username,
                            role: data.role as UserRole,
                            avatar: data.avatar || undefined,
                        };
                        setUser(freshUser);
                        localStorage.setItem(LS_USER_KEY, JSON.stringify(freshUser));
                    }
                }
            } catch { /* ignore */ }
            setLoading(false);
        };
        restoreAndSync();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            // Try Supabase first
            const { data, error } = await supabase
                .from("app_users")
                .select("*")
                .eq("username", username.toLowerCase().trim())
                .eq("password_hash", password)
                .maybeSingle();

            if (data && !error) {
                const u: User = {
                    id: data.id,
                    name: data.name,
                    username: data.username,
                    role: data.role as UserRole,
                    avatar: data.avatar || undefined,
                };
                setUser(u);
                localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
                return true;
            }

            return false;
        } catch {
            return false;
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem(LS_USER_KEY);
    };

    const hasAccess = (module: string) => {
        if (!user) return false;
        return roleAccess[user.role]?.includes(module) ?? false;
    };

    const updateUserData = (updatedUser: User) => {
        setUser(updatedUser);
        localStorage.setItem(LS_USER_KEY, JSON.stringify(updatedUser));
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasAccess, updateUserData }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be inside AuthProvider");
    return ctx;
}

export { roleLabels, roleAccess };
