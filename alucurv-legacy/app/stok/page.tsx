"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { StockItem, StockMovement } from "@/lib/types";
import { shortDate, todayISO, stockLevel } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions, Tabs } from "@/components/ui";

export default function StokPage() {
  const { db, ready, insert, update, remove } = useDB();
  const [tab, setTab] = useState("Rekap Stok");

  // form item
  const [itemOpen, setItemOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<Omit<StockItem, "id">>({ code: "", name: "", category: "Produk", minStock: 2, openingStock: 0 });

  // form pergerakan
  const [mvOpen, setMvOpen] = useState(false);
  const [mvForm, setMvForm] = useState<Omit<StockMovement, "id">>({ date: todayISO(), itemId: "", type: "masuk", qty: 1, note: "" });

  if (!ready) return null;

  const saveItem = () => {
    if (!itemForm.name || !itemForm.code) { alert("Isi kode dan nama barang dulu ya."); return; }
    if (editItemId) update("stockItems", editItemId, itemForm);
    else insert("stockItems", { id: uid("s"), ...itemForm });
    setItemOpen(false);
  };

  const saveMv = () => {
    if (!mvForm.itemId || !mvForm.qty) { alert("Pilih barang dan isi jumlah dulu ya."); return; }
    insert("stockMovements", { id: uid("sm"), ...mvForm });
    setMvOpen(false);
  };

  const movements = [...db.stockMovements].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <PageHeader
        title="Stok Barang"
        desc="Rekap stok, barang masuk/keluar, dan status AMAN / BUAT LAGI — pengganti tab REKAP STOK, BARANG MASUK/KELUAR, dan CONSUMABLE."
        action={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => { setEditItemId(null); setItemForm({ code: "", name: "", category: "Produk", minStock: 2, openingStock: 0 }); setItemOpen(true); }}>+ Barang Baru</Button>
            <Button onClick={() => { setMvForm({ date: todayISO(), itemId: db.stockItems[0]?.id ?? "", type: "masuk", qty: 1, note: "" }); setMvOpen(true); }}>+ Catat Masuk/Keluar</Button>
          </div>
        }
      />

      <Tabs tabs={["Rekap Stok", "Riwayat Masuk/Keluar"]} active={tab} onChange={setTab} />

      {tab === "Rekap Stok" && (
        <Table head={["Kode", "Nama Barang", "Kategori", "Stok Awal", "Masuk", "Keluar", "Stok Akhir", "Status", ""]}>
          {db.stockItems.length === 0 && <EmptyRow cols={9} />}
          {db.stockItems.map((it) => {
            const masuk = db.stockMovements.filter((m) => m.itemId === it.id && m.type === "masuk").reduce((s, m) => s + m.qty, 0);
            const keluar = db.stockMovements.filter((m) => m.itemId === it.id && m.type === "keluar").reduce((s, m) => s + m.qty, 0);
            const level = stockLevel(db, it.id);
            return (
              <tr key={it.id} className="hover:bg-alu-bg/40">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{it.code}</td>
                <td className="px-4 py-2.5 font-medium">{it.name}</td>
                <td className="px-4 py-2.5"><Badge tone={it.category === "Produk" ? "steel" : "gray"}>{it.category}</Badge></td>
                <td className="tnum px-4 py-2.5 text-center">{it.openingStock}</td>
                <td className="tnum px-4 py-2.5 text-center text-green">{masuk}</td>
                <td className="tnum px-4 py-2.5 text-center text-red">{keluar}</td>
                <td className="tnum px-4 py-2.5 text-center font-bold">{level}</td>
                <td className="px-4 py-2.5">
                  {level <= it.minStock ? <Badge tone="red">BUAT LAGI</Badge> : <Badge tone="green">AMAN</Badge>}
                </td>
                <td className="px-4 py-2.5">
                  <RowActions
                    onEdit={() => { setEditItemId(it.id); setItemForm({ ...it }); setItemOpen(true); }}
                    onDelete={() => remove("stockItems", it.id)}
                  />
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {tab === "Riwayat Masuk/Keluar" && (
        <Table head={["Tanggal", "Barang", "Jenis", "Jumlah", "Keterangan", ""]}>
          {movements.length === 0 && <EmptyRow cols={6} />}
          {movements.map((m) => {
            const it = db.stockItems.find((s) => s.id === m.itemId);
            return (
              <tr key={m.id} className="hover:bg-alu-bg/40">
                <td className="whitespace-nowrap px-4 py-2.5">{shortDate(m.date)}</td>
                <td className="px-4 py-2.5 font-medium">{it?.name ?? "-"}</td>
                <td className="px-4 py-2.5"><Badge tone={m.type === "masuk" ? "green" : "red"}>{m.type === "masuk" ? "Masuk" : "Keluar"}</Badge></td>
                <td className="tnum px-4 py-2.5 text-center">{m.qty}</td>
                <td className="px-4 py-2.5 text-alu-muted">{m.note || "-"}</td>
                <td className="px-4 py-2.5"><RowActions onDelete={() => remove("stockMovements", m.id)} /></td>
              </tr>
            );
          })}
        </Table>
      )}

      <Modal open={itemOpen} title={editItemId ? "Ubah Barang" : "Barang Baru"} onClose={() => setItemOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Kode"><TextInput placeholder="A-001" value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} /></Field>
          <Field label="Kategori">
            <Select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value as "Produk" | "Consumable" })}>
              <option>Produk</option><option>Consumable</option>
            </Select>
          </Field>
          <Field label="Nama Barang" className="sm:col-span-2">
            <TextInput placeholder="ORNAMEN HITAM DOFF D. 45" value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} />
          </Field>
          <Field label="Stok Awal"><TextInput type="number" min={0} value={itemForm.openingStock} onChange={(e) => setItemForm({ ...itemForm, openingStock: Number(e.target.value) })} /></Field>
          <Field label="Batas Minimum (BUAT LAGI)"><TextInput type="number" min={0} value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setItemOpen(false)}>Batal</Button>
          <Button onClick={saveItem}>Simpan</Button>
        </div>
      </Modal>

      <Modal open={mvOpen} title="Catat Barang Masuk / Keluar" onClose={() => setMvOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={mvForm.date} onChange={(e) => setMvForm({ ...mvForm, date: e.target.value })} /></Field>
          <Field label="Jenis">
            <Select value={mvForm.type} onChange={(e) => setMvForm({ ...mvForm, type: e.target.value as "masuk" | "keluar" })}>
              <option value="masuk">Barang Masuk</option>
              <option value="keluar">Barang Keluar</option>
            </Select>
          </Field>
          <Field label="Barang" className="sm:col-span-2">
            <Select value={mvForm.itemId} onChange={(e) => setMvForm({ ...mvForm, itemId: e.target.value })}>
              {db.stockItems.map((s) => <option key={s.id} value={s.id}>{s.code} — {s.name}</option>)}
            </Select>
          </Field>
          <Field label="Jumlah"><TextInput type="number" min={1} value={mvForm.qty} onChange={(e) => setMvForm({ ...mvForm, qty: Number(e.target.value) })} /></Field>
          <Field label="Keterangan"><TextInput placeholder="Order ZEVALU / Bending dari CV Toto" value={mvForm.note} onChange={(e) => setMvForm({ ...mvForm, note: e.target.value })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setMvOpen(false)}>Batal</Button>
          <Button onClick={saveMv}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}
