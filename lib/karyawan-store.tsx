"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";
import { pushNotify } from "@/lib/notify";

/* ================================================================
   KARYAWAN STORE — Supabase-backed
================================================================ */

export type StatusKaryawan = "Full-time" | "Part-time" | "Contract" | "Freelance";

export type DataKaryawan = {
    id: number;
    nama: string;
    jabatan: string;
    divisi: string;
    status: StatusKaryawan;
    gaji_pokok: number;
    gaji_harian: number;
    tanggal_join: string;
    email: string;
    no_hp: string;
    alamat: string;
    bpjs_tk: number;
    bpjs_kes: number;
    catatan: string;
    periode_gaji?: string; // 'bulanan' | 'mingguan'
    tarif_lembur?: number;
};

export type GajiRecord = {
    id: number;
    karyawan_id: number;
    periode: string;          // lama: 'YYYY-MM-Wn' · baru: 'YYYY-MM-DD~YYYY-MM-DD'
    gaji_pokok: number;
    hari_kerja: number;
    hari_lembur: number;
    lembur: number;
    kasbon_potong: number;
    tunjangan: number;
    potongan_lain: number;
    bpjs_tk?: number;
    bpjs_kes?: number;
    catatan: string;
    // Integrasi absensi (kolom aditif 20260722_gaji_absensi.sql) — opsional
    // agar data/pemanggil lama tetap valid.
    periode_mulai?: string;
    periode_selesai?: string;
    tanggal_gajian?: string;
    telat_count?: number;
    telat_menit?: number;
    sumber_hitung?: string;   // 'absensi' | 'manual'
    cash_flow_id?: string;    // tautan entri pengeluaran di Keuangan (anti dobel)
};

export type KasbonRecord = {
    id: number;
    karyawan_id: number;
    tanggal: string;
    nominal: number;
    bayar: number;
    keterangan: string;
};

type Ctx = {
    karyawan: DataKaryawan[];
    gaji: GajiRecord[];
    kasbon: KasbonRecord[];
    loading: boolean;
    addKaryawan: (k: Omit<DataKaryawan, "id">) => void;
    updateKaryawan: (id: number, patch: Partial<DataKaryawan>) => void;
    deleteKaryawan: (id: number) => void;
    upsertGaji: (g: Omit<GajiRecord, "id">) => void;
    addKasbon: (k: Omit<KasbonRecord, "id">) => void;
    updateKasbon: (id: number, patch: Partial<KasbonRecord>) => void;
    deleteKasbon: (id: number) => void;
    /** Dipanggil otomatis oleh useKaryawan — memulai fetch data saat pertama kali dipakai (lazy-load). */
    ensureLoaded: () => void;
};

const KaryawanCtx = createContext<Ctx | null>(null);

/** Ambil semua baris dgn paginasi .range (hindari cap 1000). */
async function fetchAllPaged(
    page: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>
): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await page(from, from + 999);
        if (error) throw error;
        if (data && data.length) { all.push(...data); if (data.length < 1000) break; from += 1000; }
        else break;
    }
    return all;
}

