"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   TAGIHAN BAHAN BAKU STORE — Supabase-backed
================================================================ */

export type TagihanBahanItem = {
    id: string;
    namaBahan: string;
    qty: number;
    ukuran: number;
    hargaSatuan: number;
    total: number;
};

export type TagihanBahan = {
    id: string;
    noInvoice: string;
    tanggal: string;
    supplier: string;
    catatan: string;
    items: TagihanBahanItem[];
    grandTotal: number;
    isPaid: boolean;
    paidDate: string;
};

function dbToTagihan(r: Record<string, unknown>, items: Record<string, unknown>[]): TagihanBahan {
    return {
        id: r.id as string,
        noInvoice: (r.no_invoice as string) || "",
        tanggal: (r.tanggal as string) || "",
        supplier: (r.supplier as string) || "",
        catatan: (r.catatan as string) || "",
        grandTotal: Number(r.grand_total) || 0,
        isPaid: !!r.is_paid,
        paidDate: (r.paid_date as string) || "",
        items: items.map(it => ({
            id: it.id as string,
            namaBahan: (it.nama_bahan as string) || "",
            qty: Number(it.qty) || 0,
            ukuran: Number(it.ukuran) || 6,
            hargaSatuan: Number(it.harga_satuan) || 0,
            total: Number(it.total) || 0,
        })),
    };
}

type Ctx = {
    tagihanList: TagihanBahan[];
    loading: boolean;
    addTagihan: (t: Omit<TagihanBahan, "id">) => string;
    updateTagihan: (id: string, updates: Partial<TagihanBahan>) => void;
    deleteTagihan: (id: string) => void;
};

const TagihanBahanCtx = createContext<Ctx | null>(null);

export function TagihanBahanProvider({ children }: { children: ReactNode }) {
    const [tagihanList, setTagihanList] = useState<TagihanBahan[]>([]);
    const [loading, setLoading] = useState(true);

    // Load from Supabase
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data: headers } = await supabase
                    .from("tagihan_bahan")
                    .select("*")
                    .order("tanggal", { ascending: false });

                if (!cancelled && headers) {
                    const ids = headers.map(h => h.id);
                    let itemsData: Record<string, unknown>[] = [];
                    if (ids.length > 0) {
                        const { data: items } = await supabase
                            .from("tagihan_bahan_items")
                            .select("*")
                            .in("tagihan_id", ids);
                        if (items) itemsData = items;
                    }
                    const mapped = headers.map(h =>
                        dbToTagihan(h, itemsData.filter(it => (it as Record<string, unknown>).tagihan_id === h.id))
                    );
                    setTagihanList(mapped);
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
            .channel("realtime_tagihan_bahan_store")
            // 1. Headers (tagihan_bahan)
            .on("postgres_changes", { event: "*", schema: "public", table: "tagihan_bahan" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setTagihanList(prev => [dbToTagihan(n, []), ...prev]);
                } else if (eventType === "UPDATE") {
                    setTagihanList(prev => prev.map(x => x.id === n.id ? { ...x, ...dbToTagihan(n, x.items) } : x));
                } else if (eventType === "DELETE") {
                    setTagihanList(prev => prev.filter(x => x.id === o.id));
                }
            })
            // 2. Items (tagihan_bahan_items)
            .on("postgres_changes", { event: "*", schema: "public", table: "tagihan_bahan_items" }, async (payload) => {
                const { new: ni, old: oi } = payload;
                const hId = ((ni as any)?.tagihan_id || (oi as any)?.tagihan_id) as string;
                if (!hId) return;

                const { data } = await supabase.from("tagihan_bahan_items").select("*").eq("tagihan_id", hId);
                if (data) {
                    setTagihanList(prev => prev.map(h => h.id === hId ? {
                        ...h,
                        items: data.map((it: Record<string, any>) => ({
                            id: it.id,
                            namaBahan: it.nama_bahan,
                            qty: it.qty,
                            ukuran: it.ukuran,
                            hargaSatuan: it.harga_satuan,
                            total: it.total,
                        }))
                    } : h));
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const addTagihan = useCallback((t: Omit<TagihanBahan, "id">): string => {
        const id = `TB-${Date.now()}`;
        const newT = { ...t, id };
        setTagihanList(prev => [newT, ...prev]);

        // Persist
        (async () => {
            await supabase.from("tagihan_bahan").insert({
                id,
                no_invoice: t.noInvoice,
                tanggal: t.tanggal,
                supplier: t.supplier,
                catatan: t.catatan,
                grand_total: t.grandTotal,
                is_paid: t.isPaid,
                paid_date: t.paidDate,
            });
            if (t.items.length > 0) {
                await supabase.from("tagihan_bahan_items").insert(
                    t.items.map(it => ({
                        id: it.id || `TBI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                        tagihan_id: id,
                        nama_bahan: it.namaBahan,
                        qty: it.qty,
                        ukuran: it.ukuran,
                        harga_satuan: it.hargaSatuan,
                        total: it.total,
                    }))
                );
            }
        })();
        return id;
    }, []);

    const updateTagihan = useCallback((id: string, updates: Partial<TagihanBahan>) => {
        setTagihanList(prev => prev.map(t => (t.id === id ? { ...t, ...updates } : t)));
        const dbUpdates: Record<string, unknown> = {};
        if (updates.noInvoice !== undefined) dbUpdates.no_invoice = updates.noInvoice;
        if (updates.tanggal !== undefined) dbUpdates.tanggal = updates.tanggal;
        if (updates.supplier !== undefined) dbUpdates.supplier = updates.supplier;
        if (updates.catatan !== undefined) dbUpdates.catatan = updates.catatan;
        if (updates.grandTotal !== undefined) dbUpdates.grand_total = updates.grandTotal;
        if (updates.isPaid !== undefined) dbUpdates.is_paid = updates.isPaid;
        if (updates.paidDate !== undefined) dbUpdates.paid_date = updates.paidDate;
        if (Object.keys(dbUpdates).length > 0) {
            supabase.from("tagihan_bahan").update(dbUpdates).eq("id", id).then();
        }
    }, []);

    const deleteTagihan = useCallback((id: string) => {
        setTagihanList(prev => prev.filter(t => t.id !== id));
        supabase.from("tagihan_bahan").delete().eq("id", id).then();
    }, []);

    return (
        <TagihanBahanCtx.Provider value={{ tagihanList, loading, addTagihan, updateTagihan, deleteTagihan }}>
            {children}
        </TagihanBahanCtx.Provider>
    );
}

export function useTagihanBahan() {
    const ctx = useContext(TagihanBahanCtx);
    if (!ctx) throw new Error("useTagihanBahan must be used inside TagihanBahanProvider");
    return ctx;
}
