"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

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
};

export type GajiRecord = {
    id: number;
    karyawan_id: number;
    periode: string;
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
};

const KaryawanCtx = createContext<Ctx | null>(null);

export function KaryawanProvider({ children }: { children: ReactNode }) {
    const [karyawan, setKaryawan] = useState<DataKaryawan[]>([]);
    const [gaji, setGaji] = useState<GajiRecord[]>([]);
    const [kasbon, setKasbon] = useState<KasbonRecord[]>([]);
    const [loading, setLoading] = useState(true);

    // Load from Supabase
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [kRes, gRes, bRes] = await Promise.all([
                    supabase.from("karyawan").select("*").order("id"),
                    supabase.from("gaji").select("*").order("id"),
                    supabase.from("kasbon").select("*").order("id"),
                ]);
                if (!cancelled) {
                    if (kRes.data) setKaryawan(kRes.data as DataKaryawan[]);
                    if (gRes.data) setGaji(gRes.data as GajiRecord[]);
                    if (bRes.data) setKasbon(bRes.data as KasbonRecord[]);
                }
            } catch {
                // keep empty
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Realtime Subscriptions
    useEffect(() => {
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
            .subscribe((status) => {
                console.log("Karyawan Store Realtime Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

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
        supabase.from("kasbon").insert(k as any).then();
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
        }}>
            {children}
        </KaryawanCtx.Provider>
    );
}

export function useKaryawan() {
    const ctx = useContext(KaryawanCtx);
    if (!ctx) throw new Error("useKaryawan must be used inside KaryawanProvider");
    return ctx;
}
