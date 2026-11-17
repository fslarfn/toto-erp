"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const today = () => new Date().toISOString().slice(0, 10);
const digits = (value: string) => value.replace(/\D/g, "");
const rupiah = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
type Account = { id: string; name: string; bank: string; account_number: string; initial_balance: number; balance: number };
type Flow = { id: string; type: string; category: string; amount: number; description: string; date: string; bank_account: string; account_id: string | null };

export default function SidoarjoKeuanganPage() {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [flows, setFlows] = useState<Flow[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [accountForm, setAccountForm] = useState({ name: "", bank: "BCA", account_number: "", initial_balance: "0" });
    const [flowForm, setFlowForm] = useState({ date: today(), type: "Pemasukan", category: "Lainnya", account_id: "", amount: "", description: "" });
    const [actualBalance, setActualBalance] = useState<Record<string, string>>({});
    const [transfer, setTransfer] = useState({ from: "", to: "", amount: "", date: today(), description: "" });
    const [historyMonth, setHistoryMonth] = useState(today().slice(0, 7)); const [historySearch, setHistorySearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        const [{ data: accountData, error: accountError }, { data: flowData, error: flowError }] = await Promise.all([
            supabase.from("bank_accounts").select("id,name,bank,account_number,initial_balance,balance").eq("operating_unit", UNIT).order("name"),
            supabase.from("cash_flow").select("id,type,category,amount,description,date,bank_account,account_id").eq("operating_unit", UNIT).order("date", { ascending: false }).order("id", { ascending: false }).limit(300),
        ]);
        if (accountError || flowError) setMessage({ ok: false, text: accountError?.message || flowError?.message || "Gagal memuat keuangan cabang." });
        else { setAccounts((accountData ?? []) as Account[]); setFlows((flowData ?? []) as Flow[]); }
        setLoading(false);
    }, []);
    // Pemanggilan awal dipisahkan dari callback realtime agar lint tidak
    // menganggap pembaruan data sebagai setState sinkron pada lifecycle.
    useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
    useEffect(() => { const channel = supabase.channel("sidoarjo-finance").on("postgres_changes", { event: "*", schema: "public", table: "cash_flow", filter: `operating_unit=eq.${UNIT}` }, () => void load()).subscribe(); return () => { void supabase.removeChannel(channel); }; }, [load]);
    const accountTotals = useMemo(() => new Map(accounts.map((account) => {
        const movement = flows.filter((flow) => flow.account_id === account.id || (!flow.account_id && flow.bank_account === account.name)).reduce((sum, flow) => sum + (flow.type === "Pemasukan" ? Number(flow.amount || 0) : -Number(flow.amount || 0)), 0);
        return [account.id, Number(account.initial_balance || 0) + movement];
    })), [accounts, flows]);
    const saveAccount = async (event: FormEvent) => {
        event.preventDefault(); if (!accountForm.name.trim()) { setMessage({ ok: false, text: "Nama rekening wajib diisi." }); return; }
        setSaving(true); setMessage(null);
        const { error } = await supabase.from("bank_accounts").insert({ name: accountForm.name.trim(), bank: accountForm.bank.trim(), account_number: accountForm.account_number.trim(), initial_balance: Number(accountForm.initial_balance || 0), balance: Number(accountForm.initial_balance || 0), operating_unit: UNIT });
        setSaving(false); if (error) { setMessage({ ok: false, text: `Rekening belum tersimpan: ${error.message}` }); return; }
        setAccountForm({ name: "", bank: "BCA", account_number: "", initial_balance: "0" }); setMessage({ ok: true, text: "Rekening Sidoarjo tersimpan." }); await load();
    };
    const saveFlow = async (event: FormEvent) => {
        event.preventDefault(); const account = accounts.find((item) => item.id === flowForm.account_id);
        if (!account || !flowForm.amount || !flowForm.description.trim()) { setMessage({ ok: false, text: "Pilih rekening, isi nominal, dan keterangan transaksi." }); return; }
        setSaving(true); setMessage(null);
        const { error } = await supabase.from("cash_flow").insert({ type: flowForm.type, category: flowForm.category.trim() || "Lainnya", amount: Number(flowForm.amount), description: flowForm.description.trim(), date: flowForm.date, bank_account: account.name, account_id: account.id, operating_unit: UNIT });
        setSaving(false); if (error) { setMessage({ ok: false, text: `Transaksi belum tersimpan: ${error.message}` }); return; }
        setFlowForm((current) => ({ ...current, amount: "", description: "" })); setMessage({ ok: true, text: "Transaksi Sidoarjo tersimpan. Jurnal akan mengikuti aturan Keuangan yang sama." }); await load();
    };
    const adjustBalance = async (account: Account) => {
        const wanted = Number(actualBalance[account.id] || 0);
        const recorded = accountTotals.get(account.id) || 0;
        const difference = wanted - recorded;
        if (!Number.isFinite(wanted)) { setMessage({ ok: false, text: "Saldo riil harus berupa nominal yang benar." }); return; }
        if (difference === 0) { setMessage({ ok: true, text: "Saldo tercatat sudah sama dengan saldo riil." }); return; }
        setSaving(true);
        const { error } = await supabase.from("cash_flow").insert({ type: difference > 0 ? "Pemasukan" : "Pengeluaran", category: "Penyesuaian Saldo", amount: Math.abs(difference), description: `Penyesuaian saldo ${account.name}`, date: today(), bank_account: account.name, account_id: account.id, operating_unit: UNIT });
        setSaving(false);
        if (error) { setMessage({ ok: false, text: `Penyesuaian gagal: ${error.message}` }); return; }
        setActualBalance((current) => ({ ...current, [account.id]: "" })); setMessage({ ok: true, text: "Penyesuaian saldo cabang tersimpan sebagai entri terpisah." }); await load();
    };
    const saveTransfer = async (event: FormEvent) => {
        event.preventDefault(); const from = accounts.find((account) => account.id === transfer.from); const to = accounts.find((account) => account.id === transfer.to); const amount = Number(transfer.amount || 0);
        if (!from || !to || from.id === to.id || !amount) { setMessage({ ok: false, text: "Pilih rekening asal dan tujuan yang berbeda, lalu isi nominal." }); return; }
        setSaving(true);
        const note = transfer.description.trim() || `Mutasi ${from.name} ke ${to.name}`;
        const { error } = await supabase.from("cash_flow").insert([
            { type: "Pengeluaran", category: "Mutasi Antar Kas", amount, description: note, date: transfer.date, bank_account: from.name, account_id: from.id, operating_unit: UNIT },
            { type: "Pemasukan", category: "Mutasi Antar Kas", amount, description: note, date: transfer.date, bank_account: to.name, account_id: to.id, operating_unit: UNIT },
        ]);
        setSaving(false);
        if (error) { setMessage({ ok: false, text: `Mutasi gagal: ${error.message}` }); return; }
        setTransfer({ from: "", to: "", amount: "", date: today(), description: "" }); setMessage({ ok: true, text: "Mutasi antar kas Sidoarjo tersimpan sebagai pasangan masuk dan keluar." }); await load();
    };
    const total = [...accountTotals.values()].reduce((sum, value) => sum + value, 0);
    const visibleFlows = useMemo(() => flows.filter((flow) => flow.date.startsWith(historyMonth) && `${flow.description} ${flow.category} ${flow.bank_account}`.toLowerCase().includes(historySearch.toLowerCase())), [flows, historyMonth, historySearch]);
    return <div className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
        <div style={header}><div><div style={eyebrow}>KEUANGAN · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Keuangan Cabang</h1><p className="page-subtitle">Rekening dan arus kas Sidoarjo berdiri sendiri. Owner dapat memantau ringkasannya tanpa mencampurkan saldo pusat.</p></div><button onClick={() => void load()} style={secondary}>↻ Muat ulang</button></div>
        {message && <div style={{ ...panel, padding: "10px 13px", marginBottom: 14, color: message.ok ? "#15803D" : "#B91C1C", fontWeight: 700, fontSize: 13 }}>{message.text}</div>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginBottom: 18 }}><Card label="Total saldo" value={rupiah(total)} /><Card label="Rekening aktif" value={`${accounts.length} rekening`} /><Card label="Pemasukan tercatat" value={rupiah(flows.filter((item) => item.type === "Pemasukan").reduce((sum, item) => sum + Number(item.amount || 0), 0))} /><Card label="Pengeluaran tercatat" value={rupiah(flows.filter((item) => item.type !== "Pemasukan").reduce((sum, item) => sum + Number(item.amount || 0), 0))} /></div>
        <section style={{ ...panel, padding: 0, overflow: "hidden", marginBottom: 18 }}><div style={{ padding: "16px 18px", borderBottom: "1px solid #E8DCCF", display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}><b style={{ color: "#3C2F2F" }}>🗓️ Rekonsiliasi Saldo</b><span style={{ color: "#A67B5B", fontSize: 12 }}>Isi saldo riil lapangan → Sesuaikan</span></div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Akun", "Saldo tercatat", "Saldo riil (lapangan)", "Selisih", "Aksi"].map((label) => <th key={label} style={th}>{label}</th>)}</tr></thead><tbody>{accounts.length === 0 ? <tr><td colSpan={5} style={emptyCell}>Tambahkan rekening cabang terlebih dahulu.</td></tr> : accounts.map((account) => { const recorded = accountTotals.get(account.id) || 0; const real = Number(actualBalance[account.id] || 0); const difference = actualBalance[account.id] === undefined || actualBalance[account.id] === "" ? null : real - recorded; return <tr key={account.id}><td style={{ ...td, fontWeight: 800 }}>{account.name}</td><td style={{ ...td, fontWeight: 800 }}>{rupiah(recorded)}</td><td style={td}><input inputMode="numeric" value={actualBalance[account.id] || ""} onChange={(e) => setActualBalance((current) => ({ ...current, [account.id]: digits(e.target.value) }))} style={{ ...input, minHeight: 34, width: 160 }} placeholder="cth: 500000" /></td><td style={{ ...td, color: difference === null ? "#8B735F" : difference === 0 ? "#15803D" : "#B91C1C", fontWeight: 800 }}>{difference === null ? "—" : rupiah(difference)}</td><td style={td}><button disabled={saving || difference === null} onClick={() => void adjustBalance(account)} style={secondary}>Sesuaikan</button></td></tr>; })}</tbody></table></div><p style={{ margin: 0, padding: "12px 18px", color: "#8B735F", fontSize: 12 }}>Penyesuaian dicatat sebagai entri terpisah di riwayat Sidoarjo; transaksi sebelumnya tidak dihapus.</p></section>
        <section style={{ ...panel, marginBottom: 18 }}><div style={{ fontWeight: 800, color: "#3C2F2F", marginBottom: 14 }}>🔁 Mutasi Antar Kas</div><form onSubmit={saveTransfer} style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(150px,1fr))", gap: 12, alignItems: "end" }}><Field label="Dari Kas"><select value={transfer.from} onChange={(e) => setTransfer((v) => ({ ...v, from: e.target.value }))} style={input}><option value="">Pilih kas…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Ke Kas"><select value={transfer.to} onChange={(e) => setTransfer((v) => ({ ...v, to: e.target.value }))} style={input}><option value="">Pilih kas…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Jumlah (Rp)"><input inputMode="numeric" value={transfer.amount} onChange={(e) => setTransfer((v) => ({ ...v, amount: digits(e.target.value) }))} style={input} placeholder="500000" /></Field><Field label="Tanggal"><input type="date" value={transfer.date} onChange={(e) => setTransfer((v) => ({ ...v, date: e.target.value }))} style={input} /></Field><button type="submit" disabled={saving} style={primary}>🔁 Catat Mutasi</button></form></section>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(350px,1fr))", gap: 18 }}>
            <form onSubmit={saveAccount} style={panel}><strong style={{ color: "#3C2F2F" }}>Tambah rekening cabang</strong><div style={{ display: "grid", gap: 10, marginTop: 14 }}><Field label="Nama rekening"><input required value={accountForm.name} onChange={(e) => setAccountForm((v) => ({ ...v, name: e.target.value }))} style={input} placeholder="cth: Bank BCA Sidoarjo" /></Field><Field label="Bank"><input value={accountForm.bank} onChange={(e) => setAccountForm((v) => ({ ...v, bank: e.target.value }))} style={input} /></Field><Field label="Nomor rekening"><input value={accountForm.account_number} onChange={(e) => setAccountForm((v) => ({ ...v, account_number: e.target.value }))} style={input} /></Field><Field label="Saldo awal"><input inputMode="numeric" value={accountForm.initial_balance} onChange={(e) => setAccountForm((v) => ({ ...v, initial_balance: digits(e.target.value) }))} style={input} /></Field><button type="submit" disabled={saving} style={primary}>＋ Simpan rekening</button></div></form>
            <form onSubmit={saveFlow} style={panel}><strong style={{ color: "#3C2F2F" }}>Input transaksi keuangan</strong><div style={{ display: "grid", gap: 10, marginTop: 14 }}><Field label="Tanggal"><input type="date" value={flowForm.date} onChange={(e) => setFlowForm((v) => ({ ...v, date: e.target.value }))} style={input} /></Field><Field label="Tipe"><select value={flowForm.type} onChange={(e) => setFlowForm((v) => ({ ...v, type: e.target.value }))} style={input}><option>Pemasukan</option><option>Pengeluaran</option></select></Field><Field label="Rekening"><select value={flowForm.account_id} onChange={(e) => setFlowForm((v) => ({ ...v, account_id: e.target.value }))} style={input}><option value="">Pilih rekening…</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field><Field label="Kategori"><input value={flowForm.category} onChange={(e) => setFlowForm((v) => ({ ...v, category: e.target.value }))} style={input} placeholder="cth: Penjualan / Operasional" /></Field><Field label="Jumlah"><input required inputMode="numeric" value={flowForm.amount} onChange={(e) => setFlowForm((v) => ({ ...v, amount: digits(e.target.value) }))} style={input} placeholder="0" /></Field><Field label="Keterangan"><input required value={flowForm.description} onChange={(e) => setFlowForm((v) => ({ ...v, description: e.target.value }))} style={input} placeholder="Keterangan transaksi" /></Field><button type="submit" disabled={saving || accounts.length === 0} style={primary}>💾 Simpan transaksi</button></div></form>
        </div>
        <section style={{ ...panel, marginTop: 18, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, fontWeight: 800, color: "#3C2F2F" }}>Saldo rekening Sidoarjo</div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Rekening", "Bank", "Nomor", "Saldo awal", "Saldo berjalan"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={5} style={emptyCell}>Memuat rekening…</td></tr> : accounts.length === 0 ? <tr><td colSpan={5} style={emptyCell}>Belum ada rekening Sidoarjo.</td></tr> : accounts.map((account) => <tr key={account.id}><td style={{ ...td, fontWeight: 800 }}>{account.name}</td><td style={td}>{account.bank || "—"}</td><td style={td}>{account.account_number || "—"}</td><td style={td}>{rupiah(Number(account.initial_balance || 0))}</td><td style={{ ...td, fontWeight: 800, color: "#15803D" }}>{rupiah(accountTotals.get(account.id) || 0)}</td></tr>)}</tbody></table></div></section>
        <section style={{ ...panel, marginTop: 18, padding: 0, overflow: "hidden" }}><div style={{ padding: 16, display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", alignItems: "center" }}><b style={{ color: "#3C2F2F" }}>Riwayat Transaksi</b><div style={{ display: "flex", gap: 8 }}><input type="month" value={historyMonth} onChange={(e) => setHistoryMonth(e.target.value)} style={input} /><input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="🔍 Cari keterangan transaksi…" style={input} /></div></div><div style={{ overflowX: "auto" }}><table style={table}><thead><tr>{["Tanggal", "Keterangan", "Kategori", "Sumber/Tujuan Kas", "Tipe", "Jumlah"].map((title) => <th key={title} style={th}>{title}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan={6} style={emptyCell}>Memuat transaksi…</td></tr> : visibleFlows.length === 0 ? <tr><td colSpan={6} style={emptyCell}>Tidak ada transaksi pada filter ini.</td></tr> : visibleFlows.map((flow) => <tr key={flow.id}><td style={td}>{flow.date}</td><td style={{ ...td, fontWeight: 800 }}>{flow.description}</td><td style={td}>{flow.category || "—"}</td><td style={td}>{flow.bank_account || "—"}</td><td style={td}>{flow.type}</td><td style={{ ...td, color: flow.type === "Pemasukan" ? "#15803D" : "#B91C1C", fontWeight: 800 }}>{flow.type === "Pemasukan" ? "+" : "-"}{rupiah(Number(flow.amount || 0))}</td></tr>)}</tbody></table></div></section>
    </div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, color: "#6B574B", fontWeight: 800, textTransform: "uppercase" }}>{label}{children}</label>; }
