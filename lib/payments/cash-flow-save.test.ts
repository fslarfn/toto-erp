import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn(), insert: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/supabase-client", () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
import { createCustomerPaymentCashFlow } from "./store";

const input = { type: "income" as const, category: "Pembayaran Invoice", amount: 6007000, description: "PAK APINK", date: "2026-10-08", bankAccount: "Bank BCA Yanto", accountId: "ba-2", createdBy: "finance" };
describe("confirmed finance save", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.insert.mockReturnValue({ select: mocks.select });
        mocks.select.mockReturnValue({ single: mocks.single });
    });
    it("returns the actual database record rather than a fabricated cache row", async () => {
        const saved = { id: "server-id", amount: 6007000, date: input.date, account_id: "ba-2" };
        mocks.single.mockResolvedValue({ data: saved, error: null });
        expect(await createCustomerPaymentCashFlow(input)).toEqual(saved);
        expect(mocks.insert).toHaveBeenCalledTimes(1);
        expect(mocks.select).toHaveBeenCalled();
    });
    it("propagates failure without inserting a replacement transaction", async () => {
        mocks.single.mockResolvedValue({ data: null, error: new Error("rejected") });
        await expect(createCustomerPaymentCashFlow(input)).rejects.toThrow("rejected");
        expect(mocks.insert).toHaveBeenCalledTimes(1);
    });
    it("does not report success without a returned record", async () => {
        mocks.single.mockResolvedValue({ data: null, error: null });
        await expect(createCustomerPaymentCashFlow(input)).rejects.toThrow("Konfirmasi transaksi");
    });
});
