import { useEffect } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { supabase } from '../lib/supabase-client';
import {
  getCockpitBalance,
  getCockpitAging,
  getCashForecast,
  getTopDebtors,
  getStuckOrders,
  getProfitStats
} from '../lib/queries/cockpit';

const DEDUPING_INTERVAL = 5000;
const SWR_OPTIONS = {
  dedupingInterval: DEDUPING_INTERVAL,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
};

// Invalidate all cockpit keys when relevant tables change
export function useCockpitRealtime() {
  useEffect(() => {
    const channel = supabase
      .channel('realtime_cockpit')
      // pesanan_rows changes → aging, top debtors, stuck orders
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pesanan_rows' }, () => {
        globalMutate('cockpit-aging');
        globalMutate('cockpit-top-debtors');
        globalMutate('cockpit-stuck-orders');
      })
      // cash_flow changes → balance, cash forecast, profit stats
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_flow' }, () => {
        globalMutate('cockpit-balance');
        globalMutate('cockpit-cash-forecast');
        globalMutate('cockpit-profit-stats');
      })
      // bank_accounts changes → balance, cash forecast
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts' }, () => {
        globalMutate('cockpit-balance');
        globalMutate('cockpit-cash-forecast');
      })
      // monthly_targets changes → profit stats
      .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_targets' }, () => {
        globalMutate('cockpit-profit-stats');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);
}

export const useCockpitBalance = () => {
  return useSWR('cockpit-balance', getCockpitBalance, SWR_OPTIONS);
};

export const useCockpitAging = () => {
  return useSWR('cockpit-aging', getCockpitAging, SWR_OPTIONS);
};

export const useCashForecast = () => {
  return useSWR('cockpit-cash-forecast', getCashForecast, SWR_OPTIONS);
};

export const useTopDebtors = () => {
  return useSWR('cockpit-top-debtors', getTopDebtors, SWR_OPTIONS);
};

export const useStuckOrders = () => {
  return useSWR('cockpit-stuck-orders', getStuckOrders, SWR_OPTIONS);
};

export const useProfitStats = () => {
  return useSWR('cockpit-profit-stats', getProfitStats, SWR_OPTIONS);
};
