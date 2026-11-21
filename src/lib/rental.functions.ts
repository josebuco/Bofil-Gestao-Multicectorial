import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { todayAngola } from "@/lib/tz";

const FLEET = z.enum(["aluguer", "transporte", "agua", "lavagem"]).default("aluguer");
export type FleetSector = "aluguer" | "transporte" | "agua" | "lavagem";
/** Setores que partilham o estoque central (o Restaurante fica de fora). */
export const STOCK_SECTORS = ["aluguer", "transporte", "agua", "lavagem"] as const;

export const listAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sector: FLEET }).parse(d ?? {}))
  .handler(async ({ context, data: input }) => {
    const { data, error } = await context.supabase.from("rental_assets").select("*").eq("sector", input.sector).order("name");
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
        sector: FLEET,
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

export const STOCK_CATEGORY = "Compra de estoque";

/** Contribuições da fatura geral imputadas a um veículo/equipamento do setor. */
export const listAssetContributions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sector: FLEET }).parse(d ?? {}))
  .handler(async ({ context, data: input }) => {
    const { data: canSee } = await context.supabase.rpc("can_access", { _user_id: context.userId, _sector: input.sector });
    if (!canSee) throw new Error("Sem acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("sector_transfers")
      .select("id, asset_id, amount, note, transfer_date")
      .eq("from_sector", input.sector)
      .in("kind", ["contribuicao", "cedencia"])
      .not("asset_id", "is", null)
      .order("transfer_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return data || [];
  });

/** Lista simples de ativos de todos os setores (para o quadro de contribuições). */
export const listAllAssets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId).eq("role", "admin").maybeSingle();
    if (!role) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("rental_assets").select("id, name, sector").eq("active", true).order("name");
    return data || [];
  });

/** Lotes de estoque comprados pelos setores e o que já foi aplicado nos veículos. */
export const listStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sector: FLEET }).parse(d ?? {}))
  .handler(async ({ context, data: input }) => {
    // Estoque central partilhado: qualquer setor com frota vê todos os lotes.
    const { data: canSee } = await context.supabase.rpc("can_access", { _user_id: context.userId, _sector: input.sector });
    if (!canSee) throw new Error("Sem acesso.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: purchases, error } = await supabaseAdmin
      .from("expenses")
      .select("id, description, amount, quantity, expense_date, supplier, sector, stock_unit, status")
      .in("sector", [...STOCK_SECTORS])
      .eq("category", STOCK_CATEGORY)
      .eq("status", "Pago")
      .order("expense_date", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);

    const { data: usage } = await supabaseAdmin
      .from("rental_stock_usage")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000);

    const all = usage || [];
    const usages = all.filter((u) => u.sector === input.sector);
    const items = (purchases || []).filter((p) => p.status !== "Pendente").map((p) => {
      const mine = all.filter((u) => u.purchase_id === p.id);
      const usedQty = mine.reduce((s, u) => s + (u.quantity || 0), 0);
      const usedAmount = mine.reduce((s, u) => s + (u.amount || 0), 0);
      const qty = p.quantity && p.quantity > 0 ? p.quantity : 1;
      return {
        id: p.id,
        description: p.description,
        supplier: p.supplier,
        sector: p.sector,
        fuel: p.stock_unit === "litro",
        purchase_date: p.expense_date,
        quantity: qty,
        amount: p.amount || 0,
        unit_price: Math.round((p.amount || 0) / qty),
        used_quantity: usedQty,
        used_amount: usedAmount,
        left_quantity: qty - usedQty,
        left_amount: (p.amount || 0) - usedAmount,
      };
    });
    return { items, usages };
  });

