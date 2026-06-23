"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Order, Material, CashFlow, Payment, BankAccount, AccountReconciliation } from "@/types";
import { supabase } from "@/lib/supabase-client";
import { generateNumbers } from "@/lib/utils";
import { computeBalance, resolveAccountId, reconcileAccounts, buildTransferPair } from "@/lib/balance";

// Input transaksi: kolom turunan (accountId/flags/transferGroup) opsional —
// store akan mengisinya (resolusi account_id dari nama kas, default flag false).
export type CashFlowInput =
    Omit<CashFlow, "id" | "accountId" | "isTest" | "isAdjustment" | "transferGroup"> &
    Partial<Pick<CashFlow, "accountId" | "isTest" | "isAdjustment" | "transferGroup">>;

interface AppStore {
    orders: Order[];
    materials: Material[];
    cashFlow: CashFlow[];
    payments: Payment[];
    bankAccounts: BankAccount[];
    loading: boolean;

    addOrder: (o: Omit<Order, "id" | "poNumber" | "invoiceNumber" | "sjNumber" | "createdAt" | "productionStatus" | "deliveryStatus" | "paymentStatus" | "paidAmount" | "rowColor">) => Order;
    updateOrder: (id: string, updates: Partial<Order>) => void;
    deleteOrder: (id: string) => void;
    addMaterial: (m: Omit<Material, "id">) => void;
    updateMaterial: (id: string, updates: Partial<Material>) => void;
    deleteMaterial: (id: string) => void;
    addCashFlow: (c: CashFlowInput) => void;
    updateCashFlow: (id: string, updates: Partial<CashFlow>) => void;
    deleteCashFlow: (id: string) => void;
    /** Mutasi antar-kas: catat sebagai pasangan expense(sumber)+income(tujuan). */
    addTransfer: (p: { fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string; createdBy?: string }) => void;
    addPayment: (p: Omit<Payment, "id">) => void;
    updateBankBalance: (id: string, delta: number) => void;
    /** Saldo terhitung (sumber kebenaran) untuk satu akun. */
    getComputedBalance: (accountId: string, opts?: { includeTest?: boolean }) => number;
    /** Rekonsiliasi seluruh akun: stored vs computed vs diff. */
    reconcile: (opts?: { includeTest?: boolean }) => AccountReconciliation[];
    recalculateBalances: () => void;
    /** Sinkronkan SELURUH akun via RPC (idempotent). Mengembalikan ringkasan. */
    syncAllBalances: () => Promise<AccountReconciliation[]>;
}

const StoreContext = createContext<AppStore | null>(null);

/* Helper: convert DB row → Order type */
function dbToOrder(r: Record<string, unknown>): Order {
    return {
        id: r.id as string,
        poNumber: (r.po_number as string) || "",
        invoiceNumber: (r.invoice_number as string) || "",
        sjNumber: (r.sj_number as string) || "",
        customerName: (r.customer_name as string) || "",
        orderDate: (r.order_date as string) || "",
        dueDate: (r.due_date as string) || "",
        description: (r.description as string) || "",
        qty: (r.qty as number) || 0,
        size: (r.size as string) || "",
        vendor: (r.vendor as string) || "",
        unitPrice: Number(r.unit_price) || 0,
        totalPrice: Number(r.total_price) || 0,
        notes: (r.notes as string) || "",
        productionStatus: (r.production_status as Order["productionStatus"]) || "belum_produksi",
        deliveryStatus: (r.delivery_status as Order["deliveryStatus"]) || "belum_kirim",
        paymentStatus: (r.payment_status as Order["paymentStatus"]) || "belum_bayar",
        paidAmount: Number(r.paid_amount) || 0,
        rowColor: (r.row_color as string) || "",
        createdBy: (r.created_by as string) || "",
        createdAt: (r.created_at as string) || "",
    };
}

