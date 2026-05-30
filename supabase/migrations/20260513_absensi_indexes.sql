-- ============================================================
-- MIGRATION: Index untuk tabel absensi & izin_absensi
-- Versi   : 20260513
-- Tujuan  : Percepat query yang dipakai AbsensiProvider dan dashboard
-- ============================================================
-- Sebelum index: query tanggal = full table scan O(n)
-- Sesudah index: index range scan O(log n)
-- ============================================================

-- Index utama: filter + sort berdasarkan tanggal (dipakai hampir semua query)
CREATE INDEX IF NOT EXISTS idx_absensi_tanggal
    ON public.absensi (tanggal DESC);

-- Index komposit: cek absen masuk/pulang per karyawan per hari
-- Dipakai sudahAbsenMasuk(), sudahAbsenPulang(), getAbsensiHariIni()
CREATE INDEX IF NOT EXISTS idx_absensi_karyawan_tanggal
    ON public.absensi (karyawan_id, tanggal DESC);

-- Index untuk izin_absensi (filter bulanan di dashboard)
CREATE INDEX IF NOT EXISTS idx_izin_tanggal
    ON public.izin_absensi (tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_izin_karyawan
    ON public.izin_absensi (karyawan_id, tanggal DESC);
