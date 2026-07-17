export default function DomeCard({
    label,
    value,
    valueColor,
    sub,
}: {
    label: string;
    value: string;
    valueColor: string;
    sub?: string;
}) {
    return (
        <div
            style={{
                background: "white", border: "1px solid var(--border)",
                borderRadius: "120px 120px 16px 16px", padding: "34px 16px 20px",
                textAlign: "center", display: "flex", flexDirection: "column", gap: 6,
            }}
        >
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: valueColor }}>{value}</div>
            {sub && <div style={{ fontSize: 9.5, color: "var(--text-med)" }}>{sub}</div>}
        </div>
    );
}
