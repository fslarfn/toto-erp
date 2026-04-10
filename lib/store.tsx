"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { Order, Material, CashFlow, Payment, BankAccount } from "@/types";
import { supabase } from "@/lib/supabase-client";
import { generateNumbers } from "@/lib/utils";

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
    addCashFlow: (c: Omit<CashFlow, "id">) => void;
    deleteCashFlow: (id: string) => void;
    addPayment: (p: Omit<Payment, "id">) => void;
    updateBankBalance: (id: string, delta: number) => void;
    recalculateBalances: () => void;
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
        createdBy: (r.created_by as string) || "",
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
    if (c.createdBy !== undefined) d.created_by = c.createdBy;
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
    };
}

export function StoreProvider({ children }: { children: ReactNode }) {
    const [orders, setOrders] = useState<Order[]>([]);
    const [materials, setMaterials] = useState<Material[]>([]);
    const [cashFlow, setCashFlow] = useState<CashFlow[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(true);

    // Load all data on mount
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [ordersRes, matsRes, cfRes, paysRes, baRes] = await Promise.all([
                    supabase.from("orders").select("*").order("created_at", { ascending: false }),
                    supabase.from("materials").select("*").order("code"),
                    supabase.from("cash_flow").select("*").order("date", { ascending: false }),
                    supabase.from("payments").select("*").order("payment_date", { ascending: false }),
                    supabase.from("bank_accounts").select("*"),
                ]);
                if (!cancelled) {
                    if (ordersRes.data) setOrders(ordersRes.data.map(dbToOrder));
                    if (matsRes.data) setMaterials(matsRes.data.map(dbToMaterial));
                    if (cfRes.data) setCashFlow(cfRes.data.map(dbToCashFlow));
                    if (paysRes.data) setPayments(paysRes.data.map(dbToPayment));
                    if (baRes.data) setBankAccounts(baRes.data.map(dbToBankAccount));
                }
            } catch {
                // Supabase unavailable — keep empty
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
                else if (eventType === "UPDATE") setOrders(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...dbToOrder(n as Record<string, any>) } : x));
                else if (eventType === "DELETE") setOrders(prev => prev.filter(x => x.id === (o as any).id));
            })
            // 2. Materials
            .on("postgres_changes", { event: "*", schema: "public", table: "materials" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setMaterials(prev => [...prev, dbToMaterial(n as Record<string, any>)]);
                else if (eventType === "UPDATE") setMaterials(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...dbToMaterial(n as Record<string, any>) } : x));
                else if (eventType === "DELETE") setMaterials(prev => prev.filter(x => x.id === (o as any).id));
            })
            // 3. Cash Flow
            .on("postgres_changes", { event: "*", schema: "public", table: "cash_flow" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setCashFlow(prev => [dbToCashFlow(n as Record<string, any>), ...prev]);
                else if (eventType === "UPDATE") setCashFlow(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...dbToCashFlow(n as Record<string, any>) } : x));
                else if (eventType === "DELETE") setCashFlow(prev => prev.filter(x => x.id === (o as any).id));
            })
            // 4. Payments
            .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setPayments(prev => [dbToPayment(n as Record<string, any>), ...prev]);
                else if (eventType === "UPDATE") setPayments(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...dbToPayment(n as Record<string, any>) } : x));
                else if (eventType === "DELETE") setPayments(prev => prev.filter(x => x.id === (o as any).id));
            })
            // 5. Bank Accounts
            .on("postgres_changes", { event: "*", schema: "public", table: "bank_accounts" }, (payload) => {
                const { eventType, new: n, old: o } = payload;
                if (eventType === "INSERT") setBankAccounts(prev => [...prev, dbToBankAccount(n as Record<string, any>)]);
                else if (eventType === "UPDATE") setBankAccounts(prev => prev.map(x => x.id === (n as any).id ? { ...x, ...dbToBankAccount(n as Record<string, any>) } : x));
                else if (eventType === "DELETE") setBankAccounts(prev => prev.filter(x => x.id === (o as any).id));
            })
            .subscribe();

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
        setOrders((prev) => [newOrder, ...prev]);
        // Persist to Supabase
        supabase.from("orders").insert(orderToDb(newOrder)).then();
        return newOrder;
    }, [orders.length]);

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
        setMaterials((prev) => [...prev, newMat]);
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

    const addCashFlow = useCallback((entry: Omit<CashFlow, "id">) => {
        const id = String(Date.now());
        const newCf = { ...entry, id };
        setCashFlow((prev) => [newCf, ...prev]);
        supabase.from("cash_flow").insert(cashFlowToDb(newCf)).then();

        // Update Bank Balance
        const bank = bankAccounts.find(b => b.name === entry.bankAccount);
        if (bank) {
            const delta = entry.type === "income" ? entry.amount : -entry.amount;
            updateBankBalance(bank.id, delta);
        }
    }, [bankAccounts, updateBankBalance]);

    const deleteCashFlow = useCallback((id: string) => {
        const target = cashFlow.find(c => c.id === id);
        if (!target) return;

        setCashFlow((prev) => prev.filter((c) => c.id !== id));
        supabase.from("cash_flow").delete().eq("id", id).then();

        // Reverse Bank Balance
        const bank = bankAccounts.find(b => b.name === target.bankAccount);
        if (bank) {
            const delta = target.type === "income" ? -target.amount : target.amount;
            updateBankBalance(bank.id, delta);
        }
    }, [cashFlow, bankAccounts, updateBankBalance]);

    const addPayment = useCallback((payment: Omit<Payment, "id">) => {
        const newPayment = { ...payment, id: String(Date.now()) };
        setPayments((prev) => [newPayment, ...prev]);
        setOrders((prev) =>
            prev.map((o) => {
                if (o.id === payment.orderId) {
                    const newPaid = o.paidAmount + payment.amountPaid;
                    const newStatus = newPaid >= o.totalPrice ? "lunas" : newPaid > 0 ? "bayar_sebagian" : "belum_bayar";
                    supabase.from("orders").update({ paid_amount: newPaid, payment_status: newStatus }).eq("id", o.id).then();
                    return { ...o, paidAmount: newPaid, paymentStatus: newStatus as Order["paymentStatus"] };
                }
                return o;
            })
        );
        supabase.from("payments").insert(paymentToDb(newPayment)).then();

        // Update Bank Balance
        const bank = bankAccounts.find(b => b.name === payment.bankAccount);
        if (bank) {
            updateBankBalance(bank.id, payment.amountPaid);
        }
    }, [bankAccounts, updateBankBalance]);

    const recalculateBalances = useCallback(() => {
        bankAccounts.forEach(bank => {
            const cfIncome = cashFlow.filter(c => c.bankAccount === bank.name && c.type === "income").reduce((s, c) => s + c.amount, 0);
            const cfExpense = cashFlow.filter(c => c.bankAccount === bank.name && c.type === "expense").reduce((s, c) => s + c.amount, 0);
            const paymentsTotal = payments.filter(p => p.bankAccount === bank.name).reduce((s, p) => s + p.amountPaid, 0);
            
            const newBalance = cfIncome - cfExpense + paymentsTotal;
            if (bank.balance !== newBalance) {
                setBankAccounts(prev => prev.map(b => b.id === bank.id ? { ...b, balance: newBalance } : b));
                supabase.from("bank_accounts").update({ balance: newBalance }).eq("id", bank.id).then();
            }
        });
    }, [bankAccounts, cashFlow, payments]);

    return (
        <StoreContext.Provider value={{
            orders, materials, cashFlow, payments, bankAccounts, loading,
            addOrder, updateOrder, deleteOrder,
            addMaterial, updateMaterial, deleteMaterial,
            addCashFlow, deleteCashFlow, addPayment, updateBankBalance,
            recalculateBalances,
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
