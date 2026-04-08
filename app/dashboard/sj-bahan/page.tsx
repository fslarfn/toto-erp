"use client";
import React, { useState, useMemo } from "react";
import { useStore } from "@/lib/store";
import { useSJBahan, SJBahanItem } from "@/lib/sj-bahan-store";

/* ================================================================
   SURAT JALAN BAHAN BAKU — /dashboard/sj-bahan
   Khusus kirim bahan baku ke vendor pewarnaan
   (Coatindo, Tegar Lestari, dll)
   Terpisah dari Surat Jalan pesanan
================================================================ */

const VENDOR_PRESETS = ["Coatindo", "Tegar Lestari"];
const PANJANG_DEFAULT = 6; // meter per batang

const MONTH_NAMES_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

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
function generateNoSJB(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, "0");
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const yy = String(now.getFullYear()).slice(2);
    const ts = String(Date.now()).slice(-5);
    return `SJB-${dd}${mm}${yy}-${ts}`;
}

/* ================================================================
   TAB: BUAT SJ BAHAN BAKU
================================================================ */
function TabBuatSJ() {
    const { materials, updateMaterial } = useStore();
    const { addSJBahan } = useSJBahan();

    // Filter hanya bahan baku yang punya stok
    const bahanBaku = useMemo(() =>
        materials.filter(m => m.category === "Bahan Baku" && m.currentStock > 0),
        [materials]
    );

    const [vendorWarna, setVendorWarna] = useState("");
    const [warna, setWarna] = useState("");
    const [dibuatOleh, setDibuatOleh] = useState("");
    const [selectedItems, setSelectedItems] = useState<{ materialId: string; kode: string; nama: string; jumlahBatang: number; panjang: number }[]>([]);
    const [flash, setFlash] = useState(false);
    const [lastNoSJ, setLastNoSJ] = useState("");

    const toggleBahan = (m: typeof bahanBaku[0]) => {
        setSelectedItems(prev => {
            const exists = prev.find(s => s.materialId === m.id);
            if (exists) return prev.filter(s => s.materialId !== m.id);
            return [...prev, { materialId: m.id, kode: m.code, nama: m.name, jumlahBatang: 1, panjang: PANJANG_DEFAULT }];
        });
    };

    const updateItem = (materialId: string, field: "jumlahBatang" | "panjang", value: number) => {
        setSelectedItems(prev => prev.map(s =>
            s.materialId === materialId ? { ...s, [field]: value } : s
        ));
    };

    const totalBatang = selectedItems.reduce((a, s) => a + s.jumlahBatang, 0);
    const totalMeter = selectedItems.reduce((a, s) => a + (s.jumlahBatang * s.panjang), 0);

    const cetakSJ = () => {
        if (selectedItems.length === 0 || !vendorWarna) return;
        const noSJ = generateNoSJB();
        const todayISO = new Date().toISOString().slice(0, 10);

        const items: SJBahanItem[] = selectedItems.map(s => ({
            materialId: s.materialId,
            kode: s.kode,
            nama: s.nama,
            jumlahBatang: s.jumlahBatang,
            panjangPerBatang: s.panjang,
            totalMeter: s.jumlahBatang * s.panjang,
            catatan: "",
        }));

        addSJBahan({
            noSJ,
            tanggal: todayISO,
            vendorWarna,
            warna,
            dibuatOleh: dibuatOleh || "—",
            items,
            totalBatang,
            totalMeter,
            status: "dikirim",
        });

        // Kurangi stok di Stok Bahan
        selectedItems.forEach(s => {
            const mat = materials.find(m => m.id === s.materialId);
            if (mat) {
                const newStock = Math.max(0, mat.currentStock - s.jumlahBatang);
                updateMaterial(s.materialId, { currentStock: newStock, lastUpdated: new Date().toISOString().slice(0, 10) });
            }
        });

        setLastNoSJ(noSJ);

        // Print
        printSJBahan(noSJ, todayISO, vendorWarna, warna, dibuatOleh, items, totalBatang, totalMeter);

        setFlash(true);
        setSelectedItems([]);
        setVendorWarna("");
        setWarna("");
        setTimeout(() => setFlash(false), 3000);
    };

    return (
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
            {/* LEFT — Pilih Bahan */}
            <div style={{ width: 400, minWidth: 320, background: "white", borderRight: "1px solid #E6D5BE", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid #F0E6D8" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#5C4033", marginBottom: 8 }}>🏭 Pilih Bahan Baku untuk Dikirim ke Pewarnaan</div>
                    <div style={{ fontSize: 11, color: "#B89678" }}>{bahanBaku.length} bahan tersedia • <strong style={{ color: "#A67B5B" }}>{selectedItems.length} dipilih</strong></div>
                </div>

                <div style={{ flex: 1, overflowY: "auto" }}>
                    {bahanBaku.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 1rem", color: "#C5A882", fontSize: 12 }}>
                            <div style={{ fontSize: 40, marginBottom: 8 }}>📦</div>
                            Tidak ada bahan baku dengan stok tersedia.<br />Tambah bahan di menu <strong>Stok Bahan</strong>.
                        </div>
                    ) : (
                        bahanBaku.map((m) => {
                            const sel = selectedItems.find(s => s.materialId === m.id);
                            const isSel = !!sel;
                            return (
                                <div key={m.id} style={{ borderBottom: "1px solid #F5F0EC", background: isSel ? "#FEF3E8" : "white" }}>
                                    <div onClick={() => toggleBahan(m)}
                                        style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", cursor: "pointer", borderLeft: isSel ? "3px solid #A67B5B" : "3px solid transparent" }}>
                                        <input type="checkbox" checked={isSel} readOnly style={{ accentColor: "#A67B5B", flexShrink: 0 }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 700, fontSize: 12, color: "#3C2F2F" }}>{m.name}</div>
                                            <div style={{ fontSize: 10, color: "#B89678", marginTop: 2 }}>
                                                Kode: {m.code} • Stok: <strong>{m.currentStock} {m.unit}</strong> • {m.location}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Input jumlah batang & panjang */}
                                    {isSel && sel && (
                                        <div style={{ display: "flex", gap: 10, padding: "6px 16px 10px 42px", background: "#FEF9F0", alignItems: "flex-end", flexWrap: "wrap" }}>
                                            <div>
                                                <label style={{ fontSize: 9, fontWeight: 700, color: "#B89678", textTransform: "uppercase", letterSpacing: 1 }}>
                                                    Jumlah Batang <span style={{ color: "#A67B5B", fontWeight: 600 }}>(maks {m.currentStock})</span>
                                                </label>
                                                <input type="number" min={1} max={m.currentStock} value={sel.jumlahBatang}
                                                    onChange={e => updateItem(m.id, "jumlahBatang", Math.min(m.currentStock, Math.max(1, parseInt(e.target.value) || 1)))}
                                                    style={{ width: 80, border: sel.jumlahBatang > m.currentStock ? "1.5px solid #ef4444" : "1.5px solid #D1BFA3", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", display: "block", marginTop: 3 }} />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: 9, fontWeight: 700, color: "#B89678", textTransform: "uppercase", letterSpacing: 1 }}>Panjang (m)</label>
                                                <input type="number" min={1} step="0.5" value={sel.panjang}
                                                    onChange={e => updateItem(m.id, "panjang", Math.max(0.5, parseFloat(e.target.value) || PANJANG_DEFAULT))}
                                                    style={{ width: 80, border: "1.5px solid #D1BFA3", borderRadius: 6, padding: "5px 8px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", display: "block", marginTop: 3 }} />
                                            </div>
                                            <div style={{ paddingBottom: 4 }}>
                                                <span style={{ fontSize: 11, color: "#A67B5B", fontWeight: 700 }}>
                                                    = {(sel.jumlahBatang * sel.panjang).toFixed(1)}m total
                                                </span>
                                                <span style={{ fontSize: 10, color: "#B89678", marginLeft: 8 }}>
                                                    (sisa stok: {m.currentStock - sel.jumlahBatang} {m.unit})
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Form bottom */}
                <div style={{ padding: "14px 16px", borderTop: "1px solid #E6D5BE", background: "#FAFAF8" }}>
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Vendor Pewarnaan *</label>
                        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            {VENDOR_PRESETS.map(v => (
                                <button key={v} onClick={() => setVendorWarna(v)}
                                    style={{
                                        padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: "pointer",
                                        border: vendorWarna === v ? "1.5px solid #A67B5B" : "1.5px solid #D1BFA3",
                                        background: vendorWarna === v ? "#A67B5B" : "white",
                                        color: vendorWarna === v ? "white" : "#6B5E55",
                                    }}>
                                    {v}
                                </button>
                            ))}
                        </div>
                        <input type="text" value={vendorWarna} onChange={e => setVendorWarna(e.target.value)}
                            placeholder="Atau ketik nama vendor lain..."
                            style={{ width: "100%", border: `1.5px solid ${vendorWarna ? "#A67B5B" : "#D1BFA3"}`, borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Warna yang Diminta</label>
                        <input type="text" value={warna} onChange={e => setWarna(e.target.value)}
                            placeholder="cth: Silver, Hitam, Coklat Tua..."
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div style={{ marginBottom: 10 }}>
                        <label style={{ fontSize: 10, fontWeight: 700, color: "#B89678", letterSpacing: 1, textTransform: "uppercase", display: "block", marginBottom: 4 }}>Dibuat Oleh</label>
                        <input type="text" value={dibuatOleh} onChange={e => setDibuatOleh(e.target.value)}
                            placeholder="Nama operator..."
                            style={{ width: "100%", border: "1.5px solid #D1BFA3", borderRadius: 7, padding: "7px 10px", fontSize: 12, color: "#3C2F2F", background: "white", outline: "none", boxSizing: "border-box" }} />
                    </div>

                    {/* Summary */}
                    {selectedItems.length > 0 && (
                        <div style={{ background: "#EDE0D4", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "#5C4033" }}>Total Batang:</span>
                                <strong style={{ color: "#5C4033" }}>{totalBatang} batang</strong>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                                <span style={{ color: "#5C4033" }}>Total Meter:</span>
                                <strong style={{ color: "#5C4033" }}>{totalMeter.toFixed(1)} meter</strong>
                            </div>
                        </div>
                    )}

                    {flash && <div style={{ background: "#DCFCE7", color: "#15803D", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontWeight: 700, marginBottom: 8 }}>✓ SJ {lastNoSJ} berhasil dibuat & dicetak!</div>}

                    <button onClick={cetakSJ}
                        disabled={selectedItems.length === 0 || !vendorWarna}
                        style={{
                            width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                            padding: "10px 0", borderRadius: 8, border: "none",
                            cursor: selectedItems.length === 0 || !vendorWarna ? "not-allowed" : "pointer",
                            fontWeight: 800, fontSize: 13,
                            background: selectedItems.length === 0 || !vendorWarna ? "#D1BFA3" : "#A67B5B",
                            color: "white",
                            opacity: selectedItems.length === 0 || !vendorWarna ? 0.5 : 1,
                        }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Buat & Cetak SJ Bahan Baku ({selectedItems.length} bahan)
                    </button>
                </div>
            </div>

            {/* RIGHT — Preview */}
            <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#FAF7F3" }}>
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 20px rgba(92,64,51,0.09)", padding: "28px 32px", maxWidth: 700, margin: "0 auto" }}>
                    {/* Kop */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1a1a1a" }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: "#1a1a1a", marginBottom: 3 }}>CV. TOTO ALUMINIUM MANUFACTURE</div>
                            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>Jl. Rawa Mulya, Kota Bekasi<br />Telp: 0813 1191 2002</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "#1a1a1a", letterSpacing: 1 }}>SURAT JALAN</div>
                            <div style={{ fontSize: 11, color: "#A16207", fontWeight: 700, marginTop: 4 }}>Bahan Baku ke Pewarnaan</div>
                        </div>
                    </div>

                    {/* Meta */}
                    <div style={{ marginBottom: 18 }}>
                        <table style={{ fontSize: 12 }}>
                            <tbody>
                                {[
                                    ["Tanggal", fmtDateLong(new Date().toISOString().slice(0, 10))],
                                    ["Vendor Pewarnaan", vendorWarna || <span style={{ color: "#C5A882", fontStyle: "italic" }}>belum dipilih...</span>],
                                    ["Warna", warna || "—"],
                                    ["Dibuat Oleh", dibuatOleh || "—"],
                                ].map(([k, v]) => (
                                    <tr key={String(k)}>
                                        <td style={{ color: "#666", paddingRight: 14, paddingBottom: 3, width: 130, whiteSpace: "nowrap" }}>{k}</td>
                                        <td style={{ fontWeight: 600, color: "#1a1a1a" }}>: {v}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Table */}
                    {selectedItems.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "3rem 0", color: "#C5A882" }}>
                            <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                            <div style={{ fontSize: 13, fontWeight: 700 }}>Pilih bahan baku dari panel kiri</div>
                        </div>
                    ) : (
                        <>
                            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                    <tr>
                                        {["No", "Kode", "Nama Bahan", "Jumlah (Btg)", "Panjang (m)", "Total (m)"].map(h => (
                                            <th key={h} style={{
                                                background: "#111", color: "#fff", padding: "8px 10px", fontSize: 11,
                                                fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px",
                                                textAlign: h === "No" || h.includes("Btg") || h.includes("m") ? "center" : "left",
                                            }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {selectedItems.map((s, i) => (
                                        <tr key={s.materialId} style={{ background: i % 2 === 0 ? "white" : "#FAFAFA" }}>
                                            <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, color: "#B89678" }}>{i + 1}</td>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 11, fontFamily: "monospace", color: "#A67B5B" }}>{s.kode}</td>
                                            <td style={{ padding: "7px 10px", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 600 }}>{s.nama}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700 }}>{s.jumlahBatang}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12 }}>{s.panjang}</td>
                                            <td style={{ padding: "7px 10px", textAlign: "center", borderBottom: "1px solid #F0F0F0", fontSize: 12, fontWeight: 700, color: "#A67B5B" }}>{(s.jumlahBatang * s.panjang).toFixed(1)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                                <div>Total: <strong style={{ color: "#1a1a1a" }}>{selectedItems.length} bahan</strong></div>
                                <div>Total: <strong style={{ color: "#1a1a1a" }}>{totalBatang} batang</strong> = <strong style={{ color: "#A67B5B" }}>{totalMeter.toFixed(1)} meter</strong></div>
                            </div>

                            {/* Tanda tangan */}
                            <div style={{ marginTop: 44, display: "flex", justifyContent: "space-around" }}>
                                {["Pengirim", "Sopir", "Penerima"].map(label => (
                                    <div key={label} style={{ textAlign: "center" }}>
                                        <div style={{ width: 120, borderTop: "1px solid #333", marginBottom: 6, marginTop: 36 }} />
                                        <div style={{ fontSize: 10, fontWeight: 600, color: "#333" }}>{label}</div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ================================================================
   TAB: RIWAYAT SJ BAHAN BAKU
================================================================ */
function TabRiwayat() {
    const { sjBahan, updateSJBahan, deleteSJBahan } = useSJBahan();
    const [search, setSearch] = useState("");
    const [expanded, setExpanded] = useState<string | null>(null);

    const displayed = sjBahan.filter(sj => {
        if (!search) return true;
        return [sj.noSJ, sj.vendorWarna, sj.warna, sj.dibuatOleh].join(" ").toLowerCase().includes(search.toLowerCase());
    });

    return (
        <div style={{ flex: 1, overflow: "auto", background: "white" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderBottom: "1px solid #E6D5BE", background: "#FAF7F3", flexShrink: 0 }}>
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="🔍 Cari no. SJ, vendor, warna..."
                    style={{ border: "1px solid #D1BFA3", borderRadius: 5, padding: "4px 8px", fontSize: 11, width: 250, height: 28, color: "#5C4033", background: "#FFFBF7", outline: "none" }} />
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#B89678" }}>{displayed.length} surat jalan</span>
            </div>

            {displayed.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "55%", color: "#C5A882", fontSize: 13 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📜</div>
                    <div style={{ fontWeight: 700 }}>Belum ada SJ Bahan Baku</div>
                    <div style={{ fontSize: 11, marginTop: 4 }}>Buat SJ dari tab <strong>Buat SJ Baru</strong></div>
                </div>
            ) : (
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
                    <thead>
                        <tr>
                            {["Tanggal", "No. Surat Jalan", "Vendor", "Warna", "Total Batang", "Total Meter", "Status", "Dibuat Oleh", ""].map(h => (
                                <th key={h} style={{
                                    background: "#EDE0D4", color: "#5C4033", fontWeight: 700, fontSize: 11,
                                    padding: "7px 10px", borderBottom: "2px solid #C5A882", borderRight: "1px solid #D1BFA3",
                                    whiteSpace: "nowrap", textAlign: ["Total Batang", "Total Meter"].includes(h) ? "center" : "left",
                                    position: "sticky", top: 0, zIndex: 4,
                                }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {displayed.map((sj, idx) => {
                            const isExpanded = expanded === sj.id;
                            return (
                                <React.Fragment key={sj.id}>
                                    <tr style={{ background: idx % 2 === 1 ? "#FAFAF8" : "white" }}>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>{fmtDateShort(sj.tanggal)}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", fontFamily: "monospace", fontSize: 11, color: "#A67B5B", fontWeight: 700 }}>{sj.noSJ}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", fontWeight: 600 }}>{sj.vendorWarna}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE" }}>{sj.warna || "—"}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center", fontWeight: 700 }}>{sj.totalBatang}</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", textAlign: "center", fontWeight: 700, color: "#A67B5B" }}>{sj.totalMeter.toFixed(1)}m</td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE" }}>
                                            <button onClick={() => updateSJBahan(sj.id, { status: sj.status === "dikirim" ? "selesai" : "dikirim" })}
                                                style={{
                                                    padding: "2px 10px", borderRadius: 99, border: "none", cursor: "pointer",
                                                    fontSize: 10, fontWeight: 700,
                                                    background: sj.status === "selesai" ? "#DCFCE7" : "#FEF9C3",
                                                    color: sj.status === "selesai" ? "#15803D" : "#A16207",
                                                }}>
                                                {sj.status === "selesai" ? "✅ Selesai" : "📦 Dikirim"}
                                            </button>
                                        </td>
                                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #E6D5BE", borderRight: "1px solid #E6D5BE", color: "#6B5E55" }}>{sj.dibuatOleh}</td>
                                        <td style={{ padding: "4px 8px", borderBottom: "1px solid #E6D5BE", whiteSpace: "nowrap" }}>
                                            <div style={{ display: "flex", gap: 4 }}>
                                                <button onClick={() => setExpanded(isExpanded ? null : sj.id)}
                                                    style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #D1BFA3", background: isExpanded ? "#EDE0D4" : "white", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#5C4033" }}>
                                                    {isExpanded ? "▲ Tutup" : "▼ Detail"}
                                                </button>
                                                <button onClick={() => { if (confirm("Hapus SJ ini?")) deleteSJBahan(sj.id); }}
                                                    style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontSize: 10, fontWeight: 600, color: "#991B1B" }}>
                                                    Hapus
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={9} style={{ padding: "0 0 0 30px", borderBottom: "1px solid #E6D5BE", background: "#FAF7F3" }}>
                                                <table style={{ borderCollapse: "collapse", width: "calc(100% - 30px)", margin: "8px 0", fontSize: 11 }}>
                                                    <thead>
                                                        <tr>
                                                            {["No", "Kode", "Nama Bahan", "Jumlah Batang", "Panjang/Btg", "Total Meter"].map(h => (
                                                                <th key={h} style={{ background: "#EDE0D4", color: "#5C4033", padding: "5px 8px", fontWeight: 700, fontSize: 10, textAlign: ["No", "Jumlah Batang", "Panjang/Btg", "Total Meter"].includes(h) ? "center" : "left", borderRight: "1px solid #D1BFA3" }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {sj.items.map((it, i) => (
                                                            <tr key={i} style={{ background: i % 2 === 0 ? "white" : "#FAFAF8" }}>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE", color: "#B89678" }}>{i + 1}</td>
                                                                <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", fontFamily: "monospace", fontSize: 10 }}>{it.kode}</td>
                                                                <td style={{ padding: "4px 8px", borderRight: "1px solid #E6D5BE", fontWeight: 600 }}>{it.nama}</td>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE", fontWeight: 700 }}>{it.jumlahBatang}</td>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", borderRight: "1px solid #E6D5BE" }}>{it.panjangPerBatang}m</td>
                                                                <td style={{ padding: "4px 8px", textAlign: "center", fontWeight: 700, color: "#A67B5B" }}>{it.totalMeter.toFixed(1)}m</td>
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
   PRINT FUNCTION
================================================================ */
function printSJBahan(noSJ: string, tanggal: string, vendor: string, warna: string, dibuatOleh: string, items: SJBahanItem[], totalBatang: number, totalMeter: number) {
    const tableRows = items.map((it, i) => `
        <tr>
            <td style="text-align:center">${i + 1}</td>
            <td style="font-family:monospace;font-size:11px;color:#A67B5B">${it.kode}</td>
            <td style="font-weight:600">${it.nama}</td>
            <td style="text-align:center;font-weight:700">${it.jumlahBatang}</td>
            <td style="text-align:center">${it.panjangPerBatang}m</td>
            <td style="text-align:center;font-weight:700">${it.totalMeter.toFixed(1)}m</td>
        </tr>`).join("");

    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8"/>
<title>Surat Jalan Bahan Baku ${noSJ}</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 32px 40px; }
  .kop { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px; padding-bottom:16px; border-bottom:2px solid #111; }
  .company-name { font-size:17px; font-weight:900; margin-bottom:4px; }
  .company-info { font-size:11px; color:#555; line-height:1.6; }
  .sj-title { font-size:22px; font-weight:900; letter-spacing:1px; }
  .sj-sub { font-size:11px; color:#A16207; font-weight:700; margin-top:4px; text-align:right; }
  .meta table { font-size:12px; margin:16px 0; }
  .meta td { padding:3px 0; }
  .meta td:first-child { color:#555; width:130px; }
  .meta td:last-child { font-weight:600; }
  table.items { width:100%; border-collapse:collapse; margin-top:18px; }
  table.items thead th { background:#111; color:#fff; padding:8px 10px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; text-align:left; }
  table.items tbody td { padding:7px 10px; border-bottom:1px solid #E5E5E5; font-size:12px; }
  table.items tbody tr:nth-child(even) td { background:#FAFAFA; }
  .summary { margin-top:10px; font-size:12px; color:#555; }
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
      <div class="sj-sub">Bahan Baku ke Pewarnaan</div>
    </div>
  </div>

  <div class="meta">
    <table>
      <tr><td>No. Surat Jalan</td><td>: <strong>${noSJ}</strong></td></tr>
      <tr><td>Tanggal</td><td>: ${fmtDateLong(tanggal)}</td></tr>
      <tr><td>Vendor Pewarnaan</td><td>: ${vendor}</td></tr>
      <tr><td>Warna</td><td>: ${warna || "—"}</td></tr>
      <tr><td>Dibuat Oleh</td><td>: ${dibuatOleh || "—"}</td></tr>
    </table>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th style="width:38px;text-align:center">No</th>
        <th style="width:80px">Kode</th>
        <th>Nama Bahan</th>
        <th style="width:90px;text-align:center">Jml Batang</th>
        <th style="width:85px;text-align:center">Panjang/Btg</th>
        <th style="width:85px;text-align:center">Total (m)</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <div class="summary">Total: <strong>${items.length} bahan</strong> &nbsp;|&nbsp; Total Batang: <strong>${totalBatang}</strong> &nbsp;|&nbsp; Total Meter: <strong>${totalMeter.toFixed(1)}m</strong></div>

  <div class="footer">
    <div class="sign"><div class="sign-line"></div><p>Pengirim</p></div>
    <div class="sign"><div class="sign-line"></div><p>Sopir</p></div>
    <div class="sign"><div class="sign-line"></div><p>Penerima</p></div>
  </div>

<script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`);
    win.document.close();
}

/* ================================================================
   MAIN PAGE
================================================================ */
export default function SJBahanPage() {
    const [activeTab, setActiveTab] = useState<"buat" | "riwayat">("buat");

    const tabStyle = (key: typeof activeTab): React.CSSProperties => ({
        padding: "10px 22px", fontSize: 13, fontWeight: 700, border: "none",
        borderBottom: activeTab === key ? "3px solid #A67B5B" : "3px solid transparent",
        background: "white", color: activeTab === key ? "#A67B5B" : "#9CA3AF",
        cursor: "pointer", transition: "color .15s", whiteSpace: "nowrap",
    });

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)", overflow: "hidden", background: "#F5EBDD" }}>
            <div style={{ display: "flex", background: "white", borderBottom: "1px solid #E6D5BE", flexShrink: 0, paddingLeft: 14 }}>
                <button onClick={() => setActiveTab("buat")} style={tabStyle("buat")}>🏭 Buat SJ Baru</button>
                <button onClick={() => setActiveTab("riwayat")} style={tabStyle("riwayat")}>📜 Riwayat SJ Bahan</button>
            </div>
            <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                {activeTab === "buat" && <TabBuatSJ />}
                {activeTab === "riwayat" && <TabRiwayat />}
            </div>
        </div>
    );
}
