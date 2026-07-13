"use client";
import { useState, useMemo, type CSSProperties } from "react";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";

interface HppCalc {
    id: string;
    product_name: string;
    market_cut_percent: number;
    current_price: number;
}
interface HppComponentRow {
    id: string;
    hpp_id: string;
    name: string;
    note: string | null;
    cost: number;
    sell_price: number;
}
type ComponentForm = { id: string; name: string; note: string; cost: number; sell_price: number };

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

const emptyComponent = (): ComponentForm => ({ id: crypto.randomUUID(), name: "", note: "", cost: 0, sell_price: 0 });
const defaultComponents = (): ComponentForm[] => [
    { ...emptyComponent(), name: "KUSEN BENDING" },
    { ...emptyComponent(), name: "KACA" },
    { ...emptyComponent(), name: "RAKIT" },
    { ...emptyComponent(), name: "ORNAMEN LURUS" },
    { ...emptyComponent(), name: "PALET" },
];

function calcTotals(components: { cost: number; sell_price: number }[], marketCutPercent: number, currentPrice: number) {
    const baseCost = components.reduce((s, c) => s + Number(c.cost || 0), 0);
    const baseSell = components.reduce((s, c) => s + Number(c.sell_price || 0), 0);
    const cutCost = (baseCost * marketCutPercent) / 100;
    const cutSell = (baseSell * marketCutPercent) / 100;
    const totalCost = baseCost + cutCost;
    const totalSell = baseSell + cutSell;
    return { totalCost, totalSell, margin: totalSell - totalCost, diff: currentPrice - totalCost };
}

