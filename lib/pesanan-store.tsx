"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   PESANAN STORE — Supabase-backed with pagination support
================================================================ */

export type PesananRow = {
    id: number;
    tanggal: string;
    customer: string;
    deskripsi: string;
    ukuran: string;
    qty: string;
    harga: string;
    no_inv: string;
    no_sj: string;
    di_produksi: boolean;
    di_warna: boolean;
    siap_kirim: boolean;
    di_kirim: boolean;
    ekspedisi: string;
    color_marker: string;
    printed_at: string;
    po_label: string;
    is_packing: boolean;
    is_paid: boolean;
    production_note: string;
    metode_kirim: string;
};

export const PAGE_SIZE = 100;
export const EMPTY_BUFFER = 100;

export function makeEmptyRow(id: number): PesananRow {
    return {
        id,
        tanggal: "", customer: "", deskripsi: "", ukuran: "", qty: "",
        harga: "", no_inv: "", no_sj: "",
        di_produksi: false, di_warna: false, siap_kirim: false, di_kirim: false,
        ekspedisi: "", color_marker: "",
        printed_at: "", po_label: "", is_packing: false, is_paid: false,
        production_note: "", metode_kirim: "",
    };
}

export function isRowFilled(r: PesananRow): boolean {
    return !!(r.customer || r.deskripsi || r.tanggal);
}

type Ctx = {
    rows: PesananRow[];
    loading: boolean;
    updateRow: (id: number, patch: Partial<PesananRow>) => void;
    resetRows: () => void;
    addRows: (count?: number) => void;
    importRows: (data: Partial<PesananRow>[]) => void;
};

const PesananCtx = createContext<Ctx | null>(null);

export function PesananProvider({ children }: { children: ReactNode }) {
    const [rows, setRows] = useState<PesananRow[]>(() =>
        Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(i + 1))
    );
    const [loading, setLoading] = useState(true);

    // Load from Supabase on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from("pesanan_rows")
                    .select("*")
                    .order("id", { ascending: true });

                if (!cancelled && data && !error) {
                    if (data.length > 0) {
                        const mapped = data.map((r: Record<string, unknown>) => ({
                            id: r.id as number,
                            tanggal: (r.tanggal as string) || "",
                            customer: (r.customer as string) || "",
                            deskripsi: (r.deskripsi as string) || "",
                            ukuran: (r.ukuran as string) || "",
                            qty: (r.qty as string) || "",
                            harga: (r.harga as string) || "",
                            no_inv: (r.no_inv as string) || "",
                            no_sj: (r.no_sj as string) || "",
                            di_produksi: !!r.di_produksi,
                            di_warna: !!r.di_warna,
                            siap_kirim: !!r.siap_kirim,
                            di_kirim: !!r.di_kirim,
                            ekspedisi: (r.ekspedisi as string) || "",
                            color_marker: (r.color_marker as string) || "",
                            printed_at: (r.printed_at as string) || "",
                            po_label: (r.po_label as string) || "",
                            is_packing: !!r.is_packing,
                            is_paid: !!r.is_paid,
                            production_note: (r.production_note as string) || "",
                            metode_kirim: (r.metode_kirim as string) || "",
                        }));
                        // Append empty rows buffer after data
                        const lastId = mapped[mapped.length - 1].id;
                        const emptyBuf = Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(lastId + i + 1));
                        setRows([...mapped, ...emptyBuf]);
                    }
                }
            } catch {
                // Supabase not available — keep empty rows
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    const updateRow = useCallback((id: number, patch: Partial<PesananRow>) => {
        setRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
        );
        // Debounced upsert to Supabase
        const timer = setTimeout(async () => {
            const existing = await supabase
                .from("pesanan_rows")
                .select("id")
                .eq("id", id)
                .single();

            if (existing.data) {
                const { metode_kirim: _, ...patchDB } = patch;
                if (Object.keys(patchDB).length > 0) {
                    await supabase.from("pesanan_rows").update(patchDB).eq("id", id);
                }
            } else {
                const row = { ...makeEmptyRow(id), ...patch };
                const { metode_kirim: _, ...dbRow } = row;
                const hasData = row.tanggal || row.customer || row.deskripsi || row.ukuran || row.qty;
                if (hasData) {
                    await supabase.from("pesanan_rows").insert(dbRow);
                }
            }
        }, 300);
        return () => clearTimeout(timer);
    }, []);

    const resetRows = useCallback(() => {
        const fresh = Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(i + 1));
        setRows(fresh);
        (async () => {
            await supabase.from("pesanan_rows").delete().gte("id", 0);
        })();
    }, []);

    const addRows = useCallback((count = 100) => {
        setRows((prev) => {
            const nextId = prev.length > 0 ? prev[prev.length - 1].id + 1 : 1;
            const newRows = Array.from({ length: count }, (_, i) => makeEmptyRow(nextId + i));
            return [...prev, ...newRows];
        });
    }, []);

    const importRows = useCallback((data: Partial<PesananRow>[]) => {
        const total = Math.max(data.length, PAGE_SIZE);
        const base: PesananRow[] = Array.from({ length: total }, (_, i) => makeEmptyRow(i + 1));
        data.forEach((d, i) => { base[i] = { ...base[i], ...d }; });
        // Add empty buffer
        const lastId = base[base.length - 1].id;
        const emptyBuf = Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(lastId + i + 1));
        setRows([...base, ...emptyBuf]);

        (async () => {
            const { error: delErr } = await supabase.from("pesanan_rows").delete().gte("id", 0);
            if (delErr) {
                console.error("Delete Error:", delErr);
                alert("Gagal menghapus data lama: " + delErr.message);
                return;
            }
            
            const rowsWithData = base.filter(r => isRowFilled(r));
            for (let i = 0; i < rowsWithData.length; i += 100) {
                const chunk = rowsWithData.slice(i, i + 100).map(({ metode_kirim: _, ...r }) => r);
                const { error: insErr } = await supabase.from("pesanan_rows").insert(chunk);
                if (insErr) {
                    console.error("Insert Error:", insErr);
                    alert("Gagal menyimpan data baru: " + insErr.message);
                    return;
                }
            }
        })();
    }, []);

    return (
        <PesananCtx.Provider value={{ rows, loading, updateRow, resetRows, addRows, importRows }}>
            {children}
        </PesananCtx.Provider>
    );
}

export function usePesanan() {
    const ctx = useContext(PesananCtx);
    if (!ctx) throw new Error("usePesanan must be used inside PesananProvider");
    return ctx;
}
