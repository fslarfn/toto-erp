"use client";

import { useMemo, useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Order, OrderChannel } from "@/lib/types";
import { rupiah, shortDate, todayISO, ORDER_STEPS } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, TextArea, RowActions, Tabs } from "@/components/ui";

const empty = (): Omit<Order, "id"> => ({
  date: todayISO(), customer: "", description: "", channel: "Shopee",
  deadline: todayISO(), price: 0, expedition: "",
  produksi: false, perakitan: false, packing: false, dikirim: false, sampai: false,
});

export default function OrderPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [tab, setTab] = useState("Berjalan");

  const rows = useMemo(() => {
    const all = [...db.orders].sort((a, b) => b.date.localeCompare(a.date));
    if (tab === "Berjalan") return all.filter((o) => !o.sampai);
    if (tab === "Selesai") return all.filter((o) => o.sampai);
    return all;
  }, [db.orders, tab]);

  if (!ready) return null;

  const openNew = () => { setEditId(null); setForm(empty()); setOpen(true); };
  const openEdit = (o: Order) => { setEditId(o.id); setForm({ ...o }); setOpen(true); };

  const save = () => {
    if (!form.customer || !form.description) { alert("Isi nama customer dan deskripsi order dulu ya."); return; }
    if (editId) update("orders", editId, form);
    else insert("orders", { id: uid("o"), ...form });
    setOpen(false);
  };

  const toggleStep = (o: Order, key: (typeof ORDER_STEPS)[number][0]) => {
    update("orders", o.id, { [key]: !o[key] } as Partial<Order>);
  };

  return (
    <div>
      <PageHeader
        title="Order"
        desc="Pencatatan order Shopee, TikTokShop, dan offline dengan status produksi → perakitan → packing → kirim → sampai."
        action={<Button onClick={openNew}>+ Order Baru</Button>}
      />

      <Tabs tabs={["Berjalan", "Selesai", "Semua"]} active={tab} onChange={setTab} />

      <Table head={["Tanggal", "Customer", "Deskripsi", "Channel", "Deadline", "Harga", "Progres", ""]}>
        {rows.length === 0 && <EmptyRow cols={8} />}
        {rows.map((o) => (
          <tr key={o.id} className="align-top hover:bg-alu-bg/40">
            <td className="whitespace-nowrap px-4 py-3">{shortDate(o.date)}</td>
            <td className="px-4 py-3 font-semibold">{o.customer}</td>
            <td className="max-w-72 px-4 py-3 text-alu-muted">
              <div className="line-clamp-2">{o.description}</div>
              {o.expedition && <div className="mt-0.5 text-xs">Ekspedisi: {o.expedition}</div>}
            </td>
            <td className="px-4 py-3"><Badge tone={o.channel === "Offline" ? "gray" : "amber"}>{o.channel}</Badge></td>
            <td className="whitespace-nowrap px-4 py-3">{shortDate(o.deadline)}</td>
            <td className="tnum whitespace-nowrap px-4 py-3 text-right font-semibold">{rupiah(o.price)}</td>
            <td className="px-4 py-3">
              <div className="flex flex-wrap gap-1">
                {ORDER_STEPS.map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => toggleStep(o, key)}
                    title={label}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors ${
                      o[key] ? "bg-green-soft text-green" : "bg-alu-bg text-alu-muted hover:bg-alu-line"
                    }`}
                  >
                    {o[key] ? "✓ " : ""}{label}
                  </button>
                ))}
              </div>
            </td>
            <td className="px-4 py-3"><RowActions onEdit={() => openEdit(o)} onDelete={() => remove("orders", o.id)} /></td>
          </tr>
        ))}
      </Table>

      <Modal open={open} title={editId ? "Ubah Order" : "Order Baru"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal Order"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Deadline"><TextInput type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} /></Field>
          <Field label="Nama Customer"><TextInput value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
          <Field label="Channel">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as OrderChannel })}>
              <option>Shopee</option><option>TikTokShop</option><option>Offline</option>
            </Select>
          </Field>
          <Field label="Deskripsi Order" className="sm:col-span-2">
            <TextArea rows={2} placeholder={'contoh: 3" M D.80 HITAM DOFF : 1,6 x 2Pcs. Rakit + Kaca Riben + Ornament'} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Nominal Harga (Rp)"><TextInput type="number" min={0} value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
          <Field label="Ekspedisi"><TextInput placeholder="Sentral Cargo / JNT Cargo / Lalamove" value={form.expedition} onChange={(e) => setForm({ ...form, expedition: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
