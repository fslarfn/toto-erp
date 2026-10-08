/** Coalesce realtime bursts, and replay a refresh if events arrive during a read. */
export function createStatusBarangRefresh(refresh: () => Promise<unknown>, delayMs = 300) {
    let stopped = false;
    let running = false;
    let pending = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
        if (stopped) return;
        pending = true;
        if (running || timer !== undefined) return;
        timer = setTimeout(() => { void run(); }, delayMs);
    };
    const run = async () => {
        timer = undefined;
        if (stopped) return;
        pending = false;
        running = true;
        try {
            await refresh();
        } catch {
            // SWR exposes the error to the page and handles retry/backoff.
        } finally {
            running = false;
            if (pending) schedule();
        }
    };
    return {
        schedule,
        stop() {
            stopped = true;
            if (timer !== undefined) clearTimeout(timer);
        },
    };
}
