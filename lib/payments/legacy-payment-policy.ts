export const LEGACY_DIRECT_PAYMENT_START = "2026-01-01";
export const LEGACY_DIRECT_PAYMENT_END = "2026-09-30";

const LEGACY_DIRECT_PAYMENT_USERS = new Set(["riska", "rieska", "yuni", "vira"]);

export function normalizeInvoiceNumber(value: string | null | undefined): string {
    return (value || "").trim().toUpperCase();
}

export function isLegacyDirectPaymentUser(username: string | null | undefined): boolean {
    return LEGACY_DIRECT_PAYMENT_USERS.has((username || "").trim().toLowerCase());
}

export function isLegacyDirectPaymentDate(value: string | null | undefined): boolean {
    const date = (value || "").trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date)
        && date >= LEGACY_DIRECT_PAYMENT_START
        && date <= LEGACY_DIRECT_PAYMENT_END;
}

export function canDirectlyMarkLegacyPayment(
    username: string | null | undefined,
    invoiceDate: string | null | undefined,
): boolean {
    return isLegacyDirectPaymentUser(username) && isLegacyDirectPaymentDate(invoiceDate);
}
