import type { Database } from "./types";

// Data awal (contoh) diambil dari isi Google Sheet ALUCURV
// agar aplikasi langsung terasa nyata saat pertama dibuka.
export const seed: Database = {
  accounts: [
    { id: "acc-cash", name: "Cash Alucurv", type: "cash", openingBalance: 2241500 },
    { id: "acc-bca", name: "BCA Iva. Alucurv", type: "bank", openingBalance: 16719417 },
    { id: "acc-jago-opr", name: "JAGO Operasional Iva", type: "bank", openingBalance: 4141270 },
    { id: "acc-jago-tab", name: "Tabungan JAGO Iva", type: "bank", openingBalance: 20008547 },
    { id: "acc-shopee", name: "Saldo Shopee", type: "marketplace", openingBalance: 12945655 },
    { id: "acc-tiktok", name: "Saldo TikTokShop", type: "marketplace", openingBalance: 2761175 },
  ],
  subCategories: [
    { id: "sc-in-1", type: "Pemasukan", name: "Penjualan Produk Offline" },
    { id: "sc-in-2", type: "Pemasukan", name: "Proyek Borongan" },
    { id: "sc-in-3", type: "Pemasukan", name: "Pendapatan E-Commerce" },
    { id: "sc-in-4", type: "Pemasukan", name: "Penerimaan Piutang" },
    { id: "sc-in-5", type: "Pemasukan", name: "Modal Disetor" },
    { id: "sc-in-6", type: "Pemasukan", name: "Saldo Awal" },
    { id: "sc-in-7", type: "Pemasukan", name: "Pendapatan Lain" },
    { id: "sc-out-1", type: "Pengeluaran", name: "Alat atau Bahan Baku" },
    { id: "sc-out-2", type: "Pengeluaran", name: "Tenaga Kerja Produksi" },
    { id: "sc-out-3", type: "Pengeluaran", name: "Operasional Umum" },
    { id: "sc-out-4", type: "Pengeluaran", name: "Administrasi & Kantor" },
    { id: "sc-out-5", type: "Pengeluaran", name: "Penjualan & Pemasaran" },
    { id: "sc-out-6", type: "Pengeluaran", name: "Proyek Borongan" },
    { id: "sc-out-7", type: "Pengeluaran", name: "Bayar Bending CV Toto" },
    { id: "sc-out-8", type: "Pengeluaran", name: "Prive / Bonus Pemilik" },
    { id: "sc-out-9", type: "Pengeluaran", name: "Kompensasi Customer" },
  ],
  suppliers: [
    { id: "sup-1", name: "PT. LINTANG" },
    { id: "sup-2", name: "AX. BEKASI KACA" },
    { id: "sup-3", name: "RIZKY GLASS" },
    { id: "sup-4", name: "BINTANG MANDIRI" },
    { id: "sup-5", name: "SINAR ABADI KACA" },
    { id: "sup-6", name: "UD. PUTERA MANDIRI" },
    { id: "sup-7", name: "NAGA MAS PLASTIK" },
    { id: "sup-8", name: "TK. MADURA" },
    { id: "sup-9", name: "CV. TOTO ALUMINIUM" },
    { id: "sup-10", name: "TREND" },
    { id: "sup-11", name: "FENDI" },
  ],
  employees: [
    { id: "emp-munir", name: "Munir", role: "Tim Produksi", division: "Produksi", weeklyBase: 833000, active: true },
    { id: "emp-wada", name: "Wada", role: "Tim Produksi", division: "Produksi", weeklyBase: 590000, active: true },
    { id: "emp-bp", name: "Pak BP", role: "Tim Produksi", division: "Produksi", weeklyBase: 850000, active: true },
    { id: "emp-novit", name: "Novit", role: "Tim Produksi", division: "Produksi", weeklyBase: 780000, active: true },
    { id: "emp-febri", name: "Febri", role: "Admin Finance", division: "Admin", weeklyBase: 1200000, active: true },
    { id: "emp-iva", name: "Iva", role: "Admin & Marketing", division: "Marketing", weeklyBase: 1000000, active: true },
  ],
  transactions: [
    { id: "t1", date: "2026-07-06", description: "PENCAIRAN SALDO SHOPEE", type: "Pemasukan", subCategoryId: "sc-in-3", amount: 6000000, accountId: "acc-bca" },
    { id: "t2", date: "2026-07-06", description: "PENCAIRAN SALDO TIKTOKSHOP", type: "Pemasukan", subCategoryId: "sc-in-3", amount: 14000000, accountId: "acc-bca" },
    { id: "t3", date: "2026-07-06", description: "PELUNASAN A.N MADUN", type: "Pemasukan", subCategoryId: "sc-in-1", amount: 2931500, accountId: "acc-bca" },
    { id: "t4", date: "2026-07-06", description: "SINAR ABADI KACA", type: "Pengeluaran", subCategoryId: "sc-out-1", amount: 1863000, accountId: "acc-jago-opr" },
    { id: "t5", date: "2026-07-06", description: "LISTRIK", type: "Pengeluaran", subCategoryId: "sc-out-3", amount: 1000000, accountId: "acc-jago-opr" },
    { id: "t6", date: "2026-07-07", description: "TRIPLEK", type: "Pengeluaran", subCategoryId: "sc-out-1", amount: 1500000, accountId: "acc-jago-opr" },
    { id: "t7", date: "2026-07-07", description: "PELUNASAN A.N TITIN", type: "Pemasukan", subCategoryId: "sc-in-1", amount: 1895000, accountId: "acc-bca" },
    { id: "t8", date: "2026-07-08", description: "WIFI", type: "Pengeluaran", subCategoryId: "sc-out-3", amount: 285048, accountId: "acc-bca" },
    { id: "t9", date: "2026-07-09", description: "CAMILAN PAGI", type: "Pengeluaran", subCategoryId: "sc-out-3", amount: 30000, accountId: "acc-cash" },
    { id: "t10", date: "2026-07-09", description: "MAKAN SIANG", type: "Pengeluaran", subCategoryId: "sc-out-3", amount: 150000, accountId: "acc-cash" },
    { id: "t11", date: "2026-07-10", description: "GAJI MINGGUAN", type: "Pengeluaran", subCategoryId: "sc-out-2", amount: 1963000, accountId: "acc-jago-opr" },
    { id: "t12", date: "2026-07-10", description: "BAYAR BENDING CV TOTO", type: "Pengeluaran", subCategoryId: "sc-out-7", amount: 20662000, accountId: "acc-bca" },
  ],
  orders: [
    {
      id: "o1", date: "2026-07-06", customer: "ABIGAIL", channel: "Offline",
      description: '4IN JENDELA BULAT KACAMATI D.91 + KACA ES + ORNAMENT SESUAI GAMBAR',
      deadline: "2026-07-20", price: 5333000, expedition: "Ambil sendiri",
      produksi: true, perakitan: false, packing: false, dikirim: false, sampai: false, invoiceId: "inv-30",
    },
    {
      id: "o2", date: "2026-07-08", customer: "MURINA ANAS", channel: "Shopee",
      description: '3IN JENDELA KACAMATI LENGKUNG L.80 T.180 HITAM GLOSSY + KACA RIBEN + ORNAMENT',
      deadline: "2026-07-18", price: 2460000, expedition: "Sentral Cargo",
      produksi: true, perakitan: true, packing: false, dikirim: false, sampai: false,
    },
    {
      id: "o3", date: "2026-07-09", customer: "JAJANG", channel: "Offline",
      description: "7 UNIT JENDELA LENGKUNG CASEMENT & KACA MATI (PROYEK)",
      deadline: "2026-08-01", price: 28496000, expedition: "Lalamove",
      produksi: false, perakitan: false, packing: false, dikirim: false, sampai: false,
    },
    {
      id: "o4", date: "2026-07-04", customer: "ZEVALU", channel: "TikTokShop",
      description: '3" M D.100 HITAM DOFF : 1,9 x 2Pcs. Rakit + KACA RIBEN + ORNAMENT 4',
      deadline: "2026-07-12", price: 1770800, expedition: "JNT Cargo",
      produksi: true, perakitan: true, packing: true, dikirim: true, sampai: true,
    },
  ],
  invoices: [
    {
      id: "inv-30", number: "AL/INV/07/2026/030", date: "2026-07-06", customer: "ABIGAIL",
      items: [
        { id: "ii1", description: "4IN JENDELA BULAT KACAMATI D.91 CM + KACA ES + ORNAMENT SESUAI GAMBAR", qty: 1, unitPrice: 2663000 },
        { id: "ii2", description: "4IN JENDELA BULAT KACAMATI D.80 CM + KACA ES + ORNAMENT SESUAI GAMBAR", qty: 1, unitPrice: 2270000 },
        { id: "ii3", description: "JASA PEMASANGAN", qty: 1, unitPrice: 300000 },
        { id: "ii4", description: "JASA TRANSPORT TIM", qty: 1, unitPrice: 100000 },
      ],
      status: "DP", dpAmount: 2666500, payment: "TRANSFER", note: "DP 50%, pelunasan saat barang siap kirim",
    },
    {
      id: "inv-31", number: "AL/INV/07/2026/031", date: "2026-07-08", customer: "MURINA ANAS",
      items: [{ id: "ii5", description: "3IN JENDELA KACAMATI LENGKUNG L.80 T.180 HITAM GLOSSY + KACA RIBEN + ORNAMENT", qty: 1, unitPrice: 2460000 }],
      status: "LUNAS", paidDate: "2026-07-10", payment: "TRANSFER",
    },
  ],
  deliveryNotes: [
    {
      id: "sj-7", number: "AL/SJ/07/2026/007", date: "2026-07-06", customer: "BAPAK MADUN",
      items: [
        { id: "sji1", description: "4IN JENDELA LINGKARAN KUPU TARUNG COKLAT ANODIZE D.113 TANPA ORNAMENT", qty: 1 },
        { id: "sji2", description: "4IN KUSEN LENGKUNG ½ LINGKARAN D.111 COKLAT ANODIZE", qty: 1 },
      ],
    },
  ],
  hpp: [
    {
      id: "hpp-1", productName: "KACAMATI D.60", marketCutPercent: 10, currentPrice: 986000,
      components: [
        { id: "hc1", name: "KUSEN BENDING", note: "1,5 x 2pcs x 170.000", cost: 510000, sellPrice: 600000 },
        { id: "hc2", name: "KACA", cost: 170000, sellPrice: 250000 },
        { id: "hc3", name: "RAKIT", cost: 150000, sellPrice: 200000 },
        { id: "hc4", name: "ORNAMEN LURUS", note: "0,6 x 4pcs x 10.000", cost: 24000, sellPrice: 48000 },
        { id: "hc5", name: "PALET", note: "1 set + triplek", cost: 15000, sellPrice: 25000 },
      ],
    },
    {
      id: "hpp-2", productName: "KACAMATI D.80", marketCutPercent: 10, currentPrice: 1240000,
      components: [
        { id: "hc6", name: "KUSEN BENDING", note: "1,6 x 2pcs x 170.000", cost: 544000, sellPrice: 640000 },
        { id: "hc7", name: "KACA", cost: 170000, sellPrice: 250000 },
        { id: "hc8", name: "RAKIT", cost: 150000, sellPrice: 200000 },
        { id: "hc9", name: "ORNAMEN LURUS", note: "0,8 x 4pcs x 10.000", cost: 32000, sellPrice: 64000 },
        { id: "hc10", name: "PALET", note: "1 set + triplek", cost: 15000, sellPrice: 25000 },
      ],
    },
  ],
  purchases: [
    { id: "p1", date: "2026-07-06", supplierId: "sup-5", itemName: "KACA RIBEN 5MM", size: "102 x 203 cm", unitPrice: 169300, qty: 5, total: 846500, accountId: "acc-jago-opr" },
    { id: "p2", date: "2026-07-07", supplierId: "sup-8", itemName: "TRIPLEK", unitPrice: 15000, qty: 100, total: 1500000, accountId: "acc-jago-opr" },
    { id: "p3", date: "2026-07-08", supplierId: "sup-6", itemName: "PAPAN PALET", size: "110 x 100 cm", unitPrice: 2200000, qty: 1, total: 2200000, accountId: "acc-jago-opr" },
    { id: "p4", date: "2026-07-09", supplierId: "sup-1", itemName: "ORNAMENT BK INKALUM 6M", itemCode: "ORN/BK/INK", size: "6M", unitPrice: 52000, qty: 20, total: 1040000, accountId: "acc-bca" },
  ],
  stockItems: [
    { id: "s1", code: "A-001", name: "ORNAMEN HITAM DOFF D. 45", category: "Produk", minStock: 2, openingStock: 6 },
    { id: "s2", code: "A-009", name: '3" HITAM DOFF D. 80', category: "Produk", minStock: 4, openingStock: 44 },
    { id: "s3", code: "A-010", name: '3" HITAM SEMI D. 80', category: "Produk", minStock: 4, openingStock: 54 },
    { id: "s4", code: "A-011", name: '3" HITAM DOFF D. 100', category: "Produk", minStock: 4, openingStock: 16 },
    { id: "s5", code: "A-016", name: "LINGKARAN D. 80 HITAM SEMI", category: "Produk", minStock: 2, openingStock: 19 },
    { id: "s6", code: "A-021", name: "LINGKARAN D. 60 HITAM DOFF", category: "Produk", minStock: 2, openingStock: 6 },
    { id: "s7", code: "OFF-014", name: "EPSON INK (BK)", category: "Consumable", minStock: 1, openingStock: 1 },
    { id: "s8", code: "OFF-009", name: "GEL PEN JOYKO", category: "Consumable", minStock: 3, openingStock: 9 },
  ],
  stockMovements: [
    { id: "sm1", date: "2026-07-07", itemId: "s2", type: "keluar", qty: 2, note: "Order ZEVALU" },
    { id: "sm2", date: "2026-07-08", itemId: "s4", type: "masuk", qty: 12, note: "Bending dari CV Toto" },
  ],
  bending: [
    { id: "b1", date: "2026-06-08", invNo: "16956", amount: 2869500, status: "BELUM" },
    { id: "b2", date: "2026-06-12", invNo: "17065", amount: 39456000, status: "BELUM" },
    { id: "b3", date: "2026-06-12", invNo: "17096", amount: 4182000, status: "BELUM" },
    { id: "b4", date: "2026-05-21", invNo: "16509", amount: 14326000, status: "LUNAS" },
  ],
  attendance: [
    { id: "a1", date: "2026-07-09", employeeId: "emp-munir", status: "MASUK", regularHours: 8, overtimeHours: 0 },
    { id: "a2", date: "2026-07-09", employeeId: "emp-wada", status: "MASUK", regularHours: 8, overtimeHours: 2 },
    { id: "a3", date: "2026-07-09", employeeId: "emp-novit", status: "MASUK", regularHours: 8, overtimeHours: 0 },
    { id: "a4", date: "2026-07-09", employeeId: "emp-bp", status: "TIDAK MASUK", regularHours: 0, overtimeHours: 0 },
  ],
  salaries: [
    { id: "sal1", employeeId: "emp-munir", periodStart: "2026-07-06", periodEnd: "2026-07-11", base: 683000, overtime: 0, meal: 0, jht: 0, bpjs: 0, bonDeduction: 200000 },
    { id: "sal2", employeeId: "emp-wada", periodStart: "2026-07-06", periodEnd: "2026-07-11", base: 600000, overtime: 0, meal: 0, jht: 10000, bpjs: 0, bonDeduction: 200000 },
    { id: "sal3", employeeId: "emp-novit", periodStart: "2026-07-06", periodEnd: "2026-07-11", base: 890000, overtime: 0, meal: 0, jht: 0, bpjs: 0, bonDeduction: 0 },
  ],
  cashbons: [
    {
      id: "cb1", date: "2026-06-24", employeeId: "emp-munir", amount: 3000000, installment: 200000,
      note: "Dicicil mulai gajian 6 Juli, 200rb/minggu",
      payments: [{ id: "cbp1", date: "2026-07-11", amount: 200000 }],
    },
    {
      id: "cb2", date: "2026-02-22", employeeId: "emp-wada", amount: 5000000, installment: 200000,
      note: "Dicicil tiap minggu potong 200 ribu",
      payments: [
        { id: "cbp2", date: "2026-06-27", amount: 200000 },
        { id: "cbp3", date: "2026-07-04", amount: 200000 },
        { id: "cbp4", date: "2026-07-11", amount: 200000 },
      ],
    },
  ],
};
