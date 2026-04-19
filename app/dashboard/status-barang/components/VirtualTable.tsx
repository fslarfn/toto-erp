"use client";
import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { PesananRow } from "@/lib/pesanan-store";
import { StatusRow } from "./StatusRow";

type Props = {
    rows: PesananRow[];
    viewMode: "detail" | "simple";
    onUpdate: (id: number, patch: Partial<PesananRow>) => void;
};

export function VirtualTable({ rows, viewMode, onUpdate }: Props) {
    const parentRef = useRef<HTMLDivElement>(null);
    const [activeCell, setActiveCell] = useState<{ id: number; key: string } | null>(null);
    const [colorRowId, setColorRowId] = useState<number | null>(null);

    // Virtualisasi hanya Aktif jika data > 300
    const useVirtual = rows.length >= 300;

    const rowVirtualizer = useVirtualizer({
        count: useVirtual ? rows.length : 0,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 27,
        overscan: 10,
    });

    const th = (w: number, left = false): React.CSSProperties => ({
        background: "#EDE0D4",
        color: "#5C4033",
        fontWeight: 700,
        fontSize: 11,
        borderBottom: "2px solid #C5A882",
        borderRight: "1px solid #E6D5BE",
        padding: "4px 8px",
        position: "sticky",
        top: 0,
        zIndex: 10,
        textAlign: left ? "left" : "center",
        width: w,
        minWidth: w,
        whiteSpace: "nowrap",
        boxSizing: "border-box"
    });

    const vItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();

    const bodyContent = useVirtual ? (
        <>
            {vItems.length > 0 && (
                <tr>
                    <td style={{ height: `${vItems[0].start}px`, border: "none" }} colSpan={20} />
                </tr>
            )}
            {vItems.map((rv) => (
                <StatusRow
                    key={rows[rv.index].id}
                    row={rows[rv.index]}
                    idx={rv.index}
                    viewMode={viewMode}
                    activeCell={activeCell}
                    setActiveCell={setActiveCell}
                    onUpdate={onUpdate}
                    colorRowId={colorRowId}
                    setColorRowId={setColorRowId}
                />
            ))}
            {vItems.length > 0 && (
                <tr>
                    <td style={{ height: `${totalSize - vItems[vItems.length - 1].end}px`, border: "none" }} colSpan={20} />
                </tr>
            )}
        </>
    ) : (
        rows.map((row, i) => (
            <StatusRow
                key={row.id}
                row={row}
                idx={i}
                viewMode={viewMode}
                activeCell={activeCell}
                setActiveCell={setActiveCell}
                onUpdate={onUpdate}
                colorRowId={colorRowId}
                setColorRowId={setColorRowId}
            />
        ))
    );

    return (
        <div 
            ref={parentRef} 
            style={{ 
                width: "100%", 
                height: "100%", 
                overflow: "auto", 
                background: "white", 
                position: "relative",
                display: "block"
            }}
        >
            <table style={{ borderCollapse: "collapse", width: "max-content", minWidth: "100%", fontSize: 11, tableLayout: "fixed" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 30 }}>
                    <tr>
                        <th style={{ ...th(36), position: "sticky", left: 0, zIndex: 40, borderRight: "2px solid #C5A882" }}>#</th>
                        <th style={{ ...th(30) }}>🎨</th>
                        <th style={{ ...th(70) }}>Tgl</th>
                        <th style={{ ...th(130), textAlign: "left" }}>Customer</th>
                        <th style={{ ...th(200), textAlign: "left" }}>Deskripsi</th>
                        <th style={{ ...th(60) }}>Ukuran</th>
                        <th style={{ ...th(44) }}>Qty</th>
                        {viewMode === "detail" && (
                            <>
                                <th style={{ ...th(90) }}>No Invoice</th>
                                <th style={{ ...th(115), textAlign: "right" }}>Harga (Rp)</th>
                                <th style={{ ...th(130), textAlign: "right" }}>Total Harga (Rp)</th>
                            </>
                        )}
                        <th style={{ ...th(62) }}>Produksi</th>
                        <th style={{ ...th(52) }}>Warna</th>
                        <th style={{ ...th(48) }}>Siap</th>
                        <th style={{ ...th(48) }}>Kirim</th>
                        <th style={{ ...th(54) }}>💰 Bayar</th>
                        {viewMode === "detail" && <th style={{ ...th(110), textAlign: "left" }}>Ekspedisi</th>}
                        <th style={{ ...th(80) }}>Status</th>
                    </tr>
                </thead>
                <tbody style={{ background: "white" }}>
                    {bodyContent}
                </tbody>
            </table>
        </div>
    );
}
