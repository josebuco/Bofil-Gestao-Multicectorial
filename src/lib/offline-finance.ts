import { useQueue, type QueuedItem } from "@/lib/offline";
import { angolaParts } from "@/lib/tz";

export type FinanceEntry = {
  sector: string;
  kind: "receita" | "despesa" | "deposito";
  id?: string;
  date: string;
  description: string;
  amount: number;
  status: string;
  category?: string;
  invoice_path?: string | null;
  payment?: string;
  pending?: boolean;
};

export type FinanceSector = {
  slug: string;
  label: string;
  revenue: number;
  bankRevenue: number;
  bankExpense: number;
  deposits: number;
  bank: number;
  cash: number;
  expense: number;
  balance: number;
  pendingExpense: number;
  series: Array<{ month: string; receitas: number; despesas: number; saldo: number }>;
};

export type FinanceSnapshot = {
  granularity: "day" | "month";
  range: { from: string; to: string };
  sectors: FinanceSector[];
  entries: FinanceEntry[];
  totals: {
    revenue: number;
    bank: number;
    bankRevenue: number;
    cash: number;
    expense: number;
    balance: number;
    pendingExpense: number;
  };
};

const LABELS: Record<string, string> = {
  agua: "Água",
  restaurante: "Restaurante",
  lavagem: "Lavagem",
  transporte: "Transporte Escolar",
  aluguer: "Aluguer de Veículos e Equipamentos",
  geral: "Geral / Administração",
};

const pad = (value: number) => String(value).padStart(2, "0");

