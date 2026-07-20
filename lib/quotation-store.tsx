"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";

/* ================================================================
   QUOTATION STORE — Real-time Supabase Data
   ================================================================ */

export interface QuoteItem {
    id: string;
    description: string;
    size: string;
    qty: string;
    price: string;
    total: number;
}

export interface Quotation {
    id: string;
    no_quote: string;
    customer: string;
    tanggal: string;
    items: QuoteItem[];
    subtotal: number;
    dp: number;
    diskon: number;
    grand_total: number;
    notes: string;
    created_by?: string;
    created_at?: string;
}

type Ctx = {
    quotations: Quotation[];
    loading: boolean;
    addQuotation: (q: Omit<Quotation, "id" | "created_at">) => Promise<void>;
    updateQuotation: (id: string, q: Partial<Quotation>) => Promise<void>;
    deleteQuotation: (id: string) => Promise<void>;
    /** Dipanggil otomatis oleh useQuotation — memulai fetch data saat pertama kali dipakai (lazy-load). */
    ensureLoaded: () => void;
};

const QuoteCtx = createContext<Ctx | null>(null);

export function QuotationProvider({ children }: { children: ReactNode }) {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Lazy-load: fetch baru dimulai saat ada halaman yang memakai useQuotation.
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
        const isMounted = () => !cancelledRef.current;
        (async () => {
            try {
                // Paginasi (hindari cap 1000 → penawaran lama tidak hilang)
                const all: Quotation[] = [];
                let from = 0;
                while (true) {
                    const { data, error } = await supabase
                        .from("quotations").select("*")
                        .order("created_at", { ascending: false })
                        .range(from, from + 999);
                    if (error) throw error;
                    if (data && data.length) { all.push(...(data as Quotation[])); if (data.length < 1000) break; from += 1000; }
                    else break;
                }
                if (isMounted()) setQuotations(all);
            } catch (err) {
                console.error("Failed to fetch quotations:", err);
            } finally {
                if (isMounted()) setLoading(false);
            }
        })();
    }, []);

    // 2. Real-time Subscription — ikut lazy: baru connect setelah data mulai dimuat.
    useEffect(() => {
        if (!started) return;
        const channel = supabase
            .channel("realtime-quotations")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "quotations" },
                (payload) => {
                    const { eventType, new: n, old: o } = payload;

                    if (eventType === "INSERT") {
                        setQuotations(prev => prev.some(q => q.id === (n as Quotation).id) ? prev : [n as Quotation, ...prev]);
                    } else if (eventType === "UPDATE") {
                        setQuotations(prev =>
                            prev.map(q => (q.id === n.id ? (n as Quotation) : q))
                        );
                    } else if (eventType === "DELETE") {
                        setQuotations(prev => prev.filter(q => q.id !== o.id));
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [started]);

    const addQuotation = useCallback(async (q: Omit<Quotation, "id" | "created_at">) => {
        const { error } = await supabase.from("quotations").insert([q]);
        if (error) throw error;
    }, []);

    const updateQuotation = useCallback(async (id: string, q: Partial<Quotation>) => {
        const { error } = await supabase
            .from("quotations")
            .update(q)
            .eq("id", id);
        if (error) throw error;
    }, []);

    const deleteQuotation = useCallback(async (id: string) => {
        const { error } = await supabase.from("quotations").delete().eq("id", id);
        if (error) throw error;
    }, []);

    return (
        <QuoteCtx.Provider value={{ quotations, loading, addQuotation, updateQuotation, deleteQuotation, ensureLoaded }}>
            {children}
        </QuoteCtx.Provider>
    );
}

export function useQuotation() {
    const ctx = useContext(QuoteCtx);
    // Halaman yang memakai hook ini otomatis memicu fetch pertama (lazy-load).
    // Effect dipanggil SEBELUM guard throw (rules-of-hooks: urutan hook wajib
    // konsisten antar-render), dengan dep stabil (ensureLoaded = useCallback).
    const ensureLoaded = ctx?.ensureLoaded;
    useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
    if (!ctx) throw new Error("useQuotation must be used inside QuotationProvider");
    return ctx;
}
