export default function DashboardGabunganPage() {
    return (
        <div style={{ padding: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-dark)", marginBottom: 8 }}>
                Dashboard Gabungan
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-med)", maxWidth: 520, lineHeight: 1.6 }}>
                Khusus Owner &amp; Manager yang punya akses ke Toto dan Alucurv. Ringkasan KPI lintas
                bisnis (kas gabungan, piutang, order) akan tampil di sini setelah data operasional
                Alucurv aktif di Supabase.
            </p>
        </div>
    );
}
