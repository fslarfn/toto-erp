import { supabase } from "@/lib/supabase-client";
import { isLegacyDirectPaymentUser, normalizeInvoiceNumber } from "./legacy-payment-policy";

export function canMarkInvoicePaid(role?: string, username?: string): boolean {
    return role === "owner" || role === "finance" || isLegacyDirectPaymentUser(username);
}

export async function markInvoicePaid(invoice: string, customer: string): Promise<void> {
    const number = normalizeInvoiceNumber(invoice);
    if (!number) throw new Error("Nomor invoice wajib diisi.");
    const { data, error } = await supabase.rpc("mark_customer_invoice_paid", {
        p_invoice: number,
        p_customer: customer,
    });
    if (error) throw new Error(error.message);
    if (typeof data !== "number" || data < 0) throw new Error("Konfirmasi pelunasan belum diterima. Muat ulang sebelum mencoba lagi.");
    if (typeof window !== "undefined") window.dispatchEvent(new Event("erp:payment-changed"));
}
