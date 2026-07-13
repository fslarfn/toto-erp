"use client";
import { useWorkspace, type ActiveWorkspace } from "@/lib/workspace-store";

const LABELS: Record<ActiveWorkspace, string> = {
    toto: "Toto",
    alucurv: "Alucurv",
    gabungan: "Gabungan",
};

export default function WorkspaceSwitcher() {
    const { memberships, activeWorkspace, setActiveWorkspace, canViewGabungan, loading } = useWorkspace();

    // Mayoritas user cuma punya 1 workspace (perilaku lama) — switcher tidak tampil sama sekali.
    if (loading || memberships.length <= 1) return null;

    const options: ActiveWorkspace[] = [...memberships.map((m) => m.workspace)];
    if (canViewGabungan) options.push("gabungan");

    return (
        <select
            value={activeWorkspace}
            onChange={(e) => setActiveWorkspace(e.target.value as ActiveWorkspace)}
            title="Pilih Workspace"
            style={{
                fontSize: 11,
                padding: "5px 8px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-secondary)",
                color: "var(--text-dark)",
                fontWeight: 600,
                width: "100%",
                marginTop: 8,
                cursor: "pointer",
            }}
        >
            {options.map((o) => (
                <option key={o} value={o}>
                    {LABELS[o]}
                </option>
            ))}
        </select>
    );
}
