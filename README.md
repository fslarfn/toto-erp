# ERP TOTO — Sistem Informasi Manufaktur

Sistem ERP (Enterprise Resource Planning) berbasis web untuk **CV Toto Aluminium Manufacture**, dibangun menggunakan Next.js dan Supabase.

## 🚀 Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Supabase (PostgreSQL + Realtime)
- **Styling**: CSS-in-JS + Tailwind CSS
- **Charts**: Recharts
- **Export**: XLSX, jsPDF

## 📦 Fitur Utama

### Menu Utama
- **Dashboard** — Ringkasan performa usaha, grafik pendapatan, status pesanan
- **Input Pesanan** — Spreadsheet-style input dengan pagination (100 data + 100 buffer)
- **Status Barang** — Tracking status produksi per bulan dengan filter status

### Keuangan
- **Keuangan** — Overview keuangan (rekening, piutang, laba)
- **Invoice** — Generate & manage invoice customer
- **Tagihan** — Tracking tagihan customer
- **Tagihan Bahan Baku** — Tagihan ke supplier

### Gudang & Produksi
- **Stok Bahan** — Inventaris bahan baku
- **SJ Bahan Baku** — Surat jalan bahan ke vendor pewarnaan
- **Alur Pesanan** — Tracking alur produksi per-PIC (Produksi → QC → Kirim)
- **Print PO** — Cetak Production Order
- **Surat Jalan** — Generate surat jalan pengiriman customer

### SDM (Sumber Daya Manusia)
- **Karyawan** — Data karyawan, kalkulator gaji mingguan, kasbon
- **Absensi** — Rekap kehadiran karyawan

## 👥 Role-Based Access

| Role | Akses |
|------|-------|
| Owner | Semua modul |
| Finance | Dashboard, Pesanan, Status Barang, Keuangan |
| Sales | Pesanan, Status Barang |
| Produksi | Dashboard, Pesanan, Status Barang, Stok, Produksi |
| Barang | Dashboard, Pesanan, Status Barang, Stok, Produksi |

## ⚡ Getting Started

### Prerequisites
- Node.js 18+
- Akun Supabase

### Installation

```bash
# Clone repository
git clone <repo-url>
cd totobaru

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local dengan Supabase URL dan Anon Key

# Run development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

### Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## 🏗️ Build

```bash
npm run build
npm start
```

## 📄 License

Private — CV Toto Aluminium Manufacture
