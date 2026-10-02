import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const SECTOR = z.enum(["agua", "restaurante", "lavagem", "transporte", "aluguer", "geral"]);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Só a administração pode gerir cedências.");
}

export const listTransfers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("sector_transfers")
      .select("*")
      .order("transfer_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = data || [];
    const loans = rows
      .filter((r) => r.kind === "cedencia")
      .map((l) => {
        const returns = rows.filter((r) => r.parent_id === l.id);
        const returned = returns.reduce((s, r) => s + r.amount, 0);
        return { ...l, returns, returned, remaining: Math.max(0, l.amount - returned) };
      });
    return loans;
  });

export const createTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        from_sector: SECTOR,
        to_sector: SECTOR,
        amount: z.number().int().positive().max(1_000_000_000),
        payment_method: z.enum(["Numerário", "Banco"]),
        note: z.string().max(200).nullable().default(null),
        transfer_date: DATE,
      })
      .refine((v) => v.from_sector !== v.to_sector, "Escolha setores diferentes.")
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("sector_transfers")
      .insert({ ...data, kind: "cedencia", created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const returnTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        parent_id: z.string().uuid(),
        amount: z.number().int().positive(),
        payment_method: z.enum(["Numerário", "Banco"]),
        transfer_date: DATE,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: loan, error: lErr } = await context.supabase
      .from("sector_transfers")
      .select("id, from_sector, to_sector, amount")
      .eq("id", data.parent_id)
      .eq("kind", "cedencia")
      .single();
    if (lErr || !loan) throw new Error("Cedência não encontrada.");
    const { data: prev } = await context.supabase
      .from("sector_transfers")
      .select("amount")
      .eq("parent_id", loan.id);
    const remaining = loan.amount - (prev || []).reduce((s, r) => s + r.amount, 0);
    if (data.amount > remaining) throw new Error(`Só faltam ${remaining.toLocaleString("pt-AO")} Kz por devolver.`);
    const { error } = await context.supabase.from("sector_transfers").insert({
      from_sector: loan.to_sector,
      to_sector: loan.from_sector,
      amount: data.amount,
      kind: "devolucao",
      parent_id: loan.id,
      payment_method: data.payment_method,
      transfer_date: data.transfer_date,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("sector_transfers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
