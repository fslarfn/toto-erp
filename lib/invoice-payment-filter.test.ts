import { describe, expect, it } from "vitest";
import { filterInvoiceNumbers, isInvoicePaid } from "./invoice-payment-filter";

describe("invoice payment filter", () => {
    const invoices = new Map([
        ["101", [{ is_paid: false, di_kirim: true }]],
        ["102", [{ is_paid: true, di_kirim: false }]],
        ["103", [{ is_paid: true, di_kirim: true }, { is_paid: false, di_kirim: true }]],
        ["104", [{ is_paid: true, di_kirim: true }, { is_paid: true, di_kirim: false }]],
    ]);

    it("keeps unpaid and partially paid invoices, regardless of shipping", () => {
        expect(filterInvoiceNumbers(invoices, "unpaid")).toEqual(["101", "103"]);
    });
    it("requires every item to be paid, regardless of shipping", () => {
        expect(filterInvoiceNumbers(invoices, "paid")).toEqual(["102", "104"]);
    });
    it("preserves all invoices and their order for all", () => {
        expect(filterInvoiceNumbers(invoices, "all")).toEqual(["101", "102", "103", "104"]);
    });
    it("handles an empty period", () => {
        expect(filterInvoiceNumbers(new Map(), "unpaid")).toEqual([]);
    });
    it("does not treat empty or missing payment status as paid", () => {
        expect(isInvoicePaid([])).toBe(false);
        expect(isInvoicePaid([{}])).toBe(false);
    });
});
