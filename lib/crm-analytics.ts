// ============================================================
// lib/crm-analytics.ts
// CRM Terpadu — derivasi murni (tanpa IO) dari data yang sudah ada:
//   customers (master)  +  pesanan_rows (satu-satunya sumber order).
//
// Semua angka (total order, piutang, order terakhir, tier, dormant,
// rollup marketing, agregasi wilayah) DIHITUNG di sini — tidak ada
// kolom duplikat di DB. Ambang/konstanta bisnis dikumpulkan di atas
// supaya mudah diubah.
// ============================================================
import type { Customer } from "@/types";
import { parseIdNum } from "@/lib/utils";

/* ================= Konstanta bisnis (mudah diubah) ================= */

/** Tier dari total order historis: A ≥ 20 jt, B ≥ 3 jt, C sisanya. */
export const TIER_A_MIN = 20_000_000;
export const TIER_B_MIN = 3_000_000;

/** Dormant bila tidak order ≥ 90 hari; kelompok lanjut di 180 hari. */
export const DORMANT_DAYS = 90;
export const DORMANT_LONG_DAYS = 180;

/** Default bonus marketing (persen dari omset) — bisa diubah di UI. */
export const DEFAULT_BONUS_RATE = 0.5;

/** Daftar marketing (PIC). Menambah orang cukup di sini — kolom
 *  customers.marketing_id sengaja TEXT bebas, tanpa migrasi. */
export const MARKETERS = [
    { id: "toto",   name: "Toto",   color: "#4E6B57" },
    { id: "faisal", name: "Faisal", color: "#7A5C3A" },
    { id: "livia",  name: "Livia",  color: "#8A5A6B" },
    { id: "dika",   name: "Dika",   color: "#5A6E8A" },
] as const;
export type MarketerId = (typeof MARKETERS)[number]["id"];
export const marketerById = (id: string) => MARKETERS.find((m) => m.id === id);

/* ================= Tipe ================= */

/** Subset baris pesanan yang dibutuhkan analitik (kompatibel PesananRow). */
export interface OrderRowLike {
    id: number | string;
    tanggal?: string | null;   // 'YYYY-MM-DD' (TEXT di DB)
    customer?: string | null;
    deskripsi?: string | null;
    ukuran?: string | number | null;
    qty?: string | number | null;
    harga?: string | number | null;
    no_inv?: string | null;
    is_paid?: boolean | null;
}

export type Tier = "A" | "B" | "C";

/** Agregat order per customer (kunci: nama ternormalisasi). */
export interface CustomerStat {
    name: string;            // nama tampilan (dari baris pesanan pertama)
    count: number;           // jumlah baris order
    total: number;           // total nilai historis
    unpaid: number;          // piutang berjalan
    last: string;            // tanggal order terakhir
    oldestUnpaid: string;    // tanggal invoice belum-lunas tertua
    invoices: Set<string>;
    unpaidInvoices: Set<string>;
}

/** Customer + statistik + label derivasi — bahan semua tab. */
export interface EnrichedCustomer {
    c: Customer;
    stat: CustomerStat;
    days: number;            // hari sejak order terakhir (0 bila belum pernah)
    dormant: boolean;
    tier: Tier;
    overdueDays: number;     // umur piutang (0 bila tak ada piutang)
}

/* ================= Util dasar ================= */

export function normalizeName(name: string | null | undefined): string {
    return (name ?? "").trim().toLowerCase();
}

/** Kunci deteksi duplikat: lowercase + buang semua non-alfanumerik.
 *  "11 - 12 ALUMINIUM" dan "11- 12 ALUMINIUM" → kunci sama. */
