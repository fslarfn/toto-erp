import { describe, expect, it } from "vitest";
import { calculateInvoicePayment, rankInvoiceMatches, scoreInvoiceMatch } from "./matching";

const receipt = { amount: 1_250_000, date: "2026-09-07", payerName: "Budi Santoso", description: "TRF BUDI INV 024", reference: "MBANK-10" };
const invoice = { invoiceKey: "INV:024", invoiceNumber: "024", customerName: "Budi Santoso", date: "2026-09-05", outstanding: 1_250_000 };

describe("payment invoice matching", () => {
  it("memberi keyakinan tinggi untuk invoice, nama, dan nominal yang cocok", () => {
    const result = scoreInvoiceMatch(receipt, invoice);
    expect(result.confidence).toBe("tinggi");
    expect(result.score).toBe(100);
  });

  it("mengenali pembayaran sebagian tanpa menyebutnya lunas", () => {
    const result = scoreInvoiceMatch({ ...receipt, amount: 500_000, description: "transfer budi" }, invoice);
    expect(result.reasons).toContain("memungkinkan pembayaran sebagian");
    expect(result.score).toBeLessThan(80);
  });

  it("mengurutkan kandidat terbaik lebih dahulu", () => {
    const unrelated = { invoiceKey: "INV:999", invoiceNumber: "999", customerName: "Customer Lain", date: "2026-05-01", outstanding: 900_000 };
    expect(rankInvoiceMatches(receipt, [unrelated, invoice])[0].invoiceKey).toBe(invoice.invoiceKey);
  });

  it("mengalokasikan pembayaran penuh tanpa sisa", () => {
    expect(calculateInvoicePayment(1_250_000, 1_250_000)).toEqual({
      allocatedAmount: 1_250_000,
      remainingInvoice: 0,
      receiptRemainder: 0,
      willSettleInvoice: true,
    });
  });

  it("menyisakan tagihan untuk pembayaran sebagian", () => {
    expect(calculateInvoicePayment(500_000, 1_250_000)).toMatchObject({
      allocatedAmount: 500_000,
      remainingInvoice: 750_000,
      receiptRemainder: 0,
      willSettleInvoice: false,
    });
  });

  it("menyisakan kelebihan penerimaan setelah invoice lunas", () => {
    expect(calculateInvoicePayment(1_500_000, 1_250_000)).toMatchObject({
      allocatedAmount: 1_250_000,
      remainingInvoice: 0,
      receiptRemainder: 250_000,
      willSettleInvoice: true,
    });
  });
});
