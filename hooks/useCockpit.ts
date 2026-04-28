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

const REFRESH_INTERVAL = 60000;
const DEDUPING_INTERVAL = 5000;

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
  return useSWR('cockpit-balance', getCockpitBalance, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};

export const useCockpitAging = () => {
  return useSWR('cockpit-aging', getCockpitAging, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};

export const useCashForecast = () => {
  return useSWR('cockpit-cash-forecast', getCashForecast, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};

export const useTopDebtors = () => {
  return useSWR('cockpit-top-debtors', getTopDebtors, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};

export const useStuckOrders = () => {
  return useSWR('cockpit-stuck-orders', getStuckOrders, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};

export const useProfitStats = () => {
  return useSWR('cockpit-profit-stats', getProfitStats, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL,
  });
};
