"use client";
import { useAlucurvTable } from "@/lib/alucurv/useAlucurvTable";

interface AlucurvTransaction {
    id: string;
    date: string;
    type: string;
    amount: number;
}

export default function AlucurvLaporanPage() {
    const { rows, loading } = useAlucurvTable<AlucurvTransaction>("alu_transactions", "date");

    const byMonth = new Map<string, { masuk: number; keluar: number }>();
    for (const r of rows) {
        const month = (r.date || "").slice(0, 7); // YYYY-MM
        if (!month) continue;
        const cur = byMonth.get(month) ?? { masuk: 0, keluar: 0 };
        if (r.type === "Pemasukan") cur.masuk += Number(r.amount || 0);
        else if (r.type === "Pengeluaran") cur.keluar += Number(r.amount || 0);
        byMonth.set(month, cur);
    }
    const months = [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0]));

    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 4 }}>Laporan Bulanan</h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", marginBottom: 16 }}>
                Ringkasan otomatis dari data di halaman Keuangan — tidak perlu input manual.
            </p>

            <div style={{ overflowX: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                        <tr style={{ background: "var(--bg-secondary)" }}>
                            <th style={th}>Bulan</th>
                            <th style={th}>Pemasukan</th>
                            <th style={th}>Pengeluaran</th>
                            <th style={th}>Selisih</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} style={tdEmpty}>Memuat...</td></tr>
                        ) : months.length === 0 ? (
                            <tr><td colSpan={4} style={tdEmpty}>Belum ada data transaksi.</td></tr>
                        ) : (
                            months.map(([month, v]) => (
                                <tr key={month}>
                                    <td style={td}>{month}</td>
                                    <td style={td}>Rp {v.masuk.toLocaleString("id-ID")}</td>
                                    <td style={td}>Rp {v.keluar.toLocaleString("id-ID")}</td>
                                    <td style={{ ...td, fontWeight: 700 }}>Rp {(v.masuk - v.keluar).toLocaleString("id-ID")}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

const th = { textAlign: "left" as const, padding: "8px 10px", fontSize: 10, fontWeight: 700, color: "var(--text-med)", textTransform: "uppercase" as const, borderBottom: "1px solid var(--border)" };
const td = { padding: "8px 10px", borderBottom: "1px solid var(--border-light)", color: "var(--text-dark)" };
const tdEmpty = { ...td, textAlign: "center" as const, color: "var(--text-med)", padding: "20px 10px" };
