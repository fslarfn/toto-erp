"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { AlertTriangle, Calculator, FileText, Package, Plus, RefreshCw, Save, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useStore } from "@/lib/store";
import { useTagihanBahan } from "@/lib/tagihan-bahan-store";
import { allocationPerMeter, calculateProductHpp, classifyHppExpense } from "@/lib/hpp/calculations";
import { HppProductRow, loadProductHpp, saveProductHpp } from "@/lib/hpp/store";
import { isMissingTaxSchema } from "@/lib/pajak/store";
import HppSalesRecognition from "@/components/hpp/HppSalesRecognition";

type PurchaseReference = {
  name: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchasePrice: number;
  materialLength: number;
  supplier: string;
};

type ProductDraft = {
  id?: string;
  productName: string;
  materialId: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  purchasePrice: number;
  materialLength: number;
  coloringCost: number;
  laborCost: number;
  productionCost: number;
  transportCost: number;
  sellingPrice: number;
  source: "invoice" | "manual";
  notes: string;
};

const ink = "#3C2F2F", med = "#7C685B", line = "#E6D5BE", soft = "#F6EEE6", accent = "#A67B5B", green = "#15803D";
const card: React.CSSProperties = { background: "white", border: `1px solid ${line}`, borderRadius: 10, padding: 15 };
const input: React.CSSProperties = { width: "100%", border: `1px solid ${line}`, borderRadius: 7, padding: "8px 9px", fontSize: 11, color: ink, background: "white" };
const rp = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const keyOf = (name: string) => name.trim().toLocaleLowerCase("id-ID");
const emptyDraft = (): ProductDraft => ({ productName: "", materialId: "", invoiceId: "", invoiceNumber: "", invoiceDate: "", purchasePrice: 0, materialLength: 6, coloringCost: 0, laborCost: 0, productionCost: 0, transportCost: 0, sellingPrice: 0, source: "manual", notes: "" });

