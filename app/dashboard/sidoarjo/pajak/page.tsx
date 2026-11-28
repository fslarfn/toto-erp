"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
type Flow = { id: string; date: string; type: string; category: string; description: string; amount: number };
type Tax = { source_id: string; tax_code: string; status: string; gross_amount: number };

export default function SidoarjoPajakPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [flows, setFlows] = useState<Flow[]>([]); const [reviews, setReviews] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState<string | null>(null); const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setMessage(""); const start = `${period}-01`, end = `${period}-31`;
    const [flowResult, taxResult] = await Promise.all([
      supabase.from("cash_flow").select("id,date,type,category,description,amount").eq("operating_unit", UNIT).gte("date", start).lte("date", end).order("date", { ascending: false }).order("id", { ascending: false }),
      supabase.from("tax_transactions").select("source_id,tax_code,status,gross_amount").eq("workspace", UNIT).eq("tax_period", period),
    ]);
    const error = flowResult.error || taxResult.error;
    if (error) setMessage(`Gagal memuat review pajak: ${error.message}`);
    else { setFlows((flowResult.data ?? []) as Flow[]); setReviews((taxResult.data ?? []) as Tax[]); }
    setLoading(false);
  }, [period]);
  useEffect(() => { void load(); }, [load]);
  const reviewed = useMemo(() => new Map(reviews.map((row) => [String(row.source_id), row])), [reviews]);
  const totals = useMemo(() => ({ income: flows.filter((row) => row.type === "Pemasukan").reduce((sum, row) => sum + Number(row.amount), 0), expense: flows.filter((row) => row.type !== "Pemasukan").reduce((sum, row) => sum + Number(row.amount), 0), done: flows.filter((row) => reviewed.has(row.id)).length }), [flows, reviewed]);
  const review = async (flow: Flow, taxCode: string) => {
    setSaving(flow.id);
    const rate = taxCode === "ppn" ? 0.11 : 0;
    const amount = Number(flow.amount);
    const result = await supabase.from("tax_transactions").upsert({ workspace: UNIT, source_type: "cash_flow", source_id: flow.id, transaction_date: flow.date, tax_period: period, flow_type: flow.type === "Pemasukan" ? "income" : "expense", category: flow.category || "Lainnya", description: flow.description || "", counterparty_name: "", document_number: "", tax_code: taxCode, tax_direction: taxCode === "ppn" ? (flow.type === "Pemasukan" ? "output" : "input") : "none", gross_amount: amount, dpp_amount: taxCode === "ppn" ? amount / 1.11 : amount, tax_rate: rate, tax_amount: taxCode === "ppn" ? amount - amount / 1.11 : 0, status: "reviewed", notes: "Review Sidoarjo", reviewed_by: user?.username || "", reviewed_at: new Date().toISOString() }, { onConflict: "workspace,source_type,source_id" });
    setSaving(null);
    if (result.error) { setMessage(`Gagal menyimpan review: ${result.error.message}`); return; }
    void load();
  };
  return <main className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
    <div style={header}><div><div style={eyebrow}>AKUNTANSI & PAJAK · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>Akuntansi & Pajak</h1><p className="page-subtitle">Review otomatis transaksi cabang sebelum ditindaklanjuti oleh finance pusat.</p></div><button onClick={() => void load()} style={button}>↻ Muat ulang</button></div>
    {message && <div style={notice}>{message}</div>}
    <section style={{ ...panel, display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap", marginTop: 18 }}><label style={label}>Periode<input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} style={input}/></label><div style={{ fontSize: 12, color: "#7B6656", maxWidth: 540 }}>Transaksi berasal dari Keuangan Sidoarjo. Pilih perlakuan pajak untuk menyelesaikan review; tidak ada transaksi pusat yang ditampilkan.</div></section>
    <div style={cards}><Card label="Pemasukan tercatat" value={money(totals.income)} /><Card label="Pengeluaran tercatat" value={money(totals.expense)} /><Card label="Transaksi direview" value={`${totals.done} / ${flows.length}`} /><Card label="Menunggu review" value={String(Math.max(0, flows.length - totals.done))} /></div>
    <section style={{ ...panel, marginTop: 18 }}><h2 style={heading}>Review pajak transaksi</h2><p style={subtle}>Tandai Non Pajak atau PPN 11% sesuai bukti transaksi.</p>{loading ? <Empty text="Memuat transaksi…" /> : flows.length === 0 ? <Empty text="Belum ada transaksi keuangan Sidoarjo pada periode ini." /> : <div style={{ overflow: "auto" }}><table style={table}><thead><tr><th style={th}>Tanggal</th><th style={th}>Transaksi</th><th style={{ ...th, textAlign: "right" }}>Nominal</th><th style={th}>Perlakuan</th><th style={th}>Status</th></tr></thead><tbody>{flows.map((flow) => { const current = reviewed.get(flow.id); return <tr key={flow.id}><td style={td}>{flow.date}</td><td style={td}><b>{flow.category || "Lainnya"}</b><br/><small>{flow.description || "—"}</small></td><td style={{ ...td, textAlign: "right", color: flow.type === "Pemasukan" ? "#15803D" : "#B91C1C", fontWeight: 800 }}>{money(flow.amount)}</td><td style={td}><select disabled={saving === flow.id} value={current?.tax_code || "non_tax"} onChange={(event) => void review(flow, event.target.value)} style={select}><option value="non_tax">Non Pajak</option><option value="ppn">PPN 11%</option><option value="pph21">PPh 21</option><option value="pph23">PPh 23</option><option value="other">Lainnya</option></select></td><td style={td}>{current ? <b style={{ color: "#15803D" }}>{saving === flow.id ? "Menyimpan…" : "Sudah direview"}</b> : <span style={{ color: "#B45309", fontWeight: 700 }}>Perlu review</span>}</td></tr>; })}</tbody></table></div>}</section>
  </main>;
}
function Card({ label, value }: { label: string; value: string }) { return <div style={panel}><div style={eyebrow}>{label}</div><b style={{ fontSize: 20, color: "#3C2F2F" }}>{value}</b></div>; }
function Empty({ text }: { text: string }) { return <p style={{ color: "#7B6656", margin: "18px 0" }}>{text}</p>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }; const eyebrow: React.CSSProperties = { color: "#A67B5B", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 7 }; const panel: React.CSSProperties = { background: "#FFFDF9", border: "1px solid #E8DCCF", borderRadius: 12, padding: 18 }; const cards: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }; const button: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 800, cursor: "pointer" }; const label: React.CSSProperties = { display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "#6B574B", textTransform: "uppercase" }; const input: React.CSSProperties = { minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white" }; const heading: React.CSSProperties = { fontSize: 16, margin: 0, color: "#3C2F2F" }; const subtle: React.CSSProperties = { fontSize: 12, color: "#7B6656", margin: "6px 0 14px" }; const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 12, minWidth: 850 }; const th: React.CSSProperties = { padding: "9px 8px", textAlign: "left", background: "#F5EBDD", color: "#6B4423", whiteSpace: "nowrap" }; const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #F0E7DE", color: "#514036", verticalAlign: "top" }; const select: React.CSSProperties = { minHeight: 34, padding: "6px 8px", border: "1px solid #D8C1AA", borderRadius: 6, background: "white", color: "#3C2F2F", fontWeight: 700 }; const notice: React.CSSProperties = { marginTop: 14, padding: 11, borderRadius: 8, background: "#FFF8E7", border: "1px solid #F0D28C", color: "#875F13", fontSize: 12 };
