"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase-client";

const UNIT = "toto_sidoarjo";
const money = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
type Material = { id: string; code: string; name: string; current_stock: number; unit: string };
type Bill = { id: string; no_invoice: string; tanggal: string; supplier: string; grand_total: number; paid_amount: number };
type Hpp = { id: string; product_name: string; material_cost_per_meter: number; coloring_cost: number; labor_cost: number; production_cost: number; transport_cost: number; total_cost_per_meter: number; selling_price_per_meter: number; updated_at: string };

export default function SidoarjoHppPage() {
  const { user } = useAuth();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [records, setRecords] = useState<Hpp[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ product: "", materialId: "", purchase: "", length: "6", coloring: "0", labor: "0", production: "0", transport: "0", selling: "" });

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    const [materialResult, billResult, hppResult] = await Promise.all([
      supabase.from("materials").select("id,code,name,current_stock,unit").eq("operating_unit", UNIT).order("name"),
      supabase.from("tagihan_bahan").select("id,no_invoice,tanggal,supplier,grand_total,paid_amount").eq("operating_unit", UNIT).order("tanggal", { ascending: false }),
      supabase.from("product_hpp").select("id,product_name,material_cost_per_meter,coloring_cost,labor_cost,production_cost,transport_cost,total_cost_per_meter,selling_price_per_meter,updated_at").eq("workspace", UNIT).order("updated_at", { ascending: false }),
    ]);
    const error = materialResult.error || billResult.error || hppResult.error;
    if (error) setMessage(`Gagal memuat HPP Sidoarjo: ${error.message}`);
    else { setMaterials((materialResult.data ?? []) as Material[]); setBills((billResult.data ?? []) as Bill[]); setRecords((hppResult.data ?? []) as Hpp[]); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const preview = useMemo(() => {
    const purchase = Number(form.purchase) || 0, length = Number(form.length) || 0;
    const material = length > 0 ? purchase / length : 0;
    const total = material + (Number(form.coloring) || 0) + (Number(form.labor) || 0) + (Number(form.production) || 0) + (Number(form.transport) || 0);
    const selling = Number(form.selling) || 0;
    return { material, total, margin: selling - total };
  }, [form]);

  const selectMaterial = (id: string) => {
    const material = materials.find((item) => item.id === id);
    setForm((current) => ({ ...current, materialId: id, product: current.product || material?.name || "" }));
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.product.trim() || preview.total <= 0 || !(Number(form.selling) > 0)) { setMessage("Isi nama barang, harga modal, dan harga jual terlebih dahulu."); return; }
    setSaving(true); setMessage("");
    const result = await supabase.from("product_hpp").upsert({
      workspace: UNIT, product_name: form.product.trim(), material_id: form.materialId || null,
      source_invoice_id: null, source_invoice_number: "", source_invoice_date: null,
      purchase_price: Number(form.purchase) || 0, material_length: Number(form.length) || 6,
      material_cost_per_meter: preview.material, coloring_cost: Number(form.coloring) || 0,
      labor_cost: Number(form.labor) || 0, production_cost: Number(form.production) || 0,
      transport_cost: Number(form.transport) || 0, total_cost_per_meter: preview.total,
      selling_price_per_meter: Number(form.selling), price_source: "manual", notes: "HPP Toto Sidoarjo", updated_by: user?.username || "",
    }, { onConflict: "workspace,product_name" });
    setSaving(false);
    if (result.error) { setMessage(`Gagal menyimpan HPP: ${result.error.message}`); return; }
    setMessage("HPP barang Sidoarjo berhasil disimpan.");
    setForm({ product: "", materialId: "", purchase: "", length: "6", coloring: "0", labor: "0", production: "0", transport: "0", selling: "" });
    void load();
  };

  return <main className="page-content" style={{ maxWidth: 1320, paddingTop: 28 }}>
    <div style={header}><div><div style={eyebrow}>GUDANG & PRODUKSI · TOTO SIDOARJO</div><h1 className="page-title-h1" style={{ marginBottom: 6 }}>HPP Barang</h1><p className="page-subtitle">Harga pokok cabang dihitung dari bahan, biaya proses, dan harga jual Sidoarjo saja.</p></div><button onClick={() => void load()} style={button}>↻ Muat ulang</button></div>
    {message && <div style={notice}>{message}</div>}
    <div style={cards}><Card label="Material cabang" value={String(materials.length)} /><Card label="Tagihan bahan" value={String(bills.length)} /><Card label="HPP tersimpan" value={String(records.length)} /><Card label="Sisa tagihan bahan" value={money(bills.reduce((sum, item) => sum + Math.max(0, Number(item.grand_total) - Number(item.paid_amount)), 0))} /></div>
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(340px, .85fr)", gap: 16, marginTop: 18 }}>
      <form onSubmit={save} style={panel}><h2 style={heading}>Hitung & simpan HPP barang</h2><p style={subtle}>Komponen ini tidak mengambil harga atau transaksi Toto Pusat.</p>
        <div style={grid}><Field label="Material cabang"><select value={form.materialId} onChange={(e) => selectMaterial(e.target.value)} style={input}><option value="">Pilih dari stok bahan</option>{materials.map((item) => <option value={item.id} key={item.id}>{item.code ? `${item.code} · ` : ""}{item.name}</option>)}</select></Field><Field label="Nama barang"><input value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} style={input} placeholder="Contoh: Kusen aluminium" /></Field><Field label="Harga beli / batang"><input type="number" min="0" value={form.purchase} onChange={(e) => setForm({ ...form, purchase: e.target.value })} style={input} /></Field><Field label="Panjang batang (meter)"><input type="number" min=".001" step=".001" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} style={input} /></Field><Field label="Pewarnaan / meter"><input type="number" min="0" value={form.coloring} onChange={(e) => setForm({ ...form, coloring: e.target.value })} style={input} /></Field><Field label="Tenaga kerja / meter"><input type="number" min="0" value={form.labor} onChange={(e) => setForm({ ...form, labor: e.target.value })} style={input} /></Field><Field label="Produksi / meter"><input type="number" min="0" value={form.production} onChange={(e) => setForm({ ...form, production: e.target.value })} style={input} /></Field><Field label="Transport / meter"><input type="number" min="0" value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} style={input} /></Field><Field label="Harga jual / meter"><input type="number" min="0" value={form.selling} onChange={(e) => setForm({ ...form, selling: e.target.value })} style={input} /></Field></div>
        <div style={calculation}><b>Modal bahan {money(preview.material)}/m</b><b>HPP {money(preview.total)}/m</b><b style={{ color: preview.margin < 0 ? "#B91C1C" : "#15803D" }}>Margin {money(preview.margin)}/m</b></div><button disabled={saving} style={{ ...button, border: 0, background: "#96633D", color: "white", marginTop: 14 }}>{saving ? "Menyimpan…" : "Simpan HPP Sidoarjo"}</button>
      </form>
      <section style={panel}><h2 style={heading}>Tagihan bahan terbaru</h2>{bills.length === 0 ? <Empty text="Belum ada tagihan bahan Sidoarjo." /> : <div style={{ overflow: "auto" }}><table style={table}><thead><tr><th style={th}>Tanggal</th><th style={th}>Supplier</th><th style={{ ...th, textAlign: "right" }}>Sisa</th></tr></thead><tbody>{bills.slice(0, 8).map((bill) => <tr key={bill.id}><td style={td}>{bill.tanggal}</td><td style={td}><b>{bill.supplier || "—"}</b><br/><small>{bill.no_invoice || "Tanpa nomor"}</small></td><td style={{ ...td, textAlign: "right" }}>{money(Math.max(0, Number(bill.grand_total) - Number(bill.paid_amount)))}</td></tr>)}</tbody></table></div>}</section>
    </div>
    <section style={{ ...panel, marginTop: 16 }}><h2 style={heading}>Daftar HPP tersimpan</h2>{loading ? <Empty text="Memuat data HPP…" /> : records.length === 0 ? <Empty text="Belum ada HPP barang Sidoarjo yang tersimpan." /> : <div style={{ overflow: "auto" }}><table style={table}><thead><tr><th style={th}>Barang</th><th style={{ ...th, textAlign: "right" }}>HPP / meter</th><th style={{ ...th, textAlign: "right" }}>Harga jual</th><th style={{ ...th, textAlign: "right" }}>Margin</th></tr></thead><tbody>{records.map((record) => <tr key={record.id}><td style={td}><b>{record.product_name}</b></td><td style={{ ...td, textAlign: "right" }}>{money(record.total_cost_per_meter)}</td><td style={{ ...td, textAlign: "right" }}>{money(record.selling_price_per_meter)}</td><td style={{ ...td, textAlign: "right", color: record.selling_price_per_meter - record.total_cost_per_meter < 0 ? "#B91C1C" : "#15803D", fontWeight: 800 }}>{money(record.selling_price_per_meter - record.total_cost_per_meter)}</td></tr>)}</tbody></table></div>}</section>
  </main>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label style={{ display: "grid", gap: 5, fontSize: 11, fontWeight: 800, color: "#6B574B", textTransform: "uppercase" }}>{label}{children}</label>; }
