"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export type AlucurvQuotationStatus = "DRAFT" | "DIKIRIM" | "DISETUJUI" | "DIBATALKAN";

export type AlucurvQuotationItem = {
    id: string;
    description: string;
    qty: number;
    unit_price: number;
};

export type AlucurvQuotation = {
    id: string;
    number: string;
    date: string;
    customer: string;
    status: AlucurvQuotationStatus;
    items: AlucurvQuotationItem[];
    subtotal: number;
    discount_amount: number;
    grand_total: number;
    notes: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
};

export type AlucurvQuotationPayload = Omit<AlucurvQuotation, "id" | "created_at" | "updated_at">;
export type QuotationStorageMode = "loading" | "supabase" | "local";

export const ALUCURV_QUOTATIONS_LOCAL_KEY = "alucurv_quotations_local_v1";

function readLocal(): AlucurvQuotation[] {
    if (typeof window === "undefined") return [];
    try {
        const parsed = JSON.parse(localStorage.getItem(ALUCURV_QUOTATIONS_LOCAL_KEY) || "[]");
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeLocal(rows: AlucurvQuotation[]) {
    localStorage.setItem(ALUCURV_QUOTATIONS_LOCAL_KEY, JSON.stringify(rows));
}

function isMissingTableError(error: { code?: string; message?: string }) {
    return error.code === "42P01" || error.code === "PGRST205" || /alu_quotations/i.test(error.message || "") && /not find|does not exist/i.test(error.message || "");
}

export function useAlucurvQuotations() {
    const [rows, setRows] = useState<AlucurvQuotation[]>([]);
    const [mode, setMode] = useState<QuotationStorageMode>("loading");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        const { data, error: queryError } = await supabase
            .from("alu_quotations")
            .select("*")
            .order("date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1000);

        if (queryError) {
            if (isMissingTableError(queryError)) {
                setRows(readLocal());
                setMode("local");
                setError(null);
            } else {
                setRows(readLocal());
                setMode("local");
                setError(`Supabase belum dapat dipakai (${queryError.message}). Data sementara disimpan di perangkat ini.`);
            }
        } else {
            setRows((data ?? []) as AlucurvQuotation[]);
            setMode("supabase");
            setError(null);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        // Sinkronisasi awal dengan tabel eksternal Supabase.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void refresh();
    }, [refresh]);

    const createQuotation = async (payload: AlucurvQuotationPayload) => {
        if (mode === "supabase") {
            const { data, error: insertError } = await supabase
                .from("alu_quotations")
                .insert(payload)
                .select("*")
                .single();
            if (insertError) throw insertError;
            await refresh();
            return data as AlucurvQuotation;
        }

        const now = new Date().toISOString();
        const row: AlucurvQuotation = {
            ...payload,
            id: `local-${crypto.randomUUID()}`,
            created_at: now,
            updated_at: now,
        };
        const next = [row, ...readLocal()];
        writeLocal(next);
        setRows(next);
        return row;
    };

    const updateQuotation = async (id: string, payload: AlucurvQuotationPayload) => {
        if (mode === "supabase" && !id.startsWith("local-")) {
            const { data, error: updateError } = await supabase
                .from("alu_quotations")
                .update(payload)
                .eq("id", id)
                .select("*")
                .single();
            if (updateError) throw updateError;
            await refresh();
            return data as AlucurvQuotation;
        }

        const next = readLocal().map((row) => row.id === id ? { ...row, ...payload, updated_at: new Date().toISOString() } : row);
        writeLocal(next);
        setRows(next);
        const updated = next.find((row) => row.id === id);
        if (!updated) throw new Error("Penawaran lokal tidak ditemukan.");
        return updated;
    };

    const deleteQuotation = async (id: string) => {
        if (mode === "supabase" && !id.startsWith("local-")) {
            const { error: deleteError } = await supabase.from("alu_quotations").delete().eq("id", id);
            if (deleteError) throw deleteError;
            await refresh();
            return;
        }
        const next = readLocal().filter((row) => row.id !== id);
        writeLocal(next);
        setRows(next);
    };

    return { rows, mode, loading, error, refresh, createQuotation, updateQuotation, deleteQuotation };
}
