"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
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
};

const QuoteCtx = createContext<Ctx | null>(null);

export function QuotationProvider({ children }: { children: ReactNode }) {
    const [quotations, setQuotations] = useState<Quotation[]>([]);
    const [loading, setLoading] = useState(true);

    // 1. Initial Fetch
    useEffect(() => {
        let isMounted = true;
        (async () => {
            try {
                const { data, error } = await supabase
                    .from("quotations")
                    .select("*")
                    .order("created_at", { ascending: false });
                
                if (error) throw error;
                if (isMounted) setQuotations(data || []);
            } catch (err) {
                console.error("Failed to fetch quotations:", err);
            } finally {
                if (isMounted) setLoading(false);
            }
        })();
        return () => { isMounted = false; };
    }, []);

    // 2. Real-time Subscription
    useEffect(() => {
        const channel = supabase
            .channel("realtime-quotations")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "quotations" },
                (payload) => {
                    const { eventType, new: n, old: o } = payload;

                    if (eventType === "INSERT") {
                        setQuotations(prev => [n as Quotation, ...prev]);
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
    }, []);

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
        <QuoteCtx.Provider value={{ quotations, loading, addQuotation, updateQuotation, deleteQuotation }}>
            {children}
        </QuoteCtx.Provider>
    );
}

export function useQuotation() {
    const ctx = useContext(QuoteCtx);
    if (!ctx) throw new Error("useQuotation must be used inside QuotationProvider");
    return ctx;
}
