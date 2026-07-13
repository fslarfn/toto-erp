"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { DeliveryNote, DeliveryNoteItem } from "@/lib/types";
import { shortDate, todayISO, nextDocNumber } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Modal, Field, TextInput, RowActions } from "@/components/ui";

const emptyItem = (): DeliveryNoteItem => ({ id: uid("sji"), description: "", qty: 1 });

export default function SuratJalanPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<DeliveryNote, "id">>({ number: "", date: todayISO(), customer: "", items: [emptyItem()] });

  if (!ready) return null;

  const rows = [...db.deliveryNotes].sort((a, b) => b.number.localeCompare(a.number));

  const openNew = () => {
    setEditId(null);
    setForm({ number: nextDocNumber(db.deliveryNotes.map((s) => s.number), "SJ", todayISO()), date: todayISO(), customer: "", items: [emptyItem()] });
    setOpen(true);
  };
  const openEdit = (sj: DeliveryNote) => { setEditId(sj.id); setForm({ ...sj, items: sj.items.map((it) => ({ ...it })) }); setOpen(true); };

  const save = () => {
    if (!form.customer || form.items.every((it) => !it.description)) { alert("Isi customer dan minimal satu barang ya."); return; }
    const clean = { ...form, items: form.items.filter((it) => it.description) };
    if (editId) update("deliveryNotes", editId, clean);
    else insert("deliveryNotes", { id: uid("sj"), ...clean });
    setOpen(false);
  };

  const setItem = (idx: number, patch: Partial<DeliveryNoteItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  return (
    <div>
      <PageHeader
        title="Surat Jalan"
        desc="Pencatatan nomor surat jalan AL/SJ/BB/TTTT/NNN untuk pengiriman barang."
        action={<Button onClick={openNew}>+ Surat Jalan Baru</Button>}
      />

      <Table head={["No. Surat Jalan", "Tanggal", "Customer", "Barang", ""]}>
        {rows.length === 0 && <EmptyRow cols={5} />}
        {rows.map((sj) => (
          <tr key={sj.id} className="align-top hover:bg-alu-bg/40">
            <td className="whitespace-nowrap px-4 py-2.5 font-semibold text-steel">{sj.number}</td>
            <td className="whitespace-nowrap px-4 py-2.5">{shortDate(sj.date)}</td>
            <td className="px-4 py-2.5 font-medium">{sj.customer}</td>
            <td className="px-4 py-2.5 text-alu-muted">
              {sj.items.map((it) => (
                <div key={it.id}>• {it.description} <span className="text-xs">({it.qty} pcs)</span></div>
              ))}
            </td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => openEdit(sj)} onDelete={() => remove("deliveryNotes", sj.id)} /></td>
          </tr>
        ))}
      </Table>

      <Modal open={open} title={editId ? "Ubah Surat Jalan" : "Surat Jalan Baru"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nomor"><TextInput value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Customer"><TextInput value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
        </div>
        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-alu-muted">Barang</div>
          {form.items.map((it, i) => (
            <div key={it.id} className="mb-2 grid grid-cols-[1fr_80px_32px] gap-2">
              <TextInput placeholder="Deskripsi barang" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              <TextInput type="number" min={1} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
              <button onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, x) => x !== i) }))} className="rounded-md text-red hover:bg-red-soft" aria-label="Hapus">✕</button>
            </div>
          ))}
          <Button variant="subtle" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))}>+ Tambah barang</Button>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
