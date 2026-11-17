import { describe, expect, it } from "vitest";
import { canSeeVehicleFinancials, vehicleRangeForAccess, vehicleTotals } from "./vehicle-control";

describe("vehicle control access and daily totals", () => {
  it("limits technicians to today even if they request a historical period", () => {
    expect(vehicleRangeForAccess(false, { from: "2026-01-01", to: "2026-01-31" }, "2026-11-17"))
      .toEqual({ from: "2026-11-17", to: "2026-11-17" });
  });

  it("shows entry values only to admins or technicians with that vehicle sector", () => {
    expect(canSeeVehicleFinancials(false, ["agua", "veiculos"], "agua")).toBe(true);
    expect(canSeeVehicleFinancials(false, ["veiculos"], "transporte")).toBe(false);
    expect(canSeeVehicleFinancials(true, [], "transporte")).toBe(true);
  });

  it("counts only paid entries and expenses in the vehicle balance", () => {
    expect(vehicleTotals(
      [{ amount: 1000, cost: 50, status: "Pago" }, { amount: 900, cost: 20, status: "Pendente" }],
      [{ amount: 200, status: "Pago" }, { amount: 500, status: "Pendente" }],
      [{ amount: 100 }],
    )).toEqual({ revenue: 1000, expense: 350, balance: 650 });
  });
});