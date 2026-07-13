"use client";

import Link from "next/link";
import { useDB } from "@/lib/store";
import { rupiah, accountBalance, monthlySummary, currentMonth, monthLabel, stockLevel, shortDate, ORDER_STEPS } from "@/lib/utils";
import { Card, StatCard, Badge, PageHeader } from "@/components/ui";

export default function Dashboard() {
  const { db, ready } = useDB();
  if (!ready) return null;

  const ym = currentMonth();
  const sum = monthlySummary(db, ym);
  const totalBalance = db.accounts.reduce((s, a) => s + accountBalance(db, a.id), 0);

  const activeOrders = db.orders.filter((o) => !o.sampai);
  const lowStock = db.stockItems.filter((it) => stockLevel(db, it.id) <= it.minStock);
  const bendingDebt = db.bending.filter((b) => b.status === "BELUM").reduce((s, b) => s + b.amount, 0);
  const unpaidInvoices = db.invoices.filter((i) => i.status !== "LUNAS");

  return (
    <div>
      <PageHeader title="Dashboard" desc={`Ringkasan ${monthLabel(ym)} — semua angka dihitung otomatis dari pencatatan.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Uang Beredar" value={rupiah(totalBalance)} sub="Semua akun & saldo marketplace" tone="steel" />
        <StatCard label="Pemasukan Bulan Ini" value={rupiah(sum.income)} tone="green" />
        <StatCard label="Pengeluaran Bulan Ini" value={rupiah(sum.expense)} tone="red" />
        <StatCard label="Laba Bulan Ini" value={rupiah(sum.profit)} tone={sum.profit >= 0 ? "green" : "red"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Saldo per akun */}
        <Card>
          <h2 className="mb-3 font-bold">Saldo per Akun</h2>
          <ul className="space-y-2">
            {db.accounts.map((a) => (
              <li key={a.id} className="flex items-center justify-between border-b border-alu-line pb-2 text-sm last:border-0 last:pb-0">
                <span className="flex items-center gap-2">
                  <Badge tone={a.type === "marketplace" ? "amber" : a.type === "cash" ? "gray" : "steel"}>
                    {a.type === "marketplace" ? "MP" : a.type === "cash" ? "Kas" : "Bank"}
                  </Badge>
                  {a.name}
                </span>
                <span className="tnum font-semibold">{rupiah(accountBalance(db, a.id))}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Order aktif */}
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">Order Berjalan</h2>
            <Link href="/order" className="text-xs font-semibold text-steel hover:underline">Lihat semua</Link>
          </div>
          {activeOrders.length === 0 ? (
            <p className="text-sm text-alu-muted">Semua order sudah sampai di customer. 🎉</p>
          ) : (
            <ul className="space-y-3">
              {activeOrders.slice(0, 5).map((o) => {
                const done = ORDER_STEPS.filter(([k]) => o[k]).length;
                return (
                  <li key={o.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{o.customer}</span>
                      <Badge tone={o.channel === "Offline" ? "gray" : "amber"}>{o.channel}</Badge>
                    </div>
                    <div className="truncate text-xs text-alu-muted">{o.description}</div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-alu-bg">
                        <div className="h-full rounded-full bg-steel" style={{ width: `${(done / 5) * 100}%` }} />
                      </div>
                      <span className="text-[11px] text-alu-muted">Deadline {shortDate(o.deadline)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Perhatian */}
        <Card>
          <h2 className="mb-3 font-bold">Perlu Perhatian</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex items-start justify-between gap-2">
              <span>Sisa tagihan bending CV Toto</span>
              <span className="tnum font-semibold text-red">{rupiah(bendingDebt)}</span>
            </li>
            <li className="flex items-start justify-between gap-2">
              <span>Invoice belum lunas</span>
              <span className="tnum font-semibold">{unpaidInvoices.length} nota</span>
            </li>
            <li>
              <div className="mb-1 flex items-center justify-between">
                <span>Stok minim (perlu buat lagi)</span>
                <span className="font-semibold">{lowStock.length} item</span>
              </div>
              {lowStock.slice(0, 4).map((it) => (
                <div key={it.id} className="flex justify-between text-xs text-alu-muted">
                  <span className="truncate">{it.name}</span>
                  <Badge tone="red">sisa {stockLevel(db, it.id)}</Badge>
                </div>
              ))}
            </li>
          </ul>
        </Card>
      </div>

      {/* Rekap kategori bulan ini */}
      <Card className="mt-4">
        <h2 className="mb-3 font-bold">Rekap per Kategori — {monthLabel(ym)}</h2>
        {sum.byCategory.length === 0 ? (
          <p className="text-sm text-alu-muted">Belum ada transaksi bulan ini. Mulai catat di menu Transaksi Kas.</p>
        ) : (
          <div className="grid gap-x-8 gap-y-1.5 sm:grid-cols-2">
            {sum.byCategory
              .sort((a, b) => b.total - a.total)
              .map((c, i) => (
                <div key={i} className="flex items-center justify-between border-b border-alu-line py-1.5 text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${c.type === "Pemasukan" ? "bg-green" : "bg-red"}`} />
                    {c.name}
                  </span>
                  <span className="tnum font-semibold">{rupiah(c.total)}</span>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
