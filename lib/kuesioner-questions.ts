// ============================================================
// lib/kuesioner-questions.ts
// Daftar pertanyaan kuesioner tim (meeting bulanan Juli 2026).
// Dipakai oleh halaman isi publik (/kuesioner/[token]) dan
// halaman rekap owner (/dashboard/kuesioner).
// Kunci jawaban: u1..u5 (umum) dan k1..k4 (khusus per bagian).
// ============================================================

export interface PertanyaanItem {
  id: string;
  teks: string;
}

/** Pertanyaan umum — dijawab semua orang. */
export const PERTANYAAN_UMUM: PertanyaanItem[] = [
  { id: "u1", teks: "Tuliskan dengan bahasa sendiri: apa saja tanggung jawab utama posisi Anda? Sebutkan juga mana yang menurut Anda paling penting." },
  { id: "u2", teks: "Dari tanggung jawab itu, mana yang bulan Juli kemarin belum berjalan baik? Apa penyebab jujurnya?" },
  { id: "u3", teks: "Apa hambatan terbesar Anda dalam bekerja sebulan terakhir — alat, waktu, koordinasi, atau hal lain?" },
  { id: "u4", teks: "Apa yang Anda butuhkan dari perusahaan supaya hasil kerja Anda lebih baik? (alat, pelatihan, wewenang, tambahan orang)" },
  { id: "u5", teks: "Menurut Anda, Toto Aluminium & Alucurv 1–3 tahun ke depan sebaiknya menjadi seperti apa — dan peran apa yang INGIN Anda ambil di dalamnya?" },
];

export interface BagianDef {
  label: string;
  brand: "toto" | "alucurv" | "both";
  khusus: PertanyaanItem[];
}

