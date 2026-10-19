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
    let paymentPending = false;
    const run = async (force = false) => {
        if (stopped || !canRefresh()) return;
        if (inFlight) {
            if (force) paymentPending = true;
            return;
        }
        if (!force && Date.now() - lastStarted < 2_000) return;
        inFlight = true;
        lastStarted = Date.now();
        try { await refresh(); }
        catch (error) { console.error("Payment data refresh failed:", error); }
        finally {
            inFlight = false;
            if (paymentPending) {
                paymentPending = false;
                void run(true);
            }
        }
    };
    const onWake = () => { void run(); };
    const onPayment = () => { void run(true); };
    windowTarget.addEventListener("erp:payment-changed", onPayment);
    windowTarget.addEventListener("focus", onWake);
    windowTarget.addEventListener("online", onWake);
    windowTarget.addEventListener("erp:realtime-reconnected", onWake);
    documentTarget.addEventListener("visibilitychange", onWake);
    const timer = setInterval(onWake, intervalMs);
    onWake();
    return () => {
        stopped = true;
        clearInterval(timer);
        windowTarget.removeEventListener("erp:payment-changed", onPayment);
        windowTarget.removeEventListener("focus", onWake);
        windowTarget.removeEventListener("online", onWake);
        windowTarget.removeEventListener("erp:realtime-reconnected", onWake);
        documentTarget.removeEventListener("visibilitychange", onWake);
    };
}
