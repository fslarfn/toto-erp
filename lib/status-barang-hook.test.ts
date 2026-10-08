import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    effect: undefined as undefined | (() => void),
    event: undefined as undefined | (() => void),
    status: undefined as undefined | ((status: string) => void),
    fetcher: undefined as undefined | (() => Promise<unknown>),
    options: {} as Record<string, unknown>,
    mutate: vi.fn().mockResolvedValue([]),
    from: vi.fn(),
    removeChannel: vi.fn(),
}));
vi.mock("react", () => ({ useEffect: (effect: () => () => void) => { mocks.effect = effect(); } }));
vi.mock("swr", () => ({ default: (_key: string, fetcher: () => Promise<unknown>, options: Record<string, unknown>) => {
    mocks.fetcher = fetcher;
    mocks.options = options;
    return { data: [], mutate: mocks.mutate, isLoading: false };
} }));
vi.mock("@/lib/supabase-client", () => ({ supabase: {
    from: mocks.from,
    removeChannel: mocks.removeChannel,
    channel: () => ({ on: (_type: unknown, _filter: unknown, event: () => void) => {
        mocks.event = event;
        return { subscribe: (status: (status: string) => void) => { mocks.status = status; return {}; } };
    } }),
} }));
import { useStatusBarangRows } from "../app/dashboard/status-barang/hooks/useStatusBarangRows";

describe("Status Barang read-only synchronization wiring", () => {
    beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
    afterEach(() => { mocks.effect?.(); vi.useRealTimers(); });

    it("refreshes for all change events and each successful reconnection", async () => {
        useStatusBarangRows(2026, 10);
        mocks.status?.("SUBSCRIBED");
        await vi.advanceTimersByTimeAsync(300);
        expect(mocks.mutate).toHaveBeenCalledTimes(1);
        mocks.event?.(); // same handler covers INSERT, UPDATE and DELETE
        await vi.advanceTimersByTimeAsync(300);
        expect(mocks.mutate).toHaveBeenCalledTimes(2);
        mocks.status?.("CHANNEL_ERROR");
        mocks.status?.("SUBSCRIBED");
        await vi.advanceTimersByTimeAsync(300);
        expect(mocks.mutate).toHaveBeenCalledTimes(3);
        expect(mocks.mutate.mock.calls.every(args => args.length === 0)).toBe(true);
        expect(mocks.from).not.toHaveBeenCalled(); // no database writes in listener
        expect(mocks.options).toMatchObject({ refreshInterval: 60000, revalidateOnFocus: true, revalidateOnReconnect: true, refreshWhenHidden: false, refreshWhenOffline: false });
    });

    it("reads the authoritative period, including moved/missing rows, without writing", async () => {
        const query = {
            select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(), range: vi.fn(),
        };
        const currentRows = [{ id: 20361, tanggal: "2026-10-02", deskripsi: "MAL TRIPLEK 2" }];
        query.range.mockResolvedValue({ data: currentRows, error: null });
        mocks.from.mockReturnValue(query);
        useStatusBarangRows(2026, 10);
        expect(await mocks.fetcher?.()).toEqual(currentRows);
        expect(query.gte).toHaveBeenCalledWith("tanggal", "2026-10-01");
        expect(query.lte).toHaveBeenCalledWith("tanggal", "2026-10-31");
        query.range.mockResolvedValue({ data: [], error: null });
        expect(await mocks.fetcher?.()).toEqual([]); // outgoing/deleted row is no longer retained
    });

    it("loads every page without silently cutting off at 20,000 rows", async () => {
        const query = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn((from: number) => Promise.resolve({
            data: Array.from({ length: from < 20000 ? 1000 : 1 }, (_, i) => ({ id: from + i + 1, tanggal: "2026-10-02" })), error: null,
        })) };
        mocks.from.mockReturnValue(query);
        useStatusBarangRows(2026, "all");
        expect(await mocks.fetcher?.()).toHaveLength(20001);
        expect(query.range).toHaveBeenCalledTimes(21);
        expect(query.lte).toHaveBeenCalledWith("tanggal", "2026-12-31");
    });

    it("rejects a failed read instead of returning empty successful data", async () => {
        const error = new Error("connection lost");
        const query = { select: vi.fn().mockReturnThis(), gte: vi.fn().mockReturnThis(), lte: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn().mockResolvedValue({ data: null, error }) };
        mocks.from.mockReturnValue(query);
        useStatusBarangRows(2026, 10);
        await expect(mocks.fetcher?.()).rejects.toThrow("connection lost");
    });
});
