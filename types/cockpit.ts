export interface CockpitBalance {
  total_now: number;
  total_7d_ago: number;
  delta: number;
  accounts: {
    id: string;
    name: string;
    bank: string;
    balance: number;
  }[];
}

export interface CockpitAging {
  bucket: '0-30' | '31-60' | '61-90' | '>90';
  outstanding: number;
}

export interface CashForecastPoint {
  date: string;
  inflow: number;
  outflow: number;
  saldo_proyeksi: number;
}

export interface TopDebtor {
  customer_name: string;
  total_outstanding: number;
  oldest_days: number;
}

export interface StuckOrder {
  id: string;
  no_invoice: string;
  customer_name: string;
  status: string;
  age_days: number;
}

export interface ProfitStats {
  income: number;
  expense: number;
  profit: number;
  target: number;
}
