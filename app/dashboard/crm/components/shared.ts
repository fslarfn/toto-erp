// Konstanta & style kecil yang dipakai lintas-tab CRM.
import type { CustomerType } from "@/types";

export const TYPE_OPTS: { value: CustomerType; label: string; color: string }[] = [
    { value: "retail", label: "Retail", color: "#2563EB" },
    { value: "proyek", label: "Proyek", color: "#15803D" },
    { value: "kontraktor", label: "Kontraktor", color: "#A16207" },
    { value: "reseller", label: "Reseller", color: "#7C3AED" },
    { value: "lainnya", label: "Lainnya", color: "#6B7280" },
];
export const typeMeta = (t: CustomerType) => TYPE_OPTS.find((o) => o.value === t) ?? TYPE_OPTS[4];

export const inputSt: React.CSSProperties = {
    width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "8px 12px",
    fontSize: 13, color: "#3C2F2F", background: "#FFFBF7", outline: "none", boxSizing: "border-box",
};
export const labelSt: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1,
    textTransform: "uppercase", display: "block", marginBottom: 5,
};
