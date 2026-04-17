"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   SURAT JALAN BAHAN BAKU STORE — Supabase-backed
================================================================ */

export type SJBahanItem = {
    materialId: string;
    kode: string;
    nama: string;
    jumlahBatang: number;
    panjangPerBatang: number;
    totalMeter: number;
    catatan: string;
};

export type SJBahanRow = {
    id: string;
    noSJ: string;
    tanggal: string;
    vendorWarna: string;
    warna: string;
    dibuatOleh: string;
    items: SJBahanItem[];
    totalBatang: number;
    totalMeter: number;
    status: "dikirim" | "selesai";
};

function dbToSJBahan(r: Record<string, unknown>, items: Record<string, unknown>[]): SJBahanRow {
    return {
        id: r.id as string,
        noSJ: (r.no_sj as string) || "",
        tanggal: (r.tanggal as string) || "",
        vendorWarna: (r.vendor_warna as string) || "",
        warna: (r.warna as string) || "",
        dibuatOleh: (r.dibuat_oleh as string) || "",
        totalBatang: Number(r.total_batang) || 0,
        totalMeter: Number(r.total_meter) || 0,
        status: (r.status as SJBahanRow["status"]) || "dikirim",
        items: items.map(it => ({
            materialId: (it.material_id as string) || "",
            kode: (it.kode as string) || "",
            nama: (it.nama as string) || "",
            jumlahBatang: Number(it.jumlah_batang) || 0,
            panjangPerBatang: Number(it.panjang_per_batang) || 6,
            totalMeter: Number(it.total_meter) || 0,
            catatan: (it.catatan as string) || "",
        })),
    };
}

type Ctx = {
    sjBahan: SJBahanRow[];
    loading: boolean;
    addSJBahan: (sj: Omit<SJBahanRow, "id">) => Promise<string>;
    updateSJBahan: (id: string, updates: Partial<SJBahanRow>) => void;
    deleteSJBahan: (id: string) => void;
};

const SJBahanCtx = createContext<Ctx | null>(null);

