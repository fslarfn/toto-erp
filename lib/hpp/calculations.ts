export type HppMaterialInput = { quantity: number; unitPrice: number };

export type HppCostInput = {
  materials: HppMaterialInput[];
  coloringCost: number;
  laborCost: number;
  productionCost: number;
  transportCost: number;
  quantity: number;
  sellingPrice: number;
};

export type ProductHppInput = {
  purchasePrice: number;
  materialLength: number;
  coloringCost: number;
  laborCost: number;
  productionCost: number;
  transportCost: number;
  sellingPrice: number;
};

export type ShippedHppInput = {
  quantity: number;
  sizeMeter: number;
  sellingPricePerMeter: number;
  materialCostPerMeter: number;
  totalHppPerMeter: number;
};

const money = (value: number) => Math.max(0, Math.round(Number.isFinite(value) ? value : 0));

export function calculateHpp(input: HppCostInput) {
  const materialCost = input.materials.reduce(
    (total, material) => total + money(Math.max(0, material.quantity) * Math.max(0, material.unitPrice)),
    0,
  );
  const coloringCost = money(input.coloringCost);
  const laborCost = money(input.laborCost);
  const productionCost = money(input.productionCost);
  const transportCost = money(input.transportCost);
  const totalCost = materialCost + coloringCost + laborCost + productionCost + transportCost;
  const quantity = Math.max(1, Number.isFinite(input.quantity) ? input.quantity : 1);
  const sellingPrice = money(input.sellingPrice);
  const margin = sellingPrice - totalCost;

  return {
    materialCost,
    coloringCost,
    laborCost,
    productionCost,
    transportCost,
    totalCost,
    unitCost: Math.round(totalCost / quantity),
    sellingPrice,
    margin,
    marginPercent: sellingPrice > 0 ? (margin / sellingPrice) * 100 : 0,
  };
}

export function calculateProductHpp(input: ProductHppInput) {
  const purchasePrice = money(input.purchasePrice);
  const materialLength = input.materialLength > 0 && Number.isFinite(input.materialLength)
    ? input.materialLength
    : 1;
  const materialCostPerMeter = Math.round(purchasePrice / materialLength);
  const coloringCost = money(input.coloringCost);
  const laborCost = money(input.laborCost);
  const productionCost = money(input.productionCost);
  const transportCost = money(input.transportCost);
  const totalCostPerMeter = materialCostPerMeter + coloringCost + laborCost + productionCost + transportCost;
  const sellingPrice = money(input.sellingPrice);
  const marginPerMeter = sellingPrice - totalCostPerMeter;

  return {
    purchasePrice,
    materialLength,
    materialCostPerMeter,
    coloringCost,
    laborCost,
    productionCost,
    transportCost,
    totalCostPerMeter,
    sellingPrice,
    marginPerMeter,
    marginPercent: sellingPrice > 0 ? (marginPerMeter / sellingPrice) * 100 : 0,
  };
}

export function calculateShippedHpp(input: ShippedHppInput) {
  const quantity = Math.max(1, Number.isFinite(input.quantity) ? input.quantity : 1);
  const sizeMeter = Math.max(1, Number.isFinite(input.sizeMeter) ? input.sizeMeter : 1);
  const totalMeter = quantity * sizeMeter;
  const revenueTotal = money(input.sellingPricePerMeter * totalMeter);
  const materialCostTotal = money(input.materialCostPerMeter * totalMeter);
  const totalHpp = money(input.totalHppPerMeter * totalMeter);

  return { quantity, sizeMeter, totalMeter, revenueTotal, materialCostTotal, totalHpp, marginTotal: revenueTotal - totalHpp };
}

export function parseOrderNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const cleaned = value.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(cleaned)
      ? cleaned.replace(/\./g, "")
      : cleaned;
  const result = Number(normalized);
  return Number.isFinite(result) ? Math.max(0, result) : 0;
}

export function allocationPerOrder(total: number, orderCount: number) {
  return orderCount > 0 ? money(total / orderCount) : 0;
}

export function allocationPerMeter(total: number, totalMeters: number) {
  return totalMeters > 0 && Number.isFinite(totalMeters) ? money(total / totalMeters) : 0;
}

export function classifyHppExpense(category: string, description: string): "coloring" | "production" | "transport" | null {
  const text = `${category} ${description}`.toLocaleLowerCase("id-ID");
  if (/warna|pewarna|powder|coating|finishing|\bcat\b/.test(text)) return "coloring";
  if (category === "Transportasi" || /ongkir|ongkos jalan|ekspedisi|bensin|solar|\bbbm\b|\btol\b|parkir|pengiriman|transport/.test(text)) return "transport";
  if (category === "Perawatan Mesin" || /mesin|produksi|listrik|\blas\b|rakit|\bgas\b|perawatan|servis|service/.test(text)) return "production";
  return null;
}
