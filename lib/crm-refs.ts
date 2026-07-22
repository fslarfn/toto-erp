// ============================================================
// lib/crm-refs.ts
// CRM Terpadu — IO Supabase utk tabel referensi baru (Tahap 1):
//   region_coords   : koordinat kota utk tab Peta Wilayah
//   marketing_bonus : catatan bonus final per marketing per bulan
//
// Pola sama dgn lib/piutang.ts: fungsi fetch sederhana dari client,
// RLS yang membatasi akses (baca: authenticated; tulis: owner/finance).
// ============================================================
import { supabase } from "./supabase-client";

export interface RegionCoord {
    kota: string;
    provinsi: string;
    lat: number;
    lng: number;
}

export async function fetchRegionCoords(): Promise<RegionCoord[]> {
    const { data, error } = await supabase
        .from("region_coords")
        .select("kota, provinsi, lat, lng")
        .order("kota", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
        kota: (r.kota as string) ?? "",
        provinsi: (r.provinsi as string) ?? "",
        lat: Number(r.lat),
        lng: Number(r.lng),
    }));
}

export interface MarketingBonusRecord {
    id?: string;
    marketing_id: string;
    period: string;           // 'YYYY-MM'
    omset: number;
    rate: number;             // persen (0.5 = 0,5%)
    bonus: number;
    locked_at?: string;
    locked_by?: string;
}

/** Bonus terkunci utk satu periode ('' = semua periode). */
export async function fetchMarketingBonuses(period?: string): Promise<MarketingBonusRecord[]> {
    let q = supabase
        .from("marketing_bonus")
        .select("id, marketing_id, period, omset, rate, bonus, locked_at, locked_by");
    if (period) q = q.eq("period", period);
    const { data, error } = await q.order("period", { ascending: false });
    if (error) throw error;
    return (data ?? []) as MarketingBonusRecord[];
}

/** Kunci & catat bonus (upsert — satu catatan final per marketing per bulan,
 *  sesuai unique index (marketing_id, period)). RLS: hanya owner/finance. */
export async function lockMarketingBonus(rec: {
    marketing_id: string;
    period: string;
    omset: number;
    rate: number;
    bonus: number;
    locked_by?: string;
}): Promise<void> {
    const { error } = await supabase
        .from("marketing_bonus")
        .upsert(
            { ...rec, locked_at: new Date().toISOString() },
            { onConflict: "marketing_id,period" }
        );
    if (error) throw error;
}