export default function HppBarangPage() {
  const { user, hasAccess } = useAuth();
  const { materials, cashFlow } = useStore();
  const { tagihanList, loading: invoiceLoading } = useTagihanBahan();
  const [records, setRecords] = useState<HppProductRow[]>([]);
  const [draft, setDraft] = useState<ProductDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [schemaReady, setSchemaReady] = useState(true);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    loadProductHpp().then(rows => { if (!cancelled) { setRecords(rows); setSchemaReady(true); } })
      .catch(error => {
        if (!cancelled) {
          setSchemaReady(false);
          setMessage(isMissingTaxSchema(error) ? "Jalankan migrasi HPP Barang terlebih dahulu di Supabase." : "Data HPP barang belum dapat dimuat.");
        }
      });
    return () => { cancelled = true; };
  }, []);

  const latestPurchases = useMemo(() => {
    const map = new Map<string, PurchaseReference>();
    for (const invoice of [...tagihanList].sort((a, b) => b.tanggal.localeCompare(a.tanggal))) {
      for (const item of invoice.items) {
        const key = keyOf(item.namaBahan);
        if (!key || map.has(key)) continue;
        map.set(key, {
          name: item.namaBahan,
          invoiceId: invoice.id,
          invoiceNumber: invoice.noInvoice,
          invoiceDate: invoice.tanggal.slice(0, 10),
          purchasePrice: Number(item.hargaSatuan),
          materialLength: Number(item.ukuran) > 0 ? Number(item.ukuran) : 6,
          supplier: invoice.supplier,
        });
      }
    }
    return map;
  }, [tagihanList]);

  const catalog = useMemo(() => {
    const map = new Map<string, { name: string; materialId: string; category: string }>();
    for (const material of materials) {
      if (!material.name.trim()) continue;
      map.set(keyOf(material.name), { name: material.name, materialId: material.id, category: material.category });
    }
    for (const purchase of latestPurchases.values()) {
      if (!map.has(keyOf(purchase.name))) map.set(keyOf(purchase.name), { name: purchase.name, materialId: "", category: "Tagihan Bahan" });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "id"));
  }, [materials, latestPurchases]);

  const savedByName = useMemo(() => new Map(records.map(record => [keyOf(record.product_name), record])), [records]);
  const currentLatest = latestPurchases.get(keyOf(draft.productName));
  const suggestedCosts = useMemo(() => {
    const now = new Date();
    const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = (draft.invoiceDate || currentLatest?.invoiceDate || defaultPeriod).slice(0, 7);
    const totalMeters = tagihanList.filter(invoice => invoice.tanggal.startsWith(period)).reduce(
      (sum, invoice) => sum + invoice.items.reduce((subtotal, item) => subtotal + Number(item.qty || 0) * (Number(item.ukuran) > 0 ? Number(item.ukuran) : 6), 0),
      0,
    );
    const totals = { coloring: 0, production: 0, transport: 0 };
    const counts = { coloring: 0, production: 0, transport: 0 };
    for (const row of cashFlow) {
      if (row.type !== "expense" || row.isTest || row.isAdjustment || row.transferGroup || !row.date.startsWith(period)) continue;
      const classification = classifyHppExpense(row.category, row.description);
      if (!classification) continue;
      totals[classification] += row.amount;
      counts[classification] += 1;
    }
    return {
      period,
      totalMeters,
      coloringCost: allocationPerMeter(totals.coloring, totalMeters),
      productionCost: allocationPerMeter(totals.production, totalMeters),
      transportCost: allocationPerMeter(totals.transport, totalMeters),
      totals,
      counts,
    };
  }, [cashFlow, tagihanList, draft.invoiceDate, currentLatest?.invoiceDate]);
  const result = useMemo(() => calculateProductHpp({
    purchasePrice: draft.purchasePrice,
    materialLength: draft.materialLength,
    coloringCost: draft.coloringCost,
    laborCost: draft.laborCost,
    productionCost: draft.productionCost,
    transportCost: draft.transportCost,
    sellingPrice: draft.sellingPrice,
  }), [draft]);

  const catalogRows = useMemo(() => catalog.filter(item => item.name.toLowerCase().includes(search.toLowerCase())).map(item => ({
    ...item,
    purchase: latestPurchases.get(keyOf(item.name)),
    saved: savedByName.get(keyOf(item.name)),
  })), [catalog, latestPurchases, savedByName, search]);

  const manualOnlyRows = useMemo(() => records.filter(record => !catalog.some(item => keyOf(item.name) === keyOf(record.product_name)) && record.product_name.toLowerCase().includes(search.toLowerCase())), [records, catalog, search]);

  const chooseProduct = (name: string) => {
    const product = catalog.find(item => keyOf(item.name) === keyOf(name));
    const saved = savedByName.get(keyOf(name));
    const latest = latestPurchases.get(keyOf(name));

    if (saved) {
      setDraft({
        id: saved.id,
        productName: saved.product_name,
        materialId: saved.material_id || product?.materialId || "",
        invoiceId: saved.source_invoice_id || "",
        invoiceNumber: saved.source_invoice_number,
        invoiceDate: saved.source_invoice_date || "",
        purchasePrice: Number(saved.purchase_price),
        materialLength: Number(saved.material_length),
        coloringCost: Number(saved.coloring_cost),
        laborCost: Number(saved.labor_cost),
        productionCost: Number(saved.production_cost),
        transportCost: Number(saved.transport_cost),
        sellingPrice: Number(saved.selling_price_per_meter),
        source: saved.price_source,
        notes: saved.notes,
      });
      return;
    }

    setDraft({
      ...emptyDraft(),
      productName: product?.name || name,
      materialId: product?.materialId || "",
      invoiceId: latest?.invoiceId || "",
      invoiceNumber: latest?.invoiceNumber || "",
      invoiceDate: latest?.invoiceDate || "",
      purchasePrice: latest?.purchasePrice || 0,
      materialLength: latest?.materialLength || 6,
      source: latest ? "invoice" : "manual",
    });
  };

  const refreshLatestPrice = () => {
    if (!currentLatest) { setMessage("Barang ini belum ditemukan di Tagihan Bahan Baku. Silakan isi harga modal secara manual."); return; }
    setDraft(current => ({
      ...current,
      invoiceId: currentLatest.invoiceId,
      invoiceNumber: currentLatest.invoiceNumber,
      invoiceDate: currentLatest.invoiceDate,
      purchasePrice: currentLatest.purchasePrice,
      materialLength: currentLatest.materialLength,
      source: "invoice",
    }));
  };

  const save = () => startTransition(async () => {
    if (!schemaReady) { setMessage("Migrasi HPP Barang belum dijalankan."); return; }
    if (!draft.productName.trim()) { setMessage("Isi nama barang terlebih dahulu."); return; }
    if (draft.purchasePrice <= 0 || draft.materialLength <= 0) { setMessage("Harga modal dan panjang bahan harus lebih dari nol."); return; }

    try {
      const record = await saveProductHpp({
        ...(draft.id ? { id: draft.id } : {}),
        workspace: "toto",
        product_name: draft.productName.trim(),
        material_id: draft.materialId || null,
        source_invoice_id: draft.source === "invoice" ? draft.invoiceId || null : null,
        source_invoice_number: draft.source === "invoice" ? draft.invoiceNumber : "",
        source_invoice_date: draft.source === "invoice" ? draft.invoiceDate || null : null,
        purchase_price: result.purchasePrice,
        material_length: result.materialLength,
        material_cost_per_meter: result.materialCostPerMeter,
        coloring_cost: result.coloringCost,
        labor_cost: result.laborCost,
        production_cost: result.productionCost,
        transport_cost: result.transportCost,
        total_cost_per_meter: result.totalCostPerMeter,
        selling_price_per_meter: result.sellingPrice,
        price_source: draft.source,
        notes: draft.notes,
        updated_by: user?.username || "",
      });
      setRecords(current => [record, ...current.filter(item => item.id !== record.id && keyOf(item.product_name) !== keyOf(record.product_name))].sort((a, b) => a.product_name.localeCompare(b.product_name, "id")));
      setDraft(current => ({ ...current, id: record.id }));
      setMessage(`HPP ${record.product_name} berhasil disimpan.`);
    } catch (error) { setMessage(`Gagal menyimpan HPP: ${(error as { message?: string }).message || "kesalahan database"}`); }
  });

  if (user?.role !== "owner" && !hasAccess("pajak")) return <div style={{ padding: 24 }}><div style={card}>Anda tidak memiliki akses ke HPP Barang.</div></div>;

  return <div style={{ padding: "20px 24px 36px", color: ink, maxWidth: 1500, margin: "0 auto" }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 15 }}><div><h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>HPP Barang</h1><p style={{ fontSize: 11, color: med, margin: "4px 0 0" }}>Harga modal per meter berdasarkan invoice bahan terbaru, ditambah biaya produksi per barang.</p></div><button onClick={() => setDraft(emptyDraft())} style={{ border: 0, borderRadius: 7, background: accent, color: "white", padding: "9px 12px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Plus size={14}/>Barang manual</button></div>

    {message ? <div role="status" style={{ display: "flex", alignItems: "center", gap: 7, padding: 10, border: "1px solid #F3D08B", background: "#FFF9E8", borderRadius: 8, color: "#875F13", marginBottom: 12, fontSize: 11 }}><AlertTriangle size={15}/><span>{message}</span><button onClick={() => setMessage("")} style={{ border: 0, marginLeft: "auto", background: "transparent", cursor: "pointer" }}>Tutup</button></div> : null}

    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 10, marginBottom: 14 }}>{[["Barang tersedia", catalog.length], ["Ada harga invoice", latestPurchases.size], ["HPP sudah disimpan", records.length], ["Perlu harga manual", catalog.filter(item => !latestPurchases.has(keyOf(item.name))).length]].map(([label, value]) => <div key={String(label)} style={{ ...card, padding: 12 }}><div style={{ fontSize: 10, color: med, fontWeight: 700 }}>{label}</div><div style={{ marginTop: 7, fontSize: 17, fontWeight: 800 }}>{value}</div></div>)}</div>

    <div className="grid grid-cols-1 xl:grid-cols-2" style={{ gap: 12, alignItems: "start" }}><section style={card}><div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}><Calculator size={17} color={accent}/><h2 style={{ fontSize: 14, margin: 0 }}>Perhitungan HPP per barang</h2></div>

      <label style={{ display: "grid", gap: 5, color: med, fontSize: 10, fontWeight: 700, marginBottom: 10 }}>Pilih barang dari stok / invoice<select value={catalog.some(item => keyOf(item.name) === keyOf(draft.productName)) ? draft.productName : ""} onChange={event => chooseProduct(event.target.value)} style={input}><option value="">{invoiceLoading ? "Memuat bahan dan invoice..." : "Pilih barang atau isi manual"}</option>{catalog.map(item => <option key={`${item.materialId}:${item.name}`} value={item.name}>{item.name}{latestPurchases.has(keyOf(item.name)) ? " · ada harga invoice" : " · harga manual"}</option>)}</select></label>

      <label style={{ display: "grid", gap: 5, color: med, fontSize: 10, fontWeight: 700, marginBottom: 12 }}>Nama barang<input style={input} value={draft.productName} onChange={event => setDraft(current => ({ ...current, productName: event.target.value, source: "manual" }))} placeholder={'Contoh: Kusen M 4"'}/></label>

      <div style={{ border: `1px solid ${line}`, borderRadius: 8, padding: 11, marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 7, marginBottom: 9 }}><h3 style={{ margin: 0, fontSize: 12 }}>1. Harga modal bahan</h3>{currentLatest ? <button onClick={refreshLatestPrice} style={{ display: "flex", gap: 4, alignItems: "center", border: `1px solid ${line}`, background: "white", color: accent, borderRadius: 6, padding: "5px 7px", fontSize: 9, fontWeight: 700, cursor: "pointer" }}><RefreshCw size={12}/>Harga invoice terbaru</button> : null}</div>

        {currentLatest ? <div style={{ padding: 8, background: "#F0FBF3", color: green, borderRadius: 6, fontSize: 10, display: "flex", alignItems: "center", gap: 5, marginBottom: 9 }}><FileText size={13}/>Invoice {currentLatest.invoiceNumber || "-"} · {currentLatest.invoiceDate} · {currentLatest.supplier || "Supplier"}</div> : <div style={{ padding: 8, background: "#FFF9E8", color: "#875F13", borderRadius: 6, fontSize: 10, marginBottom: 9 }}>Harga barang belum ada di Tagihan Bahan Baku. Admin dapat mengisi harga modal secara manual.</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 9 }}><label style={{ fontSize: 10, fontWeight: 700, color: med }}>Harga beli per batang<input min="0" type="number" style={{ ...input, marginTop: 4 }} value={draft.purchasePrice || ""} onChange={event => setDraft(current => ({ ...current, purchasePrice: Number(event.target.value), source: "manual" }))} placeholder="Contoh: 558378"/></label><label style={{ fontSize: 10, fontWeight: 700, color: med }}>Panjang batang (meter)<input min="0.001" step="0.001" type="number" style={{ ...input, marginTop: 4 }} value={draft.materialLength || ""} onChange={event => setDraft(current => ({ ...current, materialLength: Number(event.target.value), source: "manual" }))}/></label></div>

        <div style={{ marginTop: 9, padding: "8px 9px", background: soft, borderRadius: 6, fontSize: 11, color: ink }}><b>{rp(result.purchasePrice)}</b> ÷ <b>{result.materialLength} meter</b> = <b style={{ color: green }}>{rp(result.materialCostPerMeter)} / meter</b></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))", gap: 9 }}>{([["coloringCost", "2. Biaya pewarnaan / meter", "coloring"], ["laborCost", "3. Biaya karyawan / meter", null], ["productionCost", "4. Ongkos produksi / meter", "production"], ["transportCost", "5. Ongkos jalan / meter", "transport"]] as const).map(([key, label, classification]) => <label key={key} style={{ color: med, fontSize: 10, fontWeight: 700 }}>{label}<div style={{ display: "flex", gap: 5, marginTop: 4 }}><input min="0" type="number" style={input} value={draft[key] || ""} onChange={event => setDraft(current => ({ ...current, [key]: Number(event.target.value) }))}/>{classification ? <button type="button" disabled={suggestedCosts.totalMeters <= 0 || suggestedCosts.counts[classification] === 0} title={suggestedCosts.counts[classification] ? `${rp(suggestedCosts.totals[classification])} ÷ ${suggestedCosts.totalMeters.toLocaleString("id-ID")} meter = ${rp(suggestedCosts[key])}/meter` : "Belum ada transaksi Keuangan yang sesuai"} onClick={() => setDraft(current => ({ ...current, [key]: suggestedCosts[key] }))} style={{ border: `1px solid ${line}`, background: suggestedCosts.counts[classification] ? "white" : soft, borderRadius: 6, color: accent, padding: "0 8px", fontSize: 9, fontWeight: 700, whiteSpace: "nowrap", cursor: suggestedCosts.counts[classification] ? "pointer" : "not-allowed" }}>Saran</button> : null}</div>{classification ? <span style={{ display: "block", marginTop: 4, color: med, fontSize: 9, fontWeight: 400 }}>{suggestedCosts.counts[classification] ? `Saran ${rp(suggestedCosts[key])}/m · ${suggestedCosts.counts[classification]} transaksi` : "Belum ada transaksi terkait"}</span> : null}</label>)}<label style={{ color: med, fontSize: 10, fontWeight: 700 }}>Harga jual / meter<input min="0" type="number" style={{ ...input, marginTop: 4 }} value={draft.sellingPrice || ""} onChange={event => setDraft(current => ({ ...current, sellingPrice: Number(event.target.value) }))}/></label><label style={{ color: med, fontSize: 10, fontWeight: 700 }}>Catatan<input style={{ ...input, marginTop: 4 }} value={draft.notes} onChange={event => setDraft(current => ({ ...current, notes: event.target.value }))} placeholder="Opsional"/></label></div>

      <div style={{ marginTop: 10, padding: "8px 9px", background: soft, borderRadius: 6, color: med, fontSize: 9, lineHeight: 1.5 }}>Dasar saran periode {suggestedCosts.period}: total bahan {suggestedCosts.totalMeters.toLocaleString("id-ID")} meter. Nominal diambil dari transaksi Keuangan dan dibagi total meter pembelian periode tersebut.</div>

      <div style={{ borderTop: `1px solid ${line}`, marginTop: 14, paddingTop: 10, display: "grid", gap: 7 }}>{[["Modal bahan per meter", rp(result.materialCostPerMeter)], ["Pewarnaan", rp(result.coloringCost)], ["Karyawan", rp(result.laborCost)], ["Produksi", rp(result.productionCost)], ["Ongkos jalan", rp(result.transportCost)], ["HPP barang per meter", rp(result.totalCostPerMeter)], ["Margin per meter", `${rp(result.marginPerMeter)} (${result.marginPercent.toFixed(1)}%)`]].map(([label, value]) => <div key={label} style={{ display: "flex", justifyContent: "space-between", color: label === "Margin per meter" && result.marginPerMeter < 0 ? "#B91C1C" : ink, fontSize: label === "HPP barang per meter" ? 13 : 10, fontWeight: label === "HPP barang per meter" || label === "Margin per meter" ? 800 : 500 }}><span>{label}</span><span>{value}</span></div>)}</div>

      <button disabled={pending || !schemaReady} onClick={save} style={{ marginTop: 14, marginLeft: "auto", border: 0, background: accent, color: "white", borderRadius: 7, padding: "9px 12px", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", opacity: pending || !schemaReady ? .6 : 1 }}><Save size={13}/>{pending ? "Menyimpan..." : "Simpan HPP barang"}</button>
      <p style={{ margin: "10px 0 0", fontSize: 9, color: med, lineHeight: 1.5 }}>Katalog HPP ini merupakan referensi harga per barang/meter dan tidak mengubah stok, jurnal, atau periode pajak secara otomatis.</p>
    </section>

    <section style={card}><div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 11 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><Package size={16} color={accent}/><h2 style={{ margin: 0, fontSize: 14 }}>Daftar barang & modal terbaru</h2></div><div style={{ position: "relative" }}><Search size={13} style={{ position: "absolute", left: 8, top: 8, color: med }}/><input value={search} onChange={event => setSearch(event.target.value)} style={{ ...input, width: 180, paddingLeft: 27 }} placeholder="Cari kusen / bahan"/></div></div>

      {!catalogRows.length && !manualOnlyRows.length ? <div style={{ padding: 25, textAlign: "center", color: med, fontSize: 11 }}>Belum ada barang atau tagihan bahan baku.</div> : <div style={{ display: "grid", gap: 8 }}>{catalogRows.map(item => {
        const purchasePrice = item.purchase?.purchasePrice || 0;
        const length = item.purchase?.materialLength || 6;
        const latestPerMeter = Math.round(purchasePrice / length);
        const outdated = !!item.saved && !!item.purchase && (Number(item.saved.purchase_price) !== purchasePrice || item.saved.source_invoice_id !== item.purchase.invoiceId);
        return <button key={`${item.materialId}:${item.name}`} onClick={() => chooseProduct(item.name)} style={{ border: `1px solid ${keyOf(draft.productName) === keyOf(item.name) ? accent : line}`, background: keyOf(draft.productName) === keyOf(item.name) ? "#FFFBF7" : "white", borderRadius: 8, padding: 10, textAlign: "left", cursor: "pointer" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 7 }}><b style={{ fontSize: 11, color: ink }}>{item.name}</b><span style={{ fontSize: 9, fontWeight: 700, color: item.saved ? green : item.purchase ? "#B45309" : med }}>{outdated ? "Harga invoice berubah" : item.saved ? "HPP tersimpan" : item.purchase ? "Ada harga invoice" : "Isi harga manual"}</span></div><div style={{ fontSize: 9, color: med, marginTop: 3 }}>{item.purchase ? `Invoice ${item.purchase.invoiceNumber || "-"} · ${item.purchase.invoiceDate} · ${length} meter` : item.category}</div><div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(85px,1fr))", gap: 6, marginTop: 9, fontSize: 9, color: med }}><span>Harga batang<br/><b style={{ color: ink }}>{item.purchase ? rp(purchasePrice) : item.saved ? rp(Number(item.saved.purchase_price)) : "Manual"}</b></span><span>Modal / meter<br/><b style={{ color: ink }}>{item.purchase ? rp(latestPerMeter) : item.saved ? rp(Number(item.saved.material_cost_per_meter)) : "-"}</b></span><span>HPP / meter<br/><b style={{ color: green }}>{item.saved ? rp(Number(item.saved.total_cost_per_meter)) : "Belum dihitung"}</b></span></div></button>;
      })}{manualOnlyRows.map(record => <button key={record.id} onClick={() => chooseProduct(record.product_name)} style={{ border: `1px solid ${line}`, borderRadius: 8, padding: 10, textAlign: "left", background: "white", cursor: "pointer" }}><b style={{ fontSize: 11, color: ink }}>{record.product_name}</b><div style={{ marginTop: 5, fontSize: 10, color: med }}>Harga manual · Modal {rp(Number(record.material_cost_per_meter))} / meter · HPP {rp(Number(record.total_cost_per_meter))} / meter</div></button>)}</div>}

      <div style={{ marginTop: 12, background: soft, padding: 9, borderRadius: 7, color: med, lineHeight: 1.6, fontSize: 9 }}>Sistem menggunakan harga satuan dari invoice pembelian paling baru. Bila panjang bahan 6 meter, harga batang otomatis dibagi 6; panjang lain mengikuti ukuran pada invoice.</div>
    </section></div>
    <HppSalesRecognition/>
  </div>;
}