export function SJBahanProvider({ children }: { children: ReactNode }) {
    const [sjBahan, setSjBahan] = useState<SJBahanRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: headers } = await supabase
                    .from("sj_bahan")
                    .select("*")
                    .order("tanggal", { ascending: false });

                if (!cancelled && headers) {
                    const ids = headers.map(h => h.id);
                    let itemsData: Record<string, unknown>[] = [];
                    if (ids.length > 0) {
                        const { data: items } = await supabase
                            .from("sj_bahan_items")
                            .select("*")
                            .in("sj_bahan_id", ids);
                        if (items) itemsData = items;
                    }
                    setSjBahan(headers.map(h =>
                        dbToSJBahan(h, itemsData.filter(it => (it as Record<string, unknown>).sj_bahan_id === h.id))
                    ));
                }
            } catch { /* keep empty */ }
            finally { if (!cancelled) setLoading(false); }
        })();
        return () => { cancelled = true; };
    }, []);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase
            .channel("realtime_sj_bahan_store")
            // 1. Headers (sj_bahan)
            .on("postgres_changes", { event: "*", schema: "public", table: "sj_bahan" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setSjBahan(prev => [dbToSJBahan(n, []), ...prev]);
                } else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<SJBahanRow> = {};
                    if ("no_sj" in row) mapped.noSJ = row.no_sj;
                    if ("tanggal" in row) mapped.tanggal = row.tanggal;
                    if ("vendor_warna" in row) mapped.vendorWarna = row.vendor_warna;
                    if ("warna" in row) mapped.warna = row.warna;
                    if ("dibuat_oleh" in row) mapped.dibuatOleh = row.dibuat_oleh;
                    if ("total_batang" in row) mapped.totalBatang = row.total_batang;
                    if ("total_meter" in row) mapped.totalMeter = row.total_meter;
                    if ("status" in row) mapped.status = row.status;

                    setSjBahan(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                } else if (eventType === "DELETE") {
                    setSjBahan(prev => prev.filter(x => x.id !== (o as any).id));
                }
            })
            // 2. Items (sj_bahan_items) - Simple approach: re-fetch items for affected SJ if changed
            // Or just update the nested array
            .on("postgres_changes", { event: "*", schema: "public", table: "sj_bahan_items" }, async (payload) => {
                const { new: ni, old: oi } = payload;
                const sjId = ((ni as any)?.sj_bahan_id || (oi as any)?.sj_bahan_id) as string;
                if (!sjId) return;

                // For accuracy with nested data, we re-fetch items for this SJ ID
                const { data } = await supabase.from("sj_bahan_items").select("*").eq("sj_bahan_id", sjId);
                if (data) {
                    setSjBahan(prev => prev.map(sj => sj.id === sjId ? {
                        ...sj,
                        items: data.map((it: Record<string, any>) => ({
                            materialId: it.material_id,
                            kode: it.kode,
                            nama: it.nama,
                            jumlahBatang: it.jumlah_batang,
                            panjangPerBatang: it.panjang_per_batang,
                            totalMeter: it.total_meter,
                            catatan: it.catatan,
                        }))
                    } : sj));
                }
            })
            .subscribe((status) => {
                console.log("Surat Jalan Bahan Store Realtime Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addSJBahan = useCallback(async (sj: Omit<SJBahanRow, "id">): Promise<string> => {
        const id = `SJB-${Date.now()}`;
        setSjBahan(prev => [{ ...sj, id }, ...prev]);
        try {
            const { error: err1 } = await supabase.from("sj_bahan").insert({
                id,
                no_sj: sj.noSJ,
                tanggal: sj.tanggal,
                vendor_warna: sj.vendorWarna,
                warna: sj.warna,
                dibuat_oleh: sj.dibuatOleh,
                total_batang: sj.totalBatang,
                total_meter: sj.totalMeter,
                status: sj.status,
            });
            if (err1) throw err1;

            if (sj.items.length > 0) {
                const { error: err2 } = await supabase.from("sj_bahan_items").insert(
                    sj.items.map(it => ({
                        sj_bahan_id: id,
                        material_id: it.materialId,
                        kode: it.kode,
                        nama: it.nama,
                        jumlah_batang: it.jumlahBatang,
                        panjang_per_batang: it.panjangPerBatang,
                        total_meter: it.totalMeter,
                        catatan: it.catatan,
                    }))
                );
                if (err2) throw err2;
            }
            return id;
        } catch (err: any) {
            console.error("Error creating sj_bahan:", err);
            setSjBahan(prev => prev.filter(x => x.id !== id));
            alert("Gagal menyimpan SJ Bahan: " + (err.message || "Unknown Error"));
            throw err;
        }
    }, []);

    const updateSJBahan = useCallback((id: string, updates: Partial<SJBahanRow>) => {
        setSjBahan(prev => prev.map(s => (s.id === id ? { ...s, ...updates } : s)));
        const dbUp: Record<string, unknown> = {};
        if (updates.noSJ !== undefined) dbUp.no_sj = updates.noSJ;
        if (updates.tanggal !== undefined) dbUp.tanggal = updates.tanggal;
        if (updates.vendorWarna !== undefined) dbUp.vendor_warna = updates.vendorWarna;
        if (updates.warna !== undefined) dbUp.warna = updates.warna;
        if (updates.dibuatOleh !== undefined) dbUp.dibuat_oleh = updates.dibuatOleh;
        if (updates.totalBatang !== undefined) dbUp.total_batang = updates.totalBatang;
        if (updates.totalMeter !== undefined) dbUp.total_meter = updates.totalMeter;
        if (updates.status !== undefined) dbUp.status = updates.status;
        if (Object.keys(dbUp).length > 0) {
            supabase.from("sj_bahan").update(dbUp).eq("id", id).then();
        }
    }, []);

    const deleteSJBahan = useCallback((id: string) => {
        setSjBahan(prev => prev.filter(s => s.id !== id));
        supabase.from("sj_bahan").delete().eq("id", id).then();
    }, []);

    return (
        <SJBahanCtx.Provider value={{ sjBahan, loading, addSJBahan, updateSJBahan, deleteSJBahan }}>
            {children}
        </SJBahanCtx.Provider>
    );
}

export function useSJBahan() {
    const ctx = useContext(SJBahanCtx);
    if (!ctx) throw new Error("useSJBahan must be used inside SJBahanProvider");
    return ctx;
}
