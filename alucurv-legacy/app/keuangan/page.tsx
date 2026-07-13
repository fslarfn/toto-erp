"use client";

import { useMemo, useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Transaction, CategoryType } from "@/lib/types";
import { rupiah, shortDate, todayISO, accountBalance } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions, StatCard } from "@/components/ui";

const empty = (): Omit<Transaction, "id"> => ({
  date: todayISO(),
  description: "",
  type: "Pengeluaran",
  subCategoryId: "",
  amount: 0,
  accountId: "",
});

export default function KeuanganPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(empty());
  const [filterAcc, setFilterAcc] = useState("all");
  const [filterMonth, setFilterMonth] = useState(todayISO().slice(0, 7));

  const rows = useMemo(
    () =>
      db.transactions
        .filter((t) => (filterAcc === "all" || t.accountId === filterAcc) && t.date.startsWith(filterMonth))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [db.transactions, filterAcc, filterMonth]
  );

  if (!ready) return null;

  const subCats = db.subCategories.filter((s) => s.type === form.type);
  const totalIn = rows.filter((t) => t.type === "Pemasukan").reduce((s, t) => s + t.amount, 0);
  const totalOut = rows.filter((t) => t.type === "Pengeluaran").reduce((s, t) => s + t.amount, 0);

  const openNew = () => { setEditId(null); setForm({ ...empty(), accountId: db.accounts[0]?.id ?? "" }); setOpen(true); };
  const openEdit = (t: Transaction) => { setEditId(t.id); setForm({ ...t }); setOpen(true); };

  const save = () => {
    if (!form.description || !form.amount || !form.accountId || !form.subCategoryId) {
      alert("Lengkapi deskripsi, nominal, akun, dan sub kategori dulu ya.");
      return;
    }
    if (editId) update("transactions", editId, form);
    else insert("transactions", { id: uid("t"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <PageHeader
        title="Transaksi Kas"
        desc="Pencatatan uang masuk & keluar per akun — pengganti tab LAP PENGELUARAN (Cash / BCA / Jago)."
        action={<Button onClick={openNew}>+ Catat Transaksi</Button>}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pemasukan (filter)" value={rupiah(totalIn)} tone="green" />
        <StatCard label="Pengeluaran (filter)" value={rupiah(totalOut)} tone="red" />
        <StatCard label="Selisih" value={rupiah(totalIn - totalOut)} tone={totalIn - totalOut >= 0 ? "green" : "red"} />
        <StatCard
          label="Saldo Akun Terpilih"
          value={filterAcc === "all" ? "—" : rupiah(accountBalance(db, filterAcc))}
          sub={filterAcc === "all" ? "Pilih satu akun" : db.accounts.find((a) => a.id === filterAcc)?.name}
        />
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-3">
        <Select value={filterAcc} onChange={(e) => setFilterAcc(e.target.value)} className="max-w-60">
          <option value="all">Semua akun</option>
          {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </Select>
        <TextInput type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="max-w-44" />
      </div>

      <Table head={["Tanggal", "Deskripsi", "Kategori", "Akun", "Nominal", ""]}>
        {rows.length === 0 && <EmptyRow cols={6} />}
        {rows.map((t) => {
          const sc = db.subCategories.find((s) => s.id === t.subCategoryId);
          const acc = db.accounts.find((a) => a.id === t.accountId);
          return (
            <tr key={t.id} className="hover:bg-alu-bg/40">
              <td className="whitespace-nowrap px-4 py-2.5">{shortDate(t.date)}</td>
              <td className="px-4 py-2.5 font-medium">{t.description}</td>
              <td className="px-4 py-2.5">
                <Badge tone={t.type === "Pemasukan" ? "green" : "red"}>{sc?.name ?? "-"}</Badge>
              </td>
              <td className="px-4 py-2.5 text-alu-muted">{acc?.name ?? "-"}</td>
              <td className={`tnum whitespace-nowrap px-4 py-2.5 text-right font-semibold ${t.type === "Pemasukan" ? "text-green" : "text-red"}`}>
                {t.type === "Pemasukan" ? "+" : "−"} {rupiah(t.amount)}
              </td>
              <td className="px-4 py-2.5"><RowActions onEdit={() => openEdit(t)} onDelete={() => remove("transactions", t.id)} /></td>
            </tr>
          );
        })}
      </Table>

      <Modal open={open} title={editId ? "Ubah Transaksi" : "Catat Transaksi"} onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Jenis">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CategoryType, subCategoryId: "" })}>
              <option>Pemasukan</option>
              <option>Pengeluaran</option>
            </Select>
          </Field>
          <Field label="Deskripsi" className="sm:col-span-2">
            <TextInput placeholder="contoh: PENCAIRAN SALDO SHOPEE" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Sub Kategori">
            <Select value={form.subCategoryId} onChange={(e) => setForm({ ...form, subCategoryId: e.target.value })}>
              <option value="">— pilih —</option>
              {subCats.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </Field>
          <Field label="Akun / Payment">
            <Select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })}>
              <option value="">— pilih —</option>
              {db.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
          <Field label="Nominal (Rp)" className="sm:col-span-2">
            <TextInput type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
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
