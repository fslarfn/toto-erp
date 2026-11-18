"use client";

import useSWR from "swr";
import { supabase } from "@/lib/supabase-client";

export type GabunganUnit = "toto_pusat" | "toto_sidoarjo" | "alucurv";

export const UNIT_META: Record<GabunganUnit, { label: string; short: string; href: string; color: string }> = {
    toto_pusat: { label: "Toto Pusat", short: "Pusat", href: "/dashboard", color: "#8B5E3C" },
    toto_sidoarjo: { label: "Toto Sidoarjo", short: "Sidoarjo", href: "/dashboard/sidoarjo", color: "#A67B5B" },
    alucurv: { label: "Alucurv", short: "Alucurv", href: "/dashboard/alucurv", color: "#0F9E93" },
};

export type CombinedOrder = {
    id: string;
    unit: GabunganUnit;
    date: string;
    customer: string;
    description: string;
    invoice: string;
    total: number;
    paid: boolean;
    production: "Belum" | "Produksi" | "Warna" | "Siap kirim" | "Terkirim";
};

export type CombinedFlow = {
    id: string;
    unit: GabunganUnit;
    date: string;
    type: "Pemasukan" | "Pengeluaran";
    amount: number;
    description: string;
    account: string;
};

export type UnitSummary = {
    unit: GabunganUnit;
    orderCount: number;
    orderValue: number;
    shippedValue: number;
    activeOrders: number;
    receivable: number;
    income: number;
    expense: number;
    balance: number;
};

export type GabunganData = {
    orders: CombinedOrder[];
    flows: CombinedFlow[];
    summaries: UnitSummary[];
    period: string;
};

const PAGE = 1000;
const toNumber = (value: unknown) => Number(String(value ?? "0").replace(",", ".")) || 0;
const orderTotal = (harga: unknown, qty: unknown, ukuran: unknown) => toNumber(harga) * toNumber(qty) * toNumber(ukuran);

async function fetchAll<T>(fetcher: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message?: string } | null }>) {
    const rows: T[] = [];
    for (let from = 0; from < 50000; from += PAGE) {
        const { data, error } = await fetcher(from, from + PAGE - 1);
        if (error) throw new Error(error.message || "Gagal memuat data Gabungan.");
        const page = (data ?? []) as T[];
        rows.push(...page);
        if (page.length < PAGE) break;
    }
    return rows;
}

function monthBounds(period: string) {
    const [year, month] = period.split("-").map(Number);
    const end = new Date(year, month, 0).getDate();
    return { start: `${period}-01`, end: `${period}-${String(end).padStart(2, "0")}` };
}

function totoStatus(row: { di_kirim?: boolean; siap_kirim?: boolean; di_warna?: boolean; di_produksi?: boolean }): CombinedOrder["production"] {
    if (row.di_kirim) return "Terkirim";
    if (row.siap_kirim) return "Siap kirim";
    if (row.di_warna) return "Warna";
    if (row.di_produksi) return "Produksi";
    return "Belum";
}

