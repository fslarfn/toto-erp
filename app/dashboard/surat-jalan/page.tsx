"use client";
import React, { useState, useMemo } from "react";
import { usePesanan, PesananRow } from "@/lib/pesanan-store";
import { useSuratJalan, SJItem } from "@/lib/surat-jalan-store";

/* ================================================================
   SURAT JALAN
   Tab 1: Untuk Customer — kirim ke customer, pilih item siap kirim
   Tab 2: Untuk Pewarnaan — kirim ke vendor pewarnaan
   Tab 3: Surat Jalan Log — riwayat SJ yang sudah dibuat
================================================================ */

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTH_NAMES_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function fmtDateLong(iso: string): string {
    if (!iso) return "—";
    const p = iso.split("-");
    if (p.length !== 3) return iso;
    return `${parseInt(p[2])} ${MONTH_NAMES_LONG[parseInt(p[1]) - 1]} ${p[0]}`;
}
function fmtDateShort(iso: string): string {
    if (!iso) return "—";
    const p = iso.split("-");
    return p.length === 3 ? `${p[2]} ${MONTH_NAMES[parseInt(p[1]) - 1]} ${p[0]}` : iso;
}
function generateNoSJ(type: "customer" | "pewarnaan"): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(2);
    const ts = String(Date.now()).slice(-5);
    const prefix = type === "customer" ? "SJC" : "SJW";
    return `${prefix}-${dd}${mm}${yy}-${ts}`;
}

