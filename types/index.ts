export type UserRole = 'owner' | 'finance' | 'finance_full' | 'sales' | 'produksi' | 'barang' | 'barang_full';

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
  bankAccount: string;     // BCA Toto | BCA Yanto | Cash
  createdBy: string;
}

export interface BankAccount {
  id: string;
  name: string;            // BCA Toto, BCA Yanto, Cash
  bank: string;
  accountNumber: string;
  balance: number;
}
