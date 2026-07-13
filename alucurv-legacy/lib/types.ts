// ============================================================
// MODEL DATA ALUCURV ERP
// Struktur mengikuti Google Sheet ALUCURV (37 tab) yang sudah ada.
// ============================================================

export type ID = string;

// ---------- Master ----------
export interface Account {
  id: ID;
  name: string; // "Cash Alucurv", "BCA Iva. Alucurv", "JAGO Opr. Iva", dst
  type: "cash" | "bank" | "marketplace";
  openingBalance: number;
}

export type CategoryType = "Pemasukan" | "Pengeluaran";

export interface SubCategory {
  id: ID;
  type: CategoryType;
  name: string; // "Bahan Baku", "Tenaga Kerja Produksi", "Operasional Umum", ...
}

export interface Supplier {
  id: ID;
  name: string; // PT.LINTANG, AX.BEKASI KACA, RIZKY GLASS, BINTANG MANDIRI, ...
}

export interface Employee {
  id: ID;
  name: string; // MUNIR, WADA, PAK BP, NOVIT, FEBRI, IVA
  role: string; // Produksi / Admin Finance / Marketing
  division: "Produksi" | "Admin" | "Marketing";
  weeklyBase: number; // acuan gaji mingguan
  active: boolean;
}

// ---------- Keuangan ----------
export interface Transaction {
  id: ID;
  date: string; // ISO yyyy-mm-dd
  description: string;
  type: CategoryType;
  subCategoryId: ID;
  amount: number;
  accountId: ID;
  note?: string;
}

// ---------- Order (marketplace + offline) ----------
export type OrderChannel = "Shopee" | "TikTokShop" | "Offline";

export interface Order {
  id: ID;
  date: string;
  invoiceId?: ID; // relasi ke invoice bila ada
  customer: string;
  description: string; // ex: 3" M D.80 HITAM DOFF : 1,6 x 2Pcs. Rakit + Kaca Riben + Ornament
  channel: OrderChannel;
  deadline: string;
  price: number;
  expedition?: string; // Sentral Cargo, JNT, dll
  // pipeline status (checkbox seperti di sheet ORDER)
  produksi: boolean;
  perakitan: boolean;
  packing: boolean;
  dikirim: boolean;
  sampai: boolean;
}

// ---------- Invoice / Nota ----------
export type InvoiceStatus = "LUNAS" | "DP" | "BELUM";

export interface InvoiceItem {
  id: ID;
  description: string;
  qty: number;
  unitPrice: number;
}

export interface Invoice {
  id: ID;
  number: string; // AL/INV/07/2026/030
  date: string;
  customer: string;
  items: InvoiceItem[];
  status: InvoiceStatus;
  dpAmount?: number;
  paidDate?: string;
  payment?: "TRANSFER" | "CASH";
  note?: string;
}

// ---------- Surat Jalan ----------
export interface DeliveryNoteItem {
  id: ID;
  description: string;
  qty: number;
}

export interface DeliveryNote {
  id: ID;
  number: string; // AL/SJ/02/2026/001
  date: string;
  customer: string;
  items: DeliveryNoteItem[];
}

// ---------- HPP ----------
export interface HppComponent {
  id: ID;
  name: string; // KUSEN BENDING, KACA, RAKIT, ORNAMEN LURUS, POTONGAN SHOPEE, PALET
  note?: string; // ex: 1,5 x 2pcs x 170.000
  cost: number; // modal
  sellPrice: number; // harga jual komponen
}

export interface HppCalculation {
  id: ID;
  productName: string; // KACAMATI D.60
  components: HppComponent[];
  marketCutPercent: number; // potongan shopee/tiktok (%)
  currentPrice: number; // harga jual sekarang di marketplace
}

// ---------- Pengadaan Bahan Baku ----------
export interface Purchase {
  id: ID;
  date: string;
  supplierId: ID;
  itemCode?: string;
  itemName: string;
  size?: string;
  unitPrice: number;
  qty: number;
  qtyLabel?: string; // "2 DUS", "3 KG"
  total: number;
  accountId: ID; // rekening pembayar (CV. TOTO / ALUCURV)
}

// ---------- Stok ----------
export interface StockItem {
  id: ID;
  code: string; // A-001
  name: string; // ORNAMEN HITAM DOFF D. 45
  category: "Produk" | "Consumable";
  minStock: number; // ambang "BUAT LAGI"
  openingStock: number;
}

export interface StockMovement {
  id: ID;
  date: string;
  itemId: ID;
  type: "masuk" | "keluar";
  qty: number;
  note?: string;
}

// ---------- Bending (order ke CV Toto) ----------
export interface BendingOrder {
  id: ID;
  date: string;
  invNo: string; // no invoice CV Toto
  amount: number;
  status: "LUNAS" | "BELUM";
  note?: string;
}

// ---------- HR ----------
export interface Attendance {
  id: ID;
  date: string;
  employeeId: ID;
  status: "MASUK" | "LIBUR" | "TIDAK MASUK";
  regularHours: number; // 8
  overtimeHours: number; // lembur
}

export interface SalaryEntry {
  id: ID;
  employeeId: ID;
  periodStart: string;
  periodEnd: string;
  base: number;
  overtime: number;
  meal: number;
  jht: number;
  bpjs: number;
  bonDeduction: number; // potongan cicilan cashbon minggu ini
  note?: string;
}

export interface Cashbon {
  id: ID;
  date: string;
  employeeId: ID;
  amount: number;
  installment: number; // cicilan per minggu
  note?: string;
  payments: { id: ID; date: string; amount: number }[];
}

// ---------- Bentuk database keseluruhan ----------
export interface Database {
  accounts: Account[];
  subCategories: SubCategory[];
  suppliers: Supplier[];
  employees: Employee[];
  transactions: Transaction[];
  orders: Order[];
  invoices: Invoice[];
  deliveryNotes: DeliveryNote[];
  hpp: HppCalculation[];
  purchases: Purchase[];
  stockItems: StockItem[];
  stockMovements: StockMovement[];
  bending: BendingOrder[];
  attendance: Attendance[];
  salaries: SalaryEntry[];
  cashbons: Cashbon[];
}

export type CollectionKey = keyof Database;