export const BAGIAN: Record<string, BagianDef> = {
  admin_finance: {
    label: "Admin Finance — Toto",
    brand: "toto",
    khusus: [
      { id: "k1", teks: "Uang masuk Juli hanya ±26% dari omset. Menurut Anda apa 3 penyebab utama customer lambat bayar, dan mana yang bisa kita kendalikan?" },
      { id: "k2", teks: "Cara penagihan seperti apa yang selama ini paling berhasil? Berapa target % penagihan yang menurut Anda realistis untuk Agustus?" },
      { id: "k3", teks: "\"Penyesuaian Saldo\" Juli sangat besar. Apa yang membuat pencatatan harian tidak selalu cocok, dan usulan Anda supaya akhir bulan tidak perlu penyesuaian besar?" },
      { id: "k4", teks: "Pembagian tugas penagihan dengan Yuni sebaiknya seperti apa supaya jelas dan tidak dobel?" },
    ],
  },
  admin_barang: {
    label: "Admin Barang — Toto",
    brand: "toto",
    khusus: [
      { id: "k1", teks: "Menu Status Barang akan dicek tiap briefing pagi. Menurut Anda, alur kontrol harian yang paling praktis seperti apa supaya daftar \"belum tergarap >3 hari\" selalu nol?" },
      { id: "k2", teks: "Apa kendala terbesar Anda memantau status barang selama ini — informasi dari produksi, waktu, atau sistemnya?" },
      { id: "k3", teks: "Anda juga memegang penagihan bersama Vira. Bagaimana Anda membagi waktu antara kontrol barang dan menagih? Butuh bantuan apa?" },
      { id: "k4", teks: "Kalau ada satu hal di alur barang (dari order masuk sampai kirim) yang boleh Anda ubah, apa yang Anda ubah dan kenapa?" },
    ],
  },
  pic_produksi: {
    label: "PIC Produksi — Toto",
    brand: "toto",
    khusus: [
      { id: "k1", teks: "Banyak order yang barangnya sudah jalan tapi statusnya tidak di-update di sistem. Ceritakan jujur: apa yang membuat update status sering terlewat di lapangan?" },
      { id: "k2", teks: "Usulkan alur update yang menurut Anda REALISTIS dijalankan tiap hari: siapa yang pegang tablet, kapan (jam berapa), dan bagian mana yang bisa dibantu operator?" },
      { id: "k3", teks: "Stok bahan baku: 30 dari 41 item tidak ter-update sejak April–Mei. Apa kendalanya, dan kapan Anda sanggup selesaikan stock opname 41 item?" },
      { id: "k4", teks: "Setelah stock opname, bagaimana cara paling praktis mencatat pemakaian bahan setiap hari supaya angka stok di web selalu benar?" },
    ],
  },
  pic_gudang: {
    label: "PIC Gudang — Toto",
    brand: "toto",
    khusus: [
      { id: "k1", teks: "Ada 13 order Juni yang di sistem >30 hari tidak tersentuh. Cek daftarnya: mana yang sebenarnya sudah terkirim, dan kenapa statusnya tidak tercatat?" },
      { id: "k2", teks: "Dari barang \"siap kirim\" sampai benar-benar terkirim, di mana biasanya macetnya (ekspedisi, muatan, alamat, konfirmasi customer)?" },
      { id: "k3", teks: "Usulkan cara serah-terima harian antara produksi → gudang → kirim supaya tidak ada order yang tertinggal tanpa kabar." },
      { id: "k4", teks: "Apa yang Anda butuhkan supaya update status kirim bisa dilakukan hari itu juga, bukan besoknya?" },
    ],
  },
  marketing: {
    label: "Marketing — Toto",
    brand: "toto",
    khusus: [
      { id: "k1", teks: "Omset Juli turun dari Juni di semua marketing. Menurut Anda penyebab utamanya apa — musim, harga, stok, persaingan, atau cara kita jualan?" },
      { id: "k2", teks: "Customer atau segmen mana yang mau Anda garap serius di Agustus? Sebutkan 5 nama customer dormant yang akan Anda hubungi minggu ini." },
      { id: "k3", teks: "Berapa target omset pribadi Anda untuk Agustus, dan apa yang Anda butuhkan dari perusahaan untuk mencapainya (harga khusus, promo, sample, konten)?" },
      { id: "k4", teks: "Apa satu perubahan pada produk, harga, atau pelayanan kita yang menurut Anda paling bisa menaikkan penjualan?" },
    ],
  },
  marketing_alucurv: {
    label: "Marketing — Alucurv",
    brand: "alucurv",
    khusus: [
      { id: "k1", teks: "Omset Alucurv menurun tiap minggu di Juli (M1 Rp 76,9 jt → M4 Rp 34,0 jt). Menurut Anda penyebab utamanya apa, dan mana yang bisa kita kendalikan?" },
      { id: "k2", teks: "Apa rencana konkret Anda menaikkan TikTokShop dari 9,5% — konten seperti apa, berapa kali posting, perlu budget apa?" },
      { id: "k3", teks: "Dari 102 customer bulan perdana, bagaimana cara Anda mendorong repeat order di Agustus?" },
      { id: "k4", teks: "Berapa target omset mingguan yang menurut Anda realistis untuk Agustus, dan apa yang Anda butuhkan untuk mencapainya?" },
    ],
  },
  admin_finance_alucurv: {
    label: "Admin & Finance — Alucurv",
    brand: "alucurv",
    khusus: [
      { id: "k1", teks: "Pencatatan Anda di Juli sudah rapi. Apa yang membantu Anda disiplin, dan apa yang bisa ditiru tim Toto?" },
      { id: "k2", teks: "Rp 52,9 jt masih tertahan di saldo marketplace (pending Shopee Rp 37,0 jt). Apa kendala pencairan selama ini, dan jadwal pencairan rutin seperti apa yang Anda usulkan?" },
      { id: "k3", teks: "Belanja bahan baku Juli mencapai 51% dari omset. Bagaimana cara terbaik memantau stok vs belanja supaya tidak kelebihan beli?" },
      { id: "k4", teks: "Laporan apa yang menurut Anda perlu ada di sistem Alucurv tapi belum tersedia sekarang?" },
    ],
  },
  owner: {
    label: "Owner",
    brand: "both",
    khusus: [
      { id: "k1", teks: "Apakah pembagian tugas & tanggung jawab setiap orang sudah tertulis dan dipahami? Bagian mana yang selama ini abu-abu?" },
      { id: "k2", teks: "Keputusan apa saja yang selama ini menumpuk di owner dan sebenarnya bisa didelegasikan? Kepada siapa?" },
      { id: "k3", teks: "Toto Aluminium & Alucurv 1–3 tahun ke depan mau dibawa ke mana? (produk, kapasitas, channel, tim) — tuliskan supaya bisa dibagikan ke tim." },
      { id: "k4", teks: "Dari jawaban kuesioner tim nanti: komitmen apa yang siap owner berikan balik (fasilitas, insentif, kejelasan wewenang)?" },
    ],
  },
};

export function getBagian(key: string): BagianDef | null {
  return BAGIAN[key] ?? null;
}
