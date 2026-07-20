"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from "react";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";

/* ================================================================
   PESANAN STORE — Supabase-backed with pagination support
================================================================ */

export type FinishingStatus = 'belum' | 'repair' | 'warna' | 'gudang';

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
    // Finishing
    finishing_status: FinishingStatus;
    finishing_operator: string;
    finishing_at: string | null;
    is_repair: boolean;
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
        finishing_status: "belum", finishing_operator: "", finishing_at: null, is_repair: false,
    };
}

export function isRowFilled(r: PesananRow): boolean {
    return !!(r.customer || r.deskripsi || r.tanggal);
}

// Kolom yang di-fetch dari pesanan_rows — persis yang dipetakan mapRows.
// SENGAJA tanpa created_at & last_status_change (tidak dipakai store; dua kolom
// terberat di payload). Kalau menambah field baru di mapRows, tambahkan di sini.
const PESANAN_COLS =
    "id, tanggal, customer, deskripsi, ukuran, qty, harga, no_inv, no_sj, " +
    "di_produksi, di_warna, siap_kirim, di_kirim, ekspedisi, color_marker, " +
    "printed_at, po_label, is_packing, is_paid, production_note, metode_kirim, " +
    "shipped_at, sync_id, finishing_status, finishing_operator, finishing_at, is_repair";

