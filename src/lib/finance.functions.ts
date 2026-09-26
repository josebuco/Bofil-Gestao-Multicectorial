import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SECTOR_LABELS: Record<string, string> = {
  agua: "Água",
  restaurante: "Restaurante",
  lavagem: "Lavagem",
  transporte: "Transporte Escolar",
  geral: "Geral / Administração",
};

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
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
    const fromDate = new Date(`${data.from}T00:00:00`);
    const toDate = new Date(`${data.to}T23:59:59`);
    const fromIso = fromDate.toISOString();
    const toIso = toDate.toISOString();
    const spanDays = Math.max(
      1,
      Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1,
    );
    const granularity: "day" | "month" = spanDays <= 62 ? "day" : "month";

    const [sales, quick, expenses] = await Promise.all([
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
    ]);

    // build buckets
    const buckets: string[] = [];
    if (granularity === "day") {
      const cursor = new Date(fromDate);
      while (cursor <= toDate) {
        buckets.push(dayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    } else {
      const cursor = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
      while (cursor <= toDate) {
        buckets.push(monthKey(cursor));
        cursor.setMonth(cursor.getMonth() + 1);
      }
    }

    const keyOf = (when: string | Date) => {
      const d = typeof when === "string" ? new Date(when.length <= 10 ? `${when}T00:00:00` : when) : when;
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
      kind: "receita" | "despesa";
      date: string;
      description: string;
      amount: number;
      status: string;
      category?: string;
      invoice_path?: string | null;
      payment?: string;
    }> = [];
    const bank: Record<string, number> = Object.fromEntries(slugs.map((s) => [s, 0]));

    for (const s of sales.data || []) {
      add(revenue, "agua", s.created_at, s.total || 0);
      if (s.payment_method === "Banco") bank.agua = (bank.agua || 0) + (s.total || 0);
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
      entries.push({
        sector: e.sector,
        kind: "despesa",
        date: e.expense_date,
        description: e.description,
        amount: e.amount || 0,
        status: e.status,
        category: e.category,
        invoice_path: e.invoice_path,
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
        bank: bank[slug] || 0,
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
        expense: sectors.reduce((s, x) => s + x.expense, 0),
        balance: sectors.reduce((s, x) => s + x.balance, 0),
        pendingExpense: sectors.reduce((s, x) => s + x.pendingExpense, 0),
      },
    };
  });
