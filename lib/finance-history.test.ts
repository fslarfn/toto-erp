import { describe, expect, it } from "vitest";
import { acceptSavedCashFlow, sortFinanceHistory } from "./finance-history";
import { computeBalance } from "./balance";
import { mergeLiveSnapshot } from "./merge-live-snapshot";
import type { CashFlow } from "@/types";

const row = (id: string, date: string, type: "income" | "expense" = "income", amount = 100): CashFlow => ({
    id, date, type, amount, category: "Lainnya", description: "test fixture", bankAccount: "Bank", accountId: "bank", createdBy: "finance", isTest: false, isAdjustment: false, transferGroup: null,
});
describe("finance history and balance from confirmed rows", () => {
    it("sorts by newest date without modifying source data", () => {
        const rows = [row("a", "2026-10-01"), row("z", "2026-10-08")];
        expect(sortFinanceHistory(rows).map(r => r.id)).toEqual(["z", "a"]);
        expect(rows[0].id).toBe("a");
    });
    it("keeps the just-saved transaction visible even when backdated", () => {
        expect(sortFinanceHistory([row("a", "2026-10-01"), row("z", "2026-10-08")], "a")[0].id).toBe("a");
    });
    it("adds income and subtracts expenses once, despite duplicate realtime echoes", () => {
        const accounts = [{ id: "bank", name: "Bank", initialBalance: 1000 }];
        const saved = row("saved", "2026-10-08", "income", 600);
        let rows = acceptSavedCashFlow([], saved);
        rows = acceptSavedCashFlow(rows, saved);
        expect(rows).toHaveLength(1);
        expect(computeBalance("bank", accounts, rows)).toBe(1600);
        rows = acceptSavedCashFlow(rows, row("expense", "2026-10-08", "expense", 200));
        expect(computeBalance("bank", accounts, rows)).toBe(1400);
    });
    it("preserves a confirmed save when an older snapshot finishes loading", () => {
        const baseline = [row("old", "2026-10-01")];
        const current = acceptSavedCashFlow(baseline, row("saved", "2026-10-08"));
        const merged = mergeLiveSnapshot(baseline, current, baseline);
        expect(merged.map(r => r.id)).toContain("saved");
        expect(merged).toHaveLength(2);
    });
});
