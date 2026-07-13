"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { BendingOrder } from "@/lib/types";
import { rupiah, shortDate, todayISO } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions, StatCard } from "@/components/ui";

const empty = (): Omit<BendingOrder, "id"> => ({ date: todayISO(), invNo: "", amount: 0, status: "BELUM", note: "" });

export default function BendingPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());

  if (!ready) return null;

  const rows = [...db.bending].sort((a, b) => b.date.localeCompare(a.date));
  const debt = rows.filter((b) => b.status === "BELUM").reduce((s, b) => s + b.amount, 0);
  const paidTotal = rows.filter((b) => b.status === "LUNAS").reduce((s, b) => s + b.amount, 0);

  const save = () => {
    if (!form.invNo || !form.amount) { alert("Isi nomor invoice CV Toto dan nominal dulu ya."); return; }
    if (editId) update("bending", editId, form);
    else insert("bending", { id: uid("b"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Bending CV Toto"
        desc="Tagihan jasa bending kusen lengkung dari CV Toto Aluminium Manufacture — pengganti tab BENDING."
        action={<Button onClick={() => { setEditId(null); setForm(empty()); setOpen(true); }}>+ Catat Tagihan</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sisa Tagihan (BELUM)" value={rupiah(debt)} tone="red" />
        <StatCard label="Sudah Dibayar (LUNAS)" value={rupiah(paidTotal)} tone="green" />
        <StatCard label="Jumlah Invoice" value={String(rows.length)} />
      </div>

      <Table head={["Tanggal", "No. Invoice CV Toto", "Nominal", "Status", "Catatan", ""]}>
        {rows.length === 0 && <EmptyRow cols={6} />}
        {rows.map((b) => (
          <tr key={b.id} className="hover:bg-alu-bg/40">
            <td className="whitespace-nowrap px-4 py-2.5">{shortDate(b.date)}</td>
            <td className="px-4 py-2.5 font-semibold">{b.invNo}</td>
            <td className="tnum px-4 py-2.5 text-right font-semibold">{rupiah(b.amount)}</td>
            <td className="px-4 py-2.5">
              <button
                onClick={() => update("bending", b.id, { status: b.status === "LUNAS" ? "BELUM" : "LUNAS" })}
                title="Klik untuk ubah status"
              >
                <Badge tone={b.status === "LUNAS" ? "green" : "red"}>{b.status}</Badge>
              </button>
            </td>
            <td className="px-4 py-2.5 text-alu-muted">{b.note || "-"}</td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => { setEditId(b.id); setForm({ ...b }); setOpen(true); }} onDelete={() => remove("bending", b.id)} /></td>
          </tr>
        ))}
      </Table>

      <Modal open={open} title={editId ? "Ubah Tagihan" : "Catat Tagihan Bending"} onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="No. Invoice CV Toto"><TextInput placeholder="17065" value={form.invNo} onChange={(e) => setForm({ ...form, invNo: e.target.value })} /></Field>
          <Field label="Nominal (Rp)"><TextInput type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as "LUNAS" | "BELUM" })}>
              <option>BELUM</option><option>LUNAS</option>
            </Select>
          </Field>
          <Field label="Catatan" className="sm:col-span-2"><TextInput value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
