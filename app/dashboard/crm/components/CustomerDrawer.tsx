"use client";
// Drawer Customer 360 (Tahap 8) — sesuai mockup TotoCRMUnified:
// panel kanan berisi profil lengkap (tipe, tier, status, wilayah, PIC,
// No. WA), stat Total order & Piutang, tombol Chat WA & Buat pesanan,
// dan tab Riwayat order / Piutang / Aktivitas WA (placeholder integrasi).
import { useState, useEffect } from "react";
import Link from "next/link";
import { X, MapPin, MessageCircle, Plus, ShoppingBag, Wallet, Send, Pencil } from "lucide-react";
import type { Customer } from "@/types";
import {
    daysSince, tierOf, ordersOf, orderRowValue, isoDate,
    DORMANT_DAYS, type CustomerStat, type OrderRowLike,
} from "@/lib/crm-analytics";
import { findMarketer, type Marketer } from "@/lib/crm-marketers";
import { waGreeting, waPiutang, waLink } from "@/lib/crm-wa";
import { formatCurrency, formatDate } from "@/lib/utils";
import { typeMeta } from "./shared";
import { StatusDot, TierBadge } from "./TabDirektori";

interface Props {
    c: Customer;
    stat: CustomerStat;
    rows: OrderRowLike[];
    marketers: Marketer[];
    onClose: () => void;
    onEdit: () => void;
}

