"use client";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Material } from "@/types";
import { formatDate } from "@/lib/utils";

type ModalType = "masuk" | "keluar" | "baru" | null;

const CATEGORIES = ["Bahan Baku", "Cat", "Hardware", "Consumable", "Lainnya"];

export default function StokBahanPage() {
    const { materials, addMaterial, updateMaterial, deleteMaterial } = useStore();
    const [search, setSearch] = useState("");
    const [modal, setModal] = useState<ModalType>(null);
    const [selId, setSelId] = useState<string | null>(null);
    const [form, setForm] = useState({ code: "", name: "", category: "Bahan Baku", unit: "", currentStock: "", minimumStock: "", location: "" });
    const [adjForm, setAdjForm] = useState({ jumlah: "", keterangan: "" });
    const [saving, setSaving] = useState(false);

    const filtered = materials.filter((m) => {
        const q = search.toLowerCase();
        return !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q) || m.category.toLowerCase().includes(q);
    });

    const lowStockCount = materials.filter((m) => m.currentStock <= m.minimumStock).length;

    const openMasuk = (id: string) => { setSelId(id); setAdjForm({ jumlah: "", keterangan: "" }); setModal("masuk"); };
    const openKeluar = (id: string) => { setSelId(id); setAdjForm({ jumlah: "", keterangan: "" }); setModal("keluar"); };
    const openBaru = () => { setForm({ code: "", name: "", category: "Bahan Baku", unit: "", currentStock: "", minimumStock: "", location: "" }); setModal("baru"); };

    const handleAdj = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selId || saving) return;
        const m = materials.find((m) => m.id === selId);
        if (!m) return;
        setSaving(true);
        try {
            const delta = parseFloat(adjForm.jumlah) || 0;
            const newStock = modal === "masuk" ? m.currentStock + delta : Math.max(0, m.currentStock - delta);
            await updateMaterial(selId, { currentStock: newStock, lastUpdated: new Date().toISOString().slice(0, 10) });
            setModal(null);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const handleBaru = async (e: React.FormEvent) => {
        e.preventDefault();
        if (saving) return;
        setSaving(true);
        try {
            await addMaterial({
                code: form.code, name: form.name, category: form.category,
                unit: form.unit, currentStock: parseFloat(form.currentStock) || 0,
                minimumStock: parseFloat(form.minimumStock) || 0,
                location: form.location, lastUpdated: new Date().toISOString().slice(0, 10),
            });
            setModal(null);
        } catch (err) {
            console.error(err);
        } finally {
            setSaving(false);
        }
    };

    const selMaterial = materials.find((m) => m.id === selId);

    return (
        <div className="page-content">
            {/* Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title-h1">Manajemen Stok Bahan</h1>
                    <p className="page-subtitle">{materials.length} material • {lowStockCount > 0 && <span style={{ color: "#ef4444" }}>{lowStockCount} di bawah stok minimum ⚠️</span>}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={openBaru} className="btn btn-primary">+ Bahan Baru</button>
                </div>
            </div>

            {/* Low stock alert */}
            {lowStockCount > 0 && (
                <div style={{ background: "#FEF3C7", border: "1px solid #FDE68A", borderRadius: 8, padding: "0.75rem 1rem", fontSize: 13, color: "#92400E", marginBottom: "0.75rem" }}>
                    ⚠️ <strong>{lowStockCount} material</strong> memiliki stok di bawah batas minimum — harus segera diisi ulang.
                </div>
            )}

            {/* Filter */}
            <div className="filter-bar">
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari kode, nama, atau kategori..."
                    style={{ width: 300, padding: "0.45rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, color: "var(--text-dark)", background: "var(--bg-secondary)" }}
                />
                <span style={{ fontSize: 12, color: "#B89678", marginLeft: "auto" }}>{filtered.length} material</span>
            </div>

            {/* Table */}
            <div className="table-container">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Kode</th>
                            <th>Nama Bahan</th>
                            <th>Kategori</th>
                            <th style={{ textAlign: "center" }}>Stok</th>
                            <th style={{ textAlign: "center" }}>Min Stok</th>
                            <th>Satuan</th>
                            <th>Lokasi</th>
                            <th>Update Terakhir</th>
                            <th style={{ textAlign: "center" }}>Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.map((m) => {
                            const isLow = m.currentStock <= m.minimumStock;
                            return (
                                <tr key={m.id} style={{ background: isLow ? "#FEF2F2" : undefined }}>
                                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{m.code}</td>
                                    <td>
                                        <div style={{ fontWeight: 500 }}>{m.name}</div>
                                        {isLow && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 2 }}>⚠️ Stok rendah!</div>}
                                    </td>
                                    <td>
                                        <span className="badge" style={{ background: "#E8DCCF", color: "#8B5E34", fontSize: 11 }}>{m.category}</span>
                                    </td>
                                    <td style={{ textAlign: "center", fontWeight: 700, color: isLow ? "#ef4444" : "var(--text-dark)" }}>
                                        {m.currentStock.toLocaleString("id-ID")}
                                    </td>
                                    <td style={{ textAlign: "center", color: "#B89678" }}>{m.minimumStock.toLocaleString("id-ID")}</td>
                                    <td style={{ fontSize: 12 }}>{m.unit}</td>
                                    <td style={{ fontSize: 12 }}>{m.location}</td>
                                    <td style={{ fontSize: 12, color: "#B89678" }}>{formatDate(m.lastUpdated)}</td>
                                    <td>
                                        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                                            <button onClick={() => openMasuk(m.id)} className="btn btn-success" style={{ padding: "3px 10px", fontSize: 11 }}>+ Masuk</button>
                                            <button onClick={() => openKeluar(m.id)} className="btn btn-secondary" style={{ padding: "3px 10px", fontSize: 11 }}>- Keluar</button>
                                            <button onClick={() => { if (confirm(`Hapus bahan "${m.name}"? Data tidak bisa dikembalikan.`)) deleteMaterial(m.id); }}
                                                style={{ padding: "3px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                                                🗑️ Hapus
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Modal Stok Masuk/Keluar */}
            {(modal === "masuk" || modal === "keluar") && selMaterial && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal-box" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>
                            {modal === "masuk" ? "📦 Stok Masuk" : "📤 Stok Keluar"}
                        </h2>
                        <p style={{ fontSize: 13, color: "#B89678", marginBottom: 16 }}>
                            Bahan: <strong style={{ color: "var(--text-dark)" }}>{selMaterial.name}</strong> &nbsp;|&nbsp; Stok saat ini: <strong>{selMaterial.currentStock} {selMaterial.unit}</strong>
                        </p>
                        <form onSubmit={handleAdj} className="space-y-4">
                            <div>
                                <label className="form-label">Jumlah ({selMaterial.unit})</label>
                                <input type="number" value={adjForm.jumlah} onChange={(e) => setAdjForm((p) => ({ ...p, jumlah: e.target.value }))}
                                    className="form-input" placeholder="Masukkan jumlah" min="0.01" step="any" required />
                            </div>
                            <div>
                                <label className="form-label">Keterangan (opsional)</label>
                                <input type="text" value={adjForm.keterangan} onChange={(e) => setAdjForm((p) => ({ ...p, keterangan: e.target.value }))}
                                    className="form-input" placeholder="Catatan transaksi stok" />
                            </div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => setModal(null)} disabled={saving} className="btn btn-secondary">Batal</button>
                                <button type="submit" disabled={saving} className={`btn ${modal === "masuk" ? "btn-success" : "btn-primary"}`}>
                                    {saving ? "Simpan..." : "Simpan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Bahan Baru */}
            {modal === "baru" && (
                <div className="modal-overlay" onClick={() => setModal(null)}>
                    <div className="modal-box" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontWeight: 700, color: "var(--text-dark)", marginBottom: 16 }}>➕ Tambah Bahan Baru</h2>
                        <form onSubmit={handleBaru}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                                <div>
                                    <label className="form-label">Kode Bahan</label>
                                    <input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} className="form-input" placeholder="ALU-001" required />
                                </div>
                                <div>
                                    <label className="form-label">Nama Bahan</label>
                                    <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="form-input" placeholder="Batang Aluminium..." required />
                                </div>
                                <div>
                                    <label className="form-label">Kategori</label>
                                    <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="form-select">
                                        {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Satuan</label>
                                    <input value={form.unit} onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))} className="form-input" placeholder="kg / pcs / meter" required />
                                </div>
                                <div>
                                    <label className="form-label">Stok Awal</label>
                                    <input type="number" value={form.currentStock} onChange={(e) => setForm((p) => ({ ...p, currentStock: e.target.value }))} className="form-input" placeholder="0" min="0" />
                                </div>
                                <div>
                                    <label className="form-label">Minimum Stok</label>
                                    <input type="number" value={form.minimumStock} onChange={(e) => setForm((p) => ({ ...p, minimumStock: e.target.value }))} className="form-input" placeholder="0" min="0" />
                                </div>
                                <div style={{ gridColumn: "span 2" }}>
                                    <label className="form-label">Lokasi Simpan</label>
                                    <input value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} className="form-input" placeholder="Gudang A, Rak B1..." />
                                </div>
                            </div>
                            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => setModal(null)} disabled={saving} className="btn btn-secondary">Batal</button>
                                <button type="submit" disabled={saving} className="btn btn-primary">
                                    {saving ? "⏳ Menyimpan..." : "Simpan Bahan"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
