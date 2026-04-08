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

    const addKaryawan = useCallback((k: Omit<DataKaryawan, "id">) => {
        // Optimistic — we'll get the real ID back from Supabase
        const tempId = Date.now();
        const newK = { ...k, id: tempId };
        setKaryawan(p => [...p, newK]);
        (async () => {
            const { data } = await supabase.from("karyawan").insert(k).select().single();
            if (data) {
                // Replace temp ID with real one
                setKaryawan(p => p.map(x => x.id === tempId ? (data as DataKaryawan) : x));
            }
        })();
    }, []);

    const updateKaryawan = useCallback((id: number, patch: Partial<DataKaryawan>) => {
        setKaryawan(p => p.map(k => k.id === id ? { ...k, ...patch } : k));
        supabase.from("karyawan").update(patch).eq("id", id).then();
    }, []);

    const deleteKaryawan = useCallback((id: number) => {
        setKaryawan(p => p.filter(k => k.id !== id));
        supabase.from("karyawan").delete().eq("id", id).then();
    }, []);

    const upsertGaji = useCallback((g: Omit<GajiRecord, "id">) => {
        setGaji(p => {
            const idx = p.findIndex(r => r.karyawan_id === g.karyawan_id && r.periode === g.periode);
            if (idx >= 0) {
                const updated = [...p];
                updated[idx] = { ...updated[idx], ...g };
                // Update in DB
                supabase.from("gaji").update(g).eq("karyawan_id", g.karyawan_id).eq("periode", g.periode).then();
                return updated;
            }
            const tempId = Date.now();
            // Insert in DB
            (async () => {
                const { data } = await supabase.from("gaji").insert(g).select().single();
                if (data) {
                    setGaji(prev => prev.map(x => x.id === tempId ? (data as GajiRecord) : x));
                }
            })();
            return [...p, { ...g, id: tempId }];
        });
    }, []);

    const addKasbon = useCallback((k: Omit<KasbonRecord, "id">) => {
        const tempId = Date.now();
        setKasbon(p => [...p, { ...k, id: tempId }]);
        (async () => {
            const { data } = await supabase.from("kasbon").insert(k).select().single();
            if (data) {
                setKasbon(p => p.map(x => x.id === tempId ? (data as KasbonRecord) : x));
            }
        })();
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
