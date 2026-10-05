import { describe, expect, it } from "vitest";
import { mergeQueuedFinance, mergeQueuedSectorEntries, type FinanceSnapshot } from "./offline-finance";
import type { QueuedItem } from "./offline";

const range = { from: "2026-10-01", to: "2026-10-31" };
const entry = { id: "entry-1", sector: "restaurante", kind: "receita" as const, date: "2026-10-05T10:00:00Z", description: "Entrada", amount: 1000, status: "Pendente", payment: "Numerário" };
const pending: QueuedItem = { id: "local-1", kind: "sector_entry", at: entry.date, label: "Entrada", data: { sector: "restaurante", amount: 1000, cost: 100, status: "Pendente", payment_method: "Banco" } };
const receipt: QueuedItem = { id: "receipt-1", kind: "sector_entry_payment", at: entry.date, label: "Pago", data: { id: entry.id, sector: "restaurante", payment_method: "Banco" } };

describe("pending sector receipts", () => {
  it("keeps unpaid entries visible without adding revenue or available cash", () => {
    const result = mergeQueuedFinance(undefined, [pending], range);
    expect(result.entries).toHaveLength(1);
    expect(result.totals.revenue).toBe(0);
    expect(result.totals.bank).toBe(0);
    expect(result.totals.balance).toBe(0);
  });
  it("overlays a queued receipt once and updates chart and bank", () => {
    const source = mergeQueuedFinance(undefined, [], range);
    source.entries = [entry];
    const result = mergeQueuedFinance(source, [receipt, { ...receipt, id: "duplicate" }], range);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.status).toBe("Pago");
    expect(result.totals.revenue).toBe(1000);
    expect(result.totals.bank).toBe(1000);
    expect(result.totals.cash).toBe(0);
    expect(result.sectors.find((s) => s.slug === "restaurante")?.series.find((s) => s.month === "05/10")?.receitas).toBe(1000);
    expect(source.entries[0]?.status).toBe("Pendente");
  });
  it("does not add a receipt already paid on the server", () => {
    const source: FinanceSnapshot = mergeQueuedFinance(undefined, [{ ...pending, data: { ...pending.data, status: "Pago" } }], range);
    source.entries[0] = { ...entry, status: "Pago" };
    expect(mergeQueuedFinance(source, [receipt], range).totals.revenue).toBe(1000);
  });
  it("keeps costs and client data in the history when paying offline", () => {
    const rows = [{ id: entry.id, amount: 1000, cost: 100, status: "Pendente", client_name: "Cliente", payment_method: "Numerário", created_at: entry.date }];
    const result = mergeQueuedSectorEntries(rows, [receipt], "restaurante", range);
    expect(result[0]).toMatchObject({ status: "Pago", cost: 100, client_name: "Cliente", pending: true, payment_method: "Banco" });
  });
  it("respects the chosen date and period for offline entries", () => {
    const item = { ...pending, data: { ...pending.data, entry_date: "2026-09-30" } };
    expect(mergeQueuedFinance(undefined, [item], range).entries).toHaveLength(0);
    expect(mergeQueuedSectorEntries([], [item], "restaurante", range)).toHaveLength(0);
  });
});