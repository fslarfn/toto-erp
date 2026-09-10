"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronDown, ChevronRight, History, Save, Trash2 } from "lucide-react";
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

type ComponentForm = {
    id: string;
    name: string;
    note: string;
    cost: number;
    sell_price: number;
    required?: boolean;
};

type HppDraft = {
    editId: string | null;
    productName: string;
    marketCut: number;
    currentPrice: number;
    components: ComponentForm[];
    savedAt: string;
};

type HistorySuggestion = {
    id: string;
    productName: string;
    note: string;
    cost: number;
    sellPrice: number;
};

const DRAFT_KEY = "alucurv-hpp-product-draft-v2";
const REQUIRED_COMPONENTS = ["KUSEN BENDING", "KACA", "RAKIT", "ORNAMEN LURUS", "WARNA", "PACKING + ACC"];

const rupiah = (value: number) => `Rp ${Math.round(value).toLocaleString("id-ID")}`;
const normalize = (value: string) => value.trim().toLocaleUpperCase("id-ID");
const emptyComponent = (name = "", required = false): ComponentForm => ({
    id: crypto.randomUUID(), name, note: "", cost: 0, sell_price: 0, required,
});
const defaultComponents = () => REQUIRED_COMPONENTS.map((name) => emptyComponent(name, true));

function mergeWithRequiredComponents(rows: HppComponentRow[]): ComponentForm[] {
    const unused = [...rows];
    const required = REQUIRED_COMPONENTS.map((name) => {
        const index = unused.findIndex((row) => normalize(row.name) === normalize(name));
        if (index < 0) return emptyComponent(name, true);
        const [row] = unused.splice(index, 1);
        return { id: row.id, name, note: row.note ?? "", cost: Number(row.cost), sell_price: Number(row.sell_price), required: true };
    });
    return [...required, ...unused.map((row) => ({
        id: row.id, name: row.name, note: row.note ?? "", cost: Number(row.cost), sell_price: Number(row.sell_price), required: false,
    }))];
}

function calcTotals(components: { cost: number; sell_price: number }[], marketCutPercent: number, currentPrice: number) {
    const baseCost = components.reduce((sum, component) => sum + Number(component.cost || 0), 0);
    const baseSell = components.reduce((sum, component) => sum + Number(component.sell_price || 0), 0);
    const totalCost = baseCost + (baseCost * marketCutPercent) / 100;
    const totalSell = baseSell + (baseSell * marketCutPercent) / 100;
    return { totalCost, totalSell, margin: totalSell - totalCost, diff: currentPrice - totalCost };
}