export default function AlucurvHppPage() {
    const calcs = useAlucurvTable<HppCalc>("alu_hpp_calculations", "product_name");
    const comps = useAlucurvTable<HppComponentRow>("alu_hpp_components");

    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [productName, setProductName] = useState("");
    const [marketCut, setMarketCut] = useState(10);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [components, setComponents] = useState<ComponentForm[]>(defaultComponents());
    const [saving, setSaving] = useState(false);

    const componentsByCalc = useMemo(() => {
        const map = new Map<string, HppComponentRow[]>();
        for (const c of comps.rows) {
            const list = map.get(c.hpp_id) ?? [];
            list.push(c);
            map.set(c.hpp_id, list);
        }
        return map;
    }, [comps.rows]);

    const openNew = () => {
        setEditId(null);
        setProductName("");
        setMarketCut(10);
        setCurrentPrice(0);
        setComponents(defaultComponents());
        setOpen(true);
    };

    const openEdit = (calc: HppCalc) => {
        setEditId(calc.id);
        setProductName(calc.product_name);
        setMarketCut(Number(calc.market_cut_percent));
        setCurrentPrice(Number(calc.current_price));
        const existing = componentsByCalc.get(calc.id) ?? [];
        setComponents(
            existing.length > 0
                ? existing.map((c) => ({ id: c.id, name: c.name, note: c.note ?? "", cost: Number(c.cost), sell_price: Number(c.sell_price) }))
                : defaultComponents()
        );
        setOpen(true);
    };

    const setComponent = (idx: number, patch: Partial<ComponentForm>) =>
        setComponents((list) => list.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
    const removeComponent = (idx: number) => setComponents((list) => list.filter((_, i) => i !== idx));
    const addComponent = () => setComponents((list) => [...list, emptyComponent()]);

    const save = async () => {
        if (!productName.trim()) { alert("Isi nama produk dulu ya."); return; }
        setSaving(true);
        try {
            let hppId = editId;
            if (editId) {
                await calcs.updateRow(editId, { product_name: productName, market_cut_percent: marketCut, current_price: currentPrice });
                const old = componentsByCalc.get(editId) ?? [];
                for (const o of old) await comps.deleteRow(o.id);
            } else {
                hppId = crypto.randomUUID();
                await calcs.insertRow({ id: hppId, product_name: productName, market_cut_percent: marketCut, current_price: currentPrice });
            }
            const filled = components.filter((c) => c.name.trim());
            if (hppId && filled.length > 0) {
                await comps.insertRows(
                    filled.map((c) => ({ hpp_id: hppId, name: c.name, note: c.note || null, cost: c.cost, sell_price: c.sell_price }))
                );
            }
            setOpen(false);
        } finally {
            setSaving(false);
        }
    };

    // Komponen ikut terhapus otomatis lewat ON DELETE CASCADE di alu_hpp_components.
    const removeCalc = (id: string) => calcs.deleteRow(id);

    const formTotals = calcTotals(components, marketCut, currentPrice);

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>HPP Produk</h1>
                    <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 520 }}>
                        Kalkulator harga pokok penjualan per produk: komponen modal, potongan marketplace, dan margin.
                    </p>
                </div>
                <button onClick={openNew} style={primaryBtn}>+ Hitung Produk Baru</button>
            </div>

            {calcs.loading ? (
                <p style={{ fontSize: 13, color: "var(--text-med)" }}>Memuat...</p>
            ) : calcs.rows.length === 0 ? (
                <div style={cardStyle}>
                    <p style={{ fontSize: 13, color: "var(--text-med)" }}>Belum ada perhitungan HPP. Klik tombol di atas untuk mulai.</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
                    {calcs.rows.map((h) => {
                        const list = componentsByCalc.get(h.id) ?? [];
                        const t = calcTotals(list, Number(h.market_cut_percent), Number(h.current_price));
                        return (
                            <div key={h.id} style={cardStyle}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                                    <div>
                                        <h2 style={{ fontWeight: 700, fontSize: 15, color: "var(--text-dark)" }}>{h.product_name}</h2>
                                        <div style={{ fontSize: 11, color: "var(--text-med)" }}>Potongan marketplace {h.market_cut_percent}%</div>
                                    </div>
                                    <div style={{ display: "flex", gap: 10 }}>
                                        <button onClick={() => openEdit(h)} style={linkBtn}>Ubah</button>
                                        <button onClick={() => removeCalc(h.id)} style={{ ...linkBtn, color: "#DC2626" }}>Hapus</button>
                                    </div>
                                </div>
                                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                                    <thead>
                                        <tr style={{ borderBottom: "1px solid var(--border)" }}>
                                            <th style={thLeft}>Komponen</th>
                                            <th style={thRight}>Modal</th>
                                            <th style={thRight}>Harga Jual</th>
                                            <th style={thRight}>Margin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {list.map((c) => (
                                            <tr key={c.id} style={{ borderBottom: "1px solid var(--border-light)" }}>
                                                <td style={{ padding: "6px 4px" }}>
                                                    {c.name}
                                                    {c.note && <div style={{ fontSize: 10, color: "var(--text-med)" }}>{c.note}</div>}
                                                </td>
                                                <td style={tdRight}>{rupiah(Number(c.cost))}</td>
                                                <td style={tdRight}>{rupiah(Number(c.sell_price))}</td>
                                                <td style={{ ...tdRight, color: "#16A34A" }}>{rupiah(Number(c.sell_price) - Number(c.cost))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "var(--bg-secondary)", borderRadius: 8, padding: 12, fontSize: 12 }}>
                                    <div>Total Modal<div style={{ fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(t.totalCost)}</div></div>
                                    <div>Total Harga Jual<div style={{ fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(t.totalSell)}</div></div>
                                    <div>Total Margin<div style={{ fontWeight: 700, color: "#16A34A" }}>{rupiah(t.margin)}</div></div>
                                    <div>
                                        Harga Sekarang<div style={{ fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(Number(h.current_price))}</div>
                                        <span style={{
                                            display: "inline-block", marginTop: 4, fontSize: 10, fontWeight: 700,
                                            padding: "2px 8px", borderRadius: 99,
                                            background: t.diff >= 0 ? "#DCFCE7" : "#FEE2E2",
                                            color: t.diff >= 0 ? "#16A34A" : "#DC2626",
                                        }}>
                                            {t.diff >= 0 ? `untung ${rupiah(t.diff)} dari modal` : `di bawah modal ${rupiah(-t.diff)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {open && (
                <div style={overlayStyle} onClick={() => setOpen(false)}>
                    <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)", marginBottom: 16 }}>
                            {editId ? "Ubah Perhitungan HPP" : "Perhitungan HPP Baru"}
                        </h2>

                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10, marginBottom: 16 }}>
                            <div>
                                <label style={labelStyle}>Nama Produk</label>
                                <input value={productName} onChange={(e) => setProductName(e.target.value)} placeholder="contoh: KACAMATI D.60" style={inputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Potongan Marketplace (%)</label>
                                <input type="number" min={0} max={100} value={marketCut} onChange={(e) => setMarketCut(Number(e.target.value))} style={inputStyle} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 6, display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 28px", gap: 8, fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase" }}>
                            <span>Komponen</span><span>Keterangan</span><span>Modal</span><span>Harga Jual</span><span />
                        </div>
                        {components.map((c, i) => (
                            <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 100px 100px 28px", gap: 8, marginBottom: 8 }}>
                                <input value={c.name} onChange={(e) => setComponent(i, { name: e.target.value })} style={inputStyle} />
                                <input value={c.note} onChange={(e) => setComponent(i, { note: e.target.value })} placeholder="1,5 x 2pcs x 170.000" style={inputStyle} />
                                <input type="number" min={0} value={c.cost || ""} onChange={(e) => setComponent(i, { cost: Number(e.target.value) })} style={inputStyle} />
                                <input type="number" min={0} value={c.sell_price || ""} onChange={(e) => setComponent(i, { sell_price: Number(e.target.value) })} style={inputStyle} />
                                <button onClick={() => removeComponent(i)} style={{ border: "none", background: "none", color: "#DC2626", cursor: "pointer" }} aria-label="Hapus">✕</button>
                            </div>
                        ))}
                        <button onClick={addComponent} style={{ ...linkBtn, marginBottom: 16 }}>+ Tambah komponen</button>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                            <div>
                                <label style={labelStyle}>Harga Jual Sekarang di Marketplace (Rp)</label>
                                <input type="number" min={0} value={currentPrice || ""} onChange={(e) => setCurrentPrice(Number(e.target.value))} style={inputStyle} />
                            </div>
                            <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 12, fontSize: 12 }}>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total modal (+{marketCut}%)</span><strong>{rupiah(formTotals.totalCost)}</strong></div>
                                <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total harga jual</span><strong>{rupiah(formTotals.totalSell)}</strong></div>
                                <div style={{ display: "flex", justifyContent: "space-between", color: "#16A34A" }}><span>Margin</span><strong>{rupiah(formTotals.margin)}</strong></div>
                            </div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
                            <button onClick={() => setOpen(false)} style={ghostBtn}>Batal</button>
                            <button onClick={save} disabled={saving} style={primaryBtn}>{saving ? "Menyimpan..." : "Simpan"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const cardStyle: CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 12, padding: 16 };
const thLeft: CSSProperties = { textAlign: "left", padding: "4px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase" };
const thRight: CSSProperties = { ...thLeft, textAlign: "right" };
const tdRight: CSSProperties = { padding: "6px 4px", textAlign: "right", color: "var(--text-dark)" };
const linkBtn: CSSProperties = { background: "none", border: "none", color: "var(--primary-dark)", fontWeight: 600, fontSize: 12, cursor: "pointer" };
const primaryBtn: CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const ghostBtn: CSSProperties = { background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer", color: "var(--text-med)" };
const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", display: "block", marginBottom: 4 };
const inputStyle: CSSProperties = { width: "100%", fontSize: 12, padding: "7px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", color: "var(--text-dark)", boxSizing: "border-box" };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalStyle: CSSProperties = { background: "white", borderRadius: 16, padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" };