function orderToDb(o: Partial<Order>): Record<string, unknown> {
    const m: Record<string, unknown> = {};
    if (o.id !== undefined) m.id = o.id;
    if (o.poNumber !== undefined) m.po_number = o.poNumber;
    if (o.invoiceNumber !== undefined) m.invoice_number = o.invoiceNumber;
    if (o.sjNumber !== undefined) m.sj_number = o.sjNumber;
    if (o.customerName !== undefined) m.customer_name = o.customerName;
    if (o.orderDate !== undefined) m.order_date = o.orderDate;
    if (o.dueDate !== undefined) m.due_date = o.dueDate;
    if (o.description !== undefined) m.description = o.description;
    if (o.qty !== undefined) m.qty = o.qty;
    if (o.size !== undefined) m.size = o.size;
    if (o.vendor !== undefined) m.vendor = o.vendor;
    if (o.unitPrice !== undefined) m.unit_price = o.unitPrice;
    if (o.totalPrice !== undefined) m.total_price = o.totalPrice;
    if (o.notes !== undefined) m.notes = o.notes;
    if (o.productionStatus !== undefined) m.production_status = o.productionStatus;
    if (o.deliveryStatus !== undefined) m.delivery_status = o.deliveryStatus;
    if (o.paymentStatus !== undefined) m.payment_status = o.paymentStatus;
    if (o.paidAmount !== undefined) m.paid_amount = o.paidAmount;
    if (o.rowColor !== undefined) m.row_color = o.rowColor;
    if (o.createdBy !== undefined) m.created_by = o.createdBy;
    if (o.createdAt !== undefined) m.created_at = o.createdAt;
    return m;
}

function dbToMaterial(r: Record<string, unknown>): Material {
    return {
        id: r.id as string,
        code: (r.code as string) || "",
        name: (r.name as string) || "",
        category: (r.category as string) || "",
        unit: (r.unit as string) || "",
        currentStock: Number(r.current_stock) || 0,
        minimumStock: Number(r.minimum_stock) || 0,
        location: (r.location as string) || "",
        lastUpdated: (r.last_updated as string) || "",
    };
}

function materialToDb(m: Partial<Material>): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (m.id !== undefined) d.id = m.id;
    if (m.code !== undefined) d.code = m.code;
    if (m.name !== undefined) d.name = m.name;
    if (m.category !== undefined) d.category = m.category;
    if (m.unit !== undefined) d.unit = m.unit;
    if (m.currentStock !== undefined) d.current_stock = m.currentStock;
    if (m.minimumStock !== undefined) d.minimum_stock = m.minimumStock;
    if (m.location !== undefined) d.location = m.location;
    if (m.lastUpdated !== undefined) d.last_updated = m.lastUpdated;
    return d;
}

function dbToCashFlow(r: Record<string, unknown>): CashFlow {
    return {
        id: r.id as string,
        type: (r.type as CashFlow["type"]) || "expense",
        category: (r.category as string) || "",
        amount: Number(r.amount) || 0,
        description: (r.description as string) || "",
        date: (r.date as string) || "",
        bankAccount: (r.bank_account as string) || "",
        accountId: (r.account_id as string) ?? null,
        createdBy: (r.created_by as string) || "",
        isTest: Boolean(r.is_test),
        isAdjustment: Boolean(r.is_adjustment),
        transferGroup: (r.transfer_group as string) ?? null,
    };
}

function cashFlowToDb(c: Partial<CashFlow>): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (c.id !== undefined) d.id = c.id;
    if (c.type !== undefined) d.type = c.type;
    if (c.category !== undefined) d.category = c.category;
    if (c.amount !== undefined) d.amount = c.amount;
    if (c.description !== undefined) d.description = c.description;
    if (c.date !== undefined) d.date = c.date;
    if (c.bankAccount !== undefined) d.bank_account = c.bankAccount;
    if (c.accountId !== undefined) d.account_id = c.accountId;
    if (c.createdBy !== undefined) d.created_by = c.createdBy;
    if (c.isTest !== undefined) d.is_test = c.isTest;
    if (c.isAdjustment !== undefined) d.is_adjustment = c.isAdjustment;
    if (c.transferGroup !== undefined) d.transfer_group = c.transferGroup;
    return d;
}

function dbToPayment(r: Record<string, unknown>): Payment {
    return {
        id: r.id as string,
        invoiceId: (r.invoice_id as string) || "",
        orderId: (r.order_id as string) || "",
        amountPaid: Number(r.amount_paid) || 0,
        paymentDate: (r.payment_date as string) || "",
        paymentMethod: (r.payment_method as string) || "",
        bankAccount: (r.bank_account as string) || "",
        notes: (r.notes as string) || "",
        recordedBy: (r.recorded_by as string) || "",
    };
}

