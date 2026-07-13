"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Account, SubCategory, Supplier, Employee } from "@/lib/types";
import { rupiah } from "@/lib/utils";
import { PageHeader, Button, Card, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions, Tabs } from "@/components/ui";

export default function PengaturanPage() {
  const { ready } = useDB();
  const [tab, setTab] = useState("Akun");
  if (!ready) return null;

  return (
    <div>
      <PageHeader
        title="Master & Pengaturan"
        desc="Kelola data master: akun kas/bank, kategori transaksi, pemasok, dan karyawan. Perubahan di sini otomatis terpakai di semua modul."
      />
      <Tabs tabs={["Akun", "Kategori", "Pemasok", "Karyawan", "Data Demo"]} active={tab} onChange={setTab} />
      {tab === "Akun" && <AkunTab />}
      {tab === "Kategori" && <KategoriTab />}
      {tab === "Pemasok" && <PemasokTab />}
      {tab === "Karyawan" && <KaryawanTab />}
      {tab === "Data Demo" && <DemoTab />}
    </div>
  );
}

// ---------- Akun ----------
function AkunTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Account, "id">>({ name: "", type: "bank", openingBalance: 0 });

  const save = () => {
    if (!form.name) { alert("Isi nama akun dulu ya."); return; }
    if (editId) update("accounts", editId, form);
    else insert("accounts", { id: uid("acc"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => { setEditId(null); setForm({ name: "", type: "bank", openingBalance: 0 }); setOpen(true); }}>+ Tambah Akun</Button>
      </div>
      <Table head={["Nama Akun", "Tipe", "Saldo Awal", ""]}>
        {db.accounts.length === 0 && <EmptyRow cols={4} />}
        {db.accounts.map((a) => (
          <tr key={a.id} className="hover:bg-alu-bg/40">
            <td className="px-4 py-2.5 font-medium">{a.name}</td>
            <td className="px-4 py-2.5">
              <Badge tone={a.type === "marketplace" ? "amber" : a.type === "cash" ? "gray" : "steel"}>
                {a.type === "marketplace" ? "Marketplace" : a.type === "cash" ? "Kas" : "Bank"}
              </Badge>
            </td>
            <td className="tnum px-4 py-2.5 text-right">{rupiah(a.openingBalance)}</td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => { setEditId(a.id); setForm({ ...a }); setOpen(true); }} onDelete={() => remove("accounts", a.id)} /></td>
          </tr>
        ))}
      </Table>
      <Modal open={open} title={editId ? "Ubah Akun" : "Tambah Akun"} onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama Akun" className="sm:col-span-2"><TextInput placeholder="BCA Iva. Alucurv" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Tipe">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Account["type"] })}>
              <option value="cash">Kas</option><option value="bank">Bank</option><option value="marketplace">Marketplace</option>
            </Select>
          </Field>
          <Field label="Saldo Awal (Rp)"><TextInput type="number" value={form.openingBalance || ""} onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Kategori ----------
function KategoriTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<SubCategory, "id">>({ type: "Pengeluaran", name: "" });

  const save = () => {
    if (!form.name) { alert("Isi nama kategori dulu ya."); return; }
    if (editId) update("subCategories", editId, form);
    else insert("subCategories", { id: uid("sc"), ...form });
    setOpen(false);
  };

  const income = db.subCategories.filter((s) => s.type === "Pemasukan");
  const expense = db.subCategories.filter((s) => s.type === "Pengeluaran");

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => { setEditId(null); setForm({ type: "Pengeluaran", name: "" }); setOpen(true); }}>+ Tambah Kategori</Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold text-green">Pemasukan</h3>
          <ul className="space-y-1.5">
            {income.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-alu-line pb-1.5 text-sm last:border-0">
                {s.name}
                <RowActions onEdit={() => { setEditId(s.id); setForm({ ...s }); setOpen(true); }} onDelete={() => remove("subCategories", s.id)} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <h3 className="mb-3 font-bold text-red">Pengeluaran</h3>
          <ul className="space-y-1.5">
            {expense.map((s) => (
              <li key={s.id} className="flex items-center justify-between border-b border-alu-line pb-1.5 text-sm last:border-0">
                {s.name}
                <RowActions onEdit={() => { setEditId(s.id); setForm({ ...s }); setOpen(true); }} onDelete={() => remove("subCategories", s.id)} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <Modal open={open} title={editId ? "Ubah Kategori" : "Tambah Kategori"} onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Jenis">
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as SubCategory["type"] })}>
              <option>Pemasukan</option><option>Pengeluaran</option>
            </Select>
          </Field>
          <Field label="Nama Kategori"><TextInput placeholder="Operasional Umum" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Pemasok ----------
function PemasokTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const save = () => {
    if (!name) { alert("Isi nama pemasok dulu ya."); return; }
    if (editId) update("suppliers", editId, { name });
    else insert("suppliers", { id: uid("sup"), name });
    setOpen(false);
  };

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => { setEditId(null); setName(""); setOpen(true); }}>+ Tambah Pemasok</Button>
      </div>
      <Table head={["Nama Pemasok", ""]}>
        {db.suppliers.length === 0 && <EmptyRow cols={2} />}
        {db.suppliers.map((s) => (
          <tr key={s.id} className="hover:bg-alu-bg/40">
            <td className="px-4 py-2.5 font-medium">{s.name}</td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => { setEditId(s.id); setName(s.name); setOpen(true); }} onDelete={() => remove("suppliers", s.id)} /></td>
          </tr>
        ))}
      </Table>
      <Modal open={open} title={editId ? "Ubah Pemasok" : "Tambah Pemasok"} onClose={() => setOpen(false)}>
        <Field label="Nama Pemasok"><TextInput placeholder="PT. LINTANG" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Karyawan ----------
function KaryawanTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Employee, "id">>({ name: "", role: "", division: "Produksi", weeklyBase: 0, active: true });

  const save = () => {
    if (!form.name) { alert("Isi nama karyawan dulu ya."); return; }
    if (editId) update("employees", editId, form);
    else insert("employees", { id: uid("emp"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => { setEditId(null); setForm({ name: "", role: "", division: "Produksi", weeklyBase: 0, active: true }); setOpen(true); }}>+ Tambah Karyawan</Button>
      </div>
      <Table head={["Nama", "Jabatan", "Divisi", "Gaji Mingguan", "Status", ""]}>
        {db.employees.length === 0 && <EmptyRow cols={6} />}
        {db.employees.map((e) => (
          <tr key={e.id} className="hover:bg-alu-bg/40">
            <td className="px-4 py-2.5 font-medium">{e.name}</td>
            <td className="px-4 py-2.5 text-alu-muted">{e.role}</td>
            <td className="px-4 py-2.5"><Badge tone="steel">{e.division}</Badge></td>
            <td className="tnum px-4 py-2.5 text-right">{rupiah(e.weeklyBase)}</td>
            <td className="px-4 py-2.5">{e.active ? <Badge tone="green">Aktif</Badge> : <Badge tone="gray">Nonaktif</Badge>}</td>
            <td className="px-4 py-2.5"><RowActions onEdit={() => { setEditId(e.id); setForm({ ...e }); setOpen(true); }} onDelete={() => remove("employees", e.id)} /></td>
          </tr>
        ))}
      </Table>
      <Modal open={open} title={editId ? "Ubah Karyawan" : "Tambah Karyawan"} onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nama"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Jabatan"><TextInput placeholder="Tim Produksi" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></Field>
          <Field label="Divisi">
            <Select value={form.division} onChange={(e) => setForm({ ...form, division: e.target.value as Employee["division"] })}>
              <option>Produksi</option><option>Admin</option><option>Marketing</option>
            </Select>
          </Field>
          <Field label="Gaji Mingguan (acuan)"><TextInput type="number" min={0} value={form.weeklyBase || ""} onChange={(e) => setForm({ ...form, weeklyBase: Number(e.target.value) })} /></Field>
          <Field label="Status" className="sm:col-span-2">
            <Select value={form.active ? "aktif" : "nonaktif"} onChange={(e) => setForm({ ...form, active: e.target.value === "aktif" })}>
              <option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option>
            </Select>
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

// ---------- Data Demo ----------
function DemoTab() {
  const { resetToSeed } = useDB();
  return (
    <Card className="max-w-xl">
      <h3 className="mb-2 font-bold">Reset Data Demo</h3>
      <p className="mb-4 text-sm leading-relaxed text-alu-muted">
        Aplikasi ini menyimpan data di browser (localStorage). Kalau kamu ingin mengembalikan
        semua data ke contoh awal — misalnya setelah bereksperimen — klik tombol di bawah.
        Semua perubahan yang kamu buat akan dihapus dan tidak bisa dikembalikan.
      </p>
      <Button
        variant="danger"
        onClick={() => { if (confirm("Yakin reset semua data ke contoh awal? Perubahan kamu akan hilang.")) resetToSeed(); }}
      >
        Reset ke Data Contoh
      </Button>
    </Card>
  );
}
