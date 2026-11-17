export const FUEL_PRICE_PER_LITER = 420;

export function stockPurchaseAmount(unit: "litro" | "unidade", quantity: number, itemTotal: number) {
  if (unit === "litro") return Math.round(quantity * FUEL_PRICE_PER_LITER * 100) / 100;
  return Math.round(itemTotal * 100) / 100;
}