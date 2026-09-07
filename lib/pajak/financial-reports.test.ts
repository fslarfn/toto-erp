import { describe, expect, it } from "vitest";
import { buildAccountingReport, buildGeneralLedger, FinancialAccount, FinancialJournal } from "./financial-reports";

const accounts: FinancialAccount[] = [
  { id: "cash", code: "1101", name: "Kas", account_type: "asset" },
  { id: "ar", code: "1201", name: "Piutang Usaha", account_type: "asset" },
  { id: "inventory", code: "1301", name: "Persediaan", account_type: "asset" },
  { id: "ap", code: "2101", name: "Utang Usaha", account_type: "liability" },
  { id: "capital", code: "3101", name: "Modal", account_type: "equity" },
  { id: "draw", code: "3102", name: "Prive Owner", account_type: "equity" },
  { id: "sales", code: "4101", name: "Penjualan", account_type: "revenue" },
  { id: "cogs", code: "5101", name: "Harga Pokok Penjualan", account_type: "expense" },
  { id: "opex", code: "6102", name: "Beban Operasional", account_type: "expense" },
];

const journal = (id: string, date: string, debitAccount: string, creditAccount: string, amount: number): FinancialJournal => ({
  id, entry_date: date, reference: id, description: id, source_type: "test", status: "locked",
  journal_lines: [
    { account_id: debitAccount, debit: amount, credit: 0 },
    { account_id: creditAccount, debit: 0, credit: amount },
  ],
});

const journals = [
  journal("modal", "2026-01-01", "cash", "capital", 1000),
  journal("sale", "2026-09-05", "ar", "sales", 600),
  journal("receipt", "2026-09-06", "cash", "ar", 400),
  journal("hpp", "2026-09-05", "cogs", "inventory", 200),
  journal("expense", "2026-09-07", "opex", "cash", 100),
  journal("prive", "2026-09-08", "draw", "cash", 50),
];

describe("financial reports", () => {
  it("membentuk laba rugi akrual dan neraca yang seimbang", () => {
    const report = buildAccountingReport(accounts, journals, 2026, 9);
    expect(report.incomeStatement.netRevenue).toBe(600);
    expect(report.incomeStatement.grossProfit).toBe(400);
    expect(report.incomeStatement.netProfit).toBe(300);
    expect(report.balanceSheet.totalAssets).toBe(1250);
    expect(report.balanceSheet.totalLiabilitiesAndEquity).toBe(1250);
    expect(report.balanceSheet.difference).toBe(0);
  });

  it("memisahkan arus kas operasi dan pendanaan", () => {
    const report = buildAccountingReport(accounts, journals, 2026, 9);
    expect(report.cashFlow.operating).toBe(300);
    expect(report.cashFlow.financing).toBe(-50);
    expect(report.cashFlow.netChange).toBe(250);
  });

  it("menghasilkan buku besar dengan saldo berjalan", () => {
    const ledger = buildGeneralLedger(accounts, journals, "cash", "2026-09-01", "2026-09-30");
    expect(ledger.opening).toBe(1000);
    expect(ledger.rows).toHaveLength(3);
    expect(ledger.closing).toBe(1250);
  });
});
