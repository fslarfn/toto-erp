import { describe, expect, it } from "vitest";
import { decemberTrueUp, monthlyTerTax, progressiveAnnualTax, terCategory, terRate } from "./pph21";

describe("PPh 21 calculator", () => {
  it("maps PTKP to the correct TER category", () => {
    expect(terCategory("TK/0")).toBe("A");
    expect(terCategory("K/1")).toBe("B");
    expect(terCategory("K/3")).toBe("C");
  });
  it("uses TER bracket boundaries", () => {
    expect(terRate(5_400_000, "TK/0")).toBe(0);
    expect(terRate(5_400_001, "TK/0")).toBe(.0025);
    expect(monthlyTerTax(10_000_000, "TK/0")).toBe(200_000);
  });
  it("calculates progressive annual tax", () => {
    expect(progressiveAnnualTax(100_000_000)).toBe(9_000_000);
  });
  it("uses actual previous withholding for December true-up", () => {
    const result = decemberTrueUp({ annualGross: 120_000_000, employeeBpjs: 0, priorWithholding: 2_000_000, ptkp: "TK/0" });
    expect(result.pkp).toBe(60_000_000);
    expect(result.annualTax).toBe(3_000_000);
    expect(result.decemberTax).toBe(1_000_000);
  });
});