/* ================================================================
   TAB 1: Untuk Customer
================================================================ */
function TabCustomer() {
    const { rows, updateRow } = usePesanan();
    const { addSJ } = useSuratJalan();

    const [ekspedisi, setEkspedisi] = useState("");
    const [dibuatOleh, setDibuatOleh] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState(false);
    const [lastNoSJ, setLastNoSJ] = useState("");

    // Hanya item siap_kirim = true yang belum di_kirim
    const candidates = useMemo(() =>
        rows.filter((r) => (r.customer || r.deskripsi) && r.siap_kirim && !r.di_kirim)
            .filter((r) => {
                if (!search) return true;
                return [r.customer, r.deskripsi, r.no_inv].join(" ").toLowerCase().includes(search.toLowerCase());
            }),
        [rows, search]);

    const toggle = (id: number) =>
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    const toggleAll = () =>
        setSelectedIds(selectedIds.length === candidates.length ? [] : candidates.map((r) => r.id));

    const selectedItems = candidates.filter((r) => selectedIds.includes(r.id));

    const cetakSJ = () => {
        if (selectedItems.length === 0 || !ekspedisi) return;
        const noSJ = generateNoSJ("customer");
        const todayISO = new Date().toISOString().slice(0, 10);

        // Tandai di_kirim = true
        selectedIds.forEach((id) => updateRow(id, { di_kirim: true, ekspedisi }));

        // Simpan ke log
        const items: SJItem[] = selectedItems.map((r) => ({
            pesananId: r.id, customer: r.customer, deskripsi: r.deskripsi,
            ukuran: r.ukuran, qty: r.qty, noInv: r.no_inv,
        }));
        addSJ({ type: "customer", tanggal: todayISO, noSJ, vendor: ekspedisi, ekspedisi, dibuat_oleh: dibuatOleh || "—", items });
        setLastNoSJ(noSJ);

        // Print
        printSJ(noSJ, "customer", ekspedisi, todayISO, dibuatOleh, selectedItems);

        setFlash(true);
        setSelectedIds([]);
        setEkspedisi("");
        setTimeout(() => setFlash(false), 3000);
    };

    return (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* LEFT — item list */}
            <div style={{ width: 380, minWidth: 300, background: "white", borderRight: "1px solid #E6D5BE", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0E6D8" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#5C4033", marginBottom: 10 }}>📦 Item Siap Kirim ke Customer</div>

                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Cari customer, deskripsi..."
                        style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "6px 10px", fontSize: 12, color: "#3C2F2F", background: "#FFFBF7", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#B89678" }}>{candidates.length} item tersedia · <strong style={{ color: "#A67B5B" }}>{selectedIds.length} dipilih</strong></span>
                        <button onClick={toggleAll} style={{ fontSize: 11, color: "#A67B5B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                            {selectedIds.length === candidates.length && candidates.length > 0 ? "Batal Semua" : "Pilih Semua"}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {candidates.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#C5A882", fontSize: 12 }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
                            Belum ada item siap kirim.<br />Update status ke <strong>Siap Kirim</strong> di Antrian Produksi.
                        </div>
                    ) : (
                        candidates.map((row) => {
                            const isSel = selectedIds.includes(row.id);
                            return (
                                <div key={row.id} onClick={() => toggle(row.id)}
                                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", cursor: "pointer", background: isSel ? "#FEF3E8" : "white", borderLeft: isSel ? "3px solid #A67B5B" : "3px solid transparent", borderBottom: "1px solid #F5F0EC" }}>
                                    <input type="checkbox" checked={isSel} readOnly style={{ accentColor: "#A67B5B", marginTop: 3, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 12, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                        <div style={{ fontSize: 11, color: "#6B5E55", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.deskripsi || "—"}</div>
                                        <div style={{ fontSize: 10, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"}{row.no_inv ? ` · Inv: ${row.no_inv}` : ""}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Form & action */}
                <div style={{ padding: "14px 16px", borderTop: "1px solid #E6D5BE", background: "#FAFAF8" }}>
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nama Ekspedisi *</label>
                        <input type="text" value={ekspedisi} onChange={(e) => setEkspedisi(e.target.value)}
                            placeholder="cth: JNE, TIKI, Kurir Toko..."
                            style={{ width: "100%", border: `1.5px solid ${ekspedisi ? "#A67B5B" : "#D1BFA3"}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dibuat Oleh</label>
                        <input type="text" value={dibuatOleh} onChange={(e) => setDibuatOleh(e.target.value)}
                            placeholder="Nama operator..."
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    {flash && <div style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>✓ SJ {lastNoSJ} berhasil dibuat & item ditandai Di Kirim!</div>}
                    <button onClick={cetakSJ}
                        disabled={selectedIds.length === 0 || !ekspedisi}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 8, border: "none", cursor: selectedIds.length === 0 || !ekspedisi ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 13, background: selectedIds.length === 0 || !ekspedisi ? "#D1BFA3" : "#A67B5B", color: "white", opacity: selectedIds.length === 0 || !ekspedisi ? 0.5 : 1 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Buat & Cetak SJ Customer ({selectedIds.length} item)
                    </button>
                </div>
            </div>

            {/* RIGHT — Preview */}
            <SJPreview type="customer" items={selectedItems} ekspedisi={ekspedisi} dibuatOleh={dibuatOleh} />
        </div>
    );
}

/* ================================================================
   TAB 2: Untuk Pewarnaan
================================================================ */
function TabPewarnaan() {
    const { rows, updateRow } = usePesanan();
    const { addSJ } = useSuratJalan();

    const [vendorWarna, setVendorWarna] = useState("");
    const [dibuatOleh, setDibuatOleh] = useState("");
    const [catatan, setCatatan] = useState("");
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [search, setSearch] = useState("");
    const [flash, setFlash] = useState(false);
    const [lastNoSJ, setLastNoSJ] = useState("");

    // Item di_produksi = true, di_warna = false → belum ke warna
    const candidates = useMemo(() =>
        rows.filter((r) => (r.customer || r.deskripsi) && r.di_produksi && !r.di_warna)
            .filter((r) => {
                if (!search) return true;
                return [r.customer, r.deskripsi].join(" ").toLowerCase().includes(search.toLowerCase());
            }),
        [rows, search]);

    const toggle = (id: number) =>
        setSelectedIds((prev) => prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]);
    const toggleAll = () =>
        setSelectedIds(selectedIds.length === candidates.length ? [] : candidates.map((r) => r.id));

    const selectedItems = candidates.filter((r) => selectedIds.includes(r.id));

    const cetakSJ = () => {
        if (selectedItems.length === 0 || !vendorWarna) return;
        const noSJ = generateNoSJ("pewarnaan");
        const todayISO = new Date().toISOString().slice(0, 10);

        // Tandai di_warna = true
        selectedIds.forEach((id) => updateRow(id, { di_warna: true }));

        const items: SJItem[] = selectedItems.map((r) => ({
            pesananId: r.id, customer: r.customer, deskripsi: r.deskripsi,
            ukuran: r.ukuran, qty: r.qty, noInv: r.no_inv,
        }));
        addSJ({ type: "pewarnaan", tanggal: todayISO, noSJ, vendor: vendorWarna, ekspedisi: "", dibuat_oleh: dibuatOleh || "—", items });
        setLastNoSJ(noSJ);

        printSJ(noSJ, "pewarnaan", vendorWarna, todayISO, dibuatOleh, selectedItems, catatan);

        setFlash(true);
        setSelectedIds([]);
        setVendorWarna("");
        setCatatan("");
        setTimeout(() => setFlash(false), 3000);
    };

    return (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* LEFT */}
            <div style={{ width: 380, minWidth: 300, background: "white", borderRight: "1px solid #E6D5BE", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0E6D8" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#5C4033", marginBottom: 10 }}>🎨 Item yang Akan Dikirim ke Pewarnaan</div>
                    <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="🔍 Cari customer, deskripsi..."
                        style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "6px 10px", fontSize: 12, color: "#3C2F2F", background: "#FFFBF7", outline: "none", boxSizing: "border-box", marginBottom: 8 }} />
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#B89678" }}>{candidates.length} item · <strong style={{ color: "#A67B5B" }}>{selectedIds.length} dipilih</strong></span>
                        <button onClick={toggleAll} style={{ fontSize: 11, color: "#A67B5B", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                            {selectedIds.length === candidates.length && candidates.length > 0 ? "Batal Semua" : "Pilih Semua"}
                        </button>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {candidates.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#C5A882", fontSize: 12 }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
                            Belum ada item di produksi yang belum ke warna.
                        </div>
                    ) : (
                        candidates.map((row) => {
                            const isSel = selectedIds.includes(row.id);
                            return (
                                <div key={row.id} onClick={() => toggle(row.id)}
                                    style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 16px", cursor: "pointer", background: isSel ? "#FEF9F0" : "white", borderLeft: isSel ? "3px solid #A16207" : "3px solid transparent", borderBottom: "1px solid #F5F0EC" }}>
                                    <input type="checkbox" checked={isSel} readOnly style={{ accentColor: "#A16207", marginTop: 3, flexShrink: 0 }} />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 700, fontSize: 12, color: "#3C2F2F" }}>{row.customer || "—"}</div>
                                        <div style={{ fontSize: 11, color: "#6B5E55", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.deskripsi || "—"}</div>
                                        <div style={{ fontSize: 10, color: "#B89678", marginTop: 2 }}>UK: {row.ukuran || "—"} · Qty: {row.qty || "—"}</div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div style={{ padding: "14px 16px", borderTop: "1px solid #E6D5BE", background: "#FAFAF8" }}>
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Nama Vendor Pewarnaan *</label>
                        <input type="text" value={vendorWarna} onChange={(e) => setVendorWarna(e.target.value)}
                            placeholder="cth: PT. Tegar Lestari..."
                            style={{ width: "100%", border: `1.5px solid ${vendorWarna ? "#A16207" : "#D1BFA3"}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dibuat Oleh</label>
                        <input type="text" value={dibuatOleh} onChange={(e) => setDibuatOleh(e.target.value)}
                            placeholder="Nama operator..."
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Catatan</label>
                        <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)}
                            placeholder="Catatan pengiriman..."
                            rows={2}
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box", resize: "none", fontFamily: "inherit" }} />
                    </div>
                    {flash && <div style={{ background: "#FEF9C3", color: "#A16207", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>✓ SJ {lastNoSJ} berhasil dibuat!</div>}
                    <button onClick={cetakSJ}
                        disabled={selectedIds.length === 0 || !vendorWarna}
                        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", borderRadius: 8, border: "none", cursor: selectedIds.length === 0 || !vendorWarna ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 13, background: selectedIds.length === 0 || !vendorWarna ? "#D1BFA3" : "#A16207", color: "white", opacity: selectedIds.length === 0 || !vendorWarna ? 0.5 : 1 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Buat & Cetak SJ Pewarnaan ({selectedIds.length} item)
                    </button>
                </div>
            </div>

            {/* RIGHT — Preview */}
            <SJPreview type="pewarnaan" items={selectedItems} ekspedisi={vendorWarna} dibuatOleh={dibuatOleh} />
        </div>
    );
}

/* ================================================================
   TAB 3: Surat Jalan Log
================================================================ */
function TabLog() {
    const { suratJalans, deleteSJ } = useSuratJalan();
    const [filterType, setFilterType] = useState<"semua" | "customer" | "pewarnaan">("semua");
    const [search, setSearch] = useState("");

    const displayed = suratJalans.filter((sj) => {
        if (filterType !== "semua" && sj.type !== filterType) return false;
        if (search && ![sj.noSJ, sj.vendor, sj.dibuat_oleh].join(" ").toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const [expanded, setExpanded] = useState<string | null>(null);

    return (
        <div style={{ flex: 1, overflow: "auto", background: "white" }}>
            {/* Toolbar */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid #E6D5BE", background: "#FAF7F3", flexShrink: 0 }}>
                {(["semua", "customer", "pewarnaan"] as const).map((t) => (
                    <button key={t} onClick={() => setFilterType(t)}
                        style={{ padding: "4px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", background: filterType === t ? (t === "customer" ? "#DBEAFE" : t === "pewarnaan" ? "#FEF9C3" : "#EDE0D4") : "#F3F4F6", color: filterType === t ? (t === "customer" ? "#1D4ED8" : t === "pewarnaan" ? "#A16207" : "#5C4033") : "#9CA3AF", outline: filterType === t ? `2px solid ${t === "customer" ? "#1D4ED8" : t === "pewarnaan" ? "#A16207" : "#A67B5B"}` : "none", outlineOffset: -1 }}>
                        {t === "semua" ? "Semua" : t === "customer" ? "Untuk Customer" : "Untuk Pewarnaan"}
                    </button>
                ))}
                <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="🔍 Cari no. SJ, vendor..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 8px", fontSize: 11, width: 200, height: 28, color: "#5C4033", background: "#FFFBF7", outline: "none" }} />
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#B89678" }}>{displayed.length} surat jalan</span>
            </div>

            {displayed.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "55%", color: "#C5A882", fontSize: 13 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
                    <div style={{ fontWeight: 700 }}>Belum ada Surat Jalan</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Buat SJ dari tab <strong>Untuk Customer</strong> atau <strong>Untuk Pewarnaan</strong></div>
                </div>
            ) : (
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["Tanggal", "No. Surat Jalan", "Tipe", "Vendor / Ekspedisi", "Total Item", "Total Qty", "Dibuat Oleh", ""].map((h) => (
                                <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11, padding: "7px 10px", borderBottom: "2px solid #C5A882", borderRight: "1px solid #D1BFA3", whiteSpace: "nowrap", textAlign: h === "Total Item" || h === "Total Qty" ? "center" : "left", position: "sticky", top: 0, zIndex: 4 }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((sj, idx) => {
                            const totalQty = sj.items.reduce((a, it) => a + (parseFloat(it.qty) || 0), 0);
                            const isExpanded = expanded === sj.id;
                            const rowBg = idx % 2 === 1 ? "#FAFAF8" : "white";
                            return (
                                <React.Fragment key={sj.id}>
                                    <tr style={{ background: rowBg }}>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{fmtDateShort(sj.tanggal)}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", fontFamily: "monospace", fontSize: 11, color: "#A67B5B", fontWeight: 700 }}>{sj.noSJ}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE" }}>
                                            <span style={{ background: sj.type === "customer" ? "#DBEAFE" : "#FEF9C3", color: sj.type === "customer" ? "#1D4ED8" : "#A16207", borderRadius: 99, padding: "2px 8px", fontSize: 10, fontWeight: 700 }}>
                                                {sj.type === "customer" ? "Customer" : "Pewarnaan"}
                                            </span>
                                        </td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", fontWeight: 600 }}>{sj.vendor}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center", fontWeight: 700 }}>{sj.items.length}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center" }}>{totalQty > 0 ? totalQty.toFixed(2) : "—"}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", color: "#6B5E55" }}>{sj.dibuat_oleh}</td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={() => setExpanded(isExpanded ? null : sj.id)}
                                                    style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #D1BFA3", background: isExpanded ? "#EDE0D4" : "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#5C4033" }}>
                                                    {isExpanded ? "▲ Tutup" : "▼ Detail"}
                                                </button>
                                                <button onClick={() => deleteSJ(sj.id)}
                                                    style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#991B1B" }}>
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${sj.id}-detail`}>
                                            <td colSpan={8} style={{ padding: "0 0 0 30px", borderBottom: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                                                <table style={{ borderCollapse: "collapse", width: "calc(100% - 30px)", margin: "8px 0", fontSize: 11 }}>
                                                    <thead>
                                                        <tr>
                                                            {["No", "Customer", "Deskripsi", "Ukuran", "Qty", "No. Inv"].map((h) => (
                                                                <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", padding: "5px 8px", fontWeight: 700, fontSize: 10, textAlign: h === "No" || h === "Ukuran" || h === "Qty" ? "center" : "left", borderRight: "1px solid #D1BFA3" }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sj.items.map((it, i) => (
                                                            <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#FAFAF8" }}>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE", color: "#B89678" }}>{i + 1}</td>
                                                                <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", fontWeight: 600 }}>{it.customer}</td>
                                                                <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", color: "#555", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.deskripsi}</td>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE" }}>{it.ukuran || "—"}</td>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE", fontWeight: 700 }}>{it.qty || "—"}</td>
                                                                <td style={{ padding: "4px 8px", color: "#A67B5B" }}>{it.noInv || "—"}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

/* ================================================================
   SJ PREVIEW — shared right panel
================================================================ */
function SJPreview({ type, items, ekspedisi, dibuatOleh }: {
    type: "customer" | "pewarnaan";
    items: PesananRow[];
    ekspedisi: string;
    dibuatOleh: string;
}) {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);

    return (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#FAF7F3" }}>
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 20px rgba(92,64,51,0.09)", padding: "28px 32px", maxWidth: 700, margin: "0 auto" }}>
                {/* Kop */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1a1a1a" }}>
                    <div>
                        <div style={{ fontSize: 16, fontWeight: 900, color: "#1a1a1a", marginBottom: 3 }}>CV. TOTO ALUMINIUM MANUFACTURE</div>
                        <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>Jl. Rawa Mulya, Kota Bekasi<br />Telp: 0813 1191 2002</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 20, fontWeight: 900, color: "#1a1a1a", letterSpacing: 1 }}>SURAT JALAN</div>
                        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                            {type === "customer" ? "Untuk Customer" : "Untuk Pewarnaan"}
                        </div>
                    </div>
                </div>

                {/* Meta */}
                <div style={{ marginBottom: 18 }}>
                    <table style={{ fontSize: 12 }}>
                        <tbody>
                            {[
                                ["Tanggal", fmtDateLong(todayISO)],
                                [type === "customer" ? "Ekspedisi" : "Vendor Warna", ekspedisi || <span style={{ color: "#C5A882", fontStyle: "italic" }}>belum diisi...</span>],
                                ["Dibuat Oleh", dibuatOleh || "—"],
                            ].map(([k, v]) => (
                                <tr key={String(k)}>
                                    <td style={{ color: "#666", paddingRight: 14, paddingBottom: 3, width: 110, whiteSpace: "nowrap" }}>{k}</td>
                                    <td style={{ fontWeight: 600, color: "#1a1a1a" }}>: {v}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Table */}
                {items.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "3rem 0", color: "#C5A882" }}>
                        <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih item dari panel kiri</div>
                    </div>
                ) : (
                    <>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    {["No", "Customer", "Deskripsi", "Ukuran", "Qty", "No. Inv"].map((h) => (
                                        <th key={h} style={{ background: "#111", color: "#fff", padding: "8px 10px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", textAlign: h === "No" || h === "Ukuran" || h === "Qty" ? "center" : "left" }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((r, i) => (
                                    <tr key={r.id} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                                        <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, color: "#B89678" }}>{i + 1}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 600 }}>{r.customer || "—"}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 12, color: "#444", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.deskripsi || "—"}</td>
                                        <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{r.ukuran || "—"}</td>
                                        <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700 }}>{r.qty || "—"}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 12, color: "#A67B5B" }}>{r.no_inv || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Total & Tanda Tangan */}
                        <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                            <div style={{ fontSize: 12, color: "#555" }}>
                                Total: <strong style={{ color: "#1a1a1a" }}>{items.length} item</strong>
                            </div>
                            <div style={{ display: "flex", gap: 40 }}>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ width: 100, borderTop: "1px solid #333", marginBottom: 5, marginTop: 36 }} />
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "#333" }}>Pengirim</div>
                                </div>
                                <div style={{ textAlign: "center" }}>
                                    <div style={{ width: 100, borderTop: "1px solid #333", marginBottom: 5, marginTop: 36 }} />
                                    <div style={{ fontSize: 10, fontWeight: 600, color: "#333" }}>Penerima</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

/* ================================================================
   PRINT FUNCTION
================================================================ */
function printSJ(noSJ: string, type: "customer" | "pewarnaan", vendor: string, tanggal: string, dibuatOleh: string, items: PesananRow[], catatan?: string) {
    const tipeLabel = type === "customer" ? "Untuk Customer" : "Untuk Pewarnaan";
    const vendorLabel = type === "customer" ? "Ekspedisi" : "Vendor Pewarnaan";
    const totalQty = items.reduce((a, r) => a + (parseFloat(r.qty) || 0), 0);

    const tableRows = items.map((r, i) => `
        <tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="font-weight:600">${r.customer || "—"}</td>
            <td>${r.deskripsi || "—"}</td>
            <td style="text-align:center">${r.ukuran || "—"}</td>
            <td style="text-align:center;font-weight:700">${r.qty || "—"}</td>
            <td style="text-align:center;color:#A67B5B">${r.no_inv || "—"}</td>
        </tr>`).join("");

    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>Surat Jalan ${noSJ}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px 40px; }
  .kop { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #111; }
  .company-name { font-size:17px; font-weight:900; margin-bottom:4px; }
  .company-info { font-size:11px; color:#555; line-height:1.6; }
  .sj-title { font-size:22px; font-weight:900; letter-spacing:1px; }
  .sj-sub { font-size:11px; color:#666; margin-top:4px; text-align:right; }
  .meta table { font-size:12px; margin:16px 0; }
  .meta td { padding:3px 0; }
  .meta td:first-child { color:#555; width:120px; }
  .meta td:last-child { font-weight:600; }
  table.items { width:100%; border-collapse:collapse; margin-top:18px; }
  table.items thead th { background:#111; color:#fff; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; text-align:left; }
  table.items tbody td { padding:7px 10px; border-bottom:1px solid #E5E5E5; font-size:12px; }
  table.items tbody tr:nth-child(even) td { background:#FAFAFA; }
  .summary { margin-top:10px; font-size:12px; color:#555; }
  .catatan { margin-top:12px; font-size:11px; color:#555; font-style:italic; }
  .footer { margin-top:44px; display:flex; justify-content:space-around; }
  .sign { text-align:center; }
  .sign-line { width:120px; border-top:1px solid #333; margin:36px auto 6px; }
  .sign p { font-size:11px; font-weight:600; }
  @media print { body { padding:18px; } }
</style>
</head>
<body>
  <div class="kop">
    <div>
      <div class="company-name">CV. TOTO ALUMINIUM MANUFACTURE</div>
      <div class="company-info">Jl. Rawa Mulya, Kota Bekasi<br/>Telp: 0813 1191 2002</div>
    </div>
    <div>
      <div class="sj-title">SURAT JALAN</div>
      <div class="sj-sub">${tipeLabel}</div>
    </div>
  </div>

  <div class="meta">
    <table>
      <tr><td>No. Surat Jalan</td><td>: <strong>${noSJ}</strong></td></tr>
      <tr><td>Tanggal</td><td>: ${fmtDateLong(tanggal)}</td></tr>
      <tr><td>${vendorLabel}</td><td>: ${vendor}</td></tr>
      <tr><td>Dibuat Oleh</td><td>: ${dibuatOleh || "—"}</td></tr>
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:38px;text-align:center">No</th>
        <th style="width:130px">Customer</th>
        <th>Deskripsi</th>
        <th style="width:68px;text-align:center">Ukuran</th>
        <th style="width:55px;text-align:center">Qty</th>
        <th style="width:75px;text-align:center">No. Inv</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="summary">Total: <strong>${items.length} item</strong> &nbsp;|&nbsp; Total Qty: <strong>${totalQty > 0 ? totalQty.toFixed(2) : "—"}</strong></div>
  ${catatan ? `<div class="catatan">Catatan: ${catatan}</div>` : ""}

  <div class="footer">
    <div class="sign"><div class="sign-line"></div><p>Pengirim</p></div>
    <div class="sign"><div class="sign-line"></div><p>Sopir / Ekspedisi</p></div>
    <div class="sign"><div class="sign-line"></div><p>Penerima</p></div>
  </div>

<script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`);
    win.document.close();
}

/* ================================================================
   MAIN PAGE
================================================================ */
export default function SuratJalanPage() {
    const [activeTab, setActiveTab] = useState<"customer" | "pewarnaan" | "log">("customer");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}>
            {/* Tab navigation */}
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, paddingLeft: 14 }}>
                <button onClick={() => setActiveTab("customer")} style={tabStyle("customer")}>📦 Untuk Customer</button>
                <button onClick={() => setActiveTab("pewarnaan")} style={tabStyle("pewarnaan")}>🎨 Untuk Pewarnaan</button>
                <button onClick={() => setActiveTab("log")} style={tabStyle("log")}>📜 Surat Jalan Log</button>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {activeTab === "customer" && <TabCustomer />}
                {activeTab === "pewarnaan" && <TabPewarnaan />}
                {activeTab === "log" && <TabLog />}
            </div>
        </div>
    );
}
