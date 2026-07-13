"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Invoice, InvoiceItem, InvoiceStatus } from "@/lib/types";
import { rupiah, shortDate, todayISO, invoiceTotal, invoiceRemaining, nextDocNumber } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions } from "@/components/ui";

const emptyItem = (): InvoiceItem => ({ id: uid("ii"), description: "", qty: 1, unitPrice: 0 });

export default function InvoicePage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [view, setView] = useState<Invoice | null>(null);
  const [form, setForm] = useState<Omit<Invoice, "id">>(() => ({
    number: "", date: todayISO(), customer: "", items: [emptyItem()], status: "BELUM", payment: "TRANSFER",
  }));

  if (!ready) return null;

  const invoices = [...db.invoices].sort((a, b) => b.number.localeCompare(a.number));

  const openNew = () => {
    setEditId(null);
    setForm({
      number: nextDocNumber(db.invoices.map((i) => i.number), "INV", todayISO()),
      date: todayISO(), customer: "", items: [emptyItem()], status: "BELUM", payment: "TRANSFER",
    });
    setOpen(true);
  };
  const openEdit = (inv: Invoice) => { setEditId(inv.id); setForm({ ...inv, items: inv.items.map((it) => ({ ...it })) }); setOpen(true); };

  const save = () => {
    if (!form.customer || form.items.every((it) => !it.description)) { alert("Isi nama customer dan minimal satu item ya."); return; }
    const clean = { ...form, items: form.items.filter((it) => it.description) };
    if (editId) update("invoices", editId, clean);
    else insert("invoices", { id: uid("inv"), ...clean });
    setOpen(false);
  };

  const setItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setForm((f) => ({ ...f, items: f.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) }));

  const statusTone = (s: InvoiceStatus) => (s === "LUNAS" ? "green" : s === "DP" ? "amber" : "red");

  return (
    <div>
      <PageHeader
        title="Invoice / Nota"
        desc="Penomoran otomatis AL/INV/BB/TTTT/NNN, status pembayaran, dan cetak nota — pengganti tab NOTA & PENCATATAN NOTA."
        action={<Button onClick={openNew}>+ Buat Invoice</Button>}
      />

      <Table head={["No. Invoice", "Tanggal", "Customer", "Total", "Status", "Sisa Bayar", ""]}>
        {invoices.length === 0 && <EmptyRow cols={7} />}
        {invoices.map((inv) => (
          <tr key={inv.id} className="hover:bg-alu-bg/40">
            <td className="whitespace-nowrap px-4 py-2.5">
              <button onClick={() => setView(inv)} className="font-semibold text-steel hover:underline">{inv.number}</button>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5">{shortDate(inv.date)}</td>
            <td className="px-4 py-2.5 font-medium">{inv.customer}</td>
            <td className="tnum whitespace-nowrap px-4 py-2.5 text-right font-semibold">{rupiah(invoiceTotal(inv))}</td>
            <td className="px-4 py-2.5"><Badge tone={statusTone(inv.status)}>{inv.status}</Badge></td>
            <td className="tnum whitespace-nowrap px-4 py-2.5 text-right">{rupiah(invoiceRemaining(inv))}</td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => openEdit(inv)} onDelete={() => remove("invoices", inv.id)} /></td>
          </tr>
        ))}
      </Table>

      {/* Form */}
      <Modal open={open} title={editId ? "Ubah Invoice" : "Invoice Baru"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Nomor"><TextInput value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></Field>
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Customer"><TextInput value={form.customer} onChange={(e) => setForm({ ...form, customer: e.target.value })} /></Field>
        </div>

        <div className="mt-4">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-alu-muted">Item</div>
          {form.items.map((it, i) => (
            <div key={it.id} className="mb-2 grid grid-cols-[1fr_70px_130px_32px] gap-2">
              <TextInput placeholder="Deskripsi" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
              <TextInput type="number" min={1} value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} />
              <TextInput type="number" min={0} placeholder="Harga" value={it.unitPrice || ""} onChange={(e) => setItem(i, { unitPrice: Number(e.target.value) })} />
              <button
                onClick={() => setForm((f) => ({ ...f, items: f.items.filter((_, x) => x !== i) }))}
                className="rounded-md text-red hover:bg-red-soft" aria-label="Hapus item"
              >✕</button>
            </div>
          ))}
          <Button variant="subtle" onClick={() => setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }))}>+ Tambah item</Button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}>
              <option>BELUM</option><option>DP</option><option>LUNAS</option>
            </Select>
          </Field>
          {form.status === "DP" && (
            <Field label="Nominal DP (Rp)">
              <TextInput type="number" min={0} value={form.dpAmount || ""} onChange={(e) => setForm({ ...form, dpAmount: Number(e.target.value) })} />
            </Field>
          )}
          {form.status === "LUNAS" && (
            <Field label="Tanggal Bayar">
              <TextInput type="date" value={form.paidDate ?? todayISO()} onChange={(e) => setForm({ ...form, paidDate: e.target.value })} />
            </Field>
          )}
          <Field label="Payment">
            <Select value={form.payment} onChange={(e) => setForm({ ...form, payment: e.target.value as "TRANSFER" | "CASH" })}>
              <option>TRANSFER</option><option>CASH</option>
            </Select>
          </Field>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-alu-line pt-3">
          <span className="text-sm text-alu-muted">Total</span>
          <span className="tnum text-lg font-bold">{rupiah(form.items.reduce((s, it) => s + it.qty * it.unitPrice, 0))}</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>

      {/* Tampilan nota (bisa dicetak) */}
      <Modal open={!!view} title="Nota" onClose={() => setView(null)} wide>
        {view && (
          <div>
            <div className="rounded-xl border border-alu-line p-6" id="nota">
              <div className="flex items-start justify-between">
                <div>
                  <div className="mb-1 h-4 w-9 rounded-t-full border-2 border-b-0 border-steel" aria-hidden />
                  <div className="text-xl font-bold tracking-tight">ALUCURV</div>
                  <div className="text-xs text-alu-muted">R.A Kartini, Bekasi, Jawa Barat 17158<br />Telp: 0851-7989-3645</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-bold">{view.number}</div>
                  <div className="text-alu-muted">Tanggal: {shortDate(view.date)}</div>
                  <div className="mt-1"><Badge tone={view.status === "LUNAS" ? "green" : view.status === "DP" ? "amber" : "red"}>{view.status}</Badge></div>
                </div>
              </div>
              <div className="mt-4 text-sm"><span className="text-alu-muted">Kepada:</span> <span className="font-semibold">{view.customer}</span></div>
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="border-b border-alu-ink text-left">
                    <th className="py-1.5">Deskripsi</th><th className="py-1.5 text-center">Qty</th>
                    <th className="py-1.5 text-right">Harga</th><th className="py-1.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-alu-line">
                  {view.items.map((it) => (
                    <tr key={it.id}>
                      <td className="py-2">{it.description}</td>
                      <td className="py-2 text-center">{it.qty}</td>
                      <td className="tnum py-2 text-right">{rupiah(it.unitPrice)}</td>
                      <td className="tnum py-2 text-right">{rupiah(it.qty * it.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-3 ml-auto w-56 space-y-1 text-sm">
                <div className="flex justify-between"><span>Total</span><span className="tnum font-bold">{rupiah(invoiceTotal(view))}</span></div>
                {view.dpAmount ? <div className="flex justify-between"><span>DP</span><span className="tnum">{rupiah(view.dpAmount)}</span></div> : null}
                <div className="flex justify-between border-t border-alu-line pt-1 font-bold"><span>Sisa Bayar</span><span className="tnum">{rupiah(invoiceRemaining(view))}</span></div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-alu-muted">
                Cara pembayaran: DP 50% dari total harga, pelunasan ketika barang jadi dan siap kirim/diambil.<br />
                Transfer ke Bank BCA 739-207-9893 a/n Devina Aulia Rahma.
              </p>
            </div>
            <div className="mt-4 flex justify-end gap-2 no-print">
              <Button variant="ghost" onClick={() => setView(null)}>Tutup</Button>
              <Button onClick={() => window.print()}>Cetak Nota</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
