import{describe,expect,it}from"vitest";
import{monthEndDate,reconcileValues,taxDeadlines}from"./reconciliation";
describe("ekualisasi dan jatuh tempo",()=>{
 it("mengambil akhir bulan berdasarkan tanggal lokal tanpa mundur karena UTC",()=>{expect(monthEndDate(2026,7)).toBe("2026-07-31");expect(monthEndDate(2026,4)).toBe("2026-04-30")});
 it("menangani Februari dan tahun kabisat",()=>{expect(monthEndDate(2026,2)).toBe("2026-02-28");expect(monthEndDate(2028,2)).toBe("2028-02-29")});
 it("menandai nilai yang sama sebagai cocok",()=>expect(reconcileValues(1_000_000,1_000_000).status).toBe("match"));
 it("menghitung selisih dan menandai transaksi yang perlu review",()=>{const r=reconcileValues(1_000_000,800_000);expect(r.status).toBe("difference");expect(r.difference).toBe(200_000)});
 it("tidak mewajibkan PPN untuk badan non-PKP",()=>expect(reconcileValues(1_000_000,0,false).status).toBe("not_applicable"));
 it("membuat deadline lintas tahun dan akhir bulan",()=>{expect(taxDeadlines(2026,12,"pph21")).toEqual({payment:"2027-01-15",filing:"2027-01-20"});expect(taxDeadlines(2026,1,"ppn")).toEqual({payment:"2026-02-28",filing:"2026-02-28"})});
});
