import { describe, expect, it } from "vitest";
import {
  INDONESIA_OFFICIAL_HOLIDAYS,
  officialHolidaysForYear,
  officialSourceForYear,
} from "./indonesia-holidays";

describe("kalender resmi Indonesia", () => {
  it("memuat jumlah hari libur dan cuti bersama 2026 sesuai SKB", () => {
    const events = officialHolidaysForYear(2026);
    expect(events.filter((event) => event.kind === "national_holiday")).toHaveLength(17);
    expect(events.filter((event) => event.kind === "joint_leave")).toHaveLength(8);
  });

  it("memuat 18 hari libur nasional dan 8 cuti bersama 2027", () => {
    const events = officialHolidaysForYear(2027);
    expect(events.filter((event) => event.kind === "national_holiday")).toHaveLength(18);
    expect(events.filter((event) => event.kind === "joint_leave")).toHaveLength(8);
  });

  it("tidak mengarang sumber resmi untuk 2028 sampai 2030", () => {
    for (const year of [2028, 2029, 2030]) {
      expect(officialHolidaysForYear(year)).toEqual([]);
      expect(officialSourceForYear(year)).toBeNull();
    }
  });

  it("memiliki id unik dan tanggal ISO yang valid", () => {
    const ids = INDONESIA_OFFICIAL_HOLIDAYS.map((event) => event.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const event of INDONESIA_OFFICIAL_HOLIDAYS) {
      expect(event.date).toMatch(/^202[67]-\d{2}-\d{2}$/);
      expect(Number.isNaN(new Date(`${event.date}T00:00:00`).valueOf())).toBe(false);
    }
  });
});
