import midtransClient from "midtrans-client";

// Konfigurasi Midtrans
// Nantinya, tambahkan Server Key dari Dashboard Midtrans ke .env.local
export const midtrans = new midtransClient.Snap({
    isProduction: process.env.MIDTRANS_IS_PRODUCTION === "true",
    serverKey: process.env.MIDTRANS_SERVER_KEY || "SB-Mid-server-TEST-KEY-PASTE-HERE",
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY || "SB-Mid-client-TEST-KEY-PASTE-HERE"
});

// Harga berdasarkan aturan baru (CV TOTO)
export const BILLING_CONFIG = {
    INITIAL_SETUP_PRICE: 15500000, // Rp 15.5jt (2 bln + server)
    MONTHLY_PRICE: 5950000,      // Rp 5.95jt (per 30 hari)
    MAX_USERS: 7
};
