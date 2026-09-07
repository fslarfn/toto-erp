"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Circle,
  Clock3,
  FileCheck2,
  Landmark,
  Save,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  AccountingPolicyRow,
  AccountingWorkItemRow,
  isMissingTaxSchema,
  loadAccountingAdminWorkspace,
  saveAccountingPolicy,
  saveAccountingWorkItem,
} from "@/lib/pajak/store";

type WorkView = "akuntansi" | "transaksi" | "panduan" | "laporan";
type Frequency = AccountingWorkItemRow["frequency"];
type TaskTemplate = {
  key: string;
  frequency: Frequency;
  category: string;
  title: string;
  detail: string;
  owner: "Admin akuntansi" | "Konsultan pajak" | "Bersama";
  priority: AccountingWorkItemRow["priority"];
};

const colors = {
  ink: "#3C2F2F",
  med: "#7C685B",
  line: "#E6D5BE",
  paper: "#FFFBF7",
  accent: "#A67B5B",
  soft: "#F6EEE6",
  green: "#15803D",
  amber: "#9A6700",
  red: "#B91C1C",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  border: `1px solid ${colors.line}`,
  borderRadius: 7,
  padding: "8px 10px",
  fontSize: 11,
  color: colors.ink,
  background: "white",
  outline: "none",
};

const tasks: TaskTemplate[] = [
  { key: "source_documents", frequency: "daily", category: "Dokumen", title: "Periksa bukti transaksi hari ini", detail: "Pastikan nota, invoice, bukti transfer, nama pihak, tanggal, dan nominal tersedia.", owner: "Admin akuntansi", priority: "high" },
  { key: "transaction_classification", frequency: "daily", category: "Pembukuan", title: "Periksa kategori uang masuk dan keluar", detail: "Pisahkan penjualan, DP, pelunasan, biaya, aset, utang, pajak, prive, dan transfer antar rekening.", owner: "Admin akuntansi", priority: "high" },
  { key: "customer_receipts", frequency: "daily", category: "Piutang", title: "Cocokkan penerimaan dengan invoice", detail: "Hubungkan pembayaran customer ke invoice agar omzet dan penerimaan kas tidak dihitung dua kali.", owner: "Admin akuntansi", priority: "normal" },
  { key: "supplier_documents", frequency: "daily", category: "Utang", title: "Cocokkan pembayaran supplier", detail: "Pastikan pembayaran supplier memiliki tagihan, nomor dokumen, dan tujuan pembayaran yang jelas.", owner: "Admin akuntansi", priority: "normal" },
  { key: "bank_cash_reconciliation", frequency: "weekly", category: "Kas dan bank", title: "Rekonsiliasi kas dan bank", detail: "Bandingkan saldo ERP dengan mutasi rekening dan kas fisik. Catat setiap selisih untuk ditindaklanjuti.", owner: "Admin akuntansi", priority: "high" },
  { key: "receivable_payable_review", frequency: "weekly", category: "Utang piutang", title: "Tinjau umur piutang dan utang", detail: "Tandai piutang jatuh tempo, pembayaran belum terhubung, dan tagihan supplier yang harus dibayar.", owner: "Admin akuntansi", priority: "normal" },
  { key: "inventory_hpp_review", frequency: "weekly", category: "Persediaan", title: "Tinjau stok dan HPP", detail: "Periksa stok negatif, harga bahan terbaru, barang terkirim, dan HPP yang masih perlu mapping.", owner: "Admin akuntansi", priority: "normal" },
  { key: "finance_journal_sync", frequency: "monthly", category: "Jurnal", title: "Selesaikan sinkronisasi jurnal", detail: "Semua transaksi Keuangan periode ini harus masuk jurnal dan tidak boleh ada kategori yang belum dikenali.", owner: "Admin akuntansi", priority: "high" },
  { key: "payroll_close", frequency: "monthly", category: "Payroll", title: "Catat payroll, BPJS, dan kewajiban terkait", detail: "Periksa gaji, lembur, tunjangan, BPJS, PPh 21, serta pembayaran yang masih terutang.", owner: "Admin akuntansi", priority: "high" },
  { key: "inventory_close", frequency: "monthly", category: "Persediaan", title: "Tutup persediaan dan HPP", detail: "Cocokkan stok akhir, pembelian bahan, pemakaian, dan HPP barang yang telah dikirim.", owner: "Admin akuntansi", priority: "high" },
  { key: "accruals_depreciation", frequency: "monthly", category: "Penyesuaian", title: "Siapkan akrual dan penyusutan", detail: "Identifikasi biaya yang belum ditagih, biaya dibayar di muka, aset baru, dan penyusutan periode berjalan.", owner: "Admin akuntansi", priority: "normal" },
  { key: "trial_balance_review", frequency: "monthly", category: "Review", title: "Periksa neraca saldo", detail: "Pastikan total debit sama dengan kredit dan saldo akun yang tidak wajar sudah diberi penjelasan.", owner: "Admin akuntansi", priority: "high" },
  { key: "tax_reconciliation", frequency: "monthly", category: "Pajak", title: "Rekonsiliasi data pajak", detail: "Cocokkan omzet, DPP, PPN, PPh, payroll, dan dokumen pajak dengan pembukuan.", owner: "Konsultan pajak", priority: "high" },
  { key: "financial_statements", frequency: "monthly", category: "Laporan", title: "Siapkan laporan keuangan", detail: "Tinjau laporan laba rugi, posisi keuangan, arus kas, perubahan ekuitas, dan catatan penting.", owner: "Admin akuntansi", priority: "high" },
  { key: "consultant_review", frequency: "monthly", category: "Persetujuan", title: "Minta review konsultan dan owner", detail: "Dokumentasikan koreksi, persetujuan, bukti bayar, bukti lapor, lalu kunci periode setelah disetujui.", owner: "Bersama", priority: "high" },
];

