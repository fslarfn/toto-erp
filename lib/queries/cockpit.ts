import { supabase } from '../supabase-client';
import { 
  CockpitBalance, 
  CockpitAging, 
  CashForecastPoint, 
  TopDebtor, 
  StuckOrder, 
  ProfitStats 
} from "@/types/cockpit";

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

export const getCockpitAging = async (): Promise<CockpitAging[]> => {
  const { data, error } = await supabase.from('v_cockpit_aging').select('*');
  if (error) throw error;
  return data || [];
};

export const getCashForecast = async (): Promise<CashForecastPoint[]> => {
  const { data, error } = await supabase.rpc('fn_cockpit_cashflow_14d');
  if (error) throw error;
  
  // Map forecast_date from DB to date property for the component
  return (data || []).map((dbRow: any) => ({
    date: dbRow.forecast_date,
    inflow: dbRow.inflow,
    outflow: dbRow.outflow,
    saldo_proyeksi: dbRow.saldo_proyeksi
  }));
};

export const getTopDebtors = async (): Promise<TopDebtor[]> => {
  const { data, error } = await supabase.from('v_cockpit_top_debtors').select('*');
  if (error) throw error;
  return data || [];
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

  // 1. Get Income/Expense from cash_flow
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

  // 2. Get Target from monthly_targets
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

export const setMonthlyTarget = async (year: number, month: number, target: number, userId: string) => {
  const { error } = await supabase
    .from('monthly_targets')
    .upsert({
      year,
      month,
      target_profit: target,
      updated_by: userId,
      updated_at: new Date().toISOString()
    });
  if (error) throw error;
};
