import { describe, it, expect } from "vitest";
import type { BankAccount, CashFlow } from "@/types";
import {
  computeBalance,
  computeTotalBalance,
  computeTotals,
  reconcileAccounts,
  buildTransferPair,
  resolveAccountId,
  normalizeAccountName,
} from "./balance";

// ── Helpers ──────────────────────────────────────────────
function acc(id: string, name: string, initialBalance = 0): BankAccount {
  return { id, name, bank: "", accountNumber: "", balance: 0, initialBalance };
}
function cf(p: Partial<CashFlow> & { type: CashFlow["type"]; amount: number; accountId: string | null }): CashFlow {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    type: p.type,
    category: p.category ?? "",
    amount: p.amount,
    description: p.description ?? "",
    date: p.date ?? "2026-06-01",
    bankAccount: p.bankAccount ?? "",
    accountId: p.accountId,
    createdBy: p.createdBy ?? "",
    isTest: p.isTest ?? false,
    isAdjustment: p.isAdjustment ?? false,
    transferGroup: p.transferGroup ?? null,
  };
}

const accounts = [acc("ba-1", "Bank BCA Toto"), acc("ba-2", "Bank BCA Yanto"), acc("ba-3", "Cash", 100000)];

describe("computeBalance", () => {
  it("initial_balance + income - expense per akun", () => {
    const flows = [
      cf({ type: "income", amount: 500000, accountId: "ba-1" }),
      cf({ type: "expense", amount: 200000, accountId: "ba-1" }),
      cf({ type: "income", amount: 1000000, accountId: "ba-2" }),
    ];
    expect(computeBalance("ba-1", accounts, flows)).toBe(300000);
    expect(computeBalance("ba-2", accounts, flows)).toBe(1000000);
  });

  it("memperhitungkan initial_balance", () => {
    const flows = [cf({ type: "income", amount: 50000, accountId: "ba-3" })];
    expect(computeBalance("ba-3", accounts, flows)).toBe(150000); // 100000 + 50000
  });

  it("mengecualikan entri is_test secara default", () => {
    const flows = [
      cf({ type: "income", amount: 300000, accountId: "ba-1" }),
      cf({ type: "income", amount: 999999, accountId: "ba-1", isTest: true, description: "SIMULASI" }),
    ];
    expect(computeBalance("ba-1", accounts, flows)).toBe(300000);
    expect(computeBalance("ba-1", accounts, flows, { includeTest: true })).toBe(1299999);
  });

  it("mengabaikan transaksi dengan account_id berbeda / null", () => {
    const flows = [
      cf({ type: "income", amount: 100, accountId: "ba-2" }),
      cf({ type: "income", amount: 100, accountId: null }),
    ];
    expect(computeBalance("ba-1", accounts, flows)).toBe(0);
  });
});

describe("computeTotals (Masuk/Keluar)", () => {
  it("menjumlahkan income & expense, mengecualikan is_test", () => {
    const flows = [
      cf({ type: "income", amount: 500000, accountId: "ba-1" }),
      cf({ type: "expense", amount: 200000, accountId: "ba-1" }),
      cf({ type: "income", amount: 1000000, accountId: "ba-3", isTest: true }),
    ];
    expect(computeTotals(flows)).toEqual({ income: 500000, expense: 200000, net: 300000 });
  });
});

describe("mutasi antar-kas (buildTransferPair)", () => {
  it("menghasilkan pasangan expense(sumber) + income(tujuan) yang net-nya nol global", () => {
    const [out, inn] = buildTransferPair({
      fromAccountId: "ba-3", toAccountId: "ba-1", amount: 250000, date: "2026-06-10",
    });
    expect(out.type).toBe("expense");
    expect(out.accountId).toBe("ba-3");
    expect(inn.type).toBe("income");
    expect(inn.accountId).toBe("ba-1");
    expect(out.transferGroup).toBe(inn.transferGroup); // pasangan tertaut

    const flows = [
      cf({ ...out } as CashFlow),
      cf({ ...inn } as CashFlow),
    ];
    // Per akun bergeser, tapi TOTAL seluruh akun tetap (mutasi tidak dobel/hilang)
    expect(computeBalance("ba-3", accounts, flows)).toBe(100000 - 250000); // -150000
    expect(computeBalance("ba-1", accounts, flows)).toBe(250000);
    // Total global = jumlah initial (100000) + 0 net mutasi
    expect(computeTotalBalance(accounts, flows)).toBe(100000);
    // Masuk == Keluar untuk mutasi → net 0
    expect(computeTotals(flows).net).toBe(0);
  });
});

describe("reconcileAccounts", () => {
  it("memunculkan selisih stored vs computed (mis. 5.000)", () => {
    const a = [{ ...acc("ba-3", "Cash"), balance: 3336000 }]; // stored salah
    const flows = [cf({ type: "income", amount: 3341000, accountId: "ba-3" })];
    const [rec] = reconcileAccounts(a, flows);
    expect(rec.computedBalance).toBe(3341000);
    expect(rec.storedBalance).toBe(3336000);
    expect(rec.diff).toBe(-5000);
  });

  it("idempotent: setelah stored disetel = computed, diff jadi 0 dan tetap 0", () => {
    const flows = [
      cf({ type: "income", amount: 500000, accountId: "ba-1" }),
      cf({ type: "expense", amount: 100000, accountId: "ba-1" }),
    ];
    // Sinkron pertama
    const synced = accounts.map((x) => ({ ...x, balance: computeBalance(x.id, accounts, flows) }));
    const rec1 = reconcileAccounts(synced, flows);
    expect(rec1.every((r) => r.diff === 0)).toBe(true);
    // Sinkron kedua menghasilkan nilai identik
    const synced2 = synced.map((x) => ({ ...x, balance: computeBalance(x.id, synced, flows) }));
    expect(synced2.map((x) => x.balance)).toEqual(synced.map((x) => x.balance));
  });
});

describe("resolveAccountId / normalizeAccountName", () => {
  it("normalisasi trim + case-insensitive + alias tunai→cash", () => {
    expect(normalizeAccountName("  Cash ")).toBe("cash");
    expect(normalizeAccountName("Tunai")).toBe("cash");
    expect(normalizeAccountName("KAS")).toBe("cash");
  });

  it("memetakan nama lama ke id, dan null bila tak ada padanan unik", () => {
    expect(resolveAccountId("bank bca toto", accounts)).toBe("ba-1");
    expect(resolveAccountId("Tunai", accounts)).toBe("ba-3");
    expect(resolveAccountId("ba-2", accounts)).toBe("ba-2"); // sudah id
    expect(resolveAccountId("Rekening Tidak Dikenal", accounts)).toBeNull();
  });
});
