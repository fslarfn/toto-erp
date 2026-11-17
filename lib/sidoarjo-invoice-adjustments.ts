"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

export type SidoarjoInvoiceAdjustment = { invoice_number: string; dp_amount: number; manual_dp_amount: number; discount_amount: number };
const PREFIX = "SIDOARJO:";
const LOCAL_KEY = "toto:sidoarjo:invoice-adjustments:local";
const clean = (value: unknown) => Math.max(0, Math.round(Number(value) || 0));

function localItems(): SidoarjoInvoiceAdjustment[] {
    try {
        const items = JSON.parse(window.localStorage.getItem(LOCAL_KEY) || "[]");
        return Array.isArray(items) ? items.map((item) => ({ invoice_number: String(item.invoice_number || ""), dp_amount: clean(item.dp_amount), manual_dp_amount: clean(item.manual_dp_amount), discount_amount: clean(item.discount_amount) })).filter((item) => item.invoice_number) : [];
    } catch { return []; }
}

export function useSidoarjoInvoiceAdjustments() {
    const [items, setItems] = useState<SidoarjoInvoiceAdjustment[]>([]);
    const [storage, setStorage] = useState<"loading" | "database" | "local-preview">("loading");
    const reload = useCallback(async () => {
        const { data, error } = await supabase.from("invoice_adjustments").select("invoice_number,dp_amount,manual_dp_amount,discount_amount").like("invoice_number", `${PREFIX}%`);
        if (!error) { setItems((data || []).map((item) => ({ invoice_number: String(item.invoice_number).slice(PREFIX.length), dp_amount: clean(item.dp_amount), manual_dp_amount: clean(item.manual_dp_amount), discount_amount: clean(item.discount_amount) }))); setStorage("database"); return; }
        if (process.env.NODE_ENV === "development") { setItems(localItems()); setStorage("local-preview"); return; }
        throw error;
    }, []);
    useEffect(() => { void reload().catch(console.error); }, [reload]);
    const save = useCallback(async (invoice: string, patch: Partial<Pick<SidoarjoInvoiceAdjustment, "manual_dp_amount" | "discount_amount">>) => {
        const number = String(invoice || "").trim(); if (!number) throw new Error("Nomor invoice wajib diisi.");
        const current = items.find((item) => item.invoice_number === number);
        const next = { invoice_number: number, dp_amount: clean(current?.dp_amount), manual_dp_amount: clean(patch.manual_dp_amount ?? current?.manual_dp_amount), discount_amount: clean(patch.discount_amount ?? current?.discount_amount) };
        if (storage === "database") {
            const dbKey = `${PREFIX}${number}`;
            const { error } = current ? await supabase.from("invoice_adjustments").update({ manual_dp_amount: next.manual_dp_amount, discount_amount: next.discount_amount }).eq("invoice_number", dbKey) : await supabase.from("invoice_adjustments").insert({ invoice_number: dbKey, manual_dp_amount: next.manual_dp_amount, discount_amount: next.discount_amount });
            if (error) throw error;
        } else if (storage === "local-preview") window.localStorage.setItem(LOCAL_KEY, JSON.stringify([...items.filter((item) => item.invoice_number !== number), next]));
        else throw new Error("DP dan diskon sedang dimuat.");
        setItems((previous) => [...previous.filter((item) => item.invoice_number !== number), next]);
    }, [items, storage]);
    return { adjustments: useMemo(() => new Map(items.map((item) => [item.invoice_number, item])), [items]), save, storage };
}
