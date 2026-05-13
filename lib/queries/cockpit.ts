import { supabase } from '../supabase-client';
import {
  CockpitBalance,
  CockpitAging,
  CashForecastPoint,
  TopDebtor,
  StuckOrder,
  ProfitStats
} from "@/types/cockpit";

// Parse Indonesian number format: "1.500.000" → 1500000, "1,5" → 1.5
function parseIdNum(val: string): number {
  if (!val || val === '—' || val.trim() === '') return 0;
  const s = val.trim();
  if (s.includes(',')) return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  if (/^\d{1,3}(\.\d{3})+$/.test(s)) return parseFloat(s.replace(/\./g, '')) || 0;
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

export const getCockpitBalance = async (): Promise<CockpitBalance> => {
  const { data, error: deltaErr } = await supabase.rpc('fn_cockpit_balance_delta_7d').single();
  const deltaData = data as { total_now: number; total_7d_ago: number; delta: number };
  if (deltaErr) throw deltaErr;

  const { data: accData, error: accErr } = await supabase.from('bank_accounts').select('*');
  if (accErr) throw accErr;

  return {
    total_now: deltaData.total_now,
    total_7d_ago: deltaData.total_7d_ago,
    delta: deltaData.delta,
    accounts: accData.map(a => ({
      id: a.id,
      name: a.name,
      bank: a.bank,
      balance: a.balance
    }))
  };
};

// Query pesanan_rows directly to avoid relying on v_cockpit_aging view permissions
export const getCockpitAging = async (): Promise<CockpitAging[]> => {
  const { data, error } = await supabase
    .from('pesanan_rows')
    .select('id, no_inv, tanggal, harga, ukuran, qty, is_paid')
    .eq('is_paid', false);

  if (error) throw error;

  const today = new Date();
  const buckets: Record<CockpitAging['bucket'], number> = {
    '0-30': 0, '31-60': 0, '61-90': 0, '>90': 0,
  };

  // Deduplicate by invoice so multi-row invoices count once
  const invMap = new Map<string, { tanggal: string; total: number }>();
  (data || []).forEach(r => {
    if (!r.tanggal) return;
    const total = parseIdNum(r.harga) * parseIdNum(r.ukuran) * parseIdNum(r.qty);
    if (total <= 0) return;
    const key = (r.no_inv || String(r.id)).trim();
    const ex = invMap.get(key);
    if (ex) { ex.total += total; }
    else { invMap.set(key, { tanggal: r.tanggal, total }); }
  });

  invMap.forEach(({ tanggal, total }) => {
    const d = new Date(tanggal);
    if (isNaN(d.getTime())) return;
    const days = Math.floor((today.getTime() - d.getTime()) / 86400000);
    if (days <= 30) buckets['0-30'] += total;
    else if (days <= 60) buckets['31-60'] += total;
    else if (days <= 90) buckets['61-90'] += total;
    else buckets['>90'] += total;
  });

  return (Object.entries(buckets) as [CockpitAging['bucket'], number][])
    .map(([bucket, outstanding]) => ({ bucket, outstanding }));
};

export const getCashForecast = async (): Promise<CashForecastPoint[]> => {
  const { data, error } = await supabase.rpc('fn_cockpit_cashflow_14d');
  if (error) throw error;

  return (data || []).map((dbRow: Record<string, unknown>) => ({
    date: dbRow.forecast_date as string,
    inflow: dbRow.inflow as number,
    outflow: dbRow.outflow as number,
    saldo_proyeksi: dbRow.saldo_proyeksi as number,
  }));
};

// Query pesanan_rows directly to avoid relying on v_cockpit_top_debtors view permissions
export const getTopDebtors = async (): Promise<TopDebtor[]> => {
  const { data, error } = await supabase
    .from('pesanan_rows')
    .select('id, no_inv, customer, tanggal, harga, ukuran, qty, is_paid')
    .eq('is_paid', false);

  if (error) throw error;

  const today = new Date();

  // Deduplicate by invoice
  const invMap = new Map<string, { customer: string; tanggal: string; total: number }>();
  (data || []).forEach(r => {
    if (!r.customer) return;
    const total = parseIdNum(r.harga) * parseIdNum(r.ukuran) * parseIdNum(r.qty);
    if (total <= 0) return;
    const key = (r.no_inv || String(r.id)).trim();
    const ex = invMap.get(key);
    if (ex) { ex.total += total; }
    else { invMap.set(key, { customer: r.customer.trim(), tanggal: r.tanggal || '', total }); }
  });

  // Group by customer name
  const custMap = new Map<string, { total: number; oldestDays: number }>();
  invMap.forEach(({ customer, tanggal, total }) => {
    const d = tanggal ? new Date(tanggal) : null;
    const days = d && !isNaN(d.getTime())
      ? Math.floor((today.getTime() - d.getTime()) / 86400000)
      : 0;
    const ex = custMap.get(customer);
    if (ex) { ex.total += total; ex.oldestDays = Math.max(ex.oldestDays, days); }
    else { custMap.set(customer, { total, oldestDays: days }); }
  });

  return Array.from(custMap.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 5)
    .map(([name, v]) => ({
      customer_name: name,
      total_outstanding: v.total,
      oldest_days: v.oldestDays,
    }));
};

export const getStuckOrders = async (): Promise<StuckOrder[]> => {
  const { data, error } = await supabase.from('v_cockpit_stuck_orders').select('*');
  if (error) throw error;
  return data || [];
};

export const getProfitStats = async (): Promise<ProfitStats> => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startOfMonth = new Date(year, month - 1, 1).toISOString();

  const { data: cfData, error: cfErr } = await supabase
    .from('cash_flow')
    .select('type, amount')
    .gte('date', startOfMonth);

  if (cfErr) throw cfErr;

  const income = cfData
    .filter(c => c.type === 'income')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const expense = cfData
    .filter(c => c.type === 'expense')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const { data: targetData, error: targetErr } = await supabase
    .from('monthly_targets')
    .select('target_profit')
    .eq('year', year)
    .eq('month', month)
    .maybeSingle();

  if (targetErr) throw targetErr;

  const target = targetData?.target_profit || 500000000;

  return {
    income,
    expense,
    profit: income - expense,
    target
  };
};

export const setMonthlyTarget = async (year: number, month: number, target: number) => {
  const res = await fetch("/api/cockpit/target", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year, month, target }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Failed to set target");
  }
};