export const createStockUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        purchase_id: z.string().uuid(),
        asset_id: z.string().uuid().nullable().default(null),
        quantity: z.number().int().min(1),
        amount: z.number().min(0),
        note: z.string().trim().max(200).nullable().default(null),
        used_on: z.string().min(1),
        sector: FLEET,
        vehicle_control: z.boolean().default(false),
        recorded_at: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { recorded_at, vehicle_control, ...rest } = data;
    void recorded_at;
    if (!vehicle_control) {
      const [{ data: isAdmin }, { data: canAccess }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
        context.supabase.rpc("can_access", { _user_id: context.userId, _sector: rest.sector }),
      ]);
      if (!isAdmin && !canAccess) throw new Error("Sem acesso a este setor.");
    }
    if (vehicle_control) {
      const [{ data: isAdmin }, { data: permissions }, { data: staff }] = await Promise.all([
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
        context.supabase.from("user_permissions").select("sector").eq("user_id", context.userId),
        context.supabase.from("staff_accounts").select("active").eq("user_id", context.userId).maybeSingle(),
      ]);
      if (!isAdmin && (!staff?.active || !(permissions || []).some((p) => p.sector === "veiculos"))) {
        throw new Error("Sem permissão para registar consumos nesta aba.");
      }
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const [{ data: asset }, { data: lot }] = await Promise.all([
        rest.asset_id
          ? supabaseAdmin.from("rental_assets").select("id, sector, kind").eq("id", rest.asset_id).maybeSingle()
          : Promise.resolve({ data: null }),
        supabaseAdmin.from("expenses").select("id, sector, category, status, quantity, description").eq("id", rest.purchase_id).maybeSingle(),
      ]);
      const neutral = asset?.sector === "neutro";
      if (!asset || asset.kind !== "Veículo" || (neutral ? rest.sector !== lot?.sector : asset.sector !== rest.sector)) throw new Error("Veículo não encontrado neste setor.");
      if (!lot || lot.category !== STOCK_CATEGORY || lot.status !== "Pago" || !STOCK_SECTORS.includes(lot.sector as FleetSector)) {
        throw new Error("Lote de estoque indisponível.");
      }
      const { data: usages } = await supabaseAdmin.from("rental_stock_usage").select("quantity").eq("purchase_id", lot.id);
      const available = Math.max(0, (lot.quantity || 1) - (usages || []).reduce((sum, row) => sum + (row.quantity || 0), 0));
      if (rest.quantity > available) throw new Error("A quantidade ultrapassa o estoque disponível.");
      const { error } = await supabaseAdmin.from("rental_stock_usage").insert({
        ...rest,
        used_on: isAdmin ? rest.used_on : todayAngola(),
        created_by: context.userId,
      });
      if (error) throw new Error(error.message);
      // A sector vehicle using another sector's own lot pays that sector back; general (Centro de Custos) lots and neutral vehicles never move money.
      if (!neutral && asset.sector !== lot.sector && rest.amount > 0) {
        const { data: links } = await supabaseAdmin.from("sector_transfers").select("id").eq("kind", "contribuicao").eq("expense_id", lot.id).limit(1);
        if (!links?.length) {
          await supabaseAdmin.from("sector_transfers").insert({
            from_sector: asset.sector,
            to_sector: lot.sector,
            amount: rest.amount,
            kind: "cedencia",
            payment_method: "Numerário",
            note: `Compensação de estoque · ${lot.description}`,
            transfer_date: isAdmin ? rest.used_on : todayAngola(),
            created_by: context.userId,
          });
        }
      }
      return { ok: true };
    }
    const { error } = await context.supabase
      .from("rental_stock_usage")
      .insert({ ...rest, created_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStockUsage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Só a administração pode apagar.");
    const { error } = await context.supabase.from("rental_stock_usage").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!isAdmin) throw new Error("Só a administração pode alterar categorias.");
}

/** Renomeia uma categoria criada e actualiza as despesas que a usam. */
export const renameCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ from: z.string().trim().min(1), to: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("expense_categories").update({ name: data.to }).eq("name", data.from);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("expenses").update({ category: data.to }).eq("category", data.from);
    return { ok: true };
  });

/** Exclui uma categoria criada; as despesas antigas passam para "Outros". */
export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("expense_categories").delete().eq("name", data.name);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("expenses").update({ category: "Outros" }).eq("category", data.name);
    return { ok: true };
  });
