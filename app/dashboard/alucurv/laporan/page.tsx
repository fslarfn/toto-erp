"use client";
import { useState } from "react";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";
import { isAluTransfer, computeAluTotals } from "@/lib/alucurv/transaksi";
import DomeCard from "@/components/layout/DomeCard";

interface AlucurvTransaction {
    id: string;
    date: string;
    type: string;
    amount: number;
    account_id: string | null;
    sub_category_id: string | null;
    transfer_group?: string | null;
}
interface AlucurvSubCategory { id: string; name: string; type: string }
interface AlucurvAccount { id: string; name: string; opening_balance: number }
interface AlucurvBendingOrder { id: string; date: string; amount: number; status: string }
interface AlucurvCashbon { id: string; date: string; amount: number }
interface AlucurvCashbonPayment { id: string; cashbon_id: string; amount: number }

const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
const MONTH_NAMES = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function lastDayOfMonth(y: number, m: number) {
    return new Date(y, m, 0).getDate();
}

export default function AlucurvLaporanPage() {
    const now = new Date();
    const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);

    const transactions = useAlucurvTable<AlucurvTransaction>("alu_transactions", "date");
    const subCategories = useAlucurvTable<AlucurvSubCategory>("alu_sub_categories", "name");
    const accounts = useAlucurvTable<AlucurvAccount>("alu_accounts", "name");
    const bending = useAlucurvTable<AlucurvBendingOrder>("alu_bending_orders", "date");
    const cashbons = useAlucurvTable<AlucurvCashbon>("alu_cashbons", "date");
    const cashbonPayments = useAlucurvTable<AlucurvCashbonPayment>("alu_cashbon_payments");

    const [y, m] = month.split("-").map(Number);
    const monthLabel = `${MONTH_NAMES[m - 1]} ${y}`;
    const endOfMonth = `${month}-${String(lastDayOfMonth(y, m)).padStart(2, "0")}`;

    const txnsInMonth = transactions.rows.filter((t) => t.date && t.date.slice(0, 7) === month);
    // Mutasi antar akun dikecualikan dari laba/rugi operasional.
    const { masuk: totalMasuk, keluar: totalKeluar, laba } = computeAluTotals(txnsInMonth);
    const margin = totalMasuk > 0 ? (laba / totalMasuk) * 100 : 0;

    const subCategoryMap = new Map(subCategories.rows.map((c) => [c.id, c.name]));
    const groupByType = (type: string) => {
        const map = new Map<string, number>();
        txnsInMonth.filter((t) => t.type === type && !isAluTransfer(t)).forEach((t) => {
            const name = (t.sub_category_id && subCategoryMap.get(t.sub_category_id)) || "Tanpa Kategori";
            map.set(name, (map.get(name) ?? 0) + Number(t.amount || 0));
        });
        return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
    };
    const pemasukanKategori = groupByType("Pemasukan");
    const pengeluaranKategori = groupByType("Pengeluaran");
    const maxPemasukan = Math.max(1, ...pemasukanKategori.map((c) => c.total));
    const maxPengeluaran = Math.max(1, ...pengeluaranKategori.map((c) => c.total));

    // Posisi kas & kewajiban dihitung "as of" akhir bulan yang dipilih, bukan hari ini —
    // supaya laporan bulan lalu tetap akurat sesuai kondisi saat itu.
    const accountBalanceAt = (acc: AlucurvAccount) => {
        const delta = transactions.rows
            .filter((t) => t.account_id === acc.id && t.date && t.date <= endOfMonth)
            .reduce((s, t) => s + (t.type === "Pemasukan" ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
        return Number(acc.opening_balance || 0) + delta;
    };

    const sisaTagihanBending = bending.rows
        .filter((b) => b.date && b.date <= endOfMonth && b.status === "BELUM")
        .reduce((s, b) => s + Number(b.amount || 0), 0);

    const paidPerCashbon = new Map<string, number>();
    cashbonPayments.rows.forEach((p) => {
        paidPerCashbon.set(p.cashbon_id, (paidPerCashbon.get(p.cashbon_id) ?? 0) + Number(p.amount || 0));
    });
    const sisaCashbon = cashbons.rows
        .filter((c) => c.date && c.date <= endOfMonth)
        .reduce((s, c) => s + Math.max(0, Number(c.amount || 0) - (paidPerCashbon.get(c.id) ?? 0)), 0);

    return (
        <div style={{ padding: 24 }}>
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .laporan-page { padding: 0 !important; }
                }
            `}</style>

            <div className="laporan-page">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, flexWrap: "wrap", gap: 12 }}>
                    <div>
                        <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Laporan Bulanan</h1>
                        <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 560 }}>
                            Rekapitulasi otomatis pemasukan, pengeluaran, laba, posisi kas, dan kewajiban.
                        </p>
                    </div>
                    <div className="no-print" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            style={{ fontSize: 13, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "white", color: "var(--text-dark)" }}
                        />
                        <button
                            onClick={() => window.print()}
                            style={{ background: "var(--primary)", color: "white", border: "none", borderRadius: 8, padding: "9px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
                        >
                            Cetak
                        </button>
                    </div>
                </div>

                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 20, marginBottom: 12 }}>
                    Rekapitulasi {monthLabel}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 24 }}>
                    <DomeCard label="Total Pemasukan" value={rupiah(totalMasuk)} valueColor="#16A34A" />
                    <DomeCard label="Total Pengeluaran" value={rupiah(totalKeluar)} valueColor="#DC2626" />
                    <DomeCard label="Laba / Rugi" value={rupiah(laba)} valueColor={laba >= 0 ? "#16A34A" : "#DC2626"} />
                    <DomeCard label="Margin" value={`${margin.toFixed(1)}%`} valueColor={margin >= 0 ? "var(--text-dark)" : "#DC2626"} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
                    <Panel title="Pemasukan per Kategori" titleColor="#16A34A">
                        {pemasukanKategori.length === 0 ? (
                            <Empty text="Belum ada pemasukan bulan ini." />
                        ) : (
                            pemasukanKategori.map((c) => <CategoryRow key={c.name} name={c.name} total={c.total} max={maxPemasukan} color="#16A34A" />)
                        )}
                    </Panel>
                    <Panel title="Pengeluaran per Kategori" titleColor="#DC2626">
                        {pengeluaranKategori.length === 0 ? (
                            <Empty text="Belum ada pengeluaran bulan ini." />
                        ) : (
                            pengeluaranKategori.map((c) => <CategoryRow key={c.name} name={c.name} total={c.total} max={maxPengeluaran} color="#DC2626" />)
                        )}
                    </Panel>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
                    <Panel title="Laporan Posisi Kas">
                        {accounts.rows.length === 0 ? (
                            <Empty text="Belum ada akun. Tambahkan di Pengaturan." />
                        ) : (
                            accounts.rows.map((acc) => (
                                <div key={acc.id} style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-light)" }}>
                                    <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>{acc.name}</span>
                                    <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(accountBalanceAt(acc))}</span>
                                </div>
                            ))
                        )}
                    </Panel>
                    <Panel title="Laporan Kewajiban">
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-light)" }}>
                            <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>Sisa tagihan Bending CV Toto</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626" }}>{rupiah(sisaTagihanBending)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid var(--border-light)" }}>
                            <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>Sisa cashbon karyawan (piutang)</span>
                            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#16A34A" }}>{rupiah(sisaCashbon)}</span>
                        </div>
                        <p style={{ fontSize: 10.5, color: "var(--text-med)", marginTop: 10, lineHeight: 1.5 }}>
                            Catatan: laba di atas dihitung dari transaksi kas (cash basis). Omset marketplace sebaiknya
                            dicatat saat pencairan saldo Shopee/TikTok agar konsisten.
                        </p>
                    </Panel>
                </div>
            </div>
        </div>
    );
}

function Panel({ title, titleColor, children }: { title: string; titleColor?: string; children: React.ReactNode }) {
    return (
        <div style={{ background: "white", border: "1px solid var(--border)", borderRadius: 14, padding: 18 }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: titleColor ?? "var(--text-dark)", marginBottom: 14 }}>{title}</h2>
            {children}
        </div>
    );
}

function Empty({ text }: { text: string }) {
    return <p style={{ fontSize: 12, color: "var(--text-med)" }}>{text}</p>;
}

function CategoryRow({ name, total, max, color }: { name: string; total: number; max: number; color: string }) {
    const pct = Math.max(2, (total / max) * 100);
    return (
        <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-dark)" }}>{name}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-dark)" }}>{rupiah(total)}</span>
            </div>
            <div style={{ height: 5, borderRadius: 99, background: "var(--border-light)", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 99 }} />
            </div>
        </div>
    );
}
