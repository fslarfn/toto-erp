import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

export function formatDate(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        return format(new Date(dateStr), "dd MMM yyyy", { locale: idLocale });
    } catch {
        return dateStr;
    }
}

export function formatDateShort(dateStr: string): string {
    if (!dateStr) return "-";
    try {
        return format(new Date(dateStr), "dd/MM/yy", { locale: idLocale });
    } catch {
        return dateStr;
    }
}

export function formatDateInput(dateStr: string): string {
    if (!dateStr) return "";
    try {
        return format(new Date(dateStr), "yyyy-MM-dd");
    } catch {
        return dateStr;
    }
}

export function generateNumbers(existingCount: number) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const seq = String(existingCount + 1).padStart(3, "0");
    const prefix = `${year}${month}`;

    return {
        poNumber: `PO-${prefix}-${seq}`,
        invoiceNumber: `INV-${prefix}-${seq}`,
        sjNumber: `SJ-${prefix}-${seq}`,
    };
}

/* =========================================
   PRODUCTION STATUS — same as toto-backend
   ========================================= */
export const PRODUCTION_STATUS_LABELS: Record<string, string> = {
    belum_produksi: "Belum Produksi",
    di_produksi: "Di Produksi",
    di_warna: "Di Warna",
    siap_kirim: "Siap Kirim",
    di_kirim: "Di Kirim",
};

// Tailwind classes for badges
export const PRODUCTION_STATUS_COLORS: Record<string, string> = {
    belum_produksi: "status-belum_produksi",
    di_produksi: "status-di_produksi",
    di_warna: "status-di_warna",
    siap_kirim: "status-siap_kirim",
    di_kirim: "status-di_kirim",
};

export const PRODUCTION_STATUS_ORDER = [
    "belum_produksi",
    "di_produksi",
    "di_warna",
    "siap_kirim",
    "di_kirim",
];

/* =========================================
   PAYMENT STATUS
   ========================================= */
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
    belum_bayar: "Belum Bayar",
    bayar_sebagian: "Bayar Sebagian",
    lunas: "Lunas",
};

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
    belum_bayar: "bg-red-100 text-red-700",
    bayar_sebagian: "bg-yellow-100 text-yellow-700",
    lunas: "bg-green-100 text-green-700",
};

/* =========================================
   DELIVERY STATUS
   ========================================= */
export const DELIVERY_STATUS_LABELS: Record<string, string> = {
    belum_kirim: "Belum Kirim",
    sudah_kirim: "Sudah Kirim",
};

export const DELIVERY_STATUS_COLORS: Record<string, string> = {
    belum_kirim: "bg-orange-100 text-orange-700",
    sudah_kirim: "bg-green-100 text-green-700",
};