const defaultPolicy: AccountingPolicyRow = {
  workspace: "toto",
  reporting_standard: "SAK_EP",
  accounting_basis: "accrual",
  functional_currency: "IDR",
  fiscal_year_start_month: 1,
  inventory_method: "",
  depreciation_method: "",
  consultant_approved: false,
  notes: "",
  updated_by: "",
};

const frequencyLabels: Record<Frequency, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Tutup bulan" };
const statusLabels: Record<AccountingWorkItemRow["status"], string> = { todo: "Belum dikerjakan", in_progress: "Sedang dikerjakan", waiting_review: "Menunggu review", done: "Selesai" };

function localItemsKey(period: string) { return `toto-accounting-work-${period}-v1`; }
const localPolicyKey = "toto-accounting-policy-v1";

function buildItem(task: TaskTemplate, period: string, username: string, current?: AccountingWorkItemRow): AccountingWorkItemRow {
  return current ?? {
    workspace: "toto",
    work_period: period,
    task_key: task.key,
    frequency: task.frequency,
    category: task.category,
    title: task.title,
    status: "todo",
    priority: task.priority,
    assigned_to: task.owner === "Konsultan pajak" ? "Konsultan pajak" : username,
    due_date: null,
    document_reference: "",
    notes: "",
    completed_by: "",
    completed_at: null,
    reviewed_by: "",
    reviewed_at: null,
    updated_by: username,
  };
}

