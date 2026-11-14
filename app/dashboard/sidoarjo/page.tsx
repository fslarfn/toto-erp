"use client";

import Link from "next/link";

const MODULES = [
    ["Data Karyawan", "Karyawan Sidoarjo sudah siap diisi dan tidak bercampur dengan HR pusat.", "/dashboard/sidoarjo/karyawan", "Siap digunakan"],
    ["Input Pesanan", "Masukkan pesanan cabang secara manual; setiap baris otomatis disimpan sebagai data Sidoarjo.", "/dashboard/sidoarjo/pesanan", "Siap digunakan"],
    ["Status Barang", "Progres produksi cabang tanpa menampilkan PO Toto Pusat.", "/dashboard/sidoarjo/status-barang", "Siap digunakan"],
    ["Keuangan", "Rekening, kas, dan transaksi khusus Sidoarjo.", "/dashboard/sidoarjo/keuangan", "Siap digunakan"],
    ["Stok Bahan", "Persediaan Sidoarjo berdiri sendiri dari gudang pusat."],
    ["Karyawan & Absensi", "Rekap selfie masuk/pulang cabang. Karyawan dan absensi selalu terpisah dari pusat.", "/dashboard/sidoarjo/absensi", "Siap digunakan"],
    ["Gaji & Slip", "Hitung gaji cabang dari absensi, dengan aturan khusus gaji pokok tetap.", "/dashboard/sidoarjo/gaji", "Siap digunakan"],
    ["Laporan Cabang", "Laporan unit yang kemudian diringkas untuk owner."],
];

/**
 * Landing aman untuk unit baru. Tidak ada provider Toto Pusat dipakai di sini,
 * sehingga saat routing sudah aktif data lama tidak mungkin tampil sebagai data
 * Sidoarjo sebelum modul-modulnya selesai diberi filter unit database.
 */
export default function SidoarjoDashboardPage() {
    return (
        <div className="page-content" style={{ maxWidth: 1160, paddingTop: 30 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
                <div>
                    <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "#A67B5B", marginBottom: 8 }}>
                        UNIT OPERASIONAL BARU
                    </div>
                    <h1 className="page-title-h1" style={{ marginBottom: 8 }}>Toto Sidoarjo</h1>
                    <p className="page-subtitle" style={{ maxWidth: 690 }}>
                        Area kerja cabang Sidoarjo. Rekening, stok, karyawan, dan transaksi cabang akan berdiri sendiri,
                        sementara owner memantau ringkasannya melalui Kontrol Gabungan.
                    </p>
                </div>
                <span style={{ padding: "8px 12px", borderRadius: 999, background: "#FDF3E7", border: "1px solid #E8DCCF", color: "#8B5E3C", fontSize: 12, fontWeight: 800 }}>
                    Tahap 1 · Fondasi unit
                </span>
            </div>

            <section style={{ marginTop: 24, padding: 18, border: "1px solid #E8DCCF", borderRadius: 12, background: "#FFFDF9" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#3C2F2F", marginBottom: 6 }}>Data cabang belum diisi</div>
                <p style={{ margin: 0, maxWidth: 810, color: "#7B6656", fontSize: 13, lineHeight: 1.6 }}>
                    Halaman ini sengaja belum memakai data Toto Pusat. Sebelum cabang mulai digunakan, kami menyelesaikan
                    pemisahan unit pada database dan hak akses agar tidak ada pesanan, harga, saldo, atau data karyawan pusat yang tercampur.
                </p>
            </section>

            <div className="rgrid rgrid-3" style={{ marginTop: 20 }}>
                {MODULES.map(([name, description, href, status]) => (
                    <div key={name} className="card" style={{ minHeight: 142, opacity: href ? 1 : .82 }}>
                        <div className="card-body">
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
                                <strong style={{ color: "#3C2F2F", fontSize: 15 }}>{name}</strong>
                                <span style={{ fontSize: 11, color: "#A67B5B", fontWeight: 700 }}>{status ?? "Berikutnya"}</span>
                            </div>
                            <p style={{ margin: 0, color: "#7B6656", fontSize: 12, lineHeight: 1.55 }}>{description}</p>
                            {href && <Link href={href} style={{ display: "inline-block", marginTop: 12, color: "#8B5E3C", fontSize: 12, fontWeight: 800, textDecoration: "none" }}>Buka menu →</Link>}
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/dashboard" style={{ padding: "10px 14px", borderRadius: 8, background: "#8B5E3C", color: "white", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    Buka Toto Pusat
                </Link>
                <Link href="/dashboard/gabungan" style={{ padding: "10px 14px", borderRadius: 8, background: "white", border: "1px solid #D8C1AA", color: "#6B4423", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    Kontrol Gabungan
                </Link>
            </div>
        </div>
    );
}