export function dedupKey(name: string | null | undefined): string {
    return (name ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Digit nomor WA (untuk pencocokan duplikat & deep link). */
export function phoneDigits(phone: string | null | undefined): string {
    return (phone ?? "").replace(/[^0-9]/g, "");
}

export function daysSince(dateStr: string): number {
    if (!dateStr) return 0;
    const t = new Date(dateStr).getTime();
    if (Number.isNaN(t)) return 0;
    return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** Nilai satu baris pesanan = harga × ukuran × qty (format Indonesia). */
export function orderRowValue(r: OrderRowLike): number {
    return parseIdNum(r.harga ?? "") * parseIdNum(r.ukuran ?? "") * parseIdNum(r.qty ?? "");
}

/** Normalisasi tanggal TEXT bebas → 'YYYY-MM-DD' ('' bila tak valid).
 *  PENTING: pesanan_rows.tanggal campur format — ada 'YYYY-MM-DD' dan ada
 *  'DD-MM-YYYY' / 'DD/MM/YYYY' (gaya Indonesia). Yang terakhir TIDAK boleh
 *  dilempar ke new Date(): parser JS membacanya bulan-duluan (07-05-2026
 *  dianggap 5 Juli, padahal 7 Mei) sehingga order nyasar ke bulan salah. */
export function isoDate(tanggal: string | null | undefined): string {
    const s = (tanggal ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/); // DD-MM-YYYY
    if (m) {
        const dd = parseInt(m[1], 10), mm = parseInt(m[2], 10);
        if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
        return `${m[3]}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return "";
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 'YYYY-MM' dari tanggal baris ('' bila tak valid). */
export function monthKey(tanggal: string | null | undefined): string {
    const s = (tanggal ?? "").trim();
    if (/^\d{4}-\d{2}/.test(s)) return s.slice(0, 7);
    const iso = isoDate(s);
    return iso ? iso.slice(0, 7) : "";
}

/** Label bulan Indonesia: '2026-04' → 'April 2026'. */
export function monthLabel(key: string): string {
    if (!/^\d{4}-\d{2}$/.test(key)) return key;
    const d = new Date(`${key}-01T00:00:00`);
    return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(d);
}

export function tierOf(total: number): Tier {
    if (total >= TIER_A_MIN) return "A";
    if (total >= TIER_B_MIN) return "B";
    return "C";
}

export function computeBonus(omset: number, ratePercent: number): number {
    return Math.round((omset * ratePercent) / 100);
}

/* ================= Agregasi inti ================= */

export const emptyCustomerStat = (name = ""): CustomerStat => ({
    name, count: 0, total: 0, unpaid: 0, last: "", oldestUnpaid: "",
    invoices: new Set(), unpaidInvoices: new Set(),
});
const emptyStat = emptyCustomerStat;

/** Agregat seluruh pesanan per nama-customer-ternormalisasi.
 *  Satu kali hitung, dipakai semua tab (memo-kan di komponen). */
export function buildStats(rows: OrderRowLike[]): Map<string, CustomerStat> {
    const map = new Map<string, CustomerStat>();
    for (const r of rows) {
        const key = normalizeName(r.customer);
        if (!key) continue;
        const val = orderRowValue(r);
        const e = map.get(key) ?? emptyStat((r.customer ?? "").trim());
        e.count += 1;
        e.total += val;
        if (r.no_inv) e.invoices.add(r.no_inv.trim());
        // Normalisasi dulu — tanggal campur format ('DD-MM-YYYY' vs ISO)
        // membuat perbandingan string mentah salah urut.
        const iso = isoDate(r.tanggal);
        if (!r.is_paid) {
            e.unpaid += val;
            if (r.no_inv) e.unpaidInvoices.add(r.no_inv.trim());
            if (iso && (!e.oldestUnpaid || iso < e.oldestUnpaid)) e.oldestUnpaid = iso;
        }
        if (iso && iso > e.last) e.last = iso;
        map.set(key, e);
    }
    return map;
}

/** Gabungkan master customers dgn statistik order → bahan semua tab. */
export function enrichCustomers(
    customers: Customer[],
    stats: Map<string, CustomerStat>
): EnrichedCustomer[] {
    return customers.map((c) => {
        const stat = stats.get(normalizeName(c.name)) ?? emptyStat(c.name);
        const days = stat.last ? daysSince(stat.last) : 0;
        return {
            c,
            stat,
            days,
            dormant: !!stat.last && days >= DORMANT_DAYS,
            tier: tierOf(stat.total),
            // ASUMSI: belum ada field jatuh tempo di pesanan_rows, jadi umur
            // piutang dihitung dari tanggal invoice belum-lunas TERTUA
            // (konservatif — tanggal invoice diperlakukan sbg jatuh tempo).
            overdueDays: stat.unpaid > 0 ? daysSince(stat.oldestUnpaid) : 0,
        };
    });
}

/* ================= Direktori: KPI ================= */

export interface DirectoryKpi {
    total: number;
    piutangTotal: number;
    piutangCount: number;
    withWa: number;
    dormantCount: number;
}

export function directoryKpi(list: EnrichedCustomer[]): DirectoryKpi {
    let piutangTotal = 0, piutangCount = 0, withWa = 0, dormantCount = 0;
    for (const e of list) {
        if (e.stat.unpaid > 0) { piutangTotal += e.stat.unpaid; piutangCount++; }
        if (e.c.phone.trim()) withWa++;
        if (e.dormant) dormantCount++;
    }
    return { total: list.length, piutangTotal, piutangCount, withWa, dormantCount };
}

/* ================= Deteksi duplikat ================= */

/** Grup kandidat duplikat: nama mirip (dedupKey sama) ATAU No. WA sama.
 *  Hanya mengembalikan kandidat utk DITINJAU — merge tidak otomatis. */
export function findDuplicateGroups(customers: Customer[]): Customer[][] {
    // union-find sederhana via map kunci → indeks grup
    const groupOf = new Map<string, number>();
    const groups: Customer[][] = [];
    const put = (key: string, c: Customer) => {
        if (!key) return null;
        const gi = groupOf.get(key);
        if (gi !== undefined) {
            if (!groups[gi].some((x) => x.id === c.id)) groups[gi].push(c);
            return gi;
        }
        return null;
    };
    for (const c of customers) {
        const nameKey = "n:" + dedupKey(c.name);
        const digits = phoneDigits(c.phone);
        const phoneKey = digits.length >= 8 ? "p:" + digits : "";
        let gi = put(nameKey, c);
        if (gi === null && phoneKey) gi = put(phoneKey, c);
        if (gi === null) {
            gi = groups.length;
            groups.push([c]);
        }
        if (dedupKey(c.name)) groupOf.set(nameKey, gi);
        if (phoneKey) groupOf.set(phoneKey, gi);
    }
    return groups.filter((g) => g.length > 1);
}

/* ================= Per Marketing ================= */

export interface MarketerRollup {
    marketingId: string;      // '' = belum di-assign
    omset: number;
    customerCount: number;    // customer dgn omset > 0 pada periode
    bonus: number;
}

export interface MarketingRollupResult {
    perMarketer: Map<string, MarketerRollup>;
    totalOmset: number;
}

/** Peta nama-ternormalisasi → marketing_id dari master. */
export function marketingByName(customers: Customer[]): Map<string, string> {
    const m = new Map<string, string>();
    for (const c of customers) m.set(normalizeName(c.name), c.marketingId ?? "");
    return m;
}

/** Kunci bulan berjalan ('YYYY-MM'). */
export function currentMonthKey(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/** Daftar bulan yang punya order, terbaru dulu — utk selektor bulan.
 *  tanggal di pesanan_rows adalah TEXT bebas; typo tahun (mis. "2001-02",
 *  "0002-04", atau teks "April 2" yang di-parse JS jadi tahun 2001)
 *  menghasilkan bulan sampah di dropdown. Karena itu dibatasi ke rentang
 *  wajar: 2020-01 s.d. satu bulan setelah bulan berjalan. Baris dengan
 *  tanggal di luar rentang tetap terhitung pada mode "Semua waktu". */
export function availableMonths(rows: OrderRowLike[]): string[] {
    const set = new Set<string>();
    for (const r of rows) {
        const k = monthKey(r.tanggal);
        if (k) set.add(k);
    }
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const maxKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    const MIN_KEY = "2020-01";
    return Array.from(set).filter((k) => k >= MIN_KEY && k <= maxKey).sort().reverse();
}

/** Rollup omset per marketing dari pesanan_rows (atribusi lewat
 *  customers.marketing_id — level customer, bukan per order).
 *  period = 'YYYY-MM' (satu bulan), 'YYYY' (satu tahun), '' = sepanjang waktu. */
export function marketingRollup(
    customers: Customer[],
    rows: OrderRowLike[],
    period: string
): MarketingRollupResult {
    const byName = marketingByName(customers);
    const omsetPerCustomer = new Map<string, number>(); // key: nama ternormalisasi
    let totalOmset = 0;
    for (const r of rows) {
        if (period && !monthKey(r.tanggal).startsWith(period)) continue;
        const key = normalizeName(r.customer);
        if (!key) continue;
        const val = orderRowValue(r);
        if (val <= 0) continue;
        omsetPerCustomer.set(key, (omsetPerCustomer.get(key) ?? 0) + val);
        totalOmset += val;
    }
    const perMarketer = new Map<string, MarketerRollup>();
    for (const m of MARKETERS) perMarketer.set(m.id, { marketingId: m.id, omset: 0, customerCount: 0, bonus: 0 });
    perMarketer.set("", { marketingId: "", omset: 0, customerCount: 0, bonus: 0 });
    omsetPerCustomer.forEach((omset, nameKey) => {
        const mid = byName.get(nameKey) ?? ""; // order tanpa master → belum di-assign
        const slot = perMarketer.get(mid) ?? perMarketer.get("")!;
        slot.omset += omset;
        slot.customerCount += 1;
    });
    return { perMarketer, totalOmset };
}

/** Baris tabel tab Per Marketing — SEMUA angka mengikuti tanggal order
 *  pada periode terpilih (omset, status bayar, nominal tagihan). */
export interface MarketerCustomerRow {
    e: EnrichedCustomer;
    periodValue: number;             // omset customer pada periode terpilih
    periodUnpaid: number;            // piutang dari order periode itu saja
    periodUnpaidInvoices: string[];  // invoice belum lunas pada periode itu
    paid: boolean;                   // lunas bila piutang periode = 0
}

/** period = 'YYYY-MM' | 'YYYY' | '' — sama dgn marketingRollup. */
export function customersOfMarketer(
    enriched: EnrichedCustomer[],
    rows: OrderRowLike[],
    marketingId: string,
    period: string
): MarketerCustomerRow[] {
    const mine = enriched.filter((e) => (e.c.marketingId ?? "") === marketingId);
    const nameSet = new Set(mine.map((e) => normalizeName(e.c.name)));
    const acc = new Map<string, { value: number; unpaid: number; inv: Set<string> }>();
    for (const r of rows) {
        const key = normalizeName(r.customer);
        if (!nameSet.has(key)) continue;
        if (period && !monthKey(r.tanggal).startsWith(period)) continue;
        const val = orderRowValue(r);
        const a = acc.get(key) ?? { value: 0, unpaid: 0, inv: new Set<string>() };
        a.value += val;
        if (!r.is_paid) {
            a.unpaid += val;
            if (r.no_inv) a.inv.add(r.no_inv.trim());
        }
        acc.set(key, a);
    }
    return mine
        .map((e) => {
            const a = acc.get(normalizeName(e.c.name)) ?? { value: 0, unpaid: 0, inv: new Set<string>() };
            return {
                e,
                periodValue: a.value,
                periodUnpaid: a.unpaid,
                periodUnpaidInvoices: Array.from(a.inv),
                paid: a.unpaid <= 0,
            };
        })
        // Periode dipilih → hanya yang beromset di periode itu; tanpa periode → semua binaan.
        .filter((r) => (period ? r.periodValue > 0 : true))
        .sort((a, b) => b.periodValue - a.periodValue || b.e.stat.total - a.e.stat.total);
}

/* ================= Peta Wilayah ================= */

export type RegionTag = "strong" | "potential" | "untapped";

export interface RegionAgg {
    kota: string;
    provinsi: string;
    count: number;
    total: number;
    avg: number;              // rata-rata nilai order per customer
    lat: number | null;       // null = kota belum ada di region_coords
    lng: number | null;
    tag: RegionTag;
}

/** Aturan status wilayah (sederhana, mudah diubah):
 *  - Basis kuat     : ≥ 12% dari seluruh customer ber-kota
 *  - Potensi tinggi : rata-rata order per customer ≥ rata-rata keseluruhan
 *  - Belum tergarap : sisanya */
export const REGION_STRONG_SHARE = 0.12;

export function aggregateRegions(
    enriched: EnrichedCustomer[],
    coords: { kota: string; provinsi: string; lat: number; lng: number }[]
): RegionAgg[] {
    const coordByKota = new Map(coords.map((r) => [r.kota.trim().toLowerCase(), r]));
    const byKota = new Map<string, { kota: string; provinsi: string; count: number; total: number }>();
    for (const e of enriched) {
        const kota = (e.c.kota ?? "").trim();
        if (!kota) continue;
        const key = kota.toLowerCase();
        const slot = byKota.get(key) ?? { kota, provinsi: (e.c.provinsi ?? "").trim(), count: 0, total: 0 };
        slot.count += 1;
        slot.total += e.stat.total;
        byKota.set(key, slot);
    }
    const totalCount = Array.from(byKota.values()).reduce((s, r) => s + r.count, 0);
    const totalValue = Array.from(byKota.values()).reduce((s, r) => s + r.total, 0);
    const overallAvg = totalCount ? totalValue / totalCount : 0;
    return Array.from(byKota.entries())
        .map(([key, r]) => {
            const co = coordByKota.get(key);
            const avg = r.count ? r.total / r.count : 0;
            const tag: RegionTag =
                totalCount && r.count / totalCount >= REGION_STRONG_SHARE ? "strong"
                : avg >= overallAvg && overallAvg > 0 ? "potential"
                : "untapped";
            return {
                kota: co?.kota ?? r.kota,
                provinsi: co?.provinsi || r.provinsi,
                count: r.count,
                total: r.total,
                avg,
                lat: co?.lat ?? null,
                lng: co?.lng ?? null,
                tag,
            };
        })
        .sort((a, b) => b.count - a.count);
}

/* ================= Piutang & Re-engagement ================= */

export interface AgingBucket {
    label: string;
    min: number;              // umur hari (inklusif)
    max: number | null;       // null = tanpa batas atas
    items: EnrichedCustomer[];
    total: number;
}

/** Aging piutang 1–30 / 31–60 / 60+ hari dari invoice tertua belum lunas. */
export function agingBuckets(enriched: EnrichedCustomer[]): AgingBucket[] {
    const withDebt = enriched.filter((e) => e.stat.unpaid > 0.01);
    const defs: { label: string; min: number; max: number | null }[] = [
        { label: "1–30 hari", min: 0, max: 30 },
        { label: "31–60 hari", min: 31, max: 60 },
        { label: "60+ hari", min: 61, max: null },
    ];
    return defs.map((d) => {
        const items = withDebt
            .filter((e) => e.overdueDays >= d.min && (d.max === null || e.overdueDays <= d.max))
            .sort((a, b) => b.overdueDays - a.overdueDays);
        return { ...d, items, total: items.reduce((s, e) => s + e.stat.unpaid, 0) };
    });
}

/** Kelompok dormant 90–180 / 180+ hari, diurut nilai historis terbesar. */
export function dormantGroups(enriched: EnrichedCustomer[]): { label: string; items: EnrichedCustomer[] }[] {
    const dormant = enriched.filter((e) => e.dormant);
    return [
        {
            label: `Dormant ${DORMANT_DAYS}–${DORMANT_LONG_DAYS} hari`,
            items: dormant.filter((e) => e.days < DORMANT_LONG_DAYS).sort((a, b) => b.stat.total - a.stat.total),
        },
        {
            label: `Dormant ${DORMANT_LONG_DAYS}+ hari`,
            items: dormant.filter((e) => e.days >= DORMANT_LONG_DAYS).sort((a, b) => b.stat.total - a.stat.total),
        },
    ];
}

/* ================= Customer 360 ================= */

/** Riwayat order satu customer, terbaru dulu (urut tanggal ternormalisasi). */
export function ordersOf<T extends OrderRowLike>(rows: T[], customerName: string): T[] {
    const key = normalizeName(customerName);
    return rows
        .filter((r) => normalizeName(r.customer) === key)
        .sort((a, b) => isoDate(b.tanggal).localeCompare(isoDate(a.tanggal)));
}

/* ================= WhatsApp deep link ================= */
// TODO: titik integrasi webhook WhatsApp — saat integrasi API WA masuk,
// ganti pembuatan deep link ini dgn pengiriman via API + pencatatan aktivitas.

export function waLink(phone: string, text: string): string | null {
    let p = phoneDigits(phone);
    if (!p) return null;
    if (p.startsWith("0")) p = "62" + p.slice(1);
    else if (p.startsWith("8")) p = "62" + p;
    return `https://wa.me/${p}?text=${encodeURIComponent(text)}`;
}
