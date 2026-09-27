import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function log(
  supabase: { from: (t: string) => { insert: (v: unknown) => Promise<unknown> } },
  action: string,
  sector: string,
  amount: number | null,
) {
  try {
    await supabase.from("activity_logs").insert({ action, sector, amount });
  } catch {
    /* logging is best-effort */
  }
}

/* ---------------- Água ---------------- */

export const createWaterProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        name: z.string().min(1),
        price: z.number().int().min(0),
        stock: z.number().int().min(0).default(0),
        unit: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("water_products").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createWaterSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        product_id: z.string().uuid(),
        quantity: z.number().int().min(1),
        client_name: z.string().nullable().default(null),
        status: z.string().min(1),
        payment_method: z.enum(["Numerário", "Banco"]).default("Numerário"),
        recorded_at: z.string().datetime().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: product, error: pErr } = await context.supabase
      .from("water_products")
      .select("id, name, price, stock")
      .eq("id", data.product_id)
      .single();
    if (pErr || !product) throw new Error("Produto não encontrado.");

    const t = data.recorded_at ? new Date(data.recorded_at).getTime() : NaN;
    const created_at = t && t <= Date.now() && t > Date.now() - 60 * 864e5 ? new Date(t).toISOString() : undefined;
    const total = product.price * data.quantity;
    const { error } = await context.supabase.from("water_sales").insert({
      product_id: data.product_id,
      quantity: data.quantity,
      unit_price: product.price,
      total,
      client_name: data.client_name,
      status: data.status,
      payment_method: data.payment_method,
      ...(created_at ? { created_at } : {}),
    });
    if (error) throw new Error(error.message);

    await log(context.supabase as never, `Entrega de ${product.name} × ${data.quantity}`, "agua", total);
    return { ok: true, total };
  });

export const updateWaterSaleStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("water_sales")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Restaurante ---------------- */

export const createMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1), price: z.number().int().min(0) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("restaurant_menu_items").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        number: z.number().int().min(1),
        capacity: z.number().int().min(1),
        status: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("restaurant_tables").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        table_id: z.string().uuid().nullable().default(null),
        total: z.number().int().min(0),
        status: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("restaurant_orders").insert(data);
    if (error) throw new Error(error.message);

    if (data.table_id) {
      await context.supabase
        .from("restaurant_tables")
        .update({
          status: data.status === "Fechado" ? "Livre" : "Ocupada",
          current_order_value: data.status === "Fechado" ? 0 : data.total,
        })
        .eq("id", data.table_id);
    }

    await log(context.supabase as never, "Novo pedido no restaurante", "restaurante", data.total);
    return { ok: true };
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: order, error } = await context.supabase
      .from("restaurant_orders")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("table_id")
      .single();
    if (error) throw new Error(error.message);

    if (order?.table_id && data.status === "Fechado") {
      await context.supabase
        .from("restaurant_tables")
        .update({ status: "Livre", current_order_value: 0 })
        .eq("id", order.table_id);
    }
    return { ok: true };
  });

/* ---------------- Lavagem ---------------- */

export const createWashService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().min(1), price: z.number().int().min(0) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("wash_services").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createWashEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        car_description: z.string().min(1),
        service_id: z.string().uuid(),
        status: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: service, error: sErr } = await context.supabase
      .from("wash_services")
      .select("id, name, price")
      .eq("id", data.service_id)
      .single();
    if (sErr || !service) throw new Error("Serviço não encontrado.");

    const { error } = await context.supabase.from("wash_queue").insert({
      car_description: data.car_description,
      service_id: data.service_id,
      status: data.status,
      total: service.price,
    });
    if (error) throw new Error(error.message);

    await log(context.supabase as never, `Lavagem: ${service.name}`, "lavagem", service.price);
    return { ok: true };
  });

export const updateWashStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("wash_queue")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Transporte escolar ---------------- */

export const createContract = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        school_name: z.string().min(1),
        route_code: z.string().min(1),
        student_count: z.number().int().min(0),
        monthly_fee: z.number().int().min(0),
        status: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("school_contracts").insert(data);
    if (error) throw new Error(error.message);
    await log(context.supabase as never, `Contrato: ${data.school_name}`, "transporte", data.monthly_fee);
    return { ok: true };
  });

export const updateContractStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("school_contracts")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        route_code: z.string().min(1),
        driver_name: z.string().min(1),
        vehicle: z.string().min(1),
        student_count: z.number().int().min(0),
        status: z.string().min(1),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase.from("school_routes").insert(data);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateRouteStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid(), status: z.string().min(1) }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("school_routes")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Remoção genérica ---------------- */

const DELETABLE = [
  "water_products",
  "water_sales",
  "restaurant_menu_items",
  "restaurant_tables",
  "restaurant_orders",
  "wash_services",
  "wash_queue",
  "school_contracts",
  "school_routes",
] as const;

export const deleteRecord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ table: z.enum(DELETABLE), id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Só a administração pode apagar registos.");
    const { error } = await context.supabase.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
