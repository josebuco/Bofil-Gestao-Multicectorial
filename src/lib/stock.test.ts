import { describe, expect, it } from "vitest";
import { stockPurchaseAmount } from "./stock";

describe("sector stock purchase pricing", () => {
  it("calculates one liter of fuel at 420 Kz", () => {
    expect(stockPurchaseAmount("litro", 1, 0)).toBe(420);
  });

  it("calculates fuel cost from liters at 420 Kz per liter", () => {
    expect(stockPurchaseAmount("litro", 10, 0)).toBe(4200);
  });

  it("uses the entered total for parts and materials", () => {
    expect(stockPurchaseAmount("unidade", 3, 765.5)).toBe(765.5);
  });
});