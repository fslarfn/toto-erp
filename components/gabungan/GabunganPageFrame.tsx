"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export function GabunganPageFrame({ title, description, period, onPeriodChange, action, children }: { title: string; description: string; period: string; onPeriodChange: (value: string) => void; action?: ReactNode; children: ReactNode }) {
    const [year, month] = period.split("-").map(Number);
    return <div className="page-content" style={{ maxWidth: 1480, paddingTop: 28 }}>
        <div style={header}>
            <div><div style={eyebrow}>KONTROL OWNER · LINTAS UNIT</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>{title}</h1><p className="page-subtitle" style={{ maxWidth: 760 }}>{description}</p></div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <select aria-label="Bulan" value={month} onChange={(e) => onPeriodChange(`${year}-${String(Number(e.target.value)).padStart(2, "0")}`)} style={select}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select>
                <select aria-label="Tahun" value={year} onChange={(e) => onPeriodChange(`${e.target.value}-${String(month).padStart(2, "0")}`)} style={select}>{[2025, 2026, 2027].map((value) => <option key={value}>{value}</option>)}</select>
                {action}
            </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
            <WorkspaceLink href="/dashboard" label="Toto Pusat" /><WorkspaceLink href="/dashboard/sidoarjo" label="Toto Sidoarjo" /><WorkspaceLink href="/dashboard/alucurv" label="Alucurv" />
        </div>
        {children}
    </div>;
}

export function WorkspaceLink({ href, label }: { href: string; label: string }) { return <Link href={href} style={{ background: "#FFFDF9", border: "1px solid #E8DCCF", padding: "7px 10px", borderRadius: 7, color: "#6B4423", textDecoration: "none", fontSize: 12, fontWeight: 800 }}>Buka {label} →</Link>; }
export function ErrorBox({ message }: { message: string }) { return message ? <div style={{ padding: 12, borderRadius: 10, border: "1px solid #FECACA", background: "#FEF2F2", color: "#B91C1C", fontSize: 13, fontWeight: 700 }}>{message}</div> : null; }
export function LoadingBox({ label = "Memuat ringkasan Gabungan…" }: { label?: string }) { return <div style={{ padding: 34, border: "1px solid #E8DCCF", borderRadius: 12, background: "#FFFDF9", color: "#927C6D", textAlign: "center", fontSize: 13 }}>{label}</div>; }
export const card: React.CSSProperties = { background: "#FFFDF9", border: "1px solid #E8DCCF", borderRadius: 12, padding: 17 };
export const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 18 };
export const eyebrow: React.CSSProperties = { color: "#A67B5B", fontSize: 11, fontWeight: 800, letterSpacing: ".08em", marginBottom: 7 };
export const select: React.CSSProperties = { minHeight: 36, padding: "7px 10px", borderRadius: 7, background: "white", border: "1px solid #D8C1AA", color: "#5C4033", fontWeight: 700, fontSize: 12 };
export const button: React.CSSProperties = { minHeight: 36, padding: "7px 12px", borderRadius: 7, border: "1px solid #8B5E3C", background: "#8B5E3C", color: "white", fontSize: 12, fontWeight: 800, cursor: "pointer" };