function dayKey(value: string) {
  const p = angolaParts(value);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function monthKey(value: string) {
  const p = angolaParts(value);
  return `${p.y}-${pad(p.m)}`;
}

function bucketLabels(range: { from: string; to: string }, granularity: "day" | "month") {
  const labels: string[] = [];
  const cursor = new Date(`${range.from}T12:00:00+01:00`);
  const end = new Date(`${range.to}T12:00:00+01:00`);
  while (cursor <= end) {
    const key = granularity === "day" ? dayKey(cursor.toISOString()) : monthKey(cursor.toISOString());
    const label = granularity === "day" ? `${key.slice(8)}/${key.slice(5, 7)}` : `${key.slice(5)}/${key.slice(2, 4)}`;
    if (!labels.includes(label)) labels.push(label);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return labels;
}

function emptySnapshot(range: { from: string; to: string }): FinanceSnapshot {
  const span = Math.max(1, Math.round((new Date(range.to).getTime() - new Date(range.from).getTime()) / 864e5) + 1);
  const granularity: "day" | "month" = span <= 62 ? "day" : "month";
  const series = bucketLabels(range, granularity).map((month) => ({ month, receitas: 0, despesas: 0, saldo: 0 }));
  const sectors = Object.entries(LABELS).map(([slug, label]) => ({
    slug, label, revenue: 0, bankRevenue: 0, bankExpense: 0, deposits: 0, bank: 0,
    cash: 0, expense: 0, balance: 0, pendingExpense: 0, series: series.map((point) => ({ ...point })),
  }));
  return {
    granularity,
    range,
    sectors,
    entries: [],
    totals: { revenue: 0, bank: 0, bankRevenue: 0, cash: 0, expense: 0, balance: 0, pendingExpense: 0 },
  };
}

function queuedEntry(item: QueuedItem): FinanceEntry | null {
  const amount = Number(item.data["amount"] ?? item.data["offline_total"] ?? item.data["total"]) || 0;
  const payment = String(item.data["payment_method"] || "Numerário");
  if (item.kind === "sector_entry") {
    const client = item.data["client_name"];
    return { id: item.id, sector: String(item.data["sector"]), kind: "receita", date: item.data["entry_date"] ? `${item.data["entry_date"]}T12:00:00+01:00` : item.at, description: client ? `Entrada — ${client}` : "Entrada", amount, status: String(item.data["status"] || "Pago"), payment, pending: true };
  }
  if (item.kind === "water_sale") {
    return { id: item.id, sector: "agua", kind: "receita", date: item.at, description: item.label, amount, status: String(item.data["status"] || "Entregue"), payment, pending: true };
  }
  if (item.kind === "expense") {
    return {
      id: item.id,
      sector: String(item.data["sector"]),
      kind: "despesa",
      date: String(item.data["expense_date"] || item.at),
      description: String(item.data["description"] || "Despesa"),
      amount,
      status: String(item.data["status"] || "Pendente"),
      category: String(item.data["category"] || "Geral"),
      invoice_path: null,
      payment,
      pending: true,
    };
  }
  return null;
}

export function mergeQueuedFinance(
  source: FinanceSnapshot | undefined,
  queue: QueuedItem[],
  range: { from: string; to: string },
): FinanceSnapshot {
  const base = source ?? emptySnapshot(range);
  const snapshot: FinanceSnapshot = {
    ...base,
    range,
    sectors: base.sectors.map((sector) => ({ ...sector, series: sector.series.map((point) => ({ ...point })) })),
    entries: base.entries.map((entry) => ({ ...entry })),
    totals: { ...base.totals },
  };
  const pendingEntries = queue.map(queuedEntry).filter((entry): entry is FinanceEntry => entry !== null);

  for (const item of queue.filter((item) => item.kind === "sector_entry_payment")) {
    const existing = snapshot.entries.find((entry) => entry.id === item.data["id"] && entry.sector === item.data["sector"] && entry.kind === "receita");
    if (!existing || existing.status !== "Pendente") continue;
    // Replace the pending row, then add only its newly received revenue below.
    snapshot.entries = snapshot.entries.filter((entry) => entry !== existing);
    pendingEntries.push({ ...existing, status: "Pago", payment: String(item.data["payment_method"]), pending: true });
  }

  for (const entry of pendingEntries) {
    const date = dayKey(entry.date);
    if (date < range.from || date > range.to) continue;
    const sector = snapshot.sectors.find((item) => item.slug === entry.sector);
    if (!sector) continue;
    const countsAsRevenue = entry.kind === "receita" && entry.status !== "Pendente";
    const countsAsExpense = entry.kind === "despesa";
    const bank = entry.payment === "Banco";
    if (countsAsRevenue) {
      sector.revenue += entry.amount;
      if (bank) sector.bankRevenue += entry.amount;
    }
    if (countsAsExpense) {
      sector.expense += entry.amount;
      if (bank) sector.bankExpense += entry.amount;
      if (entry.status === "Pendente") sector.pendingExpense += entry.amount;
    }
    sector.balance = sector.revenue - sector.expense;
    sector.bank = sector.bankRevenue - sector.bankExpense + sector.deposits;
    sector.cash = sector.revenue - sector.bankRevenue - (sector.expense - sector.bankExpense) - sector.deposits;

    const key = snapshot.granularity === "day" ? dayKey(entry.date) : monthKey(entry.date);
    const label = snapshot.granularity === "day" ? `${key.slice(8)}/${key.slice(5, 7)}` : `${key.slice(5)}/${key.slice(2, 4)}`;
    const point = sector.series.find((item) => item.month === label);
    if (point) {
      if (countsAsRevenue) point.receitas += entry.amount;
      if (countsAsExpense) point.despesas += entry.amount;
      point.saldo = point.receitas - point.despesas;
    }
    snapshot.entries.push(entry);
  }

  snapshot.entries.sort((a, b) => (a.date < b.date ? 1 : -1));
  snapshot.totals = {
    revenue: snapshot.sectors.reduce((sum, sector) => sum + sector.revenue, 0),
    bank: snapshot.sectors.reduce((sum, sector) => sum + sector.bank, 0),
    bankRevenue: snapshot.sectors.reduce((sum, sector) => sum + sector.bankRevenue, 0),
    cash: snapshot.sectors.reduce((sum, sector) => sum + sector.cash, 0),
    expense: snapshot.sectors.reduce((sum, sector) => sum + sector.expense, 0),
    balance: snapshot.sectors.reduce((sum, sector) => sum + sector.balance, 0),
    pendingExpense: snapshot.sectors.reduce((sum, sector) => sum + sector.pendingExpense, 0),
  };
  return snapshot;
}

export function useMergedFinance(
  source: FinanceSnapshot | undefined,
  range: { from: string; to: string },
) {
  const queue = useQueue();
  return mergeQueuedFinance(source, queue, range);
}

type SectorEntryRow = { id: string; amount: number; cost: number; status: string; client_name: string | null; payment_method: string; created_at: string };

/** Same local payment overlay used by the finance snapshot and sector histories. */
export function mergeQueuedSectorEntries(rows: SectorEntryRow[], queue: QueuedItem[], sector: string, range: { from: string; to: string }) {
  const local = queue.filter((item) => item.kind === "sector_entry" && item.data["sector"] === sector).map((item) => ({
    id: item.id, amount: Number(item.data["amount"]) || 0, cost: Number(item.data["cost"]) || 0,
    status: String(item.data["status"] || "Pago"), client_name: item.data["client_name"] ? String(item.data["client_name"]) : null,
    payment_method: String(item.data["payment_method"] || "Numerário"),
    created_at: item.data["entry_date"] ? `${item.data["entry_date"]}T12:00:00+01:00` : item.at, pending: true,
  }));
  return [...local, ...rows.map((row) => ({ ...row, pending: false }))].map((row) => {
    const receipt = queue.find((item) => item.kind === "sector_entry_payment" && item.data["id"] === row.id && item.data["sector"] === sector);
    return receipt && row.status === "Pendente" ? { ...row, status: "Pago", payment_method: String(receipt.data["payment_method"]), pending: true } : row;
  }).filter((row) => { const date = dayKey(row.created_at); return date >= range.from && date <= range.to; })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}