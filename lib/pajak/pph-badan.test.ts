import {describe,expect,it} from "vitest";
import {calculateCorporateTax} from "./pph-badan";

const credits={pph22:0,pph23:0,pph25:0,other:0};
describe("PPh Badan dan fasilitas Pasal 31E",()=>{
 it("mengenakan 11% atas seluruh PKP bila omzet tidak melebihi 4,8 miliar",()=>{const r=calculateCorporateTax({turnover:4_500_000_000,commercialProfit:500_000_950,positiveCorrections:0,negativeCorrections:0,credits});expect(r.taxableIncome).toBe(500_000_000);expect(r.taxDue).toBe(55_000_000)});
 it("membagi PKP proporsional bila omzet berada di antara 4,8 dan 50 miliar",()=>{const r=calculateCorporateTax({turnover:9_600_000_000,commercialProfit:1_000_000_000,positiveCorrections:0,negativeCorrections:0,credits});expect(r.facilityTaxableIncome).toBe(500_000_000);expect(r.taxDue).toBe(165_000_000)});
 it("mengenakan tarif umum 22% bila omzet melebihi 50 miliar",()=>{const r=calculateCorporateTax({turnover:51_000_000_000,commercialProfit:1_000_000_000,positiveCorrections:0,negativeCorrections:0,credits});expect(r.facilityApplied).toBe(false);expect(r.taxDue).toBe(220_000_000)});
 it("menerapkan koreksi fiskal dan kredit pajak aktual",()=>{const r=calculateCorporateTax({turnover:1_000_000_000,commercialProfit:100_000_000,positiveCorrections:20_000_000,negativeCorrections:10_000_000,credits:{...credits,pph23:5_000_000}});expect(r.taxableIncome).toBe(110_000_000);expect(r.balance).toBe(7_100_000)});
});
