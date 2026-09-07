export type FinancialAccount = {
  id: string;
  code: string;
  name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
};

export type FinancialJournalLine = {
  account_id: string;
  debit: number;
  credit: number;
  description?: string;
};

export type FinancialJournal = {
  id: string;
  entry_date: string;
  reference: string;
  description: string;
  source_type: string;
  status: "draft" | "locked";
  journal_lines?: FinancialJournalLine[];
};

export type TrialBalanceRow = FinancialAccount & {
  opening: number;
  periodDebit: number;
  periodCredit: number;
  closing: number;
  closingDebit: number;
  closingCredit: number;
};

export type StatementRow = Pick<FinancialAccount, "id" | "code" | "name"> & { amount: number };

export type IncomeStatement = {
  mainRevenue: StatementRow[];
  salesReturns: StatementRow[];
  cogs: StatementRow[];
  operatingExpenses: StatementRow[];
  otherIncome: StatementRow[];
  otherExpenses: StatementRow[];
  taxExpenses: StatementRow[];
  grossRevenue: number;
  netRevenue: number;
  totalCogs: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  operatingProfit: number;
  totalOtherIncome: number;
  totalOtherExpenses: number;
  profitBeforeTax: number;
  totalTaxExpenses: number;
  netProfit: number;
};

export type BalanceSheet = {
  currentAssets: StatementRow[];
  nonCurrentAssets: StatementRow[];
  contraAssets: StatementRow[];
  currentLiabilities: StatementRow[];
  nonCurrentLiabilities: StatementRow[];
  equity: StatementRow[];
  totalAssets: number;
  totalLiabilities: number;
  recordedEquity: number;
  priorUnclosedEarnings: number;
  currentEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  difference: number;
};

export type CashFlowRow = {
  id: string;
  date: string;
  reference: string;
  description: string;
  classification: "operating" | "investing" | "financing";
  amount: number;
};

export type AccountingReport = {
  trialBalance: TrialBalanceRow[];
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlow: {
    rows: CashFlowRow[];
    operating: number;
    investing: number;
    financing: number;
    netChange: number;
  };
  equity: {
    opening: number;
    ownerContributions: number;
    drawings: number;
    currentProfit: number;
    closing: number;
  };
  monthly: Array<{
    month: number;
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
  }>;
  diagnostics: {
    draftJournals: number;
    unbalancedJournals: Array<{ id: string; reference: string; debit: number; credit: number }>;
    missingAccountLines: number;
  };
};

const numberOf = (value: unknown) => Number(value) || 0;
const sum = (rows: StatementRow[]) => rows.reduce((total, row) => total + row.amount, 0);
const inRange = (date: string, start: string, end: string) => date >= start && date <= end;
const normalBalance = (account: FinancialAccount, debit: number, credit: number) =>
  account.account_type === "asset" || account.account_type === "expense" ? debit - credit : credit - debit;