function paymentToDb(p: Partial<Payment>): Record<string, unknown> {
    const d: Record<string, unknown> = {};
    if (p.id !== undefined) d.id = p.id;
    if (p.invoiceId !== undefined) d.invoice_id = p.invoiceId;
    if (p.orderId !== undefined) d.order_id = p.orderId;
    if (p.amountPaid !== undefined) d.amount_paid = p.amountPaid;
    if (p.paymentDate !== undefined) d.payment_date = p.paymentDate;
    if (p.paymentMethod !== undefined) d.payment_method = p.paymentMethod;
    if (p.bankAccount !== undefined) d.bank_account = p.bankAccount;
    if (p.notes !== undefined) d.notes = p.notes;
    if (p.recordedBy !== undefined) d.recorded_by = p.recordedBy;
    return d;
}

function dbToBankAccount(r: Record<string, unknown>): BankAccount {
    return {
        id: r.id as string,
        name: (r.name as string) || "",
        bank: (r.bank as string) || "",
        accountNumber: (r.account_number as string) || "",
        balance: Number(r.balance) || 0,
        initialBalance: Number(r.initial_balance) || 0,
    };
}

/** Ambil SEMUA baris dgn paginasi .range (hindari cap 1000 baris Supabase). */
async function fetchAllPaged(
    page: (from: number, to: number) => PromiseLike<{ data: Record<string, unknown>[] | null; error: unknown }>
): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let from = 0;
    while (true) {
        const { data, error } = await page(from, from + 999);
        if (error) throw error;
        if (data && data.length) { all.push(...data); if (data.length < 1000) break; from += 1000; }
        else break;
    }
    return all;
}

