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
    fetchFilter: (year: number, month: number | "all") => Promise<void>;
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
    // Menyimpan field mana yang sedang dalam proses save (dalam penerbangan ke DB)
    // Melindungi field tersebut dari overwrite oleh Realtime
    const savingKeys = useRef<Record<number, Set<string>>>({});

    // Helper to fetch data with range or filter
    const fetchRange = async (from: number, to: number, year?: number, month?: number | "all") => {
        let query = supabase.from("pesanan_rows").select("*");
        
        if (year && month && month !== "all") {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, typeof month === "number" ? month : 0, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            query = query.gte("tanggal", startDate).lte("tanggal", endDate);
        } else if (year) {
            query = query.gte("tanggal", `${year}-01-01`).lte("tanggal", `${year}-12-31`);
        }

        const { data, error } = await query
            .order("id", { ascending: true })
            .range(from, to);

        if (error) throw error;
        return data || [];
    };

    const mapRows = (data: any[]): PesananRow[] => {
        return data.map((r: Record<string, unknown>) => ({
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
    };

    const fetchFilter = useCallback(async (year: number, month: number | "all") => {
        setLoading(true);
        try {
            let allData: any[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const data = await fetchRange(from, from + 999, year, month);
                allData = [...allData, ...data];
                if (data.length < 1000) hasMore = false;
                else from += 1000;
            }

            if (allData.length > 0) {
                const newRows = mapRows(allData);
                setRows(prev => {
                    // Gabungkan dengan data yang sudah ada, hindari duplikat
                    const existingIds = new Set(newRows.map(r => r.id));
                    const filteredPrev = prev.filter(r => r.id >= 1000000000 || !existingIds.has(r.id));
                    return [...filteredPrev, ...newRows].sort((a, b) => {
                        const isTempA = a.id >= 1000000000;
                        const isTempB = b.id >= 1000000000;
                        if (isTempA && !isTempB) return 1;
                        if (!isTempA && isTempB) return -1;
                        return a.id - b.id;
                    });
                });
            }
        } catch (err) {
            console.error("Fetch Filter Error:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Load current month by default on mount
    useEffect(() => {
        const now = new Date();
        fetchFilter(now.getFullYear(), now.getMonth() + 1);
    }, [fetchFilter]);

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

                    // Hanya proses INSERT dan UPDATE — abaikan DELETE
                    if (eventType === "DELETE") return;
                    if (!newRow || typeof (newRow as any).id !== "number") return;

                    setRows((prev) => {
                        const row = newRow as Record<string, any>;
                        const existingId = row.id as number;

                        // Field yang dilindungi = pending (belum dikirim) ATAU sedang dikirim ke DB
                        const localPatches = pendingPatches.current[existingId] || {};
                        const inFlightKeys = savingKeys.current[existingId] || new Set<string>();

                        const mapped: Partial<PesananRow> = {};
                        if ("id" in row) mapped.id = row.id;

                        const boolFields = new Set(["di_produksi", "di_warna", "siap_kirim", "di_kirim", "is_packing", "is_paid"]);
                        const allFields: (keyof PesananRow)[] = [
                            "tanggal", "customer", "deskripsi", "ukuran", "qty", "harga",
                            "no_inv", "no_sj", "di_produksi", "di_warna", "siap_kirim",
                            "di_kirim", "ekspedisi", "color_marker", "printed_at",
                            "po_label", "is_packing", "is_paid", "production_note",
                            "metode_kirim", "shipped_at", "sync_id"
                        ];

                        allFields.forEach(f => {
                            // Skip jika field sedang pending ATAU sedang dalam proses save
                            if (f in localPatches || inFlightKeys.has(f)) return;
                            if (f in row) {
                                (mapped as any)[f] = boolFields.has(f) ? !!row[f] : row[f];
                            }
                        });

                        const exists = prev.find((r) => r.id === mapped.id);
                        let newList: PesananRow[];

                        if (exists) {
                            newList = prev.map((r) => (r.id === mapped.id ? { ...r, ...mapped } : r));
                        } else {
                            // Cek apakah ini data yang barusan kita input (mencocokkan sync_id)
                            let placeholderIdx = prev.findIndex(r => r.id >= 1000000000 && r.sync_id === mapped.sync_id);

                            if (placeholderIdx === -1 && !mapped.sync_id) {
                                placeholderIdx = prev.findIndex(r =>
                                    r.id >= 1000000000 &&
                                    (r.customer === mapped.customer && r.deskripsi === mapped.deskripsi)
                                );
                            }

                            if (placeholderIdx !== -1) {
                                newList = [...prev];
                                newList[placeholderIdx] = { ...makeEmptyRow(0), ...mapped } as PesananRow;
                            } else {
                                const newFullRow = { ...makeEmptyRow(0), ...mapped } as PesananRow;
                                newList = [...prev, newFullRow];
                            }
                        }

                        return newList
                            .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                            .sort((a, b) => {
                                // Pastikan baris placeholder (ID besar) tetap di bawah
                                const isTempA = a.id >= 1000000000;
                                const isTempB = b.id >= 1000000000;
                                if (isTempA && !isTempB) return 1;
                                if (!isTempA && isTempB) return -1;
                                return a.id - b.id;
                            });
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
        // Jika sedang dalam proses save, jadwalkan retry
        if (savingRef.current[id]) {
            if (timers.current[id]) clearTimeout(timers.current[id]);
            timers.current[id] = setTimeout(() => {
                delete timers.current[id];
                flushRow(id);
            }, 500);
            return;
        }

        const patch = pendingPatches.current[id];
        if (!patch || Object.keys(patch).length === 0) return;

        // Snapshot key mana saja yang akan disimpan
        const finalPatch = { ...patch };
        const keysToSave = Object.keys(finalPatch) as (keyof PesananRow)[];

        // HAPUS hanya key yang akan disimpan dari pending (bukan hapus semua)
        // Sehingga key BARU yang masuk selama async tidak ikut terhapus
        keysToSave.forEach(k => {
            delete (pendingPatches.current[id] as any)?.[k];
        });
        if (pendingPatches.current[id] && Object.keys(pendingPatches.current[id]).length === 0) {
            delete pendingPatches.current[id];
        }

        if (timers.current[id]) {
            clearTimeout(timers.current[id]);
            delete timers.current[id];
        }

        // Tandai key ini sebagai "sedang dalam penerbangan" agar Realtime tidak menimpanya
        if (!savingKeys.current[id]) savingKeys.current[id] = new Set();
        keysToSave.forEach(k => savingKeys.current[id].add(k));

        savingRef.current[id] = true;
        let resolvedId = id;
        try {
            const cleanPatch: any = { ...finalPatch };
            // Konversi empty string ke null HANYA untuk field yang MEMANG ADA di patch
            // Jangan tambahkan field baru dengan nilai null (itu akan menimpa data DB yang sudah ada!)
            const fieldsToClean = ["qty", "ukuran", "harga", "tanggal", "printed_at", "shipped_at"];
            fieldsToClean.forEach(f => {
                if (f in cleanPatch && (cleanPatch[f] === "" || cleanPatch[f] === undefined)) {
                    cleanPatch[f] = null;
                }
            });

            const isTempId = id >= 1000000000;

            if (!isTempId) {
                const { error } = await supabase.from("pesanan_rows").update(cleanPatch).eq("id", id);
                if (error) {
                    // Kembalikan patch ke pending jika gagal
                    pendingPatches.current[id] = { ...(pendingPatches.current[id] || {}), ...finalPatch };
                    throw error;
                }
            } else {
                // Insert baris baru
                const rowToInsert = { ...makeEmptyRow(0), ...cleanPatch };
                delete (rowToInsert as any).id;

                // Bersihkan field timestamp dari makeEmptyRow default ("") → null
                // Supabase menolak string kosong untuk kolom bertipe timestamp
                ["printed_at", "shipped_at"].forEach(f => {
                    if ((rowToInsert as any)[f] === "") (rowToInsert as any)[f] = null;
                });

                const hasData = rowToInsert.tanggal || rowToInsert.customer || rowToInsert.deskripsi || rowToInsert.ukuran || rowToInsert.qty;
                if (hasData) {
                    // Fallback: pastikan tanggal selalu terisi sebelum disimpan ke DB.
                    // Normalnya sudah diisi oleh handleChange di page.tsx, ini sebagai safety net.
                    if (!rowToInsert.tanggal) {
                        rowToInsert.tanggal = new Date().toISOString().split("T")[0];
                    }
                    const rowWithSync = { ...rowToInsert, sync_id: String(id) };
                    const { data, error } = await supabase.from("pesanan_rows").insert(rowWithSync).select("id").single();
                    if (error) {
                        pendingPatches.current[id] = { ...(pendingPatches.current[id] || {}), ...finalPatch };
                        throw error;
                    }

                    if (data?.id) {
                        const newRealId = data.id;
                        resolvedId = newRealId;
                        setRows(prev => prev.map(r => r.id === id ? { ...r, id: newRealId } : r));

                        // Pindahkan sisa patches yang masuk saat insert berlangsung ke ID baru
                        const leftovers = pendingPatches.current[id];
                        if (leftovers && Object.keys(leftovers).length > 0) {
                            pendingPatches.current[newRealId] = {
                                ...(pendingPatches.current[newRealId] || {}),
                                ...leftovers,
                            };
                        }
                        delete pendingPatches.current[id];

                        // Pindahkan savingKeys ke ID baru
                        if (savingKeys.current[id]) {
                            savingKeys.current[newRealId] = savingKeys.current[id];
                            delete savingKeys.current[id];
                        }
                    }
                }
            }
        } catch (err: any) {
            console.error("Flush Row Error:", err);
            if (err?.message && err.message !== "Failed to fetch") {
                alert("Simpan Gagal: " + (err.message || "Masalah Database"));
            }
        } finally {
            // Hapus savingKeys setelah selesai (berhasil atau gagal)
            keysToSave.forEach(k => savingKeys.current[resolvedId]?.delete(k));
            if (savingKeys.current[resolvedId]?.size === 0) delete savingKeys.current[resolvedId];

            savingRef.current[resolvedId] = false;
            // Jika ada patch baru yang masuk selama proses save, flush ulang
            if (pendingPatches.current[resolvedId] && Object.keys(pendingPatches.current[resolvedId]).length > 0) {
                setTimeout(() => flushRow(resolvedId), 100);
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
            // HANYA konversi field yang ada di patch, jangan tambahkan null untuk field lain
            const fieldsToClean = ["qty", "ukuran", "harga", "tanggal", "printed_at", "shipped_at"];
            fieldsToClean.forEach(f => {
                if (f in cleanPatch && (cleanPatch[f] === "" || cleanPatch[f] === undefined)) {
                    cleanPatch[f] = null;
                }
            });

            if (id < 1000000000) {
                updates.push({ id, ...cleanPatch });
            } else {
                const rowToInsert = { ...makeEmptyRow(0), ...cleanPatch };
                delete (rowToInsert as any).id;
                // Bersihkan field timestamp dari makeEmptyRow default ("") → null
                ["printed_at", "shipped_at"].forEach(f => {
                    if ((rowToInsert as any)[f] === "") (rowToInsert as any)[f] = null;
                });
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
            }, 300); // Super fast debounce (300ms)
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
        <PesananCtx.Provider value={{ rows, loading, updateRow, flushRow, flushAllRows, addRows, addRow, importRows, fetchFilter }}>
            {children}
        </PesananCtx.Provider>
    );
}

export function usePesanan() {
    const ctx = useContext(PesananCtx);
    if (!ctx) throw new Error("usePesanan must be used inside PesananProvider");
    return ctx;
}
