"use client";
import { memo } from "react";
import { PesananRow } from "@/lib/pesanan-store";
import { StatusCell } from "./StatusCell";

type Props = {
    row: PesananRow;
    idx: number;
    viewMode: "detail" | "simple";
    activeCell: { id: number; key: string } | null;
    setActiveCell: (cell: { id: number; key: string } | null) => void;
    onUpdate: (id: number, patch: Partial<PesananRow>) => void;
    colorRowId: number | null;
    setColorRowId: (id: number | null) => void;
};

const ROW_COLORS = [
    { label: "Bersih", value: "" },
    { label: "Merah", value: "#FFCDD2" },
    { label: "Kuning", value: "#FFF9C4" },
    { label: "Hijau", value: "#C8E6C9" },
    { label: "Biru", value: "#BBDEFB" },
    { label: "Ungu", value: "#E1BEE7" },
    { label: "Oranye", value: "#FFE0B2" },
];

/**
 * Memoized Individual Row with scoped editing logic (SCOPE LOCK)
 */
export const StatusRow = memo(function StatusRow({
    row, idx, viewMode, activeCell, setActiveCell, onUpdate, colorRowId, setColorRowId
}: Props) {
    const rowBg = row.color_marker || "white";

    const badge = (() => {
        if (row.di_kirim) return { label: "Di Kirim", bg: "#DCFCE7", color: "#15803D" };
        if (row.siap_kirim) return { label: "Siap Kirim", bg: "#DBEAFE", color: "#1D4ED8" };
        if (row.di_warna) return { label: "Di Warna", bg: "#FEF9C3", color: "#A16207" };
        if (row.di_produksi) return { label: "Di Produksi", bg: "#FFE4E6", color: "#BE123C" };
        return { label: "Belum", bg: "#F3F4F6", color: "#6B7280" };
    })();

    const isEditing = (key: string) => activeCell?.id === row.id && activeCell?.key === key;

    const renderCell = (key: keyof PesananRow, width: number, options: any = {}) => (
        <StatusCell
            value={row[key] as any}
            width={width}
            isEditing={isEditing(key)}
            onEdit={() => setActiveCell({ id: row.id, key })}
            onBlur={() => setActiveCell(null)}
            onSave={(v) => onUpdate(row.id, { [key]: v })}
            {...options}
        />
    );

    const renderCheck = (key: keyof PesananRow, width: number) => {
        const handleCheckUpdate = (checked: boolean) => {
            const patch: Partial<PesananRow> = { [key]: checked };
            
            // Cascading logic for production pipeline
            if (checked) {
                if (key === "di_kirim") {
                    patch.siap_kirim = true;
                    patch.di_warna = true;
                    patch.di_produksi = true;
                } else if (key === "siap_kirim") {
                    patch.di_warna = true;
                    patch.di_produksi = true;
                } else if (key === "di_warna") {
                    patch.di_produksi = true;
                }
            } else {
                if (key === "di_produksi") {
                    patch.di_warna = false;
                    patch.siap_kirim = false;
                    patch.di_kirim = false;
                } else if (key === "di_warna") {
                    patch.siap_kirim = false;
                    patch.di_kirim = false;
                } else if (key === "siap_kirim") {
                    patch.di_kirim = false;
                }
            }
            onUpdate(row.id, patch);
        };

        return (
            <td style={{ 
                height: 26, width, minWidth: width, textAlign: "center", 
                verticalAlign: "middle", borderRight: "1px solid #E6D5BE", 
                borderBottom: "1px solid #E6D5BE", boxSizing: "border-box" 
            }}>
                <input
                    type="checkbox"
                    checked={!!row[key]}
                    onChange={(e) => handleCheckUpdate(e.target.checked)}
                    style={{ accentColor: "#A67B5B", width: 14, height: 14, cursor: "pointer" }}
                />
            </td>
        );
    };

    return (
        <tr style={{ background: rowBg }}>
            {/* No */}
            <td style={{ height: 26, textAlign: "center", fontSize: 10, color: "#B89678", fontWeight: 600, background: "#F8F4EE", borderRight: "2px solid #C5A882", borderBottom: "1px solid #E6D5BE", position: "sticky", left: 0, zIndex: 1, width: 36 }}>
                {idx + 1}
            </td>

            {/* 🎨 Color picker */}
            <td style={{ height: 26, width: 30, textAlign: "center", verticalAlign: "middle", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", position: "relative" }}>
                <div onClick={() => setColorRowId(colorRowId === row.id ? null : row.id)}
                    style={{ width: 14, height: 14, borderRadius: 3, margin: "0 auto", background: row.color_marker || "#fff", border: "1px solid #C5A882", cursor: "pointer" }} />
                {colorRowId === row.id && (
                    <div style={{ position: "absolute", top: 22, left: -5, zIndex: 100, background: "white", border: "1px solid #D1BFA3", borderRadius: 8, padding: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.15)", display: "flex", flexWrap: "wrap", gap: 5, width: 130 }}>
                        {ROW_COLORS.map((c) => (
                            <div key={c.value} title={c.label}
                                onClick={(e) => { e.stopPropagation(); onUpdate(row.id, { color_marker: c.value }); setColorRowId(null); }}
                                style={{ width: 26, height: 26, borderRadius: 5, background: c.value || "#fff", border: "1px solid #E6D5BE", cursor: "pointer" }} />
                        ))}
                    </div>
                )}
            </td>

            {renderCell("tanggal", 70, { align: "center", type: "date" })}
            {renderCell("customer", 130)}
            {renderCell("deskripsi", 200)}
            {renderCell("ukuran", 60, { align: "center" })}
            {renderCell("qty", 44, { align: "center" })}

            {viewMode === "detail" && <>
                {renderCell("no_inv", 90, { mono: true })}
                {renderCell("harga", 115, { align: "center" })}
                <td style={{ height: 26, width: 130, minWidth: 130, padding: "2px 5px", boxSizing: "border-box", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontSize: 11, textAlign: "right", fontWeight: 700, background: "#FAF7F3", color: "#5C4033" }}>
                    {(() => {
                        const uk = parseFloat(String(row.ukuran || "0").replace(",", "."));
                        const qty = parseFloat(String(row.qty || "0").replace(",", "."));
                        const hr = parseFloat(String(row.harga || "0").replace(",", "."));
                        const total = (isNaN(uk) ? 0 : uk) * (isNaN(qty) ? 0 : qty) * (isNaN(hr) ? 0 : hr);
                        return total > 0 ? total.toLocaleString("id-ID") : "—";
                    })()}
                </td>
            </>}

            {renderCheck("di_produksi", 62)}
            {renderCheck("di_warna", 52)}
            {renderCheck("siap_kirim", 48)}
            {renderCheck("di_kirim", 48)}
            {renderCheck("is_paid", 54)}

            {viewMode === "detail" && renderCell("ekspedisi", 110)}

            {/* Status badge */}
            <td style={{ height: 26, width: 80, textAlign: "center", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE" }}>
                <span style={{ background: badge.bg, color: badge.color, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>
                    {badge.label}
                </span>
            </td>
        </tr>
    );
}, (prev, next) => {
    // Optimistic Update support: check the whole row reference
    // because useStatusBarangRows creates a new object for updated row.
    return (
        prev.row === next.row &&
        prev.viewMode === next.viewMode &&
        prev.colorRowId === next.colorRowId &&
        prev.activeCell?.id === next.activeCell?.id &&
        prev.activeCell?.key === next.activeCell?.key
    );
});
