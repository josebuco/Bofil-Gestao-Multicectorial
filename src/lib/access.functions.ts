import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { dayEndIso, dayStartIso } from "@/lib/tz";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PERMISSION_OPTIONS = [
  { slug: "agua", label: "Água" },
  { slug: "restaurante", label: "Restaurante" },
  { slug: "lavagem", label: "Lavagem" },
  { slug: "transporte", label: "Transporte Escolar" },
  { slug: "aluguer", label: "Aluguer de Veículos" },
  { slug: "custos", label: "Centro de Custos" },
] as const;

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roles }, { data: perms }, { data: staff }] = await Promise.all([
      context.supabase.from("user_roles").select("role").eq("user_id", context.userId),
      context.supabase.from("user_permissions").select("sector").eq("user_id", context.userId),
      context.supabase.from("staff_accounts").select("full_name, active").eq("user_id", context.userId).maybeSingle(),
    ]);
    const isAdmin = (roles || []).some((r) => r.role === "admin");
    const active = isAdmin || !!staff?.active;
    return {
      isAdmin,
      name: isAdmin ? "Administrador" : staff?.full_name || "Utilizador",
      sectors: active ? (perms || []).map((p) => p.sector) : [],
    };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Apenas o administrador pode gerir utilizadores.");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const [{ data: staff }, { data: perms }] = await Promise.all([
      context.supabase.from("staff_accounts").select("*").order("created_at", { ascending: false }),
      context.supabase.from("user_permissions").select("user_id, sector"),
    ]);
    return (staff || []).map((s) => ({
      ...s,
      sectors: (perms || []).filter((p) => p.user_id === s.user_id).map((p) => p.sector),
    }));
  });

const sectorsSchema = z.array(z.enum(["agua", "restaurante", "lavagem", "transporte", "aluguer", "custos"]));

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        full_name: z.string().trim().min(2).max(100),
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
        role_label: z.string().trim().min(2).max(60),
        sectors: sectorsSchema,
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message || "Erro ao criar conta.");
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "tecnico" });
    await supabaseAdmin.from("staff_accounts").insert({
      user_id: uid,
      full_name: data.full_name,
      email: data.email,
      role_label: data.role_label,
    });
    if (data.sectors.length)
      await supabaseAdmin.from("user_permissions").insert(data.sectors.map((sector) => ({ user_id: uid, sector })));
    return { ok: true };
  });

export const updateStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        user_id: z.string().uuid(),
        active: z.boolean().optional(),
        sectors: sectorsSchema.optional(),
        password: z.string().min(6).max(72).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.active !== undefined)
      await supabaseAdmin.from("staff_accounts").update({ active: data.active }).eq("user_id", data.user_id);
    if (data.sectors) {
      await supabaseAdmin.from("user_permissions").delete().eq("user_id", data.user_id);
      if (data.sectors.length)
        await supabaseAdmin
          .from("user_permissions")
          .insert(data.sectors.map((sector) => ({ user_id: data.user_id, sector })));
    }
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const updateAdminCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(8).max(72),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(context.userId, {
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context);
    if (data.user_id === context.userId) throw new Error("Não pode apagar a conta de administrador.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addSectorEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        sector: z.enum(["agua", "restaurante", "lavagem", "transporte", "aluguer"]),
        asset_id: z.string().uuid().nullable().default(null),
        students: z.number().int().min(1).max(100000).nullable().default(null),
        per_student: z.number().int().min(0).max(100_000_000).nullable().default(null),
        amount: z.number().int().positive().max(1_000_000_000),
        cost: z.number().int().min(0).max(1_000_000_000).default(0),
        status: z.enum(["Pago", "Pendente"]).default("Pago"),
        client_name: z.string().trim().max(200).nullable().default(null),
        payment_method: z.enum(["Numerário", "Banco"]).default("Numerário"),
        recorded_at: z.string().datetime().optional(),
        entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { recorded_at, entry_date, ...row } = data;
    const t = recorded_at ? new Date(recorded_at).getTime() : NaN;
    // Registos feitos sem internet mantêm a hora real (até 60 dias atrás, nunca no futuro).
    let created_at = t && t <= Date.now() && t > Date.now() - 60 * 864e5 ? new Date(t).toISOString() : undefined;
    // Só a administração pode escolher outra data.
    if (entry_date) {
      const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
      if (isAdmin) created_at = new Date(`${entry_date}T12:00:00+01:00`).toISOString();
    }
    const { error } = await context.supabase
      .from("sector_entries")
      .insert({ ...row, created_by: context.userId, ...(created_at ? { created_at } : {}) });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSectorEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sector: z.string(), from: z.string(), to: z.string() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: rows, error } = await context.supabase
      .from("sector_entries")
      .select("id, amount, cost, status, client_name, created_at, payment_method, asset_id, students, per_student")
      .eq("sector", data.sector)
      .gte("created_at", dayStartIso(data.from))
      .lte("created_at", dayEndIso(data.to))
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return rows || [];
  });

export const deleteSectorEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Só a administração pode apagar registos.");
    const { error } = await context.supabase.from("sector_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const paySectorEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({
    id: z.string().uuid(),
    sector: z.enum(["restaurante", "lavagem"]),
    payment_method: z.enum(["Numerário", "Banco"]),
  }).parse(d))
  .handler(async ({ context, data }) => {
    // RLS checks the caller's sector access; repeated receipts are harmless.
    const { data: row, error } = await context.supabase.from("sector_entries")
      .select("id, status").eq("id", data.id).eq("sector", data.sector).single();
    if (error || !row) throw new Error("Entrada não encontrada ou sem acesso.");
    if (row.status === "Pago") return { ok: true };
    const { data: paid, error: updateError } = await context.supabase.from("sector_entries")
      .update({ status: "Pago", payment_method: data.payment_method })
      .eq("id", data.id).eq("sector", data.sector).eq("status", "Pendente").select("id");
    if (updateError) throw new Error(updateError.message);
    if (!paid?.length) throw new Error("A entrada foi alterada. Actualize o histórico.");
    return { ok: true };
  });
