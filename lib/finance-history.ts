import type { CashFlow } from "@/types";

/** Only update browser state: never create a second database transaction. */
export function acceptSavedCashFlow(current: CashFlow[], saved: CashFlow): CashFlow[] {
    return [saved, ...current.filter(row => row.id !== saved.id)];
}

export function sortFinanceHistory(rows: CashFlow[], recentId?: string): CashFlow[] {
    return [...rows].sort((a, b) => {
        if (a.id === recentId) return -1;
        if (b.id === recentId) return 1;
        return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    });
}
