"use client";
import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { usePesanan, PAGE_SIZE, EMPTY_BUFFER, PesananRow, isRowFilled } from "@/lib/pesanan-store";
import * as XLSX from "xlsx";

type ColKey = "tanggal" | "customer" | "deskripsi" | "ukuran" | "qty";
const COL_KEYS: ColKey[] = ["tanggal", "customer", "deskripsi", "ukuran", "qty"];
const COL_LABELS = ["Tanggal", "Nama Customer", "Deskripsi Pesanan", "Ukuran", "Qty"];

type Pos = { r: number; c: number };
type Sel = { start: Pos; end: Pos };

function normSel(sel: Sel) {
    return {
        r1: Math.min(sel.start.r, sel.end.r),
        r2: Math.max(sel.start.r, sel.end.r),
        c1: Math.min(sel.start.c, sel.end.c),
        c2: Math.max(sel.start.c, sel.end.c),
    };
}

/* ── Memoized Row Component ─────────────────────────────────── */
const TableRow = memo(function TableRow({
    row, ri, active, selBounds, isFilling, fillEndRow,
    onMouseDown, onMouseEnter, onFocus, onChange, onPaste,
    onFillHandleMouseDown, inputRefSetter,
}: {
    row: PesananRow; ri: number;
    active: Pos | null; selBounds: ReturnType<typeof normSel> | null;
    isFilling: boolean; fillEndRow: number | null;
    onMouseDown: (r: number, c: number, e: React.MouseEvent) => void;
    onMouseEnter: (r: number, c: number) => void;
    onFocus: (r: number, c: number) => void;
    onChange: (id: number, key: ColKey, val: string) => void;
    onPaste: (e: React.ClipboardEvent, r: number, c: number) => void;
    onFillHandleMouseDown: (e: React.MouseEvent) => void;
    inputRefSetter: (ri: number, ci: number, el: HTMLInputElement | null) => void;
}) {
    const isFilled = row.customer || row.deskripsi;
    const isFillRow = isFilling && selBounds && ri > selBounds.r2 && fillEndRow !== null && ri <= fillEndRow;
    const bg = isFillRow ? "#dbeafe" : isFilled ? "white" : "#FAFAF8";

    return (
        <tr style={{ background: bg }}>
            <td style={{
                height: 28, textAlign: "center", fontSize: 11, color: "#B89678", fontWeight: 600,
                background: "#F8F4EE", borderRight: "2px solid #C5A882", borderBottom: "1px solid #E6D5BE",
                userSelect: "none", padding: "2px 4px",
            }}>
                {row.id}
            </td>
            {COL_KEYS.map((key, ci) => {
                const isActive = active?.r === ri && active?.c === ci;
                const isSel = selBounds ? ri >= selBounds.r1 && ri <= selBounds.r2 && ci >= selBounds.c1 && ci <= selBounds.c2 : false;
                const isFillHandle = selBounds && ri === selBounds.r2 && ci === selBounds.c2;
                return (
                    <td key={key}
                        style={{
                            height: 28, padding: 0, boxSizing: "border-box",
                            borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE",
                            position: "relative",
                            background: isSel ? (isActive ? "white" : "#DAE8FC") : "transparent",
                            outline: isActive ? "2px solid #A67B5B" : isSel ? "1px solid #6CAAE0" : "none",
                            outlineOffset: isActive ? -2 : -1,
                        }}
                        onMouseDown={(e) => onMouseDown(ri, ci, e)}
                        onMouseEnter={() => onMouseEnter(ri, ci)}>
                        <input
                            ref={(el) => inputRefSetter(ri, ci, el)}
                            type={key === "tanggal" ? "date" : "text"}
                            inputMode={key === "qty" || key === "ukuran" ? "decimal" : "text"}
                            value={row[key] as string}
                            onChange={(e) => onChange(row.id, key, e.target.value)}
                            onPaste={(e) => onPaste(e, ri, ci)}
                            onFocus={() => onFocus(ri, ci)}
                            placeholder={key === "customer" ? "Nama customer..." : key === "deskripsi" ? "Deskripsi pesanan..." : key === "ukuran" ? "cth: 1,9" : key === "qty" ? "0" : ""}
                            style={{
                                width: "100%", height: "100%", border: "none", outline: "none",
                                background: "transparent", padding: "3px 6px", fontSize: 12,
                                color: "#3C2F2F", fontFamily: "inherit",
                                textAlign: key === "qty" || key === "ukuran" ? "center" : "left",
                                boxSizing: "border-box", cursor: "default", userSelect: "text",
                            }}
                        />
                        {isFillHandle && (
                            <div onMouseDown={onFillHandleMouseDown}
                                style={{
                                    position: "absolute", bottom: -4, right: -4, width: 8, height: 8,
                                    borderRadius: 1, background: "#1a73e8", border: "1px solid white",
                                    cursor: "crosshair", zIndex: 20,
                                }} />
                        )}
                    </td>
                );
            })}
        </tr>
    );
});

