"use client";

import { useState } from "react";
import { useDB, uid } from "@/lib/store";
import type { Attendance, SalaryEntry, Cashbon } from "@/lib/types";
import { rupiah, shortDate, todayISO, cashbonPaid, cashbonRemaining } from "@/lib/utils";
import { PageHeader, Button, Table, EmptyRow, Badge, Modal, Field, TextInput, Select, RowActions, Tabs, Card } from "@/components/ui";

export default function KaryawanPage() {
  const { db, ready } = useDB();
  const [tab, setTab] = useState("Absensi");
  if (!ready) return null;

  return (
    <div>
      <PageHeader
        title="Karyawan"
        desc="Absensi harian, rekap gaji mingguan dengan slip gaji, dan cashbon dengan cicilan — pengganti tab ABSENSI, REKAP GAJI, dan CASHBON."
      />
      <Tabs tabs={["Absensi", "Gaji Mingguan", "Cashbon"]} active={tab} onChange={setTab} />
      {tab === "Absensi" && <AbsensiTab />}
      {tab === "Gaji Mingguan" && <GajiTab />}
      {tab === "Cashbon" && <CashbonTab />}
    </div>
  );
}

// ================= ABSENSI =================
function AbsensiTab() {
  const { db, insert, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<Attendance, "id">>({ date: todayISO(), employeeId: "", status: "MASUK", regularHours: 8, overtimeHours: 0 });
  const [month, setMonth] = useState(todayISO().slice(0, 7));

  const rows = db.attendance.filter((a) => a.date.startsWith(month)).sort((a, b) => b.date.localeCompare(a.date));

  const save = () => {
    if (!form.employeeId) { alert("Pilih karyawan dulu ya."); return; }
    insert("attendance", { id: uid("a"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <TextInput type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="max-w-44" />
        <Button onClick={() => { setForm({ date: todayISO(), employeeId: db.employees[0]?.id ?? "", status: "MASUK", regularHours: 8, overtimeHours: 0 }); setOpen(true); }}>+ Catat Absensi</Button>
      </div>

      <Table head={["Tanggal", "Karyawan", "Status", "Jam Kerja", "Lembur", ""]}>
        {rows.length === 0 && <EmptyRow cols={6} />}
        {rows.map((a) => {
          const emp = db.employees.find((e) => e.id === a.employeeId);
          return (
            <tr key={a.id} className="hover:bg-alu-bg/40">
              <td className="whitespace-nowrap px-4 py-2.5">{shortDate(a.date)}</td>
              <td className="px-4 py-2.5 font-medium">{emp?.name ?? "-"}</td>
              <td className="px-4 py-2.5">
                <Badge tone={a.status === "MASUK" ? "green" : a.status === "LIBUR" ? "gray" : "red"}>{a.status}</Badge>
              </td>
              <td className="tnum px-4 py-2.5 text-center">{a.regularHours} jam</td>
              <td className="tnum px-4 py-2.5 text-center">{a.overtimeHours ? `${a.overtimeHours} jam` : "-"}</td>
              <td className="px-4 py-2.5"><RowActions onDelete={() => remove("attendance", a.id)} /></td>
            </tr>
          );
        })}
      </Table>

      <Modal open={open} title="Catat Absensi" onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Karyawan">
            <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              {db.employees.filter((e) => e.active).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Attendance["status"] })}>
              <option>MASUK</option><option>LIBUR</option><option value="TIDAK MASUK">TIDAK MASUK</option>
            </Select>
          </Field>
          <Field label="Jam Kerja"><TextInput type="number" min={0} value={form.regularHours} onChange={(e) => setForm({ ...form, regularHours: Number(e.target.value) })} /></Field>
          <Field label="Jam Lembur"><TextInput type="number" min={0} value={form.overtimeHours} onChange={(e) => setForm({ ...form, overtimeHours: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>
    </div>
  );
}

// ================= GAJI =================
function GajiTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [slip, setSlip] = useState<SalaryEntry | null>(null);
  const [form, setForm] = useState<Omit<SalaryEntry, "id">>({
    employeeId: "", periodStart: todayISO(), periodEnd: todayISO(),
    base: 0, overtime: 0, meal: 0, jht: 0, bpjs: 0, bonDeduction: 0,
  });

  const rows = [...db.salaries].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
  const takeHome = (s: Omit<SalaryEntry, "id">) => s.base + s.overtime + s.meal - s.jht - s.bpjs - s.bonDeduction;

  const openNew = () => {
    const emp = db.employees[0];
    setEditId(null);
    setForm({ employeeId: emp?.id ?? "", periodStart: todayISO(), periodEnd: todayISO(), base: emp?.weeklyBase ?? 0, overtime: 0, meal: 0, jht: 0, bpjs: 0, bonDeduction: 0 });
    setOpen(true);
  };

  const save = () => {
    if (!form.employeeId) { alert("Pilih karyawan dulu ya."); return; }
    if (editId) update("salaries", editId, form);
    else insert("salaries", { id: uid("sal"), ...form });
    setOpen(false);
  };

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={openNew}>+ Catat Gaji</Button>
      </div>

      <Table head={["Periode", "Karyawan", "Gaji Pokok", "Lembur+Makan", "Potongan", "Take Home", ""]}>
        {rows.length === 0 && <EmptyRow cols={7} />}
        {rows.map((s) => {
          const emp = db.employees.find((e) => e.id === s.employeeId);
          return (
            <tr key={s.id} className="hover:bg-alu-bg/40">
              <td className="whitespace-nowrap px-4 py-2.5">{shortDate(s.periodStart)} – {shortDate(s.periodEnd)}</td>
              <td className="px-4 py-2.5 font-medium">
                <button onClick={() => setSlip(s)} className="text-steel hover:underline">{emp?.name ?? "-"}</button>
              </td>
              <td className="tnum px-4 py-2.5 text-right">{rupiah(s.base)}</td>
              <td className="tnum px-4 py-2.5 text-right">{rupiah(s.overtime + s.meal)}</td>
              <td className="tnum px-4 py-2.5 text-right text-red">{rupiah(s.jht + s.bpjs + s.bonDeduction)}</td>
              <td className="tnum px-4 py-2.5 text-right font-bold">{rupiah(takeHome(s))}</td>
              <td className="px-4 py-2.5"><RowActions onEdit={() => { setEditId(s.id); setForm({ ...s }); setOpen(true); }} onDelete={() => remove("salaries", s.id)} /></td>
            </tr>
          );
        })}
      </Table>

      <Modal open={open} title={editId ? "Ubah Gaji" : "Catat Gaji Mingguan"} onClose={() => setOpen(false)} wide>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Karyawan">
            <Select
              value={form.employeeId}
              onChange={(e) => {
                const emp = db.employees.find((x) => x.id === e.target.value);
                setForm({ ...form, employeeId: e.target.value, base: form.base || emp?.weeklyBase || 0 });
              }}
            >
              {db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Periode Mulai"><TextInput type="date" value={form.periodStart} onChange={(e) => setForm({ ...form, periodStart: e.target.value })} /></Field>
          <Field label="Periode Selesai"><TextInput type="date" value={form.periodEnd} onChange={(e) => setForm({ ...form, periodEnd: e.target.value })} /></Field>
          <Field label="Gaji Pokok"><TextInput type="number" min={0} value={form.base || ""} onChange={(e) => setForm({ ...form, base: Number(e.target.value) })} /></Field>
          <Field label="Lembur"><TextInput type="number" min={0} value={form.overtime || ""} onChange={(e) => setForm({ ...form, overtime: Number(e.target.value) })} /></Field>
          <Field label="Uang Makan"><TextInput type="number" min={0} value={form.meal || ""} onChange={(e) => setForm({ ...form, meal: Number(e.target.value) })} /></Field>
          <Field label="Potongan JHT"><TextInput type="number" min={0} value={form.jht || ""} onChange={(e) => setForm({ ...form, jht: Number(e.target.value) })} /></Field>
          <Field label="Potongan BPJS"><TextInput type="number" min={0} value={form.bpjs || ""} onChange={(e) => setForm({ ...form, bpjs: Number(e.target.value) })} /></Field>
          <Field label="Potongan Cicilan Bon"><TextInput type="number" min={0} value={form.bonDeduction || ""} onChange={(e) => setForm({ ...form, bonDeduction: Number(e.target.value) })} /></Field>
        </div>
        <div className="mt-4 flex items-center justify-between rounded-lg bg-steel-soft px-4 py-3">
          <span className="text-sm font-semibold">Take Home Pay</span>
          <span className="tnum text-lg font-bold">{rupiah(takeHome(form))}</span>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>

      {/* Slip gaji */}
      <Modal open={!!slip} title="Slip Gaji" onClose={() => setSlip(null)}>
        {slip && (() => {
          const emp = db.employees.find((e) => e.id === slip.employeeId);
          return (
            <div>
              <Card className="!p-6">
                <div className="mb-1 h-4 w-9 rounded-t-full border-2 border-b-0 border-steel" aria-hidden />
                <div className="text-lg font-bold">ALUCURV</div>
                <div className="text-xs text-alu-muted">R.A Kartini, Bekasi, Jawa Barat</div>
                <div className="mt-3 border-t border-alu-line pt-3 text-sm">
                  <div className="flex justify-between"><span className="text-alu-muted">Nama</span><span className="font-semibold">{emp?.name}</span></div>
                  <div className="flex justify-between"><span className="text-alu-muted">Jabatan</span><span>{emp?.role}</span></div>
                  <div className="flex justify-between"><span className="text-alu-muted">Periode</span><span>{shortDate(slip.periodStart)} – {shortDate(slip.periodEnd)}</span></div>
                </div>
                <div className="mt-3 border-t border-alu-line pt-3 text-sm">
                  <div className="flex justify-between"><span>Gaji Pokok</span><span className="tnum">{rupiah(slip.base)}</span></div>
                  {slip.overtime > 0 && <div className="flex justify-between"><span>Lembur</span><span className="tnum">{rupiah(slip.overtime)}</span></div>}
                  {slip.meal > 0 && <div className="flex justify-between"><span>Uang Makan</span><span className="tnum">{rupiah(slip.meal)}</span></div>}
                  {slip.jht > 0 && <div className="flex justify-between text-red"><span>JHT</span><span className="tnum">− {rupiah(slip.jht)}</span></div>}
                  {slip.bpjs > 0 && <div className="flex justify-between text-red"><span>BPJS</span><span className="tnum">− {rupiah(slip.bpjs)}</span></div>}
                  {slip.bonDeduction > 0 && <div className="flex justify-between text-red"><span>Cicilan Bon</span><span className="tnum">− {rupiah(slip.bonDeduction)}</span></div>}
                  <div className="mt-2 flex justify-between border-t border-alu-ink pt-2 font-bold">
                    <span>Take Home Pay</span>
                    <span className="tnum">{rupiah(slip.base + slip.overtime + slip.meal - slip.jht - slip.bpjs - slip.bonDeduction)}</span>
                  </div>
                </div>
              </Card>
              <div className="no-print mt-4 flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setSlip(null)}>Tutup</Button>
                <Button onClick={() => window.print()}>Cetak Slip</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

// ================= CASHBON =================
function CashbonTab() {
  const { db, insert, update, remove } = useDB();
  const [open, setOpen] = useState(false);
  const [payFor, setPayFor] = useState<Cashbon | null>(null);
  const [payAmount, setPayAmount] = useState(0);
  const [form, setForm] = useState<Omit<Cashbon, "id">>({ date: todayISO(), employeeId: "", amount: 0, installment: 200000, note: "", payments: [] });

  const rows = [...db.cashbons].sort((a, b) => b.date.localeCompare(a.date));

  const save = () => {
    if (!form.employeeId || !form.amount) { alert("Pilih karyawan dan isi nominal bon dulu ya."); return; }
    insert("cashbons", { id: uid("cb"), ...form });
    setOpen(false);
  };

  const addPayment = () => {
    if (!payFor || !payAmount) return;
    update("cashbons", payFor.id, {
      payments: [...payFor.payments, { id: uid("cbp"), date: todayISO(), amount: payAmount }],
    });
    setPayFor(null);
    setPayAmount(0);
  };

  return (
    <div>
      <div className="no-print mb-4 flex justify-end">
        <Button onClick={() => { setForm({ date: todayISO(), employeeId: db.employees[0]?.id ?? "", amount: 0, installment: 200000, note: "", payments: [] }); setOpen(true); }}>+ Catat Cashbon</Button>
      </div>

      <Table head={["Tanggal", "Karyawan", "Jumlah Bon", "Cicilan/Minggu", "Sudah Dibayar", "Sisa", "Status", ""]}>
        {rows.length === 0 && <EmptyRow cols={8} />}
        {rows.map((cb) => {
          const emp = db.employees.find((e) => e.id === cb.employeeId);
          const remaining = cashbonRemaining(cb);
          return (
            <tr key={cb.id} className="hover:bg-alu-bg/40">
              <td className="whitespace-nowrap px-4 py-2.5">{shortDate(cb.date)}</td>
              <td className="px-4 py-2.5 font-medium">
                {emp?.name ?? "-"}
                {cb.note && <div className="text-xs text-alu-muted">{cb.note}</div>}
              </td>
              <td className="tnum px-4 py-2.5 text-right">{rupiah(cb.amount)}</td>
              <td className="tnum px-4 py-2.5 text-right">{rupiah(cb.installment)}</td>
              <td className="tnum px-4 py-2.5 text-right text-green">{rupiah(cashbonPaid(cb))}</td>
              <td className="tnum px-4 py-2.5 text-right font-bold">{rupiah(remaining)}</td>
              <td className="px-4 py-2.5">{remaining === 0 ? <Badge tone="green">LUNAS</Badge> : <Badge tone="amber">CICILAN</Badge>}</td>
              <td className="px-4 py-2.5">
                <div className="flex justify-end gap-1.5 no-print">
                  {remaining > 0 && (
                    <button onClick={() => { setPayFor(cb); setPayAmount(cb.installment); }} className="rounded-md px-2 py-1 text-xs font-semibold text-steel hover:bg-steel-soft">
                      Bayar Cicilan
                    </button>
                  )}
                  <button onClick={() => { if (confirm("Hapus cashbon ini?")) remove("cashbons", cb.id); }} className="rounded-md px-2 py-1 text-xs font-semibold text-red hover:bg-red-soft">Hapus</button>
                </div>
              </td>
            </tr>
          );
        })}
      </Table>

      <Modal open={open} title="Catat Cashbon" onClose={() => setOpen(false)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tanggal"><TextInput type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="Karyawan">
            <Select value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })}>
              {db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </Field>
          <Field label="Jumlah Bon (Rp)"><TextInput type="number" min={0} value={form.amount || ""} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></Field>
          <Field label="Cicilan per Minggu (Rp)"><TextInput type="number" min={0} value={form.installment || ""} onChange={(e) => setForm({ ...form, installment: Number(e.target.value) })} /></Field>
          <Field label="Catatan" className="sm:col-span-2">
            <TextInput placeholder="Dicicil mulai gajian minggu depan" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
          <Button onClick={save}>Simpan</Button>
        </div>
      </Modal>

      <Modal open={!!payFor} title="Bayar Cicilan Bon" onClose={() => setPayFor(null)}>
        <p className="mb-3 text-sm text-alu-muted">
          Sisa bon {db.employees.find((e) => e.id === payFor?.employeeId)?.name}: <strong>{payFor ? rupiah(cashbonRemaining(payFor)) : ""}</strong>
        </p>
        <Field label="Nominal Pembayaran (Rp)">
          <TextInput type="number" min={0} value={payAmount || ""} onChange={(e) => setPayAmount(Number(e.target.value))} />
        </Field>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPayFor(null)}>Batal</Button>
          <Button onClick={addPayment}>Catat Pembayaran</Button>
        </div>
      </Modal>
    </div>
  );
}
