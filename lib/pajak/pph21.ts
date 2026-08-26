export type PtkpStatus = "TK/0" | "TK/1" | "TK/2" | "TK/3" | "K/0" | "K/1" | "K/2" | "K/3";
export type TerCategory = "A" | "B" | "C";

export const PTKP_ANNUAL: Record<PtkpStatus, number> = {
  "TK/0": 54_000_000, "TK/1": 58_500_000, "TK/2": 63_000_000, "TK/3": 67_500_000,
  "K/0": 58_500_000, "K/1": 63_000_000, "K/2": 67_500_000, "K/3": 72_000_000,
};

const TER_CATEGORY: Record<PtkpStatus, TerCategory> = {
  "TK/0": "A", "TK/1": "A", "TK/2": "B", "TK/3": "B",
  "K/0": "B", "K/1": "B", "K/2": "C", "K/3": "C",
};

const TER: Record<TerCategory, Array<[number, number]>> = {
  A: [[5400000,0],[5650000,.0025],[5950000,.005],[6300000,.0075],[6750000,.01],[7500000,.0125],[8550000,.015],[9650000,.0175],[10050000,.02],[10350000,.0225],[10700000,.025],[11050000,.03],[11600000,.035],[12500000,.04],[13750000,.045],[15100000,.05],[16950000,.06],[19750000,.07],[24150000,.08],[26450000,.09],[28000000,.1],[30050000,.11],[32400000,.12],[35400000,.13],[39100000,.14],[43850000,.15],[47800000,.16],[53800000,.17],[62000000,.18],[66700000,.19],[74500000,.2],[83200000,.21],[95000000,.22],[110000000,.23],[134000000,.24],[169000000,.25],[221000000,.26],[390000000,.27],[615000000,.28],[1419000000,.29],[Number.MAX_SAFE_INTEGER,.3]],
  B: [[6200000,0],[6500000,.0025],[6850000,.005],[7300000,.0075],[9200000,.01],[10750000,.015],[11250000,.02],[11600000,.025],[12600000,.03],[13600000,.04],[14950000,.045],[16400000,.05],[19200000,.06],[22750000,.07],[25500000,.08],[28500000,.09],[33000000,.1],[41100000,.12],[55800000,.15],[95000000,.2],[221000000,.25],[615000000,.28],[Number.MAX_SAFE_INTEGER,.3]],
  C: [[6600000,0],[6950000,.0025],[7350000,.005],[7800000,.0075],[8850000,.01],[9800000,.0125],[10950000,.015],[11200000,.0175],[12050000,.02],[12950000,.03],[14150000,.04],[15550000,.045],[17050000,.05],[19500000,.06],[24000000,.07],[26500000,.08],[29000000,.09],[35400000,.1],[46000000,.12],[60000000,.15],[95000000,.2],[221000000,.25],[615000000,.28],[Number.MAX_SAFE_INTEGER,.3]],
};

export function terCategory(status: PtkpStatus): TerCategory { return TER_CATEGORY[status]; }

export function terRate(grossMonthly: number, status: PtkpStatus): number {
  return TER[terCategory(status)].find(([upper]) => grossMonthly <= upper)?.[1] ?? .3;
}

export function monthlyTerTax(grossMonthly: number, status: PtkpStatus): number {
  return Math.round(Math.max(0, grossMonthly) * terRate(grossMonthly, status));
}

export function progressiveAnnualTax(pkp: number): number {
  let remaining = Math.max(0, Math.floor(pkp / 1000) * 1000);
  const layers: Array<[number, number]> = [[60_000_000,.05],[190_000_000,.15],[250_000_000,.25],[4_500_000_000,.30],[Number.MAX_SAFE_INTEGER,.35]];
  let tax = 0;
  for (const [width, rate] of layers) {
    const taxable = Math.min(remaining, width);
    tax += taxable * rate;
    remaining -= taxable;
    if (remaining <= 0) break;
  }
  return Math.round(tax);
}

export function decemberTrueUp(input: { annualGross: number; employeeBpjs: number; priorWithholding: number; ptkp: PtkpStatus }) {
  const jobExpense = Math.min(input.annualGross * .05, 6_000_000);
  const net = Math.max(0, input.annualGross - jobExpense - Math.max(0, input.employeeBpjs));
  const pkp = Math.max(0, Math.floor((net - PTKP_ANNUAL[input.ptkp]) / 1000) * 1000);
  const annualTax = progressiveAnnualTax(pkp);
  return { jobExpense, net, pkp, annualTax, decemberTax: Math.round(annualTax - input.priorWithholding) };
}
