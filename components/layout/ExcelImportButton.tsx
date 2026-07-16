"use client";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";

export interface ExcelColumn {
    key: string;
    header: string;
    type?: "text" | "number" | "date" | "boolean";
    /** Kalau diisi, value dicocokkan case-insensitive lalu dinormalisasi ke ejaan persis di sini (mis. CHECK constraint enum di database). */
    options?: string[];
    /**
     * Untuk type "number": cell kosong -> null (bukan 0). Pakai untuk kolom opsional yang
     * kolomnya nullable di database (mis. dp_amount, received_amount) — supaya "belum diisi"
     * tidak tertukar dengan "memang nol", karena banyak kode lain fallback berdasarkan null.
     * Default false (cell kosong -> 0) karena kebanyakan kolom numerik NOT NULL DEFAULT 0.
     */
    nullable?: boolean;
    /**
     * Untuk kolom foreign key (mis. supplier_id, account_id): cocokkan teks di Excel (nama,
     * case-insensitive) ke `label` di sini, ganti jadi `value` (id baris master) yang sesuai.
     * Kalau tidak ketemu kecocokan, kolom dikosongkan (null) alih-alih insert teks yang pasti
     * gagal foreign key constraint.
     */
    lookup?: { value: string; label: string }[];
}

/** Cocokkan value ke salah satu options tanpa peduli besar-kecil huruf/spasi, kembalikan ejaan persis dari options. */
function normalizeToOption(val: string, options: string[]): string {
    const match = options.find((o) => o.toLowerCase() === val.toLowerCase());
    return match ?? val;
}

function errorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (err && typeof err === "object" && "message" in err) {
        const m = (err as { message?: unknown }).message;
        if (typeof m === "string" && m) return m;
    }
    return "Terjadi kesalahan.";
}

/** Konversi cell tanggal Excel (Date object, angka serial, atau string) ke YYYY-MM-DD. */
function toDateString(val: unknown): string | null {
    if (val instanceof Date) return val.toISOString().slice(0, 10);
    if (typeof val === "number") {
        const parsed = XLSX.SSF.parse_date_code(val);
        if (!parsed) return null;
        return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`;
    }
    if (typeof val === "string" && val.trim()) {
        const parsed = new Date(val.trim());
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
    return null;
}

export default function ExcelImportButton({
    columns,
    onImport,
    label = "Import Excel",
}: {
    columns: ExcelColumn[];
    onImport: (rows: Record<string, unknown>[]) => Promise<unknown>;
    label?: string;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const handleFile = async (file: File) => {
        setBusy(true);
        setMessage(null);
        try {
            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: "array", cellDates: true });
            const sheet = wb.Sheets[wb.SheetNames[0]];
            const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

            if (raw.length === 0) {
                setMessage("File kosong atau format tidak sesuai template.");
                return;
            }

            const mapped = raw.map((r) => {
                const row: Record<string, unknown> = {};
                for (const col of columns) {
                    let val = r[col.header];
                    if (col.type === "number") val = val === "" ? (col.nullable ? null : 0) : Number(val);
                    else if (col.type === "boolean") val = val === true || val === "TRUE" || val === "true" || val === 1 || val === "1";
                    else if (col.type === "date") val = toDateString(val);
                    else {
                        const str = val === "" || val === undefined ? null : String(val).trim();
                        if (str && col.lookup) {
                            val = col.lookup.find((o) => o.label.toLowerCase() === str.toLowerCase())?.value ?? null;
                        } else {
                            val = str && col.options ? normalizeToOption(str, col.options) : str;
                        }
                    }
                    row[col.key] = val;
                }
                return row;
            });

            const err = await onImport(mapped);
            if (err) throw new Error(errorMessage(err));
            setMessage(`${mapped.length} baris berhasil diimport.`);
        } catch (err) {
            setMessage(`Gagal: ${errorMessage(err)}`);
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = "";
        }
    };

    const downloadTemplate = () => {
        const ws = XLSX.utils.aoa_to_sheet([columns.map((c) => c.header)]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "template-import.xlsx");
    };

    return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
                type="button"
                onClick={downloadTemplate}
                style={{
                    fontSize: 12, padding: "7px 12px", borderRadius: 6,
                    border: "1px solid var(--border)", background: "white",
                    color: "var(--text-med)", fontWeight: 600, cursor: "pointer",
                }}
            >
                Unduh Template
            </button>
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busy}
                style={{
                    fontSize: 12, padding: "7px 14px", borderRadius: 6, border: "none",
                    background: "var(--primary)", color: "white", fontWeight: 600,
                    cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
                }}
            >
                {busy ? "Mengimpor..." : label}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: "none" }}
                onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                }}
            />
            {message && <span style={{ fontSize: 11, color: "var(--text-med)" }}>{message}</span>}
        </div>
    );
}
