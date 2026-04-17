"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   SURAT JALAN STORE — Supabase-backed
================================================================ */

export type SJType = "customer" | "pewarnaan";

export type SuratJalanRow = {
    id: string;
    type: SJType;
    tanggal: string;
    noSJ: string;
    vendor: string;
    ekspedisi: string;
    dibuat_oleh: string;
    items: SJItem[];
    statusPengiriman: string;
    nomorResi: string | null;
    catatanPengiriman: string | null;
    tanggalDiterima: string | null;
    updatedAt: string | null;
};

export type SJItem = {
    pesananId: number;
    customer: string;
    deskripsi: string;
    ukuran: string;
    qty: string;
    noInv: string;
};

function dbToSuratJalan(r: Record<string, unknown>, items: Record<string, unknown>[]): SuratJalanRow {
    return {
        id: r.id as string,
        type: (r.type as SJType) || "customer",
        tanggal: (r.tanggal as string) || "",
        noSJ: (r.no_sj as string) || "",
        vendor: (r.vendor as string) || "",
        ekspedisi: (r.ekspedisi as string) || "",
        dibuat_oleh: (r.dibuat_oleh as string) || "",
        statusPengiriman: (r.status_pengiriman as string) || "Diproses",
        nomorResi: (r.nomor_resi as string) || null,
        catatanPengiriman: (r.catatan_pengiriman as string) || null,
        tanggalDiterima: (r.tanggal_diterima as string) || null,
        updatedAt: (r.updated_at as string) || null,
        items: items.map(it => ({
            pesananId: (it.pesanan_id as number) || 0,
            customer: (it.customer as string) || "",
            deskripsi: (it.deskripsi as string) || "",
            ukuran: (it.ukuran as string) || "",
            qty: (it.qty as string) || "",
            noInv: (it.no_inv as string) || "",
        })),
    };
}

type Ctx = {
    suratJalans: SuratJalanRow[];
    loading: boolean;
    addSJ: (sj: Omit<SuratJalanRow, "id" | "statusPengiriman" | "nomorResi" | "catatanPengiriman" | "tanggalDiterima" | "updatedAt">) => string;
    updateSJStatus: (id: string, partial: Partial<SuratJalanRow>) => void;
    deleteSJ: (id: string) => void;
};

const SJCtx = createContext<Ctx | null>(null);

