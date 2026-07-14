"use client";
import { useState, type CSSProperties, type FormEvent } from "react";

export interface CrudField {
    key: string;
    label: string;
    type?: "text" | "number" | "date" | "select" | "checkbox";
    options?: string[];
    /** Tampilkan field ini di form tambah hanya kalau kondisi terpenuhi (mis. tergantung field lain). */
    showIf?: (form: Record<string, unknown>) => boolean;
    /** Format tampilan di tabel (input tetap angka biasa). "currency" -> "Rp 1.234.567". */
    format?: "currency";
    /**
     * Untuk type "number": kosong -> null (bukan 0) saat disimpan. Pakai untuk kolom yang
     * memang nullable di database (mis. field opsional dengan showIf). Default false (kosong
     * -> 0) karena kebanyakan kolom numerik NOT NULL DEFAULT 0 — kirim null ke situ akan gagal.
     */
    nullable?: boolean;
    /** Validasi sebelum simpan: tampilkan pesan ramah kalau kosong, alih-alih error mentah dari database. */
    required?: boolean;
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string" && m) return m;
    }
    return "Gagal menyimpan data.";
}

function displayValue(field: CrudField, val: unknown): string {
    if (field.format === "currency") {
        const n = Number(val);
        return val === "" || val === null || val === undefined || isNaN(n) ? "" : `Rp ${n.toLocaleString("id-ID")}`;
    }
    return String(val ?? "");
}

function FieldInput({
    field,
    value,
    onChange,
}: {
    field: CrudField;
    value: unknown;
    onChange: (val: unknown) => void;
}) {
    if (field.type === "select") {
        return (
            <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
                <option value="">-</option>
                {field.options?.map((o) => (
                    <option key={o} value={o}>{o}</option>
                ))}
            </select>
        );
    }
    if (field.type === "checkbox") {
        return (
            <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(e.target.checked)}
                style={{ marginTop: 8, width: 16, height: 16 }}
            />
        );
    }
    return (
        <input
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
        />
    );
}