type Ctx = {
    rows: PesananRow[];
    loading: boolean;
    /** Id baris yang gagal tersimpan (jaringan/DB) — ditampilkan badge merah di grid. */
    failedRowIds: Set<number>;
    updateRow: (id: number, patch: Partial<PesananRow>, autoFlush?: boolean) => void;
    flushRow: (id: number) => Promise<void>;
    flushAllRows: () => Promise<void>;
    addRows: (count?: number) => void;
    addRow: (data: Partial<PesananRow>) => Promise<void>;
    importRows: (data: Partial<PesananRow>[]) => void;
    fetchFilter: (year: number, month: number | "all") => Promise<void>;
    /** Dipanggil otomatis oleh usePesanan — memulai fetch data saat pertama kali dipakai. */
    ensureLoaded: () => void;
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
    // NILAI yang sedang dalam penerbangan ke DB (bukan cuma nama field-nya) —
    // dipakai protectRow untuk menimpakan ulang ketikan di atas data server.
    const inFlightPatches = useRef<Record<number, Partial<PesananRow>>>({});
    // Nilai yang BARU BERHASIL disimpan (grace 8 dtk): echo realtime yang telat
    // (membawa nilai lama) tidak boleh menimpa balik ketikan yang lebih baru.
    const recentSaves = useRef<Record<number, Record<string, { value: unknown; until: number }>>>({});
    // Baris yang flush-nya gagal (jaringan/DB) — ditampilkan sebagai badge merah
    // di nomor baris; dicoba ulang otomatis dengan jeda lebih panjang.
    const failedRef = useRef<Set<number>>(new Set());
    const [failedRowIds, setFailedRowIds] = useState<Set<number>>(new Set());

    /** Timpakan perubahan lokal yang belum/baru tersimpan di atas baris dari server.
        Urutan menang: pending (belum dikirim) > in-flight (sedang dikirim) > recent-save
        (baru tersimpan, tahan echo lama) > nilai server. */
    const protectRow = useCallback((serverRow: PesananRow): PesananRow => {
        const id = serverRow.id;
        let out = serverRow;
        const rs = recentSaves.current[id];
        if (rs) {
            const now = Date.now();
            for (const f of Object.keys(rs)) {
                if (rs[f].until > now) out = { ...out, [f]: rs[f].value };
                else delete rs[f];
            }
            if (Object.keys(rs).length === 0) delete recentSaves.current[id];
        }
        const inf = inFlightPatches.current[id];
        if (inf && Object.keys(inf).length > 0) out = { ...out, ...inf };
        const pend = pendingPatches.current[id];
        if (pend && Object.keys(pend).length > 0) out = { ...out, ...pend };
        return out;
    }, []);

    // Helper to fetch data with range or filter
    const fetchRange = async (from: number, to: number, year?: number, month?: number | "all") => {
        // Kolom eksplisit = persis yang dipakai mapRows. select("*") ikut menyeret
        // created_at + last_status_change yang TIDAK pernah dipakai store —
        // dua kolom itu justru yang terberat (±16% dari ±9 MB total unduhan).
        let query = supabase.from("pesanan_rows").select(PESANAN_COLS);

        if (year && month && month !== "all") {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, typeof month === "number" ? month : 0, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            query = query.gte("tanggal", startDate).lte("tanggal", endDate);
        } else if (year) {
            query = query.gte("tanggal", `${year}-01-01`).lte("tanggal", `${year}-12-31`);
        }

        // TERBARU DULU (id menurun): chunk pertama = 1000 baris terbaru — grid
        // Input Pesanan & Produksi langsung bisa dipakai dalam ±1 detik, riwayat
        // lama menyusul di background. State tetap di-sort ulang per id saat merge,
        // jadi urutan tampilan tidak berubah.
        const { data, error } = await query
            .order("id", { ascending: false })
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
            finishing_status: ((r.finishing_status as string) || "belum") as FinishingStatus,
            finishing_operator: (r.finishing_operator as string) || "",
            finishing_at: (r.finishing_at as string) || null,
            is_repair: !!r.is_repair,
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
                // protectRow: jangan timpa ketikan yang belum/baru tersimpan
                const newRows = mapRows(allData).map(protectRow);
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
    }, [protectRow]);

    // Lazy-load: fetch SEMUA baris baru dimulai saat ada halaman yang benar-benar
    // memakai store ini (dipicu usePesanan), BUKAN saat provider mount. Provider ini
    // membungkus seluruh /dashboard, jadi tanpa ini setiap halaman (termasuk
    // workspace Alucurv) ikut mengunduh belasan ribu baris pesanan_rows.
    const startedRef = useRef(false);
    const cancelledRef = useRef(false);
    const [started, setStarted] = useState(false);
    useEffect(() => {
        // Reset saat (re)mount — StrictMode dev menjalankan cleanup lalu setup ulang;
        // tanpa reset, ref tertinggal true dan hasil fetch dibuang selamanya.
        cancelledRef.current = false;
        return () => { cancelledRef.current = true; };
    }, []);

    const ensureLoaded = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        setStarted(true);
        const cancelled = () => cancelledRef.current;
        (async () => {
            try {
                let from = 0;
                let hasMore = true;

                // Load first chunk fast
                const firstChunk = await fetchRange(0, 999);
                if (firstChunk && !cancelled()) {
                    setRows(prev => {
                        // protectRow: jangan timpa ketikan yang belum/baru tersimpan
                        const mapped = mapRows(firstChunk).map(protectRow);
                        const existingIds = new Set(mapped.map(r => r.id));
                        const filteredPrev = prev.filter(r => r.id >= 1000000000 || !existingIds.has(r.id));
                        return [...mapped, ...filteredPrev].sort((a, b) => a.id - b.id);
                    });
                    setLoading(false);
                    
                    if (firstChunk.length < 1000) hasMore = false;
                    else from = 1000;
                } else {
                    hasMore = false;
                    setLoading(false);
                }

                // Load remaining data in background
                while (hasMore && !cancelled()) {
                    const data = await fetchRange(from, from + 999);
                    if (data && data.length > 0) {
                        setRows(prev => {
                            // protectRow: jangan timpa ketikan yang belum/baru tersimpan
                            const mapped = mapRows(data).map(protectRow);
                            const existingIds = new Set(mapped.map(r => r.id));
                            const filteredPrev = prev.filter(r => r.id >= 1000000000 || !existingIds.has(r.id));
                            return [...filteredPrev, ...mapped].sort((a, b) => a.id - b.id);
                        });
                        if (data.length < 1000) hasMore = false;
                        else from += 1000;
                    } else {
                        hasMore = false;
                    }
                }
            } catch (err) {
                console.error("Initial Fetch Error:", err);
            } finally {
                if (!cancelled()) setLoading(false);
            }
        })();
    }, [protectRow]);

    // Realtime Subscription — ikut lazy: baru connect setelah data mulai dimuat,
    // supaya halaman yang tidak memakai pesanan tidak membuka channel sia-sia.
    useEffect(() => {
        if (!started) return;
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
                        // + grace recent-save: echo lama (nilai beda dari yang baru
                        // tersimpan) jangan menimpa balik dalam 8 dtk pertama.
                        const rs = recentSaves.current[existingId] || {};
                        const nowTs = Date.now();

                        const mapped: Partial<PesananRow> = {};
                        if ("id" in row) mapped.id = row.id;

                        const boolFields = new Set(["di_produksi", "di_warna", "siap_kirim", "di_kirim", "is_packing", "is_paid", "is_repair"]);
                        const allFields: (keyof PesananRow)[] = [
                            "tanggal", "customer", "deskripsi", "ukuran", "qty", "harga",
                            "no_inv", "no_sj", "di_produksi", "di_warna", "siap_kirim",
                            "di_kirim", "ekspedisi", "color_marker", "printed_at",
                            "po_label", "is_packing", "is_paid", "production_note",
                            "metode_kirim", "shipped_at", "sync_id",
                            "finishing_status", "finishing_operator", "finishing_at", "is_repair",
                        ];

                        allFields.forEach(f => {
                            // Skip jika field sedang pending ATAU sedang dalam proses save
                            if (f in localPatches || inFlightKeys.has(f)) return;
                            // Skip echo telat yang membawa nilai lama (≠ nilai yang baru disimpan)
                            if (rs[f] && rs[f].until > nowTs && row[f] !== rs[f].value) return;
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
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [started]);

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
        // Simpan juga NILAI-nya — dipakai protectRow saat data server masuk mid-flight
        inFlightPatches.current[id] = { ...(inFlightPatches.current[id] || {}), ...finalPatch };

        savingRef.current[id] = true;
        let resolvedId = id;
        let flushFailed = false;
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
                        pushNotify({
                            notificationType: "pesanan_baru",
                            title: "Pesanan Baru Masuk",
                            body: `${rowToInsert.customer || "Customer"} — ${rowToInsert.deskripsi || "pesanan baru"}`,
                            url: "/dashboard/pesanan",
                        });

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
                        if (inFlightPatches.current[id]) {
                            inFlightPatches.current[newRealId] = inFlightPatches.current[id];
                            delete inFlightPatches.current[id];
                        }
                    }
                }
            }
            // BERHASIL: catat nilai yang baru tersimpan (grace 8 dtk) supaya echo
            // realtime yang telat / chunk load tidak menimpa balik dengan nilai lama.
            const until = Date.now() + 8000;
            if (!recentSaves.current[resolvedId]) recentSaves.current[resolvedId] = {};
            keysToSave.forEach(k => {
                recentSaves.current[resolvedId][k] = { value: (finalPatch as Record<string, unknown>)[k], until };
            });
            if (failedRef.current.has(resolvedId) || failedRef.current.has(id)) {
                failedRef.current.delete(resolvedId);
                failedRef.current.delete(id);
                setFailedRowIds(new Set(failedRef.current));
            }
        } catch (err: any) {
            console.error("Flush Row Error:", err);
            flushFailed = true;
            // Alert hanya saat baris PERTAMA KALI gagal (bukan tiap percobaan ulang)
            // dan bukan karena jaringan putus (itu di-retry diam-diam + badge merah).
            const firstFailure = !failedRef.current.has(id);
            failedRef.current.add(id);
            setFailedRowIds(new Set(failedRef.current));
            if (firstFailure && err?.message && err.message !== "Failed to fetch") {
                alert("Simpan Gagal: " + (err.message || "Masalah Database") + "\nBaris ditandai merah & akan dicoba ulang otomatis.");
            }
        } finally {
            // Hapus savingKeys setelah selesai (berhasil atau gagal)
            keysToSave.forEach(k => savingKeys.current[resolvedId]?.delete(k));
            if (savingKeys.current[resolvedId]?.size === 0) delete savingKeys.current[resolvedId];
            delete inFlightPatches.current[resolvedId];
            delete inFlightPatches.current[id];

            savingRef.current[resolvedId] = false;
            // Jika masih ada patch (baru masuk saat save, atau dikembalikan karena
            // gagal), flush ulang — dengan jeda lebih panjang bila barusan gagal
            // supaya tidak menghujani jaringan/DB tiap 100ms.
            if (pendingPatches.current[resolvedId] && Object.keys(pendingPatches.current[resolvedId]).length > 0) {
                setTimeout(() => flushRow(resolvedId), flushFailed ? 2500 : 100);
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

        // 1. Update PER BARIS — bukan satu upsert batch. Batch upsert Supabase
        //    menuntut semua objek punya kolom yang SAMA; padahal tiap baris pending
        //    kolom berubahnya beda-beda, jadi batch justru gagal total tepat saat
        //    tombol darurat ini paling dibutuhkan. Per baris juga membuat kegagalan
        //    terisolasi: satu baris error, baris lain tetap tersimpan.
        let failedCount = 0;
        for (const u of updates) {
            const { id, ...patch } = u;
            const { error } = await supabase.from("pesanan_rows").update(patch).eq("id", id);
            if (error) {
                console.error("Flush All (update) gagal utk baris", id, error);
                failedCount++;
                failedRef.current.add(id);
            } else {
                delete pendingPatches.current[id];
                failedRef.current.delete(id);
            }
        }

        // 2. Insert baris baru satu per satu (untuk pemulihan ID via sync_id)
        for (let i = 0; i < inserts.length; i++) {
            const tempId = originalTempIds[i];
            const rowPayload = { ...inserts[i], sync_id: String(tempId) };
            const { data, error } = await supabase.from("pesanan_rows").insert(rowPayload).select("id").single();
            if (error) {
                console.error("Flush All (insert) gagal utk baris", tempId, error);
                failedCount++;
                failedRef.current.add(tempId);
            } else if (data?.id) {
                const newRealId = data.id;
                setRows(prev => prev.map(r => r.id === tempId ? { ...r, id: newRealId } : r));
                delete pendingPatches.current[tempId];
                failedRef.current.delete(tempId);
            }
        }

        setFailedRowIds(new Set(failedRef.current));
        if (failedCount > 0) {
            alert(`${failedCount} baris gagal tersimpan (ditandai merah). Periksa koneksi lalu klik Simpan Semua lagi.`);
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
        <PesananCtx.Provider value={{ rows, loading, failedRowIds, updateRow, flushRow, flushAllRows, addRows, addRow, importRows, fetchFilter, ensureLoaded }}>
            {children}
        </PesananCtx.Provider>
    );
}

export function usePesanan() {
    const ctx = useContext(PesananCtx);
    // Halaman yang memakai hook ini otomatis memicu fetch pertama (lazy-load).
    // Effect dipanggil SEBELUM guard throw (rules-of-hooks: urutan hook wajib
    // konsisten antar-render), dengan dep stabil (ensureLoaded = useCallback).
    const ensureLoaded = ctx?.ensureLoaded;
    useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
    if (!ctx) throw new Error("usePesanan must be used inside PesananProvider");
    return ctx;
}
