import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayStartIso, todayAngola } from "@/lib/tz";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date(dayStartIso(todayAngola()));

    const [
      { data: waterToday },
      { data: restaurantToday },
      { data: washToday },
      { data: transportMonthly },
    ] = await Promise.all([
      context.supabase
        .from("water_sales")
        .select("total")
        .neq("status", "Pendente")
        .gte("created_at", todayStart.toISOString()),
      context.supabase
        .from("restaurant_orders")
        .select("total")
        .gte("created_at", todayStart.toISOString())
        .in("status", ["Pago", "Em curso"]),
      context.supabase
        .from("wash_queue")
        .select("total")
        .gte("created_at", todayStart.toISOString())
        .neq("status", "Cancelado"),
      context.supabase
        .from("school_contracts")
        .select("monthly_fee")
        .in("status", ["Activo", "Pendente"]),
    ]);

    const waterTotal = (waterToday || []).reduce((sum, r) => sum + (r.total || 0), 0);
    const restaurantTotal = (restaurantToday || []).reduce((sum, r) => sum + (r.total || 0), 0);
    const washTotal = (washToday || []).reduce((sum, r) => sum + (r.total || 0), 0);
    const transportTotal = (transportMonthly || []).reduce((sum, r) => sum + (r.monthly_fee || 0), 0);

    return {
      revenue: waterTotal + restaurantTotal + washTotal + transportTotal,
      water: waterTotal,
      restaurant: restaurantTotal,
      wash: washTotal,
      transport: transportTotal,
      waterSalesCount: (waterToday || []).length,
      washServicesCount: (washToday || []).length,
      transportContractsCount: (transportMonthly || []).length,
    };
  });

export const getRevenueBySector = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const monthStart = new Date(dayStartIso(todayAngola().slice(0, 8) + "01"));

    const [
      { data: waterSales },
      { data: restaurantOrders },
      { data: washQueue },
      { data: transportContracts },
    ] = await Promise.all([
      context.supabase.from("water_sales").select("total").neq("status", "Pendente").gte("created_at", monthStart.toISOString()),
      context.supabase.from("restaurant_orders").select("total").gte("created_at", monthStart.toISOString()).in("status", ["Pago", "Em curso"]),
      context.supabase.from("wash_queue").select("total").gte("created_at", monthStart.toISOString()).neq("status", "Cancelado"),
      context.supabase.from("school_contracts").select("monthly_fee").in("status", ["Activo", "Pendente"]),
    ]);

    return {
      water: (waterSales || []).reduce((sum, r) => sum + (r.total || 0), 0),
      restaurant: (restaurantOrders || []).reduce((sum, r) => sum + (r.total || 0), 0),
      wash: (washQueue || []).reduce((sum, r) => sum + (r.total || 0), 0),
      transport: (transportContracts || []).reduce((sum, r) => sum + (r.monthly_fee || 0), 0),
    };
  });

export const getRecentActivity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("activity_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    return data || [];
  });

export const getTransportContracts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("school_contracts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    return data || [];
  });

export const getDailyOperations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date(dayStartIso(todayAngola()));

    const [{ data: restaurantOrders }, { data: washQueue }] = await Promise.all([
      context.supabase
        .from("restaurant_orders")
        .select("id, total, status, created_at, restaurant_tables(number)")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(10),
      context.supabase
        .from("wash_queue")
        .select("id, car_description, total, status, created_at, wash_services(name)")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const ops = [
      ...(restaurantOrders || []).map((o) => ({
        id: o.id,
        service: `Mesa ${(o.restaurant_tables as unknown as { number: number })?.number || "—"}`,
        sector: "Restaurante",
        value: o.total,
        status: o.status,
      })),
      ...(washQueue || []).map((q) => ({
        id: q.id,
        service: q.car_description,
        sector: "Estação 4 de Abril",
        value: q.total,
        status: q.status,
      })),
    ];

    return ops.sort((a, b) => 0); // keep insertion order roughly
  });