export default function AlucurvCrudTable<T extends { id: string }>({
    fields,
    rows,
    loading,
    onAdd,
    onDelete,
    onUpdate,
}: {
    fields: CrudField[];
    rows: T[];
    loading: boolean;
    onAdd: (values: Record<string, unknown>) => Promise<unknown>;
    onDelete: (id: string) => Promise<unknown>;
    onUpdate?: (id: string, patch: Record<string, unknown>) => Promise<unknown>;
}) {
    const emptyForm = () =>
        Object.fromEntries(fields.map((f) => [f.key, f.type === "checkbox" ? false : ""])) as Record<string, unknown>;
    const [form, setForm] = useState<Record<string, unknown>>(emptyForm());
    const [saving, setSaving] = useState(false);

    const [editId, setEditId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Record<string, unknown>>({});
    const [editSaving, setEditSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [formError, setFormError] = useState<string | null>(null);
    const [editError, setEditError] = useState<string | null>(null);

    // Field number/date yang kosong ("") harus jadi null/0, bukan string kosong — Postgres
    // menolak "" untuk kolom numerik maupun tanggal apa pun statusnya nullable atau tidak.
    // `field.nullable` menentukan fallback number-nya null vs 0 (date selalu -> null).
    const sanitize = (values: Record<string, unknown>) => {
        const out = { ...values };
        for (const f of fields) {
            if (f.type === "number" && out[f.key] === "") {
                out[f.key] = f.nullable ? null : 0;
            } else if (f.type === "date" && out[f.key] === "") {
                out[f.key] = null;
            }
        }
        return out;
    };

    const missingRequired = (values: Record<string, unknown>) =>
        fields.filter((f) => f.required && (!f.showIf || f.showIf(values)) && (values[f.key] === "" || values[f.key] == null));

    const query = search.trim().toLowerCase();
    const visibleRows = query
        ? rows.filter((row) =>
            fields.some((f) => displayValue(f, (row as unknown as Record<string, unknown>)[f.key]).toLowerCase().includes(query))
          )
        : rows;

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setFormError(null);
        const missing = missingRequired(form);
        if (missing.length > 0) {
            setFormError(`Wajib diisi: ${missing.map((f) => f.label).join(", ")}`);
            return;
        }
        setSaving(true);
        try {
            const err = await onAdd(sanitize(form));
            if (err) setFormError(errorMessage(err));
            else setForm(emptyForm());
        } finally {
            setSaving(false);
        }
    };

    const openEdit = (row: T) => {
        setEditId(row.id);
        setEditForm({ ...(row as unknown as Record<string, unknown>) });
        setEditError(null);
    };

    const saveEdit = async () => {
        if (!editId || !onUpdate) return;
        setEditError(null);
        const missing = missingRequired(editForm);
        if (missing.length > 0) {
            setEditError(`Wajib diisi: ${missing.map((f) => f.label).join(", ")}`);
            return;
        }
        setEditSaving(true);
        try {
            const err = await onUpdate(editId, sanitize(editForm));
            if (err) setEditError(errorMessage(err));
            else setEditId(null);
        } finally {
            setEditSaving(false);
        }
    };

    const toggleCheckbox = (row: T, key: string, checked: boolean) => {
        if (onUpdate) onUpdate(row.id, { [key]: checked });
    };

    return (
        <div>
            <form onSubmit={submit} style={formStyle}>
                {fields.filter((f) => !f.showIf || f.showIf(form)).map((f) => (
                    <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        <label style={labelStyle}>{f.label}</label>
                        <FieldInput field={f} value={form[f.key]} onChange={(val) => setForm({ ...form, [f.key]: val })} />
                    </div>
                ))}
                <button type="submit" disabled={saving} style={btnStyle}>
                    {saving ? "Menyimpan..." : "+ Tambah"}
                </button>
                {formError && <span style={errorTextStyle}>{formError}</span>}
            </form>

            <div style={{ marginBottom: 10, position: "relative", maxWidth: 320 }}>
                <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari..."
                    style={{ ...inputStyle, width: "100%", minWidth: 0 }}
                />
            </div>

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
                        ) : visibleRows.length === 0 ? (
                            <tr><td colSpan={fields.length + 1} style={tdEmptyStyle}>{query ? "Tidak ada hasil untuk pencarian ini." : "Belum ada data."}</td></tr>
                        ) : (
                            visibleRows.map((row) => (
                                <tr key={row.id}>
                                    {fields.map((f) => {
                                        const rowVal = (row as unknown as Record<string, unknown>)[f.key];
                                        return (
                                            <td key={f.key} style={tdStyle}>
                                                {f.type === "checkbox" ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(rowVal)}
                                                        disabled={!onUpdate}
                                                        onChange={(e) => toggleCheckbox(row, f.key, e.target.checked)}
                                                        style={{ width: 16, height: 16, cursor: onUpdate ? "pointer" : "default" }}
                                                    />
                                                ) : (
                                                    displayValue(f, rowVal)
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                                        {onUpdate && (
                                            <button onClick={() => openEdit(row)} style={editBtnStyle}>Ubah</button>
                                        )}
                                        <button onClick={() => onDelete(row.id)} style={deleteBtnStyle}>Hapus</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {editId && (
                <div style={overlayStyle} onClick={() => setEditId(null)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text-dark)", marginBottom: 14 }}>Ubah Data</h2>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                            {fields.filter((f) => !f.showIf || f.showIf(editForm)).map((f) => (
                                <div key={f.key} style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 140 }}>
                                    <label style={labelStyle}>{f.label}</label>
                                    <FieldInput field={f} value={editForm[f.key]} onChange={(val) => setEditForm({ ...editForm, [f.key]: val })} />
                                </div>
                            ))}
                        </div>
                        {editError && <div style={{ ...errorTextStyle, display: "block", marginTop: 10 }}>{editError}</div>}
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
                            <button onClick={() => setEditId(null)} style={ghostBtnStyle}>Batal</button>
                            <button onClick={saveEdit} disabled={editSaving} style={btnStyle}>{editSaving ? "Menyimpan..." : "Simpan"}</button>
                        </div>
                    </div>
                </div>
            )}
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
const ghostBtnStyle: CSSProperties = { fontSize: 12, padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--text-med)", fontWeight: 600, cursor: "pointer" };
const thStyle: CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" };
const tdStyle: CSSProperties = { padding: "8px 10px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const tdEmptyStyle: CSSProperties = { ...tdStyle, textAlign: "center", color: "var(--text-med)", padding: "20px 10px" };
const deleteBtnStyle: CSSProperties = { color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600 };
const errorTextStyle: CSSProperties = { fontSize: 11.5, color: "#DC2626", fontWeight: 600 };
const editBtnStyle: CSSProperties = { color: "var(--primary-dark)", background: "none", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600, marginRight: 12 };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalStyle: CSSProperties = { background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" };
