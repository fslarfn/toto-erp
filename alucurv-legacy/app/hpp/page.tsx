"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { HppCalculation, HppComponent } from "@/lib/types";
import { rupiah } from "@/lib/utils";
import { PageHeader, Button, Card, Modal, Field, TextInput, RowActions, Badge } from "@/components/ui";

const emptyComp = (): HppComponent => ({ id: uid("hc"), name: "", note: "", cost: 0, sellPrice: 0 });
const emptyCalc = (): Omit<HppCalculation, "id"> => ({
  productName: "",
  marketCutPercent: 10,
  currentPrice: 0,
  components: [
    { ...emptyComp(), name: "KUSEN BENDING" },
    { ...emptyComp(), name: "KACA" },
    { ...emptyComp(), name: "RAKIT" },
    { ...emptyComp(), name: "ORNAMEN LURUS" },
    { ...emptyComp(), name: "PALET" },
  ],
});

function totals(c: Omit<HppCalculation, "id">) {
  const baseCost = c.components.reduce((s, x) => s + x.cost, 0);
  const baseSell = c.components.reduce((s, x) => s + x.sellPrice, 0);
  const cutCost = (baseCost * c.marketCutPercent) / 100;
  const cutSell = (baseSell * c.marketCutPercent) / 100;
  const totalCost = baseCost + cutCost;
  const totalSell = baseSell + cutSell;
  return { totalCost, totalSell, margin: totalSell - totalCost, diff: c.currentPrice - totalCost };
}

export default function HppPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyCalc());

  if (!ready) return null;

  const openNew = () => { setEditId(null); setForm(emptyCalc()); setOpen(true); };
  const openEdit = (h: HppCalculation) => { setEditId(h.id); setForm({ ...h, components: h.components.map((c) => ({ ...c })) }); setOpen(true); };

  const save = () => {
    if (!form.productName) { alert("Isi nama produk dulu ya."); return; }
    if (editId) update("hpp", editId, form);
    else insert("hpp", { id: uid("hpp"), ...form });
    setOpen(false);
  };

  const setComp = (idx: number, patch: Partial<HppComponent>) =>
    setForm((f) => ({ ...f, components: f.components.map((c, i) => (i === idx ? { ...c, ...patch } : c)) }));

  const ft = totals(form);

  return (
    <div>
      <PageHeader
        title="HPP Produk"
        desc="Kalkulator harga pokok penjualan per produk: komponen modal, potongan marketplace, dan margin — pengganti tab HPP."
        action={<Button onClick={openNew}>+ Hitung Produk Baru</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {db.hpp.length === 0 && (
          <Card><p className="text-sm text-alu-muted">Belum ada perhitungan HPP. Klik tombol di atas untuk mulai.</p></Card>
        )}
        {db.hpp.map((h) => {
          const t = totals(h);
          return (
            <Card key={h.id}>
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h2 className="font-bold">{h.productName}</h2>
                  <div className="text-xs text-alu-muted">Potongan marketplace {h.marketCutPercent}%</div>
                </div>
                <RowActions onEdit={() => openEdit(h)} onDelete={() => remove("hpp", h.id)} />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-alu-line text-left text-[11px] uppercase tracking-wide text-alu-muted">
                    <th className="py-1">Komponen</th><th className="py-1 text-right">Modal</th><th className="py-1 text-right">Harga Jual</th><th className="py-1 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alu-line">
                  {h.components.map((c) => (
                    <tr key={c.id}>
                      <td className="py-1.5">{c.name}{c.note && <div className="text-[11px] text-alu-muted">{c.note}</div>}</td>
                      <td className="tnum py-1.5 text-right">{rupiah(c.cost)}</td>
                      <td className="tnum py-1.5 text-right">{rupiah(c.sellPrice)}</td>
                      <td className="tnum py-1.5 text-right text-green">{rupiah(c.sellPrice - c.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-alu-bg p-3 text-sm">
                <div>Total Modal <div className="tnum font-bold">{rupiah(t.totalCost)}</div></div>
                <div>Total Harga Jual <div className="tnum font-bold">{rupiah(t.totalSell)}</div></div>
                <div>Total Margin <div className="tnum font-bold text-green">{rupiah(t.margin)}</div></div>
                <div>
                  Harga Sekarang <div className="tnum font-bold">{rupiah(h.currentPrice)}</div>
                  <div className="mt-0.5">
                    {t.diff >= 0
                      ? <Badge tone="green">untung {rupiah(t.diff)} dari modal</Badge>
                      : <Badge tone="red">di bawah modal {rupiah(-t.diff)}</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={open} title={editId ? "Ubah Perhitungan HPP" : "Perhitungan HPP Baru"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nama Produk" className="sm:col-span-2">
            <TextInput placeholder="contoh: KACAMATI D.60" value={form.productName} onChange={(e) => setForm({ ...form, productName: e.target.value })} />
          </Field>
          <Field label="Potongan Marketplace (%)">
            <TextInput type="number" min={0} max={100} value={form.marketCutPercent} onChange={(e) => setForm({ ...form, marketCutPercent: Number(e.target.value) })} />
          </Field>
        </div>

        <div className="mt-4">
          <div className="mb-1 grid grid-cols-[1fr_1fr_110px_110px_32px] gap-2 text-[11px] font-semibold uppercase tracking-wide text-alu-muted">
            <span>Komponen</span><span>Keterangan</span><span>Modal</span><span>Harga Jual</span><span />
          </div>
          {form.components.map((c, i) => (
            <div key={c.id} className="mb-2 grid grid-cols-[1fr_1fr_110px_110px_32px] gap-2">
              <TextInput value={c.name} onChange={(e) => setComp(i, { name: e.target.value })} />
              <TextInput placeholder="1,5 x 2pcs x 170.000" value={c.note ?? ""} onChange={(e) => setComp(i, { note: e.target.value })} />
              <TextInput type="number" min={0} value={c.cost || ""} onChange={(e) => setComp(i, { cost: Number(e.target.value) })} />
              <TextInput type="number" min={0} value={c.sellPrice || ""} onChange={(e) => setComp(i, { sellPrice: Number(e.target.value) })} />
              <button onClick={() => setForm((f) => ({ ...f, components: f.components.filter((_, x) => x !== i) }))} className="rounded-md text-red hover:bg-red-soft" aria-label="Hapus">✕</button>
            </div>
          ))}
          <Button variant="subtle" onClick={() => setForm((f) => ({ ...f, components: [...f.components, emptyComp()] }))}>+ Tambah komponen</Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Harga Jual Sekarang di Marketplace (Rp)">
            <TextInput type="number" min={0} value={form.currentPrice || ""} onChange={(e) => setForm({ ...form, currentPrice: Number(e.target.value) })} />
          </Field>
          <div className="rounded-lg bg-steel-soft p-3 text-sm">
            <div className="flex justify-between"><span>Total modal (+{form.marketCutPercent}%)</span><span className="tnum font-bold">{rupiah(ft.totalCost)}</span></div>
            <div className="flex justify-between"><span>Total harga jual</span><span className="tnum font-bold">{rupiah(ft.totalSell)}</span></div>
            <div className="flex justify-between"><span>Margin</span><span className="tnum font-bold text-green">{rupiah(ft.margin)}</span></div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
