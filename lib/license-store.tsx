"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

export interface LicenseInfo {
    license_expired_at: string;
    is_setup_completed: boolean;
    max_users: number;
    isActive: boolean;
    daysLeft: number;
    isWarning: boolean; // True if less than 3 days left
}

interface LicenseCtx {
    license: LicenseInfo | null;
    loading: boolean;
    refreshLicense: () => Promise<void>;
}

const LicenseContext = createContext<LicenseCtx | null>(null);

export function LicenseProvider({ children }: { children: ReactNode }) {
    const [license, setLicense] = useState<LicenseInfo | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshLicense = async () => {
        try {
            const { data, error } = await supabase
                .from("app_config")
                .select("*")
                .eq("id", 1)
                .single();

            if (data && !error) {
                const expiredDate = new Date(data.license_expired_at);
                const now = new Date();
                const diffTime = expiredDate.getTime() - now.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                setLicense({
                    license_expired_at: data.license_expired_at,
                    is_setup_completed: data.is_setup_completed,
                    max_users: data.max_users,
                    isActive: diffTime > 0,
                    daysLeft: diffDays,
                    isWarning: diffDays > 0 && diffDays <= 7,
                });
            }
        } catch (err) {
            console.error("Failed to fetch license:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshLicense();
        
        // Polling status setiap 5 menit untuk memastikan keamanan
        const interval = setInterval(refreshLicense, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <LicenseContext.Provider value={{ license, loading, refreshLicense }}>
            {children}
        </LicenseContext.Provider>
    );
}

export function useLicense() {
    const ctx = useContext(LicenseContext);
    if (!ctx) throw new Error("useLicense must be used inside LicenseProvider");
    return ctx;
}
