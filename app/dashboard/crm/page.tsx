"use client";
import { useState, useMemo } from "react";
import { useCrm, normalizeName } from "@/lib/crm-store";
import { usePesanan } from "@/lib/pesanan-store";
import type { Customer, CustomerType } from "@/types";
import { formatCurrency, formatDate } from "@/lib/utils";

const TYPE_OPTS: { value: CustomerType; label: string; color: string }[] = [
    { value: "retail", label: "Retail", color: "#2563EB" },
    { value: "proyek", label: "Proyek", color: "#15803D" },
    { value: "kontraktor", label: "Kontraktor", color: "#A16207" },
    { value: "reseller", label: "Reseller", color: "#7C3AED" },
    { value: "lainnya", label: "Lainnya", color: "#6B7280" },
];
const typeMeta = (t: CustomerType) => TYPE_OPTS.find((o) => o.value === t) ?? TYPE_OPTS[4];

function parseIdNum(s: string | undefined): number {
    if (!s) return 0;
    const str = s.trim();
    if (str.includes(",")) return parseFloat(str.replace(/\./g, "").replace(",", ".")) || 0;
    if (/^\d{1,3}(\.\d{3})+$/.test(str)) return parseFloat(str.replace(/\./g, "")) || 0;
    return parseFloat(str.replace(/[^0-9.]/g, "")) || 0;
}

// Sapaan WA default (re-engagement: tanya kabar → tawarkan order lagi).
// Emoji pakai escape Unicode agar tidak rusak encoding.
function waGreeting(name: string, pic: string): string {
    const sapaan = (pic || name || "Bapak/Ibu").trim();
    return `Halo ${sapaan}, apa kabar? Semoga sehat selalu dan usahanya lancar \u{1F64F}\n\n`
        + `Kami dari *CV TOTO Aluminium Manufacture*. Apakah ada kebutuhan pesanan aluminium lagi yang bisa kami bantu? `
        + `Kami siap melayani \u{1F60A}`;
}

function waLink(phone: string, text: string): string | null {
    let p = (phone || "").replace(/[^0-9]/g, "");
    if (!p) return null;
    if (p.startsWith("0")) p = "62" + p.slice(1);
    else if (p.startsWith("8")) p = "62" + p;
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}

type FormState = { name: string; phone: string; type: CustomerType; pic: string; address: string; notes: string };
const emptyForm: FormState = { name: "", phone: "", type: "retail", pic: "", address: "", notes: "" };