function Card({ label, value }: { label: string; value: string }) { return <div style={{ ...panel, padding: 15 }}><div style={{ fontSize: 11, fontWeight: 800, color: "#A67B5B", textTransform: "uppercase" }}>{label}</div><div style={{ marginTop: 6, color: "#3C2F2F", fontWeight: 800, fontSize: 19 }}>{value}</div></div>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 18 };
const eyebrow: React.CSSProperties = { color: "#A67B5B", fontWeight: 800, letterSpacing: ".08em", fontSize: 11, marginBottom: 7 };
const panel: React.CSSProperties = { border: "1px solid #E8DCCF", background: "#FFFDF9", borderRadius: 12, padding: 18 };
const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white", fontSize: 13 };
const primary: React.CSSProperties = { minHeight: 38, padding: "0 15px", border: 0, borderRadius: 7, background: "#8B5E3C", color: "white", fontWeight: 800, cursor: "pointer" };
const secondary: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 700, cursor: "pointer" };
const table: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 12 };
const th: React.CSSProperties = { textAlign: "left", padding: "10px 14px", background: "#F4EBDD", color: "#6B4423", fontSize: 10, whiteSpace: "nowrap", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "11px 14px", borderTop: "1px solid #F0E7DE", color: "#514036", whiteSpace: "nowrap" };
const emptyCell: React.CSSProperties = { ...td, textAlign: "center", padding: "30px 12px", color: "#927C6D" };