function statementRows(accounts: FinancialAccount[], journals: FinancialJournal[], start: string, end: string) {
  const byAccount = new Map<string, number>();
  for (const journal of journals) {
    if (journal.status !== "locked" || !inRange(journal.entry_date, start, end)) continue;
    for (const line of journal.journal_lines ?? []) {
      const account = accounts.find(item => item.id === line.account_id);
      if (!account) continue;
      byAccount.set(account.id, (byAccount.get(account.id) ?? 0) + normalBalance(account, numberOf(line.debit), numberOf(line.credit)));
    }
  }
  return accounts.map(account => ({ id: account.id, code: account.code, name: account.name, type: account.account_type, amount: byAccount.get(account.id) ?? 0 }))
    .filter(row => Math.abs(row.amount) > 0.0001)
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function buildIncomeStatement(accounts: FinancialAccount[], journals: FinancialJournal[], start: string, end: string): IncomeStatement {
  const rows = statementRows(accounts, journals, start, end);
  const asRows = (predicate: (row: typeof rows[number]) => boolean): StatementRow[] => rows.filter(predicate).map(({ id, code, name, amount }) => ({ id, code, name, amount }));
  const salesReturns = asRows(row => row.type === "revenue" && /^42/.test(row.code));
  const mainRevenue = asRows(row => row.type === "revenue" && /^4/.test(row.code) && !/^42/.test(row.code));
  const cogs = asRows(row => row.type === "expense" && /^5/.test(row.code));
  const operatingExpenses = asRows(row => row.type === "expense" && /^6/.test(row.code));
  const otherIncome = asRows(row => row.type === "revenue" && !/^4/.test(row.code));
  const taxExpenses = asRows(row => row.type === "expense" && (/^82/.test(row.code) || /pajak/i.test(row.name)));
  const otherExpenses = asRows(row => row.type === "expense" && !/^5/.test(row.code) && !/^6/.test(row.code) && !taxExpenses.some(tax => tax.id === row.id));
  const grossRevenue = sum(mainRevenue);
  const netRevenue = grossRevenue + sum(salesReturns);
  const totalCogs = sum(cogs);
  const grossProfit = netRevenue - totalCogs;
  const totalOperatingExpenses = sum(operatingExpenses);
  const operatingProfit = grossProfit - totalOperatingExpenses;
  const totalOtherIncome = sum(otherIncome);
  const totalOtherExpenses = sum(otherExpenses);
  const profitBeforeTax = operatingProfit + totalOtherIncome - totalOtherExpenses;
  const totalTaxExpenses = sum(taxExpenses);
  return { mainRevenue, salesReturns, cogs, operatingExpenses, otherIncome, otherExpenses, taxExpenses, grossRevenue, netRevenue, totalCogs, grossProfit, totalOperatingExpenses, operatingProfit, totalOtherIncome, totalOtherExpenses, profitBeforeTax, totalTaxExpenses, netProfit: profitBeforeTax - totalTaxExpenses };
}

export function buildTrialBalance(accounts: FinancialAccount[], journals: FinancialJournal[], start: string, end: string): TrialBalanceRow[] {
  const rows = new Map(accounts.map(account => [account.id, { account, openingDebit: 0, openingCredit: 0, periodDebit: 0, periodCredit: 0 }]));
  for (const journal of journals) {
    if (journal.status !== "locked" || journal.entry_date > end) continue;
    for (const line of journal.journal_lines ?? []) {
      const row = rows.get(line.account_id);
      if (!row) continue;
      if (journal.entry_date < start) {
        row.openingDebit += numberOf(line.debit);
        row.openingCredit += numberOf(line.credit);
      } else {
        row.periodDebit += numberOf(line.debit);
        row.periodCredit += numberOf(line.credit);
      }
    }
  }
  return [...rows.values()].map(({ account, openingDebit, openingCredit, periodDebit, periodCredit }) => {
    const opening = normalBalance(account, openingDebit, openingCredit);
    const closing = normalBalance(account, openingDebit + periodDebit, openingCredit + periodCredit);
    const naturalDebit = account.account_type === "asset" || account.account_type === "expense";
    return { ...account, opening, periodDebit, periodCredit, closing, closingDebit: naturalDebit ? Math.max(closing, 0) : Math.max(-closing, 0), closingCredit: naturalDebit ? Math.max(-closing, 0) : Math.max(closing, 0) };
  }).filter(row => row.opening || row.periodDebit || row.periodCredit || row.closing).sort((a, b) => a.code.localeCompare(b.code));
}

function buildBalanceSheet(accounts: FinancialAccount[], journals: FinancialJournal[], year: number, end: string): BalanceSheet {
  const balances = buildTrialBalance(accounts, journals, "0001-01-01", end);
  const toStatement = (row: TrialBalanceRow): StatementRow => ({ id: row.id, code: row.code, name: row.name, amount: row.closing });
  const assets = balances.filter(row => row.account_type === "asset");
  const currentAssets = assets.filter(row => Number(row.code.slice(0, 2)) < 15 && !/^159/.test(row.code)).map(toStatement);
  const nonCurrentAssets = assets.filter(row => Number(row.code.slice(0, 2)) >= 15 && !/^159/.test(row.code)).map(toStatement);
  const contraAssets = assets.filter(row => /^159/.test(row.code)).map(toStatement);
  const liabilities = balances.filter(row => row.account_type === "liability");
  const currentLiabilities = liabilities.filter(row => !/^23/.test(row.code)).map(toStatement);
  const nonCurrentLiabilities = liabilities.filter(row => /^23/.test(row.code)).map(toStatement);
  const equity = balances.filter(row => row.account_type === "equity").map(toStatement);
  const yearStart = `${year}-01-01`;
  const currentEarnings = buildIncomeStatement(accounts, journals, yearStart, end).netProfit;
  const priorUnclosedEarnings = buildIncomeStatement(accounts, journals, "0001-01-01", `${year - 1}-12-31`).netProfit;
  const totalAssets = sum(currentAssets) + sum(nonCurrentAssets) + sum(contraAssets);
  const totalLiabilities = sum(currentLiabilities) + sum(nonCurrentLiabilities);
  const recordedEquity = sum(equity);
  const totalEquity = recordedEquity + priorUnclosedEarnings + currentEarnings;
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  return { currentAssets, nonCurrentAssets, contraAssets, currentLiabilities, nonCurrentLiabilities, equity, totalAssets, totalLiabilities, recordedEquity, priorUnclosedEarnings, currentEarnings, totalEquity, totalLiabilitiesAndEquity, difference: totalAssets - totalLiabilitiesAndEquity };
}

function classifyCashFlow(counterparts: FinancialAccount[]): CashFlowRow["classification"] {
  if (counterparts.some(account => /^15/.test(account.code))) return "investing";
  if (counterparts.some(account => account.account_type === "equity" || /^23/.test(account.code) || /pinjaman/i.test(account.name))) return "financing";
  return "operating";
}

function buildCashFlow(accounts: FinancialAccount[], journals: FinancialJournal[], start: string, end: string) {
  const accountMap = new Map(accounts.map(account => [account.id, account]));
  const rows: CashFlowRow[] = [];
  for (const journal of journals) {
    if (journal.status !== "locked" || !inRange(journal.entry_date, start, end)) continue;
    const lines = journal.journal_lines ?? [];
    const cashLines = lines.filter(line => {
      const account = accountMap.get(line.account_id);
      return account && (/^110[12]$/.test(account.code) || /^(kas|bank)/i.test(account.name));
    });
    const amount = cashLines.reduce((total, line) => total + numberOf(line.debit) - numberOf(line.credit), 0);
    if (!amount) continue;
    const cashIds = new Set(cashLines.map(line => line.account_id));
    const counterparts = lines.map(line => accountMap.get(line.account_id)).filter((account): account is FinancialAccount => !!account && !cashIds.has(account.id));
    rows.push({ id: journal.id, date: journal.entry_date, reference: journal.reference, description: journal.description, classification: classifyCashFlow(counterparts), amount });
  }
  const total = (classification: CashFlowRow["classification"]) => rows.filter(row => row.classification === classification).reduce((value, row) => value + row.amount, 0);
  const operating = total("operating"), investing = total("investing"), financing = total("financing");
  return { rows: rows.sort((a, b) => a.date.localeCompare(b.date)), operating, investing, financing, netChange: operating + investing + financing };
}

export function buildAccountingReport(accounts: FinancialAccount[], journals: FinancialJournal[], year: number, month: number): AccountingReport {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = new Date(year, month, 0).toISOString().slice(0, 10);
  const locked = journals.filter(journal => journal.status === "locked");
  const trialBalance = buildTrialBalance(accounts, journals, start, end);
  const incomeStatement = buildIncomeStatement(accounts, journals, start, end);
  const balanceSheet = buildBalanceSheet(accounts, journals, year, end);
  const cashFlow = buildCashFlow(accounts, journals, start, end);
  const yearStart = `${year}-01-01`, priorEnd = `${year - 1}-12-31`;
  const equityBalances = buildTrialBalance(accounts, journals, yearStart, end).filter(row => row.account_type === "equity");
  const openingRecordedEquity = buildTrialBalance(accounts, journals, "0001-01-01", priorEnd).filter(row => row.account_type === "equity").reduce((total, row) => total + row.closing, 0);
  const openingEquity = openingRecordedEquity + balanceSheet.priorUnclosedEarnings;
  const ownerContributions = equityBalances.filter(row => !/prive|penarikan/i.test(row.name)).reduce((total, row) => total + row.periodCredit, 0);
  const drawings = equityBalances.filter(row => /prive|penarikan/i.test(row.name)).reduce((total, row) => total + row.periodDebit - row.periodCredit, 0);
  const monthly = Array.from({ length: month }, (_, index) => {
    const currentMonth = index + 1;
    const monthStart = `${year}-${String(currentMonth).padStart(2, "0")}-01`;
    const monthEnd = new Date(year, currentMonth, 0).toISOString().slice(0, 10);
    const statement = buildIncomeStatement(accounts, journals, monthStart, monthEnd);
    return { month: currentMonth, revenue: statement.netRevenue, cogs: statement.totalCogs, grossProfit: statement.grossProfit, operatingExpenses: statement.totalOperatingExpenses, netProfit: statement.netProfit };
  });
  let missingAccountLines = 0;
  const knownAccounts = new Set(accounts.map(account => account.id));
  const unbalancedJournals = locked.flatMap(journal => {
    const debit = (journal.journal_lines ?? []).reduce((total, line) => total + numberOf(line.debit), 0);
    const credit = (journal.journal_lines ?? []).reduce((total, line) => total + numberOf(line.credit), 0);
    missingAccountLines += (journal.journal_lines ?? []).filter(line => !knownAccounts.has(line.account_id)).length;
    return debit === credit && debit > 0 ? [] : [{ id: journal.id, reference: journal.reference, debit, credit }];
  });
  return {
    trialBalance,
    incomeStatement,
    balanceSheet,
    cashFlow,
    equity: { opening: openingEquity, ownerContributions, drawings, currentProfit: balanceSheet.currentEarnings, closing: balanceSheet.totalEquity },
    monthly,
    diagnostics: { draftJournals: journals.filter(journal => journal.status === "draft").length, unbalancedJournals, missingAccountLines },
  };
}

export function buildGeneralLedger(accounts: FinancialAccount[], journals: FinancialJournal[], accountId: string, start: string, end: string) {
  const account = accounts.find(item => item.id === accountId);
  if (!account) return { account: null, opening: 0, closing: 0, rows: [] as Array<{ id: string; date: string; reference: string; description: string; debit: number; credit: number; balance: number }> };
  let balance = 0;
  for (const journal of journals.filter(item => item.status === "locked" && item.entry_date < start)) {
    for (const line of journal.journal_lines ?? []) if (line.account_id === accountId) balance += normalBalance(account, numberOf(line.debit), numberOf(line.credit));
  }
  const opening = balance;
  const rows = journals.filter(item => item.status === "locked" && inRange(item.entry_date, start, end)).sort((a, b) => a.entry_date.localeCompare(b.entry_date)).flatMap(journal =>
    (journal.journal_lines ?? []).filter(line => line.account_id === accountId).map(line => {
      balance += normalBalance(account, numberOf(line.debit), numberOf(line.credit));
      return { id: `${journal.id}:${line.description ?? ""}`, date: journal.entry_date, reference: journal.reference, description: line.description || journal.description, debit: numberOf(line.debit), credit: numberOf(line.credit), balance };
    })
  );
  return { account, opening, closing: balance, rows };
}
