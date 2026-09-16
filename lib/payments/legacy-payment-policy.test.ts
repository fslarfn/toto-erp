import { describe, expect, it } from "vitest";
import {
    canDirectlyMarkLegacyPayment,
    isLegacyDirectPaymentDate,
    isLegacyDirectPaymentUser,
    normalizeInvoiceNumber,
} from "./legacy-payment-policy";

describe("legacy direct payment policy", () => {
    it.each(["riska", "Rieska", "YUNI", " vira "])("allows user %s", (username) => {
        expect(isLegacyDirectPaymentUser(username)).toBe(true);
    });

    it("rejects users outside the transition team", () => {
        expect(isLegacyDirectPaymentUser("faisal")).toBe(false);
    });

    it.each(["2026-01-01", "2026-06-15", "2026-09-30"])("allows date %s", (date) => {
        expect(isLegacyDirectPaymentDate(date)).toBe(true);
    });

    it.each(["2025-12-31", "2026-10-01", "", "09/09/2026"])("rejects date %s", (date) => {
        expect(isLegacyDirectPaymentDate(date)).toBe(false);
    });

    it("requires both an allowed user and a legacy date", () => {
        expect(canDirectlyMarkLegacyPayment("yuni", "2026-09-30")).toBe(true);
        expect(canDirectlyMarkLegacyPayment("yuni", "2026-10-01")).toBe(false);
        expect(canDirectlyMarkLegacyPayment("faisal", "2026-09-30")).toBe(false);
    });

    it("normalizes invoice numbers for grouping", () => {
        expect(normalizeInvoiceNumber("  inv-123 ")).toBe("INV-123");
    });
});
