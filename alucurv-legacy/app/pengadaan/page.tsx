"use client";

import { useMemo, useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Purchase } from "@/lib/types";
import { rupiah, shortDate, todayISO } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Modal, Field, TextInput, Select, RowActions, StatCard } from "@/components/ui";

const empty = (): Omit<Purchase, "id"> => ({
  date: todayISO(), supplierId: "", itemCode: "", itemName: "", size: "",
  unitPrice: 0, qty: 1, qtyLabel: "", total: 0, accountId: "",
});

export default function PengadaanPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [supplierFilter, setSupplierFilter] = useState("all");

  const rows = useMemo(
    () =>
      db.purchases
        .filter((p) => p.date.startsWith(month) && (supplierFilter === "all" || p.supplierId === supplierFilter))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.purchases, month, supplierFilter]
  );

  if (!ready) return null;

  const total = rows.reduce((s, p) => s + p.total, 0);

  const openNew = () => { setEditId(null); setForm({ ...empty(), supplierId: db.suppliers[0]?.id ?? "", accountId: db.accounts[0]?.id ?? "" }); setOpen(true); };
  const openEdit = (p: Purchase) => { setEditId(p.id); setForm({ ...p }); setOpen(true); };

  const save = () => {
    if (!form.itemName || !form.supplierId) { alert("Isi nama barang dan pemasok dulu ya."); return; }
    const total = form.total || form.unitPrice * form.qty;
    if (editId) update("purchases", editId, { ...form, total });
    else insert("purchases", { id: uid("p"), ...form, total });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Pengadaan Bahan Baku"
        desc="Pembelian bahan dari pemasok (kaca, profil aluminium, triplek, palet, dll.) — pengganti tab PENGADAAN BAHAN BAKU."
        action={<Button onClick={openNew}>+ Catat Pembelian</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total Pembelian (filter)" value={rupiah(total)} tone="red" />
        <StatCard label="Jumlah Transaksi" value={String(rows.length)} />
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-3">
        <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-44" />
        <Select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="max-w-60">
          <option value="all">Semua pemasok</option>
          {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </Select>
      </div>

      <Table head={["Tanggal", "Pemasok", "Barang", "Ukuran", "Harga Satuan", "Jumlah", "Total", "Rekening", ""]}>
        {rows.length === 0 && <EmptyRow cols={9} />}
        {rows.map((p) => {
          const sup = db.suppliers.find((s) => s.id === p.supplierId);
          const acc = db.accounts.find((a) => a.id === p.accountId);
          return (
            <tr key={p.id} className="hover:bg-alu-bg/40">
              <td className="whitespace-nowrap px-4 py-2.5">{shortDate(p.date)}</td>
              <td className="px-4 py-2.5 font-medium">{sup?.name ?? "-"}</td>
              <td className="px-4 py-2.5">
                {p.itemName}
                {p.itemCode && <div className="text-xs text-alu-muted">{p.itemCode}</div>}
              </td>
              <td className="px-4 py-2.5 text-alu-muted">{p.size || "-"}</td>
              <td className="tnum px-4 py-2.5 text-right">{rupiah(p.unitPrice)}</td>
              <td className="px-4 py-2.5 text-center">{p.qtyLabel || p.qty}</td>
              <td className="tnum px-4 py-2.5 text-right font-semibold">{rupiah(p.total)}</td>
              <td className="px-4 py-2.5 text-alu-muted">{acc?.name ?? "-"}</td>
              <td className="px-4 py-2.5"><RowActions onEdit={() => openEdit(p)} onDelete={() => remove("purchases", p.id)} /></td>
            </tr>
          );
        })}
      </Table>

      <Modal open={open} title={editId ? "Ubah Pembelian" : "Catat Pembelian"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Pemasok">
            <Select value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}>
              {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Kode Barang"><TextInput placeholder="ORN/BK/INK" value={form.itemCode} onChange={(e) => setForm({ ...form, itemCode: e.target.value })} /></Field>
          <Field label="Nama Barang"><TextInput placeholder="KACA RIBEN 5MM" value={form.itemName} onChange={(e) => setForm({ ...form, itemName: e.target.value })} /></Field>
          <Field label="Ukuran"><TextInput placeholder="102 x 203 cm / 6M" value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })} /></Field>
          <Field label="Rekening Pembayar">
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Harga Satuan (Rp)"><TextInput type="number" min={0} value={form.unitPrice || ""} onChange={(e) => setForm({ ...form, unitPrice: Number(e.target.value) })} /></Field>
          <Field label="Jumlah"><TextInput type="number" min={0} value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
          <Field label="Label Jumlah (opsional)"><TextInput placeholder="2 DUS / 3 KG" value={form.qtyLabel} onChange={(e) => setForm({ ...form, qtyLabel: e.target.value })} /></Field>
          <Field label="Total (kosongkan = harga × jumlah)">
            <TextInput type="number" min={0} value={form.total || ""} onChange={(e) => setForm({ ...form, total: Number(e.target.value) })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
