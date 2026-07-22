// ============================================================
// lib/crm-marketers.ts
// Daftar marketing (PIC) — sumber: tabel crm_marketers.
// Fallback ke DEFAULT_MARKETERS bila tabel belum ada / kosong,
// sehingga app tetap jalan sebelum migrasi 20260722_crm_marketers
// dijalankan. Dika sudah tidak ada di daftar (keputusan owner).
// ============================================================
import { supabase } from "./supabase-client";

export interface Marketer {
    id: string;        // slug ('toto', 'faisal', …) — disimpan di customers.marketing_id
    name: string;
    color: string;
    active: boolean;
}

export const DEFAULT_MARKETERS: Marketer[] = [
    { id: "toto",   name: "Toto",   color: "#4E6B57", active: true },
    { id: "faisal", name: "Faisal", color: "#7A5C3A", active: true },
    { id: "livia",  name: "Livia",  color: "#8A5A6B", active: true },
];

/** Palet warna utk marketing baru — dipilih yang belum terpakai. */
export const MARKETER_COLORS = [
    "#4E6B57", "#7A5C3A", "#8A5A6B", "#5A6E8A", "#6B4E7A",
    "#7A6E4E", "#4E7A78", "#8A6E5A", "#5E7A52", "#7A4E5E",
];

export const findMarketer = (list: Marketer[], id: string | null | undefined): Marketer | undefined =>
    id ? list.find((m) => m.id === id) : undefined;

const tableMissing = (msg: string) =>
    /relation .*crm_marketers|could not find the table|schema cache/i.test(msg);

const MIGRASI_HINT =
    "Tabel 'crm_marketers' belum ada. Jalankan dulu migrasi supabase/migrations/20260722_crm_marketers.sql di Supabase SQL Editor.";

export async function fetchMarketers(): Promise<Marketer[]> {
    try {
        const { data, error } = await supabase
            .from("crm_marketers")
            .select("id, name, color, active")
            .order("created_at", { ascending: true });
        if (error || !data || data.length === 0) return DEFAULT_MARKETERS;
        return data as Marketer[];
    } catch {
        return DEFAULT_MARKETERS;
    }
}

export function marketerSlug(name: string): string {
    return name.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function addMarketer(name: string, existing: Marketer[]): Promise<void> {
    const id = marketerSlug(name);
    if (!id) throw new Error("Nama marketing tidak valid.");
    if (existing.some((m) => m.id === id)) throw new Error(`Marketing "${name.trim()}" sudah ada di daftar.`);
    const used = new Set(existing.map((m) => m.color));
    const color = MARKETER_COLORS.find((c) => !used.has(c))
        ?? MARKETER_COLORS[existing.length % MARKETER_COLORS.length];
    const { error } = await supabase
        .from("crm_marketers")
        .insert({ id, name: name.trim(), color, active: true });
    if (error) throw new Error(tableMissing(error.message ?? "") ? MIGRASI_HINT : error.message);
}

/** Nonaktifkan/aktifkan — nonaktif disembunyikan dari UI, riwayat bonus utuh. */
export async function setMarketerActive(id: string, active: boolean): Promise<void> {
    const { error } = await supabase.from("crm_marketers").update({ active }).eq("id", id);
    if (error) throw new Error(tableMissing(error.message ?? "") ? MIGRASI_HINT : error.message);
}
