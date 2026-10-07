import { describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase-client", () => ({ supabase: { rpc } }));
import { canMarkInvoicePaid, markInvoicePaid } from "./direct-payment";

describe("direct invoice settlement", () => {
    it("allows finance, owner and existing payment admins only", () => {
        expect(canMarkInvoicePaid("owner", "faisal")).toBe(true);
        expect(canMarkInvoicePaid("finance", "admin")).toBe(true);
        for (const name of ["rieska", "riska", "yuni", "vira"])
            expect(canMarkInvoicePaid("barang", name)).toBe(true);
        expect(canMarkInvoicePaid("barang", "dika")).toBe(false);
        expect(canMarkInvoicePaid()).toBe(false);
    });
    it("uses one atomic invoice RPC, not a cash insert", async () => {
        rpc.mockResolvedValueOnce({ error: null });
        await markInvoicePaid(" inv-10 ", "Customer");
        expect(rpc).toHaveBeenLastCalledWith("mark_customer_invoice_paid", {
            p_invoice: "INV-10", p_customer: "Customer",
        });
    });
    it("reports failed database writes", async () => {
        rpc.mockResolvedValueOnce({ error: { message: "Tidak berwenang" } });
        await expect(markInvoicePaid("10", "Customer")).rejects.toThrow("Tidak berwenang");
    });
    it("rejects an empty invoice", async () => {
        await expect(markInvoicePaid(" ", "Customer")).rejects.toThrow("Nomor invoice");
    });
});
