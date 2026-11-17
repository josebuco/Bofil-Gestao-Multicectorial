export type VehicleRange = { from: string; to: string };

export function vehicleRangeForAccess(isAdmin: boolean, requested: VehicleRange, today: string): VehicleRange {
  return isAdmin ? requested : { from: today, to: today };
}

export function canSeeVehicleFinancials(isAdmin: boolean, sectors: string[], vehicleSector: string) {
  return isAdmin || sectors.includes(vehicleSector);
}

export function vehicleTotals(
  entries: Array<{ amount: number; cost?: number; status: string }>,
  expenses: Array<{ amount: number; status: string }>,
  stockUse: Array<{ amount: number }>,
) {
  const revenue = entries.filter((entry) => entry.status !== "Pendente").reduce((sum, entry) => sum + entry.amount, 0);
  const paidEntries = entries.filter((entry) => entry.status !== "Pendente");
  const entryCosts = paidEntries.reduce((sum, entry) => sum + (entry.cost || 0), 0);
  const expense = expenses.filter((expense) => expense.status !== "Pendente").reduce((sum, expense) => sum + expense.amount, 0);
  const consumption = stockUse.reduce((sum, item) => sum + item.amount, 0);
  return { revenue, expense: expense + entryCosts + consumption, balance: revenue - expense - entryCosts - consumption };
}