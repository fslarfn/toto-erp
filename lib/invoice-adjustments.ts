"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";
import { normalizeInvoiceNumber } from "@/lib/payments/legacy-payment-policy";
export { calculateInvoiceAmounts, type InvoiceAmounts } from "@/lib/invoice-adjustment-calculations";

export type InvoiceAdjustment = {
    invoice_number: string;
    /** DP yang berasal dari transaksi DP Invoice di Keuangan. */
    dp_amount: number;
    /** DP lama/manual yang belum tercatat sebagai transaksi Keuangan. */
    manual_dp_amount: number;
    discount_amount: number;
    updated_at?: string;
};


const LOCAL_STORAGE_KEY = "toto:invoice-adjustments:local";
const CHANGE_EVENT = "erp:invoice-adjustments-changed";

function nonNegative(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

function readLocal(): InvoiceAdjustment[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = JSON.parse(window.localStorage.getItem(LOCAL_STORAGE_KEY) || "[]");
        if (!Array.isArray(stored)) return [];
        return stored
            .map((item): InvoiceAdjustment => ({
                invoice_number: normalizeInvoiceNumber(item?.invoice_number),
                dp_amount: nonNegative(item?.dp_amount),
                manual_dp_amount: nonNegative(item?.manual_dp_amount),
                discount_amount: nonNegative(item?.discount_amount),
                updated_at: typeof item?.updated_at === "string" ? item.updated_at : undefined,
            }))
            .filter((item) => !!item.invoice_number);
    } catch {
        return [];
    }
}

function writeLocal(items: InvoiceAdjustment[]) {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

function toMap(items: InvoiceAdjustment[]) {
    return new Map(items.map((item) => [normalizeInvoiceNumber(item.invoice_number), item]));
}

/**
 * Sumber data DP/diskon per invoice.
 *
 * Saat pengujian lokal sebelum migrasi diterapkan, browser memakai localStorage
 * agar alur Status Barang → Invoice → Tagihan dapat diuji tanpa menyentuh data
 * produksi. Setelah tabel invoice_adjustments tersedia, data otomatis dibaca
 * dan disimpan ke Supabase.
 */
export function useInvoiceAdjustments() {
    const [items, setItems] = useState<InvoiceAdjustment[]>([]);
    const [storage, setStorage] = useState<"loading" | "database" | "local-preview">("loading");

    const reload = useCallback(async () => {
        const { data, error } = await supabase
            .from("invoice_adjustments")
            .select("invoice_number,dp_amount,manual_dp_amount,discount_amount,updated_at")
            .order("updated_at", { ascending: false });

        if (!error) {
            const next = (data || []).map((item): InvoiceAdjustment => ({
                invoice_number: normalizeInvoiceNumber(item.invoice_number),
                dp_amount: nonNegative(item.dp_amount),
                manual_dp_amount: nonNegative(item.manual_dp_amount),
                discount_amount: nonNegative(item.discount_amount),
                updated_at: item.updated_at || undefined,
            }));
            setItems(next);
            setStorage("database");
            return;
        }

        // Table belum ada hanya boleh memakai fallback saat development. Di
        // production, error tetap terlihat agar deploy tidak diam-diam memakai
        // data browser yang tidak tersinkron antar perangkat.
        if (process.env.NODE_ENV === "development") {
            setItems(readLocal());
            setStorage("local-preview");
            return;
        }
        throw error;
    }, []);

    useEffect(() => {
        const refresh = () => { void reload().catch((error) => console.error("Gagal memuat DP/diskon invoice:", error)); };
        refresh();
        window.addEventListener(CHANGE_EVENT, refresh);
        const channel = supabase.channel("invoice-adjustments-sync")
            .on("postgres_changes", { event: "*", schema: "public", table: "invoice_adjustments" }, refresh)
            .subscribe();
        return () => {
            window.removeEventListener(CHANGE_EVENT, refresh);
            void supabase.removeChannel(channel);
        };
    }, [reload]);

    const save = useCallback(async (invoiceNumber: string, patch: Partial<Pick<InvoiceAdjustment, "manual_dp_amount" | "discount_amount">>) => {
        const invoice = normalizeInvoiceNumber(invoiceNumber);
        if (!invoice) throw new Error("Nomor invoice wajib diisi sebelum mencatat DP atau diskon.");

        const current = toMap(items).get(invoice);
        const next: InvoiceAdjustment = {
            invoice_number: invoice,
            dp_amount: nonNegative(current?.dp_amount),
            manual_dp_amount: nonNegative(patch.manual_dp_amount ?? current?.manual_dp_amount),
            discount_amount: nonNegative(patch.discount_amount ?? current?.discount_amount),
            updated_at: new Date().toISOString(),
        };

        if (storage === "database") {
            // Jangan menulis ulang dp_amount di sini: nilainya dipelihara
            // trigger dari transaksi Keuangan dan bisa berubah bersamaan.
            const databasePatch = {
                ...(patch.manual_dp_amount !== undefined ? { manual_dp_amount: next.manual_dp_amount } : {}),
                ...(patch.discount_amount !== undefined ? { discount_amount: next.discount_amount } : {}),
            };
            const { error } = current
                ? await supabase.from("invoice_adjustments").update(databasePatch).eq("invoice_number", invoice)
                : await supabase.from("invoice_adjustments").insert({ invoice_number: invoice, ...databasePatch });
            if (error) throw error;
            setItems((previous) => [...previous.filter((item) => item.invoice_number !== invoice), next]);
            window.dispatchEvent(new Event(CHANGE_EVENT));
            return;
        }

        if (storage !== "local-preview") throw new Error("Data DP/diskon masih dimuat. Coba beberapa saat lagi.");
        const nextItems = [...items.filter((item) => item.invoice_number !== invoice), next];
        setItems(nextItems);
        writeLocal(nextItems);
    }, [items, storage]);

    return {
        adjustments: useMemo(() => toMap(items), [items]),
        save,
        reload,
        storage,
    };
}
