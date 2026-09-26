import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dayStartIso, todayAngola } from "@/lib/tz";

export const getWaterData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date(dayStartIso(todayAngola()));

    const [{ data: products }, { data: sales }] = await Promise.all([
      context.supabase.from("water_products").select("*").order("name"),
      context.supabase
        .from("water_sales")
        .select("*, water_products(name, unit)")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const todaySales = (sales || []).filter((s) => new Date(s.created_at) >= todayStart);
    const todayRevenue = todaySales.filter((s) => s.status !== "Pendente").reduce((sum, s) => sum + (s.total || 0), 0);

    return {
      products: products || [],
      sales: sales || [],
      todayRevenue,
      todaySalesCount: todaySales.length,
    };
  });

export const getRestaurantData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date(dayStartIso(todayAngola()));

    const [{ data: tables }, { data: menuItems }, { data: orders }] = await Promise.all([
      context.supabase.from("restaurant_tables").select("*").order("number"),
      context.supabase.from("restaurant_menu_items").select("*").order("name"),
      context.supabase
        .from("restaurant_orders")
        .select("*, restaurant_tables(number)")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const occupied = (tables || []).filter((t) => t.status === "Ocupada").length;
    const todayRevenue = (orders || []).reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      tables: tables || [],
      menuItems: menuItems || [],
      orders: orders || [],
      occupied,
      free: (tables || []).filter((t) => t.status === "Livre").length,
      todayRevenue,
      todayOrders: (orders || []).length,
    };
  });

export const getWashData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const todayStart = new Date(dayStartIso(todayAngola()));

    const [{ data: services }, { data: queue }] = await Promise.all([
      context.supabase.from("wash_services").select("*").order("name"),
      context.supabase
        .from("wash_queue")
        .select("*, wash_services(name)")
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    const todayRevenue = (queue || [])
      .filter((q) => q.status !== "Cancelado")
      .reduce((sum, q) => sum + (q.total || 0), 0);

    return {
      services: services || [],
      queue: queue || [],
      waiting: (queue || []).filter((q) => q.status === "Em espera").length,
      inProgress: (queue || []).filter((q) => q.status === "Em curso").length,
      todayRevenue,
      todayServices: (queue || []).length,
    };
  });

export const getTransportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: contracts }, { data: routes }] = await Promise.all([
      context.supabase.from("school_contracts").select("*").order("created_at", { ascending: false }),
      context.supabase.from("school_routes").select("*").order("route_code"),
    ]);

    const activeContracts = (contracts || []).filter((c) => c.status === "Activo");
    const monthlyRevenue = activeContracts.reduce((sum, c) => sum + (c.monthly_fee || 0), 0);
    const totalStudents = activeContracts.reduce((sum, c) => sum + (c.student_count || 0), 0);

    return {
      contracts: contracts || [],
      routes: routes || [],
      activeContracts: activeContracts.length,
      pendingContracts: (contracts || []).filter((c) => c.status === "Pendente").length,
      monthlyRevenue,
      totalStudents,
    };
  });
