export default function AlucurvWorkspacePage() {
    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>
                Workspace Alucurv
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 520, lineHeight: 1.6 }}>
                Fondasi integrasi (tabel database &amp; akses workspace) sudah aktif. Modul operasional
                Alucurv (Order, Invoice, Surat Jalan, Stok, HPP, Pengadaan, Kas/Laporan) akan dipindahkan
                ke sini secara bertahap dari prototipe di <code>alucurv-legacy/</code>.
            </p>
        </div>
    );
}
