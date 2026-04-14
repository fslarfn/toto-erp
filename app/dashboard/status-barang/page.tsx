"use client";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePesanan, PesananRow, isRowFilled } from "@/lib/pesanan-store";
import * as XLSX from "xlsx";

/* ================================================================
   STATUS BARANG — sumber dari Input Pesanan
   Kolom persis seperti referensi toto-backend:
   # | 🎨 | Tanggal | Customer | Deskripsi | Ukuran | Qty |
   No Inv | No SJ | Produksi✓ | Warna✓ | Siap✓ | Kirim✓ | Ekspedisi
================================================================ */

const ROW_COLORS = [
    { label: "Bersih", value: "" },
    { label: "Merah", value: "#FFCDD2" },
    { label: "Kuning", value: "#FFF9C4" },
    { label: "Hijau", value: "#C8E6C9" },
    { label: "Biru", value: "#BBDEFB" },
    { label: "Ungu", value: "#E1BEE7" },
    { label: "Oranye", value: "#FFE0B2" },
];

const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

type Pos = { r: number; c: number };
type Sel = { start: Pos; end: Pos };

/* Editable kolom-kolom di status barang */
type EditCol = "no_inv" | "no_sj" | "ekspedisi";
const EDIT_COL_KEYS: EditCol[] = ["no_inv", "no_sj", "ekspedisi"];

function normSel(sel: Sel) {
    return { r1: Math.min(sel.start.r, sel.end.r), r2: Math.max(sel.start.r, sel.end.r), c1: Math.min(sel.start.c, sel.end.c), c2: Math.max(sel.start.c, sel.end.c) };
}

/* ── Inline text input cell (for No Inv / No SJ / Ekspedisi) ── */
function InlineCell({ value, onChange, width, align = "left", mono = false }: {
    value: string; onChange: (v: string) => void; width: number; align?: "left" | "center"; mono?: boolean;
}) {
    const [local, setLocal] = useState(value);
    const [isFocused, setIsFocused] = useState(false);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Sinkronisasi prop value ke local state hanya jika tidak sedang fokus
    useEffect(() => {
        if (!isFocused) setLocal(value);
    }, [value, isFocused]);

    const handleChange = (v: string) => {
        setLocal(v);
        // Debounce reporting to parent
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
            if (v !== value) onChange(v);
        }, 500);
    };

    const handleBlur = () => {
        setIsFocused(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (local !== value) onChange(local);
    };

    return (
        <td style={{
            height: 26, width, minWidth: width, padding: 0, boxSizing: "border-box",
            borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE",
            background: isFocused ? "#fffbf0" : "inherit",
            outline: isFocused ? "2px solid #A67B5B" : "none", outlineOffset: -2,
        }}>
            <input
                type="text" value={local}
                onChange={(e) => handleChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={handleBlur}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        (e.target as HTMLInputElement).blur();
                    }
                }}
                style={{ width: "100%", height: "100%", border: "none", outline: "none", background: "transparent", padding: "2px 5px", fontSize: 11, fontFamily: mono ? "monospace" : "inherit", textAlign: align, color: "#3C2F2F", boxSizing: "border-box" }}
            />
        </td>
    );
}

/* ── Checkbox cell ───────────────────────────────────────────── */
function CheckCell({ checked, onChange, width = 54 }: { checked: boolean; onChange: (v: boolean) => void; width?: number }) {
    return (
        <td style={{ height: 26, width, minWidth: width, textAlign: "center", verticalAlign: "middle", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", boxSizing: "border-box" }}>
            <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)}
                style={{ accentColor: "#A67B5B", width: 14, height: 14, cursor: "pointer" }} />
        </td>
    );
}