function Card({ label, value }: { label: string; value: string }) { return <div style={panel}><div style={eyebrow}>{label}</div><b style={{ fontSize: 20, color: "#3C2F2F" }}>{value}</b></div>; }
function Empty({ text }: { text: string }) { return <p style={{ color: "#7B6656", margin: "16px 0" }}>{text}</p>; }
const header: React.CSSProperties = { display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }; const eyebrow: React.CSSProperties = { color: "#A67B5B", fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 7 }; const panel: React.CSSProperties = { background: "#FFFDF9", border: "1px solid #E8DCCF", borderRadius: 12, padding: 18 }; const cards: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 18 }; const button: React.CSSProperties = { minHeight: 36, padding: "0 12px", border: "1px solid #D8C1AA", borderRadius: 7, background: "white", color: "#6B4423", fontWeight: 800, cursor: "pointer" }; const input: React.CSSProperties = { width: "100%", minHeight: 38, padding: "8px 10px", border: "1px solid #D8C1AA", borderRadius: 7, color: "#3C2F2F", background: "white" }; const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }; const heading: React.CSSProperties = { fontSize: 16, margin: 0, color: "#3C2F2F" }; const subtle: React.CSSProperties = { fontSize: 12, color: "#7B6656", margin: "6px 0 16px" }; const calculation: React.CSSProperties = { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16, padding: 12, borderRadius: 8, background: "#F5EBDD", fontSize: 12, color: "#5C4033" }; const table: React.CSSProperties = { borderCollapse: "collapse", width: "100%", fontSize: 12 }; const th: React.CSSProperties = { padding: "9px 8px", textAlign: "left", background: "#F5EBDD", color: "#6B4423", whiteSpace: "nowrap" }; const td: React.CSSProperties = { padding: "10px 8px", borderBottom: "1px solid #F0E7DE", color: "#514036" }; const notice: React.CSSProperties = { marginTop: 14, padding: 11, borderRadius: 8, background: "#FFF8E7", border: "1px solid #F0D28C", color: "#875F13", fontSize: 12 };