export function KaryawanProvider({ children }: { children: ReactNode }) {
    const [karyawan, setKaryawan] = useState<DataKaryawan[]>([]);
    const [gaji, setGaji] = useState<GajiRecord[]>([]);
    const [kasbon, setKasbon] = useState<KasbonRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Lazy-load: fetch baru dimulai saat ada halaman yang memakai useKaryawan —
    // bukan saat provider mount (provider ini ada di ROOT layout).
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
                const [k, g, b] = await Promise.all([
                    fetchAllPaged((f, t) => supabase.from("karyawan").select("*").order("id").range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("gaji").select("*").order("id").range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("kasbon").select("*").order("id").range(f, t)),
                ]);
                if (!cancelled()) {
                    setKaryawan(k as unknown as DataKaryawan[]);
                    setGaji(g as unknown as GajiRecord[]);
                    setKasbon(b as unknown as KasbonRecord[]);
                }
            } catch {
                // keep empty
            } finally {
                if (!cancelled()) setLoading(false);
            }
        })();
    }, []);

    // Realtime Subscriptions — ikut lazy: baru connect setelah data mulai dimuat.
    useEffect(() => {
        if (!started) return;
        const channel = supabase
            .channel("realtime_karyawan_store")
            // 1. Karyawan
            .on("postgres_changes", { event: "*", schema: "public", table: "karyawan" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setKaryawan(prev => [...prev, n as DataKaryawan]);
                else if (eventType === "UPDATE") setKaryawan(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...(n as any) } : x));
                else if (eventType === "DELETE") setKaryawan(prev => prev.filter(x => x.id !== (o as any).id));
            })
            // 2. Gaji
            .on("postgres_changes", { event: "*", schema: "public", table: "gaji" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setGaji(prev => [...prev, n as GajiRecord]);
                else if (eventType === "UPDATE") setGaji(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...(n as any) } : x));
                else if (eventType === "DELETE") setGaji(prev => prev.filter(x => x.id !== (o as any).id));
            })
            // 3. Kasbon
            .on("postgres_changes", { event: "*", schema: "public", table: "kasbon" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setKasbon(prev => [...prev, n as KasbonRecord]);
                else if (eventType === "UPDATE") setKasbon(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...(n as any) } : x));
                else if (eventType === "DELETE") setKasbon(prev => prev.filter(x => x.id !== (o as any).id));
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [started]);

    const addKaryawan = useCallback((k: Omit<DataKaryawan, "id">) => {
        // We rely solely on Real-time to add the item to the list
        // This prevents the "duplicate" bug where optimistic + real-time both add the item.
        supabase.from("karyawan").insert(k as any).then();
    }, []);

    const updateKaryawan = useCallback((id: number, patch: Partial<DataKaryawan>) => {
        setKaryawan(p => p.map(k => k.id === id ? { ...k, ...patch } : k));
        supabase.from("karyawan").update(patch).eq("id", id).then();
    }, []);

    const deleteKaryawan = useCallback((id: number) => {
        setKaryawan(p => p.filter(k => k.id !== id));
        supabase.from("karyawan").delete().eq("id", id).then();
    }, []);

    const upsertGaji = useCallback(async (g: Omit<GajiRecord, "id">) => {
        // We rely on real-time to update the UI
        const { data: existing } = await supabase
            .from("gaji")
            .select("id")
            .eq("karyawan_id", g.karyawan_id)
            .eq("periode", g.periode)
            .single();

        if (existing) {
            await supabase.from("gaji").update(g as any).eq("id", existing.id);
        } else {
            await supabase.from("gaji").insert(g as any);
        }
    }, []);

    const addKasbon = useCallback((k: Omit<KasbonRecord, "id">) => {
        supabase.from("kasbon").insert(k as any).then((res) => {
            if (!res.error) {
                pushNotify({
                    notificationType: "kasbon",
                    title: "Pengajuan Kasbon Baru",
                    body: `Kasbon Rp${Number(k.nominal || 0).toLocaleString("id-ID")} diajukan`,
                    url: "/dashboard/karyawan",
                });
            }
        });
    }, []);

    const updateKasbon = useCallback((id: number, patch: Partial<KasbonRecord>) => {
        setKasbon(p => p.map(k => k.id === id ? { ...k, ...patch } : k));
        supabase.from("kasbon").update(patch).eq("id", id).then();
    }, []);

    const deleteKasbon = useCallback((id: number) => {
        setKasbon(p => p.filter(k => k.id !== id));
        supabase.from("kasbon").delete().eq("id", id).then();
    }, []);

    return (
        <KaryawanCtx.Provider value={{
            karyawan, gaji, kasbon, loading,
            addKaryawan, updateKaryawan, deleteKaryawan,
            upsertGaji, addKasbon, updateKasbon, deleteKasbon,
            ensureLoaded,
        }}>
            {children}
        </KaryawanCtx.Provider>
    );
}

export function useKaryawan() {
    const ctx = useContext(KaryawanCtx);
    // Halaman yang memakai hook ini otomatis memicu fetch pertama (lazy-load).
    // Effect dipanggil SEBELUM guard throw (rules-of-hooks: urutan hook wajib
    // konsisten antar-render), dengan dep stabil (ensureLoaded = useCallback).
    const ensureLoaded = ctx?.ensureLoaded;
    useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
    if (!ctx) throw new Error("useKaryawan must be used inside KaryawanProvider");
    return ctx;
}
