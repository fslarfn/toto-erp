// ============================================================
// lib/crm-merge.ts
// Gabungkan customer duplikat — HATI-HATI & tanpa menghapus data order:
//   1. Semua baris pesanan_rows atas nama duplikat dipindahkan (UPDATE
//      kolom customer) ke nama customer utama. TIDAK ada baris dihapus.
//   2. Field kosong di customer utama diisi dari duplikat (phone, pic,
//      alamat, catatan, marketing, kota).
//   3. Entri duplikat dihapus dari MASTER customers saja.
// Konfirmasi ke user dilakukan di UI sebelum fungsi ini dipanggil.
// UI tersinkron via Realtime (customers & pesanan_rows dua-duanya punya
// channel di store masing-masing).
// ============================================================
import { supabase } from "./supabase-client";
import { normalizeName } from "./crm-analytics";
import type { Customer } from "@/types";

export interface MergeResult {
    movedRows: number;     // baris pesanan yang dipindahkan ke nama utama
    deletedMasters: number;
}

export async function mergeCustomers(primary: Customer, duplicates: Customer[]): Promise<MergeResult> {
    const dups = duplicates.filter((d) => d.id !== primary.id);
    if (dups.length === 0) return { movedRows: 0, deletedMasters: 0 };

    // 1. Pindahkan order: match nama persis milik entri duplikat.
    const dupNames = Array.from(new Set(
        dups.map((d) => d.name).filter((n) => n.trim() && normalizeName(n) !== normalizeName(primary.name))
    ));
    let movedRows = 0;
    if (dupNames.length) {
        const { data, error } = await supabase
            .from("pesanan_rows")
            .update({ customer: primary.name })
            .in("customer", dupNames)
            .select("id");
        if (error) throw error;
        movedRows = data?.length ?? 0;
    }

    // 2. Lengkapi field kosong di utama dari duplikat (yang pertama terisi).
    const firstFilled = (get: (c: Customer) => string | undefined): string =>
        dups.map(get).find((v) => (v ?? "").trim()) ?? "";
    const patch: Record<string, string> = {};
    if (!primary.phone.trim()) { const v = firstFilled((c) => c.phone); if (v) patch.phone = v; }
    if (!primary.pic.trim()) { const v = firstFilled((c) => c.pic); if (v) patch.pic = v; }
    if (!primary.address.trim()) { const v = firstFilled((c) => c.address); if (v) patch.address = v; }
    if (!primary.notes.trim()) { const v = firstFilled((c) => c.notes); if (v) patch.notes = v; }
    if (!(primary.marketingId ?? "").trim()) { const v = firstFilled((c) => c.marketingId); if (v) patch.marketing_id = v; }
    if (!(primary.kota ?? "").trim()) { const v = firstFilled((c) => c.kota); if (v) patch.kota = v; }
    if (!(primary.provinsi ?? "").trim()) { const v = firstFilled((c) => c.provinsi); if (v) patch.provinsi = v; }
    if (Object.keys(patch).length) {
        const { error } = await supabase
            .from("customers")
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq("id", primary.id);
        if (error) throw error;
    }

    // 3. Hapus entri duplikat dari master (data pesanan sudah dipindah).
    const { error: delErr } = await supabase
        .from("customers")
        .delete()
        .in("id", dups.map((d) => d.id));
    if (delErr) throw delErr;

    return { movedRows, deletedMasters: dups.length };
}
