import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("rental_assets").select("*").order("name");
    if (error) throw new Error(error.message);
    return data || [];
  });

export const createAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().trim().min(1).max(100),
        kind: z.enum(["Veículo", "Equipamento"]),
        plate: z.string().trim().max(40).nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("rental_assets").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Só a administração pode apagar.");
    const { error } = await context.supabase.from("rental_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.from("expense_categories").select("name").order("name");
    return (data || []).map((c) => c.name);
  });

export const addCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("expense_categories").insert({ name: data.name });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { ok: true };
  });
