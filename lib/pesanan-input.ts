export const TEMP_ROW_ID = 1_000_000_000;

export function pesananToday(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Only local placeholders belong to every month. Persisted undated rows are
 * historical records, never reusable blank slots for a new order. */
export function belongsToInputPeriod(row: { id: number; tanggal: string | null }, year: number, month: number | "all") {
    if (!row.tanggal) return row.id >= TEMP_ROW_ID;
    const match = /^(\d{4})-(\d{2})-\d{2}$/.exec(row.tanggal);
    return !!match && Number(match[1]) === year && (month === "all" || Number(match[2]) === month);
}

/** Serialize autosave and Save All, including callers holding the old temp ID. */
export class PesananSaveQueue {
    private aliases = new Map<number, number>();
    private tails = new Map<number, Promise<unknown>>();

    resolve(id: number): number { return this.aliases.get(id) ?? id; }
    identify(tempId: number, realId: number) {
        this.aliases.set(tempId, realId);
        const tail = this.tails.get(tempId);
        if (tail) this.tails.set(realId, tail);
    }
    run<T>(id: number, save: (resolvedId: number) => Promise<T>): Promise<T> {
        const key = this.resolve(id);
        const previous = this.tails.get(key) ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(() => save(this.resolve(id)));
        this.tails.set(key, next);
        void next.finally(() => {
            for (const candidate of [key, this.resolve(id)]) {
                if (this.tails.get(candidate) === next) this.tails.delete(candidate);
            }
        }).catch(() => undefined);
        return next;
    }
}
