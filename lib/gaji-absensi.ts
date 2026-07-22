// ============================================================
// lib/gaji-absensi.ts
// Mesin hitung Gaji ⇄ Absensi — fungsi murni (tanpa IO).
//
// Aturan (keputusan owner 22 Jul 2026):
//   - Periode mingguan = SENIN s.d. SABTU; gajian default Sabtu
//     (tanggal gajian bisa digeser ke Jumat bila Sabtu libur).
//   - 1 hari hadir = ada absen masuk. SETENGAH hari bila pulang
//     jam 12 siang (praktisnya: jam_keluar sebelum HALF_DAY_CUTOFF).
//     Lupa absen pulang → tetap dihitung 1 hari (bisa dikoreksi manual).
//   - Telat TIDAK memotong gaji — hanya keterangan di slip.
//   - Hadir hari MINGGU = hari lembur (bukan hari kerja) — semi-otomatis,
//     angka tetap bisa diedit di UI sebelum disimpan.
//   - Bulanan dihitung dari total hari masuk (bukan pro-rata).
// ============================================================

/** Pulang sebelum jam ini = setengah hari (owner: "pulang jam 12 siang"). */
export const HALF_DAY_CUTOFF = "13:00";

/** Tarif harian: gaji_harian; kalau 0, gaji_pokok / 26 (konvensi lama). */
export function tarifHarianOf(gajiHarian: number, gajiPokok: number): number {
    return gajiHarian || Math.round((gajiPokok || 0) / 26);
}

export type TipeGajian = "mingguan" | "bulanan";

/** Tipe gajian karyawan; '' → otomatis dari struktur gajinya. */
export function tipeGajianOf(k: { periode_gaji?: string; gaji_harian: number; gaji_pokok: number }): TipeGajian {
    if (k.periode_gaji === "mingguan" || k.periode_gaji === "bulanan") return k.periode_gaji;
    return k.gaji_harian > 0 ? "mingguan" : "bulanan";
}

/* ================= Periode ================= */

