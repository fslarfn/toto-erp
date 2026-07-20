"use client";
import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase-client";
import type { Customer, CustomerType } from "@/types";

/* ================================================================
   CRM STORE — master customer (Supabase-backed)
================================================================ */

export function normalizeName(name: string | null | undefined): string {
    return (name ?? "").trim().toLowerCase();
}

function dbToCustomer(r: Record<string, unknown>): Customer {
    return {
        id: r.id as string,
        name: (r.name as string) || "",
        phone: (r.phone as string) || "",
        address: (r.address as string) || "",
        type: ((r.type as string) || "retail") as CustomerType,
        pic: (r.pic as string) || "",
        notes: (r.notes as string) || "",
        createdAt: (r.created_at as string) || undefined,
        updatedAt: (r.updated_at as string) || undefined,
    };
}

function customerToDb(c: Partial<Customer>): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (c.id !== undefined) d.id = c.id;
    if (c.name !== undefined) d.name = c.name;
    if (c.phone !== undefined) d.phone = c.phone;
    if (c.address !== undefined) d.address = c.address;
    if (c.type !== undefined) d.type = c.type;
    if (c.pic !== undefined) d.pic = c.pic;
    if (c.notes !== undefined) d.notes = c.notes;
    return d;
}

type Ctx = {
    customers: Customer[];
    loading: boolean;
    addCustomer: (c: Omit<Customer, "id" | "createdAt" | "updatedAt">) => Promise<void>;
    updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
    deleteCustomer: (id: string) => Promise<void>;
    /** Import nama-nama (mis. dari pesanan) yang belum ada di master. Mengembalikan jumlah baru. */
    importNames: (names: string[]) => Promise<number>;
    /** Dipanggil otomatis oleh useCrm — memulai fetch data saat pertama kali dipakai (lazy-load). */
    ensureLoaded: () => void;
};

const CrmCtx = createContext<Ctx | null>(null);

export function CrmProvider({ children }: { children: ReactNode }) {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);

    // Lazy-load: fetch (paginasi → hindari cap 1000) baru dimulai saat ada
    // halaman yang memakai useCrm — bukan saat provider mount.
    const startedRef = useRef(false);
    const cancelledRef = useRef(false);
    const [started, setStarted] = useState(false);
    useEffect(() => {
        // Reset saat (re)mount — StrictMode dev menjalankan cleanup lalu setup ulang;
        // tanpa reset, ref tertinggal true dan hasil fetch dibuang selamanya.
        cancelledRef.current = false;
        return () => { cancelledRef.current = true; };
    }, []);

    const ensureLoaded = useCallback(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        setStarted(true);
        (async () => {
            try {
                const all: Record<string, unknown>[] = [];
                let from = 0;
                while (true) {
                    const { data, error } = await supabase
                        .from("customers").select("*")
                        .order("name", { ascending: true })
                        .range(from, from + 999);
                    if (error) { console.error("Error fetching customers:", error); break; }
                    if (data && data.length) { all.push(...data); if (data.length < 1000) break; from += 1000; }
                    else break;
                }
                if (!cancelledRef.current) setCustomers(all.map(dbToCustomer));
            } catch (e) { console.error("CRM fetch error:", e); }
            finally { if (!cancelledRef.current) setLoading(false); }
        })();
    }, []);

    // Realtime — ikut lazy: baru connect setelah data mulai dimuat.
    useEffect(() => {
        if (!started) return;
        const channel = supabase
            .channel("realtime_customers")
            .on("postgres_changes", { event: "*", schema: "public", table: "customers" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    setCustomers(prev => prev.some(x => x.id === (n as { id: string }).id) ? prev : [...prev, dbToCustomer(n)].sort((a, b) => a.name.localeCompare(b.name)));
                } else if (eventType === "UPDATE") {
                    setCustomers(prev => prev.map(x => x.id === (n as { id: string }).id ? { ...x, ...dbToCustomer(n) } : x));
                } else if (eventType === "DELETE") {
                    setCustomers(prev => prev.filter(x => x.id !== (o as { id: string }).id));
                }
            })
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [started]);

    const addCustomer = useCallback(async (c: Omit<Customer, "id" | "createdAt" | "updatedAt">) => {
        const { error } = await supabase.from("customers").insert(customerToDb(c));
        if (error) throw error;
    }, []);

    const updateCustomer = useCallback(async (id: string, updates: Partial<Customer>) => {
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c)); // optimistik
        const { error } = await supabase.from("customers")
            .update({ ...customerToDb(updates), updated_at: new Date().toISOString() })
            .eq("id", id);
        if (error) throw error;
    }, []);

    const deleteCustomer = useCallback(async (id: string) => {
        setCustomers(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from("customers").delete().eq("id", id);
        if (error) throw error;
    }, []);

    const importNames = useCallback(async (names: string[]): Promise<number> => {
        // Unik + bersih, lalu buang yang sudah ada (berdasarkan nama ternormalisasi).
        const existing = new Set(customers.map(c => normalizeName(c.name)));
        const seen = new Set<string>();
        const toInsert: { name: string }[] = [];
        for (const raw of names) {
            const name = (raw ?? "").trim();
            const key = normalizeName(name);
            if (!key || existing.has(key) || seen.has(key)) continue;
            seen.add(key);
            toInsert.push({ name });
        }
        if (toInsert.length === 0) return 0;

        // Coba batch dulu.
        const { error } = await supabase.from("customers").insert(toInsert);
        if (!error) return toInsert.length;

        // Tabel belum ada → pesan jelas (suruh jalankan migration).
        const msg = error.message || "";
        if (/relation .*customers.* does not exist|could not find the table|schema cache/i.test(msg)) {
            throw new Error("Tabel 'customers' belum ada. Jalankan dulu migration supabase/migrations/20260623_crm_customers.sql di Supabase SQL Editor.");
        }

        // Error lain (mis. 1 nama bentrok unique) → fallback per baris, lewati yang gagal.
        let ok = 0;
        for (const row of toInsert) {
            const { error: e } = await supabase.from("customers").insert(row);
            if (!e) ok++;
        }
        if (ok === 0) throw error; // semua gagal → lempar error asli
        return ok;
    }, [customers]);

    return (
        <CrmCtx.Provider value={{ customers, loading, addCustomer, updateCustomer, deleteCustomer, importNames, ensureLoaded }}>
            {children}
        </CrmCtx.Provider>
    );
}

export function useCrm() {
    const ctx = useContext(CrmCtx);
    // Halaman yang memakai hook ini otomatis memicu fetch pertama (lazy-load).
    // Effect dipanggil SEBELUM guard throw (rules-of-hooks: urutan hook wajib
    // konsisten antar-render), dengan dep stabil (ensureLoaded = useCallback).
    const ensureLoaded = ctx?.ensureLoaded;
    useEffect(() => { ensureLoaded?.(); }, [ensureLoaded]);
    if (!ctx) throw new Error("useCrm must be used inside CrmProvider");
    return ctx;
}