export function SuratJalanProvider({ children }: { children: ReactNode }) {
    const [suratJalans, setSuratJalans] = useState<SuratJalanRow[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: headers, error: headersErr } = await supabase
                    .from("surat_jalan")
                    .select("*")
                    .order("tanggal", { ascending: false });

                if (headersErr) console.error("Error fetching surat_jalan:", headersErr);

                if (!cancelled && headers) {
                    const ids = headers.map(h => h.id);
                    let itemsData: Record<string, unknown>[] = [];
                    if (ids.length > 0) {
                        const { data: items, error: itemsErr } = await supabase
                            .from("surat_jalan_items")
                            .select("*")
                            .in("surat_jalan_id", ids);
                        if (itemsErr) console.error("Error fetching surat_jalan_items:", itemsErr);
                        if (items) itemsData = items;
                    }
                    setSuratJalans(headers.map(h =>
                        dbToSuratJalan(h, itemsData.filter(it => (it as Record<string, unknown>).surat_jalan_id === h.id))
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
            .channel("realtime_surat_jalan_store")
            // 1. Headers (surat_jalan)
            .on("postgres_changes", { event: "*", schema: "public", table: "surat_jalan" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setSuratJalans(prev => [dbToSuratJalan(n, []), ...prev]);
                } else if (eventType === "UPDATE") {
                    setSuratJalans(prev => prev.map(x => x.id === n.id ? { ...x, ...dbToSuratJalan(n, x.items) } : x));
                } else if (eventType === "DELETE") {
                    setSuratJalans(prev => prev.filter(x => x.id !== o.id));
                }
            })
            // 2. Items (surat_jalan_items)
            .on("postgres_changes", { event: "*", schema: "public", table: "surat_jalan_items" }, async (payload) => {
                const { new: ni, old: oi } = payload;
                const sjId = ((ni as any)?.surat_jalan_id || (oi as any)?.surat_jalan_id) as string;
                if (!sjId) return;

                const { data } = await supabase.from("surat_jalan_items").select("*").eq("surat_jalan_id", sjId);
                if (data) {
                    setSuratJalans(prev => prev.map(sj => sj.id === sjId ? {
                        ...sj,
                        items: data.map((it: Record<string, any>) => ({
                            pesananId: it.pesanan_id,
                            customer: it.customer,
                            deskripsi: it.deskripsi,
                            ukuran: it.ukuran,
                            qty: it.qty,
                            noInv: it.no_inv,
                        }))
                    } : sj));
                }
            })
            .subscribe((status) => {
                console.log("Surat Jalan Store Realtime Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addSJ = useCallback((sj: Omit<SuratJalanRow, "id" | "statusPengiriman" | "nomorResi" | "catatanPengiriman" | "tanggalDiterima" | "updatedAt">): string => {
        const id = `SJ-${Date.now()}`;
        const newSj: SuratJalanRow = { 
            ...sj, 
            id, 
            statusPengiriman: "Diproses", 
            nomorResi: null, 
            catatanPengiriman: null, 
            tanggalDiterima: null, 
            updatedAt: null 
        };
        
        // Optimistic update
        setSuratJalans(prev => [newSj, ...prev]);

        (async () => {
            try {
                // 1. Insert Header
                const { error: err1 } = await supabase.from("surat_jalan").insert({
                    id,
                    type: sj.type,
                    tanggal: sj.tanggal,
                    no_sj: sj.noSJ,
                    vendor: sj.vendor,
                    ekspedisi: sj.ekspedisi,
                    dibuat_oleh: sj.dibuat_oleh,
                });
                
                if (err1) throw err1;

                // 2. Insert Items
                if (sj.items.length > 0) {
                    const { error: err2 } = await supabase.from("surat_jalan_items").insert(
                        sj.items.map(it => ({
                            surat_jalan_id: id,
                            pesanan_id: it.pesananId,
                            customer: it.customer,
                            deskripsi: it.deskripsi,
                            ukuran: it.ukuran,
                            qty: it.qty,
                            no_inv: it.noInv,
                        }))
                    );
                    if (err2) throw err2;
                }
            } catch (err: any) {
                console.error("Error creating surat_jalan:", err);
                // Rollback optimistic update
                setSuratJalans(prev => prev.filter(x => x.id !== id));
                alert("Gagal menyimpan Surat Jalan ke Database: " + (err.message || "Unknown Error"));
            }
        })();
        return id;
    }, []);

    const deleteSJ = useCallback(async (id: string) => {
        const target = suratJalans.find(s => s.id === id);
        if (!target) return;

        if (!confirm(`Hapus Surat Jalan ${target.noSJ}?`)) return;

        // Optimistic update
        setSuratJalans(prev => prev.filter(s => s.id !== id));

        try {
            const { error } = await supabase.from("surat_jalan").delete().eq("id", id);
            if (error) throw error;
        } catch (err: any) {
            console.error("Error deleting surat_jalan:", err);
            // Rollback
            setSuratJalans(prev => [target, ...prev].sort((a, b) => b.tanggal.localeCompare(a.tanggal)));
            alert("Gagal menghapus Surat Jalan: " + (err.message || "Unknown Error"));
        }
    }, [suratJalans]);

    const updateSJStatus = useCallback(async (id: string, partialData: Partial<SuratJalanRow>) => {
        const oldData = suratJalans.find(sj => sj.id === id);
        if (!oldData) return;

        // Optimistic update
        setSuratJalans(prev => prev.map(sj => sj.id === id ? { ...sj, ...partialData } : sj));
        
        try {
            const dbPayload: any = { updated_at: new Date().toISOString() };
            if (partialData.statusPengiriman !== undefined) dbPayload.status_pengiriman = partialData.statusPengiriman;
            if (partialData.nomorResi !== undefined) dbPayload.nomor_resi = partialData.nomorResi;
            if (partialData.catatanPengiriman !== undefined) dbPayload.catatan_pengiriman = partialData.catatanPengiriman;
            if (partialData.tanggalDiterima !== undefined) dbPayload.tanggal_diterima = partialData.tanggalDiterima;

            const { error } = await supabase.from("surat_jalan").update(dbPayload).eq("id", id);
            if (error) throw error;
        } catch (err: any) {
            console.error("Error updating SJ status:", err);
            // Rollback
            setSuratJalans(prev => prev.map(sj => sj.id === id ? oldData : sj));
            alert("Gagal mengupdate status Surat Jalan: " + (err.message || "Unknown Error"));
        }
    }, [suratJalans]);

    return (
        <SJCtx.Provider value={{ suratJalans, loading, addSJ, updateSJStatus, deleteSJ }}>
            {children}
        </SJCtx.Provider>
    );
}

export function useSuratJalan() {
    const ctx = useContext(SJCtx);
    if (!ctx) throw new Error("useSuratJalan must be used inside SuratJalanProvider");
    return ctx;
}
