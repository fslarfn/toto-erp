"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   PESANAN STORE — Supabase-backed with pagination support
================================================================ */

export type PesananRow = {
    id: number; // Bisa berupa ID asli (DB) atau ID sementara (sangat besar)
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
    shipped_at: string;
    sync_id: string; // Pelacak unik untuk sinkronisasi antrian
};

export const PAGE_SIZE = 100;
export const EMPTY_BUFFER = 100;

export function makeEmptyRow(index: number = 0): PesananRow {
    // Gunakan ID sementara yang sangat besar agar tidak bentrok antar user
    const tempId = 1000000000 + Date.now() + index;
    return {
        id: tempId,
        tanggal: "", customer: "", deskripsi: "", ukuran: "", qty: "",
        harga: "", no_inv: "", no_sj: "",
        di_produksi: false, di_warna: false, siap_kirim: false, di_kirim: false,
        ekspedisi: "", color_marker: "",
        printed_at: "", po_label: "", is_packing: false, is_paid: false,
        production_note: "", metode_kirim: "", shipped_at: "",
        sync_id: String(tempId),
    };
}

export function isRowFilled(r: PesananRow): boolean {
    return !!(r.customer || r.deskripsi || r.tanggal);
}

type Ctx = {
    rows: PesananRow[];
    loading: boolean;
    updateRow: (id: number, patch: Partial<PesananRow>, autoFlush?: boolean) => void;
    flushRow: (id: number) => Promise<void>;
    flushAllRows: () => Promise<void>;
    addRows: (count?: number) => void;
    addRow: (data: Partial<PesananRow>) => Promise<void>;
    importRows: (data: Partial<PesananRow>[]) => void;
};

const PesananCtx = createContext<Ctx | null>(null);

