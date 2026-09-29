import { describe, expect, it } from "vitest";
import { hitungGajiDasar, punyaGajiPokok, tarifHarianOf, tipeGajianOf } from "./gaji-absensi";

describe("gaji pokok tetap vs upah harian", () => {
    it.each([0, 0.5, 10, 26, 31])("gaji pokok tidak bergantung pada %s hari kerja", hari => {
        expect(hitungGajiDasar({ gaji_pokok: 7_000_000, gaji_harian: 0 }, hari)).toBe(7_000_000);
        expect(hitungGajiDasar({ gaji_pokok: 15_000_000, gaji_harian: 0 }, hari)).toBe(15_000_000);
    });
    it("berlaku berdasarkan gaji pokok, bukan nama atau status", () => {
        const k = { gaji_pokok: 3_000_000, gaji_harian: 100_000, periode_gaji: "mingguan" };
        expect(punyaGajiPokok(k)).toBe(true);
        expect(hitungGajiDasar(k, 6)).toBe(3_000_000);
        expect(tipeGajianOf(k)).toBe("bulanan");
    });
    it.each([0, 0.5, 6, 26])("upah harian tetap dikalikan %s hari", hari => {
        expect(hitungGajiDasar({ gaji_pokok: 0, gaji_harian: 175_000 }, hari)).toBe(175_000 * hari);
    });
    it("karyawan harian dengan periode bulanan tetap berbasis hadir", () => {
        const k = { gaji_pokok: 0, gaji_harian: 175_000, periode_gaji: "bulanan" };
        expect(tipeGajianOf(k)).toBe("bulanan");
        expect(hitungGajiDasar(k, 20)).toBe(3_500_000);
    });
    it("tidak mengubah tarif lembur dan komponen potongan", () => {
        expect(tarifHarianOf(0, 7_000_000)).toBe(269_231);
        expect(hitungGajiDasar({ gaji_pokok: 7_000_000, gaji_harian: 0 }, 0) - 140_000 - 70_000).toBe(6_790_000);
        expect(hitungGajiDasar({ gaji_pokok: 15_000_000, gaji_harian: 0 }, 0) - 300_000 - 150_000).toBe(14_550_000);
    });
});
