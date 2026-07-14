"use client";
import Link from "next/link";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";

interface AlucurvOrder {
    id: string;
    customer: string;
    description: string | null;
    channel: string;
    deadline: string | null;
    price: number;
    received_amount: number | null;
    produksi: boolean; perakitan: boolean; packing: boolean; dikirim: boolean; sampai: boolean;
}
interface AlucurvInvoice { id: string; status: string }
interface AlucurvTransaction { id: string; date: string; type: string; amount: number; account_id: string | null; sub_category_id: string | null }
interface AlucurvStockItem { id: string; name: string; min_stock: number; opening_stock: number }
interface AlucurvAccount { id: string; name: string; type: string; opening_balance: number }
interface AlucurvSubCategory { id: string; name: string; type: string }
interface AlucurvBendingOrder { id: string; amount: number; status: string }

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const ACCOUNT_BADGE: Record<string, string> = { cash: "Kas", bank: "Bank", marketplace: "MP" };
const ACCOUNT_BADGE_COLOR: Record<string, { bg: string; fg: string }> = {
    cash: { bg: "#F1F5F9", fg: "#475569" },
    bank: { bg: "#DBEAFE", fg: "#1D4ED8" },
    marketplace: { bg: "#FEF3C7", fg: "#B45309" },
};
const CHANNEL_BADGE_COLOR: Record<string, { bg: string; fg: string }> = {
    Offline: { bg: "#F1F5F9", fg: "#475569" },
    Shopee: { bg: "#FFEDD5", fg: "#C2410C" },
    TikTokShop: { bg: "#F3E8FF", fg: "#7E22CE" },
};

function formatDeadline(s: string | null) {
    if (!s) return "-";
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return `Deadline ${d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`;
}

