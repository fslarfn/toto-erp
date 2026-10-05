import { describe, expect, it } from "vitest";
import { mergeLiveSnapshot } from "./merge-live-snapshot";

describe("realtime snapshot recovery", () => {
    const old = { id: "1", amount: 10 };
    it("recovers missed inserts, edits and deletes", () => {
        expect(mergeLiveSnapshot([old, { id: "2", amount: 20 }], [old, { id: "2", amount: 20 }], [{ id: "1", amount: 30 }])).toContainEqual({ id: "1", amount: 30 });
        expect(mergeLiveSnapshot([old], [old], [])).toEqual([]);
        expect(mergeLiveSnapshot([], [], [old])).toEqual([old]);
    });
    it("keeps edits and inserts received during fetch without duplicates", () => {
        const updated = { id: "1", amount: 50 };
        const inserted = { id: "2", amount: 5 };
        expect(mergeLiveSnapshot([old], [updated, inserted], [old, inserted])).toEqual([updated, inserted]);
    });
    it("does not resurrect an item deleted during fetch", () => {
        expect(mergeLiveSnapshot([old], [], [old])).toEqual([]);
    });
});
