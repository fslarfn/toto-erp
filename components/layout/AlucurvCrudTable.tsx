"use client";
import { useState, type CSSProperties, type FormEvent } from "react";

export interface CrudField {
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "select" | "checkbox";
    options?: string[];
}

export default function AlucurvCrudTable<T extends { id: string }>({
    fields,
    rows,
    loading,
    onAdd,
    onDelete,
}: {
    fields: CrudField[];
    rows: T[];
    loading: boolean;
    onAdd: (values: Record<string, unknown>) => Promise<unknown>;
    onDelete: (id: string) => Promise<unknown>;
}) {
    const emptyForm = () =>
        Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""])) as Record<string, unknown>;
    const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
    const [saving, setSaving] = useState(false);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onAdd(form);
            setForm(emptyForm());
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <form onSubmit={submit} style={formStyle}>
                {fields.map((f) => (
                    <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={labelStyle}>{f.label}</label>
                        {f.type === "select" ? (
                            <select
                                value={String(form[f.key] ?? "")}
                                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                style={inputStyle}
                            >
                                <option value="">-</option>
                                {f.options?.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                ))}
                            </select>
                        ) : f.type === "checkbox" ? (
                            <input
                                type="checkbox"
                                checked={Boolean(form[f.key])}
                                onChange={(e) => setForm({ ...form, [f.key]: e.target.checked })}
                                style={{ marginTop: 8, width: 16, height: 16 }}
                            />
                        ) : (
                            <input
                                type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                                value={String(form[f.key] ?? "")}
                                onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                                style={inputStyle}
                            />
                        )}
                    </div>
                ))}
                <button type="submit" disabled={saving} style={btnStyle}>
                    {saving ? "Menyimpan..." : "+ Tambah"}
                </button>
            </form>

            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {fields.map((f) => (
                                <th key={f.key} style={thStyle}>{f.label}</th>
                            ))}
                            <th style={thStyle} />
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={fields.length + 1} style={tdEmptyStyle}>Memuat...</td></tr>
                        ) : rows.length === 0 ? (
                            <tr><td colSpan={fields.length + 1} style={tdEmptyStyle}>Belum ada data.</td></tr>
                        ) : (
                            rows.map((row) => (
                                <tr key={row.id}>
                                    {fields.map((f) => (
                                        <td key={f.key} style={tdStyle}>
                                            {f.type === "checkbox"
                                                ? ((row as unknown as Record<string, unknown>)[f.key] ? "✓" : "")
                                                : String((row as unknown as Record<string, unknown>)[f.key] ?? "")}
                                        </td>
                                    ))}
                                    <td style={tdStyle}>
                                        <button onClick={() => onDelete(row.id)} style={deleteBtnStyle}>Hapus</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const formStyle: CSSProperties = {
    display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end",
    marginBottom: 16, padding: 12, background: "var(--bg-secondary)",
    borderRadius: 10, border: "1px solid var(--border)",
};
const labelStyle: CSSProperties = { fontSize: 10, color: "var(--text-med)", fontWeight: 600, textTransform: "uppercase" };
const inputStyle: CSSProperties = { fontSize: 12, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", minWidth: 110, color: "var(--text-dark)" };
const btnStyle: CSSProperties = { fontSize: 12, padding: "8px 16px", borderRadius: 6, border: "none", background: "var(--primary)", color: "white", fontWeight: 600, cursor: "pointer" };
const thStyle: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" };
const tdStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const tdEmptyStyle: CSSProperties = { ...tdStyle, textAlign: "center", color: "var(--text-med)", padding: "20px 10px" };
const deleteBtnStyle: CSSProperties = { color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 };