export default function CrmPage() {
    const { customers, loading, addCustomer, updateCustomer, deleteCustomer, importNames } = useCrm();
    const { rows } = usePesanan();

    const [search, setSearch] = useState("");
    const [form, setForm] = useState<FormState>(emptyForm);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [detail, setDetail] = useState<Customer | null>(null);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState("");

    const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

    // Agregasi order per customer (cocok via nama ternormalisasi).
    const agg = useMemo(() => {
        const map = new Map<string, { count: number; total: number; unpaid: number; last: string; invoices: Set<string> }>();
        for (const r of rows) {
            if (!(r.customer || r.deskripsi) || !r.customer) continue;
            const key = normalizeName(r.customer);
            if (!key) continue;
            const val = parseIdNum(r.harga) * parseIdNum(r.ukuran) * parseIdNum(r.qty);
            const e = map.get(key) ?? { count: 0, total: 0, unpaid: 0, last: "", invoices: new Set<string>() };
            e.count += 1;
            e.total += val;
            if (!r.is_paid) e.unpaid += val;
            if (r.no_inv) e.invoices.add(r.no_inv.trim());
            if (r.tanggal && r.tanggal > e.last) e.last = r.tanggal;
            map.set(key, e);
        }
        return map;
    }, [rows]);

    const statOf = (name: string) => agg.get(normalizeName(name)) ?? { count: 0, total: 0, unpaid: 0, last: "", invoices: new Set<string>() };

    const filtered = useMemo(() => {
        const q = search.toLowerCase().trim();
        const list = !q ? customers : customers.filter((c) =>
            [c.name, c.phone, c.pic, c.address].join(" ").toLowerCase().includes(q));
        return list;
    }, [customers, search]);

    const withWa = customers.filter((c) => c.phone.trim()).length;

    // ── Handlers ──
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { alert("Nama wajib diisi."); return; }
        setBusy(true);
        try {
            await addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type: form.type, pic: form.pic.trim(), notes: form.notes.trim() });
            setShowAdd(false); setForm(emptyForm); showToast("✅ Customer ditambahkan");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            alert(/duplicate|unique/i.test(msg) ? "Nama customer ini sudah ada." : "Gagal menyimpan: " + msg);
        } finally { setBusy(false); }
    };

    const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone, type: c.type, pic: c.pic, address: c.address, notes: c.notes }); };
    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setBusy(true);
        try {
            await updateCustomer(editing.id, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type: form.type, pic: form.pic.trim(), notes: form.notes.trim() });
            setEditing(null); setForm(emptyForm); showToast("✅ Customer diperbarui");
        } catch (err: unknown) {
            alert("Gagal memperbarui: " + (err instanceof Error ? err.message : ""));
        } finally { setBusy(false); }
    };

    const handleDelete = async (c: Customer) => {
        if (!confirm(`Hapus customer "${c.name}" dari master? (Data pesanan tidak terhapus.)`)) return;
        try { await deleteCustomer(c.id); showToast("🗑️ Customer dihapus"); }
        catch (err: unknown) { alert("Gagal menghapus: " + (err instanceof Error ? err.message : "")); }
    };

    const handleImport = async () => {
        const names = rows.filter((r) => r.customer && r.customer.trim()).map((r) => r.customer);
        if (names.length === 0) { alert("Belum ada nama customer di pesanan."); return; }
        setBusy(true);
        try {
            const n = await importNames(names);
            showToast(n > 0 ? `✅ ${n} customer baru di-import dari pesanan` : "Semua customer sudah ada di master");
        } catch (err: unknown) { alert("Gagal import: " + (err instanceof Error ? err.message : "")); }
        finally { setBusy(false); }
    };

    const inputSt: React.CSSProperties = { width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "8px 12px", fontSize: 13, color: "#3C2F2F", background: "#FFFBF7", outline: "none", boxSizing: "border-box" };
    const labelSt: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 5 };

    const renderFormFields = () => (
        <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                <div><label style={labelSt}>Nama Customer *</label><input style={inputSt} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="cth: PT Maju Jaya" required /></div>
                <div><label style={labelSt}>No. WhatsApp / HP</label><input style={inputSt} value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="cth: 08123456789" /></div>
                <div><label style={labelSt}>Tipe</label>
                    <select style={inputSt} value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as CustomerType }))}>
                        {TYPE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div><label style={labelSt}>PIC / Kontak</label><input style={inputSt} value={form.pic} onChange={(e) => setForm((p) => ({ ...p, pic: e.target.value }))} placeholder="cth: Bpk Andi" /></div>
            </div>
            <div style={{ marginBottom: "1rem" }}><label style={labelSt}>Alamat</label><input style={inputSt} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Alamat customer" /></div>
            <div><label style={labelSt}>Catatan</label><textarea style={{ ...inputSt, minHeight: 70 }} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Catatan internal..." /></div>
        </>
    );

    return (
        <div className="page-content space-y-5">
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                    <h1 className="page-title-h1">CRM Customer</h1>
                    <p className="page-subtitle">Master data & riwayat customer</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleImport} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13 }}>⬇️ Import dari Pesanan</button>
                    <button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="btn btn-primary" style={{ fontSize: 13 }}>+ Tambah Customer</button>
                </div>
            </div>

            {/* Ringkasan */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.875rem" }}>
                <div className="stat-card"><div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Total Customer</div><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "var(--text-dark)" }}>{customers.length}</div></div>
                <div className="stat-card"><div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Punya No. WA</div><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#15803D" }}>{withWa}</div></div>
                <div className="stat-card"><div style={{ fontSize: 11, fontWeight: 600, color: "#B89678" }}>Belum Ada WA</div><div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#B91C1C" }}>{customers.length - withWa}</div></div>
            </div>

            {/* Tabel */}
            <div className="card">
                <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span>Daftar Customer ({filtered.length})</span>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔍 Cari nama / WA / PIC..." style={{ ...inputSt, width: 260 }} />
                </div>
                <div className="table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nama</th><th>Tipe</th><th>No. WA</th>
                                <th style={{ textAlign: "right" }}>Total Order</th>
                                <th style={{ textAlign: "right" }}>Piutang</th>
                                <th>Order Terakhir</th>
                                <th style={{ width: 150, textAlign: "center" }}>Aksi</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#B89678" }}>Memuat…</td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} style={{ textAlign: "center", padding: 30, color: "#B89678" }}>Belum ada customer. Klik <strong>Import dari Pesanan</strong> atau <strong>Tambah Customer</strong>.</td></tr>
                            ) : filtered.map((c) => {
                                const s = statOf(c.name);
                                const tm = typeMeta(c.type);
                                const wa = waLink(c.phone, waGreeting(c.name, c.pic));
                                return (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 600, color: "#3C2F2F" }}>
                                            <button onClick={() => setDetail(c)} style={{ background: "none", border: "none", padding: 0, color: "#A67B5B", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>{c.name}</button>
                                            {c.pic && <div style={{ fontSize: 11, color: "#8A7B6E" }}>{c.pic}</div>}
                                        </td>
                                        <td><span className="badge" style={{ background: tm.color + "1A", color: tm.color, fontSize: 10 }}>{tm.label}</span></td>
                                        <td>{c.phone ? (wa ? <a href={wa} target="_blank" rel="noreferrer" style={{ color: "#15803D", fontWeight: 600, textDecoration: "none" }}>💬 {c.phone}</a> : c.phone) : <span style={{ color: "#C5A882", fontSize: 12 }}>—</span>}</td>
                                        <td style={{ textAlign: "right", fontWeight: 600 }}>{s.total > 0 ? formatCurrency(s.total) : "—"}</td>
                                        <td style={{ textAlign: "right", fontWeight: 700, color: s.unpaid > 0 ? "#B91C1C" : "#15803D" }}>{s.unpaid > 0 ? formatCurrency(s.unpaid) : "—"}</td>
                                        <td style={{ fontSize: 13 }}>{s.last ? formatDate(s.last) : "—"}</td>
                                        <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                                            <button onClick={() => setDetail(c)} className="btn btn-ghost" style={{ color: "#4B5563", padding: 4 }} title="Detail 360">👁️</button>
                                            <button onClick={() => openEdit(c)} className="btn btn-ghost" style={{ color: "#A67B5B", padding: 4 }} title="Edit">✏️</button>
                                            <button onClick={() => handleDelete(c)} className="btn btn-ghost" style={{ color: "#ef4444", padding: 4 }} title="Hapus">🗑️</button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Tambah / Edit */}
            {(showAdd || editing) && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
                    onClick={(e) => { if (e.target === e.currentTarget) { setShowAdd(false); setEditing(null); } }}>
                    <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 560, border: "1px solid #E6D5BE", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                        <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "12px 12px 0 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: "#5C4033" }}>{editing ? "✏️ Edit Customer" : "+ Tambah Customer"}</span>
                            <button onClick={() => { setShowAdd(false); setEditing(null); }} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#B89678" }}>×</button>
                        </div>
                        <form onSubmit={editing ? handleEdit : handleAdd}>
                            <div style={{ padding: 20 }}>{renderFormFields()}</div>
                            <div style={{ padding: "14px 20px", borderTop: "1px solid #E6D5BE", background: "#FDF8F3", borderRadius: "0 0 12px 12px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button type="button" onClick={() => { setShowAdd(false); setEditing(null); }} className="btn btn-secondary" style={{ padding: "8px 20px" }}>Batal</button>
                                <button type="submit" disabled={busy} className="btn btn-primary" style={{ padding: "8px 20px" }}>{busy ? "Menyimpan…" : "💾 Simpan"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Customer 360 */}
            {detail && (() => {
                const s = statOf(detail.name);
                const tm = typeMeta(detail.type);
                const recent = rows
                    .filter((r) => normalizeName(r.customer) === normalizeName(detail.name) && r.customer)
                    .sort((a, b) => (b.tanggal || "").localeCompare(a.tanggal || ""))
                    .slice(0, 12);
                const wa = waLink(detail.phone, waGreeting(detail.name, detail.pic));
                return (
                    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}
                        onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
                        <div style={{ background: "white", borderRadius: 12, width: "100%", maxWidth: 720, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", border: "1px solid #E6D5BE", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
                            <div style={{ padding: "16px 20px", borderBottom: "1px solid #E6D5BE", background: "linear-gradient(135deg,#3B1F0F,#A67B5B)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 17, color: "white" }}>{detail.name}</div>
                                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                                        <span style={{ background: "rgba(255,255,255,0.2)", padding: "1px 8px", borderRadius: 99, marginRight: 6 }}>{tm.label}</span>
                                        {detail.pic && `PIC: ${detail.pic}`}
                                    </div>
                                </div>
                                <button onClick={() => setDetail(null)} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 8, width: 30, height: 30, color: "white", fontSize: 16, cursor: "pointer" }}>×</button>
                            </div>
                            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
                                    <div className="stat-card"><div style={{ fontSize: 10, color: "#B89678", fontWeight: 700 }}>JUMLAH ORDER</div><div style={{ fontSize: 18, fontWeight: 800 }}>{s.invoices.size || s.count}</div></div>
                                    <div className="stat-card"><div style={{ fontSize: 10, color: "#B89678", fontWeight: 700 }}>TOTAL NILAI</div><div style={{ fontSize: 15, fontWeight: 800, color: "#15803D" }}>{formatCurrency(s.total)}</div></div>
                                    <div className="stat-card"><div style={{ fontSize: 10, color: "#B89678", fontWeight: 700 }}>PIUTANG</div><div style={{ fontSize: 15, fontWeight: 800, color: s.unpaid > 0 ? "#B91C1C" : "#15803D" }}>{formatCurrency(s.unpaid)}</div></div>
                                    <div className="stat-card"><div style={{ fontSize: 10, color: "#B89678", fontWeight: 700 }}>ORDER TERAKHIR</div><div style={{ fontSize: 13, fontWeight: 700 }}>{s.last ? formatDate(s.last) : "—"}</div></div>
                                </div>

                                <div style={{ display: "flex", gap: 16, fontSize: 13, color: "#5C4033", marginBottom: 16, flexWrap: "wrap" }}>
                                    <div>📞 {detail.phone || "—"}</div>
                                    <div>📍 {detail.address || "—"}</div>
                                    {wa && <a href={wa} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: "#16a34a", fontSize: 12, padding: "5px 12px" }}>💬 Chat WhatsApp</a>}
                                </div>
                                {detail.notes && <div style={{ background: "#FFF9F0", border: "1px dashed #E8DDD0", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#8A6D55", marginBottom: 16 }}>📝 {detail.notes}</div>}

                                <div style={{ fontSize: 12, fontWeight: 800, color: "#5C4033", marginBottom: 8 }}>Riwayat Order Terakhir</div>
                                <div className="table-container">
                                    <table className="data-table">
                                        <thead><tr><th>Tanggal</th><th>Deskripsi</th><th>No. Inv</th><th style={{ textAlign: "right" }}>Nilai</th><th>Bayar</th></tr></thead>
                                        <tbody>
                                            {recent.length === 0 ? (
                                                <tr><td colSpan={5} style={{ textAlign: "center", padding: 20, color: "#B89678" }}>Belum ada order tercatat.</td></tr>
                                            ) : recent.map((r) => (
                                                <tr key={r.id}>
                                                    <td style={{ fontSize: 12 }}>{r.tanggal ? formatDate(r.tanggal) : "—"}</td>
                                                    <td style={{ fontSize: 12 }}>{r.deskripsi || "—"}</td>
                                                    <td style={{ fontSize: 12 }}>{r.no_inv || "—"}</td>
                                                    <td style={{ textAlign: "right", fontSize: 12, fontWeight: 600 }}>{formatCurrency(parseIdNum(r.harga) * parseIdNum(r.ukuran) * parseIdNum(r.qty))}</td>
                                                    <td>{r.is_paid ? <span className="badge" style={{ background: "#DCFCE7", color: "#15803D", fontSize: 10 }}>Lunas</span> : <span className="badge" style={{ background: "#FEF2F2", color: "#991B1B", fontSize: 10 }}>Belum</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div style={{ padding: "12px 20px", borderTop: "1px solid #E6D5BE", background: "#FDF8F3", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                                <button onClick={() => { setDetail(null); openEdit(detail); }} className="btn btn-secondary" style={{ padding: "8px 18px" }}>✏️ Edit</button>
                                <button onClick={() => setDetail(null)} className="btn btn-primary" style={{ padding: "8px 18px" }}>Tutup</button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {toast && (
                <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 2000, background: "#DCFCE7", color: "#15803D", fontWeight: 600, fontSize: 13, padding: "12px 20px", borderRadius: 10, border: "1px solid #86EFAC", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>{toast}</div>
            )}
        </div>
    );
}
