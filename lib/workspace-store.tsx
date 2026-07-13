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
    activeWorkspace: ActiveWorkspace;
    setActiveWorkspace: (w: ActiveWorkspace) => void;
    hasWorkspace: (w: Workspace) => boolean;
    canViewGabungan: boolean;
}

const WorkspaceContext = createContext<WorkspaceCtx | null>(null);
const LS_KEY = "totobaru_active_workspace";

export function WorkspaceProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [memberships, setMemberships] = useState<WorkspaceMembership[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeWorkspace, setActiveWorkspaceState] = useState<ActiveWorkspace>("toto");

    useEffect(() => {
        try {
            const stored = localStorage.getItem(LS_KEY) as ActiveWorkspace | null;
            if (stored) setActiveWorkspaceState(stored);
        } catch { /* ignore */ }
    }, []);

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

    const setActiveWorkspace = (w: ActiveWorkspace) => {
        setActiveWorkspaceState(w);
        try { localStorage.setItem(LS_KEY, w); } catch { /* ignore */ }
    };

    const hasWorkspace = (w: Workspace) => memberships.some((m) => m.workspace === w);
    const canViewGabungan = hasWorkspace("toto") && hasWorkspace("alucurv");

    return (
        <WorkspaceContext.Provider
            value={{ memberships, loading, activeWorkspace, setActiveWorkspace, hasWorkspace, canViewGabungan }}
        >
            {children}
        </WorkspaceContext.Provider>
    );
}

export function useWorkspace() {
    const ctx = useContext(WorkspaceContext);
    if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
    return ctx;
}
