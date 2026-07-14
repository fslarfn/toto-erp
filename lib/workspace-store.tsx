"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";

export type Workspace = "toto" | "alucurv";
export type ActiveWorkspace = Workspace | "gabungan";
export type WorkspaceRole = "owner" | "manager" | "finance" | "sales" | "produksi" | "barang";

export interface WorkspaceMembership {
    workspace: Workspace;
    role: WorkspaceRole;
}

interface WorkspaceCtx {
    memberships: WorkspaceMembership[];
    loading: boolean;
    hasWorkspace: (w: Workspace) => boolean;
    canViewGabungan: boolean;
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

/**
 * Workspace aktif SELALU diturunkan dari URL, bukan dari state/localStorage
 * terpisah — supaya sidebar tidak pernah desync dari halaman yang benar-benar
 * sedang dibuka (mis. baru login pertama kali di device baru, localStorage
 * masih kosong tapi URL sudah di /dashboard/alucurv).
 */
export function getWorkspaceFromPath(pathname: string): ActiveWorkspace {
    if (pathname.startsWith("/dashboard/alucurv")) return "alucurv";
    if (pathname.startsWith("/dashboard/gabungan")) return "gabungan";
    return "toto";
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) {
            setMemberships([]);
            setLoading(false);
            return;
        }
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                const { data, error } = await supabase
                    .from("user_workspaces")
                    .select("workspace, role")
                    .eq("user_id", user.id);
                if (!cancelled && !error && data) {
                    setMemberships(data as WorkspaceMembership[]);
                }
            } catch {
                // Tabel belum ada / query gagal → anggap single-workspace (perilaku lama tetap jalan)
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [user]);

    const hasWorkspace = (w: Workspace) => memberships.some((m) => m.workspace === w);
    const canViewGabungan = hasWorkspace("toto") && hasWorkspace("alucurv");

    return (
        <WorkspaceContext.Provider value={{ memberships, loading, hasWorkspace, canViewGabungan }}>
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
    return ctx;
}
