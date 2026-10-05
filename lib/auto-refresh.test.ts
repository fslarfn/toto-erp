import { afterEach, describe, expect, it, vi } from "vitest";
import { startAutoRefresh } from "./auto-refresh";

describe("payment data auto refresh", () => {
    afterEach(() => vi.useRealTimers());
    it("refreshes on mount, periodically and on return; stops after cleanup", async () => {
        vi.useFakeTimers();
        const refresh = vi.fn().mockResolvedValue(undefined);
        const win = new EventTarget();
        const doc = new EventTarget();
        const stop = startAutoRefresh(refresh, win, doc, () => true);
        expect(refresh).toHaveBeenCalledTimes(1);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(refresh).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(3_000);
        win.dispatchEvent(new Event("focus"));
        doc.dispatchEvent(new Event("visibilitychange"));
        expect(refresh).toHaveBeenCalledTimes(3);
        stop();
        await vi.advanceTimersByTimeAsync(60_000);
        win.dispatchEvent(new Event("online"));
        expect(refresh).toHaveBeenCalledTimes(3);
    });
    it("skips hidden/offline pages then refreshes on reconnection", async () => {
        vi.useFakeTimers();
        let active = false;
        const refresh = vi.fn().mockResolvedValue(undefined);
        const win = new EventTarget();
        const stop = startAutoRefresh(refresh, win, new EventTarget(), () => active);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(refresh).not.toHaveBeenCalled();
        active = true;
        win.dispatchEvent(new Event("online"));
        expect(refresh).toHaveBeenCalledTimes(1);
        stop();
    });
    it("does not overlap a slow request", async () => {
        vi.useFakeTimers();
        let finish!: () => void;
        const refresh = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
        const win = new EventTarget();
        const stop = startAutoRefresh(refresh, win, new EventTarget(), () => true);
        await vi.advanceTimersByTimeAsync(120_000);
        win.dispatchEvent(new Event("focus"));
        expect(refresh).toHaveBeenCalledTimes(1);
        finish();
        await vi.advanceTimersByTimeAsync(60_000);
        expect(refresh).toHaveBeenCalledTimes(2);
        stop();
        finish();
    });
});
