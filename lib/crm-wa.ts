// ============================================================
// lib/crm-wa.ts
// Template pesan WhatsApp CRM (dipindah dari app/dashboard/crm/page.tsx
// agar bisa dipakai semua tab). Deep link via waLink (crm-analytics).
//
// TODO: titik integrasi webhook WhatsApp — saat API WA masuk, ganti
// deep link dgn pengiriman via API + pencatatan aktivitas per customer.
// ============================================================
import { formatCurrency } from "@/lib/utils";

export { waLink } from "@/lib/crm-analytics";

// Sapaan WA default (re-engagement: tanya kabar → tawarkan order lagi).
// Tanpa emoji — beberapa klien WhatsApp merusak emoji yang dikirim via wa.me.
export function waGreeting(name: string, pic: string): string {
    const sapaan = (pic || name || "Bapak/Ibu").trim();
    return `Halo ${sapaan}, apa kabar? Semoga sehat selalu dan usahanya lancar.\n\n`
        + `Kami dari *CV TOTO Aluminium Manufacture*. Apakah ada kebutuhan pesanan aluminium lagi yang bisa kami bantu? `
        + `Kami siap melayani.`;
}

// Pesan pengingat piutang.
export function waPiutang(name: string, pic: string, amount: number, invoices: string[]): string {
    const sapaan = (pic || name || "Bapak/Ibu").trim();
    const inv = invoices.length ? ` (invoice: ${invoices.join(", ")})` : "";
    return `Halo ${sapaan}, mohon maaf mengganggu.\n\n`
        + `Kami dari *CV TOTO Aluminium Manufacture* ingin mengingatkan tagihan yang masih belum lunas sebesar *${formatCurrency(amount)}*${inv}.\n\n`
        + `Mohon konfirmasi pembayarannya ya. Terima kasih.`;
}
