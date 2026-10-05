/** Preserve immutable state changes received while a server snapshot was loading. */
export function mergeLiveSnapshot<T extends { id: string }>(baseline: readonly T[], current: readonly T[], server: readonly T[]): T[] {
    const before = new Map(baseline.map(row => [row.id, row]));
    const live = new Map(current.map(row => [row.id, row]));
    const result = new Map(server.map(row => [row.id, row]));
    for (const row of current) {
        if (before.get(row.id) !== row) result.set(row.id, row);
    }
    for (const row of baseline) {
        if (!live.has(row.id)) result.delete(row.id);
    }
    return Array.from(result.values());
}
