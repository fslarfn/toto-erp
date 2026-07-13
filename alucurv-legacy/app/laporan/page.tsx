"use client";

import { useState } from "react";
import { useDB } from "@/lib/store";
import { rupiah, monthlySummary, currentMonth, monthLabel, accountBalance } from "@/lib/utils";
import { PageHeader, Card, StatCard, TextInput, Button } from "@/components/ui";

export default function LaporanPage() {
  const { db, ready } = useDB();
  const [ym, setYm] = useState(currentMonth());
  if (!ready) return null;

  const sum = monthlySummary(db, ym);
  const bendingDebt = db.bending.filter((b) => b.status === "BELUM").reduce((s, b) => s + b.amount, 0);
  const totalMoney = db.accounts.reduce((s, a) => s + accountBalance(db, a.id), 0);

  const incomeCats = sum.byCategory.filter((c) => c.type === "Pemasukan").sort((a, b) => b.total - a.total);
  const expenseCats = sum.byCategory.filter((c) => c.type === "Pengeluaran").sort((a, b) => b.total - a.total);

  return (
    <div>
      <PageHeader
        title="Laporan Bulanan"
        desc="Rekapitulasi otomatis pemasukan, pengeluaran, laba, posisi kas, dan kewajiban — pengganti tab LAPORAN & REKON."
        action={
          <div className="flex gap-2">
            <TextInput type="month" value={ym} onChange={(e) => setYm(e.target.value)} />
            <Button variant="ghost" onClick={() => window.print()}>Cetak</Button>
          </div>
        }
      />

      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-alu-muted">Rekapitulasi {monthLabel(ym)}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Pemasukan" value={rupiah(sum.income)} tone="green" />
        <StatCard label="Total Pengeluaran" value={rupiah(sum.expense)} tone="red" />
        <StatCard label="Laba / Rugi" value={rupiah(sum.profit)} tone={sum.profit >= 0 ? "green" : "red"} />
        <StatCard label="Margin" value={sum.income ? `${((sum.profit / sum.income) * 100).toFixed(1)}%` : "—"} />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold text-green">Pemasukan per Kategori</h3>
          {incomeCats.length === 0 && <p className="text-sm text-alu-muted">Tidak ada pemasukan pada periode ini.</p>}
          {incomeCats.map((c, i) => (
            <Row key={i} name={c.name} value={c.total} max={sum.income} color="bg-green" />
          ))}
        </Card>
        <Card>
          <h3 className="mb-3 font-bold text-red">Pengeluaran per Kategori</h3>
          {expenseCats.length === 0 && <p className="text-sm text-alu-muted">Tidak ada pengeluaran pada periode ini.</p>}
          {expenseCats.map((c, i) => (
            <Row key={i} name={c.name} value={c.total} max={sum.expense} color="bg-red" />
          ))}
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold">Laporan Posisi Kas</h3>
          <ul className="space-y-2 text-sm">
            {db.accounts.map((a) => (
              <li key={a.id} className="flex justify-between border-b border-alu-line pb-2 last:border-0">
                <span>{a.name}</span>
                <span className="tnum font-semibold">{rupiah(accountBalance(db, a.id))}</span>
              </li>
            ))}
            <li className="flex justify-between pt-1 font-bold">
              <span>Total uang beredar</span>
              <span className="tnum">{rupiah(totalMoney)}</span>
            </li>
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-bold">Laporan Kewajiban</h3>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between border-b border-alu-line pb-2">
              <span>Sisa tagihan Bending CV Toto</span>
              <span className="tnum font-semibold text-red">{rupiah(bendingDebt)}</span>
            </li>
            <li className="flex justify-between">
              <span>Sisa cashbon karyawan (piutang)</span>
              <span className="tnum font-semibold text-green">
                {rupiah(db.cashbons.reduce((s, cb) => s + Math.max(0, cb.amount - cb.payments.reduce((x, p) => x + p.amount, 0)), 0))}
              </span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-alu-muted">
            Catatan: laba di atas dihitung dari transaksi kas (cash basis), sama seperti pola rekap di sheet lama.
            Omset marketplace sebaiknya dicatat saat pencairan saldo Shopee/TikTok agar konsisten.
          </p>
        </Card>
      </div>
    </div>
  );
}

function Row({ name, value, max, color }: { name: string; value: number; max: number; color: string }) {
  return (
    <div className="mb-2.5">
      <div className="flex justify-between text-sm">
        <span>{name}</span>
        <span className="tnum font-semibold">{rupiah(value)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-alu-bg">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
      </div>
    </div>
  );
}
