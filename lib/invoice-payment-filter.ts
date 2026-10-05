export type InvoicePaymentFilter = "unpaid" | "paid" | "all";

export function isInvoicePaid(items: readonly { is_paid?: boolean }[]): boolean {
    return items.length > 0 && items.every((item) => item.is_paid === true);
}

export function filterInvoiceNumbers<T extends { is_paid?: boolean }>(
    invoices: ReadonlyMap<string, readonly T[]>,
    filter: InvoicePaymentFilter,
): string[] {
    return Array.from(invoices.keys()).filter((number) =>
        filter === "all" || isInvoicePaid(invoices.get(number) ?? []) === (filter === "paid")
    );
}