export default function AlucurvWorkspacePage() {
    const orders = useAlucurvTable<AlucurvOrder>("alu_orders");
    const invoices = useAlucurvTable<AlucurvInvoice>("alu_invoices");
    const transactions = useAlucurvTable<AlucurvTransaction>("alu_transactions");
    const stock = useAlucurvTable<AlucurvStockItem>("alu_stock_items");
    const accounts = useAlucurvTable<AlucurvAccount>("alu_accounts");
    const subCategories = useAlucurvTable<AlucurvSubCategory>("alu_sub_categories");
    const bending = useAlucurvTable<AlucurvBendingOrder>("alu_bending_orders");

    const now = new Date();
    const monthLabel = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    const isThisMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const txnsThisMonth = transactions.rows.filter((t) => t.date && isThisMonth(t.date));

    const pemasukanBulanIni = txnsThisMonth.filter((t) => t.type === "Pemasukan").reduce((s, t) => s + Number(t.amount || 0), 0);
    const pengeluaranBulanIni = txnsThisMonth.filter((t) => t.type === "Pengeluaran").reduce((s, t) => s + Number(t.amount || 0), 0);
    const labaBulanIni = pemasukanBulanIni - pengeluaranBulanIni;

    const accountBalance = (acc: AlucurvAccount) => {
        const delta = transactions.rows
            .filter((t) => t.account_id === acc.id)
            .reduce((s, t) => s + (t.type === "Pemasukan" ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
        return Number(acc.opening_balance || 0) + delta;
    };
    const totalUangBeredar = accounts.rows.reduce((s, acc) => s + accountBalance(acc), 0);

    // Omset = nominal yang benar-benar diterima Alucurv: received_amount untuk Shopee/TikTok
    // (setelah potongan marketplace), atau price langsung untuk Offline.
    const totalOmsetPenjualan = orders.rows.reduce((s, o) => {
        const effective = o.channel === "Offline" ? Number(o.price || 0) : Number(o.received_amount ?? o.price ?? 0);
        return s + effective;
    }, 0);

    const orderBerjalan = orders.rows
        .filter((o) => !o.sampai)
        .sort((a, b) => (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999"))
        .slice(0, 3);
    const progressOf = (o: AlucurvOrder) => {
        const stages = [o.produksi, o.perakitan, o.packing, o.dikirim, o.sampai];
        return (stages.filter(Boolean).length / stages.length) * 100;
    };

    const sisaTagihanBending = bending.rows.filter((b) => b.status === "BELUM").reduce((s, b) => s + Number(b.amount || 0), 0);
    const invoiceBelumLunas = invoices.rows.filter((i) => i.status !== "LUNAS").length;
    const stokMinim = stock.rows.filter((s) => Number(s.opening_stock) < Number(s.min_stock));

    const subCategoryMap = new Map(subCategories.rows.map((c) => [c.id, c]));
    const rekapMap = new Map<string, { name: string; type: string; total: number }>();
    for (const t of txnsThisMonth) {
        const cat = t.sub_category_id ? subCategoryMap.get(t.sub_category_id) : null;
        const name = cat?.name ?? "Tanpa Kategori";
        const type = cat?.type ?? t.type;
        const cur = rekapMap.get(name) ?? { name, type, total: 0 };
        cur.total += Number(t.amount || 0);
        rekapMap.set(name, cur);
    }
    const rekapList = [...rekapMap.values()].sort((a, b) => b.total - a.total);
    const rekapLeft = rekapList.filter((_, i) => i % 2 === 0);
    const rekapRight = rekapList.filter((_, i) => i % 2 === 1);

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Dashboard</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 20 }}>
                Ringkasan {monthLabel} — semua angka dihitung otomatis dari pencatatan.
            </p>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
                <DomeCard label="Total Uang Beredar" value={rupiah(totalUangBeredar)} valueColor="#1D4ED8" sub="Semua akun & saldo marketplace" />
                <DomeCard label="Pemasukan Bulan Ini" value={rupiah(pemasukanBulanIni)} valueColor="#16A34A" />
                <DomeCard label="Pengeluaran Bulan Ini" value={rupiah(pengeluaranBulanIni)} valueColor="#EA580C" />
                <DomeCard label="Laba Bulan Ini" value={rupiah(labaBulanIni)} valueColor={labaBulanIni >= 0 ? "#16A34A" : "#DC2626"} />
                <DomeCard label="Total Omset Penjualan" value={rupiah(totalOmsetPenjualan)} valueColor="#0F766E" sub="Nominal bersih diterima dari semua order" />
            </div>

            {/* 3 columns */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 24 }}>
                <Panel title="Saldo per Akun">
                    {accounts.loading ? (
                        <Empty text="Memuat..." />
                    ) : accounts.rows.length === 0 ? (
                        <Empty text="Belum ada akun. Tambahkan di Pengaturan." />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                            {accounts.rows.map((acc) => {
                                const badge = ACCOUNT_BADGE_COLOR[acc.type] ?? ACCOUNT_BADGE_COLOR.cash;
                                return (
                                    <div key={acc.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                                            <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: badge.bg, color: badge.fg, whiteSpace: "nowrap" }}>
                                                {ACCOUNT_BADGE[acc.type] ?? acc.type}
                                            </span>
                                            <span style={{ fontSize: 12.5, color: "var(--text-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{acc.name}</span>
                                        </div>
                                        <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)", whiteSpace: "nowrap" }}>{rupiah(accountBalance(acc))}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Panel>

                <Panel title="Order Berjalan" action={<Link href="/dashboard/alucurv/order" style={{ fontSize: 12, color: "var(--primary-dark)", fontWeight: 600, textDecoration: "none" }}>Lihat semua</Link>}>
                    {orders.loading ? (
                        <Empty text="Memuat..." />
                    ) : orderBerjalan.length === 0 ? (
                        <Empty text="Tidak ada order berjalan." />
                    ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                            {orderBerjalan.map((o) => {
                                const badge = CHANNEL_BADGE_COLOR[o.channel] ?? CHANNEL_BADGE_COLOR.Offline;
                                return (
                                    <div key={o.id}>
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
                                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-dark)" }}>{o.customer}</span>
                                            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: badge.bg, color: badge.fg }}>{o.channel}</span>
                                        </div>
                                        <div style={{ fontSize: 11, color: "var(--text-med)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 6 }}>
                                            {o.description || "-"}
                                        </div>
                                        <div style={{ height: 5, borderRadius: 99, background: "var(--border-light)", overflow: "hidden", marginBottom: 4 }}>
                                            <div style={{ height: "100%", width: `${progressOf(o)}%`, background: "var(--primary)", borderRadius: 99 }} />
                                        </div>
                                        <div style={{ fontSize: 10.5, color: "var(--text-med)" }}>{formatDeadline(o.deadline)}</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </Panel>

                <Panel title="Perlu Perhatian">
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>Sisa tagihan bending CV Toto</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: sisaTagihanBending > 0 ? "#DC2626" : "var(--text-dark)" }}>{rupiah(sisaTagihanBending)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>Invoice belum lunas</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)" }}>{invoiceBelumLunas} nota</span>
                        </div>
                        <div>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: stokMinim.length > 0 ? 6 : 0 }}>
                                <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>Stok minim (perlu buat lagi)</span>
                                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)" }}>{stokMinim.length} item</span>
                            </div>
                            {stokMinim.slice(0, 1).map((s) => (
                                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontSize: 11.5, color: "var(--text-med)" }}>{s.name}</span>
                                    <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "#FEE2E2", color: "#DC2626" }}>sisa {s.opening_stock}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </Panel>
            </div>

            {/* Rekap kategori */}
            <Panel title={`Rekap per Kategori — ${monthLabel}`}>
                {rekapList.length === 0 ? (
                    <Empty text="Belum ada transaksi bulan ini." />
                ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "8px 32px" }}>
                        <div>
                            {rekapLeft.map((r) => <RekapRow key={r.name} r={r} />)}
                        </div>
                        <div>
                            {rekapRight.map((r) => <RekapRow key={r.name} r={r} />)}
                        </div>
                    </div>
                )}
            </Panel>
        </div>
    );
}

function DomeCard({ label, value, valueColor, sub }: { label: string; value: string; valueColor: string; sub?: string }) {
    return (
        <div
            style={{
                background: "white", border: "1px solid var(--border)",
                borderRadius: "120px 120px 16px 16px", padding: "34px 16px 20px",
                textAlign: "center", display: "flex", flexDirection: "column", gap: 6,
            }}
        >
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", letterSpacing: 0.4 }}>{label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: valueColor }}>{value}</div>
            {sub && <div style={{ fontSize: 9.5, color: "var(--text-med)" }}>{sub}</div>}
        </div>
    );
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text-dark)" }}>{title}</h2>
                {action}
            </div>
            {children}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <p style={{ fontSize: 12, color: "var(--text-med)" }}>{text}</p>;
}

function RekapRow({ r }: { r: { name: string; type: string; total: number } }) {
    const dotColor = r.type === "Pemasukan" ? "#16A34A" : "#DC2626";
    return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border-light)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: 99, background: dotColor, flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>{r.name}</span>
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(r.total)}</span>
        </div>
    );
}