export function PesananProvider({ children }: { children: ReactNode }) {
    const [rows, setRows] = useState<PesananRow[]>(() =>
        Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(i + 1))
    );
    const [loading, setLoading] = useState(true);
    const timers = useRef<Record<number, NodeJS.Timeout>>({});
    const pendingPatches = useRef<Record<number, Partial<PesananRow>>>({});
    const savingRef = useRef<Record<number, boolean>>({});

    // Load from Supabase on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                let allData: any[] = [];
                let from = 0;
                let to = 999;
                let hasMore = true;

                while (hasMore && !cancelled) {
                    const { data, error } = await supabase
                        .from("pesanan_rows")
                        .select("*")
                        .order("id", { ascending: true })
                        .range(from, to);

                    if (error) throw error;
                    if (data && data.length > 0) {
                        allData = [...allData, ...data];
                        if (data.length < 1000) {
                            hasMore = false;
                        } else {
                            from += 1000;
                            to += 1000;
                        }
                    } else {
                        hasMore = false;
                    }
                }

                if (!cancelled && allData.length > 0) {
                    const mapped = allData.map((r: Record<string, unknown>) => ({
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
                        shipped_at: (r.shipped_at as string) || "",
                        sync_id: (r.sync_id as string) || "",
                    }));
                    // Append empty rows buffer after data
                    const lastResortId = mapped.length > 0 ? mapped[mapped.length - 1].id : 0;
                    const emptyBuf = Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(i));
                    setRows([...mapped, ...emptyBuf]);
                }
            } catch (err) {
                console.error("Fetch Error:", err);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Realtime Subscription
    useEffect(() => {
        console.log("Supabase Realtime: Connecting...");
        const channel = supabase
            .channel("realtime_pesanan")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "pesanan_rows" },
                (payload) => {
                    const { eventType, new: newRow, old: oldRow } = payload;

                            setRows((prev) => {
                                const row = newRow as Record<string, any>;
                                const mapped: Partial<PesananRow> = {};
                                if ("id" in row) mapped.id = row.id;
                                if ("tanggal" in row) mapped.tanggal = row.tanggal;
                                if ("customer" in row) mapped.customer = row.customer;
                                if ("deskripsi" in row) mapped.deskripsi = row.deskripsi;
                                if ("ukuran" in row) mapped.ukuran = row.ukuran;
                                if ("qty" in row) mapped.qty = row.qty;
                                if ("harga" in row) mapped.harga = row.harga;
                                if ("no_inv" in row) mapped.no_inv = row.no_inv;
                                if ("no_sj" in row) mapped.no_sj = row.no_sj;
                                if ("di_produksi" in row) mapped.di_produksi = !!row.di_produksi;
                                if ("di_warna" in row) mapped.di_warna = !!row.di_warna;
                                if ("siap_kirim" in row) mapped.siap_kirim = !!row.siap_kirim;
                                if ("di_kirim" in row) mapped.di_kirim = !!row.di_kirim;
                                if ("ekspedisi" in row) mapped.ekspedisi = row.ekspedisi;
                                if ("color_marker" in row) mapped.color_marker = row.color_marker;
                                if ("printed_at" in row) mapped.printed_at = row.printed_at;
                                if ("po_label" in row) mapped.po_label = row.po_label;
                                if ("is_packing" in row) mapped.is_packing = !!row.is_packing;
                                if ("is_paid" in row) mapped.is_paid = !!row.is_paid;
                                if ("production_note" in row) mapped.production_note = row.production_note;
                                if ("metode_kirim" in row) mapped.metode_kirim = row.metode_kirim;
                                if ("shipped_at" in row) mapped.shipped_at = row.shipped_at;
                                if ("sync_id" in row) mapped.sync_id = row.sync_id;

                                const exists = prev.find((r) => r.id === mapped.id);
                                let newList: PesananRow[];
                                
                                if (exists) {
                                    newList = prev.map((r) => (r.id === mapped.id ? { ...r, ...mapped } : r));
                                } else {
                                    // Cek apakah ini data yang barusan kita input (mencocokkan konten di placeholder)
                                    // 1. Cek berdasarkan sync_id (paling akurat)
                                    let placeholderIdx = prev.findIndex(r => r.id >= 1000000000 && r.sync_id === mapped.sync_id);
                                    
                                    // 2. Fallback ke heuristic nama jika sync_id kosong (untuk data lama)
                                    if (placeholderIdx === -1 && !mapped.sync_id) {
                                        placeholderIdx = prev.findIndex(r => 
                                            r.id >= 1000000000 && 
                                            (r.customer === mapped.customer && r.deskripsi === mapped.deskripsi)
                                        );
                                    }

                                    if (placeholderIdx !== -1) {
                                        // Ganti placeholder tersebut dengan data asli dari DB
                                        newList = [...prev];
                                        newList[placeholderIdx] = { ...makeEmptyRow(0), ...mapped } as PesananRow;
                                    } else {
                                        // Memang data baru dari orang lain
                                        const newFullRow = { ...makeEmptyRow(0), ...mapped } as PesananRow;
                                        newList = [...prev, newFullRow];
                                    }
                                }

                                // Pengurutan: Data database (ID kecil) di atas, Data baru (ID > 1M) tetap di bawah
                                return newList
                                    .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                                    .sort((a, b) => a.id - b.id);
                            });
                }
            )
            .on("system", { event: "*" }, (payload) => console.log("Realtime System Event:", payload))
            .subscribe((status) => {
                console.log("Supabase Realtime Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Safety Lock: Mencegah penutupan tab jika ada data belum tersimpan
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            const hasPending = Object.values(pendingPatches.current).some(p => Object.keys(p).length > 0);
            if (hasPending) {
                e.preventDefault();
                e.returnValue = "Ada data yang belum disimpan. Yakin ingin keluar?";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, []);


    const flushRow = useCallback(async (id: number) => {
        if (savingRef.current[id]) return;
        
        const finalPatch = { ...pendingPatches.current[id] };
        if (Object.keys(finalPatch).length === 0) {
            if (timers.current[id]) {
                clearTimeout(timers.current[id]);
                delete timers.current[id];
            }
            return;
        }

        if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }        savingRef.current[id] = true;
        try {
            const cleanPatch: any = { ...finalPatch };
            const fieldsToClean = ["qty", "ukuran", "harga", "tanggal", "printed_at", "shipped_at"];
            fieldsToClean.forEach(f => {
                if (cleanPatch[f] === "" || cleanPatch[f] === undefined) {
                    cleanPatch[f] = null;
                }
            });

            const isTempId = typeof id === 'number' && id >= 1000000000;

            if (!isTempId) {
                const { error } = await supabase.from("pesanan_rows").update(cleanPatch).eq("id", id);
                if (error) throw error;
                Object.keys(finalPatch).forEach(key => {
                    if (pendingPatches.current[id]?.[key as keyof PesananRow] === finalPatch[key as keyof PesananRow]) {
                        delete (pendingPatches.current[id] as any)[key];
                    }
                });
            } else {
                const rowToInsert = { ...makeEmptyRow(0), ...cleanPatch };
                delete (rowToInsert as any).id;
                
                const hasData = rowToInsert.tanggal || rowToInsert.customer || rowToInsert.deskripsi || rowToInsert.ukuran || rowToInsert.qty;
                if (hasData) {
                    const rowWithSync = { ...rowToInsert, sync_id: String(id) };
                    const { data, error } = await supabase.from("pesanan_rows").insert(rowWithSync).select("id").single();
                    if (error) throw error;
                    
                    if (data?.id) {
                        const newRealId = data?.id;
                        setRows(prev => prev.map(r => r.id === id ? { ...r, id: newRealId } : r));
                        
                        // MIGRATION: Pindahkan sisa ketikan baru (jika ada) ke ID asli yang baru
                        const currentInTemp = { ...pendingPatches.current[id] };
                        Object.keys(finalPatch).forEach(key => {
                            if (currentInTemp[key as keyof PesananRow] === finalPatch[key as keyof PesananRow]) {
                                delete (currentInTemp as any)[key];
                            }
                        });

                        if (Object.keys(currentInTemp).length > 0) {
                             pendingPatches.current[newRealId] = {
                                  ...(pendingPatches.current[newRealId] || {}),
                                  ...currentInTemp
                             };
                        }
                        delete pendingPatches.current[id];
                        // Update id to the new real ID for any subsequent flushes
                        id = newRealId;
                    }
                }
            }
        } catch (err: any) {
            console.error("Flush Row Error:", err);
            if (err.message !== "Failed to fetch") {
                alert("Simpan Gagal: " + (err.message || "Masalah Database"));
            }
        } finally {
            savingRef.current[id] = false;
            // CHECK if more patches arrived during save
            if (pendingPatches.current[id] && Object.keys(pendingPatches.current[id]).length > 0) {
                 flushRow(id);
            }
        }
    }, [setRows]);

    const flushAllRows = useCallback(async () => {
        const idsToFlush = Object.keys(pendingPatches.current).map(Number).filter(id => !isNaN(id));
        if (idsToFlush.length === 0) return;
        
        console.log(`Flushing all rows: ${idsToFlush.length} items`);
        
        const updates: any[] = [];
        const inserts: any[] = [];
        const originalTempIds: number[] = [];

        for (const id of idsToFlush) {
            const patch = { ...pendingPatches.current[id] };
            if (Object.keys(patch).length === 0) continue;

            const cleanPatch: any = { ...patch };
            const fieldsToClean = ["qty", "ukuran", "harga", "tanggal", "printed_at", "shipped_at"];
            fieldsToClean.forEach(f => {
                if (cleanPatch[f] === "" || cleanPatch[f] === undefined) {
                    cleanPatch[f] = null;
                }
            });

            if (id < 1000000000) {
                updates.push({ id, ...cleanPatch });
            } else {
                const rowToInsert = { ...makeEmptyRow(0), ...cleanPatch };
                delete (rowToInsert as any).id;
                const hasData = rowToInsert.tanggal || rowToInsert.customer || rowToInsert.deskripsi || rowToInsert.ukuran || rowToInsert.qty;
                if (hasData) {
                    inserts.push(rowToInsert);
                    originalTempIds.push(id);
                }
            }
        }

        try {
            // 1. Bulk Update
            if (updates.length > 0) {
                const { error } = await supabase.from("pesanan_rows").upsert(updates);
                if (error) throw error;
            }

            // 2. Bulk Insert (Sequential for ID recovery, or just let realtime handle it)
            // But to recover IDs we need to know which one is which.
            // For simplicity and safety, we'll do inserts one by one or trust realtime
            if (inserts.length > 0) {
                for (let i = 0; i < inserts.length; i++) {
                    const tempId = originalTempIds[i];
                    const rowPayload = { ...inserts[i], sync_id: String(tempId) };
                    const { data, error } = await supabase.from("pesanan_rows").insert(rowPayload).select("id").single();
                    if (error) throw error;
                    if (data?.id) {
                        const newRealId = data.id;
                        setRows(prev => prev.map(r => r.id === tempId ? { ...r, id: newRealId } : r));
                        delete pendingPatches.current[tempId];
                    }
                }
            }

            // Clear pending patches for updates that succeeded
            updates.forEach(u => delete pendingPatches.current[u.id]);

        } catch (err: any) {
            console.error("Flush All Error:", err);
            alert("Terjadi masalah saat menyimpan data. Beberapa baris mungkin belum tersimpan.");
        }
    }, [setRows]);

    const updateRow = useCallback((id: number, patch: Partial<PesananRow>, autoFlush = false) => {
        setRows((prev) =>
            prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
        );

        pendingPatches.current[id] = {
            ...(pendingPatches.current[id] || {}),
            ...patch,
        };

        if (autoFlush) {
            if (timers.current[id]) clearTimeout(timers.current[id]);
            timers.current[id] = setTimeout(() => {
                flushRow(id);
                delete timers.current[id];
            }, 1000); // 1s debounce
        }
    }, [flushRow]);

    // Menghapus total fungsi reset untuk keamanan data (instruksi Faisal 13/04/26)

    const addRows = useCallback((count = 100) => {
        setRows((prev) => {
            const newRows = Array.from({ length: count }, (_, i) => makeEmptyRow(prev.length + i));
            return [...prev, ...newRows];
        });
    }, []);

    const addRow = useCallback(async (data: Partial<PesananRow>) => {
        const { error } = await supabase.from("pesanan_rows").insert(data);
        if (error) throw error;
    }, []);

    const importRows = useCallback((data: Partial<PesananRow>[]) => {
        const total = Math.max(data.length, PAGE_SIZE);
        const base: PesananRow[] = Array.from({ length: total }, (_, i) => makeEmptyRow(i + 1));
        data.forEach((d, i) => { base[i] = { ...base[i], ...d }; });
        
        const lastId = base[base.length - 1].id;
        const emptyBuf = Array.from({ length: EMPTY_BUFFER }, (_, i) => makeEmptyRow(lastId + i + 1));
        setRows([...base, ...emptyBuf]);

        (async () => {
            const rowsWithData = base.filter(r => isRowFilled(r));
            for (let i = 0; i < rowsWithData.length; i += 100) {
                const chunk = rowsWithData.slice(i, i + 100);
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
        <PesananCtx.Provider value={{ rows, loading, updateRow, flushRow, flushAllRows, addRows, addRow, importRows }}>
            {children}
        </PesananCtx.Provider>
    );
}

export function usePesanan() {
    const ctx = useContext(PesananCtx);
    if (!ctx) throw new Error("usePesanan must be used inside PesananProvider");
    return ctx;
}
