"use client";
// ============================================================
// CRM Customer — CRM Terpadu (kerangka 5 tab, Tahap 3).
// Direktori · Per Marketing · Peta Wilayah · Pengingat Piutang · Re-engagement
// Konten tab di app/dashboard/crm/components/; derivasi angka di lib/crm-analytics.
// ============================================================
import { useState, useMemo, useEffect } from "react";
import { Users, Wallet, Map as MapIcon, AlertCircle, TrendingUp } from "lucide-react";
import { useCrm } from "@/lib/crm-store";
import { usePesanan } from "@/lib/pesanan-store";
import type { Customer, CustomerType } from "@/types";
import {
    buildStats, enrichCustomers, emptyCustomerStat, normalizeName, daysSince,
    DORMANT_DAYS, type CustomerStat,
} from "@/lib/crm-analytics";
import { fetchRegionCoords, type RegionCoord } from "@/lib/crm-refs";
import { fetchMarketers, DEFAULT_MARKETERS, type Marketer } from "@/lib/crm-marketers";
import { TYPE_OPTS, inputSt, labelSt } from "./components/shared";
import CustomerDrawer from "./components/CustomerDrawer";
import TabDirektori from "./components/TabDirektori";
import TabMarketing from "./components/TabMarketing";
import TabPeta from "./components/TabPeta";
import TabPiutang from "./components/TabPiutang";
import TabReengage from "./components/TabReengage";

type TabKey = "direktori" | "marketing" | "peta" | "piutang" | "reengage";

type FormState = { name: string; phone: string; type: CustomerType; pic: string; address: string; notes: string; marketingId: string; kota: string };
const emptyForm: FormState = { name: "", phone: "", type: "retail", pic: "", address: "", notes: "", marketingId: "", kota: "" };