/* ================================================================
   MAIN PAGE
================================================================ */
export default function PesananPage() {
    const { rows, loading, updateRow, resetRows, addRows } = usePesanan();
    const [active, setActive] = useState<Pos | null>(null);
    const [sel, setSel] = useState<Sel | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isFilling, setIsFilling] = useState(false);
    const [fillEndRow, setFillEndRow] = useState<number | null>(null);

    // View state: "input" = default (last data + empty), "browse" = paginated history
    const [viewMode, setViewMode] = useState<"input" | "browse">("input");
    const [browsePage, setBrowsePage] = useState(1);
    const [inputStartIdx, setInputStartIdx] = useState<number | null>(null);

    const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);

    const now = new Date();
    const [month, setMonth] = useState<number | "all">(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const years: number[] = [];
    for (let y = 2023; y <= now.getFullYear() + 1; y++) years.push(y);
    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

    /* ── Computed data ─────────────────────────────────────── */
    const filteredRows = useMemo(() => {
        return rows.filter(r => {
            if (!isRowFilled(r)) return true;
            if (!r.tanggal) return true;
            const y = parseInt(r.tanggal.slice(0, 4));
            if (y !== year) return false;
            if (month !== "all") {
                const m = parseInt(r.tanggal.slice(5, 7));
                if (m !== month) return false;
            }
            return true;
        });
    }, [rows, year, month]);

    const lastFilledIdx = useMemo(() => {
        for (let i = filteredRows.length - 1; i >= 0; i--) {
            if (isRowFilled(filteredRows[i])) return i;
        }
        return -1;
    }, [filteredRows]);

    const filledCount = useMemo(() =>
        filteredRows.filter(r => isRowFilled(r)).length, [filteredRows]);

    const totalBrowsePages = useMemo(() =>
        Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE)), [filteredRows.length]);

    // Reset input start when filter changes
    useEffect(() => {
        setInputStartIdx(null);
    }, [month, year]);

    // Initialize input start index after loading
    useEffect(() => {
        if (!loading && inputStartIdx === null) {
            const start = Math.max(0, lastFilledIdx + 1 - PAGE_SIZE);
            setInputStartIdx(start);
        }
    }, [loading, lastFilledIdx, inputStartIdx]);

    // Ensure enough empty rows exist
    useEffect(() => {
        if (loading) return;
        const emptyAfterData = rows.length - (lastFilledIdx + 1);
        if (emptyAfterData < EMPTY_BUFFER) {
            addRows(EMPTY_BUFFER - emptyAfterData);
        }
    }, [loading, lastFilledIdx, rows.length, addRows]);

    /* ── Display rows based on view mode ───────────────────── */
    const displayRows = useMemo(() => {
        if (viewMode === "input" && inputStartIdx !== null) {
            // Last 100 data + 100 empty = ~200 rows
            return filteredRows.slice(inputStartIdx, inputStartIdx + PAGE_SIZE + EMPTY_BUFFER);
        } else {
            const start = (browsePage - 1) * PAGE_SIZE;
            return filteredRows.slice(start, start + PAGE_SIZE);
        }
    }, [viewMode, inputStartIdx, browsePage, filteredRows]);

    const displayFilledCount = useMemo(() =>
        displayRows.filter(r => isRowFilled(r)).length, [displayRows]);

    /* ── Navigation helpers ─────────────────────────────────── */
    const goToInput = useCallback(() => {
        const start = Math.max(0, lastFilledIdx + 1 - PAGE_SIZE);
        setInputStartIdx(start);
        setViewMode("input");
        setActive(null);
        setSel(null);
    }, [lastFilledIdx]);

    const goToBrowse = useCallback((page: number) => {
        setBrowsePage(Math.max(1, Math.min(page, totalBrowsePages)));
        setViewMode("browse");
        setActive(null);
        setSel(null);
    }, [totalBrowsePages]);

    /* ── Resize input refs ─────────────────────────────────── */
    useEffect(() => {
        while (inputRefs.current.length < displayRows.length) {
            inputRefs.current.push(Array(5).fill(null));
        }
        if (inputRefs.current.length > displayRows.length + 50) {
            inputRefs.current.length = displayRows.length;
        }
    }, [displayRows.length]);

    const focusCell = useCallback((r: number, c: number) => {
        const el = inputRefs.current[r]?.[c];
        if (el) { el.focus(); el.select(); }
        setActive({ r, c });
        setSel({ start: { r, c }, end: { r, c } });
        setFillEndRow(null);
    }, []);

    const inputRefSetter = useCallback((ri: number, ci: number, el: HTMLInputElement | null) => {
        if (!inputRefs.current[ri]) inputRefs.current[ri] = Array(5).fill(null);
        inputRefs.current[ri][ci] = el;
    }, []);

    /* ── Keyboard navigation ───────────────────────────────── */
    useEffect(() => {
        const maxR = displayRows.length - 1;
        const onKey = (e: KeyboardEvent) => {
            if (!active) return;
            const { r, c } = active;

            if ((e.ctrlKey || e.metaKey) && e.key === "c") {
                const b = sel ? normSel(sel) : { r1: r, r2: r, c1: c, c2: c };
                const lines: string[] = [];
                for (let ri = b.r1; ri <= b.r2; ri++) {
                    lines.push(
                        Array.from({ length: b.c2 - b.c1 + 1 }, (_, ci) =>
                            displayRows[ri][COL_KEYS[b.c1 + ci] as keyof PesananRow] as string
                        ).join("\t")
                    );
                }
                navigator.clipboard?.writeText(lines.join("\n")).catch(() => { });
                return;
            }

            const navKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Enter"];
            if (!navKeys.includes(e.key)) return;
            const aEl = document.activeElement as HTMLInputElement | null;
            const isInput = aEl?.tagName === "INPUT";
            if (isInput && e.key === "ArrowLeft" && (aEl?.selectionStart ?? 0) !== 0) return;
            if (isInput && e.key === "ArrowRight" && (aEl?.selectionStart ?? 0) !== (aEl?.value.length ?? 0)) return;
            e.preventDefault();

            let nr = r, nc = c;
            switch (e.key) {
                case "ArrowUp": nr = Math.max(0, r - 1); break;
                case "ArrowDown":
                case "Enter": nr = Math.min(maxR, r + 1); break;
                case "ArrowLeft": nc = Math.max(0, c - 1); break;
                case "ArrowRight": nc = Math.min(4, c + 1); break;
                case "Tab":
                    if (e.shiftKey) { nc = c > 0 ? c - 1 : 4; if (nc === 4) nr = Math.max(0, r - 1); }
                    else { nc = c < 4 ? c + 1 : 0; if (nc === 0) nr = Math.min(maxR, r + 1); }
                    break;
            }

            if (e.shiftKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
                setSel((prev) => prev ? { start: prev.start, end: { r: nr, c: nc } } : { start: { r, c }, end: { r: nr, c: nc } });
                setActive({ r: nr, c: nc });
                return;
            }
            focusCell(nr, nc);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [active, sel, displayRows, focusCell]);

    /* ── Drag selection ────────────────────────────────────── */
    const onCellMouseDown = useCallback((r: number, c: number, e: React.MouseEvent) => {
        if (e.button !== 0) return;
        e.preventDefault();
        focusCell(r, c);
        setIsDragging(true);
    }, [focusCell]);

    const onCellMouseEnter = useCallback((r: number, c: number) => {
        if (isDragging) { setSel((prev) => prev ? { ...prev, end: { r, c } } : null); setActive({ r, c }); }
        if (isFilling && sel && r > normSel(sel).r2) setFillEndRow(r);
    }, [isDragging, isFilling, sel]);

    const onMouseUp = useCallback(() => {
        setIsDragging(false);
        if (isFilling && fillEndRow !== null && sel) {
            const b = normSel(sel);
            for (let ri = b.r2 + 1; ri <= fillEndRow; ri++) {
                const patch: Partial<PesananRow> = {};
                for (let ci = b.c1; ci <= b.c2; ci++) {
                    const key = COL_KEYS[ci];
                    patch[key] = displayRows[b.r1][key] as string;
                }
                updateRow(displayRows[ri].id, patch);
            }
            setSel((old) => old ? { start: old.start, end: { r: fillEndRow, c: sel ? normSel(sel).c2 : 0 } } : null);
            setFillEndRow(null);
        }
        setIsFilling(false);
    }, [isFilling, fillEndRow, sel, displayRows, updateRow]);

    useEffect(() => {
        window.addEventListener("mouseup", onMouseUp);
        return () => window.removeEventListener("mouseup", onMouseUp);
    }, [onMouseUp]);

    const onFillHandleMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        setIsFilling(true);
        if (sel) setFillEndRow(normSel(sel).r2);
    }, [sel]);

    /* ── Paste ─────────────────────────────────────────────── */
    const handlePaste = useCallback((e: React.ClipboardEvent, startR: number, startC: number) => {
        e.preventDefault();
        const lines = e.clipboardData.getData("text").split(/\r?\n/).filter(Boolean);
        lines.forEach((line, ri) => {
            line.split("\t").forEach((val, ci) => {
                const tr = startR + ri, tc = startC + ci;
                if (tr < displayRows.length && tc < 5) {
                    updateRow(displayRows[tr].id, { [COL_KEYS[tc]]: val } as Partial<PesananRow>);
                }
            });
        });
    }, [displayRows, updateRow]);

    /* ── Change handler ────────────────────────────────────── */
    const handleChange = useCallback((id: number, key: ColKey, val: string) => {
        updateRow(id, { [key]: val } as Partial<PesananRow>);
    }, [updateRow]);

    /* ── Focus handler ─────────────────────────────────────── */
    const handleFocus = useCallback((r: number, c: number) => {
        setActive({ r, c });
        if (!isDragging) setSel({ start: { r, c }, end: { r, c } });
    }, [isDragging]);

    /* ── Export ─────────────────────────────────────────────── */
    const exportExcel = () => {
        const data = filteredRows.filter((r) => r.customer || r.deskripsi || r.tanggal).map((r, i) => ({
            "No": i + 1, "Tanggal": r.tanggal, "Nama Customer": r.customer,
            "Deskripsi Pesanan": r.deskripsi, "Ukuran": r.ukuran, "Qty": r.qty,
        }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Pesanan");
        XLSX.writeFile(wb, `pesanan-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const selBounds = sel ? normSel(sel) : null;

    /* ── Styles ────────────────────────────────────────────── */
    const thStyle: React.CSSProperties = {
        background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11,
        padding: "5px 6px", borderRight: "1px solid #D1BFA3",
        borderBottom: "2px solid #C5A882", whiteSpace: "nowrap",
        position: "sticky", top: 0, zIndex: 10, userSelect: "none", textAlign: "center",
    };

    if (loading) {
        return (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 56px)", background: "#F5EBDD" }}>
                <div style={{ textAlign: "center", color: "#A67B5B" }}>
                    <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite" }}>⏳</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>Memuat data pesanan...</div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}
            onMouseUp={onMouseUp}>

            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap" }}>
                <div>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#5C4033" }}>Input Pesanan</span>
                    <span style={{ fontSize: 11, color: "#B89678", marginLeft: 10 }}>
                        {viewMode === "input"
                            ? `${displayFilledCount} data + ${displayRows.length - displayFilledCount} kosong · Total: ${filledCount} pesanan`
                            : `Hal. ${browsePage}/${totalBrowsePages} · ${filledCount} pesanan total`
                        }
                    </span>
                </div>

                <div style={{ display: "flex", gap: 6, alignItems: "center", marginLeft: 8 }}>
                    <select value={month} onChange={(e) => setMonth(e.target.value === "all" ? "all" : +e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "2px 6px", fontSize: 11, background: "#FFFBF7", color: "#5C4033" }}>
                        <option value="all">Semua Bulan</option>
                        {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <select value={year} onChange={(e) => setYear(+e.target.value)}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "2px 6px", fontSize: 11, background: "#FFFBF7", color: "#5C4033" }}>
                        {years.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                </div>

                <span style={{ fontSize: 10, color: "#C5A882", marginLeft: 4 }}>↑↓←→ navigasi · Shift+drag seleksi · Ctrl+C salin · Ctrl+V tempel · drag 🟦 fill bawah</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button onClick={() => { if (confirm("Reset semua data?")) resetRows(); }}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 14px", fontSize: 12, background: "#FEF2F2", color: "#991B1B", cursor: "pointer", fontWeight: 600 }}>
                        🗑 Reset
                    </button>
                    <button onClick={exportExcel}
                        style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 14px", fontSize: 12, background: "#F5EBDD", color: "#5C4033", cursor: "pointer", fontWeight: 600 }}>
                        ⬇ Excel
                    </button>
                </div>
            </div>

            {/* Table */}
            <div style={{ flex: 1, overflow: "auto", background: "white", userSelect: "none" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", fontSize: 12 }}>
                    <colgroup>
                        <col style={{ width: 40 }} />
                        <col style={{ width: 110 }} />
                        <col style={{ width: "22%" }} />
                        <col style={{ width: "36%" }} />
                        <col style={{ width: 90 }} />
                        <col style={{ width: 65 }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th style={{ ...thStyle, width: 40 }}>No</th>
                            {COL_LABELS.map((label, ci) => (
                                <th key={ci} style={{ ...thStyle, textAlign: ci >= 1 && ci <= 2 ? "left" : "center", paddingLeft: ci >= 1 && ci <= 2 ? 8 : 6 }}>{label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayRows.map((row, ri) => (
                            <TableRow
                                key={row.id}
                                row={row}
                                ri={ri}
                                active={active}
                                selBounds={selBounds}
                                isFilling={isFilling}
                                fillEndRow={fillEndRow}
                                onMouseDown={onCellMouseDown}
                                onMouseEnter={onCellMouseEnter}
                                onFocus={handleFocus}
                                onChange={handleChange}
                                onPaste={handlePaste}
                                onFillHandleMouseDown={onFillHandleMouseDown}
                                inputRefSetter={inputRefSetter}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination Bar ──────────────────────────────────── */}
            <div style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: "8px 14px", background: "white", borderTop: "1px solid #E6D5BE", flexShrink: 0, flexWrap: "wrap"
            }}>
                {/* Browse older pages */}
                <button
                    onClick={() => goToBrowse(viewMode === "browse" ? browsePage - 1 : 1)}
                    disabled={viewMode === "browse" && browsePage <= 1}
                    style={{
                        border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 14px", fontSize: 12,
                        background: "white", color: "#5C4033", cursor: "pointer", fontWeight: 600,
                        opacity: viewMode === "browse" && browsePage <= 1 ? 0.4 : 1,
                    }}>
                    ◀ Sebelumnya
                </button>

                {/* Page numbers */}
                <div style={{ display: "flex", gap: 4, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                    {Array.from({ length: Math.min(totalBrowsePages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalBrowsePages <= 7) {
                            pageNum = i + 1;
                        } else if (viewMode === "browse" && browsePage > 4) {
                            const start = Math.min(browsePage - 3, totalBrowsePages - 6);
                            pageNum = start + i;
                        } else {
                            pageNum = i + 1;
                        }
                        const isActive = viewMode === "browse" && browsePage === pageNum;
                        return (
                            <button key={pageNum} onClick={() => goToBrowse(pageNum)}
                                style={{
                                    width: 32, height: 32, borderRadius: 6, border: "1px solid #D1BFA3",
                                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                                    background: isActive ? "#A67B5B" : "white",
                                    color: isActive ? "white" : "#5C4033",
                                }}>
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={() => viewMode === "browse" ? goToBrowse(browsePage + 1) : null}
                    disabled={viewMode !== "browse" || browsePage >= totalBrowsePages}
                    style={{
                        border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 14px", fontSize: 12,
                        background: "white", color: "#5C4033", cursor: "pointer", fontWeight: 600,
                        opacity: viewMode !== "browse" || browsePage >= totalBrowsePages ? 0.4 : 1,
                    }}>
                    Berikutnya ▶
                </button>

                {/* Divider */}
                <div style={{ width: 1, height: 24, background: "#E6D5BE", margin: "0 4px", display: "none" }} />

                {/* +100 Baris button */}
                <button onClick={() => addRows(100)}
                    style={{
                        border: "1px solid #D1BFA3", borderRadius: 6, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: "#DCFCE7", color: "#15803D", display: "flex", alignItems: "center", gap: 6,
                    }}>
                    ➕ 100 Baris
                </button>

                {/* Input Terbaru button */}
                <button onClick={goToInput}
                    style={{
                        border: viewMode === "input" ? "2px solid #A67B5B" : "1px solid #D1BFA3",
                        borderRadius: 6, padding: "5px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        background: viewMode === "input" ? "#A67B5B" : "#FEF3E8",
                        color: viewMode === "input" ? "white" : "#A67B5B",
                        display: "flex", alignItems: "center", gap: 6,
                    }}>
                    📝 Input Terbaru
                </button>
            </div>
        </div>
    );
}
