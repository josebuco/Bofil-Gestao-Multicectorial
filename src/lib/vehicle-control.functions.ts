import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayEndIso, dayStartIso, todayAngola } from "@/lib/tz";
import { STOCK_CATEGORY, STOCK_SECTORS, type FleetSector } from "@/lib/rental.functions";
import { canSeeVehicleFinancials } from "@/lib/vehicle-control";

export const getVehicleControlData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: permissions }, { data: staff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.from("user_permissions").select("sector").eq("user_id", context.userId),
      context.supabase.from("staff_accounts").select("active").eq("user_id", context.userId).maybeSingle(),
    ]);
    const grants = (permissions || []).map((row) => row.sector);
    if (!isAdmin && (!staff?.active || !grants.includes("veiculos"))) throw new Error("Sem permissão para esta aba.");

    const from = isAdmin ? data.from : todayAngola();
    const to = isAdmin ? data.to : todayAngola();
    if (from > to) throw new Error("O início do período deve ser anterior ao fim.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: assets, error: assetsError } = await supabaseAdmin
      .from("rental_assets")
      .select("id, name, kind, plate, sector")
      .eq("active", true)
      .in("sector", [...STOCK_SECTORS, "neutro"])
      .order("name");
    if (assetsError) throw new Error("Não foi possível carregar os veículos.");
    const rows = assets || [];
    const ids = rows.filter((asset) => asset.kind === "Veículo").map((asset) => asset.id);
    if (!ids.length) return { range: { from, to }, assets: [], entries: [], truckSales: [], expenses: [], stockItems: [], usages: [], contributions: [] };

    const [{ data: entries, error: entriesError }, { data: truckSales, error: salesError }, { data: expenses, error: expensesError }, { data: purchases, error: purchasesError }, { data: allUsages, error: usagesError }] = await Promise.all([
      supabaseAdmin.from("sector_entries").select("id, amount, cost, status, client_name, payment_method, created_at, asset_id, sector").in("asset_id", ids).gte("created_at", dayStartIso(from)).lte("created_at", dayEndIso(to)).order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("water_sales").select("id, asset_id, description, quantity, unit_price, total, client_name, status, payment_method, created_at").in("asset_id", ids).gte("created_at", dayStartIso(from)).lte("created_at", dayEndIso(to)).order("created_at", { ascending: false }).limit(2000),
      supabaseAdmin.from("expenses").select("id, sector, category, description, amount, expense_date, status, payment_method, asset_id, supplier").in("asset_id", ids).gte("expense_date", from).lte("expense_date", to).order("expense_date", { ascending: false }).limit(2000),
      supabaseAdmin.from("expenses").select("id, description, amount, quantity, expense_date, supplier, sector, stock_unit, status, asset_id").in("sector", [...STOCK_SECTORS]).eq("category", STOCK_CATEGORY).eq("status", "Pago").order("expense_date", { ascending: false }).limit(1000),
      supabaseAdmin.from("rental_stock_usage").select("id, purchase_id, asset_id, quantity, amount, note, used_on, sector").order("created_at", { ascending: false }).limit(5000),
    ]);
    const { data: contributions, error: ctbError } = await supabaseAdmin.from("sector_transfers").select("id, asset_id, amount, note, transfer_date").in("asset_id", ids).in("kind", ["contribuicao", "cedencia"]).gte("transfer_date", from).lte("transfer_date", to).limit(2000);
    if (ctbError) throw new Error("Não foi possível carregar os custos do Centro de Custos.");
    if (entriesError || salesError || expensesError || purchasesError || usagesError) throw new Error("Não foi possível carregar os registos dos veículos.");
    const financialAssetIds = new Set(rows
      .filter((asset) => canSeeVehicleFinancials(Boolean(isAdmin), grants, asset.sector))
      .map((asset) => asset.id));
    // Never send another sector's financial rows to the browser, even if its UI hides them.
    const visibleEntries = (entries || []).filter((entry) => Boolean(entry.asset_id) && financialAssetIds.has(entry.asset_id as string));
    const visibleTruckSales = (truckSales || []).filter((sale) => Boolean(sale.asset_id) && financialAssetIds.has(sale.asset_id as string));
    const visibleExpenses = (expenses || []).filter((expense) => expense.asset_id && financialAssetIds.has(expense.asset_id));
    const visibleContributions = (contributions || []).filter((contribution) => contribution.asset_id && financialAssetIds.has(contribution.asset_id));
    const usageRows = allUsages || [];
    const purchaseIds = (purchases || []).map((purchase) => purchase.id);
    const { data: lotLinks } = purchaseIds.length
      ? await supabaseAdmin.from("sector_transfers").select("expense_id").eq("kind", "contribuicao").in("expense_id", purchaseIds)
      : { data: [] as { expense_id: string | null }[] };
    const generalLots = new Set((lotLinks || []).map((row) => row.expense_id).filter(Boolean));
    const stockItems = (purchases || []).map((purchase) => {
      const quantity = purchase.quantity && purchase.quantity > 0 ? purchase.quantity : 1;
      const mine = usageRows.filter((usage) => usage.purchase_id === purchase.id);
      const usedQuantity = mine.reduce((sum, usage) => sum + (usage.quantity || 0), 0);
      const usedAmount = mine.reduce((sum, usage) => sum + (usage.amount || 0), 0);
      return {
        id: purchase.id,
        description: purchase.description,
        supplier: purchase.supplier,
        sector: purchase.sector,
        asset_id: purchase.asset_id,
        general: generalLots.has(purchase.id),
        fuel: purchase.stock_unit === "litro",
        purchase_date: purchase.expense_date,
        quantity,
        amount: purchase.amount || 0,
        unit_price: quantity ? (purchase.amount || 0) / quantity : 0,
        left_quantity: quantity - usedQuantity,
        left_amount: (purchase.amount || 0) - usedAmount,
      };
    });
    return {
      range: { from, to },
      assets: rows.filter((asset) => asset.kind === "Veículo").map((asset) => ({ ...asset, sector: asset.sector as FleetSector | "neutro", canSeeFinancials: asset.sector !== "neutro" && (Boolean(isAdmin) || grants.includes(asset.sector)) })),
      entries: visibleEntries,
      truckSales: visibleTruckSales,
      expenses: visibleExpenses,
      stockItems,
      contributions: visibleContributions,
      usages: usageRows.filter((usage) => usage.used_on >= from && usage.used_on <= to),
    };
  });

export type VehicleControlAsset = {
  id: string;
  name: string;
  kind: string;
  plate: string | null;
  sector: FleetSector | "neutro";
  canSeeFinancials: boolean;
};

export const createNeutralVehicle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ name: z.string().trim().min(1).max(100), plate: z.string().trim().max(40).nullable().default(null) }).parse(input))
  .handler(async ({ context, data }) => {
    const [{ data: isAdmin }, { data: permissions }, { data: staff }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.from("user_permissions").select("sector").eq("user_id", context.userId),
      context.supabase.from("staff_accounts").select("active").eq("user_id", context.userId).maybeSingle(),
    ]);
    if (!isAdmin && (!staff?.active || !(permissions || []).some((row) => row.sector === "veiculos"))) throw new Error("Sem permissão para cadastrar veículos.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("rental_assets").insert({ name: data.name, plate: data.plate || null, kind: "Veículo", sector: "neutro" });
    if (error) throw new Error("Não foi possível cadastrar o veículo.");
    return { ok: true };
  });
