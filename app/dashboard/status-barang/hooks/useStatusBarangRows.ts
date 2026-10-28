import { useEffect } from "react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase-client";
import { PesananRow } from "@/lib/pesanan-store";
import { createStatusBarangRefresh } from "@/lib/status-barang-refresh";

// Pilih hanya kolom yang dipakai halaman ini agar payload Supabase tidak membengkak.
const STATUS_BARANG_COLS =
    "id,tanggal,customer,deskripsi,ukuran,qty,harga,no_inv,no_sj," +
    "di_produksi,di_warna,siap_kirim,di_kirim,ekspedisi,color_marker," +
    "printed_at,po_label,is_packing,is_paid,production_note,metode_kirim," +
    "shipped_at,sync_id,finishing_status,finishing_operator,finishing_at,is_repair," +
    "created_by,created_at,updated_by,updated_at";

/**
 * Hook khusus Status Barang (SCOPE LOCK)
 * Menggunakan SWR untuk deduplikasi fetch, caching, dan performance.
 * Ditambah fitur Realtime agar sinkron dengan modul Input Pesanan.
 */
export function useStatusBarangRows(year: number, month: number | "all", readOnly = false) {
    const key = `status-barang-rows-${readOnly ? "finishing" : "internal"}-${year}-${month}`;

    const fetcher = async () => {
        // Operator finishing menerima hasil RPC yang hanya berisi data
        // operasional. Kolom harga, invoice, pembayaran, dan audit tidak
        // pernah dikirim ke browser mereka.
        if (readOnly) {
            // PostgREST membatasi respons fungsi pada maksimum 1.000 baris.
            // Ambil semua halaman agar pencarian Finishing tidak kehilangan PO
            // lama hanya karena berada di luar halaman pertama.
            const allData: PesananRow[] = [];
            let from = 0;
            let hasMore = true;

            while (hasMore) {
                const { data, error } = await supabase
                    .rpc("get_finishing_status_barang", {
                        p_year: year,
                        p_month: month === "all" ? null : month,
                    })
                    .range(from, from + 999);
                if (error) throw error;

                const page = (data ?? []) as PesananRow[];
                allData.push(...page);
                if (page.length < 1000) hasMore = false;
                else from += 1000;
            }

            return allData;
        }

        let allData: PesananRow[] = [];
        let from = 0;
        let hasMore = true;

        while (hasMore) {
            let query = supabase.from("pesanan_rows").select(STATUS_BARANG_COLS);

            if (month !== "all") {
                const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
                const lastDay = new Date(year, typeof month === "number" ? month : 0, 0).getDate();
                const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                query = query.gte("tanggal", startDate).lte("tanggal", endDate);
            } else {
                query = query.gte("tanggal", `${year}-01-01`).lte("tanggal", `${year}-12-31`);
            }

            const { data, error } = await query
                .order("id", { ascending: true })
                .range(from, from + 999);

            if (error) throw error;
            if (data && data.length > 0) {
                allData = [...allData, ...(data as unknown as PesananRow[])];
                if (data.length < 1000) hasMore = false;
                else from += 1000;
            } else {
                hasMore = false;
            }
        }

        return allData;
    };

    const { data, error, mutate, isLoading, isValidating } = useSWR<PesananRow[]>(key, fetcher, {
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        refreshInterval: 60_000,
        refreshWhenHidden: false,
        refreshWhenOffline: false,
        dedupingInterval: 2000, // Reduced to 2s for better reactivity
        revalidateIfStale: true,
    });

    // Realtime Listener: Trigger mutate on any change to pesanan_rows
    useEffect(() => {
        // Role finishing tidak boleh subscribe ke tabel sumber yang berisi
        // nominal. Mereka melakukan refresh RPC aman melalui tombol/interval.
        if (readOnly) return;

        // Read the authoritative period instead of patching an incomplete cache.
        // This handles moved dates, missing rows, deletes and reconnect gaps alike.
        const refresh = createStatusBarangRefresh(() => mutate());
        window.addEventListener("erp:payment-changed", refresh.schedule);
        const channel = supabase
            .channel(`status-barang-realtime-${year}-${month}`)
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "pesanan_rows" },
                () => refresh.schedule()
            )
            .subscribe((status) => {
                if (status === "SUBSCRIBED") refresh.schedule();
            });

        return () => {
            window.removeEventListener("erp:payment-changed", refresh.schedule);
            refresh.stop();
            void supabase.removeChannel(channel);
        };
    }, [year, month, mutate, readOnly]);

    // Helper untuk update satu baris di cache lokal & DB
    const updateLocalRow = async (id: number, patch: Partial<PesananRow>) => {
        if (readOnly) throw new Error("Akun Finishing hanya dapat melihat Status Barang.");
        // 1. Optimistic Update
        void mutate((current) => current?.map(r => r.id === id ? { ...r, ...patch } : r), false);

        // 2. Persist to DB
        const { error: dbErr } = await supabase.from("pesanan_rows").update(patch).eq("id", id);
        if (dbErr) {
            console.error("Failed to update row:", dbErr);
            mutate(); // Rollback on error
            throw dbErr;
        }
    };

    // Update satu invoice dalam satu request. Ini menghindari banyak request
    // Supabase ketika satu invoice terdiri dari beberapa baris barang.
    const updateLocalRows = async (ids: number[], patch: Partial<PesananRow>) => {
        if (readOnly) throw new Error("Akun Finishing hanya dapat melihat Status Barang.");
        const uniqueIds = [...new Set(ids)].filter((id) => Number.isFinite(id));
        if (uniqueIds.length === 0) return;

        mutate((current?: PesananRow[]) => {
            if (!current) return current;
            const targets = new Set(uniqueIds);
            return current.map((row) => targets.has(row.id) ? { ...row, ...patch } : row);
        }, false);

        const { error: dbErr } = await supabase
            .from("pesanan_rows")
            .update(patch)
            .in("id", uniqueIds);

        if (dbErr) {
            console.error("Failed to update invoice rows:", dbErr);
            mutate();
            throw dbErr;
        }
    };

    return {
        rows: data || [],
        isLoading,
        isValidating,
        isError: !!error,
        updateLocalRow,
        updateLocalRows,
        mutate,
    };
}