export function StoreProvider({ children }: { children: ReactNode }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [cashFlow, setCashFlow] = useState<CashFlow[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);

    // Load all data on mount (paginasi → hindari cap 1000 baris / "data hilang")
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [orders, mats, cf, pays, ba] = await Promise.all([
                    fetchAllPaged((f, t) => supabase.from("orders").select("*").order("created_at", { ascending: false }).range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("materials").select("*").order("code").range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("cash_flow").select("*").order("date", { ascending: false }).range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("payments").select("*").order("payment_date", { ascending: false }).range(f, t)),
                    fetchAllPaged((f, t) => supabase.from("bank_accounts").select("*").range(f, t)),
                ]);
                if (!cancelled) {
                    setOrders(orders.map(dbToOrder));
                    setMaterials(mats.map(dbToMaterial));
                    setCashFlow(cf.map(dbToCashFlow));
                    setPayments(pays.map(dbToPayment));
                    setBankAccounts(ba.map(dbToBankAccount));
                }
            } catch (e) {
                console.error("Store fetch error:", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, []);

    // Realtime Subscriptions
    useEffect(() => {
        const channel = supabase
            .channel("realtime_general_store")
            // 1. Orders
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setOrders(prev => [dbToOrder(n as Record<string, any>), ...prev]);
                else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<Order> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("po_number" in row) mapped.poNumber = row.po_number;
                    if ("invoice_number" in row) mapped.invoiceNumber = row.invoice_number;
                    if ("sj_number" in row) mapped.sjNumber = row.sj_number;
                    if ("customer_name" in row) mapped.customerName = row.customer_name;
                    if ("order_date" in row) mapped.orderDate = row.order_date;
                    if ("due_date" in row) mapped.dueDate = row.due_date;
                    if ("description" in row) mapped.description = row.description;
                    if ("qty" in row) mapped.qty = row.qty;
                    if ("size" in row) mapped.size = row.size;
                    if ("vendor" in row) mapped.vendor = row.vendor;
                    if ("unit_price" in row) mapped.unitPrice = Number(row.unit_price);
                    if ("total_price" in row) mapped.totalPrice = Number(row.total_price);
                    if ("notes" in row) mapped.notes = row.notes;
                    if ("production_status" in row) mapped.productionStatus = row.production_status;
                    if ("delivery_status" in row) mapped.deliveryStatus = row.delivery_status;
                    if ("payment_status" in row) mapped.paymentStatus = row.payment_status;
                    if ("paid_amount" in row) mapped.paidAmount = Number(row.paid_amount);
                    if ("row_color" in row) mapped.rowColor = row.row_color;
                    setOrders(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                }
                else if (eventType === "DELETE") setOrders(prev => prev.filter(x => x.id !== (o as any).id));
            })
            // 2. Materials
            .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setMaterials(prev => [...prev, dbToMaterial(n as Record<string, any>)]);
                else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<Material> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("code" in row) mapped.code = row.code;
                    if ("name" in row) mapped.name = row.name;
                    if ("category" in row) mapped.category = row.category;
                    if ("unit" in row) mapped.unit = row.unit;
                    if ("current_stock" in row) mapped.currentStock = Number(row.current_stock);
                    if ("minimum_stock" in row) mapped.minimumStock = Number(row.minimum_stock);
                    if ("location" in row) mapped.location = row.location;
                    setMaterials(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                }
                else if (eventType === "DELETE") setMaterials(prev => prev.filter(x => x.id !== (o as any).id));
            })
            // 3. Cash Flow
            .on("postgres_changes", { event: "*", schema: "public", table: "cash_flow" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") {
                    // Idempoten: lewati bila id sudah ada (mis. sudah ditambah optimistic
                    // di addCashFlow/addTransfer) agar tidak dobel saat realtime echo balik.
                    setCashFlow(prev => prev.some(x => x.id === (n as any).id) ? prev : [dbToCashFlow(n as Record<string, any>), ...prev]);
                }
                else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<CashFlow> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("type" in row) mapped.type = row.type;
                    if ("category" in row) mapped.category = row.category;
                    if ("amount" in row) mapped.amount = Number(row.amount);
                    if ("description" in row) mapped.description = row.description;
                    if ("date" in row) mapped.date = row.date;
                    if ("bank_account" in row) mapped.bankAccount = row.bank_account;
                    if ("account_id" in row) mapped.accountId = row.account_id ?? null;
                    if ("is_test" in row) mapped.isTest = Boolean(row.is_test);
                    if ("is_adjustment" in row) mapped.isAdjustment = Boolean(row.is_adjustment);
                    if ("transfer_group" in row) mapped.transferGroup = row.transfer_group ?? null;
                    setCashFlow(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                }
                else if (eventType === "DELETE") setCashFlow(prev => prev.filter(x => x.id !== (o as any).id));
                // recalculate handled by useEffect when cashFlow state settles
            })
            // 4. Payments
            .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setPayments(prev => [dbToPayment(n as Record<string, any>), ...prev]);
                else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<Payment> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("invoice_id" in row) mapped.invoiceId = row.invoice_id;
                    if ("order_id" in row) mapped.orderId = row.order_id;
                    if ("amount_paid" in row) mapped.amountPaid = Number(row.amount_paid);
                    if ("payment_date" in row) mapped.paymentDate = row.payment_date;
                    if ("payment_method" in row) mapped.paymentMethod = row.payment_method;
                    if ("bank_account" in row) mapped.bankAccount = row.bank_account;
                    if ("notes" in row) mapped.notes = row.notes;
                    setPayments(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                }
                else if (eventType === "DELETE") setPayments(prev => prev.filter(x => x.id !== (o as any).id));
                // recalculate handled by useEffect when payments state settles
            })
            // 5. Bank Accounts
            .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setBankAccounts(prev => [...prev, dbToBankAccount(n as Record<string, any>)]);
                else if (eventType === "UPDATE") {
                    const row = n as Record<string, any>;
                    const mapped: Partial<BankAccount> = {};
                    if ("id" in row) mapped.id = row.id;
                    if ("name" in row) mapped.name = row.name;
                    if ("bank" in row) mapped.bank = row.bank;
                    if ("account_number" in row) mapped.accountNumber = row.account_number;
                    if ("balance" in row) mapped.balance = Number(row.balance);
                    if ("initial_balance" in row) mapped.initialBalance = Number(row.initial_balance);
                    setBankAccounts(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...mapped } : x));
                }
                else if (eventType === "DELETE") setBankAccounts(prev => prev.filter(x => x.id !== (o as any).id));
            })
            .subscribe((status) => {
                console.log("General Store Realtime Status:", status);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);
    

    const addOrder = useCallback((orderData: Parameters<AppStore["addOrder"]>[0]) => {
        const nums = generateNumbers(orders.length);
        const newOrder: Order = {
            ...orderData,
            id: String(Date.now()),
            ...nums,
            productionStatus: "belum_produksi",
            deliveryStatus: "belum_kirim",
            paymentStatus: "belum_bayar",
            paidAmount: 0,
            rowColor: "",
            createdAt: new Date().toISOString(),
        };
        // We rely on Real-time to update the UI
        supabase.from("orders").insert(orderToDb(newOrder)).then();
        return newOrder;
    }, []);

    const updateOrder = useCallback((id: string, updates: Partial<Order>) => {
        setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, ...updates } : o)));
        supabase.from("orders").update(orderToDb(updates)).eq("id", id).then();
    }, []);

    const deleteOrder = useCallback((id: string) => {
        setOrders((prev) => prev.filter((o) => o.id !== id));
        supabase.from("orders").delete().eq("id", id).then();
    }, []);

    const addMaterial = useCallback((m: Omit<Material, "id">) => {
        const newMat = { ...m, id: String(Date.now()) };
        supabase.from("materials").insert(materialToDb(newMat)).then();
    }, []);

    const updateMaterial = useCallback((id: string, updates: Partial<Material>) => {
        setMaterials((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)));
        supabase.from("materials").update(materialToDb(updates)).eq("id", id).then();
    }, []);

    const deleteMaterial = useCallback((id: string) => {
        setMaterials((prev) => prev.filter((m) => m.id !== id));
        supabase.from("materials").delete().eq("id", id).then();
    }, []);

    const updateBankBalance = useCallback((id: string, delta: number) => {
        setBankAccounts((prev) =>
            prev.map((b) => {
                if (b.id === id) {
                    const newBal = b.balance + delta;
                    supabase.from("bank_accounts").update({ balance: newBal }).eq("id", id).then();
                    return { ...b, balance: newBal };
                }
                return b;
            })
        );
    }, []);

    const addCashFlow = useCallback((entry: CashFlowInput) => {
        const id = String(Date.now());
        // Resolusi account_id dari nama kas (FK), bukan lagi pencocokan string saat hitung saldo.
        const accountId = entry.accountId ?? resolveAccountId(entry.bankAccount, bankAccounts);
        const newCf: CashFlow = {
            id,
            type: entry.type,
            category: entry.category,
            amount: entry.amount,
            description: entry.description,
            date: entry.date,
            bankAccount: entry.bankAccount,
            accountId,
            createdBy: entry.createdBy,
            isTest: entry.isTest ?? false,
            isAdjustment: entry.isAdjustment ?? false,
            transferGroup: entry.transferGroup ?? null,
        };
        // Optimistic: realtime juga akan menyusulkan. Saldo = TERHITUNG dari cash_flow
        // (lihat lib/balance.computeBalance) → tidak ada lagi mutasi balance manual.
        setCashFlow(prev => [newCf, ...prev]);
        supabase.from("cash_flow").insert(cashFlowToDb(newCf)).then();
    }, [bankAccounts]);

    const addTransfer = useCallback((p: { fromAccountId: string; toAccountId: string; amount: number; date: string; description?: string; createdBy?: string }) => {
        const nameOf = (accId: string) => bankAccounts.find(b => b.id === accId)?.name ?? "";
        const [out, inn] = buildTransferPair(p);
        const base = Date.now();
        const outRow: CashFlow = { ...out, id: String(base), bankAccount: nameOf(out.accountId!) };
        const innRow: CashFlow = { ...inn, id: String(base + 1), bankAccount: nameOf(inn.accountId!) };
        setCashFlow(prev => [innRow, outRow, ...prev]);
        supabase.from("cash_flow").insert([cashFlowToDb(outRow), cashFlowToDb(innRow)]).then();
    }, [bankAccounts]);

    const updateCashFlow = useCallback((id: string, updates: Partial<CashFlow>) => {
        const oldRecord = cashFlow.find(c => c.id === id);
        if (!oldRecord) return;

        const newRecord = { ...oldRecord, ...updates };

        // Optimistic local update
        setCashFlow(prev => prev.map(c => c.id === id ? newRecord : c));

        // Jika kas berubah, sinkronkan account_id (FK) mengikuti nama kas baru.
        if (updates.bankAccount !== undefined && updates.accountId === undefined) {
            const resolved = resolveAccountId(newRecord.bankAccount, bankAccounts);
            newRecord.accountId = resolved;
            setCashFlow(prev => prev.map(c => c.id === id ? newRecord : c));
            supabase.from("cash_flow").update(cashFlowToDb({ ...updates, accountId: resolved })).eq("id", id).then();
        } else {
            supabase.from("cash_flow").update(cashFlowToDb(updates)).eq("id", id).then();
        }
        // Saldo = TERHITUNG dari cash_flow → tidak ada mutasi balance manual lagi.
    }, [cashFlow, bankAccounts]);

    const deleteCashFlow = useCallback((id: string) => {
        const target = cashFlow.find(c => c.id === id);
        if (!target) return;

        setCashFlow((prev) => prev.filter((c) => c.id !== id));
        supabase.from("cash_flow").delete().eq("id", id).then();
        // Saldo = TERHITUNG dari cash_flow → recalc effect akan menyesuaikan cache.
    }, [cashFlow]);

    const addPayment = useCallback((payment: Omit<Payment, "id">) => {
        const newPayment = { ...payment, id: String(Date.now()) };
        
        // Update Order status in DB (Real-time will update the local state)
        supabase.from("orders").select("paid_amount, total_price").eq("id", payment.orderId).single().then(({ data }) => {
            if (data) {
                const newPaid = Number(data.paid_amount) + payment.amountPaid;
                const newStatus = newPaid >= Number(data.total_price) ? "lunas" : newPaid > 0 ? "bayar_sebagian" : "belum_bayar";
                supabase.from("orders").update({ paid_amount: newPaid, payment_status: newStatus }).eq("id", payment.orderId).then();
            }
        });

        supabase.from("payments").insert(paymentToDb(newPayment)).then();

        // Update Bank Balance
        const bank = bankAccounts.find(b => b.name === payment.bankAccount);
        if (bank) {
            updateBankBalance(bank.id, payment.amountPaid);
        }
    }, [bankAccounts, updateBankBalance]);

    const getComputedBalance = useCallback((accountId: string, opts?: { includeTest?: boolean }) => {
        return computeBalance(accountId, bankAccounts, cashFlow, opts);
    }, [bankAccounts, cashFlow]);

    const reconcile = useCallback((opts?: { includeTest?: boolean }) => {
        return reconcileAccounts(bankAccounts, cashFlow, opts);
    }, [bankAccounts, cashFlow]);

    // Recalc lokal: loop SELURUH akun via computeBalance (account_id, bukan nama),
    // tulis cache yang berubah saja → idempotent.
    const recalculateBalances = useCallback(() => {
        setBankAccounts(prev => {
            return prev.map(bank => {
                const newBalance = computeBalance(bank.id, prev, cashFlow);
                if (Math.abs(bank.balance - newBalance) > 0.01) {
                    supabase.from("bank_accounts").update({ balance: newBalance }).eq("id", bank.id).then();
                    return { ...bank, balance: newBalance };
                }
                return bank;
            });
        });
    }, [cashFlow]);

    // Tombol "Sinkronkan Saldo": SATU batch idempotent di server (RPC).
    const syncAllBalances = useCallback(async (): Promise<AccountReconciliation[]> => {
        const { data, error } = await supabase.rpc("sync_all_balances");
        if (error) {
            // Fallback: hitung & tulis dari client bila RPC belum ada di DB.
            recalculateBalances();
            return reconcileAccounts(bankAccounts, cashFlow);
        }
        type Row = { account_id: string; name: string; old_balance: number; new_balance: number; diff: number };
        const rows = (data ?? []) as Row[];
        // Selaraskan state lokal dengan hasil server.
        setBankAccounts(prev => prev.map(b => {
            const row = rows.find(r => r.account_id === b.id);
            return row ? { ...b, balance: Number(row.new_balance) } : b;
        }));
        return rows.map(r => ({
            id: r.account_id, name: r.name,
            storedBalance: Number(r.old_balance),
            computedBalance: Number(r.new_balance),
            diff: Number(r.new_balance) - Number(r.old_balance),
        }));
    }, [bankAccounts, cashFlow, recalculateBalances]);

    // Auto-sync balances whenever cash_flow data changes (length or amounts)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const cashFlowFingerprint = cashFlow.reduce((s, c) => s + c.amount * (c.type === "income" ? 1 : -1), 0);
    useEffect(() => {
        if (!loading && cashFlow.length > 0) {
            recalculateBalances();
        }
    // cashFlowFingerprint captures both length and amount changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, cashFlowFingerprint]);

    return (
        <StoreContext.Provider value={{
            orders, materials, cashFlow, payments, bankAccounts, loading,
            addOrder, updateOrder, deleteOrder,
            addMaterial, updateMaterial, deleteMaterial,
            addCashFlow, updateCashFlow, deleteCashFlow, addTransfer, addPayment, updateBankBalance,
            getComputedBalance, reconcile, recalculateBalances, syncAllBalances,
        }}>
            {children}
        </StoreContext.Provider>
    );
}

export function useStore() {
    const ctx = useContext(StoreContext);
    if (!ctx) throw new Error("useStore must be used inside StoreProvider");
    return ctx;
}
