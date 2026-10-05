/** Single-flight refresh with visibility/network guards and symmetric cleanup. */
export function startAutoRefresh(
    refresh: () => Promise<void>,
    windowTarget: EventTarget,
    documentTarget: EventTarget,
    canRefresh: () => boolean,
    intervalMs = 60_000,
) {
    let stopped = false;
    let inFlight = false;
    let lastStarted = -Infinity;
    const run = async () => {
        if (stopped || inFlight || !canRefresh() || Date.now() - lastStarted < 2_000) return;
        inFlight = true;
        lastStarted = Date.now();
        try { await refresh(); }
        catch (error) { console.error("Payment data refresh failed:", error); }
        finally { inFlight = false; }
    };
    const onWake = () => { void run(); };
    windowTarget.addEventListener("focus", onWake);
    windowTarget.addEventListener("online", onWake);
    windowTarget.addEventListener("erp:realtime-reconnected", onWake);
    documentTarget.addEventListener("visibilitychange", onWake);
    const timer = setInterval(onWake, intervalMs);
    onWake();
    return () => {
        stopped = true;
        clearInterval(timer);
        windowTarget.removeEventListener("focus", onWake);
        windowTarget.removeEventListener("online", onWake);
        windowTarget.removeEventListener("erp:realtime-reconnected", onWake);
        documentTarget.removeEventListener("visibilitychange", onWake);
    };
}
