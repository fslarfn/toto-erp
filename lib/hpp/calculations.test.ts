import { describe, expect, it } from "vitest";
import { allocationPerMeter, allocationPerOrder, calculateHpp, calculateProductHpp, calculateShippedHpp, classifyHppExpense, parseOrderNumber } from "./calculations";

describe("HPP pesanan CV Toto", () => {
  it("menjumlahkan kelima komponen tanpa menggandakan bahan", () => {
    const result = calculateHpp({
      materials: [{ quantity: 2, unitPrice: 100_000 }, { quantity: 3, unitPrice: 50_000 }],
      coloringCost: 40_000,
      laborCost: 80_000,
      productionCost: 30_000,
      transportCost: 20_000,
      quantity: 2,
      sellingPrice: 750_000,
    });

    expect(result.materialCost).toBe(350_000);
    expect(result.totalCost).toBe(520_000);
    expect(result.unitCost).toBe(260_000);
    expect(result.margin).toBe(230_000);
  });

  it("membaca nominal format Indonesia", () => {
    expect(parseOrderNumber("Rp 1.250.000")).toBe(1_250_000);
    expect(parseOrderNumber("2,5")).toBe(2.5);
    expect(parseOrderNumber(450_000)).toBe(450_000);
  });

  it("membagi referensi biaya secara aman", () => {
    expect(allocationPerOrder(1_000_000, 4)).toBe(250_000);
    expect(allocationPerOrder(1_000_000, 0)).toBe(0);
  });

  it("menampilkan margin negatif ketika harga jual di bawah HPP", () => {
    const result = calculateHpp({
      materials: [{ quantity: 1, unitPrice: 200_000 }],
      coloringCost: 0,
      laborCost: 0,
      productionCost: 0,
      transportCost: 0,
      quantity: 1,
      sellingPrice: 150_000,
    });

    expect(result.margin).toBe(-50_000);
    expect(result.marginPercent).toBeCloseTo(-33.333, 2);
  });
});

describe("HPP barang per meter", () => {
  it("membagi harga invoice terbaru sesuai panjang batang", () => {
    const result = calculateProductHpp({
      purchasePrice: 558_378,
      materialLength: 6,
      coloringCost: 0,
      laborCost: 0,
      productionCost: 0,
      transportCost: 0,
      sellingPrice: 0,
    });

    expect(result.materialCostPerMeter).toBe(93_063);
    expect(result.totalCostPerMeter).toBe(93_063);
  });

  it("menambahkan pewarnaan, tenaga kerja, produksi, dan ongkos jalan per meter", () => {
    const result = calculateProductHpp({
      purchasePrice: 600_000,
      materialLength: 6,
      coloringCost: 10_000,
      laborCost: 15_000,
      productionCost: 5_000,
      transportCost: 3_000,
      sellingPrice: 175_000,
    });

    expect(result.materialCostPerMeter).toBe(100_000);
    expect(result.totalCostPerMeter).toBe(133_000);
    expect(result.marginPerMeter).toBe(42_000);
  });

  it("menerima harga manual dan menghindari pembagian dengan nol", () => {
    const result = calculateProductHpp({
      purchasePrice: 150_000,
      materialLength: 0,
      coloringCost: 0,
      laborCost: 0,
      productionCost: 0,
      transportCost: 0,
      sellingPrice: 200_000,
    });

    expect(result.materialCostPerMeter).toBe(150_000);
    expect(result.marginPerMeter).toBe(50_000);
  });

  it("membagi biaya periode ke total meter bahan", () => {
    expect(allocationPerMeter(600_000, 300)).toBe(2_000);
    expect(allocationPerMeter(600_000, 0)).toBe(0);
  });

  it("mengelompokkan pewarnaan, ongkos produksi, dan ongkos jalan", () => {
    expect(classifyHppExpense("Operasional", "Jasa powder coating kusen")).toBe("coloring");
    expect(classifyHppExpense("Transportasi", "Bensin kirim bahan")).toBe("transport");
    expect(classifyHppExpense("Perawatan Mesin", "Service mesin potong")).toBe("production");
    expect(classifyHppExpense("Operasional", "Makan tim admin")).toBeNull();
  });
});

describe("HPP saat barang dikirim", () => {
  it("membekukan HPP berdasarkan ukuran dan jumlah barang", () => {
    const result = calculateShippedHpp({
      quantity: 2,
      sizeMeter: 6,
      sellingPricePerMeter: 250_000,
      materialCostPerMeter: 93_063,
      totalHppPerMeter: 130_000,
    });

    expect(result.totalMeter).toBe(12);
    expect(result.revenueTotal).toBe(3_000_000);
    expect(result.materialCostTotal).toBe(1_116_756);
    expect(result.totalHpp).toBe(1_560_000);
    expect(result.marginTotal).toBe(1_440_000);
  });
});
