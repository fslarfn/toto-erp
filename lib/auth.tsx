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
}

const roleAccess: Record<UserRole, string[]> = {
    owner: ["dashboard", "pesanan", "status-barang", "keuangan", "stok-bahan", "produksi", "admin"],
    finance: ["dashboard", "pesanan", "status-barang", "keuangan"],
    sales: ["pesanan", "status-barang"],
    produksi: ["dashboard", "pesanan", "status-barang", "stok-bahan", "produksi"],
    barang: ["dashboard", "pesanan", "status-barang", "stok-bahan", "produksi"],
};

const roleLabels: Record<UserRole, string> = {
    owner: "Owner / Manager",
    finance: "Admin Finance",
    sales: "Admin Sales",
    produksi: "Bagian Produksi",
    barang: "Admin Barang",
};

const LS_USER_KEY = "totobaru_user";

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Restore session from localStorage
    useEffect(() => {
        try {
            const stored = localStorage.getItem(LS_USER_KEY);
            if (stored) {
                setUser(JSON.parse(stored));
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            // Try Supabase first
            const { data, error } = await supabase
                .from("app_users")
                .select("*")
                .eq("username", username.toLowerCase().trim())
                .eq("password_hash", password)
                .single();

            if (data && !error) {
                const u: User = {
                    id: data.id,
                    name: data.name,
                    username: data.username,
                    role: data.role as UserRole,
                };
                setUser(u);
                localStorage.setItem(LS_USER_KEY, JSON.stringify(u));
                return true;
            }

            // Fallback: hardcoded demo login if Supabase unavailable
            if (password === "toto2025") {
                const mockUsers: User[] = [
                    { id: "1", name: "Owner", username: "owner", role: "owner" },
                    { id: "2", name: "Admin Finance", username: "finance", role: "finance" },
                    { id: "3", name: "Admin Sales", username: "sales", role: "sales" },
                    { id: "4", name: "Produksi", username: "produksi", role: "produksi" },
                    { id: "5", name: "Admin Barang", username: "barang", role: "barang" },
                ];
                const found = mockUsers.find(u => u.username === username.toLowerCase().trim());
                if (found) {
                    setUser(found);
                    localStorage.setItem(LS_USER_KEY, JSON.stringify(found));
                    return true;
                }
            }

            return false;
        } catch {
            // Supabase unavailable — use fallback
            if (password === "toto2025") {
                const mockUsers: User[] = [
                    { id: "1", name: "Owner", username: "owner", role: "owner" },
                    { id: "2", name: "Admin Finance", username: "finance", role: "finance" },
                    { id: "3", name: "Admin Sales", username: "sales", role: "sales" },
                    { id: "4", name: "Produksi", username: "produksi", role: "produksi" },
                    { id: "5", name: "Admin Barang", username: "barang", role: "barang" },
                ];
                const found = mockUsers.find(u => u.username === username.toLowerCase().trim());
                if (found) {
                    setUser(found);
                    localStorage.setItem(LS_USER_KEY, JSON.stringify(found));
                    return true;
                }
            }
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

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, hasAccess }}>
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
