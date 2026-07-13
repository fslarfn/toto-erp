# Alucurv ERP

ERP mini untuk Alucurv (jendela & pintu aluminium lengkung), menggantikan sistem Google Sheet.
Dibuat dengan **Next.js 15 + React 19 + TypeScript + Tailwind v4**.

## Modul

| Menu | Fungsi | Menggantikan tab sheet |
|------|--------|------------------------|
| Dashboard | Ringkasan uang beredar, laba bulan ini, order berjalan, hal yang perlu perhatian | — |
| Transaksi Kas | Uang masuk/keluar per akun (Cash, BCA, Jago, Shopee, TikTok) | LAP PENGELUARAN (Cash/BCA/Jago) |
| Laporan Bulanan | Rekap pemasukan/pengeluaran per kategori, posisi kas, kewajiban, cetak | LAPORAN, REKON |
| Order | Pipeline Produksi → Perakitan → Packing → Kirim → Sampai, per channel | ORDER, data |
| Invoice / Nota | Nomor otomatis `AL/INV/BB/TTTT/NNN`, status LUNAS/DP/BELUM, cetak nota | NOTA, PENCATATAN NOTA |
| Surat Jalan | Nomor otomatis `AL/SJ/BB/TTTT/NNN` | SURAT JALAN |
| HPP Produk | Kalkulator modal, potongan marketplace, margin, banding harga | HPP |
| Pengadaan Bahan | Pembelian per pemasok + rekening pembayar | PENGADAAN BAHAN BAKU |
| Stok Barang | Stok awal/masuk/keluar/akhir, status AMAN/BUAT LAGI | REKAP STOK, BARANG MASUK/KELUAR, CONSUMABLE |
| Bending CV Toto | Tagihan bending, sisa hutang, toggle LUNAS/BELUM | BENDING |
| Karyawan | Absensi, gaji mingguan + slip gaji, cashbon + cicilan | ABSENSI, REKAP GAJI, CASHBON |
| Master & Pengaturan | Kelola akun, kategori, pemasok, karyawan; reset data demo | master, Setup |

## Cara menjalankan

```bash
npm install
npm run dev
```

Buka http://localhost:3000

Untuk build produksi:

```bash
npm run build
npm run start
```

## Mode data

Saat ini aplikasi berjalan dalam **mode demo**: semua data disimpan di
**localStorage browser** (kunci `alucurv-erp-db-v1`). Sudah terisi data contoh
yang diambil dari sheet-mu, jadi begitu dibuka langsung terasa nyata. Ganti/hapus
data lewat tombol di tiap halaman, atau reset ke contoh awal di
**Master & Pengaturan → Data Demo**.

Semua akses data dipusatkan di **`lib/store.tsx`** lewat hook `useDB()`.
Halaman tidak menyentuh localStorage secara langsung — jadi tinggal satu file
yang perlu diganti untuk pindah ke backend.

## Menyambungkan ke Supabase

1. Buat project di Supabase, lalu jalankan **`supabase/schema.sql`** di SQL Editor.
   Skema tabelnya sudah dibuat 1:1 dengan model di `lib/types.ts`.
2. Pasang client:
   ```bash
   npm install @supabase/supabase-js
   ```
3. Buat `lib/supabase.ts`:
   ```ts
   import { createClient } from "@supabase/supabase-js";
   export const supabase = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );
   ```
   dan isi `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
4. Di `lib/store.tsx`, ganti isi `insert` / `update` / `remove` dengan panggilan
   `supabase.from("nama_tabel").insert(...)` dll., dan muat data awal dengan
   `select()` di dalam `useEffect` (menggantikan pembacaan localStorage).
   Ingat konversi penamaan kolom **camelCase → snake_case** (mis. `openingBalance`
   → `opening_balance`) sesuai skema SQL.
5. Aktifkan **Row Level Security** dan buat policy sebelum dipakai produksi
   (lihat catatan di bagian bawah `schema.sql`).

## Catatan desain

- Tema "aluminium hitam doff": sidebar gelap, aksen biru baja, dan bentuk
  **lengkung** (`.arch`) pada stat card & menu aktif — meniru profil jendela
  lengkung Alucurv.
- Semua tampilan nota/slip bisa langsung **Cetak** (tombol Cetak memanggil
  dialog print browser; elemen bertanda `no-print` otomatis disembunyikan).
- Bahasa antarmuka: Indonesia. Angka diformat Rupiah otomatis.
