import type { Database, Invoice, Cashbon } from "./types";

export const rupiah = (n: number): string =>
  "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(Math.round(n));

export const shortDate = (iso?: string): string => {
  if (!iso) return "-";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
export const currentMonth = (): string => todayISO().slice(0, 7);

// ---------- Keuangan ----------
export function accountBalance(db: Database, accountId: string): number {
  const acc = db.accounts.find((a) => a.id === accountId);
  if (!acc) return 0;
  return db.transactions.reduce(
    (bal, t) => (t.accountId === accountId ? bal + (t.type === "Pemasukan" ? t.amount : -t.amount) : bal),
    acc.openingBalance
  );
}

export function monthlySummary(db: Database, ym: string) {
  const txs = db.transactions.filter((t) => t.date.startsWith(ym));
  const income = txs.filter((t) => t.type === "Pemasukan").reduce((s, t) => s + t.amount, 0);
  const expense = txs.filter((t) => t.type === "Pengeluaran").reduce((s, t) => s + t.amount, 0);
  const byCategory = new Map<string, { name: string; type: string; total: number }>();
  for (const t of txs) {
    const sc = db.subCategories.find((s) => s.id === t.subCategoryId);
    const key = t.subCategoryId + t.type;
    const cur = byCategory.get(key) ?? { name: sc?.name ?? "Lainnya", type: t.type, total: 0 };
    cur.total += t.amount;
    byCategory.set(key, cur);
  }
  return { income, expense, profit: income - expense, byCategory: [...byCategory.values()] };
}

// ---------- Invoice ----------
export const invoiceTotal = (inv: Invoice): number =>
  inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);

export const invoiceRemaining = (inv: Invoice): number =>
  inv.status === "LUNAS" ? 0 : invoiceTotal(inv) - (inv.dpAmount ?? 0);

/** Nomor otomatis format AL/INV/MM/YYYY/NNN (urut global, seperti di sheet). */
export function nextDocNumber(existing: string[], kind: "INV" | "SJ", date: string): string {
  const [y, m] = date.split("-");
  let max = 0;
  for (const num of existing) {
    const seq = parseInt(num.split("/").pop() ?? "0", 10);
    if (!isNaN(seq) && seq > max) max = seq;
  }
  return `AL/${kind}/${m}/${y}/${String(max + 1).padStart(3, "0")}`;
}

// ---------- Stok ----------
export function stockLevel(db: Database, itemId: string): number {
  const item = db.stockItems.find((s) => s.id === itemId);
  if (!item) return 0;
  return db.stockMovements.reduce(
    (n, mv) => (mv.itemId === itemId ? n + (mv.type === "masuk" ? mv.qty : -mv.qty) : n),
    item.openingStock
  );
}

// ---------- Cashbon ----------
export function cashbonPaid(cb: Cashbon): number {
  return cb.payments.reduce((s, p) => s + p.amount, 0);
}
export function cashbonRemaining(cb: Cashbon): number {
  return Math.max(0, cb.amount - cashbonPaid(cb));
}

// ---------- Order ----------
export const ORDER_STEPS = [
  ["produksi", "Produksi"],
  ["perakitan", "Perakitan"],
  ["packing", "Packing"],
  ["dikirim", "Dikirim"],
  ["sampai", "Sampai"],
] as const;
