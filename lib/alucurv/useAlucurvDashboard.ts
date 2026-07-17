"use client";
// ============================================================
// Hook data KHUSUS Dashboard Alucurv — pengganti 7x useAlucurvTable
// (yang mengunduh seluruh tabel penuh → freeze).
//
// Prinsip:
//  - Ambil hanya kolom yang dipakai dashboard.
//  - alu_transactions: hanya bulan berjalan (untuk kartu Pemasukan/
//    Pengeluaran/Laba & Rekap per Kategori).
//  - Saldo per akun: dari view v_alu_account_balances (dihitung di DB,
//    bebas cap 1000 baris). Bila view belum ada → fallback hitung di
//    client seperti perilaku lama, agar dashboard tetap tampil.
//  - Tabel yang bisa besar (orders, transaksi) diambil dengan .range
//    berulang agar tidak terpotong cap 1000 baris Supabase.
// ============================================================
import useSWR from "swr";
import { supabase } from "@/lib/supabase-client";

export interface AluDashOrder {
    id: string;
    customer: string;
    description: string | null;
    channel: string;
    deadline: string | null;
    price: number;
    received_amount: number | null;
    produksi: boolean; perakitan: boolean; packing: boolean; dikirim: boolean; sampai: boolean;
}
export interface AluDashInvoice { id: string; status: string }
export interface AluDashTransaction { id: string; date: string; type: string; amount: number; account_id: string | null; sub_category_id: string | null }
export interface AluDashStockItem { id: string; name: string; min_stock: number; opening_stock: number }
export interface AluDashAccount { id: string; name: string; type: string; balance: number }
export interface AluDashSubCategory { id: string; name: string; type: string }
export interface AluDashBendingOrder { id: string; amount: number; status: string }

export interface AlucurvDashboardData {
    orders: AluDashOrder[];
    invoices: AluDashInvoice[];
    txThisMonth: AluDashTransaction[];
    stock: AluDashStockItem[];
    accounts: AluDashAccount[];
    subCategories: AluDashSubCategory[];
    bending: AluDashBendingOrder[];
}

/** Ambil semua baris dengan .range berulang (hindari cap 1000 baris). */
async function fetchAllPaged<T>(
    page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<T[]> {
    const all: T[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await page(from, from + 999);
        if (error) throw error;
        if (data && data.length) {
            all.push(...(data as T[]));
            if (data.length < 1000) break;
            from += 1000;
        } else break;
        if (from >= 50000) break; // pengaman
    }
    return all;
}

const ORDER_COLS = "id, customer, description, channel, deadline, price, received_amount, produksi, perakitan, packing, dikirim, sampai";
const TX_COLS = "id, date, type, amount, account_id, sub_category_id";

async function fetchAccounts(): Promise<AluDashAccount[]> {
    // Sumber kebenaran: view (dihitung di DB dari SEMUA transaksi).
    const { data, error } = await supabase
        .from("v_alu_account_balances")
        .select("id, name, type, computed_balance");
    if (!error && data) {
        return data.map((r) => ({
            id: r.id as string,
            name: r.name as string,
            type: r.type as string,
            balance: Number(r.computed_balance) || 0,
        }));
    }
    // Fallback (view belum di-run di DB): perilaku lama — hitung di client.
    const [{ data: accs, error: accErr }, allTx] = await Promise.all([
        supabase.from("alu_accounts").select("id, name, type, opening_balance"),
        fetchAllPaged<{ account_id: string | null; type: string; amount: number }>((f, t) =>
            supabase.from("alu_transactions").select("account_id, type, amount").range(f, t)
        ),
    ]);
    if (accErr) throw accErr;
    return (accs ?? []).map((a) => {
        const delta = allTx
            .filter((t) => t.account_id === a.id)
            .reduce((s, t) => s + (t.type === "Pemasukan" ? Number(t.amount || 0) : -Number(t.amount || 0)), 0);
        return {
            id: a.id as string,
            name: a.name as string,
            type: a.type as string,
            balance: Number(a.opening_balance || 0) + delta,
        };
    });
}

async function fetchDashboard(): Promise<AlucurvDashboardData> {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const [orders, invoices, txThisMonth, stockRes, subCatRes, bendingRes, accounts] = await Promise.all([
        fetchAllPaged<AluDashOrder>((f, t) => supabase.from("alu_orders").select(ORDER_COLS).order("id").range(f, t)),
        fetchAllPaged<AluDashInvoice>((f, t) => supabase.from("alu_invoices").select("id, status").order("id").range(f, t)),
        fetchAllPaged<AluDashTransaction>((f, t) =>
            supabase.from("alu_transactions").select(TX_COLS).gte("date", monthStart).order("id").range(f, t)
        ),
        supabase.from("alu_stock_items").select("id, name, min_stock, opening_stock"),
        supabase.from("alu_sub_categories").select("id, name, type"),
        supabase.from("alu_bending_orders").select("id, amount, status"),
        fetchAccounts(),
    ]);

    if (stockRes.error) throw stockRes.error;
    if (subCatRes.error) throw subCatRes.error;
    if (bendingRes.error) throw bendingRes.error;

    return {
        orders,
        invoices,
        txThisMonth,
        stock: (stockRes.data ?? []) as AluDashStockItem[],
        accounts,
        subCategories: (subCatRes.data ?? []) as AluDashSubCategory[],
        bending: (bendingRes.data ?? []) as AluDashBendingOrder[],
    };
}

export function useAlucurvDashboard() {
    const { data, error, isLoading, mutate } = useSWR("alucurv-dashboard", fetchDashboard, {
        revalidateOnFocus: true,
        dedupingInterval: 5000,
    });
    return { data, loading: isLoading, error: error ? String(error) : null, refresh: mutate };
}