export default function AlucurvHppPage() {
    const calcs = useAlucurvTable<HppCalc>("alu_hpp_calculations", "product_name");
    const comps = useAlucurvTable<HppComponentRow>("alu_hpp_components");
    const [open, setOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [productName, setProductName] = useState("");
    const [marketCut, setMarketCut] = useState(10);
    const [currentPrice, setCurrentPrice] = useState(0);
    const [components, setComponents] = useState<ComponentForm[]>(defaultComponents());
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [draftAvailable, setDraftAvailable] = useState(false);
    const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);

    const componentsByCalc = useMemo(() => {
        const map = new Map<string, HppComponentRow[]>();
        for (const component of comps.rows) {
            const list = map.get(component.hpp_id) ?? [];
            list.push(component);
            map.set(component.hpp_id, list);
        }
        return map;
    }, [comps.rows]);

    const calcNames = useMemo(() => new Map(calcs.rows.map((calc) => [calc.id, calc.product_name])), [calcs.rows]);
    const historyByComponent = useMemo(() => {
        const map = new Map<string, HistorySuggestion[]>();
        for (const component of comps.rows) {
            if (!component.note?.trim()) continue;
            const key = normalize(component.name);
            const list = map.get(key) ?? [];
            list.push({
                id: component.id,
                productName: calcNames.get(component.hpp_id) ?? "Produk sebelumnya",
                note: component.note.trim(),
                cost: Number(component.cost),
                sellPrice: Number(component.sell_price),
            });
            map.set(key, list);
        }
        return map;
    }, [calcNames, comps.rows]);

    const visibleCalcs = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("id-ID");
        return query ? calcs.rows.filter((hpp) => hpp.product_name.toLocaleLowerCase("id-ID").includes(query)) : calcs.rows;
    }, [calcs.rows, search]);

    useEffect(() => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (!saved) return;
            const draft = JSON.parse(saved) as HppDraft;
            if (!draft.components?.length) return;
            setDraftAvailable(true);
            setDraftSavedAt(draft.savedAt);
        } catch {
            localStorage.removeItem(DRAFT_KEY);
        }
    }, []);

    useEffect(() => {
        if (!open) return;
        const timer = window.setTimeout(() => {
            const draft: HppDraft = { editId, productName, marketCut, currentPrice, components, savedAt: new Date().toISOString() };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
            setDraftAvailable(true);
            setDraftSavedAt(draft.savedAt);
        }, 450);
        return () => window.clearTimeout(timer);
    }, [components, currentPrice, editId, marketCut, open, productName]);

    const restoreDraft = () => {
        try {
            const saved = localStorage.getItem(DRAFT_KEY);
            if (!saved) return false;
            const draft = JSON.parse(saved) as HppDraft;
            setEditId(draft.editId ?? null);
            setProductName(draft.productName ?? "");
            setMarketCut(Number(draft.marketCut ?? 10));
            setCurrentPrice(Number(draft.currentPrice ?? 0));
            setComponents(draft.components?.length ? draft.components : defaultComponents());
            setDraftSavedAt(draft.savedAt ?? null);
            setOpen(true);
            return true;
        } catch {
            localStorage.removeItem(DRAFT_KEY);
            setDraftAvailable(false);
            return false;
        }
    };

    const clearDraft = () => {
        localStorage.removeItem(DRAFT_KEY);
        setDraftAvailable(false);
        setDraftSavedAt(null);
    };

    const openNew = () => {
        if (draftAvailable && restoreDraft()) return;
        setEditId(null);
        setProductName("");
        setMarketCut(10);
        setCurrentPrice(0);
        setComponents(defaultComponents());
        setOpen(true);
    };

    const openEdit = (calc: HppCalc) => {
        if (draftAvailable && !window.confirm("Ada draft HPP yang belum disimpan. Ganti draft dengan produk ini?")) return;
        clearDraft();
        setEditId(calc.id);
        setProductName(calc.product_name);
        setMarketCut(Number(calc.market_cut_percent));
        setCurrentPrice(Number(calc.current_price));
        setComponents(mergeWithRequiredComponents(componentsByCalc.get(calc.id) ?? []));
        setOpen(true);
    };

    const setComponent = (index: number, patch: Partial<ComponentForm>) =>
        setComponents((list) => list.map((component, componentIndex) => componentIndex === index ? { ...component, ...patch } : component));
    const removeComponent = (index: number) => setComponents((list) => list.filter((_, componentIndex) => componentIndex !== index));
    const addComponent = () => setComponents((list) => [...list, emptyComponent()]);

    const suggestionsFor = (component: ComponentForm) => {
        const query = component.note.trim().toLocaleLowerCase("id-ID");
        if (!query) return [];
        const suggestions = historyByComponent.get(normalize(component.name)) ?? [];
        const unique = new Set<string>();
        return suggestions.filter((suggestion) => {
            if (suggestion.id === component.id || !suggestion.note.toLocaleLowerCase("id-ID").includes(query)) return false;
            const key = `${suggestion.note}|${suggestion.cost}|${suggestion.sellPrice}`;
            if (unique.has(key)) return false;
            unique.add(key);
            return true;
        }).slice(0, 4);
    };

    const save = async () => {
        if (!productName.trim()) {
            alert("Isi nama produk terlebih dahulu.");
            return;
        }
        setSaving(true);
        try {
            let hppId = editId;
            if (editId) {
                const updateError = await calcs.updateRow(editId, { product_name: productName.trim(), market_cut_percent: marketCut, current_price: currentPrice });
                if (updateError) throw updateError;
                const old = componentsByCalc.get(editId) ?? [];
                for (const oldComponent of old) {
                    const deleteError = await comps.deleteRow(oldComponent.id);
                    if (deleteError) throw deleteError;
                }
            } else {
                hppId = crypto.randomUUID();
                const insertError = await calcs.insertRow({ id: hppId, product_name: productName.trim(), market_cut_percent: marketCut, current_price: currentPrice });
                if (insertError) throw insertError;
            }
            const filled = components.filter((component) => component.name.trim());
            if (hppId && filled.length > 0) {
                const componentError = await comps.insertRows(filled.map((component) => ({
                    hpp_id: hppId,
                    name: component.name.trim(),
                    note: component.note.trim() || null,
                    cost: component.cost,
                    sell_price: component.sell_price,
                })));
                if (componentError) throw componentError;
            }
            clearDraft();
            setOpen(false);
        } catch (error) {
            const message = typeof error === "object" && error && "message" in error ? String(error.message) : "periksa koneksi dan coba lagi";
            alert(`HPP belum tersimpan: ${message}. Draft tetap aman di perangkat ini.`);
        } finally {
            setSaving(false);
        }
    };

    const removeCalc = async (id: string) => {
        if (!window.confirm("Hapus perhitungan HPP produk ini?")) return;
        const error = await calcs.deleteRow(id);
        if (error) alert(`Data belum terhapus: ${error.message}`);
    };

    const formTotals = calcTotals(components, marketCut, currentPrice);
    const formattedDraftTime = draftSavedAt ? new Date(draftSavedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "baru saja";

    return (
        <div style={{ padding: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                <div>
                    <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Kalkulator HPP</h1>
                    <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 640 }}>Perhitungan HPP per produk dalam tampilan baris. Draft tersimpan otomatis di perangkat ini.</p>
                </div>
                <button onClick={openNew} style={primaryBtn}>{draftAvailable ? "Lanjutkan Draft" : "+ Hitung Produk Baru"}</button>
            </div>

            {draftAvailable && !open && (
                <div role="status" style={draftBannerStyle}>
                    <div><strong>Draft HPP belum disimpan</strong><span style={{ display: "block", marginTop: 2, fontSize: 11, color: "var(--text-med)" }}>Tersimpan otomatis {formattedDraftTime}</span></div>
                    <div style={{ display: "flex", gap: 8 }}><button onClick={restoreDraft} style={smallPrimaryBtn}>Lanjutkan</button><button onClick={clearDraft} style={smallGhostBtn}>Hapus draft</button></div>
                </div>
            )}

            <div style={{ marginBottom: 14, maxWidth: 360 }}>
                <label htmlFor="hpp-search" style={visuallyHidden}>Cari nama produk</label>
                <input id="hpp-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama produk..." style={inputStyle} />
            </div>

            {calcs.error || comps.error ? (
                <div role="alert" style={{ ...cardStyle, color: "#B91C1C" }}>Data HPP belum dapat dimuat. {calcs.error || comps.error}</div>
            ) : calcs.loading || comps.loading ? (
                <div style={cardStyle}>Memuat data HPP...</div>
            ) : calcs.rows.length === 0 ? (
                <div style={cardStyle}>Belum ada perhitungan HPP. Klik tombol Hitung Produk Baru untuk memulai.</div>
            ) : visibleCalcs.length === 0 ? (
                <div style={cardStyle}>Tidak ada produk yang cocok dengan pencarian.</div>
            ) : (
                <section style={sheetStyle} aria-label="Daftar HPP produk">
                    <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", minWidth: 1160, borderCollapse: "separate", borderSpacing: 0, fontSize: 12 }}>
                            <thead><tr>
                                <th style={{ ...sheetHeader, width: 44 }}>No.</th><th style={{ ...sheetHeader, minWidth: 230, textAlign: "left" }}>Nama Produk</th><th style={sheetHeader}>Komponen</th><th style={sheetHeader}>Potongan</th><th style={sheetHeader}>Total Modal</th><th style={sheetHeader}>Harga Jual</th><th style={sheetHeader}>Harga Marketplace</th><th style={sheetHeader}>Margin Komponen</th><th style={sheetHeader}>Selisih Harga</th><th style={{ ...sheetHeader, width: 130 }}>Aksi</th>
                            </tr></thead>
                            <tbody>{visibleCalcs.map((hpp, index) => {
                                const list = componentsByCalc.get(hpp.id) ?? [];
                                const totals = calcTotals(list, Number(hpp.market_cut_percent), Number(hpp.current_price));
                                const expanded = expandedId === hpp.id;
                                return <HppTableRows key={hpp.id} index={index} hpp={hpp} components={list} totals={totals} expanded={expanded} onToggle={() => setExpandedId(expanded ? null : hpp.id)} onEdit={() => openEdit(hpp)} onDelete={() => removeCalc(hpp.id)} />;
                            })}</tbody>
                        </table>
                    </div>
                </section>
            )}

            {open && (
                <div style={overlayStyle} onClick={() => setOpen(false)}>
                    <div role="dialog" aria-modal="true" aria-labelledby="hpp-dialog-title" style={modalStyle} onClick={(event) => event.stopPropagation()}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                            <div>
                                <h2 id="hpp-dialog-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-dark)", margin: 0 }}>{editId ? "Ubah Perhitungan HPP" : "Perhitungan HPP Baru"}</h2>
                                <div style={{ marginTop: 4, fontSize: 11, color: "#15803D", display: "flex", alignItems: "center", gap: 5 }}><Save size={13} /> Draft tersimpan otomatis</div>
                            </div>
                            <button onClick={() => setOpen(false)} style={closeBtn} aria-label="Tutup dan simpan sebagai draft">Tutup</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr]" style={{ gap: 10, marginBottom: 14 }}>
                            <div><label style={labelStyle}>Nama Produk</label><input value={productName} onChange={(event) => setProductName(event.target.value)} placeholder="Contoh: KACAMATI D.60" style={inputStyle} /></div>
                            <div><label style={labelStyle}>Potongan Marketplace (%)</label><input type="number" min={0} max={100} value={marketCut} onChange={(event) => setMarketCut(Number(event.target.value))} style={inputStyle} /></div>
                        </div>

                        <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                            <table style={{ width: "100%", minWidth: 790, borderCollapse: "collapse", fontSize: 12 }}>
                                <thead><tr><th style={{ ...editorHeader, minWidth: 170 }}>Komponen</th><th style={{ ...editorHeader, minWidth: 250 }}>Keterangan / ukuran</th><th style={{ ...editorHeader, width: 135 }}>Modal</th><th style={{ ...editorHeader, width: 135 }}>Harga Jual</th><th style={{ ...editorHeader, width: 48 }} aria-label="Aksi" /></tr></thead>
                                <tbody>{components.map((component, index) => {
                                    const suggestions = suggestionsFor(component);
                                    return (
                                        <tr key={component.id} style={{ verticalAlign: "top", borderBottom: "1px solid var(--border-light)" }}>
                                            <td style={editorCell}>
                                                <input value={component.name} readOnly={component.required} onChange={(event) => setComponent(index, { name: event.target.value })} style={{ ...inputStyle, background: component.required ? "var(--bg-secondary)" : "white", fontWeight: component.required ? 700 : 400 }} />
                                                {component.required && <span style={fixedLabel}>Komponen tetap</span>}
                                            </td>
                                            <td style={editorCell}>
                                                <input value={component.note} onChange={(event) => setComponent(index, { note: event.target.value })} placeholder="Contoh: 1,5 x 2 pcs" style={inputStyle} />
                                                {suggestions.length > 0 && <div style={historyBox}>
                                                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4, fontWeight: 700, color: "var(--text-med)" }}><History size={12} /> Riwayat hitungan</div>
                                                    {suggestions.map((suggestion) => <button key={suggestion.id} type="button" onClick={() => setComponent(index, { note: suggestion.note, cost: suggestion.cost, sell_price: suggestion.sellPrice })} style={historyButton}><span>{suggestion.note} <small>{suggestion.productName}</small></span><strong>{rupiah(suggestion.cost)} / {rupiah(suggestion.sellPrice)}</strong></button>)}
                                                </div>}
                                            </td>
                                            <td style={editorCell}><input aria-label={`Modal ${component.name}`} type="number" min={0} value={component.cost || ""} onChange={(event) => setComponent(index, { cost: Number(event.target.value) })} style={{ ...inputStyle, textAlign: "right" }} /></td>
                                            <td style={editorCell}><input aria-label={`Harga jual ${component.name}`} type="number" min={0} value={component.sell_price || ""} onChange={(event) => setComponent(index, { sell_price: Number(event.target.value) })} style={{ ...inputStyle, textAlign: "right" }} /></td>
                                            <td style={{ ...editorCell, textAlign: "center" }}>{component.required ? <span style={{ fontSize: 10, color: "var(--text-med)" }}>Tetap</span> : <button type="button" onClick={() => removeComponent(index)} style={deleteIconBtn} aria-label={`Hapus komponen ${component.name || "tambahan"}`}><Trash2 size={15} /></button>}</td>
                                        </tr>
                                    );
                                })}</tbody>
                            </table>
                        </div>
                        <button type="button" onClick={addComponent} style={{ ...smallGhostBtn, marginTop: 10 }}>+ Tambah komponen</button>

                        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12, marginTop: 14 }}>
                            <div><label style={labelStyle}>Harga Jual Sekarang di Marketplace (Rp)</label><input type="number" min={0} value={currentPrice || ""} onChange={(event) => setCurrentPrice(Number(event.target.value))} style={inputStyle} /></div>
                            <div style={totalsStyle}><div style={totalLine}><span>Total modal (+{marketCut}%)</span><strong>{rupiah(formTotals.totalCost)}</strong></div><div style={totalLine}><span>Total harga jual</span><strong>{rupiah(formTotals.totalSell)}</strong></div><div style={{ ...totalLine, color: formTotals.margin < 0 ? "#B91C1C" : "#15803D" }}><span>Margin</span><strong>{rupiah(formTotals.margin)}</strong></div></div>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                            <button onClick={() => setOpen(false)} style={ghostBtn}>Tutup, lanjutkan nanti</button>
                            <button onClick={save} disabled={saving} style={{ ...primaryBtn, opacity: saving ? 0.65 : 1 }}><Save size={14} />{saving ? "Menyimpan..." : "Simpan HPP"}</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function HppTableRows({ index, hpp, components, totals, expanded, onToggle, onEdit, onDelete }: {
    index: number;
    hpp: HppCalc;
    components: HppComponentRow[];
    totals: ReturnType<typeof calcTotals>;
    expanded: boolean;
    onToggle: () => void;
    onEdit: () => void;
    onDelete: () => void;
}) {
    return <>
        <tr style={{ background: expanded ? "#F7FFFD" : "white" }}>
            <td style={{ ...sheetCell, textAlign: "center", color: "var(--text-med)" }}>{index + 1}</td>
            <td style={{ ...sheetCell, fontWeight: 700 }}><button type="button" onClick={onToggle} aria-expanded={expanded} style={productButton}>{expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}{hpp.product_name}</button></td>
            <td style={{ ...sheetCell, textAlign: "center" }}>{components.length}</td>
            <td style={{ ...sheetCell, textAlign: "right" }}>{Number(hpp.market_cut_percent).toLocaleString("id-ID")}%</td>
            <td style={{ ...sheetCell, textAlign: "right", fontWeight: 700 }}>{rupiah(totals.totalCost)}</td>
            <td style={{ ...sheetCell, textAlign: "right" }}>{rupiah(totals.totalSell)}</td>
            <td style={{ ...sheetCell, textAlign: "right" }}>{rupiah(Number(hpp.current_price))}</td>
            <td style={{ ...sheetCell, textAlign: "right", color: totals.margin < 0 ? "#B91C1C" : "#15803D", fontWeight: 700 }}>{rupiah(totals.margin)}</td>
            <td style={{ ...sheetCell, textAlign: "right", color: totals.diff < 0 ? "#B91C1C" : "#15803D", fontWeight: 700 }}>{rupiah(totals.diff)}</td>
            <td style={{ ...sheetCell, textAlign: "center", whiteSpace: "nowrap" }}><button type="button" onClick={onEdit} style={linkBtn}>Ubah</button><button type="button" onClick={onDelete} style={{ ...linkBtn, color: "#B91C1C", marginLeft: 8 }}>Hapus</button></td>
        </tr>
        {expanded && <tr><td colSpan={10} style={{ padding: 0, background: "#FBFFFE", borderBottom: "1px solid var(--border)" }}><div style={{ padding: "10px 16px 14px 58px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-med)", marginBottom: 6 }}>Rincian komponen</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}><thead><tr><th style={detailHeader}>Komponen</th><th style={detailHeader}>Keterangan</th><th style={{ ...detailHeader, textAlign: "right" }}>Modal</th><th style={{ ...detailHeader, textAlign: "right" }}>Harga Jual</th><th style={{ ...detailHeader, textAlign: "right" }}>Margin</th></tr></thead><tbody>
                {components.map((component) => <tr key={component.id}><td style={detailCell}>{component.name}</td><td style={detailCell}>{component.note || "-"}</td><td style={{ ...detailCell, textAlign: "right" }}>{rupiah(Number(component.cost))}</td><td style={{ ...detailCell, textAlign: "right" }}>{rupiah(Number(component.sell_price))}</td><td style={{ ...detailCell, textAlign: "right", color: Number(component.sell_price) - Number(component.cost) < 0 ? "#B91C1C" : "#15803D" }}>{rupiah(Number(component.sell_price) - Number(component.cost))}</td></tr>)}
            </tbody></table>
        </div></td></tr>}
    </>;
}

