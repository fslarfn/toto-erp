"use client";
import { useState, useRef, useEffect, memo } from "react";

type Props = {
    value: string | number | null | undefined;
    onSave: (val: string) => void;
    width: number;
    align?: "left" | "center" | "right";
    mono?: boolean;
    type?: "text" | "number" | "date";
    isEditing: boolean;
    onEdit: () => void;
    onBlur: () => void;
};

/**
 * Click-to-Edit Cell specialized for Status Barang (SCOPE LOCK)
 * Renders plain text by default, swaps to input when active.
 */
export const StatusCell = memo(function StatusCell({
    value, onSave, width, align = "left", mono = false, type = "text",
    isEditing, onEdit, onBlur
}: Props) {
    let displayValue = value == null ? "" : String(value);

    // Format DD-MM-YYYY for non-editing display if it's a date
    if (!isEditing && type === "date" && displayValue.includes("-")) {
        const p = displayValue.split("-");
        if (p.length === 3) displayValue = `${p[2]}-${p[1]}-${p[0]}`;
    }

    const [local, setLocal] = useState(value == null ? "" : String(value));
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync remote change to local when not editing
    useEffect(() => {
        if (!isEditing) setLocal(displayValue);
    }, [displayValue, isEditing]);

    // Focus input when editing starts
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            if (type !== "date") inputRef.current.select();
        }
    }, [isEditing, type]);

    const handleSave = () => {
        if (local !== displayValue) {
            onSave(local);
        }
        onBlur();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSave();
        if (e.key === "Escape") {
            setLocal(displayValue);
            onBlur();
        }
    };

    if (isEditing) {
        return (
            <td style={{
                height: 26, width, minWidth: width, padding: 0, boxSizing: "border-box",
                borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE",
                background: "#fef3c7", outline: "2px solid #A67B5B", outlineOffset: -2,
            }}>
                <input
                    ref={inputRef}
                    type={type === "date" ? "date" : "text"}
                    value={local}
                    onChange={(e) => setLocal(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: "100%", height: "100%", border: "none", outline: "none",
                        background: "transparent", padding: "2px 5px", fontSize: 11,
                        fontFamily: mono ? "monospace" : "inherit", textAlign: align,
                        color: "#3C2F2F", boxSizing: "border-box"
                    }}
                />
            </td>
        );
    }

    return (
        <td
            onClick={onEdit}
            style={{
                height: 26, width, minWidth: width, padding: "2px 5px", boxSizing: "border-box",
                borderRight: "1px solid #E6D5BE", borderBottom: "1px solid #E6D5BE",
                fontSize: 11, textAlign: align, color: "#3C2F2F",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                cursor: "text", userSelect: "none",
                fontFamily: mono ? "monospace" : "inherit",
            }}
        >
            {displayValue || <span style={{ opacity: 0.3 }}>—</span>}
        </td>
    );
});
