import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { angolaParts, dayEndIso, dayStartIso } from "@/lib/tz";

export const SECTOR_LABELS: Record<string, string> = {
  agua: "Água",
  restaurante: "Restaurante",
  lavagem: "Lavagem",
  transporte: "Transporte Escolar",
  aluguer: "Aluguer de Veículos e Equipamentos",
  geral: "Geral / Administração",
};

const pad = (n: number) => String(n).padStart(2, "0");
function dayKey(date: Date | string) {
  const p = angolaParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function monthKey(date: Date | string) {
  const p = angolaParts(date);
  return `${p.y}-${pad(p.m)}`;
}

export const getFinance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        from: z.string().min(8),
        to: z.string().min(8),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const fromIso = dayStartIso(data.from);
    const toIso = dayEndIso(data.to);
    const fromDate = new Date(fromIso);
    const toDate = new Date(toIso);
    const spanDays = Math.max(
      1,
      Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1,
    );
    const granularity: "day" | "month" = spanDays <= 62 ? "day" : "month";

    const [sales, quick, expenses, deposits, transfers] = await Promise.all([
      context.supabase
        .from("water_sales")
        .select("total, created_at, client_name, status, payment_method")
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      context.supabase
        .from("sector_entries")
        .select("id, sector, amount, created_at, payment_method")
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      context.supabase
        .from("expenses")
        .select("*")
        .gte("expense_date", data.from)
        .lte("expense_date", data.to),
      context.supabase
        .from("bank_deposits")
        .select("id, sector, amount, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
      context.supabase
        .from("sector_transfers")
        .select("id, from_sector, to_sector, amount, kind, payment_method, transfer_date")
        .gte("transfer_date", data.from)
        .lte("transfer_date", data.to),
    ]);

    // build buckets
    const buckets: string[] = [];
    if (granularity === "day") {
      const cursor = new Date(fromDate);
      while (cursor <= toDate) {
        buckets.push(dayKey(cursor));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    } else {
      const cursor = new Date(fromDate);
      while (cursor <= toDate) {
        const k = monthKey(cursor);
        if (!buckets.includes(k)) buckets.push(k);
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    const keyOf = (when: string | Date) => {
      const d = typeof when === "string" && when.length <= 10 ? `${when}T12:00:00+01:00` : when;
      return granularity === "day" ? dayKey(d) : monthKey(d);
    };

    const empty = () => Object.fromEntries(buckets.map((m) => [m, 0])) as Record<string, number>;
    const slugs = Object.keys(SECTOR_LABELS);
    const revenue: Record<string, Record<string, number>> = Object.fromEntries(
      slugs.map((s) => [s, empty()]),
    );
    const expense: Record<string, Record<string, number>> = Object.fromEntries(
      slugs.map((s) => [s, empty()]),
    );

    const add = (
      bag: Record<string, Record<string, number>>,
      sector: string,
      when: string,
      amount: number,
    ) => {
      const key = keyOf(when);
      const bucket = bag[sector];
      if (bucket && key in bucket) bucket[key] = (bucket[key] || 0) + (amount || 0);
    };

    const entries: Array<{
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
    }> = [];
    const bank: Record<string, number> = Object.fromEntries(slugs.map((s) => [s, 0]));
    const bankExp: Record<string, number> = Object.fromEntries(slugs.map((s) => [s, 0]));

    for (const s of sales.data || []) {
      // Pending deliveries are not revenue until delivered.
      if (s.status !== "Pendente") add(revenue, "agua", s.created_at, s.total || 0);
      if (s.status !== "Pendente" && s.payment_method === "Banco") bank["agua"] = (bank["agua"] || 0) + (s.total || 0);
      entries.push({
        sector: "agua",
        kind: "receita",
        date: s.created_at,
        description: `Venda de água${s.client_name ? ` — ${s.client_name}` : ""}`,
        amount: s.total || 0,
        status: s.status || "—",
        payment: s.payment_method,
      });
    }
    for (const q of quick.data || []) {
      add(revenue, q.sector, q.created_at, q.amount || 0);
      if (q.payment_method === "Banco") bank[q.sector] = (bank[q.sector] || 0) + (q.amount || 0);
      entries.push({
        sector: q.sector,
        kind: "receita",
        date: q.created_at,
        description: "Entrada",
        amount: q.amount || 0,
        status: "Recebido",
        payment: q.payment_method,
      });
    }

    for (const e of expenses.data || []) {
      add(expense, e.sector, e.expense_date, e.amount || 0);
      if (e.payment_method === "Banco") bankExp[e.sector] = (bankExp[e.sector] || 0) + (e.amount || 0);
      entries.push({
        sector: e.sector,
        kind: "despesa",
        date: e.expense_date,
        description: e.description,
        amount: e.amount || 0,
        status: e.status,
        category: e.category,
        invoice_path: e.invoice_path,
        payment: e.payment_method,
      });
    }

    // Cedências/devoluções entre setores: sai como saída num setor e entra como entrada no outro.
    for (const t of transfers.data || []) {
      const ret = t.kind === "devolucao";
      add(expense, t.from_sector, t.transfer_date, t.amount || 0);
      add(revenue, t.to_sector, t.transfer_date, t.amount || 0);
      if (t.payment_method === "Banco") {
        bankExp[t.from_sector] = (bankExp[t.from_sector] || 0) + (t.amount || 0);
        bank[t.to_sector] = (bank[t.to_sector] || 0) + (t.amount || 0);
      }
      const toL = SECTOR_LABELS[t.to_sector] || t.to_sector;
      const fromL = SECTOR_LABELS[t.from_sector] || t.from_sector;
      entries.push({
        sector: t.from_sector, kind: "despesa", date: t.transfer_date,
        description: ret ? `Devolução para ${toL}` : `Cedência para ${toL}`,
        amount: t.amount || 0, status: "Pago", category: ret ? "Devolução" : "Cedência", payment: t.payment_method,
      });
      entries.push({
        sector: t.to_sector, kind: "receita", date: t.transfer_date,
        description: ret ? `Devolução recebida de ${fromL}` : `Cedência recebida de ${fromL}`,
        amount: t.amount || 0, status: "Recebido", payment: t.payment_method,
      });
    }

    const dep: Record<string, number> = Object.fromEntries(slugs.map((s) => [s, 0]));
    for (const d of deposits.data || []) {
      dep[d.sector] = (dep[d.sector] || 0) + (d.amount || 0);
      entries.push({
        sector: d.sector,
        kind: "deposito",
        date: d.created_at,
        description: "Depósito no banco",
        amount: d.amount || 0,
        status: "Depositado",
        id: d.id,
      });
    }

    entries.sort((a, b) => (a.date < b.date ? 1 : -1));

    const label = (key: string) =>
      granularity === "day" ? `${key.slice(8)}/${key.slice(5, 7)}` : `${key.slice(5)}/${key.slice(2, 4)}`;

    const sectors = slugs.map((slug) => {
      const rev = buckets.reduce((s, m) => s + (revenue[slug]?.[m] || 0), 0);
      const exp = buckets.reduce((s, m) => s + (expense[slug]?.[m] || 0), 0);
      const sectorEntries = entries.filter((e) => e.sector === slug);
      return {
        slug,
        label: SECTOR_LABELS[slug]!,
        revenue: rev,
        bankRevenue: bank[slug] || 0,
        bankExpense: bankExp[slug] || 0,
        deposits: dep[slug] || 0,
        bank: (bank[slug] || 0) - (bankExp[slug] || 0) + (dep[slug] || 0),
        cash: rev - (bank[slug] || 0) - (exp - (bankExp[slug] || 0)) - (dep[slug] || 0),
        expense: exp,
        balance: rev - exp,
        pendingExpense: sectorEntries
          .filter((e) => e.kind === "despesa" && e.status === "Pendente")
          .reduce((s, e) => s + e.amount, 0),
        series: buckets.map((m) => ({
          month: label(m),
          receitas: revenue[slug]?.[m] || 0,
          despesas: expense[slug]?.[m] || 0,
          saldo: (revenue[slug]?.[m] || 0) - (expense[slug]?.[m] || 0),
        })),
      };
    });

    return {
      granularity,
      range: { from: data.from, to: data.to },
      sectors,
      entries: entries.slice(0, 500),
      totals: {
        revenue: sectors.reduce((s, x) => s + x.revenue, 0),
        bank: sectors.reduce((s, x) => s + x.bank, 0),
        bankRevenue: sectors.reduce((s, x) => s + x.bankRevenue, 0),
        cash: sectors.reduce((s, x) => s + x.cash, 0),
        expense: sectors.reduce((s, x) => s + x.expense, 0),
        balance: sectors.reduce((s, x) => s + x.balance, 0),
        pendingExpense: sectors.reduce((s, x) => s + x.pendingExpense, 0),
      },
    };
  });

// Cash physically available in the sector's box: all cash revenue minus cash
// expenses minus everything already deposited, over all time (not just a period).
async function sectorCashOnHand(
  supabase: { from: (t: string) => any },
  sector: string,
) {
  const [sales, entries, expenses, deposits, tOut, tIn] = await Promise.all([
    sector === "agua"
      ? supabase.from("water_sales").select("total, payment_method").neq("status", "Pendente")
      : Promise.resolve({ data: [] }),
    supabase.from("sector_entries").select("amount, payment_method").eq("sector", sector),
    supabase.from("expenses").select("amount, payment_method").eq("sector", sector),
    supabase.from("bank_deposits").select("amount").eq("sector", sector),
    supabase.from("sector_transfers").select("amount, payment_method").eq("from_sector", sector),
    supabase.from("sector_transfers").select("amount, payment_method").eq("to_sector", sector),
  ]);
  for (const t of tIn.data || []) if (t.payment_method !== "Banco") entries.data = [...(entries.data || []), { amount: t.amount, payment_method: "Numerário" }];
  for (const t of tOut.data || []) if (t.payment_method !== "Banco") expenses.data = [...(expenses.data || []), { amount: t.amount, payment_method: "Numerário" }];
  let rev = 0;
  let bankRev = 0;
  for (const s of sales.data || []) {
    rev += s.total || 0;
    if (s.payment_method === "Banco") bankRev += s.total || 0;
  }
  let exp = 0;
  let bankExp = 0;
  for (const e of entries.data || []) {
    rev += e.amount || 0;
    if (e.payment_method === "Banco") bankRev += e.amount || 0;
  }
  for (const e of expenses.data || []) {
    exp += e.amount || 0;
    if (e.payment_method === "Banco") bankExp += e.amount || 0;
  }
  let dep = 0;
  for (const d of deposits.data || []) dep += d.amount || 0;
  return rev - bankRev - (exp - bankExp) - dep;
}

export const getCashAvailable = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ sector: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const cash = await sectorCashOnHand(context.supabase, data.sector);
    return { available: Math.max(0, Math.floor(cash)) };
  });

export const addBankDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ sector: z.string().min(1), amount: z.number().int().positive() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const available = await sectorCashOnHand(context.supabase, data.sector);
    if (data.amount > available) {
      throw new Error(
        `Saldo de caixa insuficiente neste setor: disponível apenas ${Math.floor(available).toLocaleString("pt-AO")} Kz.`,
      );
    }
    const { error } = await context.supabase
      .from("bank_deposits")
      .insert({ ...data, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteBankDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("bank_deposits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