const cardStyle: CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 10, padding: 16, fontSize: 13, color: "var(--text-med)" };
const sheetStyle: CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" };
const sheetHeader: CSSProperties = { position: "sticky", top: 0, zIndex: 1, padding: "10px 9px", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", borderRight: "1px solid var(--border-light)", textAlign: "right", color: "var(--text-med)", fontSize: 10, fontWeight: 700, textTransform: "uppercase", whiteSpace: "nowrap" };
const sheetCell: CSSProperties = { padding: "10px 9px", borderBottom: "1px solid var(--border-light)", borderRight: "1px solid var(--border-light)", color: "var(--text-dark)", whiteSpace: "nowrap" };
const editorHeader: CSSProperties = { padding: "9px 8px", textAlign: "left", background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", color: "var(--text-med)", fontSize: 10, fontWeight: 700, textTransform: "uppercase" };
const editorCell: CSSProperties = { padding: 8 };
const detailHeader: CSSProperties = { padding: "6px 8px", textAlign: "left", color: "var(--text-med)", fontSize: 9, textTransform: "uppercase", borderBottom: "1px solid var(--border-light)" };
const detailCell: CSSProperties = { padding: "7px 8px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const linkBtn: CSSProperties = { background: "none", border: "none", color: "var(--primary-dark)", fontWeight: 700, fontSize: 11, cursor: "pointer", padding: 0 };
const primaryBtn: CSSProperties = { background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, whiteSpace: "nowrap" };
const ghostBtn: CSSProperties = { background: "white", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", color: "var(--text-med)" };
const smallPrimaryBtn: CSSProperties = { ...primaryBtn, padding: "7px 10px", fontSize: 11 };
const smallGhostBtn: CSSProperties = { ...ghostBtn, padding: "7px 10px", fontSize: 11 };
const closeBtn: CSSProperties = { ...smallGhostBtn, flexShrink: 0 };
const deleteIconBtn: CSSProperties = { border: "none", background: "none", color: "#B91C1C", cursor: "pointer", padding: 6, display: "inline-flex" };
const productButton: CSSProperties = { border: 0, background: "transparent", padding: 0, display: "inline-flex", alignItems: "center", gap: 5, font: "inherit", fontWeight: 700, color: "var(--text-dark)", cursor: "pointer", textAlign: "left" };
const labelStyle: CSSProperties = { fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", display: "block", marginBottom: 4 };
const fixedLabel: CSSProperties = { display: "inline-block", marginTop: 4, fontSize: 9, color: "var(--text-med)" };
const inputStyle: CSSProperties = { width: "100%", fontSize: 12, padding: "8px 9px", borderRadius: 6, border: "1px solid var(--border)", background: "white", color: "var(--text-dark)", boxSizing: "border-box", minHeight: 36 };
const overlayStyle: CSSProperties = { position: "fixed", inset: 0, background: "rgba(22, 31, 30, 0.52)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 };
const modalStyle: CSSProperties = { background: "white", borderRadius: 14, padding: 20, width: "100%", maxWidth: 980, maxHeight: "92dvh", overflowY: "auto", boxShadow: "0 24px 70px rgba(12, 49, 44, 0.2)" };
const draftBannerStyle: CSSProperties = { marginBottom: 14, padding: "11px 13px", background: "#F0FDFA", border: "1px solid #99E7DA", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", color: "var(--text-dark)", fontSize: 12 };
const totalsStyle: CSSProperties = { background: "var(--bg-secondary)", borderRadius: 8, padding: 12, fontSize: 12, display: "grid", gap: 6 };
const totalLine: CSSProperties = { display: "flex", justifyContent: "space-between", gap: 12 };
const historyBox: CSSProperties = { marginTop: 5, padding: 6, background: "#F7FFFD", border: "1px solid #BCEDE5", borderRadius: 6, fontSize: 9 };
const historyButton: CSSProperties = { width: "100%", border: 0, borderTop: "1px solid #DDF3EF", background: "transparent", padding: "5px 2px", display: "flex", justifyContent: "space-between", gap: 8, color: "var(--text-dark)", fontSize: 9, cursor: "pointer", textAlign: "left" };
const visuallyHidden: CSSProperties = { position: "absolute", width: 1, height: 1, padding: 0, margin: -1, overflow: "hidden", clip: "rect(0, 0, 0, 0)", whiteSpace: "nowrap", border: 0 };
