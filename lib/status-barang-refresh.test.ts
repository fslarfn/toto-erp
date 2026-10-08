import { afterEach, describe, expect, it, vi } from "vitest";
import { createStatusBarangRefresh } from "./status-barang-refresh";

describe("Status Barang refresh queue", () => {
    afterEach(() => vi.useRealTimers());

    it("coalesces bursts without postponing indefinitely", async () => {
        vi.useFakeTimers();
        const read = vi.fn().mockResolvedValue([]);
        const queue = createStatusBarangRefresh(read);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(200);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(100);
        expect(read).toHaveBeenCalledTimes(1);
        queue.stop();
    });

    it("replays events arriving during a read without overlapping reads", async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        const read = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        const queue = createStatusBarangRefresh(read);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(300);
        queue.schedule();
        queue.schedule();
        await vi.advanceTimersByTimeAsync(1000);
        expect(read).toHaveBeenCalledTimes(1);
        finish();
        await vi.advanceTimersByTimeAsync(300);
        expect(read).toHaveBeenCalledTimes(2);
        queue.stop();
        finish();
    });

    it("does not refresh after cleanup (including an in-flight read)", async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        const read = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
        const queue = createStatusBarangRefresh(read);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(300);
        queue.schedule();
        queue.stop();
        finish();
        queue.schedule();
        await vi.advanceTimersByTimeAsync(1000);
        expect(read).toHaveBeenCalledTimes(1);
    });

    it("can retry after failure and cancels queued work", async () => {
        vi.useFakeTimers();
        const read = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue([]);
        const queue = createStatusBarangRefresh(read);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(300);
        queue.schedule();
        await vi.advanceTimersByTimeAsync(300);
        expect(read).toHaveBeenCalledTimes(2);
        queue.schedule();
        queue.stop();
        await vi.advanceTimersByTimeAsync(300);
        expect(read).toHaveBeenCalledTimes(2);
    });
});