export default function AccountingAdminWorkspace({ year, month, onOpen }: { year: number; month: number; onOpen: (view: WorkView) => void }) {
  const { user } = useAuth();
  const username = user?.username ?? "admin finance";
  const period = `${year}-${String(month).padStart(2, "0")}`;
  const periodLabel = new Date(year, month - 1, 1).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const [items, setItems] = useState<AccountingWorkItemRow[]>([]);
  const [policy, setPolicy] = useState<AccountingPolicyRow>(defaultPolicy);
  const [frequency, setFrequency] = useState<Frequency>("daily");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [schemaReady, setSchemaReady] = useState(true);
  const [loadedPeriod, setLoadedPeriod] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    loadAccountingAdminWorkspace(period).then(data => {
      if (!active) return;
      setItems(data.workItems);
      setPolicy(data.policy ?? defaultPolicy);
      setSchemaReady(true);
      setLoadedPeriod(period);
    }).catch(error => {
      if (!active) return;
      let localItems: AccountingWorkItemRow[] = [];
      let localPolicy = defaultPolicy;
      try {
        localItems = JSON.parse(localStorage.getItem(localItemsKey(period)) ?? "[]");
        localPolicy = JSON.parse(localStorage.getItem(localPolicyKey) ?? JSON.stringify(defaultPolicy));
      } catch { /* draft lokal rusak diabaikan */ }
      setItems(localItems);
      setPolicy(localPolicy);
      setSchemaReady(false);
      setMessage(isMissingTaxSchema(error) ? "Mode lokal aktif. Jalankan migrasi workspace akuntansi setelah tampilan disetujui." : "Database workspace belum dapat diakses. Perubahan disimpan sebagai draft lokal.");
      setLoadedPeriod(period);
    });
    return () => { active = false; };
  }, [period]);

  const itemMap = useMemo(() => new Map(items.map(item => [item.task_key, item])), [items]);
  const loading = loadedPeriod !== period;
  const allRows = useMemo(() => tasks.map(task => ({ task, row: buildItem(task, period, username, itemMap.get(task.key)) })), [itemMap, period, username]);
  const visibleRows = allRows.filter(({ task }) => task.frequency === frequency);
  const done = allRows.filter(({ row }) => row.status === "done").length;
  const inProgress = allRows.filter(({ row }) => row.status === "in_progress").length;
  const waiting = allRows.filter(({ row }) => row.status === "waiting_review").length;
  const percent = Math.round(done / tasks.length * 100);

  const rememberItems = (next: AccountingWorkItemRow[]) => {
    setItems(next);
    localStorage.setItem(localItemsKey(period), JSON.stringify(next));
  };

  const updateLocal = (task: TaskTemplate, patch: Partial<AccountingWorkItemRow>) => {
    const current = buildItem(task, period, username, itemMap.get(task.key));
    const next = { ...current, ...patch, updated_by: username };
    setItems([...items.filter(item => item.task_key !== task.key), next]);
    return next;
  };

  const persistItem = (task: TaskTemplate, patch: Partial<AccountingWorkItemRow> = {}) => startTransition(async () => {
    const now = new Date().toISOString();
    const targetStatus = patch.status ?? itemMap.get(task.key)?.status ?? "todo";
    const next = updateLocal(task, {
      ...patch,
      completed_by: targetStatus === "done" ? username : "",
      completed_at: targetStatus === "done" ? now : null,
    });
    if (!schemaReady) {
      rememberItems([...items.filter(item => item.task_key !== task.key), next]);
      setMessage("Pekerjaan tersimpan sebagai draft lokal.");
      return;
    }
    try {
      const saved = await saveAccountingWorkItem(next);
      rememberItems([...items.filter(item => item.task_key !== task.key), saved]);
      setMessage("Pekerjaan berhasil disimpan.");
    } catch (error) {
      setMessage(`Gagal menyimpan pekerjaan: ${(error as { message?: string }).message ?? "kesalahan database"}`);
    }
  });

  const savePolicy = () => startTransition(async () => {
    if (policy.consultant_approved && (!policy.inventory_method || !policy.depreciation_method)) {
      setMessage("Tetapkan metode persediaan dan penyusutan sebelum menandai kebijakan telah dikonfirmasi konsultan.");
      return;
    }
    const next = { ...policy, workspace: "toto", updated_by: username };
    localStorage.setItem(localPolicyKey, JSON.stringify(next));
    if (!schemaReady) {
      setMessage("Kebijakan tersimpan sebagai draft lokal.");
      return;
    }
    try {
      setPolicy(await saveAccountingPolicy(next));
      setMessage("Kebijakan akuntansi berhasil disimpan.");
    } catch (error) {
      setMessage(`Gagal menyimpan kebijakan: ${(error as { message?: string }).message ?? "kesalahan database"}`);
    }
  });

  const statusTone = (status: AccountingWorkItemRow["status"]) => status === "done"
    ? { color: colors.green, background: "#F0FBF3" }
    : status === "waiting_review"
      ? { color: colors.amber, background: "#FFF9E8" }
      : status === "in_progress"
        ? { color: "#1D4ED8", background: "#EFF6FF" }
        : { color: colors.med, background: colors.soft };

  return <div style={{ display: "grid", gap: 12 }}>
    <section style={{ background: "white", border: `1px solid ${colors.line}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: colors.accent, fontSize: 11, fontWeight: 800 }}><BookOpenCheck size={17}/>Pusat pekerjaan admin akuntansi</div>
          <h2 style={{ margin: "7px 0 4px", fontSize: 18, color: colors.ink }}>Kerjakan sesuai urutan, simpan buktinya</h2>
          <p style={{ margin: 0, color: colors.med, fontSize: 11, lineHeight: 1.6 }}>Periode {periodLabel}. Transaksi tetap dicatat satu kali di Keuangan. Halaman ini dipakai untuk kontrol pekerjaan, review, tutup buku, dan penyerahan ke konsultan pajak.</p>
        </div>
        <div style={{ minWidth: 190, textAlign: "right" }}>
          <div style={{ fontSize: 10, color: colors.med }}>Penyelesaian periode</div>
          <strong style={{ display: "block", marginTop: 2, fontSize: 22, color: percent === 100 ? colors.green : colors.ink }}>{percent}%</strong>
          <div style={{ height: 4, background: colors.soft, borderRadius: 4, overflow: "hidden", marginTop: 6 }}><div style={{ width: `${percent}%`, height: "100%", background: percent === 100 ? colors.green : colors.accent }}/></div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8, marginTop: 14 }}>
        {[
          [CheckCircle2, "Selesai", done, colors.green],
          [Clock3, "Dikerjakan", inProgress, "#1D4ED8"],
          [ShieldCheck, "Menunggu review", waiting, colors.amber],
          [CalendarDays, "Belum mulai", tasks.length - done - inProgress - waiting, colors.med],
        ].map(([Icon, label, value, color]) => { const I = Icon as typeof CheckCircle2; return <div key={String(label)} style={{ padding: "10px 11px", background: colors.paper, border: `1px solid ${colors.soft}`, borderRadius: 8 }}><div style={{ display: "flex", alignItems: "center", gap: 6, color: String(color), fontSize: 10, fontWeight: 700 }}><I size={14}/>{String(label)}</div><strong style={{ display: "block", marginTop: 5, fontSize: 17 }}>{String(value)}</strong></div>; })}
      </div>
    </section>

    {message ? <div role="status" style={{ display: "flex", alignItems: "flex-start", gap: 7, padding: "9px 11px", border: `1px solid ${schemaReady ? colors.line : "#F3D08B"}`, background: schemaReady ? "white" : "#FFF9E8", borderRadius: 8, fontSize: 10, color: schemaReady ? colors.med : "#875F13" }}><AlertTriangle size={14}/><span style={{ flex: 1 }}>{message}</span><button type="button" onClick={() => setMessage("")} style={{ border: 0, background: "transparent", color: "inherit", cursor: "pointer", fontWeight: 700 }}>Tutup</button></div> : null}

    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.8fr)]" style={{ gap: 12, alignItems: "start" }}>
      <section style={{ background: "white", border: `1px solid ${colors.line}`, borderRadius: 10, overflow: "hidden" }}>
        <div style={{ padding: 13, borderBottom: `1px solid ${colors.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0, fontSize: 14 }}>Daftar pekerjaan</h2><p style={{ margin: "3px 0 0", fontSize: 10, color: colors.med }}>Isi status, PIC, bukti, dan catatan supaya pekerjaan dapat dilanjutkan orang lain.</p></div>
          <div style={{ display: "flex", gap: 4, padding: 3, background: colors.soft, borderRadius: 7 }}>
            {(Object.keys(frequencyLabels) as Frequency[]).map(key => <button key={key} type="button" onClick={() => setFrequency(key)} style={{ border: 0, borderRadius: 5, padding: "6px 9px", background: frequency === key ? "white" : "transparent", color: frequency === key ? colors.ink : colors.med, fontSize: 10, fontWeight: 700, cursor: "pointer", boxShadow: frequency === key ? "0 1px 2px rgba(92,64,51,.12)" : "none" }}>{frequencyLabels[key]}</button>)}
          </div>
        </div>
        {loading ? <div style={{ padding: 24, textAlign: "center", fontSize: 11, color: colors.med }}>Memuat pekerjaan periode...</div> : visibleRows.map(({ task, row }) => {
          const open = expanded === task.key;
          const tone = statusTone(row.status);
          return <div key={task.key} style={{ borderBottom: `1px solid ${colors.soft}`, background: open ? colors.paper : "white" }}>
            <button type="button" aria-expanded={open} onClick={() => setExpanded(open ? null : task.key)} style={{ width: "100%", border: 0, background: "transparent", padding: "11px 13px", display: "grid", gridTemplateColumns: "22px minmax(0,1fr) auto 18px", alignItems: "center", gap: 9, textAlign: "left", cursor: "pointer" }}>
              {row.status === "done" ? (
                <CheckCircle2 size={17} color={colors.green}/>
              ) : (
                <Circle size={17} color={row.priority === "high" ? colors.accent : "#B8A89B"}/>
              )}
              <span style={{ minWidth: 0 }}><strong style={{ display: "block", fontSize: 11, color: colors.ink }}>{task.title}</strong><small style={{ display: "block", marginTop: 3, color: colors.med, fontSize: 9, lineHeight: 1.45 }}>{task.category} | {task.owner}</small></span>
              <span style={{ ...tone, borderRadius: 5, padding: "4px 7px", fontSize: 9, fontWeight: 800, whiteSpace: "nowrap" }}>{statusLabels[row.status]}</span>
              <ChevronDown size={15} color={colors.med} style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .15s ease" }}/>
            </button>
            {open ? <div style={{ padding: "0 13px 13px 44px" }}>
              <p style={{ margin: "0 0 10px", color: colors.med, fontSize: 10, lineHeight: 1.55 }}>{task.detail}</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Status<select disabled={pending} style={inputStyle} value={row.status} onChange={event => persistItem(task, { status: event.target.value as AccountingWorkItemRow["status"] })}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>PIC<input style={inputStyle} value={row.assigned_to} onChange={event => updateLocal(task, { assigned_to: event.target.value })} placeholder="Nama admin atau konsultan"/></label>
                <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Target selesai<input type="date" style={inputStyle} value={row.due_date ?? ""} onChange={event => updateLocal(task, { due_date: event.target.value || null })}/></label>
                <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Referensi bukti<input style={inputStyle} value={row.document_reference} onChange={event => updateLocal(task, { document_reference: event.target.value })} placeholder="Nomor invoice, link folder, atau referensi"/></label>
              </div>
              <label style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 9, fontWeight: 700, color: colors.med }}>Catatan kerja<textarea style={{ ...inputStyle, minHeight: 64, resize: "vertical" }} value={row.notes} onChange={event => updateLocal(task, { notes: event.target.value })} placeholder="Temuan, selisih, tindakan berikutnya, atau hasil review"/></label>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}><button type="button" disabled={pending} onClick={() => persistItem(task)} style={{ border: 0, borderRadius: 7, padding: "8px 10px", background: colors.accent, color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", gap: 5, cursor: pending ? "wait" : "pointer" }}><Save size={12}/>Simpan pekerjaan</button></div>
            </div> : null}
          </div>;
        })}
      </section>

      <div style={{ display: "grid", gap: 12 }}>
        <section style={{ background: "white", border: `1px solid ${colors.line}`, borderRadius: 10, padding: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><FileCheck2 size={16} color={colors.accent}/><h2 style={{ margin: 0, fontSize: 13 }}>Mulai dari sini</h2></div>
          <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
            <a href="/dashboard/keuangan" style={{ textDecoration: "none", border: `1px solid ${colors.line}`, borderRadius: 7, padding: "9px 10px", color: colors.ink, fontSize: 10, fontWeight: 700, background: "white" }}>Catat transaksi di Keuangan</a>
            <button type="button" onClick={() => onOpen("akuntansi")} style={{ textAlign: "left", border: `1px solid ${colors.line}`, borderRadius: 7, padding: "9px 10px", color: colors.ink, fontSize: 10, fontWeight: 700, background: "white", cursor: "pointer" }}>Sinkronkan dan periksa jurnal</button>
            <button type="button" onClick={() => onOpen("transaksi")} style={{ textAlign: "left", border: `1px solid ${colors.line}`, borderRadius: 7, padding: "9px 10px", color: colors.ink, fontSize: 10, fontWeight: 700, background: "white", cursor: "pointer" }}>Review transaksi pajak</button>
            <button type="button" onClick={() => onOpen("panduan")} style={{ textAlign: "left", border: 0, borderRadius: 7, padding: "9px 10px", color: "white", fontSize: 10, fontWeight: 800, background: colors.accent, cursor: "pointer" }}>Lanjut ke tutup buku</button>
          </div>
        </section>

        <section style={{ background: "white", border: `1px solid ${colors.line}`, borderRadius: 10, padding: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}><Landmark size={16} color={colors.accent}/><h2 style={{ margin: 0, fontSize: 13 }}>Kebijakan akuntansi</h2></div>
          <p style={{ margin: "5px 0 11px", fontSize: 9, lineHeight: 1.5, color: colors.med }}>SAK Entitas Privat dipakai sebagai rancangan awal. Konsultan harus mengonfirmasi standar dan kebijakan yang sesuai dengan kondisi CV Toto.</p>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Standar pelaporan<select style={inputStyle} value={policy.reporting_standard} onChange={event => setPolicy({ ...policy, reporting_standard: event.target.value as AccountingPolicyRow["reporting_standard"] })}><option value="SAK_EP">SAK Entitas Privat</option><option value="SAK_EMKM">SAK EMKM</option><option value="SAK_INDONESIA">SAK Indonesia umum</option></select></label>
            <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Basis pencatatan<input style={{ ...inputStyle, background: colors.soft }} value="Akrual" disabled/></label>
            <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Metode persediaan<select style={inputStyle} value={policy.inventory_method} onChange={event => setPolicy({ ...policy, inventory_method: event.target.value as AccountingPolicyRow["inventory_method"] })}><option value="">Belum ditetapkan</option><option value="fifo">FIFO</option><option value="weighted_average">Rata-rata tertimbang</option></select></label>
            <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Metode penyusutan<select style={inputStyle} value={policy.depreciation_method} onChange={event => setPolicy({ ...policy, depreciation_method: event.target.value as AccountingPolicyRow["depreciation_method"] })}><option value="">Belum ditetapkan</option><option value="straight_line">Garis lurus</option><option value="declining_balance">Saldo menurun</option></select></label>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 7, fontSize: 9, lineHeight: 1.45, color: colors.med }}><input type="checkbox" checked={policy.consultant_approved} onChange={event => setPolicy({ ...policy, consultant_approved: event.target.checked })}/><span><strong style={{ display: "block", color: colors.ink }}>Sudah dikonfirmasi konsultan</strong>Centang setelah standar, metode persediaan, dan penyusutan disetujui.</span></label>
            <label style={{ display: "grid", gap: 4, fontSize: 9, fontWeight: 700, color: colors.med }}>Catatan kebijakan<textarea style={{ ...inputStyle, minHeight: 58, resize: "vertical" }} value={policy.notes} onChange={event => setPolicy({ ...policy, notes: event.target.value })} placeholder="Contoh: keputusan konsultan dan tanggal berlaku"/></label>
            <button type="button" disabled={pending} onClick={savePolicy} style={{ border: 0, borderRadius: 7, padding: "8px 10px", background: colors.accent, color: "white", fontSize: 10, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: pending ? "wait" : "pointer" }}><Save size={12}/>Simpan kebijakan</button>
          </div>
        </section>
      </div>
    </div>
  </div>;
}
