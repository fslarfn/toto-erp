"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, Link2, RefreshCw, Search, Unlink } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { rankInvoiceMatches } from "@/lib/payments/matching";
import {
  allocateCustomerReceipt,
  loadPaymentReconciliation,
  OpenCustomerInvoiceRow,
  registerCustomerReceipt,
  removeCustomerReceiptAllocation,
} from "@/lib/payments/store";
import styles from "./PaymentReconciliation.module.css";

type Filter = "queue" | "all" | "applied";
const rp = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const monthEnd = (period: string) => new Date(Number(period.slice(0, 4)), Number(period.slice(5, 7)), 0).toISOString().slice(0, 10);
const statusLabel = { unregistered: "Belum diperiksa", unidentified: "Belum dikenali", partially_applied: "Sebagian", applied: "Cocok" } as const;

export default function PaymentReconciliation() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const focusInvoice = (searchParams.get("invoice") ?? "").trim().toUpperCase();
  const [period, setPeriod] = useState(() => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; });
  const [data, setData] = useState<Awaited<ReturnType<typeof loadPaymentReconciliation>> | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [filter, setFilter] = useState<Filter>("queue");
  const [invoiceSearch, setInvoiceSearch] = useState(focusInvoice);
  const [payerName, setPayerName] = useState("");
  const [bankReference, setBankReference] = useState("");
  const [target, setTarget] = useState<OpenCustomerInvoiceRow | null>(null);
  const [allocationAmount, setAllocationAmount] = useState("");
  const [message, setMessage] = useState("");
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [pending, startTransition] = useTransition();
  const deferredInvoiceSearch = useDeferredValue(invoiceSearch);

  const reload = useCallback(async (keepSelection = true) => {
    try {
      const result = await loadPaymentReconciliation(`${period}-01`, monthEnd(period));
      setData(result);
      setSchemaMissing(false);
      setSelectedFlowId(current => keepSelection && result.cashFlows.some(flow => flow.id === current) ? current : (result.cashFlows[0]?.id ?? ""));
    } catch (error) {
      const problem = error as { code?: string; message?: string };
      setSchemaMissing(problem.code === "42P01" || problem.code === "PGRST202" || problem.code === "PGRST205" || !!problem.message?.includes("schema cache"));
      setMessage(`Data rekonsiliasi belum dapat dimuat: ${problem.message ?? "kesalahan database"}`);
    }
  }, [period]);

  useEffect(() => {
    let active = true;
    loadPaymentReconciliation(`${period}-01`, monthEnd(period)).then(result => {
      if (!active) return;
      setData(result);
      setSchemaMissing(false);
      const receiptMap = new Map(result.receipts.map(item => [item.cash_flow_id, item]));
      const firstQueue = result.cashFlows.find(flow => receiptMap.get(flow.id)?.status !== "applied");
      setSelectedFlowId(firstQueue?.id ?? result.cashFlows[0]?.id ?? "");
    }).catch((error: { code?: string; message?: string }) => {
      if (!active) return;
      setSchemaMissing(error.code === "42P01" || error.code === "PGRST202" || error.code === "PGRST205" || !!error.message?.includes("schema cache"));
      setMessage(`Data rekonsiliasi belum dapat dimuat: ${error.message ?? "kesalahan database"}`);
    });
    return () => { active = false; };
  }, [period]);

  const receiptsByFlow = useMemo(() => new Map((data?.receipts ?? []).map(receipt => [receipt.cash_flow_id, receipt])), [data]);
  const allocationsByReceipt = useMemo(() => {
    const grouped = new Map<string, NonNullable<typeof data>["allocations"]>();
    for (const allocation of data?.allocations ?? []) grouped.set(allocation.receipt_id, [...(grouped.get(allocation.receipt_id) ?? []), allocation]);
    return grouped;
  }, [data]);
  const allRows = useMemo(() => (data?.cashFlows ?? []).map(flow => {
    const receipt = receiptsByFlow.get(flow.id);
    const applied = receipt ? (allocationsByReceipt.get(receipt.id) ?? []).reduce((sum, allocation) => sum + Number(allocation.amount), 0) : 0;
    return { flow, receipt, applied, status: receipt?.status ?? "unregistered" as const };
  }), [data, receiptsByFlow, allocationsByReceipt]);
  const rows = useMemo(() => allRows.filter(row => filter === "all" || (filter === "applied" ? row.status === "applied" : row.status !== "applied")), [allRows, filter]);

  const selected = useMemo(() => allRows.find(row => row.flow.id === selectedFlowId), [allRows, selectedFlowId]);
  const receipt = selected?.receipt;
  const allocations = receipt ? allocationsByReceipt.get(receipt.id) ?? [] : [];
  const remaining = selected ? Math.max(0, Number(selected.flow.amount) - allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0)) : 0;
  const candidates = useMemo(() => {
    if (!selected) return [];
    const matches = rankInvoiceMatches({ amount: remaining || Number(selected.flow.amount), date: selected.flow.date, payerName: receipt?.payer_name || payerName, description: selected.flow.description, reference: receipt?.bank_reference || bankReference }, (data?.invoices ?? []).map(invoice => ({ invoiceKey: invoice.invoice_key, invoiceNumber: invoice.invoice_number, customerName: invoice.customer_name, date: invoice.invoice_date, outstanding: Number(invoice.outstanding_amount) })), 100);
    const query = deferredInvoiceSearch.toLowerCase().trim();
    return matches.filter(match => !query || `${match.invoiceKey} ${match.invoiceNumber} ${match.customerName}`.toLowerCase().includes(query)).slice(0, 30);
  }, [selected, remaining, receipt, payerName, bankReference, data, deferredInvoiceSearch]);

  const stats = useMemo(() => {
    const allRows = data?.cashFlows ?? [];
    const unidentified = allRows.filter(flow => !receiptsByFlow.has(flow.id) || receiptsByFlow.get(flow.id)?.status === "unidentified");
    const partial = (data?.receipts ?? []).filter(item => item.status === "partially_applied");
    const applied = (data?.receipts ?? []).filter(item => item.status === "applied");
    return { unidentified: unidentified.length, unidentifiedValue: unidentified.reduce((sum, flow) => sum + Number(flow.amount), 0), partial: partial.length, appliedValue: applied.reduce((sum, item) => sum + Number(item.amount), 0), openInvoices: data?.invoices.length ?? 0 };
  }, [data, receiptsByFlow]);

  const register = () => {
    if (!selected) return;
    startTransition(async () => {
      try {
        await registerCustomerReceipt({ cashFlowId: selected.flow.id, payerName, bankReference, username: user?.username ?? "" });
        setMessage("Penerimaan masuk antrean rekonsiliasi.");
        await reload();
      } catch (error) { setMessage((error as { message?: string }).message ?? "Gagal mendaftarkan penerimaan."); }
    });
  };

  const chooseCandidate = (invoice: OpenCustomerInvoiceRow) => {
    setTarget(invoice);
    setAllocationAmount(String(Math.min(remaining, Number(invoice.outstanding_amount))));
  };

  const allocate = () => {
    if (!receipt || !target) return;
    const amount = Number(allocationAmount.replace(/[^0-9]/g, ""));
    if (!amount || amount > remaining || amount > Number(target.outstanding_amount)) {
      setMessage("Nominal alokasi harus lebih dari nol dan tidak boleh melebihi sisa penerimaan atau invoice.");
      return;
    }
    startTransition(async () => {
      try {
        await allocateCustomerReceipt({ receiptId: receipt.id, invoiceKey: target.invoice_key, invoiceNumber: target.invoice_number, customerName: target.customer_name, amount, username: user?.username ?? "" });
        setTarget(null); setAllocationAmount(""); setMessage(`${rp(amount)} berhasil dihubungkan ke invoice ${target.invoice_number || target.invoice_key}.`);
        await reload();
      } catch (error) { setMessage((error as { message?: string }).message ?? "Gagal mengalokasikan pembayaran."); }
    });
  };

  const removeAllocation = (id: string) => {
    if (!window.confirm("Lepaskan pembayaran dari invoice? Sistem akan membuat jurnal pembalik bila diperlukan.")) return;
    startTransition(async () => {
      try { await removeCustomerReceiptAllocation(id, user?.username ?? ""); setMessage("Alokasi dilepas dan status invoice diperbarui."); await reload(); }
      catch (error) { setMessage((error as { message?: string }).message ?? "Gagal melepas alokasi."); }
    });
  };

  return <main className={styles.page}>
    <div className={styles.header}>
      <div className={styles.headingCopy}>
        <p className={styles.eyebrow}>Keuangan</p>
        <h1 className={styles.title}>Rekonsiliasi pembayaran</h1>
        <p className={styles.subtitle}>Hubungkan uang masuk dengan invoice tanpa mencatat omzet dua kali.</p>
      </div>
      <div className={styles.actions}>
        <Link href="/dashboard/keuangan" className={styles.button}>
          <ArrowLeft size={14} aria-hidden="true" /> Kembali
        </Link>
        <label className={styles.periodField}>
          <span>Periode</span>
          <input aria-label="Periode rekonsiliasi" className={styles.month} type="month" value={period} onChange={event => setPeriod(event.target.value)} />
        </label>
        <button className={styles.button} disabled={pending} onClick={() => void reload()}>
          <RefreshCw size={14} aria-hidden="true" /> Muat ulang
        </button>
      </div>
    </div>
    {message ? <div className={schemaMissing ? styles.error : styles.notice}><AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 6 }} />{message}{schemaMissing ? <> Jalankan <b>20260908_customer_payment_reconciliation.sql</b>.</> : null}</div> : null}
    <section className={styles.summary} aria-label="Ringkasan rekonsiliasi">
      <div className={styles.summaryItem}><span className={styles.summaryLabel}>Belum dikenali</span><strong className={styles.summaryValue}>{stats.unidentified}</strong><span className={styles.muted}>{rp(stats.unidentifiedValue)}</span></div>
      <div className={styles.summaryItem}><span className={styles.summaryLabel}>Pembayaran sebagian</span><strong className={styles.summaryValue}>{stats.partial}</strong><span className={styles.muted}>masih perlu dialokasikan</span></div>
      <div className={styles.summaryItem}><span className={styles.summaryLabel}>Cocok periode ini</span><strong className={styles.summaryValue}>{rp(stats.appliedValue)}</strong><span className={styles.muted}>sudah terhubung penuh</span></div>
      <div className={styles.summaryItem}><span className={styles.summaryLabel}>Invoice terbuka</span><strong className={styles.summaryValue}>{stats.openInvoices}</strong><span className={styles.muted}>belum lunas</span></div>
    </section>
    <section className={styles.workspace}>
      <aside className={styles.receipts}>
        <div className={styles.paneHead}><h2 className={styles.paneTitle}>Mutasi uang masuk</h2><p className={styles.paneHint}>Pilih transaksi, lalu periksa invoice yang paling mungkin.</p><div className={styles.filters}>{([['queue','Perlu dikerjakan'],['all','Semua'],['applied','Sudah cocok']] as Array<[Filter,string]>).map(([key,label]) => <button key={key} className={`${styles.filter} ${filter === key ? styles.filterActive : ""}`} onClick={() => setFilter(key)}>{label}</button>)}</div></div>
        <div className={styles.receiptList}>{rows.length ? rows.map(row => <button key={row.flow.id} className={`${styles.receipt} ${selectedFlowId === row.flow.id ? styles.receiptSelected : ""}`} onClick={() => { setSelectedFlowId(row.flow.id); setPayerName(row.receipt?.payer_name ?? ""); setBankReference(row.receipt?.bank_reference ?? ""); setTarget(null); }}><div className={styles.receiptTop}><strong className={styles.receiptAmount}>{rp(Number(row.flow.amount))}</strong><span className={`${styles.status} ${row.status === "unregistered" ? styles.unregistered : row.status === "unidentified" ? styles.unidentified : row.status === "partially_applied" ? styles.partial : styles.applied}`}>{statusLabel[row.status]}</span></div><div className={styles.receiptDescription}>{row.flow.description || "Tanpa keterangan bank"}</div><div className={styles.receiptMeta}><span>{row.flow.date}</span><span>{row.flow.bank_account}</span></div></button>) : <div className={styles.empty}>Tidak ada pemasukan pada periode ini.</div>}</div>
      </aside>
      <div className={styles.detail}>{!selected ? <div className={styles.empty}>Pilih mutasi untuk mulai mencocokkan pembayaran.</div> : <div className={styles.detailBody}>
        <div className={styles.receiptHero}><span className={styles.muted}>{selected.flow.date} · {selected.flow.bank_account}</span><h2 className={styles.heroAmount}>{rp(Number(selected.flow.amount))}</h2><div className={styles.heroText}>{selected.flow.description || "Tanpa keterangan mutasi"}</div></div>
        {!receipt ? <div className={styles.section}><div className={styles.sectionTitle}>Identifikasi awal</div><div className={styles.formGrid}><label className={styles.fieldLabel}>Nama pengirim<input className={styles.input} value={payerName} onChange={event => setPayerName(event.target.value)} placeholder="Jika terlihat di mutasi" /></label><label className={styles.fieldLabel}>Referensi bank<input className={styles.input} value={bankReference} onChange={event => setBankReference(event.target.value)} placeholder="Opsional" /></label></div><button className={styles.buttonPrimary} disabled={pending} onClick={register} style={{ marginTop: 10 }}><Link2 size={13} style={{ verticalAlign: -2 }} /> Periksa pembayaran ini</button></div> : <>
          <div className={styles.section}><div className={styles.sectionTitle}><span>Alokasi pembayaran</span><span>{rp(receipt.amount - remaining)} dari {rp(receipt.amount)}</span></div><div className={styles.progress}><div className={styles.progressBar} style={{ width: `${Math.min(100, ((receipt.amount - remaining) / receipt.amount) * 100)}%` }} /></div>{allocations.length ? <div className={styles.allocationList} style={{ marginTop: 8 }}>{allocations.map(allocation => <div key={allocation.id} className={styles.allocationRow}><div><strong>{allocation.invoice_number || allocation.invoice_key}</strong><div className={styles.muted}>{allocation.customer_name}</div></div><strong>{rp(Number(allocation.amount))}</strong><button aria-label={`Lepaskan invoice ${allocation.invoice_number}`} className={styles.buttonDanger} disabled={pending} onClick={() => removeAllocation(allocation.id)}><Unlink size={12} /></button></div>)}</div> : <div className={styles.muted} style={{ marginTop: 8 }}>Belum ada nominal yang dihubungkan.</div>}</div>
          {remaining > 0 ? <div className={styles.section}><div className={styles.sectionTitle}><span>Cari invoice untuk sisa {rp(remaining)}</span><span className={styles.muted}>{candidates.length} kandidat</span></div><div className={styles.candidateTools}><label className={styles.fieldLabel}>Customer atau nomor invoice<div style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 9, top: 12, color: "#8b786b" }} /><input className={styles.input} style={{ paddingLeft: 29 }} value={invoiceSearch} onChange={event => setInvoiceSearch(event.target.value)} placeholder="Cari invoice..." /></div></label><label className={styles.fieldLabel}>Nama pengirim<input className={styles.input} value={payerName} disabled /></label></div><div className={styles.candidateList}>{candidates.map(match => { const raw = data?.invoices.find(invoice => invoice.invoice_key === match.invoiceKey); if (!raw) return null; return <button key={match.invoiceKey} className={`${styles.candidate} ${target?.invoice_key === match.invoiceKey ? styles.candidateSelected : ""}`} onClick={() => chooseCandidate(raw)}><div className={styles.candidateTop}><span className={styles.candidateName}>{match.invoiceNumber || match.invoiceKey} · {match.customerName}</span><span className={styles.score}>{match.score}% cocok</span></div><div className={styles.receiptMeta}><span>{match.date}</span><strong>Sisa {rp(match.outstanding)}</strong></div><div className={styles.reason}>{match.reasons.length ? match.reasons.join("; ") : "Tidak ada petunjuk kuat—periksa manual."}</div></button>})}</div>{target ? <div className={styles.allocateBox}><div><div className={styles.fieldLabel}>Invoice dipilih</div><strong style={{ fontSize: 11 }}>{target.invoice_number || target.invoice_key} · {target.customer_name}</strong></div><label className={styles.fieldLabel}>Nominal alokasi<input className={styles.input} inputMode="numeric" value={allocationAmount} onChange={event => setAllocationAmount(event.target.value)} /></label><button className={styles.buttonPrimary} disabled={pending} onClick={allocate}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Hubungkan</button></div> : null}</div> : <div className={styles.notice} style={{ marginTop: 15 }}><CheckCircle2 size={13} style={{ verticalAlign: -2, marginRight: 6 }} />Seluruh penerimaan sudah dialokasikan.</div>}
        </>}
      </div>}</div>
    </section>
  </main>;
}