export default function CrmPage() {
    const { customers, loading, addCustomer, updateCustomer, deleteCustomer, importNames } = useCrm();
    const { rows } = usePesanan();

    const [tab, setTab] = useState<TabKey>("direktori");
    const [form, setForm] = useState<FormState>(emptyForm);
    const [showAdd, setShowAdd] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [detail, setDetail] = useState<Customer | null>(null);
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState("");

    const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };

    // Agregasi order per customer — satu kali hitung, dipakai semua tab.
    const stats = useMemo(() => buildStats(rows), [rows]);
    const statOf = (name: string): CustomerStat => stats.get(normalizeName(name)) ?? emptyCustomerStat(name);
    const enriched = useMemo(() => enrichCustomers(customers, stats), [customers, stats]);

    // Referensi kota (utk datalist form & auto-isi provinsi).
    const [regions, setRegions] = useState<RegionCoord[]>([]);
    useEffect(() => { fetchRegionCoords().then(setRegions).catch(() => { /* tabel belum ada → datalist kosong saja */ }); }, []);

    // Daftar marketing dari tabel crm_marketers (fallback bawaan bila belum ada).
    const [marketers, setMarketers] = useState<Marketer[]>(DEFAULT_MARKETERS);
    const reloadMarketers = () => { fetchMarketers().then(setMarketers).catch(() => {}); };
    useEffect(() => { reloadMarketers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const activeMarketers = useMemo(() => marketers.filter((m) => m.active), [marketers]);
    const provinsiOf = (kota: string): string =>
        regions.find((r) => r.kota.toLowerCase() === kota.trim().toLowerCase())?.provinsi ?? "";

    // Lookup customer master by nama ternormalisasi (untuk ambil no WA/PIC).
    const byName = useMemo(() => {
        const m = new Map<string, Customer>();
        customers.forEach((c) => m.set(normalizeName(c.name), c));
        return m;
    }, [customers]);

    // Badge jumlah di tab (sumber sama dgn isi tabnya).
    const piutangCount = useMemo(() => Array.from(stats.values()).filter((a) => a.unpaid > 0.01).length, [stats]);
    const dormantCount = useMemo(() => Array.from(stats.values()).filter((a) => a.last && daysSince(a.last) >= DORMANT_DAYS).length, [stats]);

    // ── Handlers ──
    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) { alert("Nama wajib diisi."); return; }
        setBusy(true);
        try {
            await addCustomer({ name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type: form.type, pic: form.pic.trim(), notes: form.notes.trim(), marketingId: form.marketingId, kota: form.kota.trim(), provinsi: provinsiOf(form.kota) });
            setShowAdd(false); setForm(emptyForm); showToast("✅ Customer ditambahkan");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            alert(/duplicate|unique/i.test(msg) ? "Nama customer ini sudah ada." : "Gagal menyimpan: " + msg);
        } finally { setBusy(false); }
    };

    const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone, type: c.type, pic: c.pic, address: c.address, notes: c.notes, marketingId: c.marketingId ?? "", kota: c.kota ?? "" }); };
    const handleEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setBusy(true);
        try {
            await updateCustomer(editing.id, { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), type: form.type, pic: form.pic.trim(), notes: form.notes.trim(), marketingId: form.marketingId, kota: form.kota.trim(), provinsi: provinsiOf(form.kota) || (editing.provinsi ?? "") });
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
                <div><label style={labelSt}>Marketing (PIC Internal)</label>
                    <select style={inputSt} value={form.marketingId} onChange={(e) => setForm((p) => ({ ...p, marketingId: e.target.value }))}>
                        <option value="">— Belum di-assign —</option>
                        {activeMarketers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                        {/* Marketing nonaktif yang masih ter-assign di customer ini — tampilkan agar tidak "hilang" saat edit */}
                        {form.marketingId && !activeMarketers.some((m) => m.id === form.marketingId) && (
                            <option value={form.marketingId}>{marketers.find((m) => m.id === form.marketingId)?.name ?? form.marketingId} (nonaktif)</option>
                        )}
                    </select>
                </div>
                <div><label style={labelSt}>Kota / Wilayah</label>
                    <input style={inputSt} value={form.kota} onChange={(e) => setForm((p) => ({ ...p, kota: e.target.value }))} placeholder="cth: Bekasi" list="crm-kota-list" />
                    <datalist id="crm-kota-list">{regions.map((r) => <option key={r.kota} value={r.kota} />)}</datalist>
                </div>
            </div>
            <div style={{ marginBottom: "1rem" }}><label style={labelSt}>Alamat</label><input style={inputSt} value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} placeholder="Alamat customer" /></div>
            <div><label style={labelSt}>Catatan</label><textarea style={{ ...inputSt, minHeight: 70 }} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} placeholder="Catatan internal..." /></div>
        </>
    );

    const TABS: { key: TabKey; label: string; Icon: typeof Users; count?: number }[] = [
        { key: "direktori", label: "Direktori", Icon: Users },
        { key: "marketing", label: "Per Marketing", Icon: Wallet },
        { key: "peta", label: "Peta Wilayah", Icon: MapIcon },
        { key: "piutang", label: "Pengingat Piutang", Icon: AlertCircle, count: piutangCount },
        { key: "reengage", label: "Re-engagement", Icon: TrendingUp, count: dormantCount },
    ];

    return (
        <div className="page-content space-y-5">
            <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                    <h1 className="page-title-h1">CRM Customer</h1>
                    <p className="page-subtitle">Master data, wilayah, marketing & piutang — satu tempat</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleImport} disabled={busy} className="btn btn-secondary" style={{ fontSize: 13 }}>⬇️ Import dari Pesanan</button>
                    <button onClick={() => { setForm(emptyForm); setShowAdd(true); }} className="btn btn-primary" style={{ fontSize: 13 }}>+ Tambah Customer</button>
                </div>
            </div>

            {/* Tab bar — 5 tab CRM Terpadu */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #E8DDD0", flexWrap: "wrap" }}>
                {TABS.map(({ key, label, Icon, count }) => (
                    <button key={key} onClick={() => setTab(key)}
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", border: "none", background: "transparent", borderBottom: tab === key ? "2.5px solid #A67B5B" : "2.5px solid transparent", color: tab === key ? "#A67B5B" : "#9CA3AF", fontWeight: tab === key ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
                        <Icon size={15} /> {label}
                        {count !== undefined && count > 0 && (
                            <span style={{ fontSize: 10.5, fontWeight: 700, color: "#fff", background: "#B91C1C", borderRadius: 99, padding: "1px 6px" }}>{count}</span>
                        )}
                    </button>
                ))}
            </div>

            {tab === "direktori" && <TabDirektori enriched={enriched} marketers={marketers} loading={loading} onDetail={setDetail} onEdit={openEdit} onDelete={handleDelete} showToast={showToast} />}
            {tab === "marketing" && <TabMarketing enriched={enriched} rows={rows} marketers={marketers} onReloadMarketers={reloadMarketers} onDetail={setDetail} showToast={showToast} />}
            {tab === "peta" && <TabPeta enriched={enriched} coords={regions} showToast={showToast} />}
            {tab === "piutang" && <TabPiutang stats={stats} byName={byName} marketers={marketers} />}
            {tab === "reengage" && <TabReengage stats={stats} byName={byName} marketers={marketers} />}

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

            {/* Drawer Customer 360 */}
            {detail && (
                <CustomerDrawer
                    c={detail}
                    stat={statOf(detail.name)}
                    rows={rows}
                    marketers={marketers}
                    onClose={() => setDetail(null)}
                    onEdit={() => { const d = detail; setDetail(null); openEdit(d); }}
                />
            )}

            {toast && (
                <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 2000, background: "#DCFCE7", color: "#15803D", fontWeight: 600, fontSize: 13, padding: "12px 20px", borderRadius: 10, border: "1px solid #86EFAC", boxShadow: "0 4px 16px rgba(0,0,0,0.12)" }}>{toast}</div>
            )}
        </div>
    );
}
