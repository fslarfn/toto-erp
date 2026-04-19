import useSWR from 'swr';
import { 
  getCockpitBalance, 
  getCockpitAging, 
  getCashForecast, 
  getTopDebtors, 
  getStuckOrders, 
  getProfitStats 
} from '../lib/queries/cockpit';

const REFRESH_INTERVAL = 60000; // 1 minute
const DEDUPING_INTERVAL = 5000;

export const useCockpitBalance = () => {
  return useSWR('cockpit-balance', getCockpitBalance, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};

export const useCockpitAging = () => {
  return useSWR('cockpit-aging', getCockpitAging, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};

export const useCashForecast = () => {
  return useSWR('cockpit-cash-forecast', getCashForecast, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};

export const useTopDebtors = () => {
  return useSWR('cockpit-top-debtors', getTopDebtors, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};

export const useStuckOrders = () => {
  return useSWR('cockpit-stuck-orders', getStuckOrders, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};

export const useProfitStats = () => {
  return useSWR('cockpit-profit-stats', getProfitStats, {
    refreshInterval: REFRESH_INTERVAL,
    dedupingInterval: DEDUPING_INTERVAL
  });
};
