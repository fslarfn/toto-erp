export type InvoiceAdjustmentValues = {
    dp_amount?: number;
    manual_dp_amount?: number;
    discount_amount?: number;
};

export type InvoiceAmounts = {
    subtotal: number;
    discount: number;
    invoiceTotal: number;
    dp: number;
    remaining: number;
};

function nonNegative(value: unknown): number {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
}

/**
 * DP adalah catatan pelunasan invoice, bukan pengurang nilai penjualan.
 * Diskon mengurangi subtotal; DP mengurangi sisa tagihan setelah diskon.
 */
export function calculateInvoiceAmounts(subtotal: number, adjustment?: InvoiceAdjustmentValues): InvoiceAmounts {
    const safeSubtotal = Math.max(0, Math.round(Number(subtotal) || 0));
    const discount = Math.min(nonNegative(adjustment?.discount_amount), safeSubtotal);
    const invoiceTotal = safeSubtotal - discount;
    const dp = Math.min(
        nonNegative(adjustment?.dp_amount) + nonNegative(adjustment?.manual_dp_amount),
        invoiceTotal,
    );
    return { subtotal: safeSubtotal, discount, invoiceTotal, dp, remaining: invoiceTotal - dp };
}
