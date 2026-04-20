import { useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase-client";
import { PesananRow } from "@/lib/pesanan-store";

/**
 * Hook khusus Status Barang (SCOPE LOCK)
 * Menggunakan SWR untuk deduplikasi fetch, caching, dan performance.
 * Ditambah fitur Realtime agar sinkron dengan modul Input Pesanan.
 */
export function useStatusBarangRows(year: number, month: number | "all") {
    const key = `status-barang-rows-${year}-${month}`;

    const fetcher = async () => {
        let query = supabase.from("pesanan_rows").select("*");

        if (month !== "all") {
            const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
            const lastDay = new Date(year, typeof month === "number" ? month : 0, 0).getDate();
            const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
            query = query.gte("tanggal", startDate).lte("tanggal", endDate);
        } else {
            query = query.gte("tanggal", `${year}-01-01`).lte("tanggal", `${year}-12-31`);
        }

        const { data, error } = await query.order("id", { ascending: true });

        if (error) throw error;
        return (data || []) as PesananRow[];
    };

    const { data, error, mutate, isLoading } = useSWR<PesananRow[]>(key as any, fetcher, {
        revalidateOnFocus: true,
        dedupingInterval: 2000, // Reduced to 2s for better reactivity
        revalidateIfStale: true,
    });

    // Realtime Listener: Trigger mutate on any change to pesanan_rows
    useEffect(() => {
        const channel = supabase
            .channel(`status-barang-realtime-${year}-${month}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "pesanan_rows" },
                () => {
                    console.log("Status Barang: Realtime update detected, re-fetching...");
                    mutate();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [year, month, mutate]);

    // Helper untuk update satu baris di cache lokal & DB
    const updateLocalRow = async (id: number, patch: Partial<PesananRow>) => {
        // 1. Optimistic Update
        if (data) {
            const newData = data.map(r => r.id === id ? { ...r, ...patch } : r);
            mutate(newData, false);
        }

        // 2. Persist to DB
        const { error: dbErr } = await supabase.from("pesanan_rows").update(patch).eq("id", id);
        if (dbErr) {
            console.error("Failed to update row:", dbErr);
            mutate(); // Rollback on error
            throw dbErr;
        }
    };

    return {
        rows: data || [],
        isLoading,
        isError: !!error,
        updateLocalRow,
        mutate,
    };
}
