// ============================================================
// lib/balance.ts
// SATU sumber kebenaran perhitungan saldo kas — dipakai oleh kartu
// saldo, ringkasan, laporan, dan panel rekonsiliasi. Murni (pure),
// tanpa I/O, agar mudah diuji dan konsisten dengan VIEW di Postgres
// (lihat supabase/migrations/20260617_balance_single_source.sql).
// ============================================================
import type { CashFlow, BankAccount, AccountReconciliation } from "@/types";

// Subset minimal yang dibutuhkan perhitungan (memudahkan pengujian).
export type CashFlowLike = Pick<CashFlow, "accountId" | "type" | "amount" | "isTest" | "isAdjustment" | "category" | "transferGroup">;
export type AccountLike = Pick<BankAccount, "id" | "name" | "initialBalance">;

export interface BalanceOptions {
  /** Sertakan entri is_test dalam perhitungan (default: false). */
  includeTest?: boolean;
  /** Sertakan entri penyesuaian (is_adjustment) (default: true).
   *  Untuk rekonsiliasi, set false agar penyeimbang otomatis tidak menutupi selisih nyata. */
  includeAdjustment?: boolean;
}

/** Normalisasi nama kas: trim + lowercase (+ alias tunai → cash). */
export function normalizeAccountName(name: string | null | undefined): string {
  const n = (name ?? "").trim().toLowerCase();
  if (n === "tunai" || n === "kas") return "cash";
  return n;
}

/**
 * Resolusi nama/string kas lama → id akun. Mengembalikan null bila tidak
 * ada padanan yang unik (caller wajib melaporkan, JANGAN dibuang diam-diam).
 */
export function resolveAccountId(
  nameOrId: string | null | undefined,
  accounts: AccountLike[]
): string | null {
  if (!nameOrId) return null;
  // Sudah berupa id?
  const byId = accounts.find((a) => a.id === nameOrId);
  if (byId) return byId.id;

  const target = normalizeAccountName(nameOrId);
  const exact = accounts.filter((a) => normalizeAccountName(a.name) === target);
  if (exact.length === 1) return exact[0].id;

  // Pencocokan longgar (substring), hanya bila unik.
  const loose = accounts.filter((a) => {
    const an = normalizeAccountName(a.name);
    return an.includes(target) || target.includes(an);
  });
  if (loose.length === 1) return loose[0].id;

  return null;
}

/**
 * computeBalance — SUMBER KEBENARAN saldo satu akun.
 *   initial_balance
 *     + Σ amount (income, account_id = accountId)
 *     - Σ amount (expense, account_id = accountId)
 * Entri is_test dikecualikan kecuali opts.includeTest = true.
 */
export function computeBalance(
  accountId: string,
  accounts: AccountLike[],
  cashFlow: CashFlowLike[],
  opts: BalanceOptions = {}
): number {
  const acc = accounts.find((a) => a.id === accountId);
  let balance = acc?.initialBalance ?? 0;
  for (const c of cashFlow) {
    if (c.accountId !== accountId) continue;
    if (!opts.includeTest && c.isTest) continue;
    if (opts.includeAdjustment === false && c.isAdjustment) continue;
    balance += c.type === "income" ? c.amount : -c.amount;
  }
  return balance;
}

/** Total saldo seluruh akun (jumlah computeBalance tiap akun). */
export function computeTotalBalance(
  accounts: AccountLike[],
  cashFlow: CashFlowLike[],
  opts: BalanceOptions = {}
): number {
  return accounts.reduce((sum, a) => sum + computeBalance(a.id, accounts, cashFlow, opts), 0);
}

/** Ringkasan Masuk/Keluar global (mengecualikan is_test secara default). */
export function computeTotals(
  cashFlow: CashFlowLike[],
  opts: BalanceOptions = {}
): { income: number; expense: number; net: number } {
  let income = 0;
  let expense = 0;
  for (const c of cashFlow) {
    if (!opts.includeTest && c.isTest) continue;
    if (c.type === "income") income += c.amount;
    else expense += c.amount;
  }
  return { income, expense, net: income - expense };
}

/**
 * Rekonsiliasi: saldo tersimpan (cache) vs saldo terhitung + selisihnya,
 * untuk setiap akun. diff = stored - computed (idealnya 0).
 */
export function reconcileAccounts(
  accounts: BankAccount[],
  cashFlow: CashFlowLike[],
  opts: BalanceOptions = {}
): AccountReconciliation[] {
  return accounts.map((a) => {
    const computed = computeBalance(a.id, accounts, cashFlow, opts);
    return {
      id: a.id,
      name: a.name,
      storedBalance: a.balance,
      computedBalance: computed,
      diff: a.balance - computed,
    };
  });
}

/**
 * Bentuk pasangan mutasi antar-kas (E). Menghasilkan DUA entri cash_flow:
 * expense pada akun sumber + income pada akun tujuan, dengan transferGroup
 * sama sehingga total tetap balance dan tidak dobel/hilang.
 */
export function buildTransferPair(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  description?: string;
  createdBy?: string;
  transferGroup?: string;
}): [Omit<CashFlow, "id" | "bankAccount">, Omit<CashFlow, "id" | "bankAccount">] {
  const {
    fromAccountId, toAccountId, amount, date,
    description = "Mutasi antar kas",
    createdBy = "",
  } = params;
  const group = params.transferGroup ?? `transfer-${Date.now()}`;
  const base = {
    category: "Mutasi Kas",
    amount,
    description,
    date,
    createdBy,
    isTest: false,
    isAdjustment: false,
    transferGroup: group,
  };
  const out: Omit<CashFlow, "id" | "bankAccount"> = {
    ...base, type: "expense", accountId: fromAccountId,
  };
  const inn: Omit<CashFlow, "id" | "bankAccount"> = {
    ...base, type: "income", accountId: toAccountId,
  };
  return [out, inn];
}
