// ============================================================
// lib/piutang.ts
// SATU sumber kebenaran perhitungan PIUTANG dari pesanan_rows.
// Dipakai Dashboard & Executive Cockpit agar angkanya identik.
//
// Definisi (mengikuti Cockpit):
//   - hanya baris belum lunas (is_paid = false)
//   - baris tanpa tanggal atau bernilai <= 0 dilewati (data tak lengkap)
//   - nilai = harga * ukuran * qty (format angka Indonesia)
//   - digabung per invoice (no_inv; fallback id baris)
// ============================================================
import { parseIdNum } from "./utils";
import { supabase } from "./supabase-client";

export interface PiutangRowLike {
    id: number | string;
    no_inv?: string | null;
    customer?: string | null;
    tanggal?: string | null;
    harga?: string | number | null;
    ukuran?: string | number | null;
    qty?: string | number | null;
    is_paid?: boolean | null;
}

/** Nilai satu baris item pesanan. */
export function pesananRowTotal(r: Pick<PiutangRowLike, "harga" | "ukuran" | "qty">): number {
    return parseIdNum(r.harga ?? "") * parseIdNum(r.ukuran ?? "") * parseIdNum(r.qty ?? "");
}

/**
 * Kelompokkan baris BELUM LUNAS per invoice (dedup no_inv).
 * Baris tanpa tanggal / total <= 0 dilewati — sama persis dengan Cockpit.
 */
export function groupUnpaidInvoices(
    rows: PiutangRowLike[]
): Map<string, { tanggal: string; total: number }> {
    const invMap = new Map<string, { tanggal: string; total: number }>();
    for (const r of rows) {
        if (r.is_paid) continue;
        if (!r.tanggal) continue;
        const total = pesananRowTotal(r);
        if (total <= 0) continue;
        const key = ((r.no_inv || String(r.id)) as string).trim();
        const ex = invMap.get(key);
        if (ex) ex.total += total;
        else invMap.set(key, { tanggal: r.tanggal, total });
    }
    return invMap;
}

/** Total piutang + jumlah invoice belum lunas. */
export function computePiutang(rows: PiutangRowLike[]): { total: number; invoiceCount: number } {
    const m = groupUnpaidInvoices(rows);
    let total = 0;
    m.forEach((v) => { total += v.total; });
    return { total, invoiceCount: m.size };
}

/**
 * Ambil SEMUA baris pesanan belum lunas (is_paid = false di DB) dengan
 * paginasi .range — tanpa ini, client Supabase diam-diam memotong di
 * 1000 baris sehingga piutang bisa undercount.
 * Catatan: baris is_paid NULL (belum pernah ditandai) TIDAK ikut — sama
 * dengan perilaku Cockpit selama ini.
 */
export async function fetchUnpaidPesananRows(): Promise<PiutangRowLike[]> {
    const all: PiutangRowLike[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await supabase
            .from("pesanan_rows")
            .select("id, no_inv, customer, tanggal, harga, ukuran, qty, is_paid")
            .eq("is_paid", false)
            .order("id", { ascending: true })
            .range(from, from + 999);
        if (error) throw error;
        if (data && data.length) {
            all.push(...(data as PiutangRowLike[]));
            if (data.length < 1000) break;
            from += 1000;
        } else break;
        if (from >= 50000) break; // pengaman
    }
    return all;
}

/** Ringkasan piutang langsung dari DB — dipakai Dashboard & Cockpit. */
export async function fetchPiutangSummary(): Promise<{ total: number; invoiceCount: number }> {
    return computePiutang(await fetchUnpaidPesananRows());
}