export default function CustomerDrawer({ c, stat, rows, marketers, onClose, onEdit }: Props) {
    const [t, setT] = useState<"order" | "piutang" | "wa">("order");

    // Esc utk menutup — drawer dipakai intensif dgn keyboard.
    useEffect(() => {
        const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [onClose]);

    const hasOrder = !!stat.last;
    const dormant = hasOrder && daysSince(stat.last) >= DORMANT_DAYS;
    const tier = tierOf(stat.total);
    const tm = typeMeta(c.type);
    const mk = findMarketer(marketers, c.marketingId);
    const waChat = waLink(c.phone, waGreeting(c.name, c.pic));
    const invs = Array.from(stat.unpaidInvoices);
    const waTagih = waLink(c.phone, waPiutang(c.name, c.pic, stat.unpaid, invs));
    const recent = ordersOf(rows, c.name).slice(0, 25);
    const umurPiutang = stat.unpaid > 0 ? daysSince(stat.oldestUnpaid) : 0;

    return (
        <>
            <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(61,46,30,.35)", zIndex: 1000 }} />
            <div role="dialog" aria-modal="true" aria-label={`Detail customer ${c.name}`}
                style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 440, maxWidth: "94vw", background: "#FDF8F3", borderLeft: "1px solid #E6D5BE", overflowY: "auto", boxShadow: "-8px 0 40px rgba(61,46,30,.16)", zIndex: 1001, display: "flex", flexDirection: "column" }}>

                {/* Header profil */}
                <div style={{ background: "#fff", padding: "18px 20px", borderBottom: "1px solid #E6D5BE" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span className="badge" style={{ background: tm.color + "1A", color: tm.color, fontSize: 10 }}>{tm.label}</span>
                                <TierBadge t={tier} />
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5, color: !hasOrder ? "#8A7B6E" : dormant ? "#C99A3A" : "#15803D", fontWeight: 600 }}>
                                    <StatusDot dormant={dormant} hasOrder={hasOrder} />{!hasOrder ? "Belum order" : dormant ? "Dormant" : "Aktif"}
                                </span>
                            </div>
                            <h2 style={{ fontSize: 18, fontWeight: 800, color: "#3C2F2F", margin: "9px 0 3px", overflowWrap: "anywhere" }}>{c.name}</h2>
                            <div style={{ fontSize: 12, color: "#8A6D55", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {(c.kota ?? "").trim() && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><MapPin size={11} />{c.kota}</span>}
                                {mk && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 99, background: mk.color }} />PIC {mk.name}</span>}
                                {c.pic && <span>Kontak: {c.pic}</span>}
                            </div>
                            <div style={{ fontSize: 12.5, marginTop: 4 }}>
                                {c.phone.trim()
                                    ? <span style={{ color: "#15803D", fontWeight: 600 }}>📱 {c.phone}</span>
                                    : <span style={{ color: "#B8860B" }}>No. WA belum ada — <button onClick={onEdit} style={{ background: "none", border: "none", padding: 0, color: "#A67B5B", fontWeight: 700, cursor: "pointer", textDecoration: "underline", fontSize: 12.5 }}>lengkapi</button></span>}
                            </div>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                            <button onClick={onEdit} title="Edit customer" style={{ background: "#FDF8F3", border: "1px solid #E6D5BE", borderRadius: 8, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", color: "#A67B5B" }}><Pencil size={14} /></button>
                            <button onClick={onClose} title="Tutup (Esc)" style={{ background: "#FDF8F3", border: "1px solid #E6D5BE", borderRadius: 8, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", color: "#8A6D55" }}><X size={16} /></button>
                        </div>
                    </div>

                    {/* Dua stat */}
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                        <div style={{ flex: 1, background: "#FDF8F3", border: "1px solid #E6D5BE", borderRadius: 10, padding: "10px 13px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#B89678", fontWeight: 700 }}><ShoppingBag size={12} /> TOTAL ORDER</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F", marginTop: 3 }}>{formatCurrency(stat.total)}</div>
                            <div style={{ fontSize: 10.5, color: "#C5A882" }}>{(stat.invoices.size || stat.count).toLocaleString("id-ID")} order{stat.last ? ` · terakhir ${formatDate(stat.last)}` : ""}</div>
                        </div>
                        <div style={{ flex: 1, background: "#FDF8F3", border: "1px solid #E6D5BE", borderRadius: 10, padding: "10px 13px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: "#B89678", fontWeight: 700 }}><Wallet size={12} /> PIUTANG</div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: stat.unpaid > 0 ? "#B91C1C" : "#15803D", marginTop: 3 }}>{stat.unpaid > 0 ? formatCurrency(stat.unpaid) : "—"}</div>
                            {stat.unpaid > 0 && <div style={{ fontSize: 10.5, color: "#C5A882" }}>{umurPiutang > 0 ? `lewat ${umurPiutang} hari` : "baru"}</div>}
                        </div>
                    </div>

                    {/* Aksi */}
                    <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
                        {waChat ? (
                            <a href={waChat} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ flex: 1, justifyContent: "center", background: "#16a34a", fontSize: 13 }}><MessageCircle size={14} style={{ marginRight: 5 }} />Chat WA</a>
                        ) : (
                            <button disabled className="btn btn-primary" title="Belum ada No. WA" style={{ flex: 1, justifyContent: "center", fontSize: 13, opacity: 0.5, cursor: "not-allowed" }}><MessageCircle size={14} style={{ marginRight: 5 }} />Chat WA</button>
                        )}
                        <Link href="/dashboard/pesanan" className="btn btn-secondary" style={{ flex: 1, justifyContent: "center", fontSize: 13, textAlign: "center" }}><Plus size={14} style={{ marginRight: 5 }} />Buat pesanan</Link>
                    </div>
                </div>

                {/* Tab drawer */}
                <div style={{ display: "flex", gap: 18, padding: "0 20px", borderBottom: "1px solid #E6D5BE", background: "#fff" }}>
                    {([["order", "Riwayat order"], ["piutang", "Piutang"], ["wa", "Aktivitas WA"]] as const).map(([k, l]) => (
                        <button key={k} onClick={() => setT(k)}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, padding: "11px 0", fontWeight: t === k ? 700 : 500, color: t === k ? "#A67B5B" : "#9CA3AF", borderBottom: t === k ? "2.5px solid #A67B5B" : "2.5px solid transparent", marginBottom: -1 }}>{l}</button>
                    ))}
                </div>

                <div style={{ padding: "16px 20px", flex: 1 }}>
                    {/* Riwayat order */}
                    {t === "order" && (
                        recent.length === 0 ? (
                            <p style={{ fontSize: 13, color: "#B89678", textAlign: "center", padding: 20 }}>Belum ada order tercatat.</p>
                        ) : (
                            <>
                                {recent.map((r) => (
                                    <div key={r.id} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "10px 0", borderBottom: "1px solid #EFE5D6" }}>
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: 12.5, color: "#3C2F2F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.deskripsi || "—"}</div>
                                            <div style={{ fontSize: 11, color: "#B89678" }}>{isoDate(r.tanggal) ? formatDate(isoDate(r.tanggal)) : (r.tanggal || "—")}{r.no_inv ? ` · ${r.no_inv}` : ""}</div>
                                        </div>
                                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                                            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3C2F2F" }}>{formatCurrency(orderRowValue(r))}</div>
                                            {r.is_paid
                                                ? <span className="badge" style={{ background: "#DCFCE7", color: "#15803D", fontSize: 9.5 }}>Lunas</span>
                                                : <span className="badge" style={{ background: "#FEF2F2", color: "#991B1B", fontSize: 9.5 }}>Belum</span>}
                                        </div>
                                    </div>
                                ))}
                                {stat.count > recent.length && (
                                    <p style={{ fontSize: 11, color: "#B89678", marginTop: 8 }}>Menampilkan {recent.length} order terbaru dari {stat.count.toLocaleString("id-ID")} baris.</p>
                                )}
                            </>
                        )
                    )}

                    {/* Piutang */}
                    {t === "piutang" && (
                        stat.unpaid > 0 ? (
                            <div style={{ background: "#FBEEEC", border: "1px solid #E8C9C4", borderRadius: 10, padding: 16 }}>
                                <div style={{ fontSize: 20, fontWeight: 800, color: "#B91C1C" }}>{formatCurrency(stat.unpaid)}</div>
                                <div style={{ fontSize: 12.5, color: "#8E2A20", marginTop: 4 }}>
                                    {umurPiutang > 0 ? `Lewat ${umurPiutang} hari dari invoice tertua.` : "Invoice berjalan bulan ini."}
                                    {invs.length > 0 && <><br />Invoice: {invs.join(", ")}</>}
                                </div>
                                {waTagih ? (
                                    <a href={waTagih} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ background: "#16a34a", fontSize: 12.5, marginTop: 12, display: "inline-flex" }}><Send size={13} style={{ marginRight: 5 }} />Kirim pengingat WA</a>
                                ) : (
                                    <p style={{ fontSize: 11.5, color: "#8E2A20", marginTop: 10 }}>Belum ada No. WA — lengkapi dulu utk kirim pengingat.</p>
                                )}
                            </div>
                        ) : (
                            <p style={{ fontSize: 13, color: "#8A7B6E" }}>Tidak ada piutang berjalan. Pembayaran lancar. 👍</p>
                        )
                    )}

                    {/* Aktivitas WA — placeholder titik integrasi */}
                    {/* TODO: titik integrasi webhook WhatsApp — chat masuk dicatat di sini. */}
                    {t === "wa" && (
                        c.phone.trim() ? (
                            <div style={{ fontSize: 13, color: "#8A6D55", lineHeight: 1.65 }}>
                                Chat WhatsApp dari customer ini akan otomatis muncul di sini — tercatat berurutan
                                tanpa input manual — begitu integrasi WhatsApp diaktifkan. Untuk sekarang, gunakan
                                tombol <strong>Chat WA</strong> di atas.
                            </div>
                        ) : (
                            <div style={{ background: "#FBF3E1", border: "1px dashed #D9B96A", borderRadius: 10, padding: 16, fontSize: 13, color: "#7A5E1E", lineHeight: 1.6 }}>
                                Belum ada No. WA. Saat integrasi WhatsApp aktif dan ada chat masuk dari nomornya,
                                sistem akan menawarkan menautkan & mengisi nomornya otomatis.
                            </div>
                        )
                    )}
                </div>
            </div>
        </>
    );
}