/* ── Read-only cell ──────────────────────────────────────────── */
function ROCell({ children, width, align = "left", bold = false, style: extraStyle = {} }: {
    children: React.ReactNode; width: number; align?: "left" | "center" | "right"; bold?: boolean; style?: React.CSSProperties;
}) {
    return (
        <td style={{ height: 26, width, minWidth: width, padding: "2px 5px", boxSizing: "border-box", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", fontSize: 11, textAlign: align, fontWeight: bold ? 700 : 400, color: "#3C2F2F", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", ...extraStyle }}>
            {children}
        </td>
    );
}

const fmtDate = (d: string) => {
    if (!d) return "";
    const p = d.split("-");
    return p.length === 3 ? `${p[2]}/${p[1]}` : d; // dd/mm
};

/**
 * Parse angka format Indonesia:
 * - Titik sebagai pemisah ribuan: "230.000" → 230000
 * - Koma sebagai pemisah desimal: "1,7" → 1.7
 * - Mix: "1.700,5" → 1700.5
 */
function parseIdNum(s: string): number {
    if (!s) return 0;
    const str = s.trim();
    // Jika ada koma → koma adalah desimal, titik adalah ribuan
    if (str.includes(",")) {
        return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    }
    // Tidak ada koma:
    // Jika titik diikuti tepat 3 digit di akhir → ribuan (e.g. "230.000")
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) {
        return parseFloat(str.replace(/\./g, "")) || 0;
    }
    // Titik sebagai desimal biasa (e.g. "1.7")
    return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

/* ── StatusTable Component (memoized) ────────────────────────── */
function StatusTable({ filtered, viewMode, colorRowId, setColorRowId, update, statusBadge, th }: {
    filtered: PesananRow[];
    viewMode: "detail" | "simple";
    colorRowId: number | null;
    setColorRowId: (id: number | null) => void;
    update: (id: number, patch: Partial<PesananRow>) => void;
    statusBadge: (row: PesananRow) => { label: string; bg: string; color: string };
    th: (w: number, left?: boolean) => React.CSSProperties;
}) {
    return (
        <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 11, tableLayout: "fixed" }}>
            <thead>
                <tr>
                    <th style={{ ...th(36), position: "sticky", left: 0, zIndex: 20, borderRight: "2px solid #C5A882" }}>#</th>
                    <th style={{ ...th(30) }}>🎨</th>
                    <th style={{ ...th(70) }}>Tgl</th>
                    <th style={{ ...th(130), textAlign: "left" }}>Customer</th>
                    <th style={{ ...th(200), textAlign: "left" }}>Deskripsi</th>
                    <th style={{ ...th(60) }}>Ukuran</th>
                    <th style={{ ...th(44) }}>Qty</th>
                    {viewMode === "detail" && <>
                        <th style={{ ...th(90) }}>No Invoice</th>
                        <th style={{ ...th(115), textAlign: "right" }}>Harga (Rp)</th>
                        <th style={{ ...th(130), textAlign: "right" }}>Total Harga (Rp)</th>
                    </>}
                    <th style={{ ...th(62) }}>Produksi</th>
                    <th style={{ ...th(52) }}>Warna</th>
                    <th style={{ ...th(48) }}>Siap</th>
                    <th style={{ ...th(48) }}>Kirim</th>
                    <th style={{ ...th(54) }}>💰 Bayar</th>
                    {viewMode === "detail" && <th style={{ ...th(110), textAlign: "left" }}>Ekspedisi</th>}
                    <th style={{ ...th(80) }}>Status</th>
                </tr>
            </thead>
            <tbody>
                {filtered.map((row, idx) => {
                    const rowBg = row.color_marker || "white";
                    const badge = statusBadge(row);
                    return (
                        <tr key={row.id} style={{ background: rowBg }}>
                            {/* No — frozen */}
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
                                                onClick={(e) => { e.stopPropagation(); update(row.id, { color_marker: c.value }); setColorRowId(null); }}
                                                style={{ width: 26, height: 26, borderRadius: 5, background: c.value || "#fff", border: "1px solid #E6D5BE", cursor: "pointer" }} />
                                        ))}
                                    </div>
                                )}
                            </td>

                            <InlineCell value={row.tanggal} onChange={(v) => update(row.id, { tanggal: v })} width={70} align="center" />
                            <InlineCell value={row.customer} onChange={(v) => update(row.id, { customer: v })} width={130} />
                            <InlineCell value={row.deskripsi} onChange={(v) => update(row.id, { deskripsi: v })} width={200} />
                            <InlineCell value={row.ukuran} onChange={(v) => update(row.id, { ukuran: v })} width={60} align="center" />
                            <InlineCell value={row.qty} onChange={(v) => update(row.id, { qty: v })} width={44} align="center" />

                            {viewMode === "detail" && <>
                                <InlineCell value={row.no_inv} onChange={(v) => update(row.id, { no_inv: v })} width={90} mono />
                                <InlineCell value={row.harga} onChange={(v) => update(row.id, { harga: v })} width={115} align="center" />
                                {(() => {
                                    const ukuran = parseIdNum(row.ukuran);
                                    const qty = parseIdNum(row.qty);
                                    const harga = parseIdNum(row.harga);
                                    const total = ukuran * qty * harga;
                                    return (
                                        <ROCell width={130} align="right" bold style={{ color: total > 0 ? "#5C4033" : "#C5A882", background: "#FAF7F3" }}>
                                            {total > 0 ? total.toLocaleString("id-ID") : "—"}
                                        </ROCell>
                                    );
                                })()}
                            </>}

                            <CheckCell checked={row.di_produksi} onChange={(v) => update(row.id, { di_produksi: v })} width={62} />
                            <CheckCell checked={row.di_warna} onChange={(v) => update(row.id, { di_warna: v })} width={52} />
                            <CheckCell checked={row.siap_kirim} onChange={(v) => update(row.id, { siap_kirim: v })} width={48} />
                            <CheckCell checked={row.di_kirim} onChange={(v) => update(row.id, { di_kirim: v })} width={48} />
                            <CheckCell checked={row.is_paid} onChange={(v) => update(row.id, { is_paid: v })} width={54} />

                            {viewMode === "detail" && <InlineCell value={row.ekspedisi} onChange={(v) => update(row.id, { ekspedisi: v })} width={110} />}

                            {/* Status badge */}
                            <td style={{ height: 26, width: 80, textAlign: "center", verticalAlign: "middle", borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE", padding: "0 4px" }}>
                                <span style={{ background: badge.bg, color: badge.color, borderRadius: 99, padding: "1px 8px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>
                                    {badge.label}
                                </span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}

/* ================================================================
   MAIN PAGE
================================================================ */
export default function StatusBarangPage() {
    const { rows, loading, updateRow, importRows, flushRow } = usePesanan();

    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [autoDetected, setAutoDetected] = useState(false);

    // Auto-detect: if current month has no data but other months do, switch to latest
    useEffect(() => {
        if (autoDetected || loading || rows.length === 0) return;
        const filledRows = rows.filter(r => r.tanggal && (r.customer || r.deskripsi));
        if (filledRows.length === 0) return;

        // Check if current month has data
        const currentMonthHasData = filledRows.some(r => {
            const y = parseInt(r.tanggal.slice(0, 4));
            const m = parseInt(r.tanggal.slice(5, 7));
            return y === year && m === month;
        });

        if (!currentMonthHasData) {
            // Find the latest period in the data
            let latestDate = "";
            filledRows.forEach(r => { if (r.tanggal > latestDate) latestDate = r.tanggal; });
            if (latestDate) {
                setYear(parseInt(latestDate.slice(0, 4)));
                setMonth(parseInt(latestDate.slice(5, 7)));
            }
        }
        setAutoDetected(true);
    }, [rows, loading, autoDetected, month, year]);
    const [search, setSearch] = useState("");
    const [viewMode, setViewMode] = useState<"detail" | "simple">("detail");
    const [colorRowId, setColorRowId] = useState<number | null>(null);
    const [savedFlash, setSavedFlash] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    /* ── Import state ─────────────────────────────────────────── */
    const [importModal, setImportModal] = useState(false);
    const [importPreview, setImportPreview] = useState<Partial<PesananRow>[]>([]);
    const [importCount, setImportCount] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    /* ── Column name aliases (case-insensitive) ───────────────── */
    const COL_MAP: Record<string, keyof PesananRow> = {
        tanggal: "tanggal", date: "tanggal", tgl: "tanggal",
        customer: "customer", "nama customer": "customer", pelanggan: "customer", nama: "customer",
        deskripsi: "deskripsi", description: "deskripsi", keterangan: "deskripsi", barang: "deskripsi",
        ukuran: "ukuran", size: "ukuran", uk: "ukuran",
        qty: "qty", jumlah: "qty", quantity: "qty",
        harga: "harga", price: "harga", "harga satuan": "harga",
        "no inv": "no_inv", "no invoice": "no_inv", invoice: "no_inv", inv: "no_inv", noinv: "no_inv",
        "no sj": "no_sj", "surat jalan": "no_sj",
        "di produksi": "di_produksi", produksi: "di_produksi",
        "di warna": "di_warna", warna: "di_warna",
        "siap kirim": "siap_kirim", siap: "siap_kirim",
        "di kirim": "di_kirim", kirim: "di_kirim",
        ekspedisi: "ekspedisi", ekspedisi2: "ekspedisi", courier: "ekspedisi", pengiriman: "ekspedisi",
        "pembayaran": "is_paid", bayar: "is_paid", lunas: "is_paid", paid: "is_paid",
    };

    const parseBool = (v: unknown): boolean => {
        if (typeof v === "boolean") return v;
        const s = String(v).trim().toLowerCase();
        return ["true", "1", "ya", "yes", "✓", "v", "x"].includes(s);
    };

    const parseDate = (v: unknown): string => {
        if (!v) return "";
        // Excel serial number
        if (typeof v === "number") {
            const d = new Date(Math.round((v - 25569) * 86400 * 1000));
            return d.toISOString().slice(0, 10);
        }
        const s = String(v).trim();
        // dd/mm/yyyy or dd-mm-yyyy
        const m = s.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/);
        if (m) {
            const yy = m[3].length === 2 ? "20" + m[3] : m[3];
            return `${yy}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
        }
        return s;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const wb = XLSX.read(ev.target?.result, { type: "array" });

            // ── Cari sheet terbaik: hitung berapa header yang cocok ──
            let bestSheet = wb.SheetNames[0];
            let bestScore = -1;
            let bestRaw: Record<string, unknown>[] = [];
            let bestHeaderMap: Record<string, keyof PesananRow> = {};

            wb.SheetNames.forEach(name => {
                const ws = wb.Sheets[name];
                const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
                if (raw.length === 0) return;
                const firstRow = raw[0];
                const hMap: Record<string, keyof PesananRow> = {};
                Object.keys(firstRow).forEach(h => {
                    const mapped = COL_MAP[h.toLowerCase().trim()];
                    if (mapped) hMap[h] = mapped;
                });
                const score = Object.keys(hMap).length;
                if (score > bestScore) {
                    bestScore = score;
                    bestSheet = name;
                    bestRaw = raw;
                    bestHeaderMap = hMap;
                }
            });

            if (bestScore === 0) {
                alert("Tidak ditemukan kolom yang cocok di file ini.\nPastikan baris header mengandung: tanggal, customer, deskripsi, ukuran, qty, harga, dll.");
                return;
            }

            const parsed: Partial<PesananRow>[] = bestRaw
                .filter(r => Object.values(r).some(v => v !== "" && v !== null && v !== undefined))
                .map(r => {
                    const row: Partial<PesananRow> = {};
                    Object.entries(bestHeaderMap).forEach(([excelCol, storeKey]) => {
                        const val = r[excelCol];
                        const boolFields: (keyof PesananRow)[] = ["di_produksi", "di_warna", "siap_kirim", "di_kirim", "is_paid", "is_packing"];
                        if (boolFields.includes(storeKey)) {
                            (row as Record<string, unknown>)[storeKey] = parseBool(val);
                        } else if (storeKey === "tanggal") {
                            row.tanggal = parseDate(val);
                        } else {
                            // Harga & qty: simpan sebagai string, tapi bersihkan dari format ribu
                            const s = val !== undefined && val !== null ? String(val) : "";
                            (row as Record<string, unknown>)[storeKey] = s;
                        }
                    });
                    return row;
                })
                .filter(r => r.customer || r.deskripsi); // skip baris kosong

            setImportCount(parsed.length);
            setImportPreview(parsed.slice(0, 5));
            setImportModal(true);
            (window as unknown as Record<string, unknown>).__importParsed = parsed;
            (window as unknown as Record<string, unknown>).__importSheet = bestSheet;
        };
        reader.readAsArrayBuffer(file);
        e.target.value = "";
    };

    const doImport = () => {
        const parsed = (window as unknown as Record<string, unknown>).__importParsed as Partial<PesananRow>[];
        if (!parsed) return;
        importRows(parsed);
        setImportModal(false);
        setSavedFlash(true);
        setTimeout(() => setSavedFlash(false), 2500);
    };

    /* ── filter: only rows that have data AND match month/year ── */
    const filtered = useMemo(() => rows.filter((row) => {
        if (!isRowFilled(row)) return false;
        const d = row.tanggal;
        const matchDate = !d || (parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month);
        const q = search.toLowerCase();
        const matchSearch = !q || [row.customer, row.deskripsi, row.no_inv].join(" ").toLowerCase().includes(q);
        // Status filter
        if (statusFilter) {
            if (statusFilter === "belum" && row.di_produksi) return false;
            if (statusFilter === "produksi" && (!row.di_produksi || row.di_warna)) return false;
            if (statusFilter === "warna" && (!row.di_warna || row.siap_kirim)) return false;
            if (statusFilter === "siap" && (!row.siap_kirim || row.di_kirim)) return false;
            if (statusFilter === "kirim" && !row.di_kirim) return false;
        }
        return matchDate && matchSearch;
    }), [rows, year, month, search, statusFilter]);

    /* status counts — memoized */
    const counts = useMemo(() => {
        const base = rows.filter((row) => {
            if (!isRowFilled(row)) return false;
            const d = row.tanggal;
            return !d || (parseInt(d.slice(0, 4)) === year && parseInt(d.slice(5, 7)) === month);
        });
        return {
            belum: base.filter((r) => !r.di_produksi).length,
            produksi: base.filter((r) => r.di_produksi && !r.di_warna).length,
            warna: base.filter((r) => r.di_warna && !r.siap_kirim).length,
            siap: base.filter((r) => r.siap_kirim && !r.di_kirim).length,
            kirim: base.filter((r) => r.di_kirim).length,
        };
    }, [rows, year, month]);

    const flashSaved = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 2000); };

    const update = (id: number, patch: Partial<PesananRow>) => {
        updateRow(id, patch, true);
        flashSaved();
    };

    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);

    const exportExcel = () => {
        const data = filtered.map((r, i) => {
            const ukuran = parseIdNum(r.ukuran);
            const qty = parseIdNum(r.qty);
            const harga = parseIdNum(r.harga);
            const total = ukuran * qty * harga;
            return {
                "No": i + 1, "Tanggal": r.tanggal, "Customer": r.customer,
                "Deskripsi": r.deskripsi, "Ukuran": r.ukuran, "Qty": r.qty,
                "Harga": harga, "Total": total,
                "No Invoice": r.no_inv,
                "Di Produksi": r.di_produksi ? "✓" : "",
                "Di Warna": r.di_warna ? "✓" : "",
                "Siap Kirim": r.siap_kirim ? "✓" : "",
                "Di Kirim": r.di_kirim ? "✓" : "",
                "Lunas": r.is_paid ? "✓" : "",
                "Ekspedisi": r.ekspedisi,
            };
        });
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Status Barang");
        XLSX.writeFile(wb, `status-barang-${year}-${String(month).padStart(2, "0")}.xlsx`);
    };

    /* ── header th style ─────────────────────────────────────── */
    const th = (w: number, left = false): React.CSSProperties => ({
        background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11,
        padding: "5px 5px", borderRight: "1px solid #D1BFA3", borderBottom: "2px solid #C5A882",
        whiteSpace: "nowrap", position: "sticky", top: 0, zIndex: 10, userSelect: "none",
        textAlign: left ? "left" : "center", width: w, minWidth: w,
    });

    /* ── color badge for status ──────────────────────────────── */
    const statusBadge = (row: PesananRow) => {
        if (row.di_kirim) return { label: "Di Kirim", bg: "#DCFCE7", color: "#15803D" };
        if (row.siap_kirim) return { label: "Siap Kirim", bg: "#DBEAFE", color: "#1D4ED8" };
        if (row.di_warna) return { label: "Di Warna", bg: "#FEF9C3", color: "#A16207" };
        if (row.di_produksi) return { label: "Di Produksi", bg: "#FFE4E6", color: "#BE123C" };
        return { label: "Belum", bg: "#F3F4F6", color: "#6B7280" };
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", background: "#F5EBDD" }}>

            {/* ── Toolbar ──────────────────────────────────────────── */}
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0 }}>

                {/* Title + save flash */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#5C4033" }}>Status Barang</span>
                    <div style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 99, background: savedFlash ? "#DCFCE7" : "transparent", color: savedFlash ? "#15803D" : "transparent", transition: "all 0.3s" }}>
                        ✓ Tersimpan
                    </div>
                </div>

                {/* View toggle */}
                <div style={{ background: "#F3F4F6", borderRadius: 7, padding: 2, display: "flex", fontSize: 11, marginLeft: 4 }}>
                    {(["detail", "simple"] as const).map((m) => (
                        <button key={m} onClick={() => setViewMode(m)}
                            style={{
                                padding: "3px 12px", borderRadius: 5, border: "none", cursor: "pointer", fontWeight: 600,
                                background: viewMode === m ? "#A67B5B" : "transparent", color: viewMode === m ? "white" : "#5C4033"
                            }}>
                            {m === "detail" ? "Full View" : "Simple View"}
                        </button>
                    ))}
                </div>

                {/* Month/Year filter */}
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                    <select value={month} onChange={(e) => setMonth(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 7px", fontSize: 11, color: "#5C4033", background: "#FFFBF7", height: 28 }}>
                        {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 7px", fontSize: 11, color: "#5C4033", background: "#FFFBF7", height: 28 }}>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                {/* Search */}
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari customer / deskripsi..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "3px 8px", fontSize: 11, width: 200, height: 28, color: "#5C4033", background: "#FFFBF7" }} />

                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button onClick={() => fileInputRef.current?.click()}
                        style={{ border: "1px solid #A67B5B", borderRadius: 5, padding: "4px 12px", fontSize: 11, background: "#FEF3E8", color: "#A67B5B", cursor: "pointer", fontWeight: 700 }}>
                        📥 Import Excel
                    </button>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileChange} />
                    <button onClick={exportExcel}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 12px", fontSize: 11, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 }}>
                        ⬇ Excel
                    </button>
                </div>
            </div>

            {/* ── Status counter pills (clickable filter) ────────── */}
            <div style={{ display: "flex", gap: 6, padding: "6px 12px", background: "#FAF7F3", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                {[
                    { key: "belum", label: "Belum", count: counts.belum, bg: "#F3F4F6", color: "#6B7280" },
                    { key: "produksi", label: "Di Produksi", count: counts.produksi, bg: "#FFE4E6", color: "#BE123C" },
                    { key: "warna", label: "Di Warna", count: counts.warna, bg: "#FEF9C3", color: "#A16207" },
                    { key: "siap", label: "Siap Kirim", count: counts.siap, bg: "#DBEAFE", color: "#1D4ED8" },
                    { key: "kirim", label: "Di Kirim", count: counts.kirim, bg: "#DCFCE7", color: "#15803D" },
                ].map((s) => (
                    <div key={s.key}
                        onClick={() => setStatusFilter(statusFilter === s.key ? null : s.key)}
                        style={{
                            background: s.bg, color: s.color, borderRadius: 99, padding: "2px 12px",
                            fontSize: 11, fontWeight: 700, cursor: "pointer", userSelect: "none",
                            outline: statusFilter === s.key ? `2px solid ${s.color}` : "none",
                            outlineOffset: 1, transition: "all 0.15s",
                        }}>
                        {s.label}: <span>{s.count}</span>
                    </div>
                ))}
                <div style={{ marginLeft: "auto", fontSize: 11, color: "#B89678", alignSelf: "center" }}>
                    {filtered.length} item {MONTH_NAMES[month - 1]} {year}
                    {statusFilter && <span style={{ marginLeft: 6, color: "#A67B5B", fontWeight: 600 }}>· Filter aktif <span onClick={() => setStatusFilter(null)} style={{ cursor: "pointer", textDecoration: "underline" }}>✕ Reset</span></span>}
                </div>
            </div>

            {/* ── Spreadsheet table ─────────────────────────────────── */}
            <div style={{ flex: 1, overflow: "auto", background: "white" }}>
                {filtered.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60%", color: "#C5A882", fontSize: 13 }}>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                        <div style={{ fontWeight: 700 }}>Tidak ada pesanan di {MONTH_NAMES[month - 1]} {year}</div>
                        <div style={{ fontSize: 11, marginTop: 4 }}>Tambah data dulu di menu <strong>Input Pesanan</strong></div>
                    </div>
                ) : (
                    <StatusTable
                        filtered={filtered}
                        viewMode={viewMode}
                        colorRowId={colorRowId}
                        setColorRowId={setColorRowId}
                        update={update}
                        statusBadge={statusBadge}
                        th={th}
                    />
                )}
            </div>

            {/* Close color picker on outside click */}
            {colorRowId !== null && (
                <div style={{ position: "fixed", inset: 0, zIndex: 50 }} onClick={() => setColorRowId(null)} />
            )}

            {/* ── Import Modal ──────────────────────────────────────── */}
            {importModal && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ background: "white", borderRadius: 12, padding: 24, width: "min(90vw, 700px)", maxHeight: "80vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                            <div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#3C2F2F" }}>📥 Konfirmasi Import</div>
                                <div style={{ fontSize: 12, color: "#B89678", marginTop: 2 }}>
                                    Sheet: <strong style={{ color: "#5C4033" }}>{String((window as unknown as Record<string, unknown>).__importSheet ?? "")}</strong>
                                    {" — "}Ditemukan <strong style={{ color: "#A67B5B" }}>{importCount} baris</strong> data — semua data lama akan diganti
                                </div>
                            </div>
                            <button onClick={() => setImportModal(false)}
                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#B89678" }}>✕</button>
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: "#5C4033", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Preview 5 baris pertama:</div>
                        <div style={{ overflowX: "auto", border: "1px solid #E6D5BE", borderRadius: 8 }}>
                            <table style={{ borderCollapse: "collapse", fontSize: 11, width: "max-content", minWidth: "100%" }}>
                                <thead>
                                    <tr>
                                        {["Tgl", "Customer", "No Inv", "Deskripsi", "UK", "Qty", "Harga", "Prod", "Warna", "Siap", "Kirim", "Bayar"].map(h => (
                                            <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", padding: "5px 8px", fontWeight: 700, borderRight: "1px solid #D1BFA3", whiteSpace: "nowrap" }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {importPreview.map((r, i) => (
                                        <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#FAF7F3" }}>
                                            {(["tanggal", "customer", "no_inv", "deskripsi", "ukuran", "qty", "harga"] as (keyof PesananRow)[]).map(k => (
                                                <td key={k} style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                                    {String(r[k] ?? "—")}
                                                </td>
                                            ))}
                                            {(["di_produksi", "di_warna", "siap_kirim", "di_kirim", "is_paid"] as (keyof PesananRow)[]).map(k => (
                                                <td key={k} style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE" }}>
                                                    {r[k] ? "✓" : ""}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
                            <button onClick={() => setImportModal(false)}
                                style={{ padding: "8px 20px", borderRadius: 7, border: "1px solid #D1BFA3", background: "white", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#5C4033" }}>
                                Batal
                            </button>
                            <button onClick={doImport}
                                style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#A67B5B", color: "white", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                                ✓ Import {importCount} Baris
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
