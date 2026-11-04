import { describe, expect, it } from "vitest";
import { calculateInvoiceAmounts } from "./invoice-adjustment-calculations";

describe("calculateInvoiceAmounts", () => {
    it("mengurangi diskon dari nilai invoice lalu DP dari sisa tagihan", () => {
        expect(calculateInvoiceAmounts(10_000_000, {
            discount_amount: 500_000,
            dp_amount: 3_000_000,
        })).toEqual({
            subtotal: 10_000_000,
            discount: 500_000,
            invoiceTotal: 9_500_000,
            dp: 3_000_000,
            remaining: 6_500_000,
        });
    });

    it("tidak mengizinkan diskon atau DP melebihi nilai invoice", () => {
        expect(calculateInvoiceAmounts(1_000, {
            discount_amount: 2_000,
            dp_amount: 2_000,
        })).toEqual({
            subtotal: 1_000,
            discount: 1_000,
            invoiceTotal: 0,
            dp: 0,
            remaining: 0,
        });
    });

    it("menjumlahkan DP Keuangan dan DP Manual sebelum menghitung sisa", () => {
        expect(calculateInvoiceAmounts(2_745_000, {
            dp_amount: 745_000,
            manual_dp_amount: 500_000,
        })).toEqual({
            subtotal: 2_745_000,
            discount: 0,
            invoiceTotal: 2_745_000,
            dp: 1_245_000,
            remaining: 1_500_000,
        });
    });
});