async function fetchGabungan(period: string): Promise<GabunganData> {
    const { start, end } = monthBounds(period);
    const [totoRows, aluRows, cashRows, aluFlows, bankRows, aluAccounts] = await Promise.all([
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("pesanan_rows")
            .select("id,operating_unit,tanggal,customer,deskripsi,no_inv,harga,qty,ukuran,is_paid,di_produksi,di_warna,siap_kirim,di_kirim")
            .in("operating_unit", ["toto_pusat", "toto_sidoarjo"]).gte("tanggal", start).lte("tanggal", end).order("id", { ascending: false }).range(from, to)),
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("alu_orders")
            .select("id,date,customer,description,price,received_amount,produksi,perakitan,packing,dikirim,sampai")
            .gte("date", start).lte("date", end).order("id", { ascending: false }).range(from, to)),
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("cash_flow")
            .select("id,operating_unit,date,type,amount,description,bank_account,category,is_test,is_adjustment,transfer_group")
            .in("operating_unit", ["toto_pusat", "toto_sidoarjo"]).gte("date", start).lte("date", end).order("id", { ascending: false }).range(from, to)),
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("alu_transactions")
            .select("id,date,type,amount,description,account_id,transfer_group").gte("date", start).lte("date", end).order("id", { ascending: false }).range(from, to)),
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("bank_accounts")
            .select("id,operating_unit,balance,initial_balance").in("operating_unit", ["toto_pusat", "toto_sidoarjo"]).range(from, to)),
        fetchAll<Record<string, unknown>>((from, to) => supabase.from("v_alu_account_balances")
            .select("id,computed_balance").range(from, to)),
    ]);

    const orders: CombinedOrder[] = [
        ...totoRows.map((row) => ({
            id: `toto-${row.id}`,
            unit: row.operating_unit as "toto_pusat" | "toto_sidoarjo",
            date: String(row.tanggal || ""), customer: String(row.customer || "—"), description: String(row.deskripsi || ""),
            invoice: String(row.no_inv || ""), total: orderTotal(row.harga, row.qty, row.ukuran), paid: Boolean(row.is_paid), production: totoStatus(row),
        })),
        ...aluRows.map((row) => ({
            id: `alu-${row.id}`, unit: "alucurv" as const, date: String(row.date || ""), customer: String(row.customer || "—"),
            description: String(row.description || ""), invoice: "", total: toNumber(row.received_amount) || toNumber(row.price), paid: Boolean(row.sampai),
            production: (row.sampai ? "Terkirim" : row.dikirim ? "Siap kirim" : row.packing || row.perakitan ? "Warna" : row.produksi ? "Produksi" : "Belum") as CombinedOrder["production"],
        })),
    ];

    const flows: CombinedFlow[] = [
        ...cashRows
            .filter((row) => !row.is_test && !row.is_adjustment && !row.transfer_group && !/mutasi antar kas|penyesuaian saldo/i.test(String(row.category || "")))
            .map((row) => ({ id: `cash-${row.id}`, unit: row.operating_unit as "toto_pusat" | "toto_sidoarjo", date: String(row.date || ""), type: String(row.type) === "Pemasukan" || String(row.type) === "income" ? "Pemasukan" as const : "Pengeluaran" as const, amount: toNumber(row.amount), description: String(row.description || row.category || "—"), account: String(row.bank_account || "Kas") })),
        ...aluFlows
            .filter((row) => !row.transfer_group)
            .map((row) => ({ id: `alu-flow-${row.id}`, unit: "alucurv" as const, date: String(row.date || ""), type: String(row.type) === "Pemasukan" ? "Pemasukan" as const : "Pengeluaran" as const, amount: toNumber(row.amount), description: String(row.description || "—"), account: "Alucurv" })),
    ];

    const summaries = (Object.keys(UNIT_META) as GabunganUnit[]).map((unit) => {
        const unitOrders = orders.filter((row) => row.unit === unit);
        const unitFlows = flows.filter((row) => row.unit === unit);
        const accountBalance = unit === "alucurv"
            ? aluAccounts.reduce((sum, row) => sum + toNumber(row.computed_balance), 0)
            : bankRows.filter((row) => row.operating_unit === unit).reduce((sum, row) => sum + toNumber(row.balance ?? row.initial_balance), 0);
        return {
            unit,
            orderCount: unitOrders.length,
            orderValue: unitOrders.reduce((sum, row) => sum + row.total, 0),
            shippedValue: unitOrders.filter((row) => row.production === "Terkirim").reduce((sum, row) => sum + row.total, 0),
            activeOrders: unitOrders.filter((row) => row.production !== "Terkirim").length,
            receivable: unitOrders.filter((row) => !row.paid).reduce((sum, row) => sum + row.total, 0),
            income: unitFlows.filter((row) => row.type === "Pemasukan").reduce((sum, row) => sum + row.amount, 0),
            expense: unitFlows.filter((row) => row.type === "Pengeluaran").reduce((sum, row) => sum + row.amount, 0),
            balance: accountBalance,
        };
    });
    return { orders, flows, summaries, period };
}

export function useGabunganDashboard(period: string) {
    const { data, error, isLoading, mutate } = useSWR(`gabungan-dashboard:${period}`, () => fetchGabungan(period), { revalidateOnFocus: true, dedupingInterval: 5000 });
    return { data, loading: isLoading, error: error instanceof Error ? error.message : error ? String(error) : "", refresh: mutate };
}

export const rupiah = (value: number) => `Rp ${Math.round(value || 0).toLocaleString("id-ID")}`;