export interface PeriodeGaji {
    tipe: TipeGajian;
    mulai: string;     // 'YYYY-MM-DD' (mingguan: Senin; bulanan: tgl 1)
    selesai: string;   // mingguan: Sabtu; bulanan: 30/31
    gajian: string;    // default: = selesai (Sabtu / akhir bulan)
    key: string;       // disimpan di gaji.periode: 'mulai~selesai'
    label: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function isoAddDays(iso: string, n: number): string {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toISO(d);
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
function tglPendek(iso: string): string {
    const [, m, d] = iso.split("-");
    return `${Number(d)} ${BULAN[Number(m) - 1]}`;
}
const hariOf = (iso: string) => new Date(`${iso}T00:00:00`).getDay();

/** Rakit satu periode mingguan; gajian default = hari terakhir periode,
 *  digeser mundur bila jatuh di hari Minggu (tidak ada gajian hari Minggu). */
function buatPeriodeMingguan(mulai: string, selesai: string): PeriodeGaji {
    let gajian = selesai;
    if (hariOf(gajian) === 0) gajian = isoAddDays(gajian, -1);
    return {
        tipe: "mingguan", mulai, selesai, gajian,
        key: `${mulai}~${selesai}`,
        label: `${HARI[hariOf(mulai)]} ${tglPendek(mulai)} – ${HARI[hariOf(selesai)]} ${tglPendek(selesai)} ${selesai.slice(0, 4)}`,
    };
}

/** Periode minggu default (Senin–Sabtu) yang memuat tanggal anchor —
 *  dipakai sbg nilai awal kalender; admin bebas menggeser rentangnya. */
export function mingguPeriode(anchorISO: string): PeriodeGaji {
    const day = hariOf(anchorISO);               // 0=Minggu … 6=Sabtu
    const keSenin = day === 0 ? -6 : 1 - day;    // Minggu dianggap milik minggu sebelumnya
    const mulai = isoAddDays(anchorISO, keSenin);
    return buatPeriodeMingguan(mulai, isoAddDays(mulai, 5));
}

/** Periode mingguan kustom dari kalender — admin memilih sendiri tanggal
 *  awal & akhir (mis. 20 s.d. 25, atau 27 s.d. 31 di akhir bulan). */
export function periodeKustom(mulai: string, selesai: string): PeriodeGaji {
    if (!selesai || selesai < mulai) selesai = mulai;
    return buatPeriodeMingguan(mulai, selesai);
}

/** Periode bulanan penuh (1 s.d. 30/31), gajian di akhir bulan. */
export function bulanPeriode(tahun: number, bulan: number): PeriodeGaji {
    const mulai = `${tahun}-${pad(bulan)}-01`;
    const akhir = new Date(tahun, bulan, 0).getDate();
    const selesai = `${tahun}-${pad(bulan)}-${pad(akhir)}`;
    const NAMA = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    return {
        tipe: "bulanan", mulai, selesai, gajian: selesai,
        key: `${mulai}~${selesai}`,
        label: `${NAMA[bulan - 1]} ${tahun}`,
    };
}

/* ================= Kehadiran ================= */

export interface AbsensiLike {
    karyawan_id: number;
    tanggal: string;      // 'YYYY-MM-DD'
    jam_masuk: string;    // 'HH:MM' ('' bila tidak absen masuk)
    jam_keluar: string;
    is_telat: boolean;
    selisih_menit: number;
    /** Lembur yang dicatat kiosk absen, satuan HARI (0.5 / 1). */
    overtime_hours?: number;
}

export interface KehadiranHari {
    tanggal: string;
    jamMasuk: string;
    jamKeluar: string;
    nilai: number;        // 1 | 0.5
    isMinggu: boolean;    // hadir hari Minggu → masuk hitungan lembur
    lembur: number;       // kontribusi hari lembur: hadir Minggu + overtime kiosk
    telat: boolean;
    telatMenit: number;
}

export interface KehadiranSummary {
    hariKerja: number;    // Senin–Sabtu (bisa .5)
    hariLembur: number;   // hadir hari Minggu (bisa .5)
    telatCount: number;
    telatMenit: number;
    detail: KehadiranHari[];
}

/** Nilai satu hari hadir: 1, atau 0.5 bila pulang sebelum HALF_DAY_CUTOFF.
 *  Tanpa jam pulang (lupa absen keluar) → 1 (koreksi manual bila perlu). */
function nilaiHari(jamKeluar: string): number {
    const jk = (jamKeluar || "").trim();
    if (!jk) return 1;
    return jk < HALF_DAY_CUTOFF ? 0.5 : 1;
}

/** Rekap kehadiran SATU karyawan dari baris absensinya dalam periode.
 *  Baris tanpa jam_masuk dilewati; tanggal duplikat dihitung sekali. */
export function hitungKehadiran(rows: AbsensiLike[], periode: { mulai: string; selesai: string }): KehadiranSummary {
    const byTanggal = new Map<string, AbsensiLike>();
    for (const r of rows) {
        const t = (r.tanggal || "").trim();
        if (!t || t < periode.mulai || t > periode.selesai) continue;
        if (!(r.jam_masuk || "").trim()) continue;
        if (!byTanggal.has(t)) byTanggal.set(t, r);
    }
    const detail: KehadiranHari[] = Array.from(byTanggal.values())
        .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
        .map((r) => {
            const isMinggu = new Date(`${r.tanggal}T00:00:00`).getDay() === 0;
            const nilai = nilaiHari(r.jam_keluar);
            return {
                tanggal: r.tanggal,
                jamMasuk: r.jam_masuk,
                jamKeluar: r.jam_keluar,
                nilai,
                isMinggu,
                // Lembur = hadir hari Minggu (nilai hari itu) + lembur harian
                // yang dicatat kiosk saat absen pulang (overtime_hours, satuan hari).
                lembur: (isMinggu ? nilai : 0) + (Number(r.overtime_hours) || 0),
                telat: !!r.is_telat,
                telatMenit: r.is_telat ? (r.selisih_menit || 0) : 0,
            };
        });
    let hariKerja = 0, hariLembur = 0, telatCount = 0, telatMenit = 0;
    for (const h of detail) {
        if (!h.isMinggu) hariKerja += h.nilai;
        hariLembur += h.lembur;
        if (h.telat) { telatCount++; telatMenit += h.telatMenit; }
    }
    return { hariKerja, hariLembur, telatCount, telatMenit, detail };
}

/** Keterangan telat utk slip: '' bila tidak ada. */
export function keteranganTelat(telatCount: number, telatMenit: number): string {
    if (!telatCount) return "";
    return `Catatan kehadiran: telat ${telatCount}× (total ${telatMenit} menit) pada periode ini — tidak memotong gaji.`;
}
