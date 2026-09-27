import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SECTORS = [
  { slug: "agua", label: "Água", color: "bg-water" },
  { slug: "restaurante", label: "Restaurante", color: "bg-restaurant" },
  { slug: "lavagem", label: "Lavagem", color: "bg-wash" },
  { slug: "transporte", label: "Transporte Escolar", color: "bg-transport" },
  { slug: "aluguer", label: "Aluguer", color: "bg-primary" },
  { slug: "geral", label: "Geral / Administração", color: "bg-primary" },
] as const;

export const getExpenses = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { data, error } = await context.supabase
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(300);

    if (error) throw new Error(error.message);
    const expenses = data || [];

    // Só totais por período; nunca o acumulado de todo o sempre.
    const totalsBySector: Record<string, number> = {};
    let monthTotal = 0;
    let pendingTotal = 0;
    for (const e of expenses) {
      totalsBySector[e.sector] = (totalsBySector[e.sector] || 0) + (e.amount || 0);
      if (new Date(e.expense_date) >= monthStart) monthTotal += e.amount || 0;
      if (e.status === "Pendente") pendingTotal += e.amount || 0;
    }

    return {
      expenses,
      totalsBySector,
      monthTotal,
      pendingTotal,
    };
  });

export const createExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        sector: z.string().min(1),
        category: z.string().min(1),
        description: z.string().min(1),
        amount: z.number().int().min(0),
        expense_date: z.string().min(1),
        supplier: z.string().nullable().default(null),
        status: z.string().min(1),
        invoice_path: z.string().nullable().default(null),
        notes: z.string().nullable().default(null),
        payment_method: z.enum(["Numerário", "Banco"]).default("Numerário"),
        recorded_at: z.string().datetime().optional(),
        asset_id: z.string().uuid().nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    const { todayAngola } = await import("@/lib/tz");
    const { recorded_at, ...rest } = data;
    const t = recorded_at ? new Date(recorded_at).getTime() : NaN;
    const offlineDay =
      t && t <= Date.now() && t > Date.now() - 60 * 864e5
        ? new Date(t + 3600e3).toISOString().slice(0, 10) // dia em Angola (UTC+1)
        : null;
    const row = { ...rest, expense_date: isAdmin ? data.expense_date : offlineDay || todayAngola() };
    const { error } = await context.supabase
      .from("expenses")
      .insert({ ...row, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExpense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Só a administração pode apagar registos.");
    const { error } = await context.supabase.from("expenses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markExpensePaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        invoice_path: z.string().nullable().default(null),
        notes: z.string().nullable().default(null),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const patch: { status: string; invoice_path?: string; notes?: string } = { status: "Pago" };
    if (data.invoice_path) patch.invoice_path = data.invoice_path;
    if (data.notes) patch.notes = data.notes;
    const { error } = await context.supabase.from("expenses").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getInvoiceUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ path: z.string().min(1) }).parse(data))
  .handler(async ({ context, data }) => {
    const { data: signed, error } = await context.supabase.storage
      .from("faturas")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
