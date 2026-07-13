"use client";
import { useRouter } from "next/navigation";
import { useWorkspace, type ActiveWorkspace } from "@/lib/workspace-store";

const LABELS: Record<ActiveWorkspace, string> = {
    toto: "Toto",
    alucurv: "Alucurv",
    gabungan: "Gabungan",
};

const HOME_ROUTE: Record<ActiveWorkspace, string> = {
    toto: "/dashboard",
    alucurv: "/dashboard/alucurv",
    gabungan: "/dashboard/gabungan",
};

export default function WorkspaceSwitcher() {
    const router = useRouter();
    const { memberships, activeWorkspace, setActiveWorkspace, canViewGabungan, loading } = useWorkspace();

    // Mayoritas user cuma punya 1 workspace (perilaku lama) — switcher tidak tampil sama sekali.
    if (loading || memberships.length <= 1) return null;

    const options: ActiveWorkspace[] = [...memberships.map((m) => m.workspace)];
    if (canViewGabungan) options.push("gabungan");

    const handleChange = (w: ActiveWorkspace) => {
        setActiveWorkspace(w);
        router.push(HOME_ROUTE[w]);
    };

    return (
        <select
            value={activeWorkspace}
            onChange={(e) => handleChange(e.target.value as ActiveWorkspace)}
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
