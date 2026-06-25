export type UserRole = 'owner' | 'finance' | 'sales' | 'produksi' | 'barang' | 'finishing';

// Matches toto-backend reference exactly
export type ProductionStatus =
  | 'belum_produksi'
  | 'di_produksi'
  | 'di_warna'
  | 'siap_kirim'
  | 'di_kirim';

export type DeliveryStatus = 'belum_kirim' | 'sudah_kirim';
export type PaymentStatus = 'belum_bayar' | 'bayar_sebagian' | 'lunas';

export interface User {
  id: string;
  name: string;
  username: string;
  role: UserRole;
  avatar?: string;
}

export interface Order {
  id: string;
  poNumber: string;
  invoiceNumber: string;
  sjNumber: string;
  customerName: string;
  orderDate: string;       // YYYY-MM-DD
  dueDate: string;
  description: string;
  qty: number;
  size: string;
  vendor: string;
  unitPrice: number;
  totalPrice: number;
  notes: string;
  productionStatus: ProductionStatus;
  deliveryStatus: DeliveryStatus;
  paymentStatus: PaymentStatus;
  paidAmount: number;
  rowColor?: string;       // color marker per row (like toto-backend)
  createdBy: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  orderId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  bankAccount: string;
  notes: string;
  recordedBy: string;
}

export interface Material {
  id: string;
  code: string;            // material code, like toto-backend
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  minimumStock: number;
  location: string;
  lastUpdated: string;
}

export interface CashFlow {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string;
  bankAccount: string;     // nama kas (legacy, dipertahankan utk kompatibilitas)
  accountId: string | null; // FK ke BankAccount.id — sumber kebenaran pemetaan kas
  createdBy: string;
  isTest: boolean;         // entri simulasi/preview → dikecualikan dari laporan riil
  isAdjustment: boolean;   // entri penyesuaian manual
  transferGroup: string | null; // penanda pasangan mutasi antar-kas (income+expense)
}

export interface BankAccount {
  id: string;
  name: string;            // BCA Toto, BCA Yanto, Cash
  bank: string;
  accountNumber: string;
  balance: number;         // cache saldo (hasil hitung). Bukan sumber kebenaran.
  initialBalance: number;  // saldo pembuka sebelum periode pencatatan
}

// Ringkasan rekonsiliasi per akun (stored vs computed)
export interface AccountReconciliation {
  id: string;
  name: string;
  storedBalance: number;
  computedBalance: number;
  diff: number;            // stored - computed (idealnya 0)
}

// ── Notifikasi (tabel `notifications`) ──
export type NotificationSeverity = 'info' | 'warning' | 'danger';

export type NotificationType =
  | 'piutang_jatuh_tempo'
  | 'stok_minimum'
  | 'pesanan_baru'
  | 'produksi_selesai'
  | 'absensi'
  | 'tagihan_jatuh_tempo'
  | string;                // tetap longgar agar kompatibel dengan tipe lama

export interface NotificationRecord {
  id: string;              // UUID
  title: string;
  body: string;
  url: string | null;
  notification_type: NotificationType;
  severity: NotificationSeverity;
  is_read: boolean;
  target_user_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
}

// Kategori tab pada NotificationPanel
export type NotificationCategory = 'keuangan' | 'produksi' | 'stok';

// ── CRM (master customer) ──
export type CustomerType = 'retail' | 'proyek' | 'kontraktor' | 'reseller' | 'lainnya';

export interface Customer {
  id: string;
  name: string;
  phone: string;       // nomor WA/HP
  address: string;
  type: CustomerType;
  pic: string;         // nama kontak / PIC
  notes: string;
  createdAt?: string;
  updatedAt?: string;
}
